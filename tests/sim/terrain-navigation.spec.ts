import {expect,test} from 'vitest';
import {createMatch} from '../../packages/sim/src/index';
import {findPath,clearSegment} from '../../packages/sim/src/navigation';
import {landAt,inlandWater,cliffAt,terrainHeight} from '../../packages/sim/src/terrain';
test('declared land stays above water and generated maps contain reachable highlands and lakes',()=>{
 let lakes=0,cliffs=0,highland=0;
 for(let z=4;z<256;z+=4)for(let x=4;x<256;x+=4){
  const land=landAt(x*256,z*256,256*256,73),h=terrainHeight(x,z,256,73);
  if(land)expect(h).toBeGreaterThan(0.06);
  if(inlandWater(x*256,z*256,256*256,73)){lakes++;expect(h).toBeLessThan(0);}
  if(cliffAt(x*256,z*256,256*256,73))cliffs++;
  if(land&&h>6)highland++;
 }
 expect(lakes).toBeGreaterThan(10);expect(cliffs).toBeGreaterThan(5);expect(highland).toBeGreaterThan(10);
});
test('twenty map seeds connect opposing starting workers around terrain barriers',()=>{
 for(let seed=1;seed<=20;seed++){
  const s=createMatch({v:1,seed,difficulty:'standard',mode:'skirmish',populationCap:100,gameSpeed:1});
  const from=s.entities.find(e=>e.owner===1&&e.kind==='worker')!,to=s.entities.find(e=>e.owner===2&&e.kind==='worker')!;
  const path=findPath(s,from,to.x,to.z);expect(path.at(-1),`seed ${seed}`).toEqual([to.x,to.z]);
  let x=from.x,z=from.z;for(const [nx,nz] of path){expect(clearSegment(s,x,z,nx,nz)).toBe(true);x=nx;z=nz;}
 }
});
