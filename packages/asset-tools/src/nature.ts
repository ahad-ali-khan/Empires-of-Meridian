import * as T from 'three';
import {mat, mesh, beam, ball, cyl, consolidate} from './geometry';
import {ConvexGeometry} from 'three/addons/geometries/ConvexGeometry.js';
function random(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
// Two shared material batches per tree keep the detailed silhouette affordable.
const leafMaterial = new T.MeshStandardMaterial({vertexColors: true, roughness: 0.88, side: T.DoubleSide});
const barkMaterial = new T.MeshStandardMaterial({vertexColors: true, roughness: 1});
export const foliageTime = {value: 0},
  foliageWind = {value: 1};
const sway = `
  float h=max(position.y-.18,0.);
  vec2 treeOrigin=vec2(0.);
  #ifdef USE_INSTANCING
    treeOrigin=instanceMatrix[3].xz;
  #endif
  float phase=foliageTime*1.15+dot(treeOrigin,vec2(.19,.13));
  float gust=.65+.35*sin(foliageTime*.37+treeOrigin.x*.08);
  transformed.x += sin(phase+position.y*.38)*h*h*.0045*foliageWind*gust;
  transformed.z += cos(phase*.79+position.y*.51)*h*h*.0028*foliageWind*gust;
`;
function windShader(shader: {uniforms: Record<string, unknown>; vertexShader: string}, flutter = false) {
  shader.uniforms.foliageTime = foliageTime;
  shader.uniforms.foliageWind = foliageWind;
  shader.vertexShader = 'uniform float foliageTime;uniform float foliageWind;\n' + shader.vertexShader;
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    '#include <begin_vertex>\n' +
      sway +
      (flutter
        ? 'transformed.x += sin(foliageTime*3.1+position.x*4.2+position.z*2.8)*smoothstep(.3,3.,position.y)*.027*foliageWind;'
        : ''),
  );
}
leafMaterial.onBeforeCompile = (shader) => windShader(shader, true);
leafMaterial.customProgramCacheKey = () => 'meridian-leaf-wind-v3';
barkMaterial.onBeforeCompile = (shader) => windShader(shader);
barkMaterial.customProgramCacheKey = () => 'meridian-bark-wind-v3';
export const foliageDepth = new T.MeshDepthMaterial({depthPacking: T.RGBADepthPacking, side: T.DoubleSide});
foliageDepth.onBeforeCompile = (shader) => windShader(shader, true);
const barkDepth = new T.MeshDepthMaterial({depthPacking: T.RGBADepthPacking});
barkDepth.onBeforeCompile = (shader) => windShader(shader);
export function setFoliageTime(time: number, strength = 1) {
  foliageTime.value = time;
  foliageWind.value = strength;
}
class Leaves {
  positions: number[] = [];
  colors: number[] = [];
  indices: number[] = [];
  add(center: T.Vector3, length: number, width: number, rotation: T.Euler, color: T.Color) {
    const q = new T.Quaternion().setFromEuler(rotation);
    const outline = [
      new T.Vector3(0, 0, 0),
      new T.Vector3(-width * 0.5, length * 0.3, 0),
      new T.Vector3(-width * 0.4, length * 0.7, 0),
      new T.Vector3(0, length, 0),
      new T.Vector3(width * 0.4, length * 0.7, 0),
      new T.Vector3(width * 0.5, length * 0.3, 0),
    ];
    const mid = new T.Vector3(0, length * 0.48, width * 0.15),
      base = this.positions.length / 3;
    for (const point of [mid, ...outline]) {
      const p = point.clone().applyQuaternion(q).add(center);
      this.positions.push(p.x, p.y, p.z);
      const shade = point === mid ? 1.1 : 0.91;
      this.colors.push(color.r * shade, color.g * shade, color.b * shade);
    }
    for (let i = 0; i < 6; i++) this.indices.push(base, base + 1 + i, base + 1 + ((i + 1) % 6));
  }
  finish(parent: T.Group) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(this.colors, 3));
    g.setIndex(this.indices);
    g.computeVertexNormals();
    const m = mesh(g, leafMaterial, parent);
    m.name = 'foliage';
    m.customDepthMaterial = foliageDepth;
  }
}
// Tapered, bent limbs use a single vertex-coloured bark material. The broad
// root flare and split trunk remain readable from the normal strategy camera.
class Branches {
  positions: number[] = [];
  colors: number[] = [];
  indices: number[] = [];
  add(a: T.Vector3, b: T.Vector3, r: number, tip: number, color: T.Color, sides = 7, cut = false) {
    const direction = b.clone().sub(a),
      q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), direction.clone().normalize());
    const base = this.positions.length / 3;
    for (let row = 0; row < 2; row++)
      for (let i = 0; i < sides; i++) {
        const angle = (i / sides) * Math.PI * 2,
          radius = (row ? tip : r) * (i % 2 ? 0.95 : 1.06);
        const p = new T.Vector3(Math.cos(angle) * radius, row ? direction.length() : 0, Math.sin(angle) * radius)
          .applyQuaternion(q)
          .add(a);
        this.positions.push(p.x, p.y, p.z);
        const c = cut && row === 1 ? new T.Color('#c9ab7b') : color.clone().multiplyScalar(0.84 + (i % 3) * 0.11);
        this.colors.push(c.r, c.g, c.b);
      }
    for (let i = 0; i < sides; i++) {
      const n = (i + 1) % sides;
      this.indices.push(base + i, base + n, base + sides + i, base + n, base + sides + n, base + sides + i);
    }
    for (let i = 1; i < sides - 1; i++) this.indices.push(base + sides, base + sides + i, base + sides + i + 1);
  }
  finish(parent: T.Group) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(this.colors, 3));
    g.setIndex(this.indices);
    g.computeVertexNormals();
    const m = mesh(g, barkMaterial, parent);
    m.name = 'branches';
    m.customDepthMaterial = barkDepth;
  }
}

