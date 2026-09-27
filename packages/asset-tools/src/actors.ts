import * as T from 'three';
import {C,mat,mesh,box,cyl,beam,ellipsoid as oval,tube,joint,finishRig} from './geometry';
import {addShot,animateShot,buildBow} from './combat';

export type Clip='idle'|'walk'|'work'|'mine'|'farm'|'load'|'ram'|'fire'|'attack'|'hunt'|'chop'|'gather'|'process'|'fish'|'build'|'heal'|'carry'|'graze'|'flee'|'die'|'dead';
function face(parent:T.Group,villager:boolean,age=4,role=''){
  const p=joint(parent,'head',0,1.60,0);
  oval(p,0,.065,0,.145,.183,.133,C.skin);
  for(const s of [-1,1]){
    oval(p,s*.145,.064,-.01,.028,.050,.024,C.skin);
    oval(p,s*.15,.066,.006,.013,.027,.011,'#ad7e60');
  }
  if(['explorer','skirmisher','marksman'].includes(role)){const brim=cyl(p,.28,.28,.025,0,.20,.01,C.roof2,24);brim.scale.z=.82;cyl(p,.14,.17,.10,0,.255,-.01,C.cloth,16);if(role==='marksman')beam(p,[.13,.23,0],[.19,.46,-.04],.015,C.gold);}
  else if(role==='grenadier'||role==='veteranRifle'){cyl(p,.13,.17,role==='grenadier'?.35:.28,0,role==='grenadier'?.35:.32,0,role==='grenadier'?C.cloth:'#43483c',16);box(p,.14,.19,.025,0,.32,.16,C.gold);}
  else if(role==='commander'){const cap=mesh(new T.ConeGeometry(.27,.13,3),mat(C.roof2),p,0,.24,0);cap.rotation.y=Math.PI/2;beam(p,[-.18,.20,.06],[.18,.20,.06],.018,C.gold);}
  else if(role==='medic'){oval(p,0,.23,-.035,.17,.13,.15,C.light);}
  else if(age===1){tube(p,[[-.14,.16,0],[0,.17,.14],[.14,.16,0]],.025,C.cloth);oval(p,0,.17,-.025,.145,.055,.115,'#514536');}
  else if(!villager&&age<4){
    const hood=role==='archer'||role==='crossbow';mesh(new T.SphereGeometry(.16,16,12,0,Math.PI*2,0,Math.PI/2),mat(hood?C.cloth:age===2?'#ab8a51':'#88928c'),p,0,.15,0);if(!hood){const helmet=cyl(p,.045,.155,.16,0,.27,0,age===2?'#ab8a51':'#88928c',16);box(p,.028,.22,.025,0,.11,.14,C.gold);}else oval(p,0,.14,-.09,.12,.12,.1,C.cloth);
  }else if(!villager&&age===5){mesh(new T.SphereGeometry(.19,20,12,0,Math.PI*2,0,Math.PI/2),mat(C.roof2),p,0,.15,0);box(p,.18,.045,.05,0,.17,.17,C.cloth);}
  else if(villager){
    const brim=cyl(p,.22,.23,.025,0,.20,.015,C.roof2,24);brim.scale.z=.84;
    oval(p,0,.225,-.01,.175,.074,.145,C.cloth);
    const band=cyl(p,.177,.182,.028,0,.206,-.01,C.gold,20);band.scale.z=.83;
  }else{
    const brim=cyl(p,.194,.201,.028,0,.218,.013,C.dark,24);brim.scale.z=.86;
    const crown=cyl(p,.143,.175,.185,0,.300,-.011,C.cloth,20);crown.scale.z=.88;
    const band=cyl(p,.17,.178,.025,0,.222,-.01,C.gold,20);band.scale.z=.88;
    oval(p,0,.29,.143,.028,.038,.011,C.gold);
    tube(p,[[-.15,.22,.07],[-.10,.21,.135],[.10,.21,.135],[.15,.22,.07]],.008,C.gold);
  }
}

function boot(p:T.Group,x:number,y:number,z:number){
  const shaft=cyl(p,.086,.078,.25,x,y+.22,z,'#3c3930',12);shaft.scale.z=.9;
  oval(p,x,y+.072,z+.066,.091,.077,.167,'#3a352c');
  oval(p,x,y+.021,z+.066,.096,.027,.171,'#252925');
  box(p,.145,.04,.11,x,y+.019,z-.029,'#252925');
  box(p,.055,.02,.018,x,y+.17,z+.078,C.gold);
}

