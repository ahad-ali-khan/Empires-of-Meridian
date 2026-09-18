// Local visual sandbox lifecycle. This does not replace the future authoritative match simulation.
export interface Harvestable {health:number;food:number;state:'alive'|'dead'|'exhausted';}
export function damageAnimal(animal:Harvestable,damage:number){if(animal.state!=='alive')return;animal.health=Math.max(0,animal.health-Math.max(0,damage));if(animal.health===0)animal.state='dead';}
export function collectMeat(animal:Harvestable,amount:number){if(animal.state!=='dead')return 0;const collected=Math.min(animal.food,Math.max(0,amount));animal.food-=collected;if(animal.food===0)animal.state='exhausted';return collected;}
