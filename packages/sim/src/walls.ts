import {landAt, terrainHeight} from './terrain';
import type {Entity, MatchState} from './index';
import {buildingById} from '../../content/src/index';
import type {Resources} from '../../protocol/src/index';
import {halfBounds} from './spatial';

export type WallSpan = {x: number; z: number; dx: number; dz: number};
const WALL_HALF_WIDTH = 160;
type WallState = Pick<MatchState, 'map' | 'entities'>;

export function wallAxis(e: Pick<Entity, 'wallAxis' | 'kind' | 'rotation'>): [number, number] {
  if (e.wallAxis) return e.wallAxis;
  const length = Math.round((buildingById.get(e.kind)?.footprint[0] ?? 2.5) * 512);
  return e.rotation && e.rotation % 2 ? [0, length] : [length, 0];
}
function spanFor(e: Pick<Entity, 'x' | 'z' | 'wallAxis' | 'kind' | 'rotation'>): WallSpan {
  const [dx, dz] = wallAxis(e);
  return {x: e.x, z: e.z, dx, dz};
}
function endpoints(s: WallSpan) {
  return [-1, 1].map((sign) => ({x: Math.round(s.x + (s.dx * sign) / 2), z: Math.round(s.z + (s.dz * sign) / 2)}));
}
function pointDistanceSquared(p: {x: number; z: number}, s: WallSpan) {
  const lengthSquared = s.dx * s.dx + s.dz * s.dz;
  const f = lengthSquared
    ? Math.max(-0.5, Math.min(0.5, ((p.x - s.x) * s.dx + (p.z - s.z) * s.dz) / lengthSquared))
    : 0;
  return (p.x - s.x - f * s.dx) ** 2 + (p.z - s.z - f * s.dz) ** 2;
}
// The preview and command use the same nearest endpoint and integer coordinates.
// Choosing the first point in entity order made clicks jump between nearby walls.
export function snapWallEndpoint(
  state: Pick<MatchState, 'entities'>,
  x: number,
  z: number,
  owner: number,
  radius = 384,
) {
  let result = {x: Math.round(x), z: Math.round(z)},
    nearest = radius * radius + 1;
  for (const e of state.entities) {
    if (e.hp <= 0 || e.owner !== owner || !['wall', 'gate'].includes(e.kind)) continue;
    for (const point of endpoints(spanFor(e))) {
      const distance = (point.x - x) ** 2 + (point.z - z) ** 2;
      if (
        distance <= radius * radius &&
        (distance < nearest ||
          (distance === nearest && (point.x < result.x || (point.x === result.x && point.z < result.z))))
      ) {
        nearest = distance;
        result = point;
      }
    }
  }
  return result;
}

