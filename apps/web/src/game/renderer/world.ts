import * as T from 'three';
import {buildAsset,assetInfo,box,ball,beam,cyl,mat,C,consolidate,type AssetKind} from '../../../../../packages/asset-tools/src/models';
import {buildTree,setFoliageTime} from '../../../../../packages/asset-tools/src/nature';
import {animateAsset,type Clip} from '../../../../../packages/asset-tools/src/actors';
import {createEnvironment} from './environment';
import {createForest} from './forest';
import {createLayout,SEED,random,coast,roadDistance} from './layout';
export {SEED,random,coast,roadDistance} from './layout';

interface Actor {model:T.Group;clip:Clip;phase:number;origin:T.Vector3;path?:number;}
interface Batch {mesh:T.InstancedMesh;objects:T.Mesh[];}
const hiddenMatrix=new T.Matrix4().makeScale(0,0,0);
function batchObjects(root:T.Group){root.updateMatrixWorld(true);const entries=new Map<string,{geometry:T.BufferGeometry;material:T.Material;objects:T.Mesh[]}>();
 root.traverse(o=>{if(o instanceof T.Mesh){const m=o.material as T.Material,key=o.geometry.uuid+m.uuid;let entry=entries.get(key);if(!entry){entry={geometry:o.geometry,material:m,objects:[]};entries.set(key,entry);}entry.objects.push(o);}});
 const group=new T.Group(),batches:Batch[]=[];
 for(const e of entries.values()){const inst=new T.InstancedMesh(e.geometry,e.material,e.objects.length);e.objects.forEach((o,i)=>inst.setMatrixAt(i,o.matrixWorld));inst.castShadow=true;inst.receiveShadow=true;inst.computeBoundingSphere();group.add(inst);batches.push({mesh:inst,objects:e.objects});}
 return {group,batches};
}
export function createWorld(renderer:T.WebGLRenderer,seed=SEED){
 const layout=createLayout(seed),height=layout.height,group=new T.Group(),staticRoot=new T.Group(),actorRoot=new T.Group(),rand=random(seed);
 const models=new Map<AssetKind,T.Group>();for(const k of Object.keys(assetInfo) as AssetKind[])models.set(k,buildAsset(k));
 const sailTime={value:0};const sail=mat('#e9dbc0');sail.onBeforeCompile=shader=>{shader.uniforms.sailTime=sailTime;shader.vertexShader='uniform float sailTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.z += sin(uv.x*5.0-sailTime*1.4)*sin(uv.y*3.14159)*.08;');};sail.customProgramCacheKey=()=> 'meridian-sail-wind-v1';sail.needsUpdate=true;
 const actors:Actor[]=[],pickables:T.Mesh[]=[],ships:T.Group[]=[],animated:T.ShaderMaterial[]=[];
 const environment=createEnvironment();environment.waterMat.uniforms.shoal.value.set(layout.fish.x,layout.fish.z,layout.fish.radius);group.add(environment.group);
 const terrain=new T.PlaneGeometry(180,180,280,280);terrain.rotateX(-Math.PI/2);const a=terrain.attributes.position,colors:number[]=[];
 for(let i=0;i<a.count;i++){
   const x=a.getX(i),z=a.getZ(i),y=height(x,z);a.setY(i,y);const shore=coast(z)-x;
   const color=new T.Color(shore<5?'#c7b891':'#829369');
   if(shore>5){const k=(Math.sin(x*.1+z*.06)+Math.cos(z*.17-x*.09))*.5;color.lerp(new T.Color('#566e4c'),Math.max(0,k)*.4);color.lerp(new T.Color('#b1ac79'),Math.max(0,-k)*.35);}
   const road=roadDistance(x,z);if(road<2.1&&shore>4)color.lerp(new T.Color('#b9a789'),road<1.4?.95:.45);
   if(Math.abs(x-layout.farm.x)<layout.farm.hx&&Math.abs(z-layout.farm.z)<layout.farm.hz)color.set('#756b48');
   color.offsetHSL(0,0,rand()*.035-.01);colors.push(color.r,color.g,color.b);
 }
 terrain.setAttribute('color',new T.Float32BufferAttribute(colors,3));terrain.computeVertexNormals();
 const ground=new T.Mesh(terrain,new T.MeshStandardMaterial({vertexColors:true,roughness:1}));ground.receiveShadow=true;group.add(ground);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d')!,pixels=ctx.createImageData(128,128);
 for(let i=0;i<pixels.data.length;i+=4){const v=190+rand()*55;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=v;pixels.data[i+3]=255;}ctx.putImageData(pixels,0,0);
 const texture=new T.CanvasTexture(canvas);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(120,120);ground.material.map=texture;ground.material.bumpMap=texture;ground.material.bumpScale=.055;
 function addStatic(kind:AssetKind,x:number,z:number,y=height(x,z),rotation=0,pick=true){
   const model=models.get(kind)!.clone();model.position.set(x,y,z);model.rotation.y=rotation;staticRoot.add(model);
   if(pick){const bounds=new T.Box3().setFromObject(model),size=bounds.getSize(new T.Vector3());const proxy=new T.Mesh(new T.BoxGeometry(size.x,size.y,size.z),new T.MeshBasicMaterial({visible:false}));proxy.position.copy(bounds.getCenter(new T.Vector3()));proxy.userData={kind};pickables.push(proxy);group.add(proxy);}
   return model;
 }
 for(const p of layout.buildings)addStatic(p.kind as AssetKind,p.x,p.z,p.y,p.rotation);
 const mine=addStatic('mine',layout.mine.x,layout.mine.z,layout.mine.y);group.add(mine);
 let oreRemaining=100,lastResourceTime=0;
 function setOreRemaining(percent:number){oreRemaining=T.MathUtils.clamp(percent,0,100);mine.getObjectByName('ore')!.visible=oreRemaining>0;}
 for(let i=0;i<5;i++){const a=i*2.4;addStatic('berries',layout.berries.x+Math.cos(a)*1.3,layout.berries.z+Math.sin(a)*1.3,layout.berries.y,a);}
 // A raised, solid terrace sits on a flattened reserved pad. No intersecting decal.
 const plaza=new T.Group(),py=layout.plaza.y;
 cyl(plaza,3.58,3.63,.16,0,.08,0,'#a9a38d',64);
 const stoneColors=['#bdb49b','#b1ab95','#c8bea3'];
 for(let ring=1;ring<=7;ring++){const n=Math.floor(ring*12),r=ring*.47;for(let i=0;i<n;i++){const theta=i/n*Math.PI*2;const tile=box(plaza,.43,.055,.32,Math.cos(theta)*r,.185,Math.sin(theta)*r,stoneColors[i%3]);tile.rotation.y=-theta;}}
 cyl(plaza,1.20,1.27,.30,0,.35,0,C.stone,32);
 const basin=new T.Mesh(new T.TorusGeometry(1.12,.10,8,40),mat(C.light));basin.rotation.x=Math.PI/2;basin.position.y=.52;plaza.add(basin);
 cyl(plaza,1.04,1.04,.025,0,.51,0,'#527f74',40);cyl(plaza,.20,.35,1.3,0,1.0,0,C.trim,20);cyl(plaza,.62,.28,.16,0,1.61,0,C.light,32);ball(plaza,0,1.83,0,.12,.19,.12,C.gold,2);
 const fountain=consolidate(plaza);fountain.position.set(layout.plaza.x,py,layout.plaza.z);staticRoot.add(fountain);
 // Thin falling water arcs stay above the basin.
 const jetPositions:number[]=[];for(let i=0;i<8;i++){const theta=i*Math.PI/4;for(let j=0;j<13;j++){const f=j/12;jetPositions.push(layout.plaza.x+Math.cos(theta)*(.28+f*.56),py+1.67+.18*Math.sin(f*Math.PI)-f*1.12,layout.plaza.z+Math.sin(theta)*(.28+f*.56));}}
 const jets=new T.Points(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(jetPositions,3)),new T.PointsMaterial({color:'#c4dfd7',size:.032,transparent:true,opacity:.75}));group.add(jets);
 const props=new T.Group();
 // The entire farm footprint is reserved for soil, crops and its fence.
 for(let row=0;row<13;row++){const x=layout.farm.x-3.6+row*.55;for(let z=layout.farm.z-5.4;z<layout.farm.z+5.4;z+=.27){const yy=height(x,z);beam(props,[x,yy,z],[x,yy+.65,z],.013,'#bda265');for(let ear=0;ear<3;ear++)ball(props,x+(ear-1)*.04,yy+.60+ear*.03,z,.045,.12,.036,'#cebc79',0);}}
 for(const z of [layout.farm.z-5.8,layout.farm.z+5.8])for(let x=layout.farm.x-4;x<layout.farm.x+4;x+=1.6){const yy=height(x,z);box(props,.09,.85,.09,x,yy+.4,z,C.wood);beam(props,[x,yy+.6,z],[x+1.6,height(x+1.6,z)+.6,z],.04,C.wood);}
 for(const [x,z] of [[-9,1],[2,1],[-15,10],[10,10],[-25,10]]){const y=height(x,z);beam(props,[x,y,z],[x,y+2.6,z],.045,C.dark);box(props,.28,.4,.28,x,y+2.6,z,C.dark);box(props,.20,.3,.20,x,y+2.6,z,'#d5c396');cyl(props,0,.23,.17,x,y+2.89,z,C.dark,4);}
 for(let i=0;i<26;i++){const x=15+rand()*4,z=13+rand()*7;if(!layout.allowsDecoration(x,z,.45))continue;const y=height(x,z);if(i%3===0){cyl(props,.27,.23,.65,x,y+.33,z,C.wood,14);}else{box(props,.57,.5,.57,x,y+.25,z,'#91724d');for(const side of [-1,1])box(props,.045,.53,.59,x+side*.19,y+.25,z,C.dark);}}
 staticRoot.add(consolidate(props));
 const dx=coast(20)-6,dock=new T.Group();
 for(let i=0;i<29;i++)box(dock,.42,.15,3.2,dx+i*.46,1.25,20,'#947a54');
 for(let i=0;i<7;i++)for(const side of [-1,1]){cyl(dock,.12,.15,2.4,dx+i*2,1,20+side*1.35,C.wood,10);cyl(dock,.18,.18,.14,dx+i*2,2.15,20+side*1.35,C.trim,10);}staticRoot.add(consolidate(dock));
 for(const [x,z,r] of [[dx+9,25,.1],[54,-27,-.7]]){const ship=models.get('ship')!.clone();ship.position.set(x,.20,z);ship.rotation.y=r;group.add(ship);ships.push(ship);}
 const fishingBoat=models.get('fishingBoat')!.clone();fishingBoat.position.set(layout.fish.x+1,.20,layout.fish.z-1);fishingBoat.rotation.y=-.6;group.add(fishingBoat);ships.push(fishingBoat);
 function actor(kind:AssetKind,x:number,z:number,clip:Clip='idle',path=0){const m=models.get(kind)!.clone();m.name=kind;m.position.set(x,height(x,z),z);actorRoot.add(m);actors.push({model:m,clip,phase:rand()*6,origin:m.position.clone(),path});return m;}
 for(let row=0;row<3;row++)for(let col=0;col<6;col++){const m=actor('infantry',2+col*1.1,17+row*1.2,row===2?'walk':'idle',row===2?1:0);m.rotation.y=.15;}
 for(let i=0;i<3;i++){const m=actor('cavalry',-5-i*1.7,17,i===0?'walk':'idle',i===0?.9:0);m.rotation.y=.25;}
 for(let i=0;i<3;i++)actor('cannon',4+i*3.8,24,i===2?'walk':'fire',i===2?.8:0).rotation.y=0.4;
 const worker=actor('villager',layout.mine.x+2.1,layout.mine.z,'mine');worker.rotation.y=-Math.PI/2;
 actor('villager',-3,12,'walk',2.0);actor('villager',layout.farm.x+4.3,layout.farm.z+2,'farm').rotation.y=-Math.PI/2;
 actor('villager',layout.berries.x+1.8,layout.berries.z,'work').rotation.y=-Math.PI/2;
 for(let i=0;i<7;i++){const a=i*2.4,r=.8+rand()*1.8;const m=actor('sheep',layout.sheep.x+Math.cos(a)*r,layout.sheep.z+Math.sin(a)*r,i%3?'work':'walk',i%3?0:.4);m.rotation.y=a;}
 for(let i=0;i<3;i++){const a=i*2.4,r=1+rand()*2.5;const m=actor('fish',layout.fish.x+Math.cos(a)*r,layout.fish.z+Math.sin(a)*r,'walk');m.position.y=-0.8;actors[actors.length-1].origin.y=-0.8;m.userData.fishIndex=i;m.rotation.y=-a;}
 const treeVariants=Array.from({length:6},(_,i)=>buildTree(17+i*127,i>3)),trees:T.Group[]=[];let treeCount=0;const decorations:{kind:string;x:number;z:number;radius:number}[]=[];
 for(let i=0;i<420;i++){const x=-65+rand()*96,z=-62+rand()*112;const forest=z<-28||x<-42||z>34||((x<-24||x>14)&&rand()<.25);if(!forest||!layout.allowsDecoration(x,z,2.6)||x>coast(z)-8)continue;const o=treeVariants[i%6].clone();o.position.set(x,height(x,z),z);o.rotation.y=rand()*6.28;o.scale.setScalar(.75+rand()*.4);o.userData.variant=i%6;trees.push(o);treeCount++;decorations.push({kind:'tree',x,z,radius:2.6});}
 const forest=createForest(renderer,treeVariants,trees);group.add(forest.group);
 const rockProto=new T.Group();for(let i=0;i<4;i++)ball(rockProto,rand()*.8,rand()*.35,rand()*.8,.6+rand()*.6,.5+rand()*.5,.6+rand()*.6,i%2?'#929b88':'#a5ab96',1);const rock=consolidate(rockProto);
 for(let i=0;i<85;i++){const z=-56+rand()*112,x=i<50?coast(z)-2+rand()*4:-59+rand()*27;if(!layout.allowsDecoration(x,z,1.9,true))continue;const o=rock.clone();o.position.set(x,height(x,z)-.18,z);o.scale.setScalar(.55+rand()*.6);o.rotation.y=rand()*6.28;staticRoot.add(o);decorations.push({kind:'rock',x,z,radius:1.9});}
 for(let i=0;i<60;i++){const x=-50+rand()*67,z=-36+rand()*76;if(!layout.allowsDecoration(x,z,1.1))continue;addStatic('bush',x,z,undefined,rand()*6.28,false);decorations.push({kind:'bush',x,z,radius:1.1});}
 const staticBatch=batchObjects(staticRoot);group.add(staticBatch.group);
 // A bounded instance buffer carries all rigid animated parts in shared draws.
 const actorBatch=batchObjects(actorRoot);actorBatch.batches.forEach(b=>{b.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);b.mesh.frustumCulled=false;});group.add(actorBatch.group);
 const blade=new T.BufferGeometry();blade.setAttribute('position',new T.Float32BufferAttribute([-.028,0,0,.028,0,0,.015,.24,0,-.014,.18,.026,.014,.18,.026,0,.36,.04],3));blade.computeVertexNormals();
 const grassMat=new T.MeshStandardMaterial({color:'#8b965e',side:T.DoubleSide,roughness:1}),wind={value:0};
 grassMat.onBeforeCompile=s=>{s.uniforms.time=wind;s.vertexShader='uniform float time;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n transformed.x += sin(time*1.8+instanceMatrix[3].x*.5+instanceMatrix[3].z*.7)*position.y*position.y*.42;');};
 const grass=new T.InstancedMesh(blade,grassMat,23000);grass.userData.wind=wind;const dummy=new T.Object3D();let count=0;
 for(let i=0;i<44000&&count<23000;i++){const x=-56+rand()*91,z=-46+rand()*96;if(!layout.allowsDecoration(x,z,.06)||x>coast(z)-5)continue;dummy.position.set(x,height(x,z),z);dummy.rotation.y=rand()*6.28;dummy.scale.setScalar(.6+rand()*.65);dummy.updateMatrix();grass.setMatrixAt(count,dummy.matrix);grass.setColorAt(count,new T.Color().setHSL(.20+rand()*.03,.23,.36+rand()*.14));count++;}grass.count=count;grass.receiveShadow=true;grass.computeBoundingSphere();group.add(grass);
 const hall=layout.buildings.find(p=>p.kind==='hall')!;
 for(const [x,z,h] of [[hall.x,hall.z,10],[12,14,4],[-16,5,4]]){const y=height(x,z),pole=new T.Group();beam(pole,[x,y,z],[x,y+h,z],.025,C.gold);group.add(pole);const m=new T.ShaderMaterial({side:T.DoubleSide,uniforms:{time:{value:0}},vertexShader:'uniform float time;varying vec2 vUv;void main(){vUv=uv;vec3 p=position;p.z+=sin(uv.x*7.-time*2.)*uv.x*.18;p.y+=sin(uv.x*5.-time*1.6)*uv.x*.08;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',fragmentShader:'varying vec2 vUv;void main(){vec3 c=vec3(.14,.36,.36);if(abs(vUv.y-.5)<.025||abs(vUv.x-.2)<.023)c=vec3(.8,.65,.36);gl_FragColor=vec4(c,1.);}'});animated.push(m);const flag=new T.Mesh(new T.PlaneGeometry(1.4,.85,14,8),m);flag.position.set(x+.7,y+h-.5,z);group.add(flag);}
 function update(t:number){
   const resourceDt=Math.min(.05,Math.max(0,t-lastResourceTime));lastResourceTime=t;
   setOreRemaining(oreRemaining-resourceDt);worker.name='villager';
   const miner=actors.find(a=>a.model===worker)!;miner.clip=oreRemaining>0?'mine':'idle';
   wind.value=t*environment.wind.value;setFoliageTime(t,environment.wind.value);sailTime.value=t*environment.wind.value;animated.forEach(m=>m.uniforms.time.value=t*environment.wind.value);
   for(const a of actors){animateAsset(a.model,t+a.phase,a.clip);if(a.model.name==='fish'){const cycle=Math.floor(t/5),rng=random(seed+cycle*131),activeCount=1+Math.floor(rng()*3),index=a.model.userData.fishIndex as number;const phase=(t%5)-index*0.24;const jump=index<activeCount&&phase>=0&&phase<1.15;const f=phase/1.15;a.model.position.x=a.origin.x+(jump?f*1.4:0);a.model.position.y=jump?0.10+Math.sin(f*Math.PI)*0.90:-0.8;a.model.rotation.set(jump?Math.cos(f*Math.PI)*0.6:0,Math.PI/2,0);}else if(a.path){a.model.position.z=a.origin.z+Math.sin(t*.35+a.phase)*a.path;a.model.position.y=height(a.model.position.x,a.model.position.z);}}
   actorRoot.updateMatrixWorld(true);actorBatch.batches.forEach(b=>{b.objects.forEach((o,i)=>b.mesh.setMatrixAt(i,o.visible?o.matrixWorld:hiddenMatrix));b.mesh.instanceMatrix.needsUpdate=true;});
   ships.forEach((s,i)=>{s.position.y=.20+Math.sin(t*.85+i)*.035;s.rotation.z=Math.sin(t*.7+i)*.012;});
 }
 group.userData.layout={seed,buildings:layout.buildings,decorations};
 return {group,forest,mine,setOreRemaining,getOreRemaining:()=>oreRemaining,grass,animated,ships,pickables,models,environment,layout,height,actors,actorRoot,update,stats:{trees:treeCount,units:actors.filter(a=>['infantry','cavalry','villager'].includes(a.model.name)).length,buildings:layout.buildings.length}};
}