export function buildTree(seed: number, pine = false, halfCut = false) {
  const rand = random(seed),
    out = new T.Group(),
    wood = new Branches(),
    leaves = new Leaves();
  const h = pine ? 6.5 + rand() * 1.5 : 5.2 + rand() * 1.2,
    bark = new T.Color(pine ? '#65554b' : '#746653');
  const lean = new T.Vector3((rand() - 0.5) * 0.35, h * 0.62, (rand() - 0.5) * 0.25);
  // The notch has a real interruption in the bark, without detaching the crown.
  const notch = new T.Vector3(0.025, 0.55, 0.01),
    base = new T.Vector3();
  wood.add(base, notch, pine ? 0.21 : 0.31, pine ? 0.16 : 0.24, bark, 9, halfCut);
  wood.add(notch, lean, pine ? 0.16 : 0.24, 0.065, bark, 9);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.14;
    wood.add(
      new T.Vector3(Math.cos(a) * 0.58, 0.015, Math.sin(a) * 0.58),
      new T.Vector3(0, 0.66, 0),
      0.075,
      0.12,
      bark,
      6,
    );
  }
  if (pine) {
    wood.add(lean, new T.Vector3(lean.x * 0.6, h, lean.z * 0.6), 0.07, 0.012, bark);
    for (let tier = 0; tier < 9; tier++) {
      const y = 1.5 + (tier * (h - 1.7)) / 9,
        r = (1 - tier / 9) * 1.65 + 0.13;
      for (let arm = 0; arm < 5; arm++) {
        const a = (arm / 5) * Math.PI * 2 + tier * 2.4 + (rand() - 0.5) * 0.18,
          tip = new T.Vector3(Math.cos(a) * r, y + 0.2, Math.sin(a) * r);
        wood.add(new T.Vector3(lean.x * 0.5, y, lean.z * 0.5), tip, 0.038, 0.008, bark, 5);
        // Broad feathered sprays, rather than sparse toothpick needles or cones.
        for (let spray = 0; spray < 4; spray++)
          for (const side of [-1, 1]) {
            const f = 0.25 + spray * 0.18,
              theta = a + side * 0.7;
            const pos = tip.clone().multiplyScalar(f);
            pos.y = y + 0.17 * f;
            leaves.add(
              pos,
              (1 - f) * 0.91 + 0.2,
              (1 - f) * 0.31 + 0.13,
              new T.Euler(1.14, -theta, 0.18 * side),
              new T.Color().setHSL(0.3 + rand() * 0.035, 0.27, 0.2 + tier * 0.009 + rand() * 0.075),
            );
            leaves.add(
              pos.clone().add(new T.Vector3(0, 0.085, 0)),
              (1 - f) * 0.7 + 0.14,
              (1 - f) * 0.18 + 0.08,
              new T.Euler(0.89, -theta, 0.1 * side),
              new T.Color().setHSL(0.29 + rand() * 0.035, 0.3, 0.26 + rand() * 0.07),
            );
          }
      }
    }
  } else {
    for (let branch = 0; branch < 10; branch++) {
      const a = branch * 2.39996,
        r = 1.1 + rand() * 0.7,
        y = h * (0.52 + branch * 0.027) + rand() * 0.3;
      const fork = new T.Vector3(Math.cos(a) * r * 0.52, y - 0.4, Math.sin(a) * r * 0.52);
      const tip = new T.Vector3(Math.cos(a) * r, y + 0.2, Math.sin(a) * r);
      wood.add(
        new T.Vector3(lean.x * 0.55, h * 0.38 + branch * 0.06, lean.z * 0.55),
        fork,
        0.13 - branch * 0.006,
        0.055,
        bark,
      );
      wood.add(fork, tip, 0.055, 0.021, bark, 6);
      for (let twig = 0; twig < 3; twig++) {
        const theta = a + (twig - 1) * 0.8,
          end = tip
            .clone()
            .add(
              new T.Vector3(
                Math.cos(theta) * (0.48 + rand() * 0.38),
                rand() * 0.38,
                Math.sin(theta) * (0.48 + rand() * 0.38),
              ),
            );
        wood.add(tip, end, 0.024, 0.007, bark, 5);
        const color = new T.Color().setHSL(0.23 + rand() * 0.035, 0.32, 0.29 + branch * 0.009 + rand() * 0.045);
        // Deliberate leaf rosettes make overlapping sprays with visible air gaps.
        for (let leaf = 0; leaf < 17; leaf++) {
          const theta = leaf * 2.39996,
            rad = Math.sqrt(rand()) * 0.5;
          const pos = tip
            .clone()
            .lerp(end, 0.25 + rand() * 0.75)
            .add(new T.Vector3(Math.cos(theta) * rad, (rand() - 0.4) * 0.34, Math.sin(theta) * rad));
          leaves.add(
            pos,
            0.35 + rand() * 0.21,
            0.23 + rand() * 0.12,
            new T.Euler(0.52 + rand() * 1.65, theta, rand() * 0.7 - 0.35),
            color.clone().multiplyScalar(0.9 + rand() * 0.19),
          );
        }
      }
    }
  }
  wood.finish(out);
  leaves.finish(out);
  out.name = pine ? 'pine' : 'tree';
  return out;
}

