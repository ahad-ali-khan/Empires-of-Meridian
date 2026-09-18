import {test,expect} from '@playwright/test';
import * as T from 'three';
import {createLayout,canBuild,rawHeight,footprintHeights,overlaps,WATER_LEVEL,random,coast} from '../apps/web/src/game/renderer/layout';
import {buildAsset,assetInfo,type AssetKind} from '../packages/asset-tools/src/models';
import {consolidate,mesh,mat} from '../packages/asset-tools/src/geometry';
import {animateAsset} from '../packages/asset-tools/src/actors';
import {setResourceLevel} from '../packages/asset-tools/src/nature';
import {clipsFor} from '../packages/asset-tools/src/extended';
import {eras,agesFor,militiaUpgrade} from '../packages/asset-tools/src/ages';
import {applyCondition} from '../packages/asset-tools/src/presentation';

test('rifle hands track authored grips across aiming and reload',()=>{
 for(const kind of ['infantry','veteranRifle'] as const){const model=buildAsset(kind);
 for(const clip of ['idle','walk','attack'] as const)for(let i=0;i<36;i++){
  animateAsset(model,i*.1,clip);model.updateMatrixWorld(true);
  for(const [side,name] of [[1,'triggerGrip'],[-1,'foreGrip']] as const){const hand=model.getObjectByName(`hand${side}`)!.getWorldPosition(new T.Vector3()),grip=model.getObjectByName(name)!.getWorldPosition(new T.Vector3());expect(hand.distanceTo(grip),`${kind} ${clip} ${i} ${name}`).toBeLessThan(.015);}
 }}
});
test('mounted boots fit stirrups and hands reach reins and attack grip',()=>{
 const model=buildAsset('cavalry');
 for(const clip of ['idle','walk','attack'] as const)for(let i=0;i<12;i++){
  animateAsset(model,i*.2,clip);model.updateMatrixWorld(true);
  for(const side of [-1,1]){const foot=model.getObjectByName(`foot${side}`)!.getWorldPosition(new T.Vector3()),stirrup=model.getObjectByName(`stirrup${side}`)!.getWorldPosition(new T.Vector3());expect(foot.distanceTo(stirrup)).toBeLessThan(.10);
   const target=clip==='attack'&&side===1?'lanceGrip':`reinGrip${side}`;expect(model.getObjectByName(`hand${side}`)!.getWorldPosition(new T.Vector3()).distanceTo(model.getObjectByName(target)!.getWorldPosition(new T.Vector3()))).toBeLessThan(.015);
  }
 }
});
test('resource depletion removes whole rock chunks and idle workers hide tools',()=>{
 for(const kind of ['mine','stoneMine'] as const){const root=buildAsset(kind);setResourceLevel(root,50);expect(root.children.filter(o=>o.visible)).toHaveLength(6);setResourceLevel(root,0);expect(root.children.filter(o=>o.visible)).toHaveLength(0);setResourceLevel(root,100);expect(root.children.filter(o=>o.visible)).toHaveLength(12);}
 for(const kind of ['villager','villagerFemale'] as const){const root=buildAsset(kind);for(const clip of clipsFor(kind)){animateAsset(root,1,clip);root.updateMatrixWorld(true);root.traverse(o=>expect(o.matrixWorld.elements.every(Number.isFinite),`${kind} ${clip}`).toBe(true));}animateAsset(root,1,'idle');for(const name of ['pickTool','hoeTool','axeTool','knifeTool','hammerTool','castNet','basket'])expect(root.getObjectByName(name)!.visible,name).toBe(false);}
});

test('custom geometry without UVs survives the same batch as primitives',()=>{
 const root=new T.Group(),material=mat('#436865');
 const custom=new T.BufferGeometry();custom.setAttribute('position',new T.Float32BufferAttribute([0,3,0,1,3,0,0,3,1],3));custom.computeVertexNormals();
 mesh(custom,material,root);mesh(new T.BoxGeometry(1,1,1),material,root);
 const result=consolidate(root),merged=result.children[0] as T.Mesh;
 expect(result.children).toHaveLength(1);expect(merged.geometry.index!.count).toBe(39);expect(merged.geometry.attributes.position.count).toBe(27);
 expect(new T.Box3().setFromObject(result).max.y).toBe(3);
});

