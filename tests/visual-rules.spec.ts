import {test,expect} from '@playwright/test';
import * as T from 'three';
import {createLayout,canBuild,rawHeight,footprintHeights,overlaps,WATER_LEVEL,random,coast} from '../apps/web/src/game/renderer/layout';
import {buildAsset,assetInfo,type AssetKind} from '../packages/asset-tools/src/models';
import {consolidate,mesh,mat} from '../packages/asset-tools/src/geometry';
import {animateAsset} from '../packages/asset-tools/src/actors';

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
   const deck=model.children.find(o=>o instanceof T.Mesh&&(o.material as T.MeshStandardMaterial).color.getHexString()==='ac9061') as T.Mesh;
   expect(deck).toBeDefined();const normals=deck.geometry.attributes.normal;expect(normals.array.every(Number.isFinite)).toBe(true);for(let i=0;i<normals.count;i++)expect(normals.getY(i)).toBeGreaterThan(.4);
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
