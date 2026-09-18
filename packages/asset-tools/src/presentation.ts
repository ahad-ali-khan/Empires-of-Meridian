import * as T from 'three';
import {box,beam,ball,C,consolidate,mesh} from './geometry';
import type {Condition} from './extended';
import {setResourceLevel,buildFelledTree} from './nature';
export const effectsTime={value:0};
const fireMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{time:effectsTime},vertexShader:`uniform float time;varying vec2 vUv;void main(){vUv=uv;vec3 p=position;p.x+=sin(time*7.+p.y*8.)*.08*p.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:`uniform float time;varying vec2 vUv;void main(){float flicker=.8+.2*sin(time*11.+vUv.y*17.);gl_FragColor=vec4(mix(vec3(1.,.17,.015),vec3(1.,.85,.18),1.-vUv.y),(.75-.6*vUv.y)*flicker);}`});
function debris(root:T.Group,size:T.Vector3,amount=18){const pieces=new T.Group();for(let i=0;i<amount;i++){const a=i*2.399,r=.35+Math.sqrt((i+.5)/amount);const rock=ball(pieces,Math.cos(a)*size.x*.34*r,.1+(i%3)*.06,Math.sin(a)*size.z*.34*r,.2+size.x*.018,.12+size.y*.01,.22,C.stone,0);rock.rotation.set(i*.7,i,0);}root.add(consolidate(pieces));}
function cloneMaterials(object:T.Mesh,change:(material:T.Material)=>void){const copy=(m:T.Material)=>{const clone=m.clone();clone.userData.previewOwned=true;change(clone);return clone;};object.material=Array.isArray(object.material)?object.material.map(copy):copy(object.material);}
export function applyCondition(root:T.Group,kind:string,state:Condition){
 if(state==='full'||state==='half'||state==='depleted'){setResourceLevel(root,state==='full'?100:state==='half'?50:0);return;}
 if(state==='cleared'){root.visible=false;return;}
 const bounds=new T.Box3().setFromObject(root),size=bounds.getSize(new T.Vector3());
 if(state==='sinking'){root.rotation.z=.24;root.position.y=-size.y*.36;return;}
 if(state==='halfCut'){root.children.forEach(o=>o.visible=false);root.add(buildFelledTree(127,kind==='pine'));return;}
 if(state==='stump'){root.children.forEach(o=>o.visible=false);const stump=new T.Mesh(new T.CylinderGeometry(.24,.34,.48,16),new T.MeshStandardMaterial({color:'#a6895d'}));stump.position.y=.24;root.add(stump);return;}
 if(state==='rubble'){root.children.forEach(o=>o.visible=false);debris(root,size,40);return;}
 if(state==='construction'){
  root.traverse(o=>{if(o.name==='roof'||o.name==='factionFlag')o.visible=false;if(o instanceof T.Mesh)cloneMaterials(o,m=>{m.clippingPlanes=[new T.Plane(new T.Vector3(0,-1,0),Math.min(size.y*.47,2.2))];m.clipShadows=true;});});
  const scaffold=new T.Group(),h=Math.min(size.y,5);for(const x of [-1,1])for(const z of [-1,1])beam(scaffold,[x*size.x*.52,0,z*size.z*.52],[x*size.x*.52,h,z*size.z*.52],.06,C.wood);
  for(let y=.7;y<h;y+=.95)for(const z of [-1,1]){box(scaffold,size.x*1.12,.08,.43,0,y,z*size.z*.52,C.wood);beam(scaffold,[-size.x*.52,y-.65,z*size.z*.52],[size.x*.52,y+.2,z*size.z*.52],.035,C.wood);}
  for(let i=0;i<6;i++)box(scaffold,.75,.12,.25,size.x*.25+i*.12,.08+(i%3)*.12,size.z*.48,C.stone);root.add(consolidate(scaffold));return;
 }
 if(state==='damaged'||state==='critical'){
  root.updateMatrixWorld(true);
  // Deform closed solids instead of deleting individual triangles: shared
  // vertex positions receive the same displacement, so their seams stay closed.
  const critical=state==='critical';
  root.traverse(o=>{if(o instanceof T.Mesh){
   cloneMaterials(o,m=>{if(m instanceof T.MeshStandardMaterial)m.color.multiplyScalar(critical?.68:.86);});
   const geometry=o.geometry.clone(),position=geometry.attributes.position,inverse=o.matrixWorld.clone().invert();
   for(let i=0;i<position.count;i++){const v=new T.Vector3().fromBufferAttribute(position,i).applyMatrix4(o.matrixWorld);
    const height=T.MathUtils.smoothstep(v.y,bounds.min.y+size.y*.22,bounds.max.y);
    const side=T.MathUtils.smoothstep(v.x,bounds.min.x,bounds.max.x);
    const front=T.MathUtils.smoothstep(v.z,bounds.min.z,bounds.max.z);
    const collapse=height*side*front*(critical?.64:.22);
    v.y-=size.y*collapse;v.x+=collapse*size.x*.08;v.applyMatrix4(inverse);position.setXYZ(i,v.x,v.y,v.z);
   }
   geometry.computeVertexNormals();geometry.computeBoundingSphere();o.geometry=geometry;
  }});
  const roofs:T.Object3D[]=[];root.traverse(o=>{if(o.name==='roof')roofs.push(o);});
  if(critical&&roofs.length>1){const roof=roofs[roofs.length-1];roof.visible=false;const wreck=new T.Group();wreck.name='collapsedRoof';box(wreck,Math.min(size.x*.45,3),.18,Math.min(size.z*.3,2),size.x*.25,.20,size.z*.28,C.roof);for(let i=0;i<4;i++)beam(wreck,[size.x*.1+i*.2,.15,size.z*.15],[size.x*.3+i*.2,.45,size.z*.4],.07,C.wood);root.add(consolidate(wreck));}
  debris(root,size,state==='critical'?28:12);
  const flames=new T.Group();flames.name='damageFire';for(let i=0;i<(state==='critical'?7:3);i++){const x=size.x*(.12+(i%3)*.11),z=size.z*(.12+Math.floor(i/3)*.08);for(let layer=0;layer<2;layer++){const flame=mesh(new T.ConeGeometry(.20+layer*.08,.85+layer*.25,7,3,true),fireMaterial,flames,x,.45+layer*.13,z);flame.rotation.y=i;}}
  root.add(flames);
 }
}
