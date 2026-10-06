const Q = 4096;
const WORLD = 256;

export function seedHash(seed: number, index: number) {
  let x = Math.imul(seed ^ Math.imul(index + 1, 0x9e3779b9), 0x85ebca6b);
  x ^= x >>> 13;
  return Math.imul(x, 0xc2b2ae35) >>> 0;
}
export function mapRecipe(seed: number) {
  return seedHash(seed, 700) % 6;
}
function ease(t: number, length: number) {
  const f = Math.max(0, Math.min(Q, Math.trunc((t * Q) / length)));
  return Math.trunc((f * f * (3 * Q - 2 * f)) / (Q * Q));
}
function mix(a: number, b: number, t: number) {
  return a + Math.trunc(((b - a) * t) / Q);
}
type Coast = {size: number; seed: number; cell: number; knots: number[]};
const coasts = new Map<string, Coast>();
let lastCoast: Coast | undefined;
function coast(size: number, seed: number) {
  if (lastCoast?.size === size && lastCoast.seed === seed) return lastCoast;
  const key = `${seed}:${size}`;
  let result = coasts.get(key);
  if (!result) {
    const family = mapRecipe(seed);
    const knots = Array.from({length: 9}, (_, i) => {
      const inlet = family >= 3 && i >= 3 && i <= 5;
      return Math.trunc((size * ((inlet ? 68 : 86) + (seedHash(seed, i) % (inlet ? 12 : 8)))) / 100);
    });
    result = {size, seed, cell: Math.trunc(size / 8), knots};
    if (coasts.size >= 256) coasts.delete(coasts.keys().next().value!);
    coasts.set(key, result);
  }
  lastCoast = result;
  return result;
}
export function coastAt(z: number, size = 160 * WORLD, seed = 0): number {
  const {cell, knots} = coast(size, seed),
    band = Math.max(0, Math.min(7, Math.floor(z / cell)));
  // Cache only derived coastline knots; interpolation remains the same integer
  // shoreline used by navigation, placement and the renderer.
  return mix(knots[band], knots[band + 1], ease(z - band * cell, cell));
}

