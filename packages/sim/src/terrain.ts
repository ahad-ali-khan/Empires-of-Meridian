export function seedHash(seed: number, index: number) {
  let x = Math.imul(seed ^ Math.imul(index + 1, 0x9e3779b9), 0x85ebca6b);
  x ^= x >>> 13;
  return Math.imul(x, 0xc2b2ae35) >>> 0;
}
export function mapRecipe(seed: number) {
  return seedHash(seed, 700) % 3;
}
export function coastAt(z: number, size = 160 * 256, seed = 0): number {
  const cell = Math.trunc(size / 8),
    band = Math.max(0, Math.min(7, Math.floor(z / cell))),
    t = Math.max(0, Math.min(cell, z - band * cell));
  const knot = (i: number) => Math.trunc((size * (80 + (seedHash(seed, i) % 13))) / 100),
    a = knot(band),
    b = knot(band + 1);
  const ease = Math.trunc((t * t * (3 * cell - 2 * t)) / (cell * cell));
  return a + Math.trunc(((b - a) * ease) / cell);
}
export function landAt(x: number, z: number, size = 160 * 256, seed = 0) {
  return (
    x >= 256 &&
    z >= 256 &&
    z < size - 256 &&
    x < coastAt(z, size, seed) - 768 &&
    !inlandWater(x, z, size, seed) &&
    !cliffAt(x, z, size, seed)
  );
}
export function inlandWater(x: number, z: number, size: number, seed: number) {
  const ellipse = (cx: number, cz: number, rx: number, rz: number) => {
    const dx = Math.trunc(((x - cx) * 1024) / rx),
      dz = Math.trunc(((z - cz) * 1024) / rz);
    return dx * dx + dz * dz < 1024 * 1024;
  };
  const jitterX = seedHash(seed, 701) % 6,
    jitterZ = seedHash(seed, 702) % 7,
    recipe = mapRecipe(seed);
  if (recipe === 1)
    return (
      ellipse(
        Math.trunc((size * (42 + jitterX)) / 100),
        Math.trunc((size * (40 + jitterZ)) / 100),
        Math.trunc(size * 0.045),
        Math.trunc(size * 0.075),
      ) ||
      ellipse(
        Math.trunc((size * (59 - jitterX / 2)) / 100),
        Math.trunc((size * (61 - jitterZ / 2)) / 100),
        Math.trunc(size * 0.052),
        Math.trunc(size * 0.062),
      )
    );
  if (recipe === 2)
    return (
      ellipse(
        Math.trunc((size * (50 + jitterX / 2)) / 100),
        Math.trunc((size * (49 + jitterZ / 2)) / 100),
        Math.trunc(size * 0.105),
        Math.trunc(size * 0.042),
      ) ||
      ellipse(
        Math.trunc((size * (57 + jitterX / 3)) / 100),
        Math.trunc((size * (54 + jitterZ / 3)) / 100),
        Math.trunc(size * 0.055),
        Math.trunc(size * 0.06),
      )
    );
  return ellipse(
    Math.trunc((size * (49 + jitterX)) / 100),
    Math.trunc((size * (47 + jitterZ)) / 100),
    Math.trunc(size * 0.065),
    Math.trunc(size * 0.1),
  );
}
export function plateau(x: number, z: number, size: number, seed: number) {
  const cx = Math.trunc((size * (24 + (seedHash(seed, 703) % 5))) / 100),
    cz = Math.trunc((size * (65 + (seedHash(seed, 704) % 6))) / 100),
    radius = Math.trunc(size * 0.095);
  const dx = Math.abs(x - cx),
    dz = Math.abs(z - cz),
    edge = Math.max(dx, dz);
  // A wide eastern ramp connects the highland to the main battlefield.
  const ramp = x > cx && dz < radius * 0.35;
  return {edge, radius, ramp, cx};
}
export function cliffAt(x: number, z: number, size: number, seed: number) {
  const p = plateau(x, z, size, seed);
  return !p.ramp && p.edge > p.radius - 512 && p.edge < p.radius + 512;
}
export function terrainHeight(x: number, z: number, size: number, seed: number) {
  const coast = coastAt(Math.round(z * 256), size * 256, seed) / 256,
    shore = coast - x;
  if (shore < 8) return shore < 3 ? -1.6 + Math.max(0, shore) * 0.55 : 0.15 + (shore - 3) * 0.18;
  const ix = Math.round(x * 256),
    iz = Math.round(z * 256),
    is = size * 256;
  if (inlandWater(ix, iz, is, seed)) return -1.5;
  const p = plateau(ix, iz, is, seed);
  const highland = p.ramp
    ? Math.max(0, Math.min(1, (p.radius + 1024 - (ix - p.cx)) / (p.radius * 0.85)))
    : Math.max(0, Math.min(1, (p.radius + 300 - p.edge) / 600));
  const hills =
    Math.sin(x * 0.042 + (seed % 23)) * Math.cos(z * 0.047 + (seed % 11)) * 0.8 + Math.sin((x + z) * 0.025) * 0.45;
  const recipe = mapRecipe(seed),
    ridge =
      recipe === 1
        ? Math.max(0, 1 - Math.hypot(x - size * 0.62, z - size * 0.3) / (size * 0.15)) * 2.4
        : recipe === 2
          ? Math.max(0, 1 - Math.abs(z - (size * 0.68 + Math.sin(x * 0.04) * 5)) / 11) * 1.8
          : 0;
  return Math.max(0.35, 1.05 + highland * 7 + ridge + hills * 1.6 * Math.min(1, (shore - 8) / 12));
}
