import type {MatchSnapshot} from '../../../../packages/sim/src/index';
import {coastAt} from '../../../../packages/sim/src/terrain';
import type {AmbientSource} from './audio';

/** A bounded, observed soundscape. Remembered objects never disclose current wildlife or work. */
export function ambientScene(snapshot: MatchSnapshot, camera = {x: 0, z: 0}): AmbientSource[] {
  const animals: AmbientSource[] = [],
    forests = new Map<string, AmbientSource>(),
    water: AmbientSource[] = [];
  for (const e of snapshot.entities) {
    if (e.remembered || e.hp <= 0 || e.task === 'dead' || e.garrisonedIn) continue;
    const x = e.x / 256,
      z = e.z / 256;
    if (e.kind === 'wolf' || e.kind === 'sheep') animals.push({id: `animal:${e.id}`, kind: e.kind, x, z});
    else if ((e.kind === 'timber' && e.amount >= (e.initialAmount ?? e.amount) * 0.5) || e.kind === 'provisions') {
      const cell = `${Math.floor(x / 18)}:${Math.floor(z / 18)}`;
      if (!forests.has(cell)) forests.set(cell, {id: `foliage:${cell}`, kind: 'foliage', x, z});
    } else if (e.kind === 'fish')
      water.push({
        id: `water:${e.id}`,
        kind: x > coastAt(e.z, snapshot.map.size, snapshot.map.seed) / 256 - 3 ? 'shore' : 'water',
        x,
        z,
      });
  }
  // Sample only visible coast cells. A wave can be heard without a fishing ground nearby.
  const shores: AmbientSource[] = [];
  for (let z = 6; z < snapshot.map.size / 256; z += 12) {
    const x = coastAt(Math.round(z * 256), snapshot.map.size, snapshot.map.seed) / 256 - 1,
      cell = Math.floor(z / 4) * snapshot.fogWidth + Math.floor(x / 4);
    if (snapshot.fog[cell] === 2) shores.push({id: `shore:${Math.floor(z / 12)}`, kind: 'shore', x, z});
  }
  const nearest = (a: AmbientSource, b: AmbientSource) =>
    (a.x - camera.x) ** 2 + (a.z - camera.z) ** 2 - ((b.x - camera.x) ** 2 + (b.z - camera.z) ** 2);
  const vegetation = [...forests.values()].sort(nearest).slice(0, 32);
  const birds = vegetation
    .filter((_, i) => i % 2 === 0)
    .map((s): AmbientSource => ({...s, id: s.id.replace('foliage:', 'birds:'), kind: 'birds', y: 4}));
  return [
    ...animals.sort(nearest).slice(0, 24),
    ...shores.sort(nearest).slice(0, 38),
    ...water.sort(nearest).slice(0, 14),
    ...birds,
    ...vegetation,
  ].slice(0, 128);
}
