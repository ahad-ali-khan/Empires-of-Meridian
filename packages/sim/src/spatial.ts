import {buildingById} from '../../content/src/index';
import type {Entity} from './index';

const RESOURCE_HALF: Record<string, [number, number]> = {
  timber: [150, 150],
  provisions: [430, 430],
  coin: [620, 620],
  metal: [620, 620],
  fish: [620, 620],
  treasure: [300, 300],
  sheep: [260, 260],
  deer: [300, 300],
  wolf: [300, 300],
};
export function halfBounds(e: Pick<Entity, 'kind' | 'category' | 'wallAxis' | 'rotation'>): [number, number] {
  if (e.wallAxis) return [Math.ceil(Math.abs(e.wallAxis[0]) / 2) + 150, Math.ceil(Math.abs(e.wallAxis[1]) / 2) + 150];
  const f = e.category === 'building' ? buildingById.get(e.kind)?.footprint : undefined;
  return f
    ? e.rotation && e.rotation % 2
      ? [Math.ceil(f[1] * 256), Math.ceil(f[0] * 256)]
      : [Math.ceil(f[0] * 256), Math.ceil(f[1] * 256)]
    : (RESOURCE_HALF[e.kind] ?? [220, 220]);
}
export function edgeDistance(
  from: Pick<Entity, 'x' | 'z'>,
  target: Pick<Entity, 'x' | 'z' | 'kind' | 'category' | 'wallAxis'>,
) {
  const [hx, hz] = halfBounds(target),
    dx = Math.max(0, Math.abs(from.x - target.x) - hx),
    dz = Math.max(0, Math.abs(from.z - target.z) - hz);
  return Math.ceil(Math.sqrt(dx * dx + dz * dz));
}
const DIRECTIONS: [
  [number, number],
  [number, number],
  [number, number],
  [number, number],
  [number, number],
  [number, number],
  [number, number],
  [number, number],
] = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];
export function perimeterPoint(
  target: Pick<Entity, 'x' | 'z' | 'kind' | 'category' | 'wallAxis'>,
  slot: number,
  gap: number,
) {
  const [hx, hz] = halfBounds(target),
    [sx, sz] = DIRECTIONS[slot % 8];
  return {x: target.x + sx * (hx + gap), z: target.z + sz * (hz + gap)};
}
