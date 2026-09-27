import type {Entity,MatchSnapshot} from '../../sim/src/index';
import type {Clip} from '../../asset-tools/src/actors';
export interface RenderIntent{id:number;model:string;x:number;z:number;owner:number;health:number;clip:Clip;selected:boolean}
export function renderIntent(entity:Entity,selected=false):RenderIntent{return {id:entity.id,model:entity.model,x:entity.x/256,z:entity.z/256,owner:entity.owner,health:entity.maxHp?entity.hp/entity.maxHp:1,clip:entity.task==='move'||entity.task==='carry'?'walk':entity.task==='gather'?entity.kind==='worker'?'gather':'idle':entity.task==='build'?'build':entity.task==='attack'?'attack':entity.task==='dead'?'dead':'idle',selected};}
export function visibleIntents(snapshot:MatchSnapshot,selected:Set<number>){return snapshot.entities.map(e=>renderIntent(e,selected.has(e.id)));}
