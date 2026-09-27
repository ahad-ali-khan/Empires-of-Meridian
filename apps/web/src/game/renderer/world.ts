import * as T from 'three';
import {buildAsset,box,ball,beam,cyl,mat,C,consolidate,type AssetKind} from '../../../../../packages/asset-tools/src/models';
import {buildTree,buildFelledTree,setFoliageTime,setResourceLevel} from '../../../../../packages/asset-tools/src/nature';
import {animateAsset,type Clip} from '../../../../../packages/asset-tools/src/actors';
import {createEnvironment} from './environment';
import {createForest} from './forest';
import {damageAnimal,collectMeat,type Harvestable} from './resource-demo';
import {createLayout,SEED,random,coast,roadDistance} from './layout';
export {SEED,random,coast,roadDistance} from './layout';

interface Actor {model:T.Group;clip:Clip;phase:number;origin:T.Vector3;path?:number;life?:Harvestable;}
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
 const models=new Map<AssetKind,T.Group>();for(const k of ['hall','house','market','tower','infantry','cavalry','cannon','ship','fishingBoat','villager','villagerFemale','sheep','bush','berries','mine','fish','tree','pine'] as AssetKind[])models.set(k,buildAsset(k));
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
   if(!models.has(kind))models.set(kind,buildAsset(kind));
   const model=models.get(kind)!.clone();model.position.set(x,y,z);model.rotation.y=rotation;staticRoot.add(model);
   if(pick){const bounds=new T.Box3().setFromObject(model),size=bounds.getSize(new T.Vector3());const proxy=new T.Mesh(new T.BoxGeometry(size.x,size.y,size.z),new T.MeshBasicMaterial({visible:false}));proxy.position.copy(bounds.getCenter(new T.Vector3()));proxy.userData={kind};pickables.push(proxy);group.add(proxy);}
   return model;
 }
 for(const p of layout.buildings)addStatic(p.kind as AssetKind,p.x,p.z,p.y,p.rotation);
 const mine=addStatic('mine',layout.mine.x,layout.mine.z,layout.mine.y);group.add(mine);
 let oreRemaining=100,lastResourceTime=0;
 function setOreRemaining(percent:number){oreRemaining=T.MathUtils.clamp(percent,0,100);setResourceLevel(mine,oreRemaining);}
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
 const dx=coast(20)-6;
 addStatic('dock',dx+3,20,1.0,Math.PI/2);
 for(const [x,z,r] of [[dx+9,25,.1],[54,-27,-.7]]){const ship=models.get('ship')!.clone();ship.position.set(x,.20,z);ship.rotation.y=r;group.add(ship);ships.push(ship);}
 const fishingBoat=models.get('fishingBoat')!.clone();fishingBoat.position.set(layout.fish.x+1,.20,layout.fish.z-1);fishingBoat.rotation.y=-.6;group.add(fishingBoat);ships.push(fishingBoat);
 function actor(kind:AssetKind,x:number,z:number,clip:Clip='idle',path=0){if(kind==='villager'&&rand()<.5)kind='villagerFemale';if(!models.has(kind))models.set(kind,buildAsset(kind));const m=models.get(kind)!.clone();m.name=kind;m.position.set(x,height(x,z),z);actorRoot.add(m);actors.push({model:m,clip,phase:rand()*6,origin:m.position.clone(),path});return m;}
 for(let row=0;row<3;row++)for(let col=0;col<6;col++){const m=actor('infantry',2+col*1.1,17+row*1.2,row===2?'walk':'idle',row===2?1:0);m.rotation.y=.15;}
 for(let i=0;i<3;i++){const m=actor('cavalry',-5-i*1.7,17,i===0?'walk':'idle',i===0?.9:0);m.rotation.y=.25;}
 for(let i=0;i<3;i++)actor('cannon',4+i*3.8,24,i===2?'walk':'fire',i===2?.8:0).rotation.y=0.4;
 const worker=actor('villager',layout.mine.x+2.1,layout.mine.z,'mine');worker.rotation.y=-Math.PI/2;
 actor('villager',-3,12,'walk',2.0);const farmer=actor('villager',layout.farm.x,layout.farm.z,'farm');
 actor('villager',layout.berries.x+1.8,layout.berries.z,'gather').rotation.y=-Math.PI/2;
 const fisher=actor('villager',coast(40)-6,40,'fish');fisher.rotation.y=Math.PI/2;fisher.userData.fishingTarget=[coast(40)-2,.085,40];
 for(let i=0;i<4;i++)actor('deer',-49+i*1.6,30+i,'graze',1.2);
 for(let i=0;i<3;i++)actor('wolf',-53+i*1.3,-24,'walk',1.8);
 for(let i=0;i<7;i++){const a=i*2.4,r=.8+rand()*1.8;const m=actor('sheep',layout.sheep.x+Math.cos(a)*r,layout.sheep.z+Math.sin(a)*r,i%3?'work':'walk',i%3?0:.4);m.rotation.y=a;}
 for(let i=0;i<3;i++){const a=i*2.4,r=1+rand()*2.5;const m=actor('fish',layout.fish.x+Math.cos(a)*r,layout.fish.z+Math.sin(a)*r,'walk');m.position.y=-0.8;actors[actors.length-1].origin.y=-0.8;m.userData.fishIndex=i;m.rotation.y=-a;}
 for(let i=0;i<2;i++){const m=actor('fish',coast(40)-2+i*.4,40+i*.35,'walk');m.position.y=-.8;actors[actors.length-1].origin.y=-.8;m.userData.fishIndex=i;}
 for(const a of actors)if(['sheep','deer','wolf'].includes(a.model.name))a.life={health:40,food:a.model.name==='wolf'?0:80,state:'alive'};
 const woodPosition=new T.Vector3(-46,height(-46,12),12),woodStates=[buildTree(127),buildFelledTree(127),buildAsset('stump')];woodStates.forEach((m,i)=>{m.position.copy(woodPosition);m.visible=i===0;group.add(m);});
 const woodWorker=actor('villager',-46,13.1,'chop');woodWorker.rotation.y=Math.PI;
 let woodRemaining=100,fallStarted=-1,foodCollected=0,woodCollected=0,action='Ready',hunt:{hunter:Actor;prey:Actor;collector:Actor;nextHitAt:number;started:number}|null=null;
 const demoWorker=actors.find(a=>a.model.userData.villager&&a.clip==='walk')!;
 function huntAnimal(kind:'sheep'|'deer',hunterKind:AssetKind='villager'){
  const prey=actors.find(a=>a.model.name===kind&&a.life?.state==='alive');if(!prey){action='No living '+kind+' remain';return null;}
  const hunter=hunterKind==='villager'?demoWorker:actors.find(a=>a.model.name===hunterKind)||demoWorker;
  hunter.path=0;prey.path=0;prey.clip='idle';hunt={hunter,prey,collector:demoWorker,nextHitAt:Infinity,started:-1};action='Closing on '+kind;return prey.model.position.clone();
 }
 function resetResources(){setOreRemaining(100);woodRemaining=100;foodCollected=woodCollected=0;hunt=null;action='Resources restored';for(const a of actors)if(a.life){a.life={health:40,food:a.model.name==='wolf'?0:80,state:'alive'};a.model.visible=true;a.model.traverse(o=>o.visible=true);a.clip=a.model.name==='wolf'?'walk':'graze';}}
 function approach(a:Actor,target:T.Vector3,dt:number,distance=1.0,speed=2.4){const delta=target.clone().sub(a.model.position);delta.y=0;const d=delta.length();a.model.rotation.y=Math.atan2(delta.x,delta.z);if(d>distance){a.model.position.addScaledVector(delta.normalize(),Math.min(d-distance,dt*speed));a.model.position.y=height(a.model.position.x,a.model.position.z);a.clip='walk';return false;}return true;}
 function demoUpdate(t:number,dt:number){
  if(woodRemaining>50)fallStarted=-1;
  if(woodRemaining>0){const before=woodRemaining;woodRemaining=Math.max(0,woodRemaining-dt*2);woodCollected+=before-woodRemaining;}woodStates.forEach((m,i)=>m.visible=i===(woodRemaining>50?0:woodRemaining>0?1:2));
  if(woodRemaining<=50&&woodRemaining>0){if(fallStarted<0)fallStarted=t;animateAsset(woodStates[1],t-fallStarted,'idle');}
  actors.find(a=>a.model===woodWorker)!.clip=woodRemaining>0?'chop':'idle';
  if(hunt){const {hunter,prey,collector}=hunt,life=prey.life!;
   if(life.state==='alive'){
    if(hunt.started<0)hunt.started=t;
    const mounted=Boolean(hunter.model.userData.mounted),ranged=hunter.model.userData.villager||hunter.model.name==='infantry';
    const range=ranged?5.2:mounted?2.35:1.35;
    if(prey.model.name==='deer'){
     const elapsed=t-hunt.started,cycle=Math.floor(elapsed/4.8),running=life.health<40&&elapsed%4.8<1.6;
     prey.clip=running?'flee':'graze';
     if(running){const angle=cycle*2.4+prey.phase;prey.model.rotation.y=angle;prey.model.position.x+=Math.sin(angle)*dt*3.8;prey.model.position.z+=Math.cos(angle)*dt*3.8;prey.model.position.y=height(prey.model.position.x,prey.model.position.z);}
    }
    if(approach(hunter,prey.model.position,dt,range,5.2)){
     const clip=hunter.model.userData.villager?'hunt':'attack';
     if(hunter.clip!==clip){
      hunter.phase=-t;
      const target=prey.model.position.clone().add(new T.Vector3(0,.78,0));hunter.model.userData.shotTarget=target;
      const shot=hunter.model.userData.shot as {release:number;period:number;type:string}|undefined;
      const speed=shot?.type==='grenade'?4:shot?.type==='shell'?9:12;
      const travel=shot?T.MathUtils.clamp(hunter.model.position.distanceTo(target)/speed,.14,.9):0;
      hunt.nextHitAt=t+(shot?.release??.55)+travel;
     }
     hunter.clip=clip;action='Aiming at '+prey.model.name;
     hunter.model.userData.shotTarget=prey.model.position.clone().add(new T.Vector3(0,.78,0));
     if(t>=hunt.nextHitAt){damageAnimal(life,20);const shot=hunter.model.userData.shot as {period:number}|undefined;hunt.nextHitAt+=shot?.period??1.6;action=mounted?'Lance strike on '+prey.model.name:'Projectile hit '+prey.model.name;}
     if(life.health===0){prey.clip='dead';prey.model.userData.deathDirection=rand()*Math.PI*2;hunter.clip='idle';}
    }else {hunter.clip='walk';action='Closing on '+prey.model.name;}
   }
   else if(life.state==='dead'){if(approach(collector,prey.model.position,dt,.75)){collector.clip='process';action='Collecting meat';foodCollected+=collectMeat(life,dt*8);}}
   else{prey.model.traverse(o=>o.visible=false);collector.clip='idle';action='Food collected';hunt=null;}
  }
  for(const wolf of actors.filter(a=>a.model.name==='wolf'&&a.life?.state==='alive')){const victim=actors.find(a=>!a.life&&!['fish','cannon'].includes(a.model.name)&&a.model.position.distanceTo(wolf.model.position)<5);if(victim){wolf.path=0;if(approach(wolf,victim.model.position,dt,.8)){wolf.clip='attack';victim.clip='attack';if(Math.floor(t)!==wolf.model.userData.lastBite){wolf.model.userData.lastBite=Math.floor(t);damageAnimal(wolf.life!,10);if(wolf.life!.state==='dead')wolf.clip='dead';}}}}
 }
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
   setOreRemaining(oreRemaining-resourceDt);
   const miner=actors.find(a=>a.model===worker)!;miner.clip=oreRemaining>0?'mine':'idle';
   const farmActor=actors.find(a=>a.model===farmer)!,phase=t%8,step=Math.floor(t/8)%12,next=(step+1)%12;
   const farmPoint=(i:number)=>new T.Vector3(layout.farm.x-3+(i%4)*2,0,layout.farm.z-4+Math.floor(i/4)*4);
   const from=farmPoint(step),to=farmPoint(next),moving=phase>4;farmer.position.copy(from.lerp(to,moving?(phase-4)/4:0));farmer.position.y=height(farmer.position.x,farmer.position.z);farmer.rotation.y=moving?Math.atan2(to.x-farmer.position.x,to.z-farmer.position.z):Math.PI/2;farmActor.clip=moving?'walk':'farm';
   demoUpdate(t,resourceDt);
   wind.value=t*environment.wind.value;setFoliageTime(t,environment.wind.value);sailTime.value=t*environment.wind.value;animated.forEach(m=>m.uniforms.time.value=t*environment.wind.value);
   for(const a of actors){animateAsset(a.model,t+a.phase,a.clip);if(a.model.name==='fish'){const cycle=Math.floor(t/5),rng=random(seed+cycle*131),activeCount=1+Math.floor(rng()*3),index=a.model.userData.fishIndex as number;const phase=(t%5)-index*0.24;const jump=index<activeCount&&phase>=0&&phase<1.15;const f=phase/1.15;a.model.position.x=a.origin.x+(jump?f*1.4:0);a.model.position.y=jump?0.10+Math.sin(f*Math.PI)*0.90:-0.8;a.model.rotation.set(jump?Math.cos(f*Math.PI)*0.6:0,Math.PI/2,0);}else if(a.path){a.model.position.z=a.origin.z+Math.sin(t*.35+a.phase)*a.path;a.model.position.y=height(a.model.position.x,a.model.position.z);}}
   actorRoot.updateMatrixWorld(true);actorBatch.batches.forEach(b=>{b.objects.forEach((o,i)=>b.mesh.setMatrixAt(i,o.visible?o.matrixWorld:hiddenMatrix));b.mesh.instanceMatrix.needsUpdate=true;});
   ships.forEach((s,i)=>{s.position.y=.20+Math.sin(t*.85+i)*.035;s.rotation.z=Math.sin(t*.7+i)*.012;});
 }
 group.userData.layout={seed,buildings:layout.buildings,decorations};
 return {group,forest,mine,setOreRemaining,huntAnimal,resetResources,getDemoStatus:()=>`${action} · Food ${Math.floor(foodCollected)} · Wood ${Math.floor(woodCollected)}`,getOreRemaining:()=>oreRemaining,grass,animated,ships,pickables,models,environment,layout,height,actors,actorRoot,update,stats:{trees:treeCount,units:actors.filter(a=>['infantry','cavalry','villager','villagerFemale'].includes(a.model.name)).length,buildings:layout.buildings.length}};
}