test('100 seeded layouts keep full building footprints dry and reservations disjoint',()=>{
 for(let seed=240916;seed<241016;seed++){
  const layout=createLayout(seed);
  for(const r of layout.reserved){
   const terrain=footprintHeights(r.x,r.z,r.hx,r.hz,rawHeight);
   expect(Math.min(...terrain),r.id).toBeGreaterThan(WATER_LEVEL+.32);
   expect(Math.max(...terrain)-Math.min(...terrain),r.id).toBeLessThan(.65);
   expect(footprintHeights(r.x,r.z,r.hx,r.hz,layout.height).every(y=>Math.abs(y-r.y)<1e-7)).toBe(true);
   expect(layout.reserved.every(other=>other===r||!overlaps(r,other))).toBe(true);
  }
  expect(layout.allowsDecoration(layout.farm.x,layout.farm.z,1.9,true)).toBe(false);
  expect(layout.allowsDecoration(layout.farm.x+layout.farm.hx+.5,layout.farm.z,1.9,true)).toBe(false);
  expect(layout.allowsDecoration(layout.plaza.x,layout.plaza.z,.1)).toBe(false);
  const rand=random(seed);let valid=true;for(let n=0;n<500;n++){const x=rand()*130-65,z=rand()*130-65;if(layout.allowsDecoration(x,z,2.6,true))valid&&=layout.reserved.every(r=>!overlaps({x,z,hx:2.6,hz:2.6},r));}expect(valid).toBe(true);
  for(let i=0;i<24;i++){const a=i/24*Math.PI*2,x=layout.fish.x+Math.cos(a)*layout.fish.radius,z=layout.fish.z+Math.sin(a)*layout.fish.radius;expect(x).toBeGreaterThan(coast(z));}
 }
 expect(createLayout(240917).buildings).toEqual(createLayout(240917).buildings);
});

test('placement rejects shallow corners, excessive slope, and occupied land',()=>{
 expect(canBuild(20,-18,2.1,2.1,[])).toBe(false);
 expect(canBuild(0,0,2,2,[],(x,z)=>x>1.8&&z>1.8?-.1:1)).toBe(false);
 expect(canBuild(0,0,2,2,[],x=>x+5)).toBe(false);
 const layout=createLayout();const farm=layout.farm;
 expect(canBuild(farm.x,farm.z,1,1,layout.reserved)).toBe(false);
});

test('all model factories contain finite meshes; ship deck faces upward',()=>{
 for(const kind of Object.keys(assetInfo) as AssetKind[]){
  const model=buildAsset(kind);let vertices=0;
  model.traverse(o=>{if(o instanceof T.Mesh){const a=o.geometry.attributes.position;vertices+=a.count;expect(a.array.every(Number.isFinite),kind).toBe(true);}});
  expect(vertices,kind).toBeGreaterThan(24);
  if(kind==='ship'){
   let deck:T.Mesh|undefined;model.traverse(o=>{if(o instanceof T.Mesh&&(o.material as T.MeshStandardMaterial).color?.getHexString()==='ac9061')deck=o;});
   expect(deck).toBeDefined();const normals=deck!.geometry.attributes.normal;expect(normals.array.every(Number.isFinite)).toBe(true);for(let i=0;i<normals.count;i++)expect(normals.getY(i)).toBeGreaterThan(.4);
  }
 }
});

