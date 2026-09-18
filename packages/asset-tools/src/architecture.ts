import * as T from 'three';
import {C,box,cyl,beam,mesh,mat,joint,finishRig,ball} from './geometry';

const production=new Set(['barracks','archery','stable','workshop','factory','mercenaryHall']);
export function architecture(kind:string,age:number){
 const root=new T.Group();root.name=kind;root.userData.age=age;root.userData.building=true;
 const proportions:Record<string,[number,number,number]>={house:[.82,.88,.82],hall:[1.10,1.18,1.10],tower:[.82,1.38,.82],fort:[1.50,age===3?1.55:1.10,1.50],silo:[.86,1.05,.86],market:[1.05,.85,1.05],barracks:[1.05,.9,1.05]};
 if(proportions[kind])root.scale.set(...proportions[kind]);
 const wall=age===1?'#9a8058':age===2?'#c5ac82':age===3?'#cec0a0':age===4?'#a6795b':'#b7c3bd',roofColor=age===1?'#ae975d':age===2?'#9c6449':C.roof;
 const part=(name:string)=>joint(root,name);
 function roof(parent:T.Group,w:number,d:number,y:number){const r=joint(parent,'roof',0,y,0);
  if(age===2){box(r,w+.12,.16,d+.12,0,.08,0,'#c4a17d');for(const s of [-1,1]){box(r,w,.24,.12,0,.23,s*d/2,C.trim);box(r,.12,.24,d,s*w/2,.23,0,C.trim);}box(r,w*.6,.045,d*.5,0,.19,0,C.cloth);return;}
  if(kind==='factory'||kind==='workshop'){for(let i=0;i<3;i++){const strip=box(r,w/3+.03,.12,d,(-1+i)*w/3,.18,0,C.roof);strip.rotation.z=.18;box(r,.06,.42,d,(-1+i)*w/3+w/6,.14,0,'#75968e');}return;}
  if(kind==='academy'||kind==='embassy'){box(r,w+.2,.17,d+.2,0,.08,0,C.roof);for(const s of [-1,1])box(r,w,.24,.12,0,.26,s*d/2,C.trim);return;}
  if(kind==='temple'||kind==='landmark'||kind==='fort') {box(r,w+.15,.18,d+.15,0,.09,0,C.trim);return;}
  const h=age===1?1.3:age===2?.65:1.05;
  const vertices=[-w/2,0,-d/2,w/2,0,-d/2,0,h,-d/2,-w/2,0,d/2,w/2,0,d/2,0,h,d/2];
  const geometry=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setIndex([0,2,1,3,4,5,0,3,5,0,5,2,1,2,5,1,5,4]);geometry.computeVertexNormals();mesh(geometry,mat(roofColor),r);
  for(let i=0;i<7;i++){const f=i/7;beam(r,[-w*.5*(1-f),h*f,-d*.51],[-w*.5*(1-f),h*f,d*.51],.024,age===1?'#8c784d':C.roof2);beam(r,[w*.5*(1-f),h*f,-d*.51],[w*.5*(1-f),h*f,d*.51],.024,age===1?'#8c784d':C.roof2);}
 }
 function room(w:number,d:number,h:number,x:number,z:number,name='buildingWing'){
  if(age===2){h*=.82;w*=.9;}else if(age===4&&['barracks','hall','house','mercenaryHall'].includes(kind))h*=1.15;
  const p=joint(root,name,x,0,z);box(p,w+.2,.16,d+.2,0,.08,0,age===1?'#806a4c':C.trim);
  // Separate wall sections leave real door and window openings.
  box(p,w,h,.18,0,h/2,-d/2,wall);for(const s of [-1,1])box(p,.18,h,d,s*w/2,h/2,0,wall);
  const doorW=Math.min(1.1,w*.30),sideW=(w-doorW)/2;for(const s of [-1,1])box(p,sideW,h,.18,s*(doorW/2+sideW/2),h/2,d/2,wall);
  box(p,doorW,h-1.5,.18,0,1.5+(h-1.5)/2,d/2,wall);box(p,doorW*.9,1.45,.06,0,.75,d/2+.015,C.wood);
  for(const s of [-1,1]){const wx=s*w*.31;box(p,.55,.75,.05,wx,h*.58,d/2+.10,age===5?'#487484':C.glass);box(p,.035,.8,.07,wx,h*.58,d/2+.14,C.trim);box(p,.6,.04,.07,wx,h*.58,d/2+.14,C.trim);}
  if(age===3)for(const s of [-1,1]){box(p,.13,h,.12,s*(w/2-.08),h/2,d/2+.1,C.wood);beam(p,[s*.6,.15,d/2+.12],[s*(w/2-.12),h-.12,d/2+.12],.065,C.wood);}
  if(age===4){for(let y=.32;y<h;y+=.32)box(p,w,.018,.025,0,y,d/2+.1,'#d1ad86');if(h>3.0)for(const xx of [-w*.3,0,w*.3]){box(p,.43,.65,.05,xx,h-.65,d/2+.11,C.glass);box(p,.035,.7,.05,xx,h-.65,d/2+.15,C.trim);}}
  box(p,w*.75,.13,.055,0,h-.12,d/2+.14,C.cloth);
  // Readable windows and ownership trim on every approach, including the back.
  box(p,w*.75,.13,.055,0,h-.12,-d/2-.12,C.cloth);
  for(const side of [-1,1]){box(p,.055,.13,d*.75,side*(w/2+.12),h-.12,0,C.cloth);for(const z of [-d*.25,d*.25])for(const y of (h>3?[1.3,h-.65]:[h*.58])){box(p,.04,.65,.46,side*(w/2+.11),y,z,C.glass);box(p,.07,.7,.035,side*(w/2+.14),y,z,C.trim);box(p,.07,.035,.5,side*(w/2+.14),y,z,C.trim);}for(const y of (h>3?[1.3,h-.65]:[h*.58])){box(p,.46,.65,.04,side*w*.27,y,-d/2-.11,C.glass);box(p,.035,.7,.07,side*w*.27,y,-d/2-.14,C.trim);}}
  if(age===5){box(p,w*.8,.25,.035,0,h-.35,d/2+.12,C.cloth);for(const s of [-1,1])box(p,.12,h,.12,s*w*.5,h/2,d/2+.1,'#606f6d');}
  roof(p,w+.5,d+.45,h+.05);return p;
 }
 function fence(x1:number,z1:number,x2:number,z2:number,h=1){const p=part('yardFence'),length=Math.hypot(x2-x1,z2-z1),steps=Math.ceil(length/.75);for(let i=0;i<=steps;i++){const f=i/steps;box(p,.09,h,.09,T.MathUtils.lerp(x1,x2,f),h/2,T.MathUtils.lerp(z1,z2,f),C.wood);}for(const y of [h*.4,h*.8])beam(p,[x1,y,z1],[x2,y,z2],.034,C.wood);}
 function yard(w:number,d:number){const p=part('courtyard');box(p,w,.07,d,0,.035,1,age===5?'#85928b':'#ac9a78');fence(-w/2,-d/2+1,-w/2,d/2+1);fence(w/2,-d/2+1,w/2,d/2+1);fence(-w/2,d/2+1,-1,d/2+1);fence(1,d/2+1,w/2,d/2+1);}
 function flag(x:number,z:number,h:number){if(kind!=='hall'&&kind!=='fort'){const p=joint(root,'factionMarker',x,0,z);box(p,.20,.60,.20,0,.30,0,C.wood);box(p,.22,.24,.22,0,.45,0,C.cloth);return;}const p=joint(root,'factionFlag',x,0,z);beam(p,[0,0,0],[0,h,0],.035,C.gold);box(p,.64,.42,.018,.33,h-.27,0,C.cloth);box(p,.65,.027,.02,.33,h-.27,0,C.gold);root.userData.flagClearance={x,z,height:h};}
 function crate(x:number,z:number){const p=part('cargo');box(p,.6,.5,.6,x,.25,z,C.wood);for(const s of [-1,1])box(p,.035,.52,.62,x+s*.19,.25,z,C.gold);}
 function tower(x:number,z:number,r:number,h:number){const p=joint(root,'defenseTower',x,0,z);cyl(p,r,r+.12,h,0,h/2,0,wall,12);cyl(p,r+.18,r+.18,.25,0,h,0,C.trim,12);for(let i=0;i<10;i++){const a=i/10*Math.PI*2;box(p,.30,.45,.30,Math.sin(a)*r,h+.3,Math.cos(a)*r,C.trim);}for(const y of [h*.42,h*.74])box(p,.13,.52,.04,0,y,r+.015,C.dark);}
 if(age===1&&kind==='lumberPost'){const shed=part('leanTo');for(const x of [-1.4,1.4])beam(shed,[x,0,0],[x,1.8,0],.07,C.wood);const cover=box(shed,3.3,.08,1.8,0,1.3,-.55,'#b49c70');cover.rotation.x=-.52;for(let layer=0;layer<3;layer++)for(let i=0;i<4-layer;i++){const log=cyl(root,.16,.16,2.3,-.65+i*.38+layer*.19,.17+layer*.29,.7,C.wood,10);log.rotation.x=Math.PI/2;}box(root,1.4,.18,.08,0,1.70,.05,C.cloth);return finishRig(root);}
 if(age===1&&kind==='fishery'){const p=part('reedPlatform');for(let i=0;i<14;i++)beam(p,[-1,.12,-1.3+i*.2],[1,.12,-1.3+i*.2],.06,C.wood);for(const x of [-.8,.8])beam(p,[x,0,-1],[x,1.3,-1],.05,C.wood);box(p,1.6,.4,.025,0,1.0,-1,C.cloth);for(const x of [-.5,0,.5])cyl(p,.18,.14,.35,x,.32,0,C.wood,10);return finishRig(root);}
 if(age===1&&kind==='barracks'){yard(6.5,5.8);const shelter=joint(root,'trainingShelter',-1.8,0,-.9);for(const x of [-.8,.8])for(const z of [-1.5,1.5])beam(shelter,[x,0,z],[x,1.7,z],.08,C.wood);const cover=box(shelter,2.2,.10,3.5,0,1.9,0,'#ad9361');cover.rotation.z=.22;box(shelter,1.7,.22,.05,0,1.6,1.53,C.cloth);for(const z of [-1.6,0,1.6]){beam(root,[1,0,z],[1,1.55,z],.06,C.wood);beam(root,[.6,1.1,z],[1.4,1.1,z],.04,C.wood);ball(root,1,1.4,z,.20,.24,.16,'#b99d67',1);}for(let i=0;i<5;i++)beam(root,[-2.4+i*.25,.1,2],[-2.4+i*.25,1.1,2],.04,C.wood);return finishRig(root);}
 if(age===1){
  const count=kind==='hall'?3:1;for(let i=0;i<count;i++){const x=count>1?(i-1)*2.5:0,p=joint(root,'hut',x,0,count>1?Math.abs(i-1)*1.3:0);cyl(p,1.1,1.28,1.6,0,.8,0,wall,14);cyl(p,0,1.6,1.7,0,2.1,0,roofColor,14);box(p,.56,.95,.035,0,.48,1.2,C.dark);cyl(p,1.17,1.19,.12,0,.95,0,C.cloth,14);for(let j=0;j<12;j++){const a=j*Math.PI/6;beam(p,[Math.sin(a)*1.5,1.25,Math.cos(a)*1.5],[0,2.95,0],.025,'#8b7149');}}
  if(kind==='lumberPost'){for(let i=0;i<6;i++){const log=cyl(root,.13,.15,2.3,-1+i*.35,.18,2,C.wood);log.rotation.z=Math.PI/2;}}
  if(kind==='fishery'){for(let i=0;i<10;i++)box(root,1.4,.08,.22,0,.15,1.6+i*.24,C.wood);}
  flag(count>1?4:1.9,1.5,2.6);return finishRig(root);
 }
 if(kind==='fort'&&age===4){
  const p=part('bastionRamparts'),stone='#9b9581';
  box(p,9,.18,9,0,.09,0,'#a99c7f');
  for(const x of [-3.8,3.8])for(const z of [-3.8,3.8]){
   cyl(p,1.95,2.35,2.3,x,1.15,z,stone,4);
   cyl(p,2.04,2.04,.18,x,2.36,z,C.trim,4);
   for(const y of [.35,.95,1.55,2.12])cyl(p,T.MathUtils.lerp(2.35,1.95,y/2.3)+.012,T.MathUtils.lerp(2.35,1.95,y/2.3)+.02,.045,x,y,z,'#777865',4);
   for(const side of [-1,1]){box(p,.20,.38,1.1,x+side*1.16,2.62,z,C.trim);box(p,1.1,.38,.20,x,2.62,z+side*1.16,C.trim);}
   const gun=joint(root,'bastionGun',x,2.57,z);gun.rotation.y=Math.atan2(x,z);
   box(gun,.55,.22,.75,0,0,0,C.wood);const barrel=cyl(gun,.12,.18,1.45,0,.27,.36,C.dark,16);barrel.rotation.x=Math.PI/2;
   cyl(gun,.095,.095,.025,0,.27,1.1,'#152020',16).rotation.x=Math.PI/2;
  }
  for(const x of [-4.2,4.2]){box(p,.9,1.9,6.3,x,.95,0,stone);box(p,.96,.18,6.3,x,1.98,0,C.trim);}
  box(p,6.3,1.9,.9,0,.95,-4.2,stone);box(p,6.3,.18,.96,0,1.98,-4.2,C.trim);
  for(const x of [-2.8,2.8]){box(p,2.5,1.9,.9,x,.95,4.2,stone);box(p,2.55,.18,.96,x,1.98,4.2,C.trim);}
  room(4.6,1.8,2.6,0,-2.7,'garrison');
  for(const x of [-1.15,1.15])box(p,.45,2.45,1.25,x,1.22,4.2,C.trim);
  box(p,2.75,.45,1.25,0,2.45,4.2,C.trim);box(p,1.4,.24,.04,0,2.43,4.85,C.cloth);
  for(let i=0;i<6;i++)box(p,1.1,.22*(i+1),.35,-2.6,.11*(i+1),2.5-i*.35,C.stone);
  flag(0,-.8,4.4);return finishRig(root);
 }
 if(kind==='fort'){
  const p=part('curtainWalls');box(p,9,.12,9,0,.06,0,'#a79e87');for(const x of [-4,4])box(p,.65,3.1,8,x,1.55,0,wall);box(p,8,3.1,.65,0,1.55,-4,wall);for(const x of [-2.8,2.8])box(p,2.5,3.1,.65,x,1.55,4,wall);
  for(const x of [-4,4])for(const z of [-4,4]){tower(x,z,1.0,4.9);const cone=part('towerRoof');cyl(cone,0,1.25,1.7,x,6.1,z,C.roof,12);}
  for(let i=0;i<11;i++){const x=-3.6+i*.72;box(p,.36,.45,.76,x,3.33,-4,C.trim);for(const s of [-1,1])box(p,.76,.45,.36,s*4,3.33,x,C.trim);}
  room(3.8,3.4,5.8,0,-1.6,'keep');for(const x of [-1.5,1.5])for(const z of [-2.9,-.3])tower(x,z,.42,6.3);for(let i=0;i<8;i++)box(p,.3,.4,.25,-1.6+i*.45,6.15,.15,C.trim);for(const x of [-1.4,1.4])tower(x,3.9,.65,4.0);box(p,1.7,.9,.9,0,3.1,4,wall);for(let i=0;i<9;i++)box(p,.055,2.7,.08,-.7+i*.175,1.35,4.05,C.dark);box(p,1.0,1.4,.025,0,4.4,.15,C.cloth);
  flag(0,1.0,5.0);return finishRig(root);
 }
 if(age===2&&(kind==='wall'||kind==='gate')){const p=part('palisade');for(let i=0;i<23;i++){const x=-2.75+i*.25;if(kind==='gate'&&Math.abs(x)<.8)continue;cyl(p,.09,.13,2.25,x,1.125,0,C.wood,8);cyl(p,0,.09,.30,x,2.40,0,C.wood,8);}for(const y of [.65,1.65]){if(kind==='wall')beam(p,[-2.8,y,.13],[2.8,y,.13],.08,C.wood);else for(const s of [-1,1])beam(p,[s*.85,y,.13],[s*2.8,y,.13],.08,C.wood);}box(p,.6,.55,.04,-1.7,1.8,.16,C.cloth);if(kind==='gate'){beam(p,[-.85,2.2,0],[.85,2.2,0],.12,C.wood);box(p,1.6,1.8,.1,0,.9,0,C.wood);}return finishRig(root);}
 if(age===4&&(kind==='wall'||kind==='gate')){
  const p=part('artilleryRampart');
  function segment(x:number,w:number){const h=2.15,d=.72,b=1.4,vertices=[-w/2,0,-b,w/2,0,-b,w/2,0,b,-w/2,0,b,-w/2,h,-d,w/2,h,-d,w/2,h,d,-w/2,h,d];const g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex([0,2,1,0,3,2,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5,4,5,6,4,6,7]);g.computeVertexNormals();mesh(g,mat('#959784'),p,x,0,0);box(p,w+.08,.16,1.55,x,2.22,0,C.trim);for(const dx of [-w*.3,0,w*.3]){box(p,.26,.26,.04,x+dx,1.55,.95,C.dark);box(p,.35,.08,.09,x+dx,1.36,1.02,C.trim);}box(p,w*.6,.18,.04,x,1.99,.79,C.cloth);}
  if(kind==='wall')segment(0,5.6);else{segment(-2.8,3.4);segment(2.8,3.4);for(const x of [-1.2,1.2]){box(p,.45,3.0,1.6,x,1.5,0,C.trim);box(p,.56,.18,1.75,x,3.1,0,C.trim);}box(p,2.8,.65,1.6,0,2.9,0,C.stone);for(let i=0;i<9;i++)box(p,.08,2.4,.12,-.86+i*.215,1.2,.12,C.dark);box(p,1.2,.27,.04,0,2.93,.83,C.cloth);}
  return finishRig(root);
 }
 if(production.has(kind)){
  yard(kind==='factory'?9:7.2,7.4);
  if(kind==='barracks'){if(age===2){room(2.2,4.2,2.2,-2,-.8,'leftDormitory');room(2.2,4.2,2.2,2,-.8,'rightDormitory');}else{room(6,2.2,age===4?3.2:2.7,0,-2,'barrackDormitory');room(1.7,3,2.2,-2.4,.7,'armoryWing');if(age===4){room(1.7,2,2.6,2.4,.2,'officerWing');box(root,1,.8,.85,0,4.4,-2,C.trim);cyl(root,.28,.28,.04,0,4.5,-1.55,C.dark,16).rotation.x=Math.PI/2;}}for(let i=0;i<4;i++){const x=.1+i*.7;beam(root,[x,0,1],[x,1.6,1],.05,C.wood);beam(root,[x-.3,1.2,1],[x+.3,1.2,1],.04,C.wood);box(root,.42,.62,.08,x,1.1,1.05,C.cloth);}}
  if(kind==='mercenaryHall'){const hall=part('roundGreatHall');cyl(hall,1.6,1.7,3.6,-1,1.8,-1.5,wall,8);cyl(hall,0,2,1.5,-1,4.35,-1.5,C.roof,8);room(2,3,2.3,1.8,-.7,'contractOffice');box(root,.75,1.7,.05,-1,.85,.15,C.wood);box(root,.85,.45,.08,-1,2.0,.22,C.cloth);for(let i=0;i<3;i++){const rack=joint(root,'weaponRack',-.8+i*.7,0,2);beam(rack,[0,0,0],[0,1.8,0],.03,C.wood);beam(rack,[-.3,1.1,0],[.3,1.1,0],.04,C.wood);}if(age===4)room(2.1,1.7,3.5,1.9,-2.9,'paymasterTower');}
  if(kind==='stable'){if(age===2){for(const x of [-2.7,-1])for(const z of [-2.7,1.8])beam(root,[x,0,z],[x,2,z],.08,C.wood);const shelter=box(root,2.4,.13,5.2,-1.8,2.1,-.5,C.roof);shelter.rotation.z=.12;}else{room(2,6,2.4,-2.5,-.4,'stallBlock');room(4,2,2.9,.3,-2.4,'hayloft');if(age===4){room(1.7,4.1,2.3,2.6,-.8,'coachHouse');box(root,.4,1.0,.12,0,3.8,-1.3,C.cloth);}}for(let i=0;i<4;i++){box(root,.8,.7,.8,-1.6,.35,-2+i*1.3,'#b9a164');fence(-1.4,-2.4+i*1.3,.3,-2.4+i*1.3,.8);}cyl(root,.5,.55,.5,1.8,.25,1.8,C.wood,16);}
  if(kind==='archery'){if(age===2){for(const z of [-2,1])beam(root,[-2.7,0,z],[-2.7,2,z],.06,C.wood);box(root,1.7,.07,3.7,-2.5,2.0,-.5,C.cloth);}else{room(2,4.8,2.2,-2.5,-.5,'fletcherWorkshop');box(root,4.6,1.9,.22,.9,.95,-2.95,C.wood);}for(const x of [-.5,1,2.5]){beam(root,[x,0,-2.6],[x,1.6,-2.6],.06,C.wood);for(const [r,c,z] of [[.43,'#c6b88e',-2.55],[.28,C.cloth,-2.49],[.12,C.gold,-2.43]] as const){const disk=cyl(root,r,r,.06,x,1.3,z,c,24);disk.rotation.x=Math.PI/2;}box(root,.04,.015,4,x,.085,.1,C.trim);}}
  if(kind==='workshop'||kind==='factory'){room(kind==='factory'?7.4:5.5,3,3.3,0,-1.5,'machineHall');const chimney=part('chimney');for(const x of (kind==='factory'?[-3,3]:[2.2])){box(chimney,.65,6,.65,x,3,-2.2,'#8c624d');box(chimney,.84,.25,.84,x,6,-2.2,C.dark);}for(const x of [-1.4,1.4]){box(root,1.4,.65,.9,x,.35,1.2,C.wood);box(root,1,.25,.4,x,.82,1.2,C.dark);}if(kind==='factory')for(let i=0;i<3;i++)cyl(root,.6,.6,2,-3+i*1.4,1,2.5,'#687a79',20);}
  flag(2.8,3.8,3.6);return finishRig(root);
 }
 if(kind==='silo'){if(age===2){cyl(root,.9,1.5,2.2,0,1.1,0,'#b4976b',20);mesh(new T.SphereGeometry(.92,20,10,0,Math.PI*2,0,Math.PI/2),mat('#c5ad7e'),root,0,2.2,0);cyl(root,1.17,1.2,.15,0,1.15,0,C.cloth,20);}else if(age===3){for(const x of [-.9,.9])for(const z of [-.9,.9])cyl(root,.14,.20,.7,x,.35,z,C.stone,10);cyl(root,1.3,1.3,2.7,0,2.05,0,C.wood,8);cyl(root,0,1.6,1.15,0,3.98,0,C.roof,8);for(const y of [.85,1.8,3.2])cyl(root,1.31,1.31,.08,0,y,0,C.cloth,8);}else{for(const x of [-.85,.85]){cyl(root,.75,.75,4.1,x,2.05,0,'#9eaaa0',28);cyl(root,.35,.76,.55,x,4.35,0,C.roof,28);for(const y of [.4,1.5,2.6,3.8])cyl(root,.77,.77,.055,x,y,0,C.cloth,28);}for(let y=.3;y<4.2;y+=.28)beam(root,[-.18,y,.78],[.18,y,.78],.026,C.dark);}box(root,.45,.45,.06,0,.6,age===3?1.31:1.0,C.wood);}
 else if(kind==='lumberPost'){const p=part('timberYard');for(const x of [-1.5,1.5])for(const z of [-1,1])box(p,.14,2.2,.14,x,1.1,z,C.wood);if(age===2){const shelter=box(p,3.5,.08,2.6,0,2.2,0,C.cloth);shelter.rotation.x=.12;}else roof(p,3.5,2.6,2.2);for(let row=0;row<3;row++)for(let i=0;i<4-row;i++){const log=cyl(root,.16,.16,2.4,-.65+i*.38+row*.18,.18+row*.3,0,C.wood,12);log.rotation.x=Math.PI/2;}if(age===4){box(root,1.4,.75,.5,0,.4,1.7,C.wood);const saw=cyl(root,.42,.42,.04,0,.85,1.7,'#929b91',24);saw.rotation.z=Math.PI/2;}box(root,2.8,.18,.08,0,2.0,1.08,C.cloth);}
 else if(kind==='miningPost'){const p=part('oreSorting');for(let i=0;i<5;i++)crate(-1.4+i*.6,1.1);for(const x of [-1.4,1.4])beam(p,[x,0,-.5],[x,age===2?1.8:2.7,-.5],.10,C.wood);beam(p,[-1.5,age===2?1.8:2.7,-.5],[1.5,age===2?1.8:2.7,-.5],.13,C.wood);cyl(p,.3,.3,.12,0,age===2?1.6:2.45,-.5,C.dark,16).rotation.x=Math.PI/2;beam(p,[0,age===2?1.6:2.45,-.5],[0,.7,-.5],.013,C.dark);box(root,1.2,.75,.7,0,.4,-.5,C.stone);if(age===4){const wheel=cyl(root,.65,.65,.16,1.3,.7,-.5,C.dark,18);wheel.rotation.z=Math.PI/2;box(root,2.2,.3,.8,-.2,1.1,-.5,C.cloth);}else box(root,1.2,.15,.72,0,.82,-.5,C.cloth);}
 else if(kind==='dock'||kind==='fishery'){const p=part('pier');const length=kind==='dock'?8:4;for(let i=0;i<length*4;i++)box(p,kind==='dock'?4.2:2,.12,.23,0,.4,-length/2+i*.25,C.wood);for(const x of [-1.7,1.7])for(const z of [-3,0,3])cyl(p,.13,.17,1.8,x,-.05,z,C.wood,10);if(kind==='dock'){
   const office=room(age===4?3.3:2.8,2.4,age===4?3.3:2.3,-.25,-2.6,'harborWarehouse');office.position.y=.46;
   if(age===2){for(const x of [-1.6,1.6])beam(root,[x,.45,-1],[x,2.4,-1],.08,C.wood);box(root,3.5,.1,1.7,0,2.4,-.5,C.cloth);}else{const crane=part('cargoCrane');for(const x of [1.2,1.8])beam(crane,[x,.4,.2],[1.5,4.6,.2],.085,age===4?C.dark:C.wood);beam(crane,[1.5,4.6,.2],[1.5,4.6,3],.08,C.wood);beam(crane,[1.5,4.6,3],[1.5,1.0,3],.012,C.dark);cyl(crane,.35,.35,.16,1.5,1.1,.2,C.dark,16).rotation.z=Math.PI/2;}
   for(const x of [-1.0,0])crate(x,.3);box(root,3.2,.14,.07,-.25,1.1,-1.32,C.cloth);
  }else{for(let i=0;i<3;i++)cyl(root,.23,.19,.4,-.55+i*.5,.65,-1,C.wood,12);for(const x of [-.9,.9])beam(root,[x,.4,-1.7],[x,2.2,-1.7],.05,C.wood);box(root,1.8,.8,.025,0,1.6,-1.7,C.cloth);} }
 else if(kind==='wall'||kind==='gate'){const p=part('wall');for(const x of (kind==='gate'?[-2.6,2.6]:[0])){box(p,kind==='gate'?3.2:5,2.6,.65,x,1.3,0,wall);for(let i=0;i<7;i++)box(p,.35,.4,.72,x-(kind==='gate'?1.35:2.1)+i*(kind==='gate'?.45:.7),2.8,0,C.trim);}box(p,kind==='gate'?1.1:3,.16,.04,kind==='gate'?-2.6:0,1.8,.35,C.cloth);if(age===4){for(const x of (kind==='gate'?[-2.6,2.6]:[0])){box(p,kind==='gate'?3.2:5,.65,1.25,x,.325,0,'#8a8d78');for(const z of [-.45,.45])beam(p,[x-1.3,3.15,z],[x+1.3,3.15,z],.035,C.dark);}}if(kind==='gate'){for(const x of [-1.1,1.1])tower(x,0,.6,3.7);box(p,2,.7,.85,0,2.8,0,wall);for(let i=0;i<9;i++)box(p,.065,2.4,.1,-.85+i*.21,1.2,.1,C.dark);}}
 else if(kind==='farm'||kind==='estate'){box(root,6,.08,6,0,.04,0,'#766344');box(root,.18,.65,.18,3.15,.325,2.8,C.wood);box(root,.20,.18,.20,3.15,.56,2.8,C.cloth);if(age>=3){for(const x of [-3.1,3.1])fence(x,-3.1,x,3.1,.6);}if(age===4){const pump=part('irrigationPump');beam(pump,[3.1,0,-2.4],[3.1,1.1,-2.4],.09,C.dark);beam(pump,[3.1,1.1,-2.4],[3.1,1.1,-1.7],.035,C.dark);box(pump,.25,.15,5.5,3,.075,0,C.stone);}for(let row=0;row<8;row++)for(let i=0;i<12;i++){const x=-2.7+row*.75,z=-2.7+i*.48;beam(root,[x,.08,z],[x,.55,z],.013,'#c0a062');ball(root,x,.65,z,.05,.15,.04,'#d1bb6d',0);}if(kind==='estate')room(2.6,2,2.8,0,-4,'estateHouse');}
 else if(kind==='tower'){if(age===2){tower(0,0,1.1,3.6);box(root,1.2,.55,.04,0,2.9,1.12,C.cloth);}else if(age===3){tower(0,0,1.25,5.0);cyl(root,0,1.6,1.7,0,6.3,0,C.roof,12);box(root,.65,1.2,.04,0,3.5,1.26,C.cloth);}else{room(2.6,2.6,4.0,0,0,'blockhouse');for(const x of [-1.1,1.1])for(const z of [-1.1,1.1])box(root,.18,1.2,.18,x,4.5,z,C.wood);box(root,3.2,.15,3.2,0,5.2,0,C.roof);box(root,2.9,.45,2.9,0,4.15,0,C.trim);}}
 else if(kind==='hall'){room(age===2?4.4:5.2,3.6,3.8,0,-.6,'civicHall');if(age===2){for(const x of [-3.2,3.2]){for(const z of [-1.5,0,1.5])cyl(root,.12,.18,2.4,x,1.2,z,C.trim,12);box(root,1.7,.16,3.6,x,2.5,0,C.cloth);}}else{room(2,3,2.5,-3.2,-.4,'recordWing');if(age===4)room(2,3,2.5,3.2,-.4,'assemblyWing');else tower(3.2,-.4,.9,5.6);}if(age===4){cyl(root,.85,.85,1.2,0,5.5,-.6,C.trim,8);cyl(root,0,1.15,1.0,0,6.6,-.6,C.roof,8);}for(const x of [-1.4,-.7,.7,1.4])cyl(root,.11,.16,2.5,x,1.25,2.2,C.trim,12);box(root,3.5,.22,1.4,0,2.65,2.1,C.trim);flag(4.4,2.4,5.3);}
else if(kind==='house'){if(age===2){room(2.8,2.7,2.3,0,0,'courtyardResidence');box(root,2.4,.08,1.8,0,.04,2.1,'#bda17b');for(const x of [-1.2,1.2])box(root,.16,1.1,1.8,x,.55,2.1,wall);}else if(age===3){room(2.4,2.5,2.1,-.4,0,'timberResidence');room(1.5,1.8,1.8,1.2,.35,'pantry');box(root,.44,2.7,.44,-.9,2.2,-.6,C.stone);}else{room(3.0,2.8,3.5,0,0,'brickTownhouse');box(root,.5,2,.5,-.8,4.0,-.5,C.stone);box(root,1.5,.14,.8,0,1.9,1.8,C.trim);for(const x of [-.7,.7])beam(root,[x,1.9,2.1],[x,2.55,2.1],.025,C.dark);beam(root,[-.7,2.55,2.1],[.7,2.55,2.1],.025,C.dark);}}
else if(kind==='market'){if(age===2){box(root,5,.12,4,0,.06,0,C.trim);}else if(age===3){room(4.2,1.8,2.7,0,-1.8,'merchantHall');}else{room(5,1.8,3.8,0,-1.8,'exchange');cyl(root,.65,.7,1.4,0,4.7,-1.8,C.trim,8);cyl(root,0,.9,.9,0,5.85,-1.8,C.roof,8);}for(const x of [-2,0,2]){const stall=joint(root,'marketStall',x,0,1);for(const sx of [-.65,.65])beam(stall,[sx,0,0],[sx,1.9,0],.04,C.wood);for(let i=0;i<6;i++)box(stall,.25,.06,1.4,-.625+i*.25,1.85,0,i%2?C.light:C.cloth);box(stall,1.5,.75,.7,0,.4,0,C.wood);for(let i=0;i<4;i++)ball(stall,-.5+i*.3,.85,0,.10,.10,.12,i%2?'#ac6449':'#b6a15b',1);}}
 else if(kind==='tradePost'){const shed=part('caravanDepot');box(shed,4,.15,2.3,0,.075,0,C.wood);for(const x of [-1.8,1.8])for(const z of [-.9,.9])beam(shed,[x,.1,z],[x,2.2,z],.075,C.wood);if(age===2){const canopy=box(shed,4.4,.1,2.7,0,2.2,0,C.cloth);canopy.rotation.x=.12;}else roof(shed,4.4,2.7,2.2);for(let i=0;i<5;i++)crate(-1.4+i*.7,.5);box(shed,3.6,.22,.06,0,1.9,1,C.cloth);if(age===4){room(1.5,2.2,3.3,2.7,0,'weighingOffice');for(const x of [-.8,.8])cyl(root,.14,.14,1.3,x,.65,2.4,C.dark,12);beam(root,[-1.3,1.3,2.4],[1.3,1.3,2.4],.07,C.dark);}}
else if(kind==='landmark'){const p=part('monument');for(let i=0;i<4;i++)cyl(p,2.6-i*.4,2.8-i*.4,.3,0,.15+i*.3,0,C.trim,8);if(age===3){cyl(p,.55,.85,5.8,0,4.1,0,C.stone,8);cyl(p,1.2,1.0,.3,0,7.1,0,C.cloth,8);for(let i=0;i<8;i++){const a=i*Math.PI/4;beam(p,[Math.cos(a),7.2,Math.sin(a)],[Math.cos(a),8.2,Math.sin(a)],.07,C.trim);}cyl(p,0,1.5,1.2,0,8.8,0,C.roof,8);}else{for(const x of [-1.4,1.4])box(p,.9,5.8,1.4,x,3.6,0,C.stone);box(p,3.8,1.1,1.6,0,6.5,0,C.trim);ball(p,0,7.65,0,.75,.75,.75,C.gold,2);box(p,.6,2,.08,-1.4,4.2,.73,C.cloth);box(p,.6,2,.08,1.4,4.2,.73,C.cloth);}}
 else if(kind==='temple'){const p=part('sanctuary');for(let i=0;i<3;i++)box(p,5-i*.4,.2,4-i*.4,0,.1+i*.2,0,C.trim);if(age===2){room(3.3,2.8,3.3,0,0,'classicalSanctuary');for(const x of [-1.8,-.9,.9,1.8])cyl(p,.13,.19,2.7,x,1.95,1.8,C.trim,14);}else{room(3.3,4.8,4.1,0,0,'nave');if(age===3){room(1.6,1.7,6,-2.4,1.2,'bellTower');cyl(p,0,1.1,1.8,-2.4,6.9,1.2,C.roof,8);}else{room(5,1.6,3.1,0,-.8,'transept');mesh(new T.SphereGeometry(1.5,24,12,0,Math.PI*2,0,Math.PI/2),mat(C.roof),p,0,4.3,0);cyl(p,.25,.35,.8,0,6.1,0,C.gold,12);}}}
 else if(kind==='academy'){room(5,2,3.5,0,-1.5,'library');room(1.8,3.4,2.8,-2.5,.7,'lectureWing');if(age===4){room(1.8,3.4,3.8,2.5,.7,'laboratoryWing');cyl(root,.9,1,1.2,2.5,4.5,.7,C.trim,20);mesh(new T.SphereGeometry(.95,20,12,0,Math.PI*2,0,Math.PI/2),mat(C.roof),root,2.5,5.1,.7);beam(root,[2.5,5.2,.7],[2.9,5.6,1.2],.10,C.dark);}else{for(const x of [.7,1.5,2.3])beam(root,[x,0,1.5],[x,2.4,1.5],.09,C.trim);box(root,2.4,.15,3.1,1.5,2.5,.2,C.roof);}cyl(root,.7,.8,.5,0,.25,1.4,C.trim,20);}
 else if(kind==='embassy'){room(3.6,3.8,4.2,0,-.5,'diplomaticHall');for(const x of [-1.2,0,1.2])cyl(root,.1,.14,2.7,x,1.35,2,C.trim,12);box(root,3.3,.2,1.2,0,2.85,2,C.trim);if(age===3){tower(-2,-1.4,.65,4.8);box(root,.6,1.5,.04,-2,3.2,-.73,C.cloth);}else{room(1.6,2.5,2.8,-2.4,-.7,'consularWing');room(1.6,2.5,2.8,2.4,-.7,'receptionWing');box(root,3.3,.12,1.2,0,3.3,2,C.trim);for(const x of [-1.4,-.7,0,.7,1.4])beam(root,[x,2.9,2.5],[x,3.6,2.5],.025,C.dark);}}
 else if(kind==='arsenal'){if(age===3){room(4.5,3,3.3,0,-.8,'armory');for(const x of [-2.4,2.4])tower(x,-1,.65,3.7);}else{for(const x of [-1.45,1.45]){room(2.4,4.5,2.3,x,-.8,'magazine');box(root,1.3,1.7,.04,x,.85,1.48,C.dark);}for(let i=0;i<7;i++)cyl(root,.14,.14,.30,-1.2+i*.4,.22,2.6,C.dark,12);}for(let i=0;i<4;i++)crate(-1.1+i*.7,2);}
 else room(3.5,3,2.8,0,0);
 return finishRig(root);
}