export function rifle(modern=false){
  const p=new T.Group();p.name='rifle';
  joint(p,'shotOrigin',.025,modern?.80:.90,.015).rotation.x=-Math.PI/2;
  if(modern){box(p,.065,.53,.065,0,.14,0,'#424c4a');box(p,.1,.25,.085,0,-.24,0,C.dark);box(p,.12,.22,.05,0,-.43,-.015,C.roof2);box(p,.07,.18,.08,0,-.04,-.1,C.dark);beam(p,[.018,.35,.008],[.018,.76,.008],.018,'#59635f');box(p,.09,.2,.028,0,.15,.055,C.roof2);cyl(p,.021,.021,.03,.018,.78,.008,'#172321',16);joint(p,'triggerGrip',-.018,-.16,.018);joint(p,'foreGrip',.022,.19,.018);return p;}
  // Walnut stock silhouette with a dropped butt, narrow wrist and long forestock.
  const shape=new T.Shape();shape.moveTo(-.075,-.51);shape.lineTo(.06,-.50);shape.lineTo(.071,-.36);shape.lineTo(.038,-.20);shape.lineTo(.042,.48);shape.lineTo(-.009,.48);shape.lineTo(-.022,-.12);shape.lineTo(-.059,-.29);shape.closePath();
  const g=new T.ExtrudeGeometry(shape,{depth:.054,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.012,bevelThickness:.009});mesh(g,mat('#785234',.62),p,0,0,-.026);
  beam(p,[.033,-.14,.013],[.033,.84,.013],.021,'#515b5a');
  beam(p,[.010,-.05,-.030],[.010,.70,-.030],.008,'#a4a999');
  for(const y of [.11,.39,.65]){const band=cyl(p,.031,.031,.027,.031,y,.012,'#9e9b7f',12);band.material=mat('#9e9b7f',.4,.6);}
  const muzzle=cyl(p,.029,.028,.042,.033,.85,.013,'#6b7370',16);muzzle.material=mat('#6b7370',.4,.7);
  cyl(p,.015,.015,.003,.033,.873,.013,'#151f22',12);
  box(p,.071,.14,.018,.037,-.11,.052,'#898b76');
  beam(p,[.055,-.05,.060],[.089,.005,.064],.012,'#aaa991');
  box(p,.036,.03,.025,.093,.019,.064,'#555d59');
  const trigger=mesh(new T.TorusGeometry(.041,.008,6,16,Math.PI*1.8),mat('#c4ad73',.4,.5),p,-.031,-.18,.012);trigger.scale.y=1.4;
  beam(p,[-.014,-.12,.013],[-.017,-.18,.013],.008,'#a5a792');
  box(p,.14,.018,.07,-.005,-.51,0,'#ad9a68');
  // Flattened triangular bayonet, not another cylindrical extension.
  const bayonet=new T.BufferGeometry();bayonet.setAttribute('position',new T.Float32BufferAttribute([.054,.81,.018,.093,.84,.018,.068,1.08,.018,.071,.84,.001],3));bayonet.setIndex([0,1,2,0,2,3,1,3,2,0,3,1]);bayonet.computeVertexNormals();mesh(bayonet,mat('#c0c8c1',.28,.8),p);
  tube(p,[[-.01,-.36,-.045],[-.085,-.03,-.075],[-.045,.37,-.049]],.010,'#6f6044');
  joint(p,'triggerGrip',-.018,-.16,.018);joint(p,'foreGrip',.022,.19,.018);
  return p;
}