export function buildBush(seed: number, berries = false) {
  const rand = random(seed),
    out = new T.Group(),
    wood = new Branches(),
    leaves = new Leaves(),
    fruit = new T.Group();
  for (let i = 0; i < 11; i++) {
    const a = i * 2.4,
      r = 0.35 + rand() * 0.45,
      y = 0.35 + rand() * 0.5,
      end = new T.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
    wood.add(new T.Vector3(), end, 0.026, 0.008, new T.Color('#77624a'), 5);
    for (let j = 0; j < 15; j++)
      leaves.add(
        end
          .clone()
          .multiplyScalar(0.5 + rand() * 0.5)
          .add(new T.Vector3((rand() - 0.5) * 0.35, rand() * 0.16, (rand() - 0.5) * 0.35)),
        0.23 + rand() * 0.15,
        0.13 + rand() * 0.1,
        new T.Euler(0.5 + rand() * 2, rand() * 6.3, rand() - 0.5),
        new T.Color().setHSL(0.28 + rand() * 0.035, 0.36, 0.23 + rand() * 0.12),
      );
    if (berries)
      for (let j = 0; j < 7; j++) {
        const theta = j * 2.4,
          rad = j === 0 ? 0 : 0.065;
        ball(
          fruit,
          end.x + Math.cos(theta) * rad,
          end.y + Math.sin(theta) * rad + 0.08,
          end.z + 0.075,
          0.052,
          0.052,
          0.052,
          j % 3 ? '#a73e49' : '#d27268',
          0,
        );
      }
  }
  wood.finish(out);
  leaves.finish(out);
  if (berries) out.add(consolidate(fruit));
  out.name = berries ? 'berries' : 'bush';
  return out;
}

