import * as T from 'three';
import {mat,mesh,beam,ball,box,cyl,tube,consolidate} from './geometry';
import {ConvexGeometry} from 'three/addons/geometries/ConvexGeometry.js';
function random(seed:number){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
const leafMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:.92,side:T.DoubleSide});
export const foliageTime={value:0},foliageWind={value:1};
const sway=`float h=max(position.y,0.);float phase=foliageTime*1.25;transformed.x += sin(phase+position.y*.45)*h*h*.005*foliageWind;transformed.z += cos(phase*.73+position.y*.6)*h*h*.0025*foliageWind;`;
function windShader(shader:{uniforms:Record<string,unknown>;vertexShader:string},flutter=false){shader.uniforms.foliageTime=foliageTime;shader.uniforms.foliageWind=foliageWind;shader.vertexShader='uniform float foliageTime;uniform float foliageWind;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n'+sway+(flutter?'transformed.x += sin(foliageTime*3.+position.x*4.+position.z*3.)*smoothstep(.2,3.,position.y)*.035*foliageWind;':''));}
leafMaterial.onBeforeCompile=shader=>windShader(shader,true);
leafMaterial.customProgramCacheKey=()=> 'meridian-leaf-wind-v2';
export const foliageDepth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,side:T.DoubleSide});
foliageDepth.onBeforeCompile=shader=>windShader(shader,true);
export function setFoliageTime(time:number,strength=1){foliageTime.value=time;foliageWind.value=strength;}
class Leaves{
  positions:number[]=[];colors:number[]=[];indices:number[]=[];
  add(center:T.Vector3,length:number,width:number,rotation:T.Euler,color:T.Color){
    const q=new T.Quaternion().setFromEuler(rotation);
    const outline=[new T.Vector3(0,0,0),new T.Vector3(-width*.5,length*.3,0),new T.Vector3(-width*.4,length*.7,0),new T.Vector3(0,length,0),new T.Vector3(width*.4,length*.7,0),new T.Vector3(width*.5,length*.3,0)];
    const mid=new T.Vector3(0,length*.48,width*.10);
    const base=this.positions.length/3;
    for(const point of [mid,...outline]){const p=point.clone().applyQuaternion(q).add(center);this.positions.push(p.x,p.y,p.z);const shade=point===mid?1.08:.93;this.colors.push(color.r*shade,color.g*shade,color.b*shade);}
    for(let i=0;i<6;i++)this.indices.push(base,base+1+i,base+1+(i+1)%6);
  }
  finish(parent:T.Group){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(this.positions,3));g.setAttribute('color',new T.Float32BufferAttribute(this.colors,3));g.setIndex(this.indices);g.computeVertexNormals();const m=mesh(g,leafMaterial,parent);m.customDepthMaterial=foliageDepth;}
}

