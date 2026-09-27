import * as T from 'three';
import {C,mat,mesh,box,cyl,ball,beam,tube,joint,finishRig,consolidate,ellipsoid as oval} from './geometry';
import {buildPerson,buildRider,rifle,type Clip} from './actors';
import {buildMine,buildFelledTree} from './nature';
import {buildBow,addShot} from './combat';

const buildings={lumberPost:'Lumber Post',miningPost:'Mining Post',silo:'Grain Silo',stable:'Riding Stable',barracks:'Barracks',archery:'Archery Range',workshop:'Artillery Workshop',dock:'Harbor Dock',tradePost:'Trade Post',mercenaryHall:'Contract Hall',embassy:'Alliance Embassy',arsenal:'Arsenal',academy:'Academy',temple:'Civic Sanctuary',factory:'Engine Factory',wall:'Curtain Wall',gate:'City Gate',fort:'Coastal Fort',landmark:'Meridian Beacon',farm:'Grain Farm',estate:'Orchard Estate',fishery:'Shore Fishery'} as const;
const soldiers={militia:'Militia',spearman:'Levy Spearman',swordsman:'Charter Swordsman',veteranRifle:'Veteran Rifle',grenadier:'Grenadier',pikeman:'Long Pike',marksman:'Marksman',skirmisher:'Skirmisher',shieldBearer:'Shield Bearer',saboteur:'Saboteur',archer:'Bow Archer',crossbow:'Crossbow Guard',medic:'Field Medic',engineer:'Engineer',explorer:'Frontier Explorer',factionGuard:'League Guard',contractUnit:'Contract Blade',allianceUnit:'Alliance Sentinel',commander:'Field Commander'} as const;
const riders={lightRider:'Light Rider',dragoon:'Dragoon',cuirassRider:'Cuirass Rider',mountedScout:'Mounted Scout'} as const;
const engines={howitzer:'Howitzer',scatterGun:'Scatter Gun',mortar:'Mortar',rocketCart:'Rocket Cart',ramWagon:'Ram Wagon',siegeTower:'Siege Tower',supplyWagon:'Supply Wagon',builderWagon:'Builder Wagon',trader:'Trade Wagon',sapperTeam:'Sapper Team',mobileFieldwork:'Mobile Fieldwork'} as const;
const vessels={tradeShip:'Trade Ship',transport:'Troop Transport',sloop:'Patrol Sloop',frigate:'League Frigate',bombardVessel:'Bombard Vessel',fireCraft:'Fire Craft'} as const;
const nature={villagerFemale:'Frontier Worker · Female',deer:'Meadow Deer',wolf:'Ridge Wolf',scoutAnimal:'Scout Hound',stoneMine:'Stone Outcrop',treeHalfCut:'Oak · Half Cut',stump:'Oak Stump',logPile:'Stacked Timber',treasure:'Supply Cache',bird:'Coastal Gull'} as const;
type BuildingKind=keyof typeof buildings;
export type ExtraKind=keyof typeof buildings|keyof typeof soldiers|keyof typeof riders|keyof typeof engines|keyof typeof vessels|keyof typeof nature;
export const extraInfo=Object.fromEntries([
  ...Object.entries(buildings).map(([id,name])=>[id,{name,category:'BUILDING',description:`${name} of the Aurelian League. Inspect its available ages and construction, damage and ruin states.`}]),
  ...Object.entries(soldiers).map(([id,name])=>[id,{name,category:'FOOT UNIT',description:`Original ${name.toLowerCase()} equipment, articulated movement and combat poses.`}]),
  ...Object.entries(riders).map(([id,name])=>[id,{name,category:'MOUNTED UNIT',description:`${name} with fitted stirrups, reins and an articulated mounted combat pose.`}]),
  ...Object.entries(engines).map(([id,name])=>[id,{name,category:'SIEGE & LOGISTICS',description:`${name} with an original timber and metal chassis in League colors.`}]),
  ...Object.entries(vessels).map(([id,name])=>[id,{name,category:'NAVAL',description:`${name} with a sealed hull, faction markings and equipment for its naval role.`}]),
  ...Object.entries(nature).map(([id,name])=>[id,{name,category:id==='villagerFemale'?'CIVILIAN':'RESOURCES & WILDLIFE',description:`${name}. Use the available animation and condition controls to inspect its complete presentation.`}])
]) as Record<ExtraKind,{name:string;category:string;description:string}>;
export const buildingKinds=new Set<string>(['hall','house','market','tower',...Object.keys(buildings)]);
export const animalKinds=new Set<string>(['sheep','deer','wolf','scoutAnimal']);
export {eras} from './ages';
export type Condition='intact'|'construction'|'damaged'|'critical'|'rubble'|'cleared'|'full'|'half'|'depleted'|'dead'|'halfCut'|'stump'|'sinking';
export function clipsFor(kind:string):Clip[]{
  if(kind==='villager'||kind==='villagerFemale')return ['idle','walk','mine','farm','gather','chop','process','fish','build','carry','hunt','attack','die','dead'];
  if(animalKinds.has(kind))return kind==='wolf'||kind==='scoutAnimal'?['idle','walk','flee','attack','die','dead']:['idle','walk','graze','flee','die','dead'];
  if(kind==='cavalry'||kind in riders)return ['idle','walk','attack','die','dead'];
  if(kind==='infantry'||kind in soldiers)return ['idle','walk','attack',...(kind==='medic'?['heal' as Clip]:[]),'die','dead'];
  if(kind==='cannon'||['howitzer','scatterGun','mortar'].includes(kind))return ['fire','walk'];
  if(kind in engines)return ['idle','walk','attack'];
  if(kind==='tradeShip'||kind==='transport'||kind==='fishingBoat')return ['idle'];
  if(kind==='ship'||kind in vessels)return ['idle','attack'];
  if(kind==='fish'||kind==='bird')return ['idle','walk'];
  return [];
}
export function conditionsFor(kind:string):Condition[]{
  if(buildingKinds.has(kind))return ['intact','construction','damaged','critical','rubble','cleared'];
  if(kind==='mine'||kind==='stoneMine')return ['full','half','depleted'];
  if(kind==='tree'||kind==='pine')return ['intact','halfCut','stump','cleared'];
  if(kind==='ship'||kind==='fishingBoat'||kind in vessels)return ['intact','damaged','sinking'];
  return [];
}

