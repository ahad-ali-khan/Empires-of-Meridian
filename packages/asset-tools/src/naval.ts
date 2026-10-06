import * as T from 'three';
import {C, mat, mesh, box, cyl, beam, tube, joint, consolidate} from './geometry';
import {addShot} from './combat';
import {effectsTime} from './presentation';

export const navalKinds = new Set([
  'ship',
  'fishingBoat',
  'tradeShip',
  'transport',
  'sloop',
  'frigate',
  'bombardVessel',
  'fireCraft',
]);

const canvas = new T.MeshStandardMaterial({color: '#e3d6b8', roughness: 0.94, side: T.DoubleSide});
canvas.onBeforeCompile = (shader) => {
  shader.uniforms.sailTime = effectsTime;
  shader.vertexShader = 'uniform float sailTime;\n' + shader.vertexShader;
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    `#include <begin_vertex>
 transformed.z += sin(uv.x*3.14159265)*sin(uv.y*3.14159265)*sin(sailTime*1.4+position.y*.7)*.055;`,
  );
};
canvas.customProgramCacheKey = () => 'meridian-canvas-billow-v1';

export function buildNaval(kind: string, age: number) {
  const root = new T.Group();
  root.name = kind;
  root.userData.naval = true;
  const dimensions: Record<string, number[]> = {
    ship: [8, 2.3],
    fishingBoat: [4, 1.25],
    tradeShip: age === 2 ? [8, 2.4] : age === 3 ? [9, 3.3] : [11, 3.5],
    transport: [7, 3],
    sloop: [6.5, 1.9],
    frigate: [12.5, 3.1],
    bombardVessel: [8, 3.6],
    fireCraft: [5, 1.6],
  };
  const [length, width] = dimensions[kind],
    half = width / 2,
    small = kind === 'fishingBoat',
    depth = small ? 0.47 : 0.96,
    deckY = small ? 0.2 : 0.23;
  const hull = joint(root, 'hull'),
    positions: number[] = [],
    indices: number[] = [];
  const stations = [
    [-0.5, 0.38],
    [-0.43, 0.72],
    [-0.32, 0.93],
    [-0.16, 1],
    [0.05, 1],
    [0.24, 0.91],
    [0.38, 0.62],
    [0.47, 0.25],
    [0.51, kind === 'transport' ? 0.58 : 0.018],
  ];
  const sheer = (z: number) => Math.pow(Math.abs(z) * 2, 3) * (small ? 0.12 : 0.28);
  for (const [z, w] of stations) {
    const y = depth * 0.67 + sheer(z);
    positions.push(
      -half * w,
      y,
      z * length,
      -half * w * 0.8,
      -0.18,
      z * length,
      0,
      -0.48,
      z * length,
      half * w * 0.8,
      -0.18,
      z * length,
      half * w,
      y,
      z * length,
    );
  }
  for (let i = 0; i < stations.length - 1; i++)
    for (let j = 0; j < 4; j++) {
      const a = i * 5 + j;
      indices.push(a, a + 1, a + 5, a + 1, a + 6, a + 5);
    }
  const last = (stations.length - 1) * 5;
  indices.push(
    0,
    4,
    2,
    0,
    2,
    1,
    4,
    3,
    2,
    last,
    last + 2,
    last + 4,
    last,
    last + 1,
    last + 2,
    last + 4,
    last + 2,
    last + 3,
  );
  const geometry = new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const hm = mat('#604936');
  hm.side = T.DoubleSide;
  mesh(geometry, hm, hull);
  const shape = new T.Shape();
  stations.forEach(([z, w], i) => (i ? shape.lineTo(half * w, -z * length) : shape.moveTo(half * w, -z * length)));
  [...stations].reverse().forEach(([z, w]) => shape.lineTo(-half * w, -z * length));
  const deck = new T.ShapeGeometry(shape);
  deck.rotateX(-Math.PI / 2);
  mesh(deck, mat('#ac9061'), hull, 0, deckY, 0);
  // The closed deck remains above the water. Keel, strakes, copper shoe and
  // bulwark ribs describe a curved working hull instead of a flat brown shell.
  beam(hull, [0, -0.44, -length * 0.43], [0, -0.44, length * 0.45], 0.045, '#463b31');
  for (const side of [-1, 1]) {
    for (let course = 0; course < 4; course++) {
      const f = course / 3;
      tube(
        hull,
        stations.map(([z, w]) => [
          side * half * w * (0.83 + 0.17 * f),
          -0.12 + f * (depth * 0.67 + 0.12 + sheer(z)),
          z * length,
        ]),
        course === 3 ? 0.04 : 0.02,
        course === 3 ? C.gold : course === 0 ? '#8d6e49' : '#493e31',
      );
    }
    tube(
      hull,
      stations.map(([z, w]) => [side * half * w * 0.97, depth * 0.43 + sheer(z) * 0.72, z * length]),
      small ? 0.042 : 0.066,
      C.cloth,
    );
    for (let i = 1; i < stations.length - 2; i++) {
      const [z, w] = stations[i];
      beam(
        hull,
        [side * half * w * 0.88, deckY, z * length],
        [side * half * w * 0.98, depth * 0.65 + sheer(z), z * length],
        0.025,
        C.wood,
      );
    }
  }
  // Longitudinal plank seams terminate at the hull rather than crossing its outline.
  for (let i = -4; i <= 4; i++) {
    const x = (i * width) / 10,
      limit = Math.abs(x) / half;
    let start = -length * 0.4,
      end = length * 0.35;
    if (limit > 0.65) {
      start = -length * 0.28;
      end = length * 0.22;
    }
    box(hull, 0.014, 0.012, end - start, x, deckY + 0.007, (start + end) / 2, '#8e7757');
  }
  function mast(z: number, height: number, triangular = false) {
    const p = joint(root, 'mast', 0, deckY, z);
    beam(p, [0, 0, 0], [0, height, 0], small ? 0.042 : 0.07, C.wood, small ? 0.024 : 0.04);
    cyl(p, 0.12, 0.15, 0.2, 0, 0.1, 0, C.dark, 12);
    if (triangular) {
      // A curved lateen panel, with an actual diagonal yard and a lower boom.
      const vertices: number[] = [],
        uv: number[] = [],
        faces: number[] = [],
        rows = 8;
      for (let r = 0; r <= rows; r++)
        for (let c = 0; c <= r; c++) {
          const y = (1 - r / rows) * (height - 0.35) + 0.3,
            x = (c / rows) * width * 0.85;
          vertices.push(x, y, Math.sin((c / Math.max(1, r)) * Math.PI) * (r / rows) * 0.2);
          uv.push(c / Math.max(1, r), 1 - r / rows);
        }
      for (let r = 0; r < rows; r++)
        for (let c = 0; c <= r; c++) {
          const a = (r * (r + 1)) / 2 + c,
            b = ((r + 1) * (r + 2)) / 2 + c;
          faces.push(a, b, b + 1);
          if (c < r) faces.push(a, b + 1, a + 1);
        }
      const sail = new T.BufferGeometry()
        .setAttribute('position', new T.Float32BufferAttribute(vertices, 3))
        .setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      sail.setIndex(faces);
      sail.computeVertexNormals();
      mesh(sail, canvas, p, 0.025, 0, 0.04);
      beam(p, [0, height - 0.05, 0], [width * 0.9, 0.24, 0], 0.032, C.wood);
      beam(p, [0, 0.3, 0], [width * 0.88, 0.3, 0], 0.026, C.wood);
    } else {
      for (let tier = 0; tier < (height > 5 ? 2 : 1); tier++) {
        const sy = height - 0.55 - tier * height * 0.35,
          w = width * (tier ? 0.83 : 1.2),
          h = height * (tier ? 0.26 : 0.3);
        beam(p, [-w / 2 - 0.07, sy, 0], [w / 2 + 0.07, sy, 0], 0.035, C.wood);
        const geo = new T.PlaneGeometry(w, h, 12, 10),
          a = geo.attributes.position;
        for (let i = 0; i < a.count; i++) {
          const u = a.getX(i) / w + 0.5,
            v = a.getY(i) / h + 0.5;
          a.setZ(i, Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.33);
          a.setY(i, a.getY(i) + (1 - v) * Math.sin(u * Math.PI) * 0.12);
        }
        geo.computeVertexNormals();
        mesh(geo, canvas, p, 0, sy - h / 2, 0.025);
        for (const side of [-1, 1])
          tube(
            p,
            [
              [(side * w) / 2, sy, 0],
              [side * w * 0.5, sy - h * 0.52, 0.05],
              [(side * w) / 2, sy - h, 0],
            ],
            0.009,
            '#b7a27d',
          );
      }
    }
    for (const side of [-1, 1]) {
      tube(
        p,
        [
          [0, height - 0.3, 0],
          [side * half * 0.48, height * 0.4, -0.44],
          [side * half * 0.83, 0.22, -0.85],
        ],
        0.011,
        C.pants,
      );
      if (!small)
        for (let i = 1; i < 8; i++) {
          const f = i / 8;
          beam(
            p,
            [side * half * 0.83 * (1 - f), 0.22 + (height - 0.52) * f, -0.85 * (1 - f)],
            [side * half * 0.6 * (1 - f), 0.22 + (height - 0.52) * f, -1.2 * (1 - f)],
            0.006,
            '#b19c78',
          );
        }
    }
    const pennant = new T.Shape();
    pennant.moveTo(0, 0);
    pennant.lineTo(0.68, -0.05);
    pennant.lineTo(0.54, -0.2);
    pennant.lineTo(0.68, -0.35);
    pennant.lineTo(0, -0.31);
    pennant.closePath();
    const flagMat = mat(C.cloth);
    flagMat.side = T.DoubleSide;
    mesh(new T.ShapeGeometry(pennant), flagMat, p, 0, height + 0.06, 0);
  }
  function cannon(x: number, z: number, side = 1) {
    const p = joint(root, 'deckGun', x, 0.69, z);
    p.rotation.y = (side * Math.PI) / 2;
    box(p, 0.38, 0.19, 0.68, 0, -0.15, -0.08, C.wood);
    for (const sx of [-0.23, 0.23])
      for (const sz of [-0.3, 0.13]) cyl(p, 0.1, 0.1, 0.065, sx, -0.2, sz, C.dark, 10).rotation.z = Math.PI / 2;
    const b = cyl(p, 0.095, 0.145, 0.93, 0, 0.035, 0.2, '#59635c', 18);
    b.rotation.x = Math.PI / 2;
    cyl(p, 0.11, 0.11, 0.08, 0, 0.035, 0.64, C.gold, 18).rotation.x = Math.PI / 2;
    cyl(p, 0.073, 0.073, 0.012, 0, 0.035, 0.688, '#111d1d', 18).rotation.x = Math.PI / 2;
  }
  function bridge(z: number, w: number, h: number) {
    const p = joint(root, 'quarterdeck', 0, deckY, z);
    box(p, w, h, 1.6, 0, h / 2, 0, C.wood);
    box(p, w + 0.15, 0.11, 1.76, 0, h + 0.055, 0, C.cloth);
    box(p, w + 0.19, 0.055, 1.8, 0, h + 0.12, 0, C.gold);
    for (const x of [-w * 0.28, 0, w * 0.28]) {
      box(p, w * 0.22, 0.4, 0.06, x, h - 0.3, 0.817, C.gold);
      box(p, w * 0.17, 0.29, 0.045, x, h - 0.3, 0.854, C.glass);
      box(p, 0.025, 0.3, 0.05, x, h - 0.3, 0.88, C.trim);
      box(p, w * 0.18, 0.025, 0.05, x, h - 0.3, 0.88, C.trim);
    }
    for (const side of [-1, 1])
      for (let i = 0; i < 4; i++)
        beam(
          p,
          [side * (w * 0.47), h + 0.13, -0.6 + i * 0.4],
          [side * (w * 0.47), h + 0.5, -0.6 + i * 0.4],
          0.023,
          C.wood,
        );
    for (const side of [-1, 1])
      beam(p, [side * w * 0.47, h + 0.51, -0.65], [side * w * 0.47, h + 0.51, 0.65], 0.028, C.gold);
    for (let i = 0; i < 4; i++) box(p, 0.35, 0.1, 0.22, w * 0.42, 0.08 + i * 0.18, 1.12 - i * 0.18, C.wood);
  }
  function cargo(x: number, z: number, color = C.wood, y = deckY) {
    box(root, 0.64, 0.58, 0.84, x, y + 0.29, z, color);
    for (const side of [-1, 1]) {
      box(root, 0.037, 0.61, 0.87, x + side * 0.22, y + 0.29, z, '#a38c5c');
      box(root, 0.66, 0.045, 0.025, x, y + 0.29 + side * 0.2, z + 0.433, C.dark);
    }
    beam(root, [x - 0.25, y + 0.05, z + 0.43], [x + 0.25, y + 0.53, z + 0.43], 0.021, '#b19a6e');
  }
  function barrel(x: number, z: number) {
    cyl(root, 0.18, 0.16, 0.4, x, deckY + 0.21, z, C.wood, 14);
    for (const y of [0.07, 0.32]) cyl(root, 0.181, 0.181, 0.025, x, deckY + y, z, C.dark, 14);
  }
  if (small) {
    for (const z of [-0.82, 0.34]) box(root, width * 0.72, 0.065, 0.21, 0, 0.4, z, '#94754e');
    if (age === 1) {
      for (const side of [-1, 1]) {
        beam(root, [side * 0.3, 0.34, 0], [side * 1.04, 0.15, -0.72], 0.022, C.wood);
        const blade = box(root, 0.14, 0.035, 0.44, side * 1.08, 0.13, -0.88, C.wood);
        blade.rotation.y = -side * 0.44;
      }
    } else mast(-0.1, 2.85, true);
    for (const x of [-0.23, 0.23]) barrel(x, 0.86);
    for (let i = 0; i < 7; i++) {
      const f = i / 6;
      tube(
        root,
        [
          [-0.38, 0.4, -0.6 + f * 0.65],
          [-0.61, 0.23, -0.6 + f * 0.65],
          [-0.54, 0.1, -0.6 + f * 0.65],
        ],
        0.008,
        '#8c8766',
      );
      beam(root, [-0.38 - f * 0.18, 0.4 - f * 0.3, -0.6], [-0.38 - f * 0.18, 0.4 - f * 0.3, 0.05], 0.007, '#8c8766');
    }
    cyl(root, 0.1, 0.085, 0.14, 0.38, 0.4, -0.85, C.cloth, 12);
    beam(root, [0.38, 0.3, -0.85], [0.3, 0.3, 0.6], 0.008, C.pants);
  } else if (kind === 'tradeShip') {
    if (age === 2) {
      bridge(-length * 0.35, width * 0.65, 0.6);
      for (const side of [-1, 1])
        for (let i = 0; i < 6; i++)
          beam(
            root,
            [side * half * 0.8, 0.28, -2 + i * 0.65],
            [side * (half + 1), 0.09, -2.6 + i * 0.65],
            0.027,
            C.wood,
          );
      mast(0.2, 4.5);
      for (let i = 0; i < 4; i++) cargo(0, -1.5 + i * 0.8);
    } else {
      bridge(-length * 0.34, width * 0.72, age === 3 ? 1.5 : 1.1);
      for (const x of [-width * 0.23, width * 0.23]) for (let i = 0; i < 3; i++) cargo(x, -length * 0.12 + i * 1.3);
      mast(-1.1, 6);
      if (age === 4) {
        mast(2, 5.1);
        mast(-3, 4.6, true);
      } else {
        box(root, width * 0.55, 0.9, 1.2, 0, 0.68, length * 0.32, C.wood);
        box(root, width * 0.6, 0.1, 1.3, 0, 1.17, length * 0.32, C.cloth);
      }
    }
  } else if (kind === 'transport') {
    if (age === 2) {
      for (const x of [-0.9, 0.9]) box(root, 0.3, 0.22, 4.2, x, 0.4, 0, C.wood);
      mast(-0.8, 3.5);
      for (const side of [-1, 1])
        for (let i = 0; i < 7; i++)
          beam(root, [side * 0.9, 0.28, -2 + i * 0.6], [side * 2.2, 0.1, -2.7 + i * 0.6], 0.025, C.wood);
    } else {
      bridge(-2.35, 2.15, age === 3 ? 1.3 : 0.85);
      for (const x of [-0.9, 0.9]) box(root, 0.3, 0.22, 3.2, x, 0.4, 0.3, C.wood);
      mast(-1.3, 4.6);
      if (age === 4) {
        mast(1.4, 4.1, true);
        for (const x of [-1.2, 1.2])
          for (let z = -1; z < 2; z += 0.5) beam(root, [x, 0.5, z], [x, 1.1, z], 0.025, C.wood);
      }
    }
    const ramp = joint(root, 'landingRamp', 0, deckY, 3.45);
    box(ramp, 1.7, 0.1, 1.45, 0, 0, 0.55, C.wood);
    for (let i = 0; i < 6; i++) box(ramp, 1.72, 0.035, 0.03, 0, 0.065, -0.05 + i * 0.24, C.dark);
    ramp.rotation.x = -0.18;
  } else if (kind === 'fireCraft') {
    for (let i = 0; i < 6; i++) barrel(((i % 2) - 0.5) * 0.55, -1 + Math.floor(i / 2) * 0.65);
    mast(-1.2, 3.1, true);
    beam(root, [0, 0.2, 1.8], [0, 0.3, 3.1], 0.12, C.dark, 0.025);
    addShot(root, 'grenade', 3, 1.3, [0, 0.6, 1.3]);
  } else if (kind === 'bombardVessel') {
    bridge(-2.35, 2, 0.95);
    const turret = joint(root, 'mortarTurret', 0, 0.5, 0.65);
    cyl(turret, 0.7, 0.85, 0.55, 0, 0.12, 0, C.wood, 16);
    const barrel = cyl(turret, 0.23, 0.31, 1.8, 0, 1, 0.3, C.dark, 24);
    barrel.rotation.x = 0.65;
    const muzzle = joint(turret, 'mortarMuzzle', 0, 1, 0.3);
    muzzle.rotation.x = 0.65;
    cyl(muzzle, 0.18, 0.18, 0.014, 0, 0.909, 0, '#14201c', 24);
    cyl(muzzle, 0.25, 0.25, 0.09, 0, 0.84, 0, C.gold, 24);
    mast(-1.4, 4, true);
    addShot(root, 'shell', 4, 1.1, [0, 1.8, 1.4]);
  } else {
    bridge(-length * 0.34, width * 0.75, kind === 'frigate' ? 1.35 : 0.65);
    const count = kind === 'frigate' ? 3 : kind === 'sloop' ? 1 : 2;
    for (let i = 0; i < count; i++)
      mast(
        count === 1 ? 0 : -length * 0.22 + i * length * 0.24,
        kind === 'frigate' ? 7 - Math.abs(i - 1) : kind === 'sloop' ? 4.7 : 5.8,
        i === 0 && kind === 'sloop',
      );
    for (const side of [-1, 1])
      for (let i = 0; i < (kind === 'frigate' ? 6 : 2); i++)
        cannon(side * half * 0.87, -length * 0.18 + i * (kind === 'frigate' ? 0.82 : 1.1), side);
    addShot(root, 'shell', 3, 0.7, [half, 0.7, 0], [1, 0, 0]);
  }
  if (!small) {
    beam(root, [0, depth * 0.73, length * 0.44], [0, depth * 1.1, length * 0.64], 0.055, C.wood, 0.03);
    tube(
      root,
      [
        [0, depth * 1.1, length * 0.64],
        [0, 2.5, length * 0.24],
        [0, 4.1, -length * 0.1],
      ],
      0.01,
      C.pants,
    );
    const rudder = box(root, 0.12, 0.76, 0.66, 0, -0.18, -length * 0.49, C.wood);
    rudder.rotation.x = 0.16;
    for (const side of [-1, 1]) {
      const anchor = joint(root, 'anchor', side * half * 0.52, 0.27, length * 0.37);
      beam(anchor, [0, 0.45, 0], [0, -0.25, 0], 0.025, C.dark);
      tube(
        anchor,
        [
          [-0.25, -0.1, 0],
          [-0.19, -0.25, 0],
          [0, -0.29, 0],
          [0.19, -0.25, 0],
          [0.25, -0.1, 0],
        ],
        0.029,
        C.dark,
      );
      beam(anchor, [-0.14, 0.25, 0], [0.14, 0.25, 0], 0.02, C.dark);
    }
  }
  const moving = root.children.filter((o) => o.name === 'projectile' || o.name === 'shotFlash');
  moving.forEach((o) => root.remove(o));
  const surfaces = consolidate(root);
  surfaces.name = 'navalSurfaces';
  root.clear();
  root.add(surfaces, ...moving);
  return root;
}
