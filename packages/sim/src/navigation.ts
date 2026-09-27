import {buildingById} from '../../content/src/index';
import type {Entity, MatchState} from './index';
import {landAt} from './terrain';
import {inWall} from './walls';
import {halfBounds} from './spatial';
const CELL = 256;
const caches = new WeakMap<
  MatchState,
  Map<number, {key: string; grid: Uint8Array; n: number; tick: number; count: number}>
>();
export function invalidateNavigation(state: MatchState) {
  caches.delete(state);
}
function navigation(state: MatchState, owner = 0) {
  let variants = caches.get(state);
  if (!variants) {
    variants = new Map();
    caches.set(state, variants);
  }
  let cached = variants.get(owner);
  if (cached?.tick === state.tick && cached.count === state.entities.length) return cached;
  const buildings = state.entities.filter(
      (e) =>
        e.hp > 0 &&
        e.category === 'building' &&
        e.kind !== 'farm' &&
        !(e.kind === 'gate' && e.owner === owner && e.progress === 10000),
    ),
    key = buildings.map((e) => e.id + ':' + e.x + ':' + e.z + ':' + e.wallAxis).join('|');
  if (cached?.key === key) {
    cached.tick = state.tick;
    cached.count = state.entities.length;
    return cached;
  }
  const n = Math.ceil(state.map.size / CELL),
    grid = new Uint8Array(n * n);
  for (let z = 0; z < n; z++)
    for (let x = 0; x < n; x++)
      if (!landAt(x * CELL + 128, z * CELL + 128, state.map.size, state.map.seed)) grid[z * n + x] = 1;
  for (const e of buildings) {
    if (e.wallAxis) {
      const radius = Math.ceil(Math.max(Math.abs(e.wallAxis[0]), Math.abs(e.wallAxis[1])) / 2 / CELL) + 2;
      const cx = Math.floor(e.x / CELL),
        cz = Math.floor(e.z / CELL);
      for (let z = Math.max(0, cz - radius); z < Math.min(n, cz + radius + 1); z++)
        for (let x = Math.max(0, cx - radius); x < Math.min(n, cx + radius + 1); x++)
          if (inWall(e, x * CELL + 128, z * CELL + 128, 230)) grid[z * n + x] = 1;
      continue;
    }
    const [hx, hz] = halfBounds(e),
      f: [number, number] = [hx / CELL, hz / CELL];
    for (
      let z = Math.max(0, Math.floor(e.z / CELL - f[1] - 0.5));
      z <= Math.min(n - 1, Math.ceil(e.z / CELL + f[1] + 0.5));
      z++
    )
      for (
        let x = Math.max(0, Math.floor(e.x / CELL - f[0] - 0.5));
        x <= Math.min(n - 1, Math.ceil(e.x / CELL + f[0] + 0.5));
        x++
      )
        if (Math.abs(x * CELL + 128 - e.x) < f[0] * CELL + 100 && Math.abs(z * CELL + 128 - e.z) < f[1] * CELL + 100)
          grid[z * n + x] = 1;
  }
  cached = {key, grid, n, tick: state.tick, count: state.entities.length};
  variants.set(owner, cached);
  return cached;
}
export function blocked(state: MatchState, x: number, z: number, owner = 0) {
  if (!landAt(x, z, state.map.size, state.map.seed)) return true;
  const {grid, n} = navigation(state, owner);
  return grid[Math.floor(z / CELL) * n + Math.floor(x / CELL)] === 1;
}
export function nearestPassable(
  state: MatchState,
  x: number,
  z: number,
  owner = 0,
  reserved = new Set<string>(),
): [number, number] | undefined {
  if (!blocked(state, x, z, owner) && !reserved.has(`${x},${z}`)) return [x, z];
  const cx = Math.floor(x / CELL),
    cz = Math.floor(z / CELL),
    candidates: [number, number, number][] = [];
  for (let radius = 1; radius <= 24; radius++) {
    for (let dz = -radius; dz <= radius; dz++)
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
        const px = (cx + dx) * CELL + 128,
          pz = (cz + dz) * CELL + 128;
        if (!blocked(state, px, pz, owner) && !reserved.has(`${px},${pz}`))
          candidates.push([px, pz, Math.abs(px - x) + Math.abs(pz - z)]);
      }
    if (candidates.length) {
      candidates.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
      return [candidates[0][0], candidates[0][1]];
    }
  }
}
export function clearSegment(state: MatchState, ax: number, az: number, bx: number, bz: number, owner = 0) {
  const steps = Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(bz - az)) / 100);
  for (let i = 1; i <= steps; i++)
    if (blocked(state, Math.trunc(ax + ((bx - ax) * i) / steps), Math.trunc(az + ((bz - az) * i) / steps), owner))
      return false;
  return true;
}
function trafficBlocked(state: MatchState, e: Entity, x: number, z: number) {
  if (e.kind !== 'worker') return false;
  return state.entities.some(
    (other) =>
      other.id !== e.id &&
      other.hp > 0 &&
      !other.garrisonedIn &&
      other.category === 'unit' &&
      other.kind !== 'worker' &&
      other.task !== 'move' &&
      Math.max(Math.abs(x - other.x), Math.abs(z - other.z)) < 220,
  );
}
export function approachRange(e: Entity) {
  const f = buildingById.get(e.kind)?.footprint;
  return f ? Math.ceil(Math.max(...f) * 256) + 250 : e.category === 'resource' ? 620 : 260;
}
export function findPath(state: MatchState, e: Entity, x: number, z: number): [number, number][] {
  // A newly spawned, ungarrisoned, or formation-displaced unit can begin in a
  // cell that became blocked.  Give it a deterministic escape point first;
  // otherwise A* starts inside a solid footprint and has no legal neighbor.
  if (blocked(state, e.x, e.z, e.owner)) {
    const escape = nearestPassable(state, e.x, e.z, e.owner);
    return escape ? [escape] : [];
  }
  const base = navigation(state, e.owner),
    n = base.n,
    grid = base.grid;
  const clear = (ax: number, az: number, bx: number, bz: number) => {
    if (!clearSegment(state, ax, az, bx, bz, e.owner)) return false;
    if (e.kind === 'worker') {
      const steps = Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(bz - az)) / 100);
      for (let i = 1; i <= steps; i++)
        if (trafficBlocked(state, e, Math.trunc(ax + ((bx - ax) * i) / steps), Math.trunc(az + ((bz - az) * i) / steps)))
          return false;
    }
    return true;
  };
  if (clear(e.x, e.z, x, z)) return [[x, z]];
  const sx = Math.floor(e.x / CELL),
    sz = Math.floor(e.z / CELL),
    tx = Math.max(1, Math.min(n - 2, Math.floor(x / CELL))),
    tz = Math.max(1, Math.min(n - 2, Math.floor(z / CELL)));
  const start = sz * n + sx,
    goal = tz * n + tx,
    parent = new Int32Array(n * n).fill(-1),
    cost = new Int32Array(n * n).fill(2147483647),
    closed = new Uint8Array(n * n);
  const h = (id: number) => {
    const dx = Math.abs((id % n) - tx),
      dz = Math.abs(Math.floor(id / n) - tz);
    return 10 * Math.max(dx, dz) + 4 * Math.min(dx, dz);
  };
  const heap: {id: number; score: number}[] = [];
  cost[start] = 0;
  const less = (a: {id: number; score: number}, b: {id: number; score: number}) =>
    a.score < b.score || (a.score === b.score && a.id < b.id);
  const push = (id: number) => {
    heap.push({id, score: cost[id] + h(id)});
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!less(heap[i], heap[p])) break;
      [heap[i], heap[p]] = [heap[p], heap[i]];
      i = p;
    }
  };
  const pop = () => {
    const value = heap[0],
      last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        let c = i * 2 + 1;
        if (c >= heap.length) break;
        if (c + 1 < heap.length && less(heap[c + 1], heap[c])) c++;
        if (!less(heap[c], heap[i])) break;
        [heap[c], heap[i]] = [heap[i], heap[c]];
        i = c;
      }
    }
    return value.id;
  };
  push(start);
  let best = start,
    visits = 0;
  while (heap.length && visits++ < 14000) {
    const id = pop();
    if (closed[id]) continue;
    closed[id] = 1;
    if (h(id) < h(best)) best = id;
    if (id === goal) {
      best = id;
      break;
    }
    const cx = id % n,
      cz = Math.floor(id / n);
    for (const [dx, dz] of [
      [0, -1],
      [-1, 0],
      [1, 0],
      [0, 1],
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      const nx = cx + dx,
        nz = cz + dz;
      if (nx < 1 || nz < 1 || nx >= n - 1 || nz >= n - 1) continue;
      const next = nz * n + nx;
      if (
        closed[next] ||
        grid[next] ||
        trafficBlocked(state, e, nx * CELL + 128, nz * CELL + 128) ||
        (dx && dz && (grid[cz * n + nx] || grid[nz * n + cx]))
      )
        continue;
      const score = cost[id] + (dx && dz ? 14 : 10);
      if (score < cost[next]) {
        cost[next] = score;
        parent[next] = id;
        push(next);
      }
    }
  }
  const path: [number, number][] = [];
  for (let id = best; id !== start && id >= 0; id = parent[id])
    path.push([(id % n) * CELL + 128, Math.floor(id / n) * CELL + 128]);
  path.reverse();
  // The grid route ends at a cell center; finish at the requested world point.
  const last = path.at(-1) ?? [e.x, e.z];
  if (!blocked(state, x, z, e.owner) && clear(last[0], last[1], x, z)) path.push([x, z]);
  const smooth: [number, number][] = [];
  let ax = e.x,
    az = e.z;
  for (let i = 0; i < path.length; ) {
    let j = i;
    while (j + 1 < path.length && clear(ax, az, path[j + 1][0], path[j + 1][1])) j++;
    smooth.push(path[j]);
    [ax, az] = path[j];
    i = j + 1;
  }
  return smooth;
}
