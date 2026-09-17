import * as T from 'three';
import {C,mat,mesh,box,cyl,beam,ellipsoid as oval,tube,joint,finishRig} from './geometry';

export type Clip='idle'|'walk'|'work'|'mine'|'farm'|'load'|'ram'|'fire'|'attack';
function face(parent:T.Group,villager:boolean){
  const p=joint(parent,'head',0,1.60,0);
  oval(p,0,.065,0,.145,.183,.133,C.skin);
  for(const s of [-1,1]){
    oval(p,s*.145,.064,-.01,.028,.050,.024,C.skin);
    oval(p,s*.15,.066,.006,.013,.027,.011,'#ad7e60');
  }
  if(villager){
    const brim=cyl(p,.22,.23,.025,0,.20,.015,'#a98652',24);brim.scale.z=.84;
    oval(p,0,.225,-.01,.175,.074,.145,'#b49968');
    const band=cyl(p,.177,.182,.028,0,.206,-.01,C.cloth,20);band.scale.z=.83;
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

function rifle(){
  const p=new T.Group();p.name='rifle';
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
  return p;
}

export function buildPerson(villager=false,mounted=false,crew=false){
  const root=new T.Group();root.name=villager?'villager':'infantry';
  const body=joint(root,'body');const cloth=villager?'#b7ad8d':C.cloth;
  const torso=cyl(body,.208,.164,.47,0,1.285,0,cloth,16);torso.scale.z=.64;
  oval(body,0,1.46,0,.22,.079,.127,cloth);
  cyl(body,.066,.073,.12,0,1.565,.0,C.skin,16);
  if(!villager){const collar=cyl(body,.092,.105,.09,0,1.53,0,C.roof2,16);collar.scale.z=.8;}
  // Split cloth panels overlap the hips; mounted coat tails follow the saddle.
  for(const s of [-1,1]){
    if(!villager){const tail=box(body,.20,mounted?.24:.40,.20,s*.11,mounted?.99:.89,-.015,cloth);tail.rotation.z=s*.08;}
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
    const arm=joint(body,`arm${s}`,s*.22,1.46,0);
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
    if(s===1&&!mounted&&!crew&&!villager){
      const tool=joint(hand,'tool',.01,.02,.052);
      if(villager){beam(tool,[0,-.36,0],[0,.45,0],.022,'#806343');tube(tool,[[-.23,.4,.0],[-.10,.46,0],[.11,.46,0],[.24,.36,0]],.028,'#7d8784');}
      else tool.add(rifle());
    }
    if(mounted){arm.rotation.x=-.55;elbow.rotation.x=-.7;}
  }
  if(villager){
    const workTool=joint(body,'workTool',0.15,1.0,0.5);
    const pick=joint(workTool,'pickTool');beam(pick,[0,-0.35,0],[0,0.55,0],0.022,'#806343');tube(pick,[[-0.24,0.49,0],[-0.12,0.56,0],[0.11,0.56,0],[0.26,0.44,0]],0.029,'#7d8784');
    const hoe=joint(workTool,'hoeTool');beam(hoe,[0,-0.30,0],[0,1.20,0],0.022,'#806343');box(hoe,0.24,0.05,0.17,0,1.22,0.07,'#73817b');
  }
  face(body,villager);
  root.userData.mounted=mounted;
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
    tube(p,[[s*.13,1.98,1.28],[s*.30,1.77,.72],[s*.29,2.05,.03]],.012,'#56442d');
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

export function buildRider(){
  const root=horse();root.name='cavalry';const p=root.getObjectByName('horseBody') as T.Group;
  // Drape a curved cloth over the horse's back instead of inserting a plank.
  const positions:number[]=[],indices:number[]=[];
  for(let j=0;j<=8;j++)for(let i=0;i<=12;i++){const u=i/12*Math.PI;positions.push(Math.cos(u)*.415,1.52+Math.sin(u)*.34,-.48+j/8*.78);if(i<12&&j<8){const k=j*13+i;indices.push(k,k+1,k+13,k+1,k+14,k+13);}}
  const cloth=new T.BufferGeometry();cloth.setAttribute('position',new T.Float32BufferAttribute(positions,3));cloth.setIndex(indices);cloth.computeVertexNormals();const cm=mat(C.cloth);cm.side=T.DoubleSide;mesh(cloth,cm,p);
  oval(p,0,1.87,-.07,.24,.07,.31,'#513c2b');oval(p,0,1.96,-.33,.24,.13,.066,'#71513a');oval(p,0,1.97,.19,.18,.12,.063,'#71513a');
  for(const s of [-1,1]){tube(p,[[s*.22,1.91,-.07],[s*.38,1.59,-.08],[s*.40,1.13,-.02]],.017,'#554334');const stirrup=mesh(new T.TorusGeometry(.08,.014,6,14),mat('#b0a47f',.45,.5),p,s*.40,1.11,-.02);stirrup.scale.y=1.35;}
  const rider=buildPerson(false,true);rider.name='rider';rider.position.set(0,1.01,-.08);rider.scale.setScalar(.88);p.add(rider);
  const lance=joint(p,'lance',.47,1.45,.09);
  beam(lance,[0,-.45,0],[0,2.6,0],.019,'#856a43');cyl(lance,.032,.027,.09,0,.6,0,'#b5a06b',12);
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
  if(root.name==='cannon'){
    const phase=t%7,loader=root.getObjectByName('loader'),rammer=root.getObjectByName('rammer');
    const loading=phase<1?phase:phase<2?1:phase<3?3-phase:0;
    const ramming=phase<2?0:phase<2.6?(phase-2)/.6:phase<4.2?1:phase<5?(5-phase)/.8:0;
    if(loader){loader.position.set(-1.15+loading*1.55,0,-.68+loading*2.67);loader.rotation.y=loading>.99?-2.17:loading>0?.53:Math.PI/2;animateAsset(loader,t,clip==='walk'||loading>0&&loading<1?'walk':'load');showPart(loader.getObjectByName('ammo'),phase<2);}
    if(rammer){rammer.position.set(1.23-ramming*.85,0,.46+ramming*1.89);rammer.rotation.y=ramming>.99?-Math.PI/2:-.42;animateAsset(rammer,t,clip==='walk'||ramming>0&&ramming<1?'walk':'ram');}
    const swab=root.getObjectByName('swab');if(swab){showPart(swab,clip!=='walk'&&ramming>.99);swab.position.z=2.4+Math.sin((phase-2.6)*Math.PI*3)*.13;}
    for(const [crew,side] of [[loader,-1],[rammer,1]] as const)if(crew){crew.userData.pushing=clip==='walk';if(clip==='walk'){crew.position.set(side*1.0,0,-.62);crew.rotation.y=0;animateAsset(crew,t,'walk');showPart(crew.getObjectByName('ammo'),false);}}
    root.traverse(o=>{if(o.name.startsWith('cannonWheel'))o.rotation.x=clip==='walk'?t*1.4:0;});
    const barrel=root.getObjectByName('barrel');if(barrel)barrel.position.z=0.15-(clip!=='walk'&&phase>=5?0.28*Math.exp(-(phase-5)*10):0);
    const flash=root.getObjectByName('muzzleFlash');showPart(flash,clip!=='walk'&&phase>5&&phase<5.11);
    return;
  }
  let rig=rigs.get(root);if(!rig){rig=new Map();root.traverse(o=>{if(o.name)rig!.set(o.name,o);});rigs.set(root,rig);}
  const wave=Math.sin(t*6),walk=clip==='walk',work=clip==='work',attack=clip==='attack',mining=clip==='mine',farming=clip==='farm';
  const body=rig.get('body');if(body){body.position.y=walk?Math.abs(wave)*.026:Math.sin(t*1.9)*.006;
    const mounted=root.name==='cavalry'||root.userData.mounted;
    for(const s of [-1,1]){
      const leg=rig.get(`leg${s}`),knee=rig.get(`knee${s}`),arm=rig.get(`arm${s}`),elbow=rig.get(`elbow${s}`);
      if(leg)leg.rotation.x=mounted?-.74:walk?wave*s*.42:0;
      if(knee)knee.rotation.x=mounted?1:walk?Math.max(0,-wave*s)*.65:0;
      const shot=t%3.6,reload=shot>1.2?Math.sin((shot-1.2)/2.4*Math.PI):0,recoil=shot<.13?Math.sin(shot/.13*Math.PI)*.09:0;
      if(arm)arm.rotation.set(mounted?-.55:work?-.35+Math.sin(t*2)*.15:attack?-.98+reload*.65+recoil:walk?-wave*s*.27:-.06,0,s*.11);
      if(elbow)elbow.rotation.set(mounted?-.7:work?-.4:attack?-.6:-.24,0,0);
    }
    const head=rig.get('head');if(head)head.rotation.y=Math.sin(t*.7)*.055;
    const tool=rig.get('tool');if(tool)tool.rotation.x=attack?3.03-Math.max(0,Math.sin(((t%3.6)-1.2)/2.4*Math.PI))*.8:0;
    const workTool=rig.get('workTool');
    if(workTool){
      showPart(rig.get('pickTool'),mining||clip==='idle'||walk);showPart(rig.get('hoeTool'),farming);
      if(mining||farming){
        if(mining){const f=(t%2.4)/2.4;const swing=f<0.5?-0.65+f*0.5:f<0.67?-0.4+(f-0.5)/0.17*2.55:2.15-(f-0.67)/0.33*2.8;workTool.position.set(0.03,1.40-Math.max(0,swing)*.07,0.20);workTool.rotation.set(swing,0,0.06);}
        else{workTool.position.set(0.03,1.24,0.19+Math.sin(t*2.2)*0.04);workTool.rotation.set(2.86+Math.sin(t*2.2)*0.04,0,0.03);}
        armTo(rig,1,new T.Vector3(0,-0.10,0).applyQuaternion(workTool.quaternion).add(workTool.position));
        armTo(rig,-1,new T.Vector3(0,0.12,0).applyQuaternion(workTool.quaternion).add(workTool.position));
      }else{workTool.position.set(0.28,1.01,0.13);workTool.rotation.set(-0.15,0,0.1);armTo(rig,1,workTool.position.clone());}
    }
    if(clip==='load'){const phase=t%7,lift=phase<2?Math.sin(phase/2*Math.PI):0;armTo(rig,1,new T.Vector3(0.12,0.85+lift*0.35,0.40));armTo(rig,-1,new T.Vector3(-0.1,0.88+lift*0.32,0.40));}
    if(clip==='ram'){const phase=t%7,stroke=phase>2&&phase<4?Math.sin((phase-2)*Math.PI*2)*0.11:0;armTo(rig,1,new T.Vector3(0.12,1.15,0.35+stroke));armTo(rig,-1,new T.Vector3(-0.10,1.18,0.48+stroke));}
    if(root.userData.pushing){armTo(rig,1,new T.Vector3(.10,1.10,.30));armTo(rig,-1,new T.Vector3(-.10,1.10,.30));}
  }
  for(const [name,o] of rig){if(name.startsWith('horseLeg')){o.rotation.x=walk?Math.sin(t*6+(o.userData.side>0?Math.PI:0)+(o.userData.front?0:Math.PI))*.36:Math.sin(t*.7)*.012;const h=o.getObjectByName('hock');if(h)h.rotation.x=walk?Math.max(0,-o.rotation.x)*1.2:0;}
    if(name.startsWith('sheepLeg'))o.rotation.x=walk?Math.sin(t*6+(name.includes('-')?Math.PI:0))*.3:0;
  }
  const horseBody=rig.get('horseBody');if(horseBody)horseBody.position.y=walk?Math.abs(wave)*.035:Math.sin(t)*.005;
  const tail=rig.get('tail');if(tail)tail.rotation.z=Math.sin(t*1.7)*.12;
  const sh=rig.get('sheepHead');if(sh){sh.rotation.x=work?.75+Math.sin(t*2.8)*.1:Math.sin(t*.8)*.05;sh.rotation.y=Math.sin(t)*.05;}
  const st=rig.get('sheepTail');if(st)st.rotation.x=Math.sin(t*4)*.17;
  const ft=rig.get('fishTail');if(ft)ft.rotation.y=Math.sin(t*9)*.55;
}
