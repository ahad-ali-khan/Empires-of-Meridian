import * as T from 'three';
import {C,mat,mesh,box,cyl,beam,tube,joint,finishRig} from './geometry';
import {addShot} from './combat';
export const navalKinds=new Set(['ship','fishingBoat','tradeShip','transport','sloop','frigate','bombardVessel','fireCraft']);
export function buildNaval(kind:string,age:number){
 const root=new T.Group();root.name=kind;root.userData.naval=true;const dimensions:Record<string,number[]>={ship:[8,2.3],fishingBoat:[4,1.25],tradeShip:age===2?[8,2.4]:age===3?[9,3.3]:[11,3.5],transport:[7,3.0],sloop:[6.5,1.9],frigate:[12.5,3.1],bombardVessel:[8,3.6],fireCraft:[5,1.6]},[length,width]=dimensions[kind],half=width/2,depth=kind==='fishingBoat'?.45:.95;
 const hull=joint(root,'hull'),positions:number[]=[],indices:number[]=[],stations=[[-.5,.40],[-.4,.86],[-.2,1],[.15,.98],[.38,.68],[.5,kind==='transport'?.65:.015]];
 for(const [z,w] of stations)positions.push(-half*w,depth*.65,z*length,-half*w*.78,-.25,z*length,0,-.48,z*length,half*w*.78,-.25,z*length,half*w,depth*.65,z*length);
 for(let i=0;i<stations.length-1;i++)for(let j=0;j<4;j++){const a=i*5+j;indices.push(a,a+1,a+5,a+1,a+6,a+5);}indices.push(0,4,2,0,2,1,4,3,2,25,27,29,25,26,27,29,27,28);
 const geometry=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();const hm=mat('#594635');hm.side=T.DoubleSide;mesh(geometry,hm,hull);
 const shape=new T.Shape();stations.forEach(([z,w],i)=>i?shape.lineTo(half*w,-z*length):shape.moveTo(half*w,-z*length));[...stations].reverse().forEach(([z,w])=>shape.lineTo(-half*w,-z*length));const deck=new T.ShapeGeometry(shape);deck.rotateX(-Math.PI/2);mesh(deck,mat('#ac9061'),hull,0,.12,0);
 for(const s of [-1,1]){tube(hull,stations.map(([z,w])=>[s*half*w,depth*.65+.04,z*length]),.045,C.gold);tube(hull,stations.map(([z,w])=>[s*half*w*.97,depth*.37,z*length]),.060,C.cloth);}
 function mast(z:number,height:number,triangular=false){const p=joint(root,'mast',0,.14,z);beam(p,[0,0,0],[0,height,0],.045,C.wood);const sailMat=mat('#e9dbc0');sailMat.side=T.DoubleSide;
  if(triangular){const sail=new T.Shape();sail.moveTo(0,.6);sail.lineTo(0,height-.3);sail.quadraticCurveTo(width*.6,height*.4,width*.8,.6);sail.closePath();mesh(new T.ShapeGeometry(sail,12),sailMat,p,.03,0,0);beam(p,[0,.6,0],[width*.8,.6,0],.025,C.wood);}
  else for(let tier=0;tier<(height>5?2:1);tier++){const sy=height-.55-tier*height*.36,w=width*(tier?.66:.84);beam(p,[-w/2,sy,0],[w/2,sy,0],.025,C.wood);const geo=new T.PlaneGeometry(w,height*.29,10,8),a=geo.attributes.position;for(let i=0;i<a.count;i++)a.setZ(i,Math.sin((a.getX(i)/w+.5)*Math.PI)*.24);geo.computeVertexNormals();mesh(geo,sailMat,p,0,sy-height*.145,.02);}
  for(const s of [-1,1])beam(p,[0,height-.3,0],[s*half*.8,.2,-.8],.008,C.pants);
  box(p,.50,.25,.015,.26,height-.14,0,C.cloth);
 }
 function cannon(x:number,z:number,side=1){const p=joint(root,'deckGun',x,.68,z);p.rotation.y=side*Math.PI/2;box(p,.38,.23,.7,0,-.17,0,C.wood);const b=cyl(p,.10,.15,.9,0,.02,.20,'#4e5b58',16);b.rotation.x=Math.PI/2;cyl(p,.07,.07,.015,0,.02,.66,'#111d1d',16).rotation.x=Math.PI/2;}
 function bridge(z:number,w:number,h:number){box(root,w,h,1.6,0,.15+h/2,z,C.wood);box(root,w+.18,.12,1.8,0,h+.22,z,C.cloth);for(const x of [-w*.28,0,w*.28])box(root,w*.20,.32,.035,x,h-.10,z+.82,C.glass);}
 function cargo(x:number,z:number,color=C.wood,y=.14){box(root,.70,.65,1.1,x,y+.33,z,color);for(const s of [-1,1])box(root,.035,.68,1.12,x+s*.23,y+.33,z,C.gold);}
 if(kind==='fishingBoat'){
  for(const z of [-.8,.35])box(root,width*.7,.08,.22,0,.38,z,C.wood);if(age===1){for(const s of [-1,1]){beam(root,[s*.3,.3,0],[s*1.0,.12,-.7],.025,C.wood);box(root,.13,.04,.45,s*1.0,.12,-.8,C.wood);}}else mast(-.1,2.8,true);for(const x of [-.24,.24])cyl(root,.15,.12,.25,x,.28,.85,C.wood,12);
 }else if(kind==='tradeShip'){
  if(age===2){bridge(-length*.35,width*.65,.6);for(const side of [-1,1])for(let i=0;i<6;i++)beam(root,[side*half*.8,.24,-2+i*.65],[side*(half+1),.08,-2.6+i*.65],.03,C.wood);mast(.2,4.5);for(let i=0;i<4;i++)cargo(0,-1.5+i*.8);}
  else{bridge(-length*.34,width*.72,age===3?1.5:1.1);for(const x of [-width*.23,width*.23])for(let i=0;i<3;i++)cargo(x,-length*.12+i*1.3);mast(-1.1,6);if(age===4){mast(2,5.1);mast(-3,4.6,true);}else{box(root,width*.55,.9,1.2,0,.56,length*.32,C.wood);box(root,width*.6,.12,1.3,0,1.06,length*.32,C.cloth);}}
 }else if(kind==='transport'){
  if(age===2){for(const x of [-.9,.9])box(root,.30,.22,4.2,x,.37,0,C.wood);mast(-.8,3.5);for(const side of [-1,1])for(let i=0;i<7;i++)beam(root,[side*.9,.25,-2+i*.6],[side*2.2,.1,-2.7+i*.6],.025,C.wood);}
  else{bridge(-2.35,2.15,age===3?1.3:.85);for(const x of [-.9,.9])box(root,.30,.22,3.2,x,.37,.3,C.wood);mast(-1.3,4.6);if(age===4){mast(1.4,4.1,true);for(const x of [-1.2,1.2])for(let z=-1;z<2;z+=.5)beam(root,[x,.5,z],[x,1.1,z],.025,C.wood);}}
  const ramp=joint(root,'landingRamp',0,.17,3.45);box(ramp,1.7,.10,1.45,0,0,.55,C.wood);ramp.rotation.x=-.25;
 }else if(kind==='fireCraft'){
  for(let i=0;i<6;i++)cyl(root,.23,.23,.65,(i%2-.5)*.55,.46,-1+Math.floor(i/2)*.65,C.wood,12);mast(-1.2,3.1,true);beam(root,[0,.2,1.8],[0,.3,3.1],.12,C.dark,.025);addShot(root,'grenade',3,1.3,[0,.6,1.3]);
 }else if(kind==='bombardVessel'){
  bridge(-2.35,2,.95);const turret=joint(root,'mortarTurret',0,.5,.65);cyl(turret,.7,.85,.55,0,.12,0,C.wood,16);const barrel=cyl(turret,.23,.31,1.8,0,1,.3,C.dark,20);barrel.rotation.x=.65;mast(-1.4,4.0,true);addShot(root,'shell',4,1.1,[0,1.8,1.4]);

 }else{
  bridge(-length*.34,width*.75,kind==='frigate'?1.35:.65);const count=kind==='frigate'?3:kind==='sloop'?1:2;for(let i=0;i<count;i++)mast(count===1?0:-length*.22+i*length*.24,kind==='frigate'?7-Math.abs(i-1):kind==='sloop'?4.7:5.8,i===0&&kind==='sloop');for(const s of [-1,1])for(let i=0;i<(kind==='frigate'?6:2);i++)cannon(s*half*.87,-length*.18+i*(kind==='frigate'?.82:1.1),s);addShot(root,'shell',3,.7,[half,.70,0],[1,0,0]);
 }
 return finishRig(root);
}