// Separating-axis test against the actual rectangular reserved resource/building
// footprint. No circular 1m substitute for mines, rotated houses or farms.
export function wallIntersectsFootprint(
  span: WallSpan,
  x: number,
  z: number,
  hx: number,
  hz: number,
  padding = WALL_HALF_WIDTH,
) {
  const length = Math.max(1, Math.ceil(Math.hypot(span.dx, span.dz))),
    dx = x - span.x,
    dz = z - span.z;
  if (Math.abs(dx) > Math.abs(span.dx) / 2 + hx + padding || Math.abs(dz) > Math.abs(span.dz) / 2 + hz + padding)
    return false;
  if (
    Math.abs(dx * span.dx + dz * span.dz) >
    (length * length) / 2 + hx * Math.abs(span.dx) + hz * Math.abs(span.dz) + padding * length
  )
    return false;
  return Math.abs(dx * span.dz - dz * span.dx) <= hx * Math.abs(span.dz) + hz * Math.abs(span.dx) + padding * length;
}
function wallConflict(a: WallSpan, b: WallSpan) {
  const aa = a.dx * a.dx + a.dz * a.dz,
    bb = b.dx * b.dx + b.dz * b.dz;
  const cross = a.dx * b.dz - a.dz * b.dx;
  const ae = endpoints(a),
    be = endpoints(b);
  const close =
    ae.some((p) => pointDistanceSquared(p, b) <= 320 ** 2) || be.some((p) => pointDistanceSquared(p, a) <= 320 ** 2);
  if (cross * cross < (aa * bb) / 100) {
    const length = Math.max(1, Math.sqrt(bb));
    const perpendicular = Math.abs((a.x - b.x) * b.dz - (a.z - b.z) * b.dx) / length;
    if (perpendicular > 320) return '';
    const center = ((a.x - b.x) * b.dx + (a.z - b.z) * b.dz) / length;
    const half = Math.abs(a.dx * b.dx + a.dz * b.dz) / length / 2;
    const overlap = Math.min(center + half, length / 2) - Math.max(center - half, -length / 2);
    return overlap > 128 ? 'This wall would overlap an existing wall or gate.' : '';
  }
  const ux = b.x - a.x,
    uz = b.z - a.z;
  const ta = (ux * b.dz - uz * b.dx) / cross,
    tb = (ux * a.dz - uz * a.dx) / cross;
  const crossing = Math.abs(ta) < 0.5 && Math.abs(tb) < 0.5;
  return crossing && !close ? 'Connect to a wall end or corner instead of crossing through it.' : '';
}
function wallLinesTouch(a: WallSpan, b: WallSpan) {
  const cross = a.dx * b.dz - a.dz * b.dx;
  const ux = b.x - a.x,
    uz = b.z - a.z;
  return (
    endpoints(a).some((p) => pointDistanceSquared(p, b) <= 320 ** 2) ||
    endpoints(b).some((p) => pointDistanceSquared(p, a) <= 320 ** 2) ||
    (cross !== 0 &&
      Math.abs((ux * b.dz - uz * b.dx) / cross) <= 0.5 &&
      Math.abs((ux * a.dz - uz * a.dx) / cross) <= 0.5)
  );
}
export function wallPlacementReason(state: WallState, spans: WallSpan[], owner: number) {
  if (!spans.length) return 'Choose a wall line between 1 and 128 world units.';
  for (const span of spans) {
    const terrain = wallTerrainReason(state, span);
    if (terrain) return terrain;
    for (const e of state.entities) {
      if (e.hp <= 0 || e.category === 'unit' || e.category === 'animal' || (e.category === 'resource' && e.amount <= 0))
        continue;
      if (['wall', 'gate'].includes(e.kind)) {
        const old = spanFor(e),
          conflict = wallConflict(span, old);
        if (e.owner === owner) {
          if (conflict) return conflict;
          if (
            e.kind === 'gate' &&
            wallLinesTouch(span, old) &&
            !endpoints(span).some((a) => endpoints(old).some((b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2 <= 320 ** 2))
          )
            return 'Connect to the end of the gate; keep its passage clear.';
          // Joining an owned wall at an end or T junction is intentional.
          continue;
        }
        if (
          conflict ||
          endpoints(span).some((p) => inWall({...e, wallAxis: [old.dx, old.dz]}, p.x, p.z, 320)) ||
          endpoints(old).some((p) => inWall({x: span.x, z: span.z, wallAxis: [span.dx, span.dz]}, p.x, p.z, 320))
        )
          return 'Wall route overlaps another player’s wall or gate.';
      } else {
        const [hx, hz] = halfBounds(e);
        if (wallIntersectsFootprint(span, e.x, e.z, hx, hz)) return 'Wall route overlaps a building or resource.';
      }
    }
  }
  return '';
}
export function wallSpans(x: number, z: number, endX: number, endZ: number): WallSpan[] {
  const dx = endX - x,
    dz = endZ - z,
    length = Math.ceil(Math.hypot(dx, dz));
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
export function inWall(e: Pick<Entity, 'x' | 'z' | 'wallAxis'>, x: number, z: number, padding = WALL_HALF_WIDTH) {
  const [dx, dz] = e.wallAxis ?? [5 * 256, 0],
    length = Math.max(1, Math.ceil(Math.hypot(dx, dz)));
  return (
    Math.abs((x - e.x) * dz - (z - e.z) * dx) <= padding * length &&
    Math.abs((x - e.x) * dx + (z - e.z) * dz) <= length * (length / 2 + padding)
  );
}
export function wallTerrainReason(state: Pick<MatchState, 'map'>, span: WallSpan) {
  const heights: number[] = [],
    length = Math.max(1, Math.hypot(span.dx, span.dz));
  const nx = Math.round((-span.dz / length) * WALL_HALF_WIDTH),
    nz = Math.round((span.dx / length) * WALL_HALF_WIDTH);
  for (let i = -2; i <= 2; i++) {
    const x = span.x + Math.round((span.dx * i) / 4),
      z = span.z + Math.round((span.dz * i) / 4);
    for (const side of [-1, 0, 1])
      if (!landAt(x + side * nx, z + side * nz, state.map.size, state.map.seed))
        return 'Walls need dry, traversable ground across their full width.';
    heights.push(Math.round(terrainHeight(x / 256, z / 256, state.map.size / 256, state.map.seed) * 256));
  }
  return Math.max(...heights) - Math.min(...heights) > 640 ? 'This wall crosses too steep a slope.' : '';
}
export function gateConversionCost(): Resources {
  const gate = buildingById.get('gate')!,
    wall = buildingById.get('wall')!;
  return Object.fromEntries(
    Object.entries(gate.cost).map(([resource, amount]) => [
      resource,
      Math.max(0, amount - wall.cost[resource as keyof Resources]),
    ]),
  ) as Resources;
}
export function gateConversionReason(wall: Entity | undefined, owner: number, age: number, state?: WallState) {
  if (!wall || wall.owner !== owner || wall.hp <= 0 || wall.kind !== 'wall')
    return 'Choose one of your completed wall segments to create a gate.';
  if (wall.progress < 10000) return 'Finish this wall segment before converting it to a gate.';
  if (age < buildingById.get('gate')!.age) return 'Advance to the Classical Age before building a gate.';
  const [dx, dz] = wallAxis(wall);
  if (
    state?.entities.some(
      (e) =>
        e.id !== wall.id &&
        e.hp > 0 &&
        ['wall', 'gate'].includes(e.kind) &&
        wallLinesTouch(spanFor(wall), spanFor(e)) &&
        !endpoints(spanFor(wall)).some((a) =>
          endpoints(spanFor(e)).some((b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2 <= 320 ** 2),
        ),
    )
  )
    return 'Choose a clear wall segment for the gate. Remove any branch crossing its passage first.';
  return dx * dx + dz * dz < (3 * 256) ** 2
    ? 'This segment is too short for a gate. Choose a wall at least 3 world units wide.'
    : '';
}
export function gateWallAt(state: Pick<MatchState, 'entities'>, x: number, z: number, owner: number) {
  return state.entities
    .filter(
      (e) => e.owner === owner && e.kind === 'wall' && e.hp > 0 && inWall({...e, wallAxis: wallAxis(e)}, x, z, 320),
    )
    .sort((a, b) => (a.x - x) ** 2 + (a.z - z) ** 2 - ((b.x - x) ** 2 + (b.z - z) ** 2) || a.id - b.id)[0];
}