export function buildPerson(villager=false,mounted=false,crew=false,female=false,age=4,role=''){
  const root=new T.Group();root.name=villager?'villager':'infantry';
  const body=joint(root,'body');const cloth=villager?(female?'#c9bea4':'#b7ad8d'):age===1?'#8e7957':age===2?'#c8b58a':age===3?'#63766b':age===5?'#526c60':C.cloth;
  const torso=cyl(body,female?.183:.208,female?.145:.164,.47,0,1.285,0,cloth,16);torso.scale.z=female?.74:.64;
  oval(body,0,1.46,0,female?.195:.22,.079,.127,cloth);
  if(female){oval(body,0,1.33,.05,.164,.13,.105,cloth);oval(body,0,.99,0,.195,.12,.12,cloth);root.scale.setScalar(.93);}
  cyl(body,.066,.073,.12,0,1.565,.0,C.skin,16);
  if(!villager){const collar=cyl(body,.092,.105,.09,0,1.53,0,C.roof2,16);collar.scale.z=.8;}
  // Split cloth panels overlap the hips; mounted coat tails follow the saddle.
  for(const s of [-1,1]){
    if(!villager&&age===4){const tail=box(body,.20,mounted?.24:.40,.20,s*.11,mounted?.99:.89,-.015,cloth);tail.rotation.z=s*.08;}
    const seam=box(body,.017,.44,.025,s*.018,1.25,.14,villager?'#716853':C.gold);seam.rotation.z=s*.015;
    for(let i=0;i<4;i++)oval(body,s*.025,1.14+i*.084,.145,.012,.012,.007,C.gold);
  }
  const belt=cyl(body,.184,.184,.061,0,1.04,0,'#4b4031',16);belt.scale.z=.72;box(body,.061,.055,.025,0,1.04,.139,C.gold);
  if(villager){const apron=box(body,.30,.48,.035,0,1.005,.151,C.cloth);apron.rotation.x=-.07;box(body,.17,.13,.014,0,1.07,.18,C.roof2);}
  else{
    const strap=box(body,.048,.47,.019,0,1.28,.147,C.light);strap.rotation.z=-.49;
    box(body,.26,.29,.12,0,1.24,-.18,C.wood);
    const roll=cyl(body,.060,.060,.30,0,1.44,-.20,C.pants,12);roll.rotation.z=Math.PI/2;
    for(const x of [-.1,.1])box(body,.025,.31,.026,x,1.24,-.25,'#453c2e');
    box(body,.14,.13,.06,-.18,1.05,.10,'#524333');
  }
  for(const s of [-1,1]){
    const leg=joint(body,`leg${s}`,s*.115,1.02,0);
    if(mounted){leg.position.set(s*.24,1.04,.02);leg.rotation.z=s*.42;leg.rotation.x=-.74;}
    beam(leg,[0,0,0],[0,-.37,.012],.103,villager?'#726c58':C.pants,.074);
    const knee=joint(leg,`knee${s}`,0,-.37,.012);
    if(mounted)knee.rotation.x=1.0;
    oval(knee,0,0,0,.075,.078,.071,villager?'#726c58':C.pants);
    beam(knee,[0,0,0],[0,-.37,0],.066,villager?'#726c58':C.pants,.053);
    boot(knee,0,-.63,.0);
    joint(knee,`foot${s}`,0,-.609,.066);
    const arm=joint(body,`arm${s}`,s*(female?.197:.22),1.46,0);
    arm.rotation.z=s*.11;
    oval(arm,0,-.05,0,.092,.13,.085,cloth);
    beam(arm,[0,-.06,0],[s*.025,-.25,.015],.079,cloth,.057);
    if(!villager)oval(arm,s*.006,.01,0,.093,.024,.092,C.gold);
    const elbow=joint(arm,`elbow${s}`,s*.025,-.25,.015);elbow.rotation.x=-.24;
    beam(elbow,[0,0,0],[0,-.215,.015],.059,cloth,.045);
    const cuff=cyl(elbow,.052,.048,.055,0,-.20,.013,villager?C.light:C.roof2,12);
    const hand=joint(elbow,`hand${s}`,0,-.259,.025);oval(hand,0,0,0,.043,.060,.036,C.skin);
    for(let i=0;i<4;i++)oval(hand,-.027+i*.018,-.03,.025,.009,.03,.011,C.skin);
    oval(hand,s*-.035,.01,.033,.016,.033,.016,C.skin);
    if(mounted){arm.rotation.x=-.55;elbow.rotation.x=-.7;}
  }
  if(!villager&&age<4){const tunic=cyl(body,.17,.23,.28,0,.94,0,C.cloth,16);tunic.scale.z=.65;}
  if(!villager&&age===5){box(body,.33,.30,.11,0,1.26,.13,C.roof2);for(const s of [-1,1])box(body,.11,.10,.075,s*.095,1.20,.2,C.cloth);}
  if(!villager&&!mounted&&!crew){const tool=joint(body,'tool');tool.add(rifle(age===5));addShot(root,'bullet',3.6,.65);}
  if(villager){
    const hunting=buildBow(body,age>=3);hunting.traverse(o=>o.visible=false);root.userData.loadout=age>=3?'crossbow':'archer';addShot(root,age>=3?'bolt':'arrow',3,1.3);
    const workTool=joint(body,'workTool',0.15,1.0,0.5);
    const pick=joint(workTool,'pickTool');beam(pick,[0,-0.35,0],[0,0.55,0],0.022,'#806343');
    // The head lies in the swing plane (YZ): the tapered forward point leads.
    beam(pick,[0,.54,-.08],[0,.49,-.30],.048,'#697774',.003);beam(pick,[0,.54,.06],[0,.43,.30],.048,'#87938d',.003);box(pick,.075,.10,.15,0,.53,0,'#68746e');
    const hoe=joint(workTool,'hoeTool');beam(hoe,[0,-0.30,0],[0,1.20,0],0.022,'#806343');box(hoe,0.24,0.05,0.17,0,1.22,0.07,'#73817b');
    const axe=joint(workTool,'axeTool');beam(axe,[0,-.30,0],[0,.57,0],.022,C.wood);const blade=new T.Shape();blade.moveTo(0,.43);blade.lineTo(.26,.34);blade.quadraticCurveTo(.33,.52,.24,.68);blade.lineTo(0,.57);blade.closePath();const bladeMesh=mesh(new T.ExtrudeGeometry(blade,{depth:.035,bevelEnabled:false}),mat('#89928c',.4,.6),axe);bladeMesh.rotation.y=-Math.PI/2;
    const knife=joint(workTool,'knifeTool');beam(knife,[0,-.12,0],[0,.04,0],.025,C.wood);const knifeBlade=mesh(new T.ConeGeometry(.035,.22,4),mat('#bec4b9',.3,.6),knife,0,.15,0);knifeBlade.scale.z=.25;
    const hammer=joint(workTool,'hammerTool');beam(hammer,[0,-.15,0],[0,.3,0],.022,C.wood);box(hammer,.2,.09,.09,0,.3,0,C.dark);
    const basket=joint(body,'basket',-.28,.93,.06);cyl(basket,.13,.10,.20,0,0,0,C.wood,12);for(let i=0;i<7;i++)oval(basket,Math.sin(i*2.4)*.075,.11,Math.cos(i*2.4)*.075,.035,.03,.035,'#a2493d');
    const net=joint(body,'castNet',0,1.05,.45);for(let i=0;i<12;i++){const a=i*Math.PI/6;beam(net,[0,0,0],[Math.cos(a),0,Math.sin(a)],.005,'#b4ae8f');}for(let i=1;i<=5;i++){const ring=mesh(new T.TorusGeometry(i/5,.005,3,24),mat('#b4ae8f'),net);ring.rotation.x=Math.PI/2;}
    if(female){const hair=joint(body,'hair',0,1.65,-.11);oval(hair,0,0,-.018,.14,.13,.045,'#594433');oval(hair,0,-.03,-.07,.07,.065,.06,'#594433');const skirt=cyl(body,.175,.25,.33,0,.84,0,'#777962',20);skirt.scale.z=.68;}
  }
  face(body,villager,age,role);
  root.userData.mounted=mounted;
  root.userData.villager=villager;root.userData.gender=female?'female':'male';root.userData.age=age;
  return finishRig(root);
}

