import * as T from 'three';
import {joint,beam,mesh,mat,box,C,tube} from './geometry';
export type Shot='arrow'|'bolt'|'bullet'|'shell'|'grenade'|'rocket';
const launches=new WeakMap<T.Object3D,{cycle:number;origin:T.Vector3;direction:T.Vector3;target?:T.Vector3;duration:number}>();
export function addShot(root:T.Group,type:Shot,period:number,release:number,origin=[0,1.3,.35],direction=[0,0,1]){
 root.userData.shot={type,period,release,origin,direction};const p=joint(root,'projectile');
 if(type==='arrow'||type==='bolt'){beam(p,[0,0,-.30],[0,0,.18],.009,C.wood);const tip=mesh(new T.ConeGeometry(.025,.10,4),mat('#bec6bc',.4,.6),p,0,0,.23);tip.rotation.x=Math.PI/2;for(const a of [0,Math.PI/2]){const feather=box(p,.075,.008,.1,0,0,-.24,C.light);feather.rotation.z=a;}}
 else{mesh(new T.SphereGeometry(type==='grenade'?.065:type==='shell'?.10:type==='rocket'?.055:.024,10,8),mat(type==='bullet'?'#e2cb84':'#303c3a',.45,.4),p);if(type==='rocket')beam(p,[0,0,-.32],[0,0,.18],.035,C.dark);}
 p.traverse(o=>o.visible=false);
 const flash=joint(root,'shotFlash');mesh(new T.SphereGeometry(.10,8,6),new T.MeshBasicMaterial({color:'#ffd894',transparent:true,opacity:.85,toneMapped:false}),flash);flash.traverse(o=>o.visible=false);
}
export function animateShot(root:T.Object3D,t:number,active:boolean){
 const data=root.userData.shot;if(!data)return;const projectile=root.getObjectByName('projectile')!,flash=root.getObjectByName('shotFlash')!,phase=t%data.period,flight=phase-data.release;
 if(!active){launches.delete(root);return;}
 root.updateMatrixWorld(true);let origin=new T.Vector3(...data.origin),direction=new T.Vector3(...data.direction);
 const muzzle=root.getObjectByName('shotOrigin');if(muzzle){origin=root.worldToLocal(muzzle.getWorldPosition(new T.Vector3()));direction.set(0,0,1).applyQuaternion(muzzle.getWorldQuaternion(new T.Quaternion())).applyQuaternion(root.getWorldQuaternion(new T.Quaternion()).invert());}
 const cycle=Math.floor(t/data.period);let launch=launches.get(root);
 const speed=data.type==='grenade'?4:data.type==='shell'?9:12;
 if(flight<0||!launch||launch.cycle!==cycle){const worldTarget=root.userData.shotTarget as T.Vector3|undefined;const target=worldTarget?root.worldToLocal(worldTarget.clone()):undefined;const aim=target?target.clone().sub(origin).normalize():direction.clone();const duration=target?T.MathUtils.clamp(origin.distanceTo(target)/speed,.14,.9):.9;launch={cycle,origin:origin.clone(),direction:aim,target,duration};launches.set(root,launch);}
 origin=launch.origin;direction=launch.direction;
 const firing=flight>=0&&flight<launch.duration;projectile.traverse(o=>o.visible=firing);flash.traverse(o=>o.visible=flight>=0&&flight<.075&&['bullet','shell','rocket'].includes(data.type));
 const progress=T.MathUtils.clamp(flight/launch.duration,0,1);if(launch.target){projectile.position.copy(origin).lerp(launch.target,progress);const arc=(data.type==='grenade'||data.type==='shell'||data.type==='rocket'?1.1:.24)*4*progress*(1-progress);projectile.position.y+=arc;}else{projectile.position.copy(origin).addScaledVector(direction,Math.max(0,flight)*speed);if(data.type==='grenade'||data.type==='shell'||data.type==='rocket')projectile.position.y+=Math.max(0,flight)*(data.type==='grenade'?3.2:1.3)-4.9*Math.max(0,flight)**2;}
 projectile.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),direction);if(data.type==='grenade')projectile.rotation.x=flight*9;flash.position.copy(origin);
}
export function buildBow(parent:T.Group,crossbow=false){
 const p=joint(parent,'heldWeapon');
 if(crossbow){box(p,.09,.10,.65,0,0,0,C.wood);box(p,.13,.14,.18,0,-.07,-.2,C.wood);tube(p,[[-.4,.035,.1],[-.23,.035,.23],[0,.035,.28],[.23,.035,.23],[.4,.035,.1]],.023,'#596760');beam(p,[-.4,.035,.1],[0,.035,-.10],.005,'#c5baa0');beam(p,[0,.035,-.10],[.4,.035,.1],.005,'#c5baa0');joint(p,'bowGrip',0,-.025,-.17);joint(p,'supportGrip',0,-.03,.10);joint(p,'shotOrigin',0,.065,.36);}
 else{tube(p,[[0,-.48,.08],[0,-.3,.2],[0,0,0],[0,.3,.2],[0,.48,.08]],.022,'#82603f');for(const name of ['stringLower','stringUpper']){const segment=joint(p,name);mesh(new T.CylinderGeometry(.004,.004,1,5),mat('#d4c4a1'),segment);}joint(p,'drawGrip',0,0,-.16);joint(p,'bowGrip');joint(p,'shotOrigin',0,0,.2);}
 const arrow=joint(p,'nockedArrow');beam(arrow,[0,.035,-.25],[0,.035,.43],.008,C.wood);const tip=mesh(new T.ConeGeometry(.022,.08,4),mat('#b5bfb6'),arrow,0,.035,.47);tip.rotation.x=Math.PI/2;
 return p;
}
