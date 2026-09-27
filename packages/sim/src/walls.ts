import {landAt, terrainHeight} from './terrain';
import type {Entity, MatchState} from './index';
import {buildingById} from '../../content/src/index';

export type WallSpan = {x: number; z: number; dx: number; dz: number};
export function wallPlacementReason(state: Pick<MatchState, 'map' | 'entities'>, spans: WallSpan[], owner: number) {
  if (!spans.length) return 'Choose a wall line between 1 and 128 world units.';
  for (const span of spans) {
    const terrain = wallTerrainReason(state, span);
    if (terrain) return terrain;
    for (const e of state.entities) {
      if (
        e.hp <= 0 ||
        e.category === 'unit' ||
        e.category === 'animal' ||
        (e.category === 'resource' && e.amount <= 0) ||
        (e.owner === owner && ['wall', 'gate'].includes(e.kind))
      )
        continue;
      const footprint = buildingById.get(e.kind)?.footprint ?? [1, 1];
      if (
        inWall(
          {x: span.x, z: span.z, wallAxis: [span.dx, span.dz]},
          e.x,
          e.z,
          Math.ceil(Math.max(...footprint) * 256) + 160,
        )
      )
        return 'Wall route overlaps a building or resource.';
    }
  }
  return '';
}
export function wallSpans(x: number, z: number, endX: number, endZ: number): WallSpan[] {
  const dx = endX - x,
    dz = endZ - z,
    length = Math.ceil(Math.sqrt(dx * dx + dz * dz));
  if (length < 256 || length > 128 * 256) return [];
  const count = Math.ceil(length / (5 * 256));
  return Array.from({length: count}, (_, i) => {
    const ax = x + Math.round((dx * i) / count),
      az = z + Math.round((dz * i) / count);
    const bx = x + Math.round((dx * (i + 1)) / count),
      bz = z + Math.round((dz * (i + 1)) / count);
    return {x: Math.round((ax + bx) / 2), z: Math.round((az + bz) / 2), dx: bx - ax, dz: bz - az};
  });
}
export function inWall(e: Pick<Entity, 'x' | 'z' | 'wallAxis'>, x: number, z: number, padding = 160) {
  const [dx, dz] = e.wallAxis ?? [5 * 256, 0],
    length = Math.max(1, Math.ceil(Math.sqrt(dx * dx + dz * dz)));
  return (
    Math.abs((x - e.x) * dz - (z - e.z) * dx) <= padding * length &&
    Math.abs((x - e.x) * dx + (z - e.z) * dz) <= length * (length / 2 + padding)
  );
}
export function wallTerrainReason(state: Pick<MatchState, 'map'>, span: WallSpan) {
  const heights: number[] = [];
  for (let i = -2; i <= 2; i++) {
    const x = span.x + Math.round((span.dx * i) / 4),
      z = span.z + Math.round((span.dz * i) / 4);
    if (!landAt(x, z, state.map.size, state.map.seed)) return 'Walls need dry, traversable ground.';
    heights.push(Math.round(terrainHeight(x / 256, z / 256, state.map.size / 256, state.map.seed) * 256));
  }
  return Math.max(...heights) - Math.min(...heights) > 640 ? 'This wall crosses too steep a slope.' : '';
}