test('walking, gathering, riding, grazing, and swimming change articulated joints',()=>{
 for(const [kind,joint,clip] of [['infantry','leg1','walk'],['villager','arm1','mine'],['villager','arm1','farm'],['cavalry','horseLeg0.240.51','walk'],['sheep','sheepHead','work'],['fish','fishTail','walk']] as const){
  const model=buildAsset(kind);const limb=model.getObjectByName(joint)!;expect(limb,joint).toBeDefined();
  animateAsset(model,.1,clip);const before=limb.quaternion.clone();animateAsset(model,.4,clip);expect(before.equals(limb.quaternion)).toBe(false);
  animateAsset(model,.4,clip);const frozen=limb.quaternion.clone();animateAsset(model,.4,clip);expect(frozen.equals(limb.quaternion)).toBe(true);
 }
});

test('worker hands remain on their tools throughout distinct mining and farming cycles',()=>{
 const worker=buildAsset('villager'),tool=worker.getObjectByName('workTool')!;
 for(const clip of ['mine','farm'] as const)for(let i=0;i<24;i++){
  animateAsset(worker,i*.1,clip);worker.updateMatrixWorld(true);
  for(const side of [-1,1]){
   const hand=worker.getObjectByName(`hand${side}`)!.getWorldPosition(new T.Vector3());
   const grip=tool.localToWorld(new T.Vector3(0,side===1?-.10:.12,0));
   expect(hand.distanceTo(grip),`${clip} t=${i*.1} hand=${side}`).toBeLessThan(.015);
  }
  expect(worker.getObjectByName('pickTool')!.visible).toBe(clip==='mine');
  expect(worker.getObjectByName('hoeTool')!.visible).toBe(clip==='farm');
 }
});

test('cannon crew approach the muzzle, ram, then stand clear for firing',()=>{
 const cannon=buildAsset('cannon'),loader=cannon.getObjectByName('loader')!,rammer=cannon.getObjectByName('rammer')!;
 animateAsset(cannon,1.5,'fire');expect(loader.position.z).toBeCloseTo(1.99);
 animateAsset(cannon,3.2,'fire');expect(rammer.position.z).toBeCloseTo(2.35);expect(cannon.getObjectByName('swab')!.visible).toBe(true);
 animateAsset(cannon,5.05,'fire');expect(cannon.getObjectByName('swab')!.visible).toBe(false);expect(cannon.getObjectByName('muzzleFlash')!.visible).toBe(true);
 expect(loader.position.z).toBeLessThan(0);expect(rammer.position.z).toBeLessThan(1);
});

test('four-age roster enforces unlocks and authored structural variants',()=>{
 expect(eras).toEqual(['Stone','Classical','Medieval','Industrial']);
 expect(agesFor('fort')).toEqual([3,4]);expect(agesFor('infantry')).toEqual([4]);
 expect(()=>buildAsset('fort',2)).toThrow();expect(()=>buildAsset('hall',5)).toThrow();
 for(const kind of ['house','barracks','stable','silo','dock','market','fort','tradeShip','transport','wall','gate'] as const){
  const signatures=agesFor(kind).map(age=>{const g=buildAsset(kind,age);let count=0;g.traverse(o=>{if(o instanceof T.Mesh)count+=o.geometry.attributes.position.count;});return count;});
  expect(new Set(signatures).size,kind).toBe(signatures.length);
 }
 const dock=buildAsset('dock');expect(dock.getObjectByName('harborWarehouse')).toBeDefined();expect(dock.getObjectByName('cargoCrane')).toBeDefined();
 const male=buildAsset('villager'),female=buildAsset('villagerFemale');expect(female.scale.y).toBeLessThan(male.scale.y);
});

test('militia progression and building scale preserve their distinct roles',()=>{
 expect(agesFor('barracks')).toContain(1);expect(agesFor('militia')).toContain(1);expect(militiaUpgrade).toMatchObject({from:'militia',to:'swordsman',age:2,building:'barracks'});
 expect(buildAsset('barracks',1).getObjectByName('trainingShelter')).toBeDefined();
 const size=(kind:AssetKind,age:number)=>new T.Box3().setFromObject(buildAsset(kind,age)).getSize(new T.Vector3());
 const house=size('house',3),hall=size('hall',3),watch=size('tower',3),fort=size('fort',3);
 expect(hall.x).toBeGreaterThan(house.x*1.8);expect(watch.y).toBeGreaterThan(house.y*1.8);expect(fort.x).toBeGreaterThan(hall.x*1.4);expect(fort.y).toBeGreaterThan(watch.y);
 const model=buildAsset('house',3),original=new Map<T.Mesh,number>();model.traverse(o=>{if(o instanceof T.Mesh)original.set(o,o.geometry.index!.count);});applyCondition(model,'house','critical');for(const [mesh,count]of original)expect(mesh.geometry.index!.count).toBe(count);
});