export function buildTree(seed:number,pine=false,halfCut=false){
  const rand=random(seed),wood=new T.Group(),leaves=new Leaves(),h=pine?6.3+rand()*1.4:4.6+rand()*1.4;
  const bark=pine?'#615140':'#76654c';
  if(!halfCut)beam(wood,[0,0,0],[.10,h*.66,.03],pine?.15:.24,bark,.065);
  else{
    const radius=pine?.15:.24,positions:number[]=[],colors:number[]=[],barkColor=new T.Color(bark),cutColor=new T.Color('#c7a577');
    const ring=(y:number,i:number)=>{const a=i/16*Math.PI*2,r=T.MathUtils.lerp(radius,.065,y/(h*.66));return new T.Vector3(Math.cos(a)*r+y/h*.15,y,(y===.52&&Math.sin(a)>0?-.035:Math.sin(a)*r)+y/h*.045);};
    const levels=[0,.34,.52,.72,h*.66];
    for(let row=0;row<4;row++)for(let i=0;i<16;i++){const a=ring(levels[row],i),b=ring(levels[row],i+1),c=ring(levels[row+1],i),d=ring(levels[row+1],i+1),color=(row===1||row===2)&&Math.sin((i+.5)/16*Math.PI*2)>0?cutColor:barkColor;for(const p of [a,c,b,b,c,d]){positions.push(p.x,p.y,p.z);colors.push(color.r,color.g,color.b);}}
    const geometry=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(positions,3)).setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();mesh(geometry,new T.MeshStandardMaterial({vertexColors:true,roughness:1,side:T.DoubleSide}),wood);
  }
  for(let i=0;i<5;i++){const a=i/5*Math.PI*2;beam(wood,[Math.cos(a)*.5,.02,Math.sin(a)*.5],[0,.7,0],.07,bark,.10);}
  if(pine){
    beam(wood,[.10,h*.6,.03],[0,h,0],.06,bark,.012);
    for(let tier=0;tier<10;tier++){
      const y=1.6+tier*(h-1.8)/10,r=(1-tier/10)*1.45+.12;
      for(let arm=0;arm<5;arm++){
        const a=arm/5*Math.PI*2+tier*2.4,tip=new T.Vector3(Math.cos(a)*r,y+.22,Math.sin(a)*r);
        beam(wood,[.07,y,0],tip.toArray(),.024,bark,.008);
        for(let spray=0;spray<5;spray++){
          const f=.18+spray*.16,pos=tip.clone().multiplyScalar(f);pos.y=y+.18*f;
          for(let side=-1;side<=1;side+=2)for(let needle=0;needle<3;needle++){
            const theta=a+side*(.45+needle*.18),length=(1-f)*.48+.13;
            leaves.add(pos.clone().add(new T.Vector3(Math.cos(theta)*needle*.025,rand()*.12,Math.sin(theta)*needle*.025)),length,.06,new T.Euler(.5+rand()*.8,-theta,1.1),new T.Color().setHSL(.25+rand()*.045,.26,.20+rand()*.09));
          }
        }
      }
    }
  }else{
    // Irregular branch fans leave visible air between the crown and trunk.
    for(let branch=0;branch<12;branch++){
      const a=branch*2.39996,r=.9+rand()*.85,y=h*.45+rand()*h*.42;
      const tip=new T.Vector3(Math.cos(a)*r,y+.6,Math.sin(a)*r);
      beam(wood,[.05,h*.42,0],tip.toArray(),.065,bark,.020);
      for(let twig=0;twig<7;twig++){
        const theta=a+(rand()-.5)*1.7;
        const end=tip.clone().add(new T.Vector3(Math.cos(theta)*(.3+rand()*.65),rand()*.55,Math.sin(theta)*(.3+rand()*.65)));
        beam(wood,tip.toArray(),end.toArray(),.014,bark,.005);
        for(let leaf=0;leaf<19;leaf++){
          const pos=tip.clone().lerp(end,.2+rand()*.8).add(new T.Vector3((rand()-.5)*.66,(rand()-.5)*.42,(rand()-.5)*.66));
          leaves.add(pos,.19+rand()*.22,.11+rand()*.12,new T.Euler(rand()*2.6,rand()*6.28,rand()*6.28),new T.Color().setHSL(.20+rand()*.075,.30+rand()*.15,.25+rand()*.17));
        }
      }
    }
  }
  const out=consolidate(wood);out.traverse(o=>{if(o instanceof T.Mesh){const m=(o.material as T.MeshStandardMaterial).clone();m.onBeforeCompile=s=>windShader(s);m.customProgramCacheKey=()=> 'meridian-branch-wind-v1';o.material=m;o.customDepthMaterial=foliageDepth;}});leaves.finish(out);out.name=pine?'pine':'tree';return out;
}

