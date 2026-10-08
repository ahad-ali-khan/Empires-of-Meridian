import {buildingById} from '../../content/src/index';
import type {Entity, MatchState} from './index';
import {landAt} from './terrain';
import {inWall} from './walls';
import {halfBounds} from './spatial';
const CELL = 256;
const DIRECTIONS = [
  [0, -1],
  [-1, 0],
  [1, 0],
  [0, 1],
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
] as const;
// Immutable terrain is shared by replays/matches using the same recipe. Keep
// this derived cache bounded; dynamic building blockers always get a copy.
const sharedTerrainGrids = new Map<string, Uint8Array>();
const caches = new WeakMap<
  MatchState,
  Map<number, {key: string; grid: Uint8Array; n: number; tick: number; count: number}>
>();
const terrainGrids = new WeakMap<MatchState, {size: number; seed: number; grid: Uint8Array}>();
// Searches are synchronous and ordered by simulation entity ID. Reusing their
// scratch storage removes large typed-array and heap-object allocations from
// movement ticks without sharing authoritative paths or changing tie-breaking.
const searchScratch = new WeakMap<
  MatchState,
  {n: number; parent: Int32Array; cost: Int32Array; closed: Uint8Array; heapIds: number[]; heapScores: number[]}
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
  const n = Math.ceil(state.map.size / CELL);
  let terrain = terrainGrids.get(state);
  if (!terrain || terrain.size !== state.map.size || terrain.seed !== state.map.seed) {
    const terrainKey = `${state.map.seed}:${state.map.size}`;
    let base = sharedTerrainGrids.get(terrainKey);
    if (!base) {
      base = new Uint8Array(n * n);
      const {size, seed} = state.map;
      for (let z = 0; z < n; z++) {
        const pz = z * CELL;
        for (let x = 0; x < n; x++) {
          const px = x * CELL;
          if (
            !landAt(px + 128, pz + 128, size, seed) ||
            !landAt(px + 16, pz + 16, size, seed) ||
            !landAt(px + 240, pz + 16, size, seed) ||
            !landAt(px + 16, pz + 240, size, seed) ||
            !landAt(px + 240, pz + 240, size, seed)
          )
            base[z * n + x] = 1;
        }
      }
      if (sharedTerrainGrids.size >= 8) sharedTerrainGrids.delete(sharedTerrainGrids.keys().next().value!);
      sharedTerrainGrids.set(terrainKey, base);
    }
    terrain = {size: state.map.size, seed: state.map.seed, grid: base};
    terrainGrids.set(state, terrain);
  }
  const grid = terrain.grid.slice();
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
// Connected ground is computed once per objective search instead of running
// an A* search for every rejected placement candidate. Four-way adjacency
// preserves the navigation rule against cutting diagonally through corners.
export function reachableGround(state: MatchState, starts: {x: number; z: number}[]) {
  const {grid, n} = navigation(state);
  const cells = new Uint8Array(grid.length);
  const queue = new Int32Array(grid.length);
  const origins = starts.map((p) => nearestPassable(state, p.x, p.z));
  const first = origins[0];
  if (!first) return {cells, n};
  const start = Math.floor(first[1] / CELL) * n + Math.floor(first[0] / CELL);
  let head = 0,
    tail = 1;
  queue[0] = start;
  cells[start] = 1;
  const visit = (next: number) => {
    if (grid[next] || cells[next]) return;
    cells[next] = 1;
    queue[tail++] = next;
  };
  while (head < tail) {
    const id = queue[head++],
      x = id % n,
      z = Math.floor(id / n);
    if (x > 0) visit(id - 1);
    if (x < n - 1) visit(id + 1);
    if (z > 0) visit(id - n);
    if (z < n - 1) visit(id + n);
  }
  if (origins.some((p) => !p || !cells[Math.floor(p[1] / CELL) * n + Math.floor(p[0] / CELL)])) cells.fill(0);
  return {cells, n};
}
export function blocked(state: MatchState, x: number, z: number, owner = 0) {
  if (x < CELL || z < CELL || x >= state.map.size || z >= state.map.size - CELL) return true;
  const {grid, n} = navigation(state, owner);
  return grid[Math.floor(z / CELL) * n + Math.floor(x / CELL)] === 1 || !landAt(x, z, state.map.size, state.map.seed);
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
  const clear = (ax: number, az: number, bx: number, bz: number) => clearSegment(state, ax, az, bx, bz, e.owner);
  if (clear(e.x, e.z, x, z)) return [[x, z]];
  const sx = Math.floor(e.x / CELL),
    sz = Math.floor(e.z / CELL),
    tx = Math.max(1, Math.min(n - 2, Math.floor(x / CELL))),
    tz = Math.max(1, Math.min(n - 2, Math.floor(z / CELL)));
  let scratch = searchScratch.get(state);
  if (!scratch || scratch.n !== n) {
    scratch = {
      n,
      parent: new Int32Array(n * n),
      cost: new Int32Array(n * n),
      closed: new Uint8Array(n * n),
      heapIds: [],
      heapScores: [],
    };
    searchScratch.set(state, scratch);
  }
  const start = sz * n + sx,
    goal = tz * n + tx,
    {parent, cost, closed, heapIds, heapScores} = scratch;
  parent.fill(-1);
  cost.fill(2147483647);
  closed.fill(0);
  heapIds.length = 0;
  heapScores.length = 0;
  const h = (id: number) => {
    const dx = Math.abs((id % n) - tx),
      dz = Math.abs(Math.floor(id / n) - tz);
    return 10 * Math.max(dx, dz) + 4 * Math.min(dx, dz);
  };
  cost[start] = 0;
  const less = (a: number, b: number) =>
    heapScores[a] < heapScores[b] || (heapScores[a] === heapScores[b] && heapIds[a] < heapIds[b]);
  const swap = (a: number, b: number) => {
    const id = heapIds[a],
      score = heapScores[a];
    heapIds[a] = heapIds[b];
    heapScores[a] = heapScores[b];
    heapIds[b] = id;
    heapScores[b] = score;
  };
  const push = (id: number) => {
    heapIds.push(id);
    heapScores.push(cost[id] + h(id));
    let i = heapIds.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!less(i, p)) break;
      swap(i, p);
      i = p;
    }
  };
  const pop = () => {
    const value = heapIds[0],
      lastId = heapIds.pop()!,
      lastScore = heapScores.pop()!;
    if (heapIds.length) {
      heapIds[0] = lastId;
      heapScores[0] = lastScore;
      let i = 0;
      for (;;) {
        let c = i * 2 + 1;
        if (c >= heapIds.length) break;
        if (c + 1 < heapIds.length && less(c + 1, c)) c++;
        if (!less(c, i)) break;
        swap(c, i);
        i = c;
      }
    }
    return value;
  };
  push(start);
  let best = start,
    visits = 0;
  while (heapIds.length && visits++ < Math.min(90000, n * n)) {
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
    for (const [dx, dz] of DIRECTIONS) {
      const nx = cx + dx,
        nz = cz + dz;
      if (nx < 1 || nz < 1 || nx >= n - 1 || nz >= n - 1) continue;
      const next = nz * n + nx;
      if (closed[next] || grid[next] || (dx && dz && (grid[cz * n + nx] || grid[nz * n + cx]))) continue;
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

const pathWork = new WeakMap<MatchState, {tick: number; searches: number}>();
export function navigationWork(state: MatchState) {
  return pathWork.get(state)?.tick === state.tick ? pathWork.get(state)!.searches : 0;
}
// Tick budgets use the stable simulation entity order, never elapsed time.
// Deferred actors retain their route and retry on later ticks.
export function requestPath(state: MatchState, e: Entity, x: number, z: number) {
  let work = pathWork.get(state);
  if (!work || work.tick !== state.tick) {
    work = {tick: state.tick, searches: 0};
    pathWork.set(state, work);
  }
  if (work.searches >= 8) return undefined;
  work.searches++;
  return findPath(state, e, x, z);
}