function roof(g:T.Group,w:number,d:number,y:number){
  for(const s of [-1,1]){const panel=box(g,w,.13,d*.59,0,y+.48,s*d*.24,C.roof);panel.rotation.x=s*.48;for(let i=0;i<6;i++){const seam=box(g,w,.035,.025,0,y+.97-i*.16,s*i*d/12,C.roof2);seam.rotation.x=s*.48;}}
  beam(g,[-w*.5,y+.99,0],[w*.5,y+.99,0],.07,C.roof2);
}
function room(g:T.Group,w:number,d:number,h:number,x=0,z=0){const p=joint(g,'wing',x,0,z);box(p,w+.25,.22,d+.25,0,.11,0,C.trim);box(p,w,h,d,0,h/2+.2,0,C.stone);roof(p,w+.45,d+.5,h+.2);box(p,.78,1.5,.08,0,.97,d/2+.04,C.wood);for(const xx of [-w*.32,w*.32]){box(p,.50,.68,.08,xx,1.50,d/2+.04,C.trim);box(p,.34,.51,.09,xx,1.50,d/2+.09,C.glass);box(p,.025,.52,.025,xx,1.50,d/2+.15,C.gold);}}
function crate(g:T.Group,x:number,y:number,z:number){box(g,.55,.50,.55,x,y+.25,z,C.wood);for(const dx of [-.2,.2])box(g,.045,.53,.57,x+dx,y+.25,z,C.gold);}
function banner(g:T.Group,x:number,y:number,z:number){beam(g,[x,0,z],[x,y,z],.035,C.gold);box(g,.72,.45,.025,x+.37,y-.28,z,C.cloth);box(g,.74,.035,.03,x+.37,y-.28,z,C.gold);}
function wheel(g:T.Group,x:number,y:number,z:number,r=.48){const p=joint(g,'rollingWheel',x,y,z);const tire=mesh(new T.TorusGeometry(r,.045,6,20),mat(C.dark),p);tire.rotation.y=Math.PI/2;for(let i=0;i<8;i++){const a=i*Math.PI/4;beam(p,[0,0,0],[0,Math.cos(a)*r,Math.sin(a)*r],.025,C.wood);}return p;}
function gun(g:T.Group,x:number,y:number,z:number){const b=cyl(g,.12,.17,1.2,x,y,z,C.dark,16);b.rotation.x=Math.PI/2;cyl(g,.11,.11,.03,x,y-.02,z,'#171f1c',16);}

