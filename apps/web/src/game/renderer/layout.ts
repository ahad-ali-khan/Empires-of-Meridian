// Pure placement rules. Rendering, grass and wave animation cannot change these.
export const SEED=240916;
export const WATER_LEVEL=.06;
export function random(seed=SEED){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
export function coast(z:number){return 24+Math.sin(z*.065)*7+Math.sin(z*.16)*2;}
export function rawHeight(x:number,z:number){const shore=coast(z)-x,inland=Math.min(1,Math.max(0,shore/9));const hills=Math.max(0,-z-19)*.065+Math.max(0,-x-26)*.03;return -1.6+inland*(2.65+Math.sin(x*.13)*Math.cos(z*.13)*.35)+hills*(1.6+Math.sin(x*.11+z*.09))*.7;}
export const roads=[[-40,10,17,10],[-3,10,-3,-34],[15,10,31,22],[-26,-14,10,-14]];
export function roadDistance(x:number,z:number){let d=1e9;for(const [ax,az,bx,bz] of roads){const dx=bx-ax,dz=bz-az,t=Math.min(1,Math.max(0,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));d=Math.min(d,Math.hypot(x-ax-t*dx,z-az-t*dz));}return d;}
export interface Footprint{id:string;x:number;z:number;hx:number;hz:number;y:number;kind:string;rotation:number;}
export function overlaps(a:Pick<Footprint,'x'|'z'|'hx'|'hz'>,b:Pick<Footprint,'x'|'z'|'hx'|'hz'>,margin=0){return Math.abs(a.x-b.x)<a.hx+b.hx+margin&&Math.abs(a.z-b.z)<a.hz+b.hz+margin;}
export function footprintHeights(x:number,z:number,hx:number,hz:number,height=rawHeight){const values:number[]=[];for(let ix=0;ix<=6;ix++)for(let iz=0;iz<=6;iz++)values.push(height(x-hx+ix*hx/3,z-hz+iz*hz/3));return values;}
export function canBuild(x:number,z:number,hx:number,hz:number,reserved:Footprint[],height=rawHeight){const ys=footprintHeights(x,z,hx,hz,height);return Math.min(...ys)>WATER_LEVEL+.32&&Math.max(...ys)-Math.min(...ys)<.65&&!reserved.some(r=>overlaps({x,z,hx,hz},r,1.1));}

export function createLayout(seed=SEED){
  const reserved:Footprint[]=[],buildings:Footprint[]=[],rand=random(seed);
  function reserve(id:string,kind:string,x:number,z:number,hx:number,hz:number,rotation=0){
    // Conservative rotated AABB: all corners and intermediate ground samples pass.
    const c=Math.abs(Math.cos(rotation)),s=Math.abs(Math.sin(rotation)),rx=hx*c+hz*s,rz=hz*c+hx*s;
    let candidate:{x:number;z:number}|undefined;
    for(let ring=0;ring<24&&!candidate;ring++){
      const steps=ring===0?1:ring*8;
      for(let step=0;step<steps;step++){const a=step/steps*Math.PI*2,cx=x+Math.cos(a)*ring*.8,cz=z+Math.sin(a)*ring*.8;
        if(canBuild(cx,cz,rx,rz,reserved)){candidate={x:cx,z:cz};break;}
      }
    }
    if(!candidate)throw new Error(`No valid placement for ${id}`);
    const y=Math.max(...footprintHeights(candidate.x,candidate.z,rx,rz))+.025;
    const p:Footprint={id,kind,...candidate,hx:rx,hz:rz,y,rotation};reserved.push(p);return p;
  }
  const farm=reserve('farm','farm',-35,-1,4.4,6.2);
  const plaza=reserve('plaza','plaza',-3,4,3.8,3.8);
  const definitions:[string,number,number,number,number,number?][]=[['hall',-4,-6,5.4,4.2],['market',-17,4,3,3.5],['house',-17,-6,2.25,1.95],['house',-23,-5,2.25,1.95,.1],['house',-25,3,2.25,1.95,-.15],['house',-14,-20,2.25,1.95],['house',-21,-21,2.25,1.95,.08],['house',5,-13,2.25,1.95,-.2],['house',8,-6,2.25,1.95],['house',8,2,2.25,1.95,-.1],['house',-12,20,2.25,1.95,Math.PI],['house',-20,21,2.25,1.95,Math.PI+.1],['house',-28,19,2.25,1.95,Math.PI],['house',-24,-14,2.25,1.95],['tower',15,-18,2.1,2.1],['tower',-30,-28,2.1,2.1]];
  definitions.forEach(([kind,x,z,hx,hz,r=0],i)=>{const jitter=seed===SEED?0:1.3;buildings.push(reserve(`building-${i}`,kind,x+(rand()-.5)*jitter,z+(rand()-.5)*jitter,hx,hz,r));});
  const mine=reserve('mine','mine',-26,29,3.4,3.7);
  const berries=reserve('berries','berries',-8,31,2.7,2.7);
  const sheep=reserve('pasture','pasture',-39,19,4.2,3.5);
  // The fishing habitat is entirely seaward, with a clearance for boats and waves.
  const fish={x:coast(34)+8,z:34,radius:4.5};
  function height(x:number,z:number){const base=rawHeight(x,z);let closest:Footprint|undefined,edge=Infinity;for(const r of reserved){const d=Math.max(Math.abs(x-r.x)-r.hx,Math.abs(z-r.z)-r.hz);if(d<edge){closest=r;edge=d;}}if(!closest||edge>=1.3)return base;if(edge<=1e-7)return closest.y;const f=1-edge/1.3,smooth=f*f*(3-2*f);return base*(1-smooth)+closest.y*smooth;}
  function allowsDecoration(x:number,z:number,radius:number,shore=false){return (shore||rawHeight(x,z)>WATER_LEVEL+.42)&&!reserved.some(r=>overlaps({x,z,hx:radius,hz:radius},r,.3))&&roadDistance(x,z)>radius+1.5;}
  return {seed,reserved,buildings,farm,plaza,mine,berries,sheep,fish,height,allowsDecoration};
}
export type Layout=ReturnType<typeof createLayout>;
