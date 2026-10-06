import * as T from 'three';
import {C, mat, mesh, box, cyl, ball, beam, tube, joint, finishRig, consolidate} from './geometry';
export {C, mat, mesh, box, cyl, ball, beam, consolidate} from './geometry';
import {buildPerson, buildRider, buildSheep, buildFish, animateAsset} from './actors';
import {buildTree, buildBush, buildMine} from './nature';
import {extraInfo, buildExtended, buildingKinds, type ExtraKind} from './extended';
import {architecture} from './architecture';
import {defaultAge, validateAge} from './ages';
import {addShot} from './combat';
import {buildNaval, navalKinds} from './naval';
export {animateAsset};

// Original Meridian kit. World units are metres; Y is up, building fronts face +Z.
function roof(p: T.Group, w: number, d: number, y: number, rise: number) {
  const pos = [
    -w / 2,
    y,
    -d / 2,
    w / 2,
    y,
    -d / 2,
    w / 2 - 0.6,
    y + rise,
    0,
    -w / 2 + 0.6,
    y + rise,
    0,
    -w / 2,
    y,
    d / 2,
    -w / 2 + 0.6,
    y + rise,
    0,
    w / 2 - 0.6,
    y + rise,
    0,
    w / 2,
    y,
    d / 2,
    -w / 2,
    y,
    -d / 2,
    -w / 2 + 0.6,
    y + rise,
    0,
    -w / 2,
    y,
    d / 2,
    w / 2,
    y,
    -d / 2,
    w / 2,
    y,
    d / 2,
    w / 2 - 0.6,
    y + rise,
    0,
  ];
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setIndex([0, 2, 1, 0, 3, 2, 4, 6, 5, 4, 7, 6, 8, 10, 9, 11, 13, 12]);
  g.computeVertexNormals();
  const m = mat(C.roof);
  m.side = T.DoubleSide;
  mesh(g, m, p);
  beam(p, [-w / 2 + 0.55, y + rise, 0], [w / 2 - 0.55, y + rise, 0], 0.12, C.roof2);
  // Raised seams and staggered tiles remain visible at inspection distance.
  for (let side = -1; side <= 1; side += 2) {
    for (let row = 0; row < 7; row++) {
      const f = (row + 0.5) / 7,
        z = side * d * 0.5 * f,
        yy = y + rise * (1 - f) + 0.03;
      const ww = w - 1.2 * (1 - f);
      beam(p, [-ww / 2, yy, z], [ww / 2, yy, z], 0.028, row % 2 ? C.roof2 : '#507872');
    }
    for (let i = 0; i <= Math.floor(w / 0.48); i++) {
      const x = -w / 2 + 0.16 + i * 0.48;
      beam(p, [x * 0.88, y + rise + 0.025, 0], [x, y + 0.03, (side * d) / 2], 0.018, '#638780');
    }
  }
  for (const z of [-d / 2, d / 2]) box(p, w, 0.18, 0.17, 0, y, z, C.trim);
}
function arch(p: T.Group, x: number, y: number, z: number, w: number, h: number, door = false) {
  const s = new T.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, h - w / 2);
  s.absarc(0, h - w / 2, w / 2, 0, Math.PI, false);
  s.lineTo(-w / 2, 0);
  mesh(new T.ShapeGeometry(s, 12), mat(door ? C.wood : C.glass, 0.55), p, x, y, z);
  box(p, w + 0.14, 0.12, 0.18, x, y, z + 0.035, C.trim);
  for (const side of [-1, 1])
    box(p, 0.1, h - w * 0.45, 0.15, x + side * (w / 2 + 0.055), y + (h - w * 0.45) / 2, z + 0.03, C.trim);
  const curve = new T.EllipseCurve(0, 0, w * 0.5 + 0.05, w * 0.5 + 0.05, 0, Math.PI, false, 0);
  const pts = curve.getPoints(12).map((v) => new T.Vector3(v.x + x, v.y + y + h - w * 0.5, z + 0.03));
  mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 16, 0.065, 5, false), mat(C.trim), p);
  if (!door) {
    box(p, 0.055, h - 0.1, 0.05, x, y + h / 2, z + 0.04, C.gold);
    box(p, w, 0.05, 0.05, x, y + h * 0.5, z + 0.05, C.gold);
  } else {
    for (let i = 0; i < 5; i++) box(p, 0.023, h * 0.7, 0.02, x - w * 0.4 + i * w * 0.2, y + h * 0.35, z + 0.02, C.dark);
    ball(p, x + w * 0.24, y + h * 0.4, z + 0.08, 0.055, 0.055, 0.045, C.gold);
  }
}
function shell(p: T.Group, w: number, h: number, d: number) {
  box(p, w + 0.5, 0.35, d + 0.5, 0, 0.18, 0, '#9e9b87');
  box(p, w, h, d, 0, h / 2 + 0.3, 0, C.stone);
  box(p, w + 0.15, 0.15, d + 0.15, 0, 0.65, 0, C.trim);
  box(p, w + 0.2, 0.2, d + 0.2, 0, h + 0.28, 0, C.light);
  for (const x of [-w / 2, w / 2])
    for (const z of [-d / 2, d / 2]) {
      box(p, 0.25, h, 0.25, x, h / 2 + 0.3, z, C.light);
      for (let y = 0.5; y < h; y += 0.42) box(p, 0.32, 0.12, 0.32, x, y, z, '#b6ac93');
    }
  roof(p, w + 0.7, d + 0.7, h + 0.42, h * 0.38);
}
export type AssetKind =
  | ExtraKind
  | 'hall'
  | 'house'
  | 'market'
  | 'tower'
  | 'infantry'
  | 'cavalry'
  | 'cannon'
  | 'ship'
  | 'fishingBoat'
  | 'villager'
  | 'sheep'
  | 'bush'
  | 'berries'
  | 'mine'
  | 'fish'
  | 'tree'
  | 'pine';