export function buildBuilding(kind:BuildingKind){
 const g=new T.Group();
 if(kind==='lumberPost'||kind==='miningPost'){
   for(const x of [-1.5,1.5])for(const z of [-.9,.9])box(g,.16,2.1,.16,x,1.05,z,C.wood);roof(g,3.5,2.6,1.9);
   if(kind==='lumberPost')for(let layer=0;layer<3;layer++)for(let i=0;i<4-layer;i++){const log=cyl(g,.15,.16,2.4,-.8+i*.36+layer*.17,.17+layer*.28,0,'#866743',10);log.rotation.x=Math.PI/2;cyl(g,.14,.14,.02,-.8+i*.36+layer*.17,.17+layer*.28,1.21,'#c5a777',10).rotation.x=Math.PI/2;}
   else{for(let i=0;i<4;i++)crate(g,-.8+i*.5,0,-.45);for(let i=0;i<6;i++)ball(g,Math.sin(i)*.6,.2,Math.cos(i)*.4,.2,.22,.18,'#8e9384',0);beam(g,[1.1,.2,.4],[1.1,1.3,.4],.045,C.wood);beam(g,[.8,1.22,.4],[1.4,1.22,.4],.06,C.dark);}
   banner(g,-1.7,2.6,1);
 }else if(kind==='silo'){
   cyl(g,1.15,1.3,3.6,0,1.8,0,'#b6a786',28);cyl(g,0,1.45,1.25,0,4.22,0,C.roof,28);for(const y of [.35,1.35,2.6,3.55])cyl(g,1.17,1.17,.055,0,y,0,C.cloth,28);for(let y=.2;y<3.6;y+=.28)beam(g,[.86,y,.85],[1.18,y,.85],.025,C.wood);for(const x of [.86,1.18])beam(g,[x,0,.85],[x,3.8,.85],.035,C.wood);box(g,.5,.8,.08,0,.4,1.24,C.wood);crate(g,-1.4,0,.7);
 }else if(kind==='dock'||kind==='fishery'){
   for(let i=0;i<24;i++)box(g,4,.12,.25,0,.7,-3+i*.27,C.wood);for(const x of [-1.8,1.8])for(const z of [-2.5,0,2.5])cyl(g,.12,.15,1.8,x,.45,z,C.wood,12);room(g,2,1.8,1.7,-.8,-2);beam(g,[1.3,.7,-1],[1.3,3.4,-1],.08,C.wood);beam(g,[1.3,3.4,-1],[1.3,3.4,1.3],.07,C.wood);beam(g,[1.3,3.4,1.3],[1.3,1.2,1.3],.012,C.dark);for(let i=0;i<3;i++)crate(g,.8,.76,-1.5+i*.7);banner(g,-1.9,3.4,2.5);
 }else if(kind==='wall'||kind==='gate'||kind==='fort'){
   const segment=(x:number,z:number,r=0)=>{const p=joint(g,'wallSegment',x,0,z);p.rotation.y=r;box(p,5,2.3,.7,0,1.15,0,C.stone);for(let i=0;i<7;i++)box(p,.4,.45,.8,-2.2+i*.72,2.5,0,C.trim);};
   if(kind==='wall')segment(0,0);else if(kind==='gate'){segment(-3.5,0);segment(3.5,0);box(g,2,1,.8,0,2.3,0,C.stone);const door=joint(g,'gateDoor',-.94,0,.1);box(door,1.9,1.9,.15,.94,.95,0,C.wood);for(let i=0;i<7;i++)box(door,.05,1.9,.18,i*.29,.95,0,C.dark);}else{for(const x of [-3.5,3.5])for(const z of [-3.5,3.5]){cyl(g,.85,.95,3.6,x,1.8,z,C.stone,8);cyl(g,.98,.98,.24,x,3.65,z,C.trim,8);banner(g,x,4.7,z);}for(const z of [-3.5,3.5])segment(0,z);for(const x of [-3.5,3.5])segment(x,0,Math.PI/2);room(g,3.4,2.5,3,0,-1);}
 }else if(kind==='farm'||kind==='estate'){
   box(g,7,.08,7,0,.04,0,'#756849');for(let row=0;row<10;row++){const x=-3+row*.65;box(g,.12,.06,6.4,x,.1,0,'#8b7550');for(let j=0;j<14;j++){const z=-3+j*.44;if(kind==='farm'){beam(g,[x,.10,z],[x,.60,z],.018,'#baa464');ball(g,x,.67,z,.065,.16,.055,'#d3bd71',0);}else if(j%4===0){beam(g,[x,0,z],[x,1.2,z],.035,C.wood);ball(g,x,1.1,z,.27,.25,.28,'#5e7742',1);ball(g,x+.13,1.12,z+.19,.06,.06,.06,'#ad5240',1);}}}if(kind==='estate')room(g,2.5,2.1,2.4,0,-4.6);
 }else if(kind==='landmark'){
   for(let i=0;i<4;i++)cyl(g,2.8-i*.4,3-i*.4,.35,0,.18+i*.35,0,C.trim,12);cyl(g,.7,1.2,6,0,4.3,0,C.stone,12);cyl(g,1.7,1.4,.35,0,7.5,0,C.gold,12);for(let i=0;i<8;i++){const a=i*Math.PI/4;beam(g,[Math.cos(a)*1.3,7.5,Math.sin(a)*1.3],[Math.cos(a)*1.3,8.7,Math.sin(a)*1.3],.08,C.trim);}cyl(g,0,1.9,1.4,0,9.3,0,C.roof,12);ball(g,0,8.1,0,.5,.6,.5,'#e4bb67',2);
 }else{
   const wide=kind==='stable'||kind==='barracks'||kind==='workshop'||kind==='factory';room(g,wide?5.6:3.6,3.4,kind==='academy'||kind==='temple'?3.6:2.5);
   if(kind==='stable'){for(let i=0;i<3;i++){const x=-1.8+i*1.8;box(g,1.3,1.5,.09,x,1,1.75,C.wood);box(g,1.38,.10,.14,x,1.76,1.78,C.trim);for(let j=0;j<4;j++)beam(g,[x-.55+j*.36,1.8,1.8],[x-.55+j*.36,2.5,1.8],.025,C.dark);}for(const x of [-3,3])beam(g,[x,0,2.2],[x,1.3,2.2],.06,C.wood);beam(g,[-3,1.1,2.2],[3,1.1,2.2],.045,C.wood);}
   if(kind==='archery'){for(const x of [-2,0,2]){beam(g,[x,0,3],[x,1.6,3],.06,C.wood);const target=cyl(g,.42,.42,.09,x,1.4,3,'#dbcc9d',20);target.rotation.x=Math.PI/2;const inner=cyl(g,.23,.23,.10,x,1.4,3.03,C.cloth,20);inner.rotation.x=Math.PI/2;}}
   if(kind==='barracks'||kind==='arsenal'||kind==='mercenaryHall'){for(let i=0;i<5;i++){const x=-1.2+i*.6;beam(g,[x,.1,2.5],[x,2.1,2.5],.025,C.wood);mesh(new T.ConeGeometry(.09,.28,4),mat('#a0aaa3',.4,.6),g,x,2.2,2.5);}beam(g,[-1.5,1.1,2.5],[1.5,1.1,2.5],.06,C.wood);}
   if(kind==='workshop'||kind==='factory'){box(g,.65,5,.65,2.2,2.5,-1,C.stone);box(g,.85,.2,.85,2.2,5,-1,C.trim);box(g,1.5,.75,.9,1.4,.4,2.4,'#616663');const anvil=box(g,.85,.2,.38,1.4,.95,2.4,C.dark);anvil.rotation.y=.2;for(const x of [-1.8,-.8])wheel(g,x,.55,2.6,.52);if(kind==='factory'){room(g,3,3,3.3,-4,-1);for(let i=0;i<3;i++)cyl(g,.15,.15,2,1-i*.6,4,-1,C.dark,12);}}
   if(kind==='academy'||kind==='temple'||kind==='embassy'){for(const x of [-1.4,-.7,.7,1.4])cyl(g,.10,.13,2.6,x,1.3,2.2,C.trim,12);roof(g,3.6,1.4,2.55);if(kind==='temple'){mesh(new T.SphereGeometry(1.25,20,12,0,Math.PI*2,0,Math.PI/2),mat(C.roof),g,0,4.5,0);cyl(g,.2,.3,.8,0,5.6,0,C.gold,12);}}
   if(kind==='tradePost'){for(let i=0;i<5;i++)crate(g,-1+i*.6,0,2.4);banner(g,-2.2,3.4,1.6);}
   banner(g,wide?-2.7:-1.6,3.7,1.8);
 }
 // Explicit authored era overlays retain the same footprint and door locations.
 const base=consolidate(g);base.name=kind;addEraTiers(base);return base;
}
export function addEraTiers(root:T.Group){
 const bounds=new T.Box3().setFromObject(root),size=bounds.getSize(new T.Vector3());
 for(let era=2;era<=5;era++){const tier=joint(root,`era${era}`);tier.userData.era=era;
  if(era===2)for(const x of [-1,1])box(tier,.12,Math.min(size.y,2.6),.14,x*size.x*.43,Math.min(size.y,2.6)/2,size.z*.46,C.wood);
  if(era===3)for(const x of [-1,1])box(tier,.20,.18,size.z*.8,x*size.x*.43,.22,0,C.trim);
  if(era===4){box(tier,size.x*.72,.10,.12,0,Math.min(size.y*.68,2.9),size.z*.47,C.cloth);for(const x of [-1,1])ball(tier,x*size.x*.38,Math.min(size.y*.68,2.9),size.z*.49,.07,.10,.04,C.gold,1);}
  if(era===5){banner(tier,0,size.y+.65,0);box(tier,size.x*.6,.055,.08,0,Math.min(size.y*.70,3),size.z*.48,C.gold);}
  tier.visible=false;
 }
}