function horse(){
  const root=new T.Group();root.name='horse';const p=joint(root,'horseBody');const hair='#2d2925',coat='#85583d';
  oval(p,0,1.41,-.02,.36,.43,.77,coat);
  oval(p,0,1.40,.48,.32,.43,.39,'#8e5d40');oval(p,0,1.44,-.58,.36,.39,.38,coat);
  // Sweep an elliptical neck along an anatomical S-curve.
  const rings=[[.40,1.42,.26,.32],[.56,1.71,.245,.28],[.68,1.99,.19,.23],[.83,2.22,.14,.16]];
  const v:number[]=[],ix:number[]=[];
  rings.forEach(([z,y,rx,ry],j)=>{for(let i=0;i<16;i++){const a=i/16*Math.PI*2;v.push(Math.cos(a)*rx,y+Math.sin(a)*ry*.4,z+Math.sin(a)*ry);if(j<rings.length-1){const k=j*16+i,n=j*16+(i+1)%16;ix.push(k,k+16,n,n,k+16,n+16);}}});
  const ng=new T.BufferGeometry();ng.setAttribute('position',new T.Float32BufferAttribute(v,3));ng.setIndex(ix);ng.computeVertexNormals();mesh(ng,mat(coat),p);
  const head=joint(p,'horseHead',0,2.16,.85);head.rotation.x=-.25;
  oval(head,0,0,.10,.15,.21,.29,coat);oval(head,0,-.15,.31,.12,.14,.22,'#95674c');oval(head,0,-.23,.44,.13,.10,.13,'#5d4739');
  for(const s of [-1,1]){
    const ear=oval(head,s*.104,.26,-.03,.046,.17,.057,coat);ear.rotation.z=-s*.16;
    const inner=oval(head,s*.105,.28,.019,.025,.106,.011,'#bb9072');inner.rotation.z=-s*.16;
    oval(head,s*.139,.023,.17,.027,.023,.019,'#241f19');oval(head,s*.152,.029,.176,.006,.006,.004,'#ded9c9');
    oval(head,s*.104,-.207,.482,.024,.017,.016,'#2d2722');
    tube(head,[[s*.14,.1,-.10],[s*.151,-.07,.18],[s*.123,-.21,.45]],.016,'#4d3b2d');
  }
  tube(head,[[-.13,-.19,.41],[0,-.24,.53],[.13,-.19,.41]],.018,'#564332');
  for(let i=0;i<15;i++){const f=i/14;tube(p,[[0,1.68+f*.60,.32+f*.40],[-.07,1.64+f*.60,.29+f*.40],[-.11,1.55+f*.60,.26+f*.40]],.025,hair);}
  const tail=joint(p,'tail',0,1.6,-.83);for(let i=0;i<7;i++)tube(tail,[[0,0,0],[Math.sin(i)*.025,-.18,-.22],[Math.sin(i)*.05,-.52,-.27],[Math.sin(i)*.07,-.82,-.20]],.029,hair);
  for(const x of [-.24,.24])for(const z of [-.55,.51]){
    const front=z>0;const leg=joint(p,`horseLeg${x}${z}`,x,1.35,z);leg.userData.front=front;leg.userData.side=x;
    oval(leg,0,-.12,0,.105,.25,.15,coat);
    beam(leg,[0,-.19,0],[0,-.54,front?.05:-.1],.080,coat,.052);
    const lower=joint(leg,'hock',0,-.54,front?.05:-.1);oval(lower,0,0,0,.059,.077,.067,'#77513b');
    beam(lower,[0,-.02,0],[0,-.57,.02],.047,coat,.037);
    oval(lower,0,-.53,.015,.05,.077,.059,'#b6aa8b');
    const hoof=cyl(lower,.047,.067,.12,0,-.66,.049,'#3e3d34',12);hoof.scale.z=1.35;
  }
  return root;
}

export function buildRider(age=4){
  const root=horse();root.name='cavalry';const p=root.getObjectByName('horseBody') as T.Group;
  // Drape a curved cloth over the horse's back instead of inserting a plank.
  const positions:number[]=[],indices:number[]=[];
  for(let j=0;j<=8;j++)for(let i=0;i<=12;i++){const u=i/12*Math.PI;positions.push(Math.cos(u)*.415,1.52+Math.sin(u)*.34,-.48+j/8*.78);if(i<12&&j<8){const k=j*13+i;indices.push(k,k+1,k+13,k+1,k+14,k+13);}}
  const cloth=new T.BufferGeometry();cloth.setAttribute('position',new T.Float32BufferAttribute(positions,3));cloth.setIndex(indices);cloth.computeVertexNormals();const cm=mat(C.cloth);cm.side=T.DoubleSide;mesh(cloth,cm,p);
  oval(p,0,1.87,-.07,.24,.07,.31,'#513c2b');oval(p,0,1.96,-.33,.24,.13,.066,'#71513a');oval(p,0,1.97,.19,.18,.12,.063,'#71513a');
  const rider=buildPerson(false,true,false,false,age);rider.name='rider';rider.position.set(0,1.01,-.08);rider.scale.setScalar(.88);p.add(rider);
  p.updateMatrixWorld(true);
  for(const s of [-1,1]){const foot=p.worldToLocal(rider.getObjectByName(`foot${s}`)!.getWorldPosition(new T.Vector3()));const stirrup=joint(p,`stirrup${s}`,foot.x,foot.y+.065,foot.z);const loop=mesh(new T.TorusGeometry(.1,.012,6,20),mat('#b0a47f',.45,.5),stirrup);loop.rotation.y=Math.PI/2;loop.scale.set(1.5,.65,1);tube(p,[[s*.22,1.91,-.07],[foot.x,1.59,foot.z],[foot.x,foot.y+.13,foot.z]],.017,'#554334');}
  for(const s of [-1,1]){const grip=joint(rider.getObjectByName('body') as T.Group,`reinGrip${s}`,s*.10,1.20,.28);p.updateMatrixWorld(true);const end=p.worldToLocal(grip.getWorldPosition(new T.Vector3()));tube(p,[[s*.13,1.98,1.28],[s*.20,1.92,.68],end.toArray()],.012,'#56442d');}
  const lance=joint(p,'lance',.62,1.88,.06);
  beam(lance,[0,-.25,0],[0,2.6,0],.019,'#856a43');cyl(lance,.032,.027,.09,0,0,0,'#b5a06b',12);joint(lance,'lanceGrip');
  const spear=new T.OctahedronGeometry(.12);spear.scale(.38,2.4,.18);mesh(spear,mat('#c1c9c3',.3,.75),lance,0,2.8,0);
  const flag=new T.Shape();flag.moveTo(0,0);flag.lineTo(.47,-.07);flag.lineTo(.35,-.14);flag.lineTo(.46,-.23);flag.lineTo(0,-.22);const flagMat=mat('#3e7778');flagMat.side=T.DoubleSide;mesh(new T.ShapeGeometry(flag),flagMat,lance,0,2.44,0);
  return finishRig(root);
}