export const assetInfo: Record<AssetKind, {name: string; category: string; description: string}> = {
  ...extraInfo,
  hall: {
    name: 'Charter Hall',
    category: 'CIVIC ARCHITECTURE',
    description:
      'Limestone arcades, a copper cupola and a sea-green charter banner. The civic heart of the Aurelian League.',
  },
  house: {
    name: 'Harbor Residence',
    category: 'SETTLEMENT ARCHITECTURE',
    description: 'Plastered stone, tiled copper-green roofing, shuttered windows and a sheltered street entrance.',
  },
  market: {
    name: 'Exchange House',
    category: 'TRADE ARCHITECTURE',
    description: 'A timber-framed covered exchange, striped canvas stalls and hand-built cargo props.',
  },
  tower: {
    name: 'Coastal Watch',
    category: 'DEFENSIVE ARCHITECTURE',
    description:
      'Battered stone walls, projecting timber gallery and a steep watch roof define the frontier silhouette.',
  },
  infantry: {
    name: 'Charter Fusilier',
    category: 'LINE INFANTRY',
    description:
      'A long teal coat, brass-trimmed cap, crossbelt, field pack and full-length rifle. Team color stays on the cloth.',
  },
  cavalry: {
    name: 'League Lancer',
    category: 'MOUNTED UNIT',
    description:
      'A chestnut mount, layered saddle cloth and a pennant-tipped lance give this scout a clear mounted silhouette.',
  },
  cannon: {
    name: 'Brass Fieldpiece',
    category: 'ARTILLERY',
    description:
      'A bronze field gun with fitted barrel bands and two uniformed crew. Watch loading, ramming, recoil and movement.',
  },
  ship: {
    name: 'Coastal Cutter',
    category: 'NAVAL ARCHITECTURE',
    description: 'A sealed plank hull, raised quarterdeck, cream canvas sails and complete standing rigging.',
  },
  fishingBoat: {
    name: 'Harbor Fishing Boat',
    category: 'FISHING VESSEL',
    description: 'An open working deck with a small sail, net rack, oars and fish baskets.',
  },
  villager: {
    name: 'Frontier Worker',
    category: 'CIVILIAN',
    description:
      'A plain face with ears, a low straw hat and a teal work apron. Separate two-handed pick and hoe animations.',
  },
  sheep: {
    name: 'Meadow Sheep',
    category: 'HERD ANIMAL',
    description: 'An articulated grazing sheep with fleece, cloven hooves and a teal collar identifying its owner.',
  },
  bush: {
    name: 'Coastal Hazel',
    category: 'VEGETATION',
    description: 'A branching shrub with individual leaf sprays and a soft, irregular silhouette.',
  },
  berries: {
    name: 'Redberry Thicket',
    category: 'PROVISIONS',
    description:
      'Clusters of ripe red berries among layered leaves. Reserved resource footprints keep the thicket clear.',
  },
  mine: {
    name: 'Gold-bearing Outcrop',
    category: 'COIN RESOURCE',
    description: 'Original angular stone with exposed gold deposits. Inspect the full and depleted ore states.',
  },
  fish: {
    name: 'Silverfin Shoal',
    category: 'FISHING GROUND',
    description: 'One to three silverfin break the surface in intermittent jumps, marking a fishing habitat.',
  },
  tree: {
    name: 'Coastal Oak',
    category: 'BROADLEAF TREE',
    description: 'A tapered branching trunk with thousands of individual leaves arranged in irregular sprays.',
  },
  pine: {
    name: 'Frontier Pine',
    category: 'CONIFER TREE',
    description: 'Open radial branches and layered needle sprays, with a narrow wind-shaped crown.',
  },
};
export function wheel(p: T.Group, x: number, y: number, z: number, r: number) {
  const tire = mesh(new T.TorusGeometry(r, 0.055, 8, 32), mat(C.dark, 0.42, 0.45), p, x, y, z);
  tire.rotation.y = Math.PI / 2;
  const rim = mesh(new T.TorusGeometry(r - 0.075, 0.06, 8, 32), mat(C.wood), p, x, y, z);
  rim.rotation.y = Math.PI / 2;
  beam(p, [x - 0.14, y, z], [x + 0.14, y, z], 0.13, C.wood);
  for (const side of [-1, 1]) {
    const boss = cyl(p, 0.105, 0.105, 0.045, x + side * 0.15, y, z, C.gold, 16);
    boss.rotation.z = Math.PI / 2;
  }
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    beam(
      p,
      [x, y + Math.cos(a) * 0.1, z + Math.sin(a) * 0.1],
      [x, y + Math.cos(a) * (r - 0.1), z + Math.sin(a) * (r - 0.1)],
      0.03,
      C.wood,
      0.038,
    );
    for (const side of [-1, 1])
      ball(
        p,
        x + side * 0.038,
        y + Math.cos(a) * (r - 0.06),
        z + Math.sin(a) * (r - 0.06),
        0.024,
        0.024,
        0.024,
        C.dark,
        0,
      );
  }
}
export function buildAsset(kind: AssetKind, age = defaultAge(kind)): T.Group {
  validateAge(kind, age);
  if (buildingKinds.has(kind)) return architecture(kind, age);
  if (navalKinds.has(kind)) return buildNaval(kind, age);
  if (kind in extraInfo) {
    const model = buildExtended(kind as ExtraKind, (k) => buildAsset(k as AssetKind), age);
    model.name = kind;
    return model;
  }
  const p = new T.Group();
  if (kind === 'infantry' || kind === 'villager') return buildPerson(kind === 'villager', false, false, false, age);
  if (kind === 'cavalry') return buildRider(age);
  if (kind === 'sheep') return buildSheep();
  if (kind === 'fish') return buildFish();
  if (kind === 'bush' || kind === 'berries') return buildBush(901, kind === 'berries');
  if (kind === 'mine') return buildMine();
  if (kind === 'tree' || kind === 'pine') return buildTree(127, kind === 'pine');
  if (kind === 'fishingBoat') {
    const stations = [
        [-2.1, 0.035],
        [-1.5, 0.62],
        [-0.5, 0.85],
        [0.6, 0.77],
        [1.6, 0.44],
        [2.15, 0.015],
      ],
      v: number[] = [],
      ix: number[] = [];
    stations.forEach(([z, w]) => {
      v.push(-w, 0.48, z, -w * 0.73, -0.05, z, 0, -0.28, z, w * 0.73, -0.05, z, w, 0.48, z);
    });
    for (let i = 0; i < stations.length - 1; i++)
      for (let j = 0; j < 4; j++) {
        const a = i * 5 + j;
        ix.push(a, a + 1, a + 5, a + 1, a + 6, a + 5);
      }
    const hull = new T.BufferGeometry();
    hull.setAttribute('position', new T.Float32BufferAttribute(v, 3));
    hull.setIndex(ix);
    hull.computeVertexNormals();
    const hm = mat('#6b4f35');
    hm.side = T.DoubleSide;
    mesh(hull, hm, p);
    const shape = new T.Shape();
    stations.forEach(([z, w], i) => (i ? shape.lineTo(w, -z) : shape.moveTo(w, -z)));
    [...stations].reverse().forEach(([z, w]) => shape.lineTo(-w, -z));
    const deck = new T.ShapeGeometry(shape);
    deck.rotateX(-Math.PI / 2);
    mesh(deck, mat('#b4996a'), p, 0, 0.21, 0);
    for (const s of [-1, 1]) {
      tube(
        p,
        stations.map(([z, w]) => [s * w, 0.49, z]),
        0.042,
        C.trim,
      );
      tube(
        p,
        stations.map(([z, w]) => [s * w * 0.91, 0.35, z]),
        0.055,
        C.cloth,
      );
    }
    for (const z of [-1, 0.4]) box(p, 1.25, 0.08, 0.3, 0, 0.51, z, '#8b6e47');
    beam(p, [0, 0.2, -0.1], [0, 3.7, -0.1], 0.04, C.wood);
    const sail = new T.Shape();
    sail.moveTo(0, 0);
    sail.lineTo(0, 2.8);
    sail.quadraticCurveTo(1.0, 1.4, 1.5, 0);
    sail.closePath();
    const sm = mat('#e9dbc0');
    sm.side = T.DoubleSide;
    mesh(new T.ShapeGeometry(sail, 12), sm, p, 0.03, 0.76, -0.1);
    beam(p, [0, 0.76, -0.1], [1.54, 0.76, -0.1], 0.025, C.wood);
    for (const x of [-0.72, 0.72]) {
      beam(p, [x, 0.46, -0.9], [x * 1.55, 0.34, 1.5], 0.025, C.wood);
      const blade = box(p, 0.15, 0.035, 0.55, x * 1.55, 0.34, 1.5, '#a18658');
      blade.rotation.y = x * 0.3;
    }
    for (const x of [-0.38, 0.32]) {
      cyl(p, 0.2, 0.16, 0.31, x, 0.42, -1.2, '#9e8255', 14);
      cyl(p, 0.16, 0.16, 0.025, x, 0.585, -1.2, '#485951', 14);
    }
    for (let i = 0; i < 8; i++) {
      const f = i / 7;
      tube(
        p,
        [
          [-0.65, 0.5, -0.4 + f * 0.9],
          [-0.94, 0.04, -0.4 + f * 0.9],
          [-0.86, -0.05, -0.4 + f * 0.9],
        ],
        0.007,
        '#817c58',
      );
      beam(p, [-0.65 - f * 0.25, 0.5 - f * 0.55, -0.4], [-0.65 - f * 0.25, 0.5 - f * 0.55, 0.5], 0.007, '#817c58');
    }
    const result = consolidate(p);
    result.name = kind;
    return result;
  }
  if (kind === 'hall') {
    shell(p, 7, 4, 4.5);
    for (const x of [-2.3, 0, 2.3]) {
      arch(p, x, 0.38, 2.26, 1.05, 2, true);
      arch(p, x, 2.7, 2.27, 0.7, 1.2);
    }
    for (const x of [-3.9, 3.9]) {
      const wing = new T.Group();
      shell(wing, 2.1, 2.8, 3.6);
      arch(wing, 0, 0.6, 1.81, 0.8, 1.4);
      wing.position.x = x;
      p.add(wing);
    }
    box(p, 3.7, 0.3, 1.4, 0, 0.2, 2.8, C.stone);
    box(p, 3.2, 0.18, 1.2, 0, 0.12, 3.6, C.trim);
    for (const x of [-1.4, 1.4]) {
      cyl(p, 0.12, 0.16, 2.25, x, 1.4, 3.05, C.light);
      cyl(p, 0.22, 0.22, 0.14, x, 2.55, 3.05, C.trim);
    }
    box(p, 3.4, 0.22, 1.3, 0, 2.72, 2.85, C.trim);
    cyl(p, 1.05, 1.13, 0.22, 0, 5.98, 0, C.trim, 8);
    cyl(p, 0.76, 0.76, 1.22, 0, 6.58, 0, C.light, 8);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      box(p, 0.12, 0.8, 0.12, Math.sin(a) * 0.78, 6.6, Math.cos(a) * 0.78, C.trim);
    }
    cyl(p, 0.12, 1.15, 1.45, 0, 7.8, 0, C.roof, 8);
    ball(p, 0, 8.58, 0, 0.16, 0.16, 0.16, C.gold);
    beam(p, [0, 8.6, 0], [0, 9.6, 0], 0.035, C.gold);
    const b = box(p, 0.72, 0.9, 0.04, 0, 3.35, 2.36, C.cloth);
    box(p, 0.05, 0.75, 0.045, b.position.x, 3.35, 2.39, C.gold);
    for (const x of [-3, 3]) {
      box(p, 0.4, 0.65, 0.4, x, 0.45, 2.9, C.wood);
      ball(p, x, 1, 2.9, 0.42, 0.47, 0.42, '#5e7045');
    }
  } else if (kind === 'house') {
    shell(p, 3.2, 2.4, 2.8);
    arch(p, -0.65, 0.35, 1.42, 0.62, 1.6, true);
    arch(p, 0.7, 1, 1.42, 0.65, 0.95);
    for (const x of [0.18, 1.21]) box(p, 0.28, 0.95, 0.09, x, 1.48, 1.47, C.roof);
    box(p, 0.55, 1.5, 0.55, -0.8, 3.6, -0.65, '#b6a88e');
    box(p, 0.72, 0.15, 0.7, -0.8, 4.39, -0.65, C.trim);
    box(p, 0.42, 0.35, 0.5, 1.9, 0.3, 1.05, C.wood);
    ball(p, 1.85, 0.7, 1.05, 0.32, 0.3, 0.3, '#70804e');
  } else if (kind === 'market') {
    shell(p, 5, 2.5, 3.2);
    for (const x of [-1.5, 0, 1.5]) arch(p, x, 0.4, 1.62, 0.95, 1.65, true);
    for (const x of [-2.7, 2.7]) beam(p, [x, 0, 3.2], [x, 2.5, 3.2], 0.07, C.wood);
    for (let i = 0; i < 10; i++) {
      const a = box(p, 0.55, 0.06, 2, -2.475 + i * 0.55, 2.58, 2.35, i % 2 ? C.light : C.cloth);
      a.rotation.x = 0.16;
      box(p, 0.55, 0.26, 0.04, -2.475 + i * 0.55, 2.28, 3.32, i % 2 ? C.light : C.cloth);
    }
    for (const x of [-1.8, 0, 1.8]) {
      box(p, 1.3, 0.8, 0.8, x, 0.45, 2.7, C.wood);
      for (let j = 0; j < 4; j++) ball(p, x - 0.4 + j * 0.25, 1, 2.7, 0.15, 0.15, 0.15, j % 2 ? '#b88a40' : '#869050');
    }
  } else if (kind === 'tower') {
    cyl(p, 1.15, 1.6, 4.5, 0, 2.25, 0, C.stone, 8);
    cyl(p, 1.65, 1.65, 0.25, 0, 4.25, 0, C.wood, 8);
    cyl(p, 1.4, 1.4, 1.3, 0, 4.95, 0, C.wood, 8);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      box(p, 0.18, 1.4, 0.18, Math.sin(a) * 1.48, 4.95, Math.cos(a) * 1.48, C.trim);
    }
    cyl(p, 0, 2.05, 2, 0, 6.6, 0, C.roof, 8);
    arch(p, 0, 0.1, 1.49, 0.6, 1.65, true);
    for (const y of [1.8, 3]) box(p, 0.2, 0.55, 0.1, 0, y, 1.32, C.dark);
  } else if (kind === 'cannon') {
    p.userData.artillery = true;
    addShot(p, 'shell', 7, 5, [0, 1.1, 1.5]);
    for (const x of [-0.73, 0.73]) {
      const pivot = joint(p, `cannonWheel${x}`, x, 0.65, 0);
      wheel(pivot, 0, 0, 0, 0.64);
    }
    beam(p, [-0.85, 0.65, 0], [0.85, 0.65, 0], 0.09, C.dark);
    for (const x of [-0.38, 0.38]) {
      beam(p, [x, 0.82, 0.3], [x * 0.6, 0.18, -1.9], 0.12, C.wood);
      box(p, 0.16, 0.55, 0.9, x, 0.7, 0, C.wood);
      box(p, 0.17, 0.09, 0.8, x, 0.91, 0, C.cloth);
    }
    const barrel = joint(p, 'barrel', 0, 1.1, 0.15);
    barrel.rotation.x = Math.PI / 2 - 0.1;
    const profile = [
      new T.Vector2(0.12, -0.9),
      new T.Vector2(0.26, -0.75),
      new T.Vector2(0.24, -0.3),
      new T.Vector2(0.19, 1.1),
      new T.Vector2(0.24, 1.18),
      new T.Vector2(0.24, 1.32),
      new T.Vector2(0.13, 1.34),
      new T.Vector2(0.13, 0.96),
    ];
    mesh(new T.LatheGeometry(profile, 32), mat('#a98950', 0.44, 0.65), barrel);
    cyl(barrel, 0.125, 0.125, 0.08, 0, -0.88, 0, '#947544', 20);
    ball(barrel, 0, -1.02, 0, 0.1, 0.12, 0.1, '#a98950', 2);
    cyl(barrel, 0.13, 0.13, 0.025, 0, 0.96, 0, '#202523', 20);
    for (const [y, r] of [
      [-0.72, 0.263],
      [-0.29, 0.242],
      [0.56, 0.211],
      [1.25, 0.242],
    ]) {
      const ring = mesh(new T.TorusGeometry(r, 0.018, 6, 20), mat(C.gold, 0.4, 0.6), barrel, 0, y, 0);
      ring.rotation.x = Math.PI / 2;
      ring.name = 'barrelBand';
    }
    // Trunnions, iron straps and elevating screw make the carriage mechanically legible.
    for (const side of [-1, 1]) {
      beam(p, [side * 0.18, 1.1, 0.1], [side * 0.5, 1.1, 0.1], 0.085, '#8f7748');
      box(p, 0.2, 0.1, 0.32, side * 0.38, 1.04, 0.1, C.dark);
      for (const z of [-0.3, 0.31]) {
        box(p, 0.18, 0.3, 0.07, side * 0.39, 0.7, z, C.dark);
        ball(p, side * 0.49, 0.71, z, 0.025, 0.035, 0.025, C.gold, 0);
      }
      beam(p, [side * 0.4, 0.42, -0.78], [side * 0.29, 0.22, -1.72], 0.035, C.dark);
    }
    beam(p, [0, 0.45, -0.76], [0, 0.86, -0.57], 0.035, C.dark);
    box(p, 0.45, 0.12, 0.38, 0, 0.4, -0.76, C.wood);
    const elevatingWheel = mesh(new T.TorusGeometry(0.15, 0.021, 6, 16), mat(C.dark, 0.4, 0.5), p, 0, 0.53, -0.9);
    elevatingWheel.rotation.x = -0.5;
    const ammoChest = joint(p, 'ammunitionChest', 0.62, 0, -1.53);
    box(ammoChest, 0.49, 0.37, 0.6, 0, 0.2, 0, C.wood);
    box(ammoChest, 0.53, 0.055, 0.64, 0, 0.415, 0, C.cloth);
    for (const x of [-0.15, 0.15]) box(ammoChest, 0.038, 0.39, 0.62, x, 0.21, 0, C.dark);
    box(ammoChest, 0.1, 0.07, 0.065, 0, 0.32, 0.33, C.gold);
    const flash = joint(barrel, 'muzzleFlash', 0, 1.5, 0);
    mesh(
      new T.SphereGeometry(0.13, 8, 6),
      new T.MeshBasicMaterial({color: '#ffdc8e', toneMapped: false}),
      flash,
      0,
      0.02,
      0,
    ).scale.y = 1.8;
    const loader = buildPerson(false, false, true, false, age);
    loader.name = 'loader';
    loader.position.set(-1.15, 0, -0.68);
    loader.rotation.y = Math.PI / 2;
    p.add(loader);
    const ammo = new T.Group();
    ammo.name = 'ammo';
    ball(ammo, 0, 0.03, 0.06, 0.105, 0.105, 0.105, '#343e39', 2);
    loader.getObjectByName('hand1')!.add(ammo);
    const rammer = buildPerson(false, false, true, false, age);
    rammer.name = 'rammer';
    rammer.position.set(1.23, 0, 0.46);
    rammer.rotation.y = -Math.PI / 2;
    p.add(rammer);
    const swab = joint(p, 'swab', 0, 1.25, 2.4);
    beam(swab, [0, 0, -0.9], [0, 0, 0.6], 0.025, C.wood);
    const swabTip = cyl(swab, 0.062, 0.062, 0.16, 0, 0, -0.9, '#9c9c83', 12);
    swabTip.rotation.x = Math.PI / 2;
    const result = finishRig(p);
    result.name = 'cannon';
    return result;
  } else if (kind === 'ship') {
    const sections = [
      [-4.8, 0.05, 0.45],
      [-3.7, 1.1, 0.0],
      [-2, 1.5, -0.25],
      [0, 1.6, -0.3],
      [2, 1.35, -0.1],
      [3.6, 0.6, 0.35],
      [4.35, 0.02, 0.9],
    ];
    const vertices: number[] = [];
    const indices: number[] = [];
    for (const [z, w, y] of sections) {
      for (const [xx, yy] of [
        [-w, 1.05 + y],
        [-w * 0.8, 0.25 + y],
        [0, -0.4 + y],
        [w * 0.8, 0.25 + y],
        [w, 1.05 + y],
      ])
        vertices.push(xx, yy, z);
    }
    for (let s = 0; s < sections.length - 1; s++)
      for (let j = 0; j < 4; j++) {
        const a = s * 5 + j,
          b = a + 5;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    const hull = mat('#614834');
    hull.side = T.DoubleSide;
    mesh(g, hull, p);
    const deckPositions: number[] = [],
      deckIndices: number[] = [];
    sections.forEach(([z, w, y]) => deckPositions.push(-w * 0.96, 0.9 + y, z, 0, 0.9 + y, z, w * 0.96, 0.9 + y, z));
    for (let i = 0; i < sections.length - 1; i++)
      for (let j = 0; j < 2; j++) {
        const a = i * 3 + j;
        deckIndices.push(a, a + 3, a + 1, a + 1, a + 3, a + 4);
      }
    const dg = new T.BufferGeometry();
    dg.setAttribute('position', new T.Float32BufferAttribute(deckPositions, 3));
    dg.setIndex(deckIndices);
    dg.computeVertexNormals();
    mesh(dg, mat('#ac9061'), p);
    for (const side of [-1, 1])
      for (let i = 0; i < sections.length - 1; i++) {
        const [z, w, y] = sections[i],
          [zz, ww, yy] = sections[i + 1];
        beam(p, [w * side, 1.15 + y, z], [ww * side, 1.15 + yy, zz], 0.075, C.gold);
        beam(p, [w * 0.9 * side, 0.6 + y, z], [ww * 0.9 * side, 0.6 + yy, zz], 0.07, C.cloth);
      }
    box(p, 2, 0.9, 1.5, 0, 1.25, -2.8, C.wood);
    box(p, 2.2, 0.1, 1.7, 0, 1.75, -2.8, C.trim);
    for (const [z, h] of [
      [-0.9, 7],
      [1.65, 5.5],
    ]) {
      beam(p, [0, 0.58, z], [0, h, z], 0.07, C.wood);
      beam(p, [-1.9, h - 0.7, z], [1.9, h - 0.7, z], 0.045, C.wood);
      for (const x of [-1.5, 1.5]) {
        beam(p, [0, h, z], [x, 1.1, z - 1.5], 0.012, C.pants);
        beam(p, [0, h, z], [x, 1.1, z + 1.5], 0.012, C.pants);
      }
      const geo = new T.PlaneGeometry(3.7, h * 0.48, 10, 10);
      const a = geo.attributes.position;
      for (let i = 0; i < a.count; i++) {
        const x = a.getX(i),
          y = a.getY(i);
        a.setZ(i, Math.sin((x / 3.7 + 0.5) * Math.PI) * Math.sin((y / (h * 0.48) + 0.5) * Math.PI) * 0.6);
      }
      geo.computeVertexNormals();
      const sail = mat('#e9dbc0');
      sail.side = T.DoubleSide;
      mesh(geo, sail, p, 0, h - 0.7 - h * 0.24, z + 0.04);
    }
    const ensign = new T.Shape();
    ensign.moveTo(0, 0);
    ensign.lineTo(0.8, -0.06);
    ensign.lineTo(0.75, -0.45);
    ensign.lineTo(0, -0.43);
    const em = mat(C.cloth);
    em.side = T.DoubleSide;
    mesh(new T.ShapeGeometry(ensign), em, p, 0, 7.08, -0.9);
    beam(p, [0, 1.7, 3.7], [0, 2.6, 6], 0.065, C.wood);
    beam(p, [0, 5.5, 1.65], [0, 2.6, 6], 0.015, C.pants);
  }
  const result = consolidate(p);
  result.name = kind;
  return result;
}