type ShapeBounds = {minX: number; minZ: number; maxX: number; maxZ: number};
type Lake = {x: number; z: number; rx: number; rz: number} & ShapeBounds;
type Channel = {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  width: number;
  dx: number;
  dz: number;
  length: number;
} & ShapeBounds;
type Ford = {x: number; z: number; hx: number; hz: number};
type Ridge = {x: number; z: number; rx: number; rz: number; height: number};
type Recipe = {
  lakes: Lake[];
  channels: Channel[];
  fords: Ford[];
  ridges: Ridge[];
  bounds: [number, number, number, number];
  size: number;
  seed: number;
};
const recipes = new Map<string, Recipe>();
let lastRecipe: Recipe | undefined;
function recipe(size: number, seed: number): Recipe {
  if (lastRecipe?.size === size && lastRecipe.seed === seed) return lastRecipe;
  const key = `${seed}:${size}`,
    cached = recipes.get(key);
  if (cached) {
    lastRecipe = cached;
    return cached;
  }
  const pct = (v: number) => Math.trunc((size * v) / 1000);
  const jitter = (id: number, span: number) => (seedHash(seed, id) % (span * 2 + 1)) - span;
  const type = mapRecipe(seed),
    lakes: {x: number; z: number; rx: number; rz: number}[] = [],
    channels: {ax: number; az: number; bx: number; bz: number; width: number}[] = [],
    fords: Ford[] = [],
    ridges: Ridge[] = [];
  const addLake = (x: number, z: number, rx: number, rz: number) =>
    lakes.push({x: pct(x), z: pct(z), rx: pct(rx), rz: pct(rz)});
  const addChannel = (ax: number, az: number, bx: number, bz: number, width: number) =>
    channels.push({ax: pct(ax), az: pct(az), bx: pct(bx), bz: pct(bz), width: Math.max(2 * WORLD, pct(width))});
  const cx = 490 + jitter(701, 40),
    cz = 490 + jitter(702, 40);
  if (type === 0 || type === 3) {
    // A branching valley river links broad upper pools to a coastal estuary.
    const bendX = cx + 110,
      bendZ = cz + jitter(703, 55);
    addLake(cx - 100, cz - 45, 52, 72);
    addLake(cx - 65, cz + 15, 40, 47);
    addLake(bendX + 20, bendZ + 25, 34, 47);
    addChannel(cx - 88, cz - 20, cx + 10, cz + 35, 12);
    addChannel(cx + 10, cz + 35, bendX, bendZ, 13);
    addChannel(bendX, bendZ, 900, cz + 65, type === 3 ? 22 : 13);
    addChannel(cx + 15, cz + 35, cx - 10, cz + 125, 10);
    addLake(cx - 10, cz + 125, 38, 31);
    fords.push({x: pct(cx + 10), z: pct(cz + 35), hx: 5 * WORLD, hz: 12 * WORLD});
  } else if (type === 1 || type === 4) {
    // A wetland chain: overlapping lobes produce coves and reed-lined margins,
    // with a second independent lake rather than one repeated central ellipse.
    for (let i = 0; i < 4; i++)
      addLake(cx - 90 + i * 45, cz - 25 + jitter(711 + i, 32), 36 + jitter(720 + i, 9), 51 + jitter(725 + i, 13));
    addLake(cx + 120, cz + 105, 58, 39);
    addLake(cx + 150, cz + 78, 38, 38);
    if (type === 4) {
      addChannel(cx + 45, cz, cx + 115, cz + 100, 11);
      addChannel(cx + 140, cz + 95, 895, cz + 60, 15);
      fords.push({x: pct(cx + 85), z: pct(cz + 57), hx: 8 * WORLD, hz: 5 * WORLD});
    }
  } else {
    // A long glacial lake plus two tributary pools. Its diagonal course and
    // narrow passages create different approaches from the wetland families.
    addLake(cx - 65, cz - 40, 77, 35);
    addLake(cx + 15, cz - 7, 61, 48);
    addLake(cx + 58, cz + 45, 35, 55);
    addLake(cx - 140, cz + 110, 42, 36);
    addLake(cx + 110, cz - 103, 34, 39);
    addChannel(cx + 15, cz - 25, cx + 105, cz - 100, 9);
    if (type === 5) addChannel(cx + 60, cz + 35, 900, cz + 10, 17);
    fords.push({x: pct(cx + 68), z: pct(cz - 70), hx: 7 * WORLD, hz: 5 * WORLD});
  }
  // Every pond is part of this catchment, with an outlet toward the sea.
  // Connecting pool centres keeps tributaries in the low valley instead of
  // scattering unconnected water shapes through elevated land.
  const outlet = {x: pct(cx + 120), z: pct(cz + 40)};
  for (const pool of lakes)
    channels.push({ax: pool.x, az: pool.z, bx: outlet.x, bz: outlet.z, width: Math.max(2 * WORLD, pct(9))});
  channels.push({ax: outlet.x, az: outlet.z, bx: pct(970), bz: pct(cz + 65), width: Math.max(3 * WORLD, pct(16))});
  // One connected ridge spine shelters the drainage basin. Three overlapping
  // crest lobes form a range, with physical saddle/ramp routes through it.
  const ridgeLocations = [
    [cx - 245, cz - 100, 65, 83],
    [cx - 225, cz + 20, 72, 83],
    [cx - 245, cz + 125, 65, 78],
    [cx + 160, cz - 155, 70, 45],
    [cx + 160, cz + 160, 68, 42],
  ];
  for (let i = 0; i < ridgeLocations.length; i++) {
    const [x, z, rx, rz] = ridgeLocations[i];
    ridges.push({
      x: pct(x + jitter(740 + i, 12)),
      z: pct(z + jitter(750 + i, 10)),
      rx: pct(rx + jitter(760 + i, 7)),
      rz: pct(rz + jitter(770 + i, 7)),
      height: (5 + (seedHash(seed, 780 + i) % 5)) * WORLD,
    });
  }
  const bounds: [number, number, number, number] = [size, size, 0, 0];
  for (const lake of lakes) {
    bounds[0] = Math.min(bounds[0], lake.x - lake.rx);
    bounds[1] = Math.min(bounds[1], lake.z - lake.rz);
    bounds[2] = Math.max(bounds[2], lake.x + lake.rx);
    bounds[3] = Math.max(bounds[3], lake.z + lake.rz);
  }
  for (const c of channels) {
    bounds[0] = Math.min(bounds[0], c.ax - c.width, c.bx - c.width);
    bounds[1] = Math.min(bounds[1], c.az - c.width, c.bz - c.width);
    bounds[2] = Math.max(bounds[2], c.ax + c.width, c.bx + c.width);
    bounds[3] = Math.max(bounds[3], c.az + c.width, c.bz + c.width);
  }
  const margin = 8 * WORLD;
  // These conservative boxes contain every point where a shape can lower the
  // clamped water field. They only skip arithmetic, never clip a shoreline.
  const boundedLakes = lakes.map((lake): Lake => {
    const minRadius = Math.min(lake.rx, lake.rz),
      hx = lake.rx + Math.ceil((margin * lake.rx) / minRadius) + Math.ceil(lake.rx / Q) + 2,
      hz = lake.rz + Math.ceil((margin * lake.rz) / minRadius) + Math.ceil(lake.rz / Q) + 2;
    return {...lake, minX: lake.x - hx, minZ: lake.z - hz, maxX: lake.x + hx, maxZ: lake.z + hz};
  });
  const boundedChannels = channels.map((c): Channel => {
    const dx = c.bx - c.ax,
      dz = c.bz - c.az,
      radius = c.width + margin + 2;
    return {
      ...c,
      dx,
      dz,
      length: dx * dx + dz * dz,
      minX: Math.min(c.ax, c.bx) - radius,
      minZ: Math.min(c.az, c.bz) - radius,
      maxX: Math.max(c.ax, c.bx) + radius,
      maxZ: Math.max(c.az, c.bz) + radius,
    };
  });
  const result = {lakes: boundedLakes, channels: boundedChannels, fords, ridges, bounds, size, seed};
  // This cache contains immutable derived geometry only, never match state.
  if (recipes.size >= 256) recipes.delete(recipes.keys().next().value!);
  recipes.set(key, result);
  lastRecipe = result;
  return result;
}