export function buildSheep(){
  const p=new T.Group();p.name='sheep';const body=joint(p,'sheepBody');
  oval(body,0,.66,0,.31,.31,.48,'#d8d1b9');
  for(let i=0;i<52;i++){const a=i*2.39996,y=1-2*(i+.5)/52,r=Math.sqrt(1-y*y);oval(body,Math.cos(a)*r*.28,.66+y*.26,Math.sin(a)*r*.44,.09,.09,.09,i%3?'#e5dfca':'#cdc7b2');}
  const collar=cyl(body,.175,.175,.075,0,.77,.38,C.cloth,18);collar.rotation.x=Math.PI/2;oval(body,0,.66,.45,.035,.043,.023,C.gold);
  const head=joint(body,'sheepHead',0,.80,.44);oval(head,0,0,.10,.13,.17,.19,'#635b4c');oval(head,0,-.09,.23,.085,.079,.12,'#746955');
  for(const s of [-1,1]){const ear=oval(head,s*.17,.04,.03,.13,.035,.065,'#9b9178');ear.rotation.z=s*.25;oval(head,s*.114,.027,.17,.018,.019,.011,'#201f1b');}
  for(const x of [-.19,.19])for(const z of [-.27,.27]){const leg=joint(body,`sheepLeg${x}${z}`,x,.55,z);beam(leg,[0,0,0],[0,-.43,0],.045,'#79715d',.031);for(const s of [-1,1])oval(leg,s*.019,-.48,.016,.022,.06,.055,'#3c3d33');}
  const tail=joint(body,'sheepTail',0,.75,-.44);oval(tail,0,-.08,-.04,.07,.14,.067,'#d8d1b9');return finishRig(p);
}
export function buildFish(){const p=new T.Group();p.name='fish';oval(p,0,0,0,.09,.15,.36,'#7ba7a0');oval(p,0,.052,-.03,.075,.10,.29,'#496e71');for(const s of [-1,1])oval(p,s*.072,.026,.22,.018,.02,.013,'#182e30');const tail=joint(p,'fishTail',0,0,-.29);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([0,0,0,0,.18,-.22,0,-.18,-.22],3));g.computeVertexNormals();const m=mat('#678e8c');m.side=T.DoubleSide;mesh(g,m,tail);return finishRig(p);}

