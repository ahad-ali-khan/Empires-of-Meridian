import {sightFor} from '../../content/src/index';
import type {Entity, MatchState} from './index';
import type {PlayerId} from '../../protocol/src/index';
export const FOG_CELL = 1024;
const sources = new WeakMap<MatchState, {tick: number; count: number; owners: Map<number, Entity[]>}>();
function visionSources(state: MatchState, owner: PlayerId) {
  let cache = sources.get(state);
  if (!cache || cache.tick !== state.tick || cache.count !== state.entities.length) {
    const owners = new Map<number, Entity[]>();
    for (const e of state.entities)
      if (e.owner && e.hp > 0 && !e.garrisonedIn) {
        const list = owners.get(e.owner) ?? [];
        list.push(e);
        owners.set(e.owner, list);
      }
    cache = {tick: state.tick, count: state.entities.length, owners};
    sources.set(state, cache);
  }
  return cache.owners.get(owner) ?? [];
}
export function visibleTo(state: MatchState, owner: PlayerId, target: {x: number; z: number; owner?: number}) {
  if (state.config.fogOfWar === false || target.owner === owner) return true;
  return visionSources(state, owner).some((e) => {
    if (e.owner !== owner || e.hp <= 0 || e.garrisonedIn) return false;
    const range = (e.progress < 10000 ? 5 : sightFor(e.kind, state.players[owner - 1].age)) * 256;
    return (e.x - target.x) ** 2 + (e.z - target.z) ** 2 <= range * range;
  });
}
export function present(state: MatchState, e: Entity) {
  if (e.garrisonedIn) return false;
  if (e.incapacitatedAt !== undefined) return true;
  if (e.category === 'resource')
    return e.amount > 0 || (e.kind === 'timber' && e.stumpSince !== undefined && state.tick - e.stumpSince < 600);
  if (e.category === 'animal') return e.amount > 0 && (e.hp > 0 || state.tick - (e.deathTick ?? 0) < 1800);
  return e.hp > 0 || state.tick - (e.deathTick ?? -9999) < 140;
}
export function updateVision(state: MatchState) {
  const width = Math.ceil(state.map.size / FOG_CELL);
  // Memory eviction is a membership query, not a nearest-entity search. A
  // single index prevents every remembered tree/building from scanning the
  // entire world on each visibility update as explored territory grows.
  const presentIds = new Set(state.entities.filter((e) => e.hp > 0 && present(state, e)).map((e) => e.id));
  for (const owner of state.players.map((p) => p.id)) {
    const fog = state.fog[owner - 1];
    for (let i = 0; i < width * width; i++) fog[i] = fog[i] ? 1 : 0;
    if (state.config.fogOfWar === false) fog.fill(2);
    else
      for (const e of state.entities) {
        if (e.owner !== owner || e.hp <= 0 || e.garrisonedIn) continue;
        const radius = (e.progress < 10000 ? 5 : sightFor(e.kind, state.players[owner - 1].age)) * 256;
        const cx = Math.floor(e.x / FOG_CELL),
          cz = Math.floor(e.z / FOG_CELL),
          r = Math.ceil(radius / FOG_CELL);
        for (let z = Math.max(0, cz - r); z <= Math.min(width - 1, cz + r); z++)
          for (let x = Math.max(0, cx - r); x <= Math.min(width - 1, cx + r); x++) {
            if (
              (x * FOG_CELL + FOG_CELL / 2 - e.x) ** 2 + (z * FOG_CELL + FOG_CELL / 2 - e.z) ** 2 <=
              (radius + FOG_CELL / 2) ** 2
            )
              fog[z * width + x] = 2;
          }
      }
    const memory = state.knowledge[owner - 1];
    const remembered: Entity[] = [];
    for (const e of state.entities) {
      if (
        (e.category === 'building' || e.category === 'resource' || e.category === 'treasure') &&
        visibleTo(state, owner, e)
      ) {
        if (present(state, e) && e.hp > 0) remembered.push(e);
        else delete memory[e.id];
      }
    }
    // Batch the copy once per player while keeping remembered values detached
    // from authoritative entities (including nested paths/cargo/orders).
    for (const e of structuredClone(remembered)) memory[e.id] = {...e, remembered: true, queue: []};
    for (const [id, e] of Object.entries(memory))
      if (visibleTo(state, owner, e) && !presentIds.has(Number(id))) delete memory[Number(id)];
  }
}
export function observedEntities(state: MatchState, owner: PlayerId) {
  const entities = new Map<number, Entity>();
  for (const e of Object.values(state.knowledge[owner - 1]))
    if (e.owner !== owner) entities.set(e.id, {...e, remembered: true});
  for (const e of state.entities)
    if (present(state, e) && visibleTo(state, owner, e)) entities.set(e.id, {...e, remembered: false});
  return [...entities.values()].sort((a, b) => a.id - b.id);
}