// Signed distance approximation in fixed-point world units: negative is water.
// It is also the single shoreline contract used for renderer wetland transitions.
function waterField(x: number, z: number, p: Recipe) {
  const b = p.bounds,
    margin = 8 * WORLD;
  if (x < b[0] - margin || z < b[1] - margin || x > b[2] + margin || z > b[3] + margin) return margin;
  let field = margin;
  for (const lake of p.lakes) {
    if (x < lake.minX || z < lake.minZ || x > lake.maxX || z > lake.maxZ) continue;
    const dx = Math.trunc(((x - lake.x) * Q) / lake.rx),
      dz = Math.trunc(((z - lake.z) * Q) / lake.rz);
    const distance = Math.trunc(((dx * dx + dz * dz - Q * Q) * Math.min(lake.rx, lake.rz)) / (2 * Q * Q));
    field = Math.min(field, distance);
  }
  for (const c of p.channels) {
    if (x < c.minX || z < c.minZ || x > c.maxX || z > c.maxZ) continue;
    const {dx, dz, length} = c;
    const t = Math.max(0, Math.min(Q, Math.trunc((((x - c.ax) * dx + (z - c.az) * dz) * Q) / length)));
    const ox = x - mix(c.ax, c.bx, t),
      oz = z - mix(c.az, c.bz, t);
    field = Math.min(field, Math.trunc((ox * ox + oz * oz - c.width * c.width) / (2 * c.width)));
  }
  for (const ford of p.fords) {
    const rectangle = Math.max(Math.abs(x - ford.x) - ford.hx, Math.abs(z - ford.z) - ford.hz);
    field = Math.max(field, -rectangle);
  }
  return field;
}
export function inlandWater(x: number, z: number, size: number, seed: number) {
  return waterField(x, z, recipe(size, seed)) < 0;
}
function ridgeField(x: number, z: number, r: Ridge) {
  const dx = Math.trunc((Math.abs(x - r.x) * Q) / r.rx),
    dz = Math.trunc((Math.abs(z - r.z) * Q) / r.rz);
  const metric = Math.max(dx, dz) + Math.trunc(Math.min(dx, dz) / 4);
  // Opposite ramps preserve access even when one entrance faces a forest or an
  // army. They are physical slopes, not invisible holes in the navigation ring.
  const ramp = Math.abs(z - r.z) < Math.max(4 * WORLD, Math.trunc(r.rz * 0.42));
  return {metric, ramp};
}
export function plateau(x: number, z: number, size: number, seed: number) {
  let best = recipe(size, seed).ridges[0],
    field = ridgeField(x, z, best);
  for (const r of recipe(size, seed).ridges.slice(1)) {
    const candidate = ridgeField(x, z, r);
    if (candidate.metric < field.metric) {
      best = r;
      field = candidate;
    }
  }
  return {edge: Math.trunc((field.metric * best.rx) / Q), radius: best.rx, ramp: field.ramp, cx: best.x};
}
function cliffField(x: number, z: number, p: Recipe) {
  for (const r of p.ridges) {
    if (Math.abs(x - r.x) > r.rx + 2 * WORLD || Math.abs(z - r.z) > r.rz + 2 * WORLD) continue;
    const f = ridgeField(x, z, r),
      edge = Math.trunc((f.metric * r.rx) / Q);
    if (
      !f.ramp &&
      Math.abs(edge - r.rx) < 2 * WORLD &&
      !p.ridges.some((other) => other !== r && ridgeField(x, z, other).metric < Q - 650) &&
      !p.fords.some((f) => Math.abs(x - f.x) < f.hx + 4 * WORLD && Math.abs(z - f.z) < f.hz + 4 * WORLD)
    )
      return true;
  }
  return false;
}
export function cliffAt(x: number, z: number, size: number, seed: number) {
  return cliffField(x, z, recipe(size, seed));
}
export function landAt(x: number, z: number, size = 160 * WORLD, seed = 0) {
  if (!(x >= WORLD && z >= WORLD && z < size - WORLD && x < coastAt(z, size, seed) - 3 * WORLD)) return false;
  const p = recipe(size, seed);
  return waterField(x, z, p) >= 0 && !cliffField(x, z, p);
}

