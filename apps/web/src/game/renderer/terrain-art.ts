import * as T from 'three';

// Cosmetic, continuous color fields. They never change the authoritative height,
// coast, passability or resource placement.
function noise(x: number, z: number, seed: number) {
  const ix = Math.floor(x),
    iz = Math.floor(z);
  const hash = (a: number, b: number) => {
    let n = Math.imul(a ^ seed, 374761393) ^ Math.imul(b, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return (n >>> 0) / 4294967295;
  };
  const smooth = (v: number) => v * v * (3 - 2 * v);
  const u = smooth(x - ix),
    v = smooth(z - iz);
  return T.MathUtils.lerp(
    T.MathUtils.lerp(hash(ix, iz), hash(ix + 1, iz), u),
    T.MathUtils.lerp(hash(ix, iz + 1), hash(ix + 1, iz + 1), u),
    v,
  );
}

const meadow = new T.Color('#6e8353');
const moss = new T.Color('#455f43');
const dry = new T.Color('#a5a06b');
const sand = new T.Color('#c8b58c');
const wetSand = new T.Color('#8c937b');
const rock = new T.Color('#777b78');
const chalk = new T.Color('#b5ae97');
const earth = new T.Color('#a08d69');

export function landscapeColor(
  x: number,
  z: number,
  height: number,
  slope: number,
  seed: number,
  shore: number,
  road = 99,
  zone = 'meadow',
) {
  const broad = noise(x * 0.045, z * 0.045, seed);
  const detail = noise(x * 0.23, z * 0.23, seed + 19);
  const color = meadow.clone();
  color.lerp(moss, T.MathUtils.smoothstep(broad, 0.42, 0.85) * 0.72);
  color.lerp(dry, (1 - T.MathUtils.smoothstep(broad, 0.18, 0.53)) * 0.66);
  if (height < 0.85 || shore < 8) {
    const beach = 1 - T.MathUtils.smoothstep(Math.min(height * 6, shore), 1.6, 8);
    color.lerp(sand, beach);
    color.lerp(wetSand, 1 - T.MathUtils.smoothstep(height, -0.35, 0.45));
  }
  if (zone === 'marsh') color.lerp(moss, 0.45).lerp(wetSand, 0.24);
  if (zone === 'ford') color.lerp(sand, 0.56);
  const cliff = T.MathUtils.smoothstep(slope, 0.42, 1.35);
  const strata = 0.5 + 0.5 * Math.sin(height * 5.4 + detail * 1.8);
  color.lerp(rock.clone().lerp(chalk, strata * 0.38), cliff);
  if (height > 0.45 && slope < 0.6)
    color.lerp(earth, (1 - T.MathUtils.smoothstep(road + (detail - 0.5) * 0.5, 0.7, 2)) * 0.88);
  return color.multiplyScalar(0.95 + detail * 0.1);
}

export function makeGroundMaterial(size: number) {
  const width = 128,
    data = new Uint8Array(width * width * 4);
  for (let y = 0; y < width; y++)
    for (let x = 0; x < width; x++) {
      const grit = noise(x * 0.8, y * 0.8, 3841),
        grain = noise(x * 0.12, y * 0.12, 119);
      const value = Math.round(210 + grit * 25 + grain * 20);
      const i = (y * width + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = value;
      data[i + 3] = 255;
    }
  const texture = new T.DataTexture(data, width, width);
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(size / 3, size / 3);
  texture.magFilter = T.LinearFilter;
  texture.minFilter = T.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return new T.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.98,
    map: texture,
    bumpMap: texture,
    bumpScale: 0.065,
  });
}

export type Lane = [number, number, number, number];
export function laneDistance(x: number, z: number, lanes: Lane[]) {
  let distance = Infinity;
  for (const [ax, az, bx, bz] of lanes) {
    const dx = bx - ax,
      dz = bz - az;
    const f = T.MathUtils.clamp(((x - ax) * dx + (z - az) * dz) / Math.max(0.01, dx * dx + dz * dz), 0, 1);
    distance = Math.min(distance, Math.hypot(x - ax - f * dx, z - az - f * dz));
  }
  return distance;
}

export function grassClumpGeometry() {
  const positions: number[] = [],
    colors: number[] = [];
  const base = new T.Color('#526044'),
    tip = new T.Color('#bec687');
  for (let i = 0; i < 3; i++) {
    const angle = i * 2.4,
      dx = Math.cos(angle),
      dz = Math.sin(angle),
      h = 0.23 + i * 0.085;
    const vertices = [
      [-0.045, 0, 0],
      [0.045, 0, 0],
      [0.019, h * 0.58, 0.026],
      [-0.045, 0, 0],
      [0.019, h * 0.58, 0.026],
      [-0.021, h * 0.58, 0.026],
      [-0.021, h * 0.58, 0.026],
      [0.019, h * 0.58, 0.026],
      [0.06, h, 0.07],
    ];
    for (const [x, y, z] of vertices) {
      positions.push(x * dx - z * dz, y, x * dz + z * dx);
      const c = base.clone().lerp(tip, y / h);
      colors.push(c.r, c.g, c.b);
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}
