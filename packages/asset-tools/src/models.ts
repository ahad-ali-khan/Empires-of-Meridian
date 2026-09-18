import * as T from 'three';
import {C,mat,mesh,box,cyl,ball,beam,tube,joint,finishRig,consolidate} from './geometry';
export {C,mat,mesh,box,cyl,ball,beam,consolidate} from './geometry';
import {buildPerson,buildRider,buildSheep,buildFish,animateAsset} from './actors';
import {buildTree,buildBush,buildMine} from './nature';
import {extraInfo,buildExtended,buildingKinds,type ExtraKind} from './extended';
import {architecture} from './architecture';
import {defaultAge,validateAge} from './ages';
import {addShot} from './combat';
import {buildNaval,navalKinds} from './naval';
export {animateAsset};

// Original Meridian kit. World units are metres; Y is up, building fronts face +Z.
function roof(p:T.Group,w:number,d:number,y:number,rise:number){
  const pos=[-w/2,y,-d/2,w/2,y,-d/2,w/2-.6,y+rise,0,-w/2+.6,y+rise,0, -w/2,y,d/2,-w/2+.6,y+rise,0,w/2-.6,y+rise,0,w/2,y,d/2, -w/2,y,-d/2,-w/2+.6,y+rise,0,-w/2,y,d/2, w/2,y,-d/2,w/2,y,d/2,w/2-.6,y+rise,0];
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex([0,2,1,0,3,2,4,6,5,4,7,6,8,10,9,11,13,12]);g.computeVertexNormals();const m=mat(C.roof);m.side=T.DoubleSide;mesh(g,m,p);
  beam(p,[-w/2+.55,y+rise,0],[w/2-.55,y+rise,0],.12,C.roof2);
  // Raised seams and staggered tiles remain visible at inspection distance.
  for(let side=-1;side<=1;side+=2){for(let row=0;row<7;row++){const f=(row+.5)/7,z=side*d*.5*f,yy=y+rise*(1-f)+.03;const ww=w-1.2*(1-f);beam(p,[-ww/2,yy,z],[ww/2,yy,z],.028,row%2?C.roof2:'#507872');}for(let i=0;i<=Math.floor(w/.48);i++){const x=-w/2+.16+i*.48;beam(p,[x*.88,y+rise+.025,0],[x,y+.03,side*d/2],.018,'#638780');}}
  for(const z of [-d/2,d/2])box(p,w,.18,.17,0,y,z,C.trim);
}
function arch(p:T.Group,x:number,y:number,z:number,w:number,h:number,door=false){
  const s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w/2,h-w/2);s.absarc(0,h-w/2,w/2,0,Math.PI,false);s.lineTo(-w/2,0);
  mesh(new T.ShapeGeometry(s,12),mat(door?C.wood:C.glass,.55),p,x,y,z);
  box(p,w+.14,.12,.18,x,y,z+.035,C.trim);for(const side of [-1,1])box(p,.1,h-w*.45,.15,x+side*(w/2+.055),y+(h-w*.45)/2,z+.03,C.trim);
  const curve=new T.EllipseCurve(0,0,w*.5+.05,w*.5+.05,0,Math.PI,false,0);const pts=curve.getPoints(12).map(v=>new T.Vector3(v.x+x,v.y+y+h-w*.5,z+.03));mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts),16,.065,5,false),mat(C.trim),p);
  if(!door){box(p,.055,h-.1,.05,x,y+h/2,z+.04,C.gold);box(p,w,.05,.05,x,y+h*.5,z+.05,C.gold);}else{for(let i=0;i<5;i++)box(p,.023,h*.7,.02,x-w*.4+i*w*.2,y+h*.35,z+.02,C.dark);ball(p,x+w*.24,y+h*.4,z+.08,.055,.055,.045,C.gold);}
}
function shell(p:T.Group,w:number,h:number,d:number){box(p,w+.5,.35,d+.5,0,.18,0,'#9e9b87');box(p,w,h,d,0,h/2+.3,0,C.stone);box(p,w+.15,.15,d+.15,0,.65,0,C.trim);box(p,w+.2,.2,d+.2,0,h+.28,0,C.light);for(const x of [-w/2,w/2])for(const z of [-d/2,d/2]){box(p,.25,h,.25,x,h/2+.3,z,C.light);for(let y=.5;y<h;y+=.42)box(p,.32,.12,.32,x,y,z,'#b6ac93');}roof(p,w+.7,d+.7,h+.42,h*.38);}
export type AssetKind=ExtraKind|'hall'|'house'|'market'|'tower'|'infantry'|'cavalry'|'cannon'|'ship'|'fishingBoat'|'villager'|'sheep'|'bush'|'berries'|'mine'|'fish'|'tree'|'pine';
export const assetInfo:Record<AssetKind,{name:string,category:string,description:string}>={
 ...extraInfo,
 hall:{name:'Charter Hall',category:'CIVIC ARCHITECTURE',description:'Limestone arcades, a copper cupola and a sea-green charter banner. The civic heart of the Aurelian League.'},
 house:{name:'Harbor Residence',category:'SETTLEMENT ARCHITECTURE',description:'Plastered stone, tiled copper-green roofing, shuttered windows and a sheltered street entrance.'},
 market:{name:'Exchange House',category:'TRADE ARCHITECTURE',description:'A timber-framed covered exchange, striped canvas stalls and hand-built cargo props.'},
 tower:{name:'Coastal Watch',category:'DEFENSIVE ARCHITECTURE',description:'Battered stone walls, projecting timber gallery and a steep watch roof define the frontier silhouette.'},
 infantry:{name:'Charter Fusilier',category:'LINE INFANTRY',description:'A long teal coat, brass-trimmed cap, crossbelt, field pack and full-length rifle. Team color stays on the cloth.'},
 cavalry:{name:'League Lancer',category:'MOUNTED UNIT',description:'A chestnut mount, layered saddle cloth and a pennant-tipped lance give this scout a clear mounted silhouette.'},
 cannon:{name:'Brass Fieldpiece',category:'ARTILLERY',description:'A bronze field gun with fitted barrel bands and two uniformed crew. Watch loading, ramming, recoil and movement.'},
 ship:{name:'Coastal Cutter',category:'NAVAL ARCHITECTURE',description:'A sealed plank hull, raised quarterdeck, cream canvas sails and complete standing rigging.'},
 fishingBoat:{name:'Harbor Fishing Boat',category:'FISHING VESSEL',description:'An open working deck with a small sail, net rack, oars and fish baskets.'},
 villager:{name:'Frontier Worker',category:'CIVILIAN',description:'A plain face with ears, a low straw hat and a teal work apron. Separate two-handed pick and hoe animations.'},
 sheep:{name:'Meadow Sheep',category:'HERD ANIMAL',description:'An articulated grazing sheep with fleece, cloven hooves and a teal collar identifying its owner.'},
 bush:{name:'Coastal Hazel',category:'VEGETATION',description:'A branching shrub with individual leaf sprays and a soft, irregular silhouette.'},
 berries:{name:'Redberry Thicket',category:'PROVISIONS',description:'Clusters of ripe red berries among layered leaves. Reserved resource footprints keep the thicket clear.'},
 mine:{name:'Gold-bearing Outcrop',category:'COIN RESOURCE',description:'Original angular stone with exposed gold deposits. Inspect the full and depleted ore states.'},
 fish:{name:'Silverfin Shoal',category:'FISHING GROUND',description:'One to three silverfin break the surface in intermittent jumps, marking a fishing habitat.'},
 tree:{name:'Coastal Oak',category:'BROADLEAF TREE',description:'A tapered branching trunk with thousands of individual leaves arranged in irregular sprays.'},
 pine:{name:'Frontier Pine',category:'CONIFER TREE',description:'Open radial branches and layered needle sprays, with a narrow wind-shaped crown.'}
};
export function wheel(p:T.Group,x:number,y:number,z:number,r:number){const tire=mesh(new T.TorusGeometry(r,.07,6,18),mat(C.dark),p,x,y,z);tire.rotation.y=Math.PI/2;const rim=mesh(new T.TorusGeometry(r-.09,.055,6,18),mat(C.wood),p,x,y,z);rim.rotation.y=Math.PI/2;beam(p,[x-.13,y,z],[x+.13,y,z],.13,C.gold);for(let i=0;i<10;i++){const a=i*Math.PI/5;beam(p,[x,y,z],[x,y+Math.cos(a)*(r-.10),z+Math.sin(a)*(r-.10)],.035,C.wood);}}
export function buildAsset(kind:AssetKind,age=defaultAge(kind)):T.Group{validateAge(kind,age);if(buildingKinds.has(kind))return architecture(kind,age);if(navalKinds.has(kind))return buildNaval(kind,age);if(kind in extraInfo){const model=buildExtended(kind as ExtraKind,k=>buildAsset(k as AssetKind),age);model.name=kind;return model;}const p=new T.Group();
 if(kind==='infantry'||kind==='villager')return buildPerson(kind==='villager',false,false,false,age);
 if(kind==='cavalry')return buildRider(age);
 if(kind==='sheep')return buildSheep();
 if(kind==='fish')return buildFish();
 if(kind==='bush'||kind==='berries')return buildBush(901,kind==='berries');
 if(kind==='mine')return buildMine();
 if(kind==='tree'||kind==='pine')return buildTree(127,kind==='pine');
 if(kind==='fishingBoat'){
   const stations=[[-2.1,.035],[-1.5,.62],[-.5,.85],[.6,.77],[1.6,.44],[2.15,.015]],v:number[]=[],ix:number[]=[];
   stations.forEach(([z,w])=>{v.push(-w,.48,z,-w*.73,-.05,z,0,-.28,z,w*.73,-.05,z,w,.48,z);});
   for(let i=0;i<stations.length-1;i++)for(let j=0;j<4;j++){const a=i*5+j;ix.push(a,a+1,a+5,a+1,a+6,a+5);}
   const hull=new T.BufferGeometry();hull.setAttribute('position',new T.Float32BufferAttribute(v,3));hull.setIndex(ix);hull.computeVertexNormals();const hm=mat('#6b4f35');hm.side=T.DoubleSide;mesh(hull,hm,p);
   const shape=new T.Shape();stations.forEach(([z,w],i)=>i?shape.lineTo(w,-z):shape.moveTo(w,-z));[...stations].reverse().forEach(([z,w])=>shape.lineTo(-w,-z));const deck=new T.ShapeGeometry(shape);deck.rotateX(-Math.PI/2);mesh(deck,mat('#b4996a'),p,0,.21,0);
   for(const s of [-1,1]){tube(p,stations.map(([z,w])=>[s*w,.49,z]),.042,C.trim);tube(p,stations.map(([z,w])=>[s*w*0.91,.35,z]),.055,C.cloth);}
   for(const z of [-1,.4])box(p,1.25,.08,.30,0,.51,z,'#8b6e47');
   beam(p,[0,.2,-.1],[0,3.7,-.1],.04,C.wood);
   const sail=new T.Shape();sail.moveTo(0,0);sail.lineTo(0,2.8);sail.quadraticCurveTo(1.0,1.4,1.5,0);sail.closePath();const sm=mat('#e9dbc0');sm.side=T.DoubleSide;mesh(new T.ShapeGeometry(sail,12),sm,p,.03,.76,-.1);
   beam(p,[0,.76,-.1],[1.54,.76,-.1],.025,C.wood);
   for(const x of [-.72,.72]){beam(p,[x,.46,-.9],[x*1.55,.34,1.5],.025,C.wood);const blade=box(p,.15,.035,.55,x*1.55,.34,1.5,'#a18658');blade.rotation.y=x*.3;}
   for(const x of [-.38,.32]){cyl(p,.20,.16,.31,x,.42,-1.2,'#9e8255',14);cyl(p,.16,.16,.025,x,.585,-1.2,'#485951',14);}
   for(let i=0;i<8;i++){const f=i/7;tube(p,[[-.65,.5,-.4+f*.9],[-.94,.04,-.4+f*.9],[-.86,-.05,-.4+f*.9]],.007,'#817c58');beam(p,[-.65-f*.25,.5-f*.55,-.4],[-.65-f*.25,.5-f*.55,.5],.007,'#817c58');}
   const result=consolidate(p);result.name=kind;return result;
 }
 if(kind==='hall'){
 shell(p,7,4,4.5);for(const x of [-2.3,0,2.3]){arch(p,x,.38,2.26,1.05,2,true);arch(p,x,2.7,2.27,.7,1.2);}for(const x of [-3.9,3.9]){const wing=new T.Group();shell(wing,2.1,2.8,3.6);arch(wing,0,.6,1.81,.8,1.4);wing.position.x=x;p.add(wing);}
 box(p,3.7,.3,1.4,0,.2,2.8,C.stone);box(p,3.2,.18,1.2,0,.12,3.6,C.trim);
 for(const x of [-1.4,1.4]){cyl(p,.12,.16,2.25,x,1.4,3.05,C.light);cyl(p,.22,.22,.14,x,2.55,3.05,C.trim);}box(p,3.4,.22,1.3,0,2.72,2.85,C.trim);
 cyl(p,1.05,1.13,.22,0,5.98,0,C.trim,8);cyl(p,.76,.76,1.22,0,6.58,0,C.light,8);for(let i=0;i<8;i++){const a=i*Math.PI/4;box(p,.12,.8,.12,Math.sin(a)*.78,6.6,Math.cos(a)*.78,C.trim);}cyl(p,.12,1.15,1.45,0,7.8,0,C.roof,8);ball(p,0,8.58,0,.16,.16,.16,C.gold);beam(p,[0,8.6,0],[0,9.6,0],.035,C.gold);
 const b=box(p,.72,.9,.04,0,3.35,2.36,C.cloth);box(p,.05,.75,.045,b.position.x,3.35,2.39,C.gold);for(const x of [-3,3]){box(p,.4,.65,.4,x,.45,2.9,C.wood);ball(p,x,1,2.9,.42,.47,.42,'#5e7045');}
 }else if(kind==='house'){
 shell(p,3.2,2.4,2.8);arch(p,-.65,.35,1.42,.62,1.6,true);arch(p,.7,1,1.42,.65,.95);for(const x of [.18,1.21])box(p,.28,.95,.09,x,1.48,1.47,C.roof);box(p,.55,1.5,.55,-.8,3.6,-.65,'#b6a88e');box(p,.72,.15,.7,-.8,4.39,-.65,C.trim);box(p,.42,.35,.5,1.9,.3,1.05,C.wood);ball(p,1.85,.7,1.05,.32,.3,.3,'#70804e');
 }else if(kind==='market'){
 shell(p,5,2.5,3.2);for(const x of [-1.5,0,1.5])arch(p,x,.4,1.62,.95,1.65,true);
 for(const x of [-2.7,2.7])beam(p,[x,0,3.2],[x,2.5,3.2],.07,C.wood);
 for(let i=0;i<10;i++){const a=box(p,.55,.06,2,-2.475+i*.55,2.58,2.35,i%2?C.light:C.cloth);a.rotation.x=.16;box(p,.55,.26,.04,-2.475+i*.55,2.28,3.32,i%2?C.light:C.cloth);}
 for(const x of [-1.8,0,1.8]){box(p,1.3,.8,.8,x,.45,2.7,C.wood);for(let j=0;j<4;j++)ball(p,x-.4+j*.25,1,2.7,.15,.15,.15,j%2?'#b88a40':'#869050');}
 }else if(kind==='tower'){
 cyl(p,1.15,1.6,4.5,0,2.25,0,C.stone,8);cyl(p,1.65,1.65,.25,0,4.25,0,C.wood,8);cyl(p,1.4,1.4,1.3,0,4.95,0,C.wood,8);for(let i=0;i<8;i++){const a=i*Math.PI/4;box(p,.18,1.4,.18,Math.sin(a)*1.48,4.95,Math.cos(a)*1.48,C.trim);}cyl(p,0,2.05,2,0,6.6,0,C.roof,8);arch(p,0,.1,1.49,.6,1.65,true);for(const y of [1.8,3])box(p,.2,.55,.1,0,y,1.32,C.dark);
 }else if(kind==='cannon'){
 p.userData.artillery=true;
 addShot(p,'shell',7,5,[0,1.1,1.5]);
 for(const x of [-0.73,0.73]){const pivot=joint(p,`cannonWheel${x}`,x,.65,0);wheel(pivot,0,0,0,.64);}
 beam(p,[-0.85,0.65,0],[0.85,0.65,0],0.09,C.dark);
 for(const x of [-0.38,0.38]){beam(p,[x,0.82,0.3],[x*0.6,0.18,-1.9],0.12,C.wood);box(p,0.16,0.55,0.9,x,0.7,0,C.wood);box(p,0.17,0.09,0.8,x,0.91,0,C.cloth);}
 const barrel=joint(p,'barrel',0,1.1,0.15);barrel.rotation.x=Math.PI/2-0.10;
 const profile=[new T.Vector2(0.12,-0.9),new T.Vector2(0.26,-0.75),new T.Vector2(0.24,-0.3),new T.Vector2(0.19,1.1),new T.Vector2(0.24,1.18),new T.Vector2(0.24,1.32),new T.Vector2(0.13,1.34),new T.Vector2(0.13,0.96)];
 mesh(new T.LatheGeometry(profile,20),mat('#a98950',0.44,0.65),barrel);
 cyl(barrel,.125,.125,.08,0,-.88,0,'#947544',20);ball(barrel,0,-1.02,0,.10,.12,.10,'#a98950',2);
 cyl(barrel,.13,.13,.025,0,.96,0,'#202523',20);
 for(const [y,r] of [[-0.72,0.263],[-0.29,0.242],[0.56,0.211],[1.25,0.242]]){
   const ring=mesh(new T.TorusGeometry(r,0.018,6,20),mat(C.gold,0.4,0.6),barrel,0,y,0);ring.rotation.x=Math.PI/2;ring.name='barrelBand';
 }
 const flash=joint(barrel,'muzzleFlash',0,1.50,0);
 mesh(new T.SphereGeometry(0.13,8,6),new T.MeshBasicMaterial({color:'#ffdc8e',toneMapped:false}),flash,0,0.02,0).scale.y=1.8;
 const loader=buildPerson(false,false,true);loader.name='loader';loader.position.set(-1.15,0,-0.68);loader.rotation.y=Math.PI/2;p.add(loader);
 const ammo=new T.Group();ammo.name='ammo';const ammoMesh=ball(ammo,0,0.03,0.06,0.105,0.105,0.105,'#343e39',2);loader.getObjectByName('hand1')!.add(ammo);
 const rammer=buildPerson(false,false,true);rammer.name='rammer';rammer.position.set(1.23,0,0.46);rammer.rotation.y=-Math.PI/2;p.add(rammer);
 const swab=joint(p,'swab',0,1.25,2.4);beam(swab,[0,0,-0.90],[0,0,0.60],0.025,C.wood);const swabTip=cyl(swab,0.062,0.062,0.16,0,0,-0.90,'#9c9c83',12);swabTip.rotation.x=Math.PI/2;
 const result=finishRig(p);result.name='cannon';return result;
 }else if(kind==='ship'){
 const sections=[[-4.8,.05,.45],[-3.7,1.1,.0],[-2,1.5,-.25],[0,1.6,-.3],[2,1.35,-.1],[3.6,.6,.35],[4.35,.02,.9]];const vertices:number[]=[];const indices:number[]=[];
 for(const [z,w,y] of sections){for(const [xx,yy] of [[-w,1.05+y],[-w*.8,.25+y],[0,-.4+y],[w*.8,.25+y],[w,1.05+y]])vertices.push(xx,yy,z);}
 for(let s=0;s<sections.length-1;s++)for(let j=0;j<4;j++){const a=s*5+j,b=a+5;indices.push(a,b,a+1,b,b+1,a+1);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();const hull=mat('#614834');hull.side=T.DoubleSide;mesh(g,hull,p);
 const deckPositions:number[]=[],deckIndices:number[]=[];sections.forEach(([z,w,y])=>deckPositions.push(-w*.96,.90+y,z,0,.90+y,z,w*.96,.90+y,z));for(let i=0;i<sections.length-1;i++)for(let j=0;j<2;j++){const a=i*3+j;deckIndices.push(a,a+3,a+1,a+1,a+3,a+4);}const dg=new T.BufferGeometry();dg.setAttribute('position',new T.Float32BufferAttribute(deckPositions,3));dg.setIndex(deckIndices);dg.computeVertexNormals();mesh(dg,mat('#ac9061'),p);
 for(const side of [-1,1])for(let i=0;i<sections.length-1;i++){const [z,w,y]=sections[i],[zz,ww,yy]=sections[i+1];beam(p,[w*side,1.15+y,z],[ww*side,1.15+yy,zz],.075,C.gold);beam(p,[w*.9*side,.6+y,z],[ww*.9*side,.6+yy,zz],.070,C.cloth);}
 box(p,2,.9,1.5,0,1.25,-2.8,C.wood);box(p,2.2,.1,1.7,0,1.75,-2.8,C.trim);
 for(const [z,h] of [[-.9,7],[1.65,5.5]]){beam(p,[0,.58,z],[0,h,z],.07,C.wood);beam(p,[-1.9,h-.7,z],[1.9,h-.7,z],.045,C.wood);for(const x of [-1.5,1.5]){beam(p,[0,h,z],[x,1.1,z-1.5],.012,C.pants);beam(p,[0,h,z],[x,1.1,z+1.5],.012,C.pants);}
 const geo=new T.PlaneGeometry(3.7,h*.48,10,10);const a=geo.attributes.position;for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i);a.setZ(i,Math.sin((x/3.7+.5)*Math.PI)*Math.sin((y/(h*.48)+.5)*Math.PI)*.6);}geo.computeVertexNormals();const sail=mat('#e9dbc0');sail.side=T.DoubleSide;mesh(geo,sail,p,0,h-.7-h*.24,z+.04);}
 const ensign=new T.Shape();ensign.moveTo(0,0);ensign.lineTo(0.8,-0.06);ensign.lineTo(0.75,-0.45);ensign.lineTo(0,-0.43);const em=mat(C.cloth);em.side=T.DoubleSide;mesh(new T.ShapeGeometry(ensign),em,p,0,7.08,-0.9);
 beam(p,[0,1.7,3.7],[0,2.6,6],.065,C.wood);beam(p,[0,5.5,1.65],[0,2.6,6],.015,C.pants);
 }
 const result=consolidate(p);result.name=kind;return result;
}
