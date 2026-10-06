import {expect, test} from 'vitest';
import {
  cliffAt,
  coastAt,
  inlandWater,
  landAt,
  mapRecipe,
  terrainDepth,
  terrainHeight,
  terrainZone,
} from '../../packages/sim/src/terrain';

const SCALE = 256;
function signature(seed: number, size = 256) {
  let hash = 2166136261;
  const counts = new Map<string, number>();
  for (let z = 4; z < size; z += 4)
    for (let x = 4; x < size; x += 4) {
      const zone = terrainZone(x * SCALE, z * SCALE, size * SCALE, seed);
      counts.set(zone, (counts.get(zone) ?? 0) + 1);
      hash = Math.imul(hash ^ zone.charCodeAt(0) ^ Math.round(terrainHeight(x, z, size, seed) * SCALE), 16777619);
    }
  return {hash: hash >>> 0, counts};
}

test('seeds produce six terrain families and distinct wetland/ridge topology', () => {
  const families = new Set<number>(),
    maps = new Set<number>();
  let rivers = 0,
    fords = 0;
  for (let seed = 1; seed <= 36; seed++) {
    const {hash, counts} = signature(seed);
    maps.add(hash);
    families.add(mapRecipe(seed));
    expect(counts.get('lake') ?? 0, `seed ${seed} lake`).toBeGreaterThan(8);
    expect(counts.get('marsh') ?? 0, `seed ${seed} marsh`).toBeGreaterThan(8);
    expect(counts.get('highland') ?? 0, `seed ${seed} ridges`).toBeGreaterThan(12);
    expect(counts.get('cliff') ?? 0, `seed ${seed} cliffs`).toBeGreaterThan(12);
    rivers += counts.get('river') ?? 0;
    fords += counts.get('ford') ?? 0;
  }
  expect(families.size).toBe(6);
  expect(maps.size).toBe(36);
  expect(rivers).toBeGreaterThan(100);
  expect(fords).toBeGreaterThan(30);
});

test('water depth, visible banks and navigation share one terrain truth', () => {
  for (const size of [192, 256, 384, 512])
    for (const seed of [3, 9, 17, 23, 73, 90210]) {
      for (let z = 4; z < size; z += 6)
        for (let x = 4; x < size; x += 6) {
          const px = x * SCALE,
            pz = z * SCALE,
            mapSize = size * SCALE;
          const h = terrainHeight(x, z, size, seed),
            zone = terrainZone(px, pz, mapSize, seed);
          expect(Number.isInteger(h * SCALE)).toBe(true);
          if (landAt(px, pz, mapSize, seed)) expect(h, `${seed} ${x},${z}`).toBeGreaterThan(0.06);
          if (inlandWater(px, pz, mapSize, seed)) expect(h).toBeLessThan(0);
          expect(terrainDepth(px, pz, mapSize, seed)).toBe(Math.max(0, -h * SCALE));
          if (zone === 'cliff') expect(cliffAt(px, pz, mapSize, seed)).toBe(true);
          if (['ford', 'marsh'].includes(zone))
            expect(landAt(px, pz, mapSize, seed), `${zone} ${seed} ${x},${z}`).toBe(true);
        }
    }
});

test('100 terrain seeds keep all four starting approaches mutually reachable', () => {
  const width = 128,
    size = 256 * SCALE,
    cell = 2 * SCALE;
  for (let seed = 1; seed <= 100; seed++) {
    const open = new Uint8Array(width * width),
      reached = new Uint8Array(open.length),
      queue = new Int32Array(open.length);
    for (let z = 0; z < width; z++)
      for (let x = 0; x < width; x++)
        open[z * width + x] = Number(landAt(x * cell + SCALE, z * cell + SCALE, size, seed));
    const points = [
      [Math.trunc(size * 0.28), Math.trunc(size * 0.23)],
      [coastAt(Math.trunc(size * 0.23), size, seed) - 24 * SCALE, Math.trunc(size * 0.23)],
      [Math.trunc(size * 0.25), Math.trunc(size * 0.82)],
      [coastAt(Math.trunc(size * 0.77), size, seed) - 24 * SCALE, Math.trunc(size * 0.77)],
    ];
    const ids = points.map(([x, z]) => Math.floor(z / cell) * width + Math.floor(x / cell));
    expect(
      ids.every((id) => open[id]),
      `seed ${seed} start on dry land`,
    ).toBe(true);
    let head = 0,
      tail = 1;
    queue[0] = ids[0];
    reached[ids[0]] = 1;
    while (head < tail) {
      const id = queue[head++],
        x = id % width,
        z = Math.floor(id / width);
      for (const next of [
        x > 0 ? id - 1 : -1,
        x < width - 1 ? id + 1 : -1,
        z > 0 ? id - width : -1,
        z < width - 1 ? id + width : -1,
      ]) {
        if (next < 0 || !open[next] || reached[next]) continue;
        reached[next] = 1;
        queue[tail++] = next;
      }
    }
    expect(
      ids.every((id) => reached[id]),
      `seed ${seed} connected approaches`,
    ).toBe(true);
  }
});

test('regenerating recipes after cache eviction preserves every sampled height and zone', () => {
  const before = signature(91);
  for (let seed = 300; seed < 570; seed++) landAt(20 * SCALE, 20 * SCALE, 256 * SCALE, seed);
  expect(signature(91)).toEqual(before);
});
