import * as T from 'three';
import {mat,mesh,beam,ball,box,cyl,tube,consolidate} from './geometry';
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

export function buildTree(seed:number,pine=false){
  const rand=random(seed),wood=new T.Group(),leaves=new Leaves(),h=pine?6.3+rand()*1.4:4.6+rand()*1.4;
  const bark=pine?'#615140':'#76654c';
  beam(wood,[0,0,0],[.10,h*.66,.03],pine?.15:.24,bark,.065);
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

export function buildMine(){
  const rocks=new T.Group(),ore=new T.Group(),rand=random(912);
  const locations=[[-0.85,0.10,-0.15,0.9],[0.1,0.25,-0.4,1.0],[0.9,0.0,0.1,0.65],[-0.1,0.0,0.65,0.72],[-1.1,-0.15,0.8,0.45]];
  for(const [x,y,z,radius] of locations){
    const g=new T.IcosahedronGeometry(radius,1);g.scale(1,0.70+rand()*0.40,0.70+rand()*0.5);g.rotateY(rand()*4);g.translate(x,y+radius*0.40,z);
    mesh(g,mat(rand()>0.5?'#707a75':'#586761',0.94),rocks);
    const a=g.attributes.position,indices=g.index;const count=indices?indices.count:a.count;
    for(let i=0;i<count;i+=3){
      const ids=[0,1,2].map(j=>indices?indices.getX(i+j):i+j);
      const pts=ids.map(id=>new T.Vector3().fromBufferAttribute(a,id));
      const n=pts[1].clone().sub(pts[0]).cross(pts[2].clone().sub(pts[0])).normalize();
      if(n.y<-0.1||rand()>0.32)continue;
      const center=pts[0].clone().add(pts[1]).add(pts[2]).multiplyScalar(1/3);
      const pg=new T.BufferGeometry(),v:number[]=[];
      pts.forEach(p=>{const q=center.clone().lerp(p,0.42+rand()*0.40).addScaledVector(n,0.009);v.push(q.x,q.y,q.z);});
      pg.setAttribute('position',new T.Float32BufferAttribute(v,3));pg.computeVertexNormals();
      mesh(pg,mat(rand()>0.5?'#b9984a':'#d1b365',0.53,0.38),ore);
    }
  }
  const result=new T.Group(),stone=consolidate(rocks),gold=consolidate(ore);stone.name='stone';gold.name='ore';result.add(stone,gold);result.name='mine';return result;
}
