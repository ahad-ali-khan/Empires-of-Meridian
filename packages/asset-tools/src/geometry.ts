import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const materials = new Map<string, T.MeshStandardMaterial>();
const surfaces = new Map<string, T.DataTexture>();
function surface(kind: 'cloth' | 'wood' | 'stone') {
  if (surfaces.has(kind)) return surfaces.get(kind)!;
  const size = 64,
    data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const grain = ((Math.imul(x + y * 131, 1597334677) >>> 16) % 256) / 255;
      const weave =
        kind === 'cloth'
          ? x % 4 < 2 === y % 4 < 2
            ? 9
            : -9
          : kind === 'wood'
            ? Math.sin(x * 0.42 + Math.sin(y * 0.1) * 0.6) * 12
            : 0;
      const value = 225 + grain * 20 + weave,
        i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = value;
      data[i + 3] = 255;
    }
  const texture = new T.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.magFilter = T.LinearFilter;
  texture.minFilter = T.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  surfaces.set(kind, texture);
  return texture;
}
export function mat(color: string, roughness = 0.85, metalness = 0) {
  const key = `${color}/${roughness}/${metalness}`;
  if (!materials.has(key)) {
    const metal = ['#c59a4f', '#b5a06b', '#ab8a51', '#88928c', '#b4bfb7', '#c1c9c3'].includes(color);
    const kind = ['#2c686a', '#315651', '#d3c5a5', '#b7ad8d', '#c9bea4'].includes(color)
      ? 'cloth'
      : ['#72523a', '#806343', '#785234', '#513c2b', '#866743'].includes(color)
        ? 'wood'
        : ['#c9bc9c', '#e7dac0', '#e0c895'].includes(color)
          ? 'stone'
          : undefined;
    const material = new T.MeshStandardMaterial({
      color,
      roughness: metal && roughness === 0.85 ? 0.38 : roughness,
      metalness: metal && metalness === 0 ? 0.65 : metalness,
    });
    if (kind) {
      material.map = surface(kind);
      material.bumpMap = material.map;
      material.bumpScale = kind === 'stone' ? 0.025 : 0.008;
    }
    materials.set(key, material);
  }
  return materials.get(key)!;
}
export const C = {
  stone: '#c9bc9c',
  light: '#e7dac0',
  trim: '#e0c895',
  roof: '#426c67',
  roof2: '#315651',
  wood: '#72523a',
  dark: '#313e3b',
  glass: '#28494d',
  gold: '#c59a4f',
  cloth: '#2c686a',
  skin: '#bf9270',
  pants: '#d3c5a5',
};
export function mesh(g: T.BufferGeometry, m: T.Material, parent: T.Object3D, x = 0, y = 0, z = 0) {
  const o = new T.Mesh(g, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  parent.add(o);
  return o;
}
export function box(p: T.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, c: string) {
  const soft = Math.min(w, h, d) > 0.07 && Math.max(w, h, d) < 0.9;
  return mesh(
    soft ? new RoundedBoxGeometry(w, h, d, 1, Math.min(w, h, d) * 0.1) : new T.BoxGeometry(w, h, d),
    mat(c),
    p,
    x,
    y,
    z,
  );
}
export function cyl(
  p: T.Object3D,
  r: number,
  rb: number,
  h: number,
  x: number,
  y: number,
  z: number,
  c: string,
  n = 10,
) {
  return mesh(new T.CylinderGeometry(r, rb, h, n), mat(c), p, x, y, z);
}
export function ball(
  p: T.Object3D,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  c: string,
  detail = 1,
) {
  const o = mesh(new T.IcosahedronGeometry(1, detail), mat(c), p, x, y, z);
  o.scale.set(sx, sy, sz);
  return o;
}
export function ellipsoid(
  p: T.Object3D,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  c: string,
) {
  const o = mesh(new T.SphereGeometry(1, 16, 12), mat(c), p, x, y, z);
  o.scale.set(sx, sy, sz);
  return o;
}
export function beam(p: T.Object3D, a: number[], b: number[], r: number, c: string, rEnd = r) {
  const start = new T.Vector3(...a),
    end = new T.Vector3(...b),
    d = end.clone().sub(start);
  const o = cyl(p, rEnd, r, d.length(), 0, 0, 0, c, 10);
  o.position.copy(start.add(end).multiplyScalar(0.5));
  o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
  return o;
}
export function tube(p: T.Object3D, points: number[][], r: number, c: string) {
  return mesh(
    new T.TubeGeometry(
      new T.CatmullRomCurve3(points.map((v) => new T.Vector3(...v))),
      Math.max(12, points.length * 5),
      r,
      6,
      false,
    ),
    mat(c),
    p,
  );
}
export function joint(p: T.Object3D, name: string, x = 0, y = 0, z = 0) {
  const g = new T.Group();
  g.name = name;
  g.position.set(x, y, z);
  p.add(g);
  return g;
}

// All factories enter the merge with the same attributes. Custom roofs/hulls have
// no UVs; dropping an entire material batch on an attribute mismatch is forbidden.
export function consolidate(root: T.Group) {
  root.updateMatrixWorld(true);
  const batches = new Map<T.Material, T.BufferGeometry[]>();
  root.traverse((o) => {
    if (o instanceof T.Mesh) {
      const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
      if (!g.getAttribute('normal')) g.computeVertexNormals();
      if (!g.getAttribute('uv'))
        g.setAttribute('uv', new T.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
      // Keep GPU vertex reuse. Expanding every indexed primitive multiplied the
      // character/foliage vertex workload without changing a single triangle.
      if (!g.index) g.setIndex(Array.from({length: g.attributes.position.count}, (_, i) => i));
      const normalized = g;
      const m = o.material as T.Material;
      const list = batches.get(m) || [];
      list.push(normalized);
      batches.set(m, list);
    }
  });
  const result = new T.Group();
  for (const [m, gs] of batches) {
    const merged = mergeGeometries(gs);
    if (!merged) throw new Error('Invalid procedural geometry batch');
    mesh(merged, m, result);
    gs.forEach((g) => g.dispose());
  }
  const originals = new Set<T.BufferGeometry>();
  root.traverse((o) => {
    if (o instanceof T.Mesh) originals.add(o.geometry);
  });
  originals.forEach((g) => g.dispose());
  return result;
}

// Consolidate each rigid limb separately so named animation pivots survive.
export function finishRig(root: T.Group) {
  for (const child of [...root.children]) if (child instanceof T.Group) finishRig(child);
  const bucket = new T.Group();
  for (const child of [...root.children]) if (child instanceof T.Mesh) bucket.add(child);
  if (bucket.children.length) {
    const combined = consolidate(bucket);
    for (const child of [...combined.children]) root.add(child);
  }
  return root;
}