test('hunter uses ranged weapons by age and releases visible projectiles',()=>{
 for(const age of [1,2,3,4]){const worker=buildAsset('villager',age);expect(worker.userData.loadout).toBe(age<3?'archer':'crossbow');
  animateAsset(worker,1.45,'hunt');expect(worker.getObjectByName('heldWeapon')!.visible).toBe(true);expect(worker.getObjectByName('workTool')!.visible).toBe(false);expect(worker.getObjectByName('projectile')!.visible).toBe(true);
  animateAsset(worker,0,'idle');expect(worker.getObjectByName('heldWeapon')!.visible).toBe(false);
 }
 for(const kind of ['archer','crossbow','grenadier','infantry','cannon','frigate'] as const){const model=buildAsset(kind),shot=model.userData.shot;expect(shot,kind).toBeDefined();animateAsset(model,shot.release+.15,kind==='cannon'?'fire':'attack');expect(model.getObjectByName('projectile')!.visible,kind).toBe(true);}
});

test('damage retains drawable building structure and clear removes it',()=>{
 for(const state of ['construction','damaged','critical'] as const){const model=buildAsset('fort',3);applyCondition(model,'fort',state);let visibleTriangles=0;model.traverseVisible(o=>{if(o instanceof T.Mesh){expect(Array.isArray(o.material)).toBe(false);visibleTriangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});expect(visibleTriangles).toBeGreaterThan(100);}
 const model=buildAsset('dock');applyCondition(model,'dock','cleared');expect(model.visible).toBe(false);
});

test('death falls in different directions and the felled crown reaches the ground',()=>{
 const left=buildAsset('deer'),right=buildAsset('deer');left.userData.deathDirection=0;right.userData.deathDirection=Math.PI;animateAsset(left,1,'dead');animateAsset(right,1,'dead');expect(left.getObjectByName('animalBody')!.quaternion.dot(right.getObjectByName('animalBody')!.quaternion)).toBeCloseTo(0);
 const tree=buildAsset('treeHalfCut');animateAsset(tree,2,'idle');expect(tree.getObjectByName('fallenCrown')!.rotation.z).toBeCloseTo(Math.PI/2);
});

test('bow and crossbow hands follow their grips through release',()=>{
 for(const kind of ['archer','crossbow'] as const){const model=buildAsset(kind);for(let t=0;t<3;t+=.1){animateAsset(model,t,'attack');model.updateMatrixWorld(true);for(const [side,grip] of (kind==='archer'?[[-1,'bowGrip'],[1,'drawGrip']]:[[1,'bowGrip'],[-1,'supportGrip']]) as [number,string][]){expect(model.getObjectByName(`hand${side}`)!.getWorldPosition(new T.Vector3()).distanceTo(model.getObjectByName(grip)!.getWorldPosition(new T.Vector3())),`${kind} ${grip} ${t}`).toBeLessThan(.025);}}}
});

test('net reaches its authored water target and rejects unreachable casts',()=>{
 const worker=buildAsset('villager');worker.position.set(4,1,2);worker.rotation.y=.7;worker.userData.fishingTarget=[6,.08,4];animateAsset(worker,3,'fish');worker.updateMatrixWorld(true);expect(worker.getObjectByName('castNet')!.getWorldPosition(new T.Vector3()).distanceTo(new T.Vector3(6,.08,4))).toBeLessThan(.01);
 worker.userData.fishingTarget=[100,.08,4];animateAsset(worker,3,'fish');expect(worker.getObjectByName('castNet')!.visible).toBe(false);
});