const rigs=new WeakMap<T.Object3D,Map<string,T.Object3D>>();
const down=new T.Vector3(0,-1,0);
function armTo(rig:Map<string,T.Object3D>,side:number,target:T.Vector3){
 const arm=rig.get(`arm${side}`),elbow=rig.get(`elbow${side}`),hand=rig.get(`hand${side}`);if(!arm||!elbow||!hand)return;
 const shoulder=arm.position,delta=target.clone().sub(shoulder),distance=Math.min(0.50,Math.max(0.03,delta.length())),direction=delta.normalize();
 const upper=0.25,lower=0.27,along=(upper*upper-lower*lower+distance*distance)/(2*distance),bend=Math.sqrt(Math.max(0,upper*upper-along*along));
 const hint=new T.Vector3(side*0.55,-0.85,-0.12);hint.addScaledVector(direction,-hint.dot(direction)).normalize();
 const elbowPoint=shoulder.clone().addScaledVector(direction,along).addScaledVector(hint,bend);
 arm.quaternion.setFromUnitVectors(down,elbowPoint.clone().sub(shoulder).normalize());elbow.position.set(0,-upper,0);
 const lowerDirection=target.clone().sub(elbowPoint).normalize().applyQuaternion(arm.quaternion.clone().invert());elbow.quaternion.setFromUnitVectors(down,lowerDirection);hand.position.set(0,-lower,0);
}
function showPart(object:T.Object3D|undefined,visible:boolean){object?.traverse(o=>o.visible=visible);}
export function animateAsset(root:T.Object3D,t:number,clip:Clip='idle'){
  const ram=root.getObjectByName('ramBeam');if(ram){const phase=(t%1.75)/1.75;ram.position.z=clip==='attack'?(phase<.65?-.45*phase/.65:phase<.8?-.45+(phase-.65)/.15*.85:.4*(1-(phase-.8)/.2)):0;}
  const crown=root.getObjectByName('fallenCrown');if(crown){const f=T.MathUtils.smoothstep(t,0,1.5);crown.rotation.z=f*Math.PI/2;crown.position.y=f*crown.userData.landY;}
  if(root.name==='sapperTeam'){root.children.forEach(child=>animateAsset(child,t,clip));return;}
  if(root.name==='cannon'||root.userData.artillery){
    const active=clip==='attack'||clip==='fire',phase=active?t%7:0,loader=root.getObjectByName('loader'),rammer=root.getObjectByName('rammer');
    const loading=active?(phase<1?phase:phase<2?1:phase<3?3-phase:0):0;
    const ramming=phase<2?0:phase<2.6?(phase-2)/.6:phase<4.2?1:phase<5?(5-phase)/.8:0;
    if(loader){loader.position.set(-1.15+loading*1.55,0,-.68+loading*2.67);loader.rotation.y=loading>.99?-2.17:loading>0?.53:Math.PI/2;animateAsset(loader,t,!active?clip:loading>0&&loading<1?'walk':'load');showPart(loader.getObjectByName('ammo'),active&&phase<2);}
    if(rammer){rammer.position.set(1.23-ramming*.85,0,.46+ramming*1.89);rammer.rotation.y=ramming>.99?-Math.PI/2:-.42;animateAsset(rammer,t,!active?clip:ramming>0&&ramming<1?'walk':'ram');}
    const swab=root.getObjectByName('swab');if(swab){showPart(swab,active&&ramming>.99);swab.position.z=2.4+Math.sin((phase-2.6)*Math.PI*3)*.13;}
    for(const [crew,side] of [[loader,-1],[rammer,1]] as const)if(crew){crew.userData.pushing=clip==='walk';if(clip==='walk'){crew.position.set(side*1.0,0,-.62);crew.rotation.y=0;animateAsset(crew,t,'walk');showPart(crew.getObjectByName('ammo'),false);}}
    root.traverse(o=>{if(o.name.startsWith('cannonWheel'))o.rotation.x=clip==='walk'?t*1.4:0;});
    const barrel=root.getObjectByName('barrel');if(barrel)barrel.position.z=0.15-(active&&phase>=5?0.28*Math.exp(-(phase-5)*10):0);
    const flash=root.getObjectByName('muzzleFlash');showPart(flash,active&&phase>5&&phase<5.11);
    animateShot(root,t,clip==='fire'||clip==='attack');return;
  }
  let rig=rigs.get(root);if(!rig){rig=new Map();root.traverse(o=>{if(o.name)rig!.set(o.name,o);});rigs.set(root,rig);}
  const wave=Math.sin(t*6),walk=clip==='walk'||clip==='flee',work=clip==='work'||clip==='graze',attack=clip==='attack'||clip==='hunt',mining=clip==='mine'||(clip==='attack'&&root.userData.villager),farming=clip==='farm',chopping=clip==='chop';
  const body=rig.get('body');if(body){body.position.y=walk?Math.abs(wave)*.026:Math.sin(t*1.9)*.006;
    const mounted=rig.has('horseBody')||root.userData.mounted;
    for(const s of [-1,1]){
      const leg=rig.get(`leg${s}`),knee=rig.get(`knee${s}`),arm=rig.get(`arm${s}`),elbow=rig.get(`elbow${s}`);
      if(leg)leg.rotation.x=mounted?-.74:walk?wave*s*.42:0;
      if(knee)knee.rotation.x=mounted?1:walk?Math.max(0,-wave*s)*.65:0;
      const shot=t%3.6,reload=shot>1.2?Math.sin((shot-1.2)/2.4*Math.PI):0,recoil=shot<.13?Math.sin(shot/.13*Math.PI)*.09:0;
      if(arm)arm.rotation.set(mounted?-.55:work?-.35+Math.sin(t*2)*.15:attack?-.98+reload*.65+recoil:walk?-wave*s*.27:-.06,0,s*.11);
      if(elbow)elbow.rotation.set(mounted?-.7:work?-.4:attack?-.6:-.24,0,0);
    }
    const head=rig.get('head');if(head)head.rotation.y=Math.sin(t*.7)*.055;
    const tool=rig.get('tool');if(tool){
      const reload=attack&&t%3.6>1.1?Math.sin((t%3.6-1.1)/2.5*Math.PI):0;
      tool.position.set(.04,attack?1.40-reload*.16:1.23,attack?.16:.16);tool.rotation.set(attack?Math.PI/2-reload*.65:.36,0,attack?-.08:.22);
      tool.updateMatrix();
      for(const [side,name] of [[1,'triggerGrip'],[-1,'foreGrip']] as const){const grip=rig.get(name);if(grip){const point=grip.position.clone().applyMatrix4(tool.matrix);armTo(rig,side,point);}}
    }
    const workTool=rig.get('workTool');
    const held=rig.get('heldWeapon');if(root.userData.villager)showPart(held,clip==='hunt');if(held&&(!root.userData.villager||clip==='hunt')){const role=root.userData.loadout,phase=t%3,draw=attack?Math.min(1,phase/1.3):0;
     if(role==='archer'){held.position.set(-.065,attack?1.41:1.20,.35);held.rotation.set(0,0,0);held.updateMatrix();armTo(rig,-1,held.position.clone());const pull=phase<1.3?draw:0,grip=rig.get('drawGrip')!;grip.position.z=-.07-pull*.24;armTo(rig,1,grip.position.clone().applyMatrix4(held.matrix));for(const [name,y] of [['stringLower',-.48],['stringUpper',.48]] as const){const segment=rig.get(name)!,end=new T.Vector3(0,y,.08),delta=end.clone().sub(grip.position);segment.position.copy(end.add(grip.position).multiplyScalar(.5));segment.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.clone().normalize());segment.scale.y=delta.length();}const arrow=rig.get('nockedArrow');if(arrow)arrow.position.z=-pull*.24;showPart(arrow,!attack||phase<1.3||phase>2.4);}
     else if(role==='crossbow'){held.position.set(.02,attack?1.37:1.15,.23);held.rotation.set(0,0,0);held.updateMatrix();for(const [side,name] of [[1,'bowGrip'],[-1,'supportGrip']] as const)armTo(rig,side,rig.get(name)!.position.clone().applyMatrix4(held.matrix));showPart(rig.get('nockedArrow'),!attack||phase<1.3||phase>2.5);}
     else if(role==='grenadier'||role==='saboteur'){const windup=phase<.8?phase/.8:phase<1.3?1-(phase-.8)/.5:0;held.position.set(.25,1.35+windup*.40,.14-windup*.18);held.rotation.set(0,0,0);armTo(rig,1,held.position.clone());showPart(held,!attack||phase<1.3||phase>2.4);}
     else{const f=t%1.8/1.8,swing=attack?Math.sin(f*Math.PI*2):0,lunge=attack?Math.max(0,Math.sin(f*Math.PI*2))*.20:0;body.position.z=lunge;held.position.set(.20,1.27+swing*.16,.22+lunge*.3);held.rotation.set(attack?.8+swing*1.1:.25,0,attack?-.20+swing*.35:-.18);armTo(rig,1,held.position.clone());}
    }else body.position.z=0;
    const shield=rig.get('heldShield');if(shield){shield.position.set(-.28,1.14,.25);armTo(rig,-1,shield.position.clone());}
    if(workTool){
      workTool.visible=mining||farming||chopping||clip==='process'||clip==='build';
      showPart(rig.get('pickTool'),mining);showPart(rig.get('hoeTool'),farming);showPart(rig.get('axeTool'),chopping);showPart(rig.get('knifeTool'),clip==='process');showPart(rig.get('hammerTool'),clip==='build');
      showPart(rig.get('basket'),clip==='gather'||clip==='carry');showPart(rig.get('castNet'),clip==='fish');
      if(mining||farming||chopping||clip==='build'){
        if(chopping){const phase=t%2.4/2.4,swing=phase<.5?-.85+phase*.6:phase<.68?-.55+(phase-.5)/.18*1.55:1-(phase-.68)/.32*1.85;workTool.position.set(.03,1.12,.40);workTool.rotation.set(swing,0,.06);}
        else if(mining||clip==='build'){const f=(t%2.4)/2.4;const swing=f<0.5?-0.65+f*0.5:f<0.67?-0.4+(f-0.5)/0.17*2.55:2.15-(f-0.67)/0.33*2.8;workTool.position.set(0.03,1.40-Math.max(0,swing)*.07,0.20);workTool.rotation.set(swing,0,0.06);}
        else{workTool.position.set(0.03,1.24,0.19+Math.sin(t*2.2)*0.04);workTool.rotation.set(2.86+Math.sin(t*2.2)*0.04,0,0.03);}
        armTo(rig,1,new T.Vector3(0,-0.10,0).applyQuaternion(workTool.quaternion).add(workTool.position));
        armTo(rig,-1,new T.Vector3(0,0.12,0).applyQuaternion(workTool.quaternion).add(workTool.position));
      }else if(clip==='process'){body.position.y=-.26;workTool.position.set(.12,1.10,.22+Math.sin(t*4)*.025);workTool.rotation.set(2.1,0,.2);armTo(rig,1,workTool.position.clone());armTo(rig,-1,new T.Vector3(-.15,1.12,.22));for(const s of [-1,1]){rig.get(`leg${s}`)!.rotation.x=-.55;rig.get(`knee${s}`)!.rotation.x=1.15;}}
      if(clip==='gather'){armTo(rig,1,new T.Vector3(.13,1.25+Math.sin(t*2.8)*.10,.28));armTo(rig,-1,new T.Vector3(-.28,1.10,.12));}
      if(clip==='fish'){const phase=t%5/5,net=rig.get('castNet')!;root.updateMatrixWorld(true);const start=body.localToWorld(new T.Vector3(0,1.25,.30)),target=root.userData.fishingTarget?new T.Vector3(...root.userData.fishingTarget):root.localToWorld(new T.Vector3(0,.025,3));const range=start.distanceTo(target);if(range>6){showPart(net,false);}else{const f=phase<.2?0:phase<.55?(phase-.2)/.35:phase<.78?1:1-(phase-.78)/.22,point=start.clone().lerp(target,f);point.y+=Math.sin(f*Math.PI)*(phase<.55?.8:.12);net.position.copy(net.parent!.worldToLocal(point));net.scale.setScalar(.12+f*.83);net.rotation.set(0,0,0);}armTo(rig,1,new T.Vector3(.15,1.3,.30));armTo(rig,-1,new T.Vector3(-.13,1.32,.28));}
    }
    if(mounted){body.position.y=0;for(const s of [-1,1]){const grip=rig.get(`reinGrip${s}`);if(grip)armTo(rig,s,grip.position.clone());}if(attack){if(tool){tool.updateMatrix();for(const [s,name] of [[1,'triggerGrip'],[-1,'foreGrip']] as const)armTo(rig,s,rig.get(name)!.position.clone().applyMatrix4(tool.matrix));}else armTo(rig,1,new T.Vector3(.28,1.25,.15));}else if(tool){tool.position.set(.26,1.25,-.24);tool.rotation.set(0,0,.2);}}
    if(clip==='load'){const phase=t%7,lift=phase<2?Math.sin(phase/2*Math.PI):0;armTo(rig,1,new T.Vector3(0.12,0.85+lift*0.35,0.40));armTo(rig,-1,new T.Vector3(-0.1,0.88+lift*0.32,0.40));}
    if(clip==='ram'){const phase=t%7,stroke=phase>2&&phase<4?Math.sin((phase-2)*Math.PI*2)*0.11:0;armTo(rig,1,new T.Vector3(0.12,1.15,0.35+stroke));armTo(rig,-1,new T.Vector3(-0.10,1.18,0.48+stroke));}
    if(root.userData.pushing){armTo(rig,1,new T.Vector3(.10,1.10,.30));armTo(rig,-1,new T.Vector3(-.10,1.10,.30));}
  }
  for(const [name,o] of rig){if(name.startsWith('horseLeg')){o.rotation.x=walk?Math.sin(t*6+(o.userData.side>0?Math.PI:0)+(o.userData.front?0:Math.PI))*.36:Math.sin(t*.7)*.012;const h=o.getObjectByName('hock');if(h)h.rotation.x=walk?Math.max(0,-o.rotation.x)*1.2:0;}
    if(name.startsWith('sheepLeg'))o.rotation.x=walk?Math.sin(t*6+(name.includes('-')?Math.PI:0))*.3:0;
    if(name.startsWith('animalLeg'))o.rotation.x=walk?Math.sin(t*(clip==='flee'?10:5)+(o.position.x*o.position.z>0?0:Math.PI))*.38:0;
    if(name.startsWith('birdWing'))o.rotation.z=(name.endsWith('-1')?-1:1)*Math.sin(t*5)*.55;
    if(name==='rollingWheel')o.rotation.x=walk?t*2:0;
  }
  const horseBody=rig.get('horseBody');if(horseBody)horseBody.position.y=walk?Math.abs(wave)*.035:Math.sin(t)*.005;
  const tail=rig.get('tail');if(tail)tail.rotation.z=Math.sin(t*1.7)*.12;
  const sh=rig.get('sheepHead');if(sh){sh.rotation.x=work?.75+Math.sin(t*2.8)*.1:Math.sin(t*.8)*.05;sh.rotation.y=Math.sin(t)*.05;}
  const st=rig.get('sheepTail');if(st)st.rotation.x=Math.sin(t*4)*.17;
  const ft=rig.get('fishTail');if(ft)ft.rotation.y=Math.sin(t*9)*.55;
  const lance=rig.get('lance'),rider=rig.get('rider');if(lance&&rider){if(attack){root.updateMatrixWorld(true);const hand=rig.get('hand1')!;lance.position.copy(lance.parent!.worldToLocal(hand.getWorldPosition(new T.Vector3())));lance.rotation.x=1.40+Math.sin(t*4)*.08;}else{lance.position.set(.62,1.88,.06);lance.rotation.x=.08;}}
  const saber=rig.get('mountedSaber');if(saber&&body){if(attack){root.updateMatrixWorld(true);saber.position.copy(body.worldToLocal(rig.get('hand1')!.getWorldPosition(new T.Vector3())));saber.rotation.x=1.2+Math.sin(t*5)*.7;}else{saber.position.set(-.30,1.0,-.04);saber.rotation.x=3.0;}}
  const dying=clip==='dead'||clip==='die';const death=clip==='dead'?1:Math.min(1,t);
  const animalHead=rig.get('animalHead');if(animalHead)animalHead.rotation.x=work?.55+Math.sin(t*2)*.12:attack?Math.sin(t*7)*.22:0;
  const animalBody=rig.get('animalBody');if(animalBody){const f=t%1.6/1.6,lunge=attack?Math.max(0,Math.sin(f*Math.PI*2)):0;animalBody.position.z=lunge*.65;animalBody.position.y=lunge*.18;for(const [name,leg] of rig)if(name.startsWith('animalLeg')&&attack)leg.rotation.x=leg.position.z>0?-lunge*.65:lunge*.50;const jaw=rig.get('animalJaw');if(jaw)jaw.rotation.x=lunge*.65;}
  const fall=rig.get('horseBody')||rig.get('sheepBody')||rig.get('animalBody')||rig.get('body');if(fall){
   fall.rotation.set(0,0,0);
   if(dying){const angle=root.userData.deathDirection??(root.uuid.split('').reduce((n,c)=>n+c.charCodeAt(0),0)*2.39996);root.userData.deathDirection=angle;fall.quaternion.setFromAxisAngle(new T.Vector3(Math.cos(angle),0,Math.sin(angle)),death*Math.PI/2);fall.position.y=0;
    root.updateMatrixWorld(true);const bounds=new T.Box3();fall.traverseVisible(o=>{if(o instanceof T.Mesh){o.geometry.computeBoundingBox();bounds.union(o.geometry.boundingBox!.clone().applyMatrix4(o.matrixWorld));}});const ground=root.getWorldPosition(new T.Vector3()).y;if(!bounds.isEmpty())fall.position.y=Math.max(0,ground-bounds.min.y)/root.getWorldScale(new T.Vector3()).y;
   }else if(fall!==body&&fall!==horseBody&&fall!==animalBody)fall.position.y=0;
  }
  animateShot(root,t,root.userData.villager?clip==='hunt':attack||clip==='fire');
}