export function buildBush(seed:number,berries=false){
  const rand=random(seed),wood=new T.Group(),leaves=new Leaves();
  for(let i=0;i<14;i++){
    const a=i*2.4,r=.25+rand()*.6,y=.35+rand()*.6,end=new T.Vector3(Math.cos(a)*r,y,Math.sin(a)*r);
    beam(wood,[0,0,0],end.toArray(),.016,'#796748',.006);
    for(let j=0;j<24;j++)leaves.add(end.clone().multiplyScalar(.4+rand()*.6).add(new T.Vector3((rand()-.5)*.4,rand()*.2,(rand()-.5)*.4)),.18+rand()*.16,.11+rand()*.08,new T.Euler(rand()*3,rand()*6.3,rand()*6.3),new T.Color().setHSL(.25+rand()*.06,.4,.22+rand()*.14));
    if(berries)for(let j=0;j<6;j++)ball(wood,end.x+(rand()-.5)*.17,end.y+rand()*.12,end.z+(rand()-.5)*.17,.044,.044,.044,j%2?'#a34237':'#ba5841',1);
  }
  const out=consolidate(wood);leaves.finish(out);out.name=berries?'berries':'bush';return out;
}

export function buildMine(stoneOnly=false){
  const result=new T.Group(),rand=random(stoneOnly?614:912);
  for(let i=0;i<12;i++){
    const a=i*2.39996,r=i<3?.34:.8+rand()*.55,x=Math.cos(a)*r,z=Math.sin(a)*r;
    const w=i<3?.70:.34+rand()*.31,h=i<3?1.1+rand()*.45:.35+rand()*.65,chunk=new T.Group();
    // Fractured slabs, with a narrow exposed mineral seam between two faces.
    for(const side of [-1,1]){
      const pts:T.Vector3[]=[];for(const y of [0,h])for(const xx of [-w*.44,w*.44])for(const zz of [-w*.65,w*.65])pts.push(new T.Vector3(xx+side*w*.48+(rand()-.5)*.14,y*(.84+rand()*.20),zz+(rand()-.5)*.17));
      mesh(new ConvexGeometry(pts),mat(side<0?'#707d7c':'#515f63',.94),chunk);
    }
    if(!stoneOnly)for(let j=0;j<8;j++){
      const y=.12+j/8*h,vein=mesh(new T.DodecahedronGeometry(.13+rand()*.05),mat(j%3?'#bc943a':'#e0bf66',.35,.68),chunk,(rand()-.5)*.07,y,(rand()-.5)*w*.60);
      vein.scale.set(.43,.9,1.5);vein.rotation.set(rand(),rand(),rand());
      if(j%3===0)ball(chunk,.05,y,w*.40,.055,.08,.07,'#e0d3b6',0);
    }
    const combined=consolidate(chunk);combined.position.set(x,0,z);combined.rotation.y=a;combined.name=`resourceChunk${i}`;combined.userData.resourceChunk=i;result.add(combined);
  }
  result.name=stoneOnly?'stoneMine':'mine';return result;
}

export function setResourceLevel(root:T.Object3D,percent:number){const count=Math.ceil(T.MathUtils.clamp(percent,0,100)/100*12);root.traverse(o=>{if(typeof o.userData.resourceChunk==='number'){const visible=o.userData.resourceChunk<count;o.traverse(child=>child.visible=visible);}});root.userData.remaining=percent;}

export function buildFelledTree(seed:number,pine=false){
 const root=new T.Group(),crown=buildTree(seed,pine,true);crown.name='fallenCrown';
 for(const child of [...crown.children])if(child instanceof T.Mesh){if(child.material===leafMaterial){crown.remove(child);child.geometry.dispose();continue;}child.material=new T.MeshStandardMaterial({color:'#79664b',roughness:1});child.customDepthMaterial=undefined;const g=child.geometry,idx=g.index!.array,pos=g.attributes.position,keep:number[]=[];for(let i=0;i<idx.length;i+=3)if((pos.getY(idx[i])+pos.getY(idx[i+1])+pos.getY(idx[i+2]))/3>.52)keep.push(idx[i],idx[i+1],idx[i+2]);g.setIndex(keep);}
 cyl(root,.22,.34,.48,0,.24,0,'#79664b',16);cyl(root,.22,.22,.02,0,.49,0,'#c6a779',16);root.add(crown);
 crown.rotation.z=Math.PI/2;crown.updateMatrixWorld(true);crown.userData.landY=-new T.Box3().setFromObject(crown).min.y+.025;crown.position.y=crown.userData.landY;root.name='treeHalfCut';return root;
}