export function buildMine(stoneOnly = false) {
  const result = new T.Group(),
    rand = random(stoneOnly ? 614 : 912);
  for (let i = 0; i < 12; i++) {
    const a = i * 2.39996,
      r = i < 3 ? 0.28 : 0.76 + rand() * 0.6,
      x = Math.cos(a) * r,
      z = Math.sin(a) * r;
    const w = i < 3 ? 0.85 : 0.4 + rand() * 0.29,
      h = i < 3 ? 1.25 + rand() * 0.42 : 0.3 + rand() * 0.68,
      chunk = new T.Group();
    // Two complementary fractured faces cradle a connected mineral seam.
    for (const side of [-1, 1]) {
      const pts: T.Vector3[] = [];
      for (let level = 0; level < 3; level++)
        for (let corner = 0; corner < 5; corner++) {
          const theta = (corner / 5) * Math.PI * 2,
            shrink = level === 2 ? 0.62 : 1;
          pts.push(
            new T.Vector3(
              side * w * 0.27 + Math.cos(theta) * w * 0.3 * shrink + (rand() - 0.5) * 0.065,
              (level / 2) * h * (0.92 + rand() * 0.14),
              Math.sin(theta) * w * 0.65 * shrink + (rand() - 0.5) * 0.1,
            ),
          );
        }
      const geometry = new ConvexGeometry(pts),
        position = geometry.attributes.position,
        colors: number[] = [];
      for (let v = 0; v < position.count; v++) {
        const tone = 0.85 + (Math.floor(v / 3) % 5) * 0.045,
          c = new T.Color(stoneOnly ? '#8f9698' : '#65777c').multiplyScalar(tone);
        colors.push(c.r, c.g, c.b);
      }
      geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
      mesh(geometry, new T.MeshStandardMaterial({vertexColors: true, roughness: 0.94}), chunk);
    }
    if (!stoneOnly) {
      const path: T.Vector3[] = [];
      for (let j = 0; j < 7; j++)
        path.push(
          new T.Vector3(
            (rand() - 0.5) * 0.035,
            0.09 + (j / 6) * h * 0.9,
            w * 0.51 * (1 - (j / 6) * 0.35) + (rand() - 0.5) * 0.055,
          ),
        );
      for (let j = 0; j < 6; j++) {
        const crystal = mesh(
          new T.DodecahedronGeometry(0.13 + rand() * 0.025, 0),
          mat(j % 2 ? '#c39b47' : '#e4c678', 0.42, 0.65),
          chunk,
          path[j].x,
          path[j].y,
          path[j].z,
        );
        crystal.scale.set(0.52, 0.94, 0.4);
        crystal.rotation.z = (rand() - 0.5) * 0.55;
        beam(chunk, path[j].toArray(), path[j + 1].toArray(), 0.035, j % 2 ? '#c39b47' : '#e4c678', 0.024);
      }
      // A little pale quartz keeps the gold embedded in geology, not painted on.
      for (let j = 0; j < 3; j++) ball(chunk, 0.08, 0.18 + j * h * 0.25, w * 0.49, 0.05, 0.09, 0.04, '#c7c9ba', 0);
    }
    const combined = consolidate(chunk);
    combined.position.set(x, 0, z);
    combined.rotation.set((rand() - 0.5) * 0.13, a, (rand() - 0.5) * 0.1);
    combined.name = `resourceChunk${i}`;
    combined.userData.resourceChunk = i;
    result.add(combined);
  }
  result.name = stoneOnly ? 'stoneMine' : 'mine';
  return result;
}

export function setResourceLevel(root: T.Object3D, percent: number) {
  const count = Math.ceil((T.MathUtils.clamp(percent, 0, 100) / 100) * 12);
  root.traverse((o) => {
    if (typeof o.userData.resourceChunk === 'number') {
      const visible = o.userData.resourceChunk < count;
      o.traverse((child) => (child.visible = visible));
    }
  });
  root.userData.remaining = percent;
}

export function buildFelledTree(seed: number, pine = false) {
  const root = new T.Group(),
    crown = buildTree(seed, pine, true);
  crown.name = 'fallenCrown';
  for (const child of [...crown.children])
    if (child instanceof T.Mesh) {
      if (child.material === leafMaterial) {
        crown.remove(child);
        child.geometry.dispose();
        continue;
      }
      child.material = new T.MeshStandardMaterial({color: '#79664b', roughness: 1});
      child.customDepthMaterial = undefined;
      const g = child.geometry,
        idx = g.index!.array,
        pos = g.attributes.position,
        keep: number[] = [];
      for (let i = 0; i < idx.length; i += 3)
        if ((pos.getY(idx[i]) + pos.getY(idx[i + 1]) + pos.getY(idx[i + 2])) / 3 > 0.52)
          keep.push(idx[i], idx[i + 1], idx[i + 2]);
      g.setIndex(keep);
    }
  cyl(root, 0.22, 0.34, 0.48, 0, 0.24, 0, '#79664b', 16);
  cyl(root, 0.22, 0.22, 0.02, 0, 0.49, 0, '#c6a779', 16);
  root.add(crown);
  crown.rotation.z = Math.PI / 2;
  crown.updateMatrixWorld(true);
  crown.userData.landY = -new T.Box3().setFromObject(crown).min.y + 0.025;
  crown.position.y = crown.userData.landY;
  root.name = 'treeHalfCut';
  return root;
}