function animal(kind:'deer'|'wolf'|'scoutAnimal'){
 const g=new T.Group(),p=joint(g,'animalBody'),deer=kind==='deer',coat=deer?'#967652':kind==='wolf'?'#727b78':'#89674b';g.userData.animal=true;
 oval(p,0,deer?.94:.67,0,deer?.23:.22,deer?.30:.25,deer?.50:.55,coat);const head=joint(p,'animalHead',0,deer?1.43:.91,deer?.43:.50);
 oval(head,0,0,0,.13,.20,.23,coat);oval(head,0,-.07,.22,.095,.09,.20,coat);oval(head,0,-.06,.38,.067,.05,.035,C.dark);
 if(!deer){const jaw=joint(head,'animalJaw',0,-.10,.12);oval(jaw,0,-.035,.14,.09,.035,.18,'#514e46');for(const s of [-1,1])for(let i=0;i<3;i++)mesh(new T.ConeGeometry(.012,.035,5),mat(C.light),jaw,s*.06,-.002,.08+i*.07);}
 for(const s of [-1,1]){const ear=oval(head,s*.11,.22,-.035,.055,.15,.05,coat);ear.rotation.z=s*.30;oval(head,s*.115,.035,.13,.021,.022,.012,'#212a26');if(deer){tube(head,[[s*.08,.20,-.06],[s*.19,.48,-.12],[s*.26,.71,-.17]],.022,'#c0ad88');beam(head,[s*.17,.40,-.1],[s*.32,.56,.06],.019,'#c0ad88',.004);}}
 for(const x of [-.16,.16])for(const z of [-.35,.35]){const leg=joint(p,`animalLeg${x}${z}`,x,deer?.93:.65,z);beam(leg,[0,0,0],[0,deer?-.72:-.46,.03],deer?.035:.047,coat,.025);oval(leg,0,deer?-.81:-.57,.055,.05,.065,.08,C.dark);}
 tube(p,[[0,deer?1:.78,-.43],[0,.77,-.70],[0,.55,-.85]],deer?.045:.085,coat);if(kind==='scoutAnimal')cyl(p,.16,.16,.075,0,.85,.4,C.cloth,16).rotation.x=Math.PI/2;
 const result=finishRig(g);result.name=kind;result.userData.animal=true;return result;
}
function footUnit(kind:keyof typeof soldiers,age=4){
 const rifle=['veteranRifle','marksman','skirmisher'].includes(kind),g=buildPerson(false,false,!rifle,false,age,kind),body=g.getObjectByName('body') as T.Group;
 g.userData.loadout=rifle?'rifle':kind;
 if(!rifle){const held=kind==='archer'||kind==='crossbow'?buildBow(body,kind==='crossbow'):joint(body,'heldWeapon');
   if(kind==='militia'){beam(held,[0,-.12,0],[0,.58,0],.035,C.wood,.055);oval(held,0,.54,0,.08,.13,.075,C.wood);box(body,.30,.37,.045,0,1.2,.17,'#8f805f');g.scale.setScalar(.96);}
   else if(['spearman','pikeman','allianceUnit'].includes(kind)){beam(held,[0,-.35,0],[0,kind==='pikeman'?2.3:1.4,0],.022,C.wood);mesh(new T.OctahedronGeometry(.12),mat('#aeb7ad',.3,.7),held,0,kind==='pikeman'?2.44:1.54,0).scale.set(.45,2,.25);}
   else if(kind==='archer'||kind==='crossbow'){addShot(g,kind==='archer'?'arrow':'bolt',3,1.3);const quiver=joint(body,'quiver',.16,1.3,-.22);cyl(quiver,.07,.07,.32,0,0,0,C.wood,12);for(let i=0;i<5;i++)beam(quiver,[Math.sin(i)*.04,0,Math.cos(i)*.04],[Math.sin(i)*.04,.30,Math.cos(i)*.04],.006,C.light);}
   else if(kind==='grenadier'||kind==='saboteur'){ball(held,0,0,0,.065,.075,.065,C.dark,2);beam(held,[0,.06,0],[.03,.12,0],.009,C.gold);joint(held,'shotOrigin');addShot(g,'grenade',3,1.3);for(const s of [-1,1])ball(body,s*.19,1.04,.15,.045,.055,.045,C.dark,1);}
   else if(kind==='medic'){box(held,.22,.17,.12,0,0,0,C.light);box(held,.13,.025,.015,0,0,.07,C.cloth);box(held,.025,.1,.015,0,0,.07,C.cloth);}
   else if(kind==='engineer'){beam(held,[0,-.15,0],[0,.30,0],.025,C.wood);box(held,.23,.09,.09,0,.31,0,C.dark);}
   else{beam(held,[0,-.12,0],[0,.05,0],.023,C.wood);box(held,.19,.025,.05,0,.06,0,C.gold);const blade=mesh(new T.ConeGeometry(.07,.72,4),mat('#b4bfb7',.27,.8),held,0,.42,0);blade.scale.z=.22;}
   joint(held,'weaponGrip');
   if(['shieldBearer','swordsman','factionGuard','allianceUnit'].includes(kind)){const shield=joint(body,'heldShield');oval(shield,0,0,0,.20,.31,.045,C.cloth);oval(shield,0,0,.035,.08,.08,.025,C.gold);}
 }
 if(['veteranRifle','factionGuard','commander','shieldBearer'].includes(kind)){oval(body,0,1.28,.12,.18,.22,.045,'#717d78');for(const s of [-1,1])oval(body,s*.22,1.46,0,.12,.045,.11,C.gold);}
 // Large silhouette cues remain readable at the normal strategic camera distance.
 if(['commander','factionGuard','contractUnit'].includes(kind)){const cape=joint(body,'mantle',0,1.46,-.14);const cloth=mesh(new T.CylinderGeometry(.20,.35,.68,12,1,true,0,Math.PI),mat(kind==='contractUnit'?'#765b49':C.cloth),cape,0,-.30,-.04);cloth.rotation.y=Math.PI;}
 if(kind==='shieldBearer'){const shield=body.getObjectByName('heldShield');if(shield){shield.scale.set(1.65,1.3,1);box(shield,.36,.55,.045,0,0,0,C.cloth);}}
 if(kind==='pikeman'){for(const side of [-1,1])oval(body,side*.25,1.45,0,.15,.09,.13,'#88938b');cyl(body,.18,.21,.35,0,1.27,0,'#7b8780',12);}
 if(kind==='archer'){const hood=joint(body,'shoulderCowl',0,1.48,0);cyl(hood,.16,.29,.18,0,0,0,C.cloth,12);g.scale.setScalar(.96);}
 if(kind==='crossbow'){oval(body,0,1.27,.13,.20,.24,.065,'#786249');const pavise=joint(body,'backPavise',-.08,1.21,-.25);box(pavise,.45,.77,.07,0,0,0,C.cloth);box(pavise,.05,.78,.09,0,0,0,C.gold);}
 if(kind==='grenadier'){for(const side of [-1,1]){box(body,.15,.21,.10,side*.23,1.07,.10,C.wood);oval(body,side*.23,1.45,0,.13,.065,.13,C.gold);}g.scale.setScalar(1.07);}
 if(kind==='saboteur'){const pack=joint(body,'chargePack',0,1.23,-.23);for(const x of [-.13,0,.13])cyl(pack,.055,.055,.40,x,0,0,'#9e6844',10);box(pack,.42,.07,.16,0,0,0,C.dark);}
 if(kind==='medic'){box(body,.34,.48,.035,0,1.18,.19,C.light);const bag=joint(body,'medicalSatchel',-.26,1.0,0);box(bag,.22,.24,.20,0,0,0,C.light);box(bag,.14,.035,.025,0,0,.11,C.cloth);box(bag,.035,.14,.025,0,0,.11,C.cloth);}
 if(kind==='engineer'){box(body,.30,.48,.04,0,1.13,.20,C.wood);const pack=joint(body,'toolPack',0,1.3,-.24);box(pack,.37,.32,.16,0,0,0,C.wood);beam(pack,[-.24,-.20,0],[.24,.37,0],.03,C.dark);}
 if(kind==='marksman'){g.scale.set( .94,1.04,.94);const cape=joint(body,'shortCape',0,1.45,-.17);box(cape,.48,.38,.045,0,-.18,0,'#6b7952');}
 if(kind==='skirmisher'){g.scale.setScalar(.95);for(const side of [-1,1])box(body,.13,.18,.11,side*.21,1.0,.11,C.wood);}
 if(kind==='allianceUnit'){const shield=body.getObjectByName('heldShield');if(shield){shield.scale.set(1.2,.75,1);cyl(shield,.24,.24,.04,0,0,.03,C.gold,16).rotation.x=Math.PI/2;}}
 return finishRig(g);
}