export type TerrainZone = 'ocean' | 'lake' | 'river' | 'marsh' | 'ford' | 'beach' | 'cliff' | 'highland' | 'meadow';
export function terrainZone(x: number, z: number, size: number, seed: number): TerrainZone {
  const shore = coastAt(z, size, seed) - x - 3 * WORLD;
  if (shore < 0) return 'ocean';
  const p = recipe(size, seed),
    wet = waterField(x, z, p);
  if (wet < 0) {
    for (const lake of p.lakes) {
      const dx = Math.trunc(((x - lake.x) * Q) / lake.rx),
        dz = Math.trunc(((z - lake.z) * Q) / lake.rz);
      if (dx * dx + dz * dz < Q * Q) return 'lake';
    }
    return 'river';
  }
  if (cliffField(x, z, p)) return 'cliff';
  if (p.fords.some((f) => Math.abs(x - f.x) <= f.hx && Math.abs(z - f.z) <= f.hz)) return 'ford';
  if (shore < 5 * WORLD) return 'beach';
  if (wet < (mapRecipe(seed) % 3 === 1 ? 6 : 3) * WORLD) return 'marsh';
  if (p.ridges.some((r) => ridgeField(x, z, r).metric < Q)) return 'highland';
  return 'meadow';
}
function valueNoise(x: number, z: number, cell: number, seed: number) {
  const ix = Math.floor(x / cell),
    iz = Math.floor(z / cell);
  const knot = (a: number, b: number) => seedHash(seed ^ Math.imul(a, 374761393), b) % Q;
  return mix(
    mix(knot(ix, iz), knot(ix + 1, iz), ease(x - ix * cell, cell)),
    mix(knot(ix, iz + 1), knot(ix + 1, iz + 1), ease(x - ix * cell, cell)),
    ease(z - iz * cell, cell),
  );
}
function heightFixed(x: number, z: number, size: number, seed: number) {
  const shore = coastAt(z, size, seed) - x - 3 * WORLD;
  const p = recipe(size, seed),
    wet = Math.min(shore, waterField(x, z, p));
  if (wet < 0) return Math.max(-4 * WORLD, -16 + Math.trunc(wet / 2));
  let ridge = 0;
  for (const r of p.ridges) {
    if (Math.abs(x - r.x) > r.rx + 6 * WORLD || Math.abs(z - r.z) > r.rz + 3 * WORLD) continue;
    const f = ridgeField(x, z, r),
      edge = Math.trunc((f.metric * r.rx) / Q);
    const factor = f.ramp
      ? Math.max(0, Math.min(Q, Math.trunc(((r.rx + 4 * WORLD - Math.abs(x - r.x)) * Q) / (r.rx * 0.9))))
      : Q - ease(edge - r.rx + WORLD, 2 * WORLD);
    ridge = Math.max(ridge, Math.trunc((r.height * factor) / Q));
  }
  const broad = valueNoise(x, z, 28 * WORLD, seed),
    small = valueNoise(x, z, 12 * WORLD, seed + 331);
  const hills = 260 + Math.trunc((broad * 280 + small * 85) / Q);
  ridge = Math.trunc((ridge * Math.min(Q, Math.max(0, Math.trunc((wet * Q) / (10 * WORLD))))) / Q);
  // Banks slope continuously into the water. Marsh ground is visibly low while
  // remaining traversable; no renderer-only lake or cliff can trap a unit.
  const bank = Math.min(Q, Math.trunc((wet * Q) / (5 * WORLD)));
  return mix(48, hills + ridge, bank);
}
/** Cosmetic consumers pass world units; all authoritative calculations are integer. */
export function terrainHeight(x: number, z: number, size: number, seed: number) {
  return heightFixed(Math.round(x * WORLD), Math.round(z * WORLD), Math.round(size * WORLD), seed) / WORLD;
}
/** Water depth in 1/256 world units; zero on all dry land. */
export function terrainDepth(x: number, z: number, size: number, seed: number) {
  return Math.max(0, -heightFixed(x, z, size, seed));
}