export function buildExtended(kind:ExtraKind,base:(kind:string)=>T.Group,age=4):T.Group{
 let g:T.Group;
 if(kind in buildings)return buildBuilding(kind as BuildingKind);
 if(kind==='villagerFemale')return buildPerson(true,false,false,true,age);
 if(kind==='deer'||kind==='wolf'||kind==='scoutAnimal')return animal(kind);
 if(kind==='stoneMine')return buildMine(true);
 if(kind==='treeHalfCut')return buildFelledTree(127);
 if(kind==='stump'){g=new T.Group();cyl(g,.24,.34,.46,0,.23,0,'#79644a',12);cyl(g,.23,.23,.015,0,.47,0,'#c4ab7c',12);for(let i=0;i<4;i++){const a=i*Math.PI/2;beam(g,[0,.25,0],[Math.cos(a)*.5,0,Math.sin(a)*.5],.09,'#79644a',.03);}return consolidate(g);}
 if(kind==='logPile'){g=new T.Group();for(let y=0;y<3;y++)for(let i=0;i<4-y;i++){const log=cyl(g,.17,.17,2,i*.36+y*.18,.18+y*.30,0,C.wood,12);log.rotation.x=Math.PI/2;}return consolidate(g);}
 if(kind==='treasure'){g=new T.Group();for(let i=0;i<3;i++)crate(g,(i-1)*.6,0,0);banner(g,-.8,1.5,-.4);return consolidate(g);}
 if(kind==='bird'){g=new T.Group();oval(g,0,0,0,.08,.08,.23,'#dadbcd');for(const s of [-1,1]){const wing=joint(g,`birdWing${s}`);const geo=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute([0,0,.1,s*.7,0,-.1,s*.22,0,-.20],3));geo.computeVertexNormals();const m=mat('#d5d9cd');m.side=T.DoubleSide;mesh(geo,m,wing);}return g;}
 if(kind in soldiers)return footUnit(kind as keyof typeof soldiers,age);
 if(kind in riders){g=buildRider(age);g.userData.mountedRole=kind;const body=g.getObjectByName('body') as T.Group,lance=g.getObjectByName('lance')!;lance.removeFromParent();
  if(kind==='dragoon'){joint(body,'tool').add(rifle());addShot(g,'bullet',3.6,.65);}
  else if(kind!=='mountedScout'){const saber=joint(body,'mountedSaber');beam(saber,[0,-.09,0],[0,.06,0],.024,C.wood);box(saber,.16,.025,.055,0,.06,0,C.gold);tube(saber,[[0,.08,0],[.015,.36,0],[.07,.65,0],[.13,.78,0]],.027,'#bcc6bc');}
  if(kind==='cuirassRider')oval(body,0,1.30,.13,.19,.22,.05,'#8a9690');
  return g;}
 if(['howitzer','scatterGun','mortar'].includes(kind)){g=base('cannon');const b=g.getObjectByName('barrel')!;b.scale.y=kind==='mortar'?.45:kind==='howitzer'?.70:.90;b.scale.x=b.scale.z=kind==='scatterGun'?1.25:1.12;if(kind==='mortar')b.rotation.x=.62;return g;}
 if(kind in vessels){g=base(kind==='sloop'?'fishingBoat':'ship');if(kind==='sloop')g.scale.setScalar(1.5);if(kind==='frigate')g.scale.set(1.15,1.05,1.2);const equip=joint(g,'navalEquipment');
   if(kind==='tradeShip'||kind==='transport')for(let i=0;i<6;i++)crate(equip,(i%2?-.65:.65),.95,-1.4+Math.floor(i/2)*1.1);
   if(kind==='frigate'||kind==='bombardVessel')for(const s of [-1,1])for(let i=0;i<(kind==='frigate'?5:2);i++){const p=joint(equip,'broadside',s*1.25,1.12,-2+i*.90);p.rotation.y=s*Math.PI/2;gun(p,0,0,0);}
   if(kind==='fireCraft')for(let i=0;i<7;i++)cyl(equip,.22,.22,.55,(i%2-.5)*1.1,1.2,-2+i*.55,C.wood,12);
   return g;
 }
 if(kind==='sapperTeam'){g=new T.Group();for(const x of [-.7,.7]){const soldier=footUnit('engineer');soldier.position.x=x;g.add(soldier);}return g;}
 g=new T.Group();const chassis=joint(g,'chassis');for(const x of [-.68,.68])for(const z of [-.8,.8])wheel(chassis,x,.52,z);box(chassis,1.5,.18,2.6,0,.65,0,C.wood);for(const x of [-.7,.7])box(chassis,.08,.46,2.6,x,.94,0,C.cloth);
 if(kind==='rocketCart'){for(let i=0;i<7;i++){const rack=joint(chassis,'rocket',-.5+i*.17,1.2,0);rack.rotation.x=.7;beam(rack,[0,-.45,0],[0,.9,0],.05,C.dark);mesh(new T.ConeGeometry(.055,.16,8),mat(C.gold),rack,0,.99,0);}addShot(g,'rocket',3,.8,[0,1.8,.4]);}
 else if(kind==='siegeTower'){for(const x of [-.65,.65])for(const z of [-1,1])box(chassis,.13,4,.13,x,2.6,z,C.wood);for(const y of [1.8,3,4.5])box(chassis,1.5,.13,2.5,0,y,0,C.wood);roof(chassis,1.9,2.7,4.6);}
 else if(kind==='ramWagon'){roof(chassis,1.8,3,1.7);const assembly=joint(chassis,'ramBeam');const ram=cyl(assembly,.18,.20,3.4,0,1.1,0,C.wood,14);ram.rotation.x=Math.PI/2;ball(assembly,0,1.1,1.8,.22,.22,.23,C.dark,1);}
 else if(kind==='mobileFieldwork'){for(let i=0;i<8;i++)beam(chassis,[-.7+i*.2,.6,1],[-.7+i*.2,1.7,1.5],.045,C.wood,.003);}
 else{for(let i=0;i<4;i++)crate(chassis,(i%2-.5)*.65,.75,-.7+Math.floor(i/2)*.85);if(kind==='builderWagon'){beam(chassis,[-.6,1,.9],[-.6,2.7,-.6],.06,C.wood);beam(chassis,[.6,1,.9],[.6,2.7,-.6],.06,C.wood);for(let i=0;i<6;i++)beam(chassis,[-.6,1+i*.28,.9-i*.25],[.6,1+i*.28,.9-i*.25],.035,C.wood);}}
 banner(chassis,.7,2.3,-1);return finishRig(g);
}
