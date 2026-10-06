import * as T from 'three';
import {C, box, cyl, beam, mesh, mat, joint, consolidate, ball} from './geometry';
import {buildingFootprint} from './footprints';

// Buildings have no skeletal motion. Bake every rigid surface into shared-material
// batches while retaining roof groups for construction and structural collapse.
function finishArchitecture(root: T.Group) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert(),
    body = new T.Group(),
    roofs = new Map<T.Object3D, T.Group>(),
    markers: T.Group[] = [],
    originals = new Set<T.BufferGeometry>();
  root.traverse((o) => {
    if (
      o instanceof T.Group &&
      o !== root &&
      o.name &&
      !['roof', 'window', 'sideFacade', 'arrowSlit', 'yardFence', 'factionMarker', 'cargo', 'dormer'].includes(o.name)
    ) {
      const marker = new T.Group();
      marker.name = o.name;
      inverse.clone().multiply(o.matrixWorld).decompose(marker.position, marker.quaternion, marker.scale);
      markers.push(marker);
    }
    if (o instanceof T.Mesh) {
      let roof: T.Object3D | undefined,
        parent: T.Object3D | null = o.parent;
      while (parent && parent !== root) {
        if (parent.name === 'roof' || parent.name === 'factionFlag') {
          roof = parent;
          break;
        }
        parent = parent.parent;
      }
      let target = body;
      if (roof) {
        if (!roofs.has(roof)) {
          const group = new T.Group();
          group.name = roof.name;
          roofs.set(roof, group);
        }
        target = roofs.get(roof)!;
      }
      originals.add(o.geometry);
      const geometry = o.geometry.clone().applyMatrix4(inverse.clone().multiply(o.matrixWorld));
      mesh(geometry, o.material as T.Material, target);
    }
  });
  root.clear();
  const solid = consolidate(body);
  solid.name = 'architectureSurfaces';
  root.add(solid);
  for (const [original, bucket] of roofs) {
    const merged = consolidate(bucket);
    merged.name = original.name;
    root.add(merged);
  }
  for (const marker of markers) root.add(marker);
  originals.forEach((g) => g.dispose());
  return root;
}
const production = new Set(['barracks', 'archery', 'stable', 'workshop', 'factory', 'mercenaryHall']);
export function architecture(kind: string, age: number) {
  const root = new T.Group();
  root.name = kind;
  root.userData.age = age;
  root.userData.building = true;
  root.userData.footprint = buildingFootprint(kind);
  const proportions: Record<string, [number, number, number]> = {
    house: [0.82, 0.88, 0.82],
    hall: [1.1, 1.18, 1.1],
    tower: [0.82, 1.38, 0.82],
    fort: [1.5, age === 3 ? 1.55 : 1.1, 1.5],
    silo: [0.86, 1.05, 0.86],
    market: [1.05, 0.85, 1.05],
    barracks: [1.05, 0.9, 1.05],
  };
  if (proportions[kind]) root.scale.set(...proportions[kind]);
  const wall =
      age === 1 ? '#af9b78' : age === 2 ? '#c9bba0' : age === 3 ? '#d1c7ac' : age === 4 ? '#a67c63' : '#b7c3bd',
    roofColor = age === 1 ? '#ae975d' : age === 2 ? '#9c6449' : C.roof;
  const part = (name: string) => joint(root, name);
  // Architectural detail is built from closed solids, then batched by material.
  // Roof courses overlap the opaque roof shell; no exposed lattice substitutes for tiles.
  function roof(parent: T.Group, w: number, d: number, y: number) {
    const r = joint(parent, 'roof', 0, y, 0);
    if (kind === 'workshop' || kind === 'factory') {
      const n = kind === 'factory' ? 4 : 3,
        span = w / n;
      for (let i = 0; i < n; i++) {
        const bay = joint(r, 'northlightBay', -w / 2 + (i + 0.5) * span, 0, 0),
          h = 0.72;
        const vertices = [
          -span / 2,
          0,
          -d / 2,
          span / 2,
          0,
          -d / 2,
          span / 2,
          h,
          -d / 2,
          -span / 2,
          0,
          d / 2,
          span / 2,
          0,
          d / 2,
          span / 2,
          h,
          d / 2,
        ];
        const geo = new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
        geo.setIndex([0, 2, 1, 3, 4, 5, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4]);
        geo.computeVertexNormals();
        mesh(geo, mat('#596967'), bay);
        box(bay, 0.026, 0.53, d * 0.86, span / 2 + 0.015, 0.35, 0, C.glass);
        for (let j = -2; j <= 2; j++) box(bay, 0.06, 0.57, 0.045, span / 2 + 0.03, 0.35, j * d * 0.17, C.trim);
        beam(bay, [span / 2, h + 0.03, -d / 2], [span / 2, h + 0.03, d / 2], 0.04, C.roof2);
        for (const z of [-d / 2, d / 2]) beam(bay, [-span / 2, 0, z], [span / 2, h, z], 0.035, C.roof2);
      }
      return;
    }

    if (
      (age === 2 && !['hall', 'temple', 'barracks'].includes(kind)) ||
      ['academy', 'embassy', 'fort', 'landmark'].includes(kind)
    ) {
      box(r, w + 0.12, 0.18, d + 0.12, 0, 0.09, 0, C.trim);
      box(r, w - 0.22, 0.045, d - 0.22, 0, 0.19, 0, age === 2 ? '#ac9f84' : C.roof2);
      for (const z of [-1, 1]) {
        box(r, w, 0.3, 0.16, 0, 0.31, (z * d) / 2, wall);
        box(r, w + 0.1, 0.08, 0.22, 0, 0.49, (z * d) / 2, C.trim);
      }
      for (const x of [-1, 1]) {
        box(r, 0.16, 0.3, d, (x * w) / 2, 0.31, 0, wall);
        box(r, 0.22, 0.08, d + 0.1, (x * w) / 2, 0.49, 0, C.trim);
      }
      return;
    }
    const industrial = kind === 'factory' || kind === 'workshop';
    const rise = age === 1 ? 1.28 : industrial ? 0.58 : age === 2 ? 0.72 : 1.1;
    const roofMaterial = age === 1 ? '#ad9562' : age === 2 ? '#9e6650' : industrial ? '#566765' : C.roof;
    const vertices = [
      -w / 2,
      0,
      -d / 2,
      w / 2,
      0,
      -d / 2,
      0,
      rise,
      -d / 2,
      -w / 2,
      0,
      d / 2,
      w / 2,
      0,
      d / 2,
      0,
      rise,
      d / 2,
    ];
    const geometry = new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    geometry.setIndex([0, 2, 1, 3, 4, 5, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4]);
    geometry.computeVertexNormals();
    mesh(geometry, mat(roofMaterial), r);
    const slope = Math.atan2(rise, w / 2),
      courseCount = age === 1 ? 7 : 6;
    for (const side of [-1, 1]) {
      // Broad shingle/thatch bands catch light at RTS scale without thousands of tiles.
      for (let i = 0; i < courseCount; i++) {
        const f = (i + 0.5) / courseCount,
          span = Math.hypot(w / 2, rise) / courseCount + 0.035;
        const strip = box(
          r,
          span,
          age === 1 ? 0.055 : 0.035,
          d + 0.035,
          side * w * 0.5 * (1 - f),
          rise * f + 0.021,
          0,
          i % 3 === 0 ? (age === 1 ? '#b29c6b' : age === 2 ? '#a9735b' : '#507a73') : roofMaterial,
        );
        strip.rotation.z = -side * slope;
      }
      box(r, 0.1, 0.13, d + 0.15, (side * w) / 2, -0.025, 0, age === 1 ? C.wood : C.roof2);
      for (const z of [-d / 2 - 0.025, d / 2 + 0.025])
        beam(r, [(side * w) / 2, -0.045, z], [0, rise + 0.045, z], 0.045, age === 1 ? C.wood : C.trim);
    }
    box(r, 0.16, 0.11, d + 0.17, 0, rise + 0.06, 0, age === 1 ? '#8f784d' : C.roof2);
    if (age >= 3 && !industrial && w > 3.2) {
      const dormer = joint(r, 'dormer', 0, rise * 0.43, d * 0.24);
      box(dormer, 0.66, 0.57, 0.48, 0, 0.18, 0, wall);
      box(dormer, 0.3, 0.36, 0.04, 0, 0.18, 0.26, C.glass);
      for (const side of [-1, 1]) {
        const cap = box(dormer, 0.47, 0.065, 0.65, side * 0.19, 0.52, 0, C.roof2);
        cap.rotation.z = -side * 0.5;
      }
      box(dormer, 0.4, 0.06, 0.1, 0, -0.02, 0.28, C.trim);
    }
  }
  function window(parent: T.Group, x: number, y: number, z: number, w = 0.55, h = 0.75) {
    const p = joint(parent, 'window', x, y, z);
    if (age === 1) {
      box(p, w + 0.09, h + 0.06, 0.06, 0, 0, 0, '#514735');
      for (const side of [-1, 1]) {
        box(p, 0.065, h + 0.15, 0.1, side * (w / 2 + 0.04), 0, 0.025, C.wood);
        box(p, w + 0.16, 0.075, 0.11, 0, side * (h / 2 + 0.04), 0.03, C.wood);
      }
      for (const xx of [-w * 0.27, w * 0.27]) beam(p, [xx, -h * 0.5, 0.04], [xx, h * 0.5, 0.04], 0.018, '#a18b65');
      return p;
    }
    box(p, w + 0.18, h + 0.18, 0.08, 0, 0, 0, '#6b705f');
    box(p, w, h, 0.055, 0, 0, 0.045, C.glass);
    for (const side of [-1, 1]) box(p, 0.065, h + 0.1, 0.115, (side * (w + 0.065)) / 2, 0, 0.04, C.trim);
    for (const side of [-1, 1]) box(p, w + 0.2, 0.07, 0.14, 0, (side * (h + 0.075)) / 2, 0.065, C.trim);
    box(p, 0.035, h, 0.07, 0, 0, 0.085, C.trim);
    box(p, w, 0.035, 0.07, 0, -h * 0.1, 0.085, C.trim);
    box(p, w + 0.27, 0.09, 0.24, 0, -h / 2 - 0.075, 0.09, C.stone);
    if (age === 3 && kind === 'house')
      for (const side of [-1, 1]) {
        box(p, 0.2, h + 0.04, 0.07, side * (w * 0.5 + 0.19), 0, 0.035, C.cloth);
        for (const yy of [-h * 0.3, h * 0.3]) box(p, 0.2, 0.025, 0.09, side * (w * 0.5 + 0.19), yy, 0.075, C.roof2);
      }
    return p;
  }
  function room(w: number, d: number, h: number, x: number, z: number, name = 'buildingWing') {
    if (age === 2) {
      h *= 0.82;
      w *= 0.9;
    } else if (age === 4 && ['barracks', 'hall', 'house', 'mercenaryHall'].includes(kind)) h *= 1.15;
    const p = joint(root, name, x, 0, z);
    box(p, w + 0.26, 0.18, d + 0.26, 0, 0.09, 0, '#898a77');
    box(p, w + 0.16, 0.22, d + 0.16, 0, 0.29, 0, '#b1aa92');
    box(p, w, h, 0.18, 0, h / 2, -d / 2, wall);
    for (const side of [-1, 1]) box(p, 0.18, h, d, (side * w) / 2, h / 2, 0, wall);
    const doorW = name === 'machineHall' ? w * 0.4 : Math.min(1.1, w * 0.3),
      doorH = name === 'machineHall' ? h * 0.82 : Math.min(1.65, h * 0.74),
      sideW = (w - doorW) / 2;
    for (const side of [-1, 1]) box(p, sideW, h, 0.18, side * (doorW / 2 + sideW / 2), h / 2, d / 2, wall);
    box(p, doorW, h - doorH, 0.18, 0, doorH + (h - doorH) / 2, d / 2, wall);
    box(p, doorW * 0.94, doorH, 0.06, 0, doorH / 2, d / 2 + 0.015, '#483d31');
    for (let i = 0; i < 5; i++)
      box(
        p,
        doorW * 0.177,
        doorH - 0.12,
        0.055,
        (i - 2) * doorW * 0.18,
        doorH / 2,
        d / 2 + 0.035,
        i % 2 ? C.wood : '#806347',
      );
    for (const side of [-1, 1])
      box(p, 0.11, doorH + 0.12, 0.22, side * (doorW / 2 + 0.06), doorH / 2, d / 2 + 0.07, age === 3 ? C.wood : C.trim);
    box(p, doorW + 0.34, 0.17, 0.24, 0, doorH + 0.05, d / 2 + 0.08, C.trim);
    for (const y of [doorH * 0.23, doorH * 0.73]) box(p, doorW * 0.9, 0.06, 0.08, 0, y, d / 2 + 0.1, C.dark);
    cyl(p, 0.045, 0.045, 0.06, doorW * 0.28, doorH * 0.46, d / 2 + 0.16, C.gold, 10).rotation.x = Math.PI / 2;
    box(p, doorW + 0.34, 0.13, 0.45, 0, 0.065, d / 2 + 0.19, C.stone);
    // Masonry base, corner stones and continuous cornice describe the volume.
    for (let y = 0.45; age > 1 && y < h - 0.15; y += 0.39)
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          box(p, y % 0.78 < 0.39 ? 0.25 : 0.34, 0.16, 0.25, (sx * w) / 2, y, (sz * d) / 2, '#b7af97');
    for (const yy of [0.42, h - 0.12]) {
      box(p, w + 0.12, 0.105, d + 0.12, 0, yy, 0, age === 1 ? C.wood : C.trim);
    }
    for (const side of [-1, 1])
      if (w > 2.2 && name !== 'machineHall' && !(name === 'timberResidence' && side === 1))
        window(p, side * w * 0.32, h * 0.59, d / 2 + 0.12, 0.48, 0.67);
    if (age === 3)
      for (const side of [-1, 1]) {
        box(p, 0.12, h, 0.12, side * (w / 2 - 0.08), h / 2, d / 2 + 0.1, C.wood);
        beam(
          p,
          [side * (doorW / 2 + 0.15), 0.44, d / 2 + 0.12],
          [side * (w / 2 - 0.12), h - 0.25, d / 2 + 0.12],
          0.042,
          C.wood,
        );
      }
    if (age === 4) {
      for (let yy = 0.55; yy < h - 0.2; yy += 0.28) box(p, w, 0.014, 0.025, 0, yy, d / 2 + 0.105, '#c79873');
      if (h > 3.1) for (const xx of [-w * 0.3, 0, w * 0.3]) window(p, xx, h - 0.67, d / 2 + 0.12, 0.42, 0.61);
    }
    for (const side of [-1, 1]) {
      const facade = joint(p, 'sideFacade', side * (w / 2 + 0.12), 0, 0);
      facade.rotation.y = (side * Math.PI) / 2;
      for (const zz of [-d * 0.26, d * 0.26]) window(facade, zz, h * 0.58, 0, 0.42, 0.62);
      box(p, 0.065, 0.16, d * 0.72, side * (w / 2 + 0.135), h - 0.32, 0, C.cloth);
      window(p, side * w * 0.26, h * 0.58, -d / 2 - 0.12, 0.43, 0.62).rotation.y = Math.PI;
    }
    box(p, w * 0.6, 0.16, 0.065, 0, h - 0.32, d / 2 + 0.145, C.cloth);
    box(p, w * 0.6, 0.16, 0.065, 0, h - 0.32, -d / 2 - 0.145, C.cloth);
    roof(p, w + 0.48, d + 0.42, h + 0.05);
    return p;
  }
  function fence(x1: number, z1: number, x2: number, z2: number, h = 1) {
    const p = part('yardFence'),
      length = Math.hypot(x2 - x1, z2 - z1),
      steps = Math.ceil(length / 0.75);
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      box(p, 0.09, h, 0.09, T.MathUtils.lerp(x1, x2, f), h / 2, T.MathUtils.lerp(z1, z2, f), C.wood);
    }
    for (const y of [h * 0.4, h * 0.8]) beam(p, [x1, y, z1], [x2, y, z2], 0.034, C.wood);
  }
  function yard(w: number, d: number) {
    const p = part('courtyard');
    for (let i = 0; i < 4; i++) box(p, 0.7, 0.035, 0.45, 0, 0.025, d / 2 - 0.15 - i * 0.55, C.stone);
    fence(-w / 2, -d / 2 + 1, -w / 2, d / 2 + 1);
    fence(w / 2, -d / 2 + 1, w / 2, d / 2 + 1);
    fence(-w / 2, d / 2 + 1, -1, d / 2 + 1);
    fence(1, d / 2 + 1, w / 2, d / 2 + 1);
  }
  function flag(x: number, z: number, h: number) {
    if (kind !== 'hall' && kind !== 'fort') {
      const p = joint(root, 'factionMarker', x, 0, z);
      box(p, 0.2, 0.6, 0.2, 0, 0.3, 0, C.wood);
      box(p, 0.22, 0.24, 0.22, 0, 0.45, 0, C.cloth);
      return;
    }
    const p = joint(root, 'factionFlag', x, 0, z);
    beam(p, [0, 0, 0], [0, h, 0], 0.035, C.gold);
    box(p, 0.64, 0.42, 0.018, 0.33, h - 0.27, 0, C.cloth);
    box(p, 0.65, 0.027, 0.02, 0.33, h - 0.27, 0, C.gold);
    root.userData.flagClearance = {x, z, height: h};
  }
  function crate(x: number, z: number) {
    const p = part('cargo');
    box(p, 0.6, 0.5, 0.6, x, 0.25, z, C.wood);
    for (const s of [-1, 1]) box(p, 0.035, 0.52, 0.62, x + s * 0.19, 0.25, z, C.gold);
  }
  function tower(x: number, z: number, r: number, h: number) {
    const p = joint(root, 'defenseTower', x, 0, z);
    cyl(p, r + 0.09, r + 0.23, 0.38, 0, 0.19, 0, '#969580', 16);
    cyl(p, r, r + 0.12, h - 0.25, 0, (h + 0.25) / 2, 0, wall, 16);
    for (let y = 0.48; y < h - 0.25; y += 0.47)
      cyl(p, r + 0.12 * (1 - y / h) + 0.008, r + 0.12 * (1 - y / h) + 0.008, 0.027, 0, y, 0, '#b0ab93', 16);
    cyl(p, r + 0.1, r + 0.15, 0.2, 0, h - 0.16, 0, C.trim, 16);
    cyl(p, r + 0.23, r + 0.16, 0.24, 0, h + 0.02, 0, C.trim, 16);
    cyl(p, r + 0.17, r + 0.17, 0.06, 0, h + 0.17, 0, '#8a8c7c', 16);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2,
        b = box(p, 0.29, 0.44, 0.31, Math.sin(a) * r, h + 0.4, Math.cos(a) * r, C.trim);
      b.rotation.y = a;
    }
    for (let i = 0; i < 4; i++) {
      const aperture = joint(p, 'arrowSlit');
      aperture.rotation.y = (i * Math.PI) / 2;
      for (const y of [h * 0.42, h * 0.74]) {
        box(aperture, 0.12, 0.55, 0.055, 0, y, r + 0.05, C.dark);
        box(aperture, 0.29, 0.09, 0.095, 0, y - 0.29, r + 0.08, C.trim);
      }
    }
  }
  if (age === 1 && kind === 'lumberPost') {
    const shed = part('leanTo');
    for (const x of [-1.4, 1.4]) beam(shed, [x, 0, 0], [x, 1.8, 0], 0.07, C.wood);
    const cover = box(shed, 3.3, 0.08, 1.8, 0, 1.3, -0.55, '#b49c70');
    cover.rotation.x = -0.52;
    for (let layer = 0; layer < 3; layer++)
      for (let i = 0; i < 4 - layer; i++) {
        const log = cyl(root, 0.16, 0.16, 2.3, -0.65 + i * 0.38 + layer * 0.19, 0.17 + layer * 0.29, 0.7, C.wood, 10);
        log.rotation.x = Math.PI / 2;
      }
    box(root, 1.4, 0.18, 0.08, 0, 1.7, 0.05, C.cloth);
    return finishArchitecture(root);
  }
  if (age === 1 && kind === 'fishery') {
    const p = part('reedPlatform');
    for (let i = 0; i < 14; i++) beam(p, [-1, 0.12, -1.3 + i * 0.2], [1, 0.12, -1.3 + i * 0.2], 0.06, C.wood);
    for (const x of [-0.8, 0.8]) beam(p, [x, 0, -1], [x, 1.3, -1], 0.05, C.wood);
    box(p, 1.6, 0.4, 0.025, 0, 1.0, -1, C.cloth);
    for (const x of [-0.5, 0, 0.5]) cyl(p, 0.18, 0.14, 0.35, x, 0.32, 0, C.wood, 10);
    return finishArchitecture(root);
  }
  if (age === 1 && kind === 'barracks') {
    yard(6.5, 5.8);
    const shelter = joint(root, 'trainingShelter', -1.8, 0, -0.9);
    for (const x of [-0.8, 0.8]) for (const z of [-1.5, 1.5]) beam(shelter, [x, 0, z], [x, 1.7, z], 0.08, C.wood);
    const cover = box(shelter, 2.2, 0.1, 3.5, 0, 1.9, 0, '#ad9361');
    cover.rotation.z = 0.22;
    box(shelter, 1.7, 0.22, 0.05, 0, 1.6, 1.53, C.cloth);
    for (const z of [-1.6, 0, 1.6]) {
      beam(root, [1, 0, z], [1, 1.55, z], 0.06, C.wood);
      beam(root, [0.6, 1.1, z], [1.4, 1.1, z], 0.04, C.wood);
      ball(root, 1, 1.4, z, 0.2, 0.24, 0.16, '#b99d67', 1);
    }
    for (let i = 0; i < 5; i++) beam(root, [-2.4 + i * 0.25, 0.1, 2], [-2.4 + i * 0.25, 1.1, 2], 0.04, C.wood);
    return finishArchitecture(root);
  }
  if (age === 1) {
    if (kind === 'hall') {
      const longhouse = room(5.8, 3.3, 2.15, 0, -0.45, 'communalLonghouse');
      for (const x of [-2.65, 2.65])
        for (const z of [-1.7, 1.7]) beam(longhouse, [x, 0, z], [x, 2.2, z], 0.085, C.wood);
      for (const x of [-1.8, 1.8]) {
        beam(root, [x, 0, 2.25], [x, 1.85, 2.25], 0.09, C.wood);
        beam(root, [x, 1.85, 2.25], [x, 2.08, 1.2], 0.065, C.wood);
      }
      box(root, 4.2, 0.11, 1.7, 0, 1.96, 1.95, '#ab9262');
      const fire = part('councilHearth');
      for (let i = 0; i < 10; i++) {
        const a = i * Math.PI * 0.2;
        ball(fire, Math.cos(a) * 0.43, 0.12, 2.7 + Math.sin(a) * 0.43, 0.17, 0.11, 0.14, '#777764', 0);
      }
      crate(-3.8, 0.7);
      crate(-3.8, 1.5);
      flag(4.0, 1.7, 3.4);
    } else {
      const p = joint(root, 'roundhouse');
      cyl(p, 1.12, 1.29, 1.58, 0, 0.8, 0, wall, 18);
      cyl(p, 1.3, 1.32, 0.18, 0, 0.09, 0, '#8e8972');
      cyl(p, 0, 1.65, 1.58, 0, 2.27, 0, roofColor, 18);
      for (let i = 0; i < 7; i++) {
        const f = (i + 0.15) / 7,
          rad = 1.65 * (1 - f);
        cyl(p, rad * 0.9, rad, 0.11, 0, 1.49 + f * 1.58, 0, i % 2 ? '#a08c5e' : '#b59c68', 18);
      }
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        beam(
          p,
          [Math.sin(a) * 1.22, 0.1, Math.cos(a) * 1.22],
          [Math.sin(a) * 1.1, 1.62, Math.cos(a) * 1.1],
          0.039,
          C.wood,
        );
      }
      box(p, 0.55, 0.98, 0.06, 0, 0.5, 1.2, '#4b4031');
      for (const side of [-1, 1]) box(p, 0.07, 1.07, 0.12, side * 0.31, 0.54, 1.22, C.wood);
      box(p, 0.74, 0.11, 0.15, 0, 1.09, 1.24, C.wood);
      cyl(p, 1.17, 1.2, 0.09, 0, 1.0, 0, C.cloth, 18);
      box(p, 0.86, 0.1, 0.48, 0, 0.05, 1.35, C.stone);
      crate(1.75, -0.4);
      flag(-1.75, 0.5, 2.6);
    }
    return finishArchitecture(root);
  }
  if (kind === 'fort' && age === 4) {
    const p = part('bastionRamparts'),
      stone = '#9b9581';

    for (const x of [-3.8, 3.8])
      for (const z of [-3.8, 3.8]) {
        cyl(p, 1.95, 2.35, 2.3, x, 1.15, z, stone, 4);
        cyl(p, 2.04, 2.04, 0.18, x, 2.36, z, C.trim, 4);
        for (const y of [0.35, 0.95, 1.55, 2.12])
          cyl(
            p,
            T.MathUtils.lerp(2.35, 1.95, y / 2.3) + 0.012,
            T.MathUtils.lerp(2.35, 1.95, y / 2.3) + 0.02,
            0.045,
            x,
            y,
            z,
            '#777865',
            4,
          );
        for (const side of [-1, 1]) {
          box(p, 0.2, 0.38, 1.1, x + side * 1.16, 2.62, z, C.trim);
          box(p, 1.1, 0.38, 0.2, x, 2.62, z + side * 1.16, C.trim);
        }
        const gun = joint(root, 'bastionGun', x, 2.57, z);
        gun.rotation.y = Math.atan2(x, z);
        box(gun, 0.55, 0.22, 0.75, 0, 0, 0, C.wood);
        const barrel = cyl(gun, 0.12, 0.18, 1.45, 0, 0.27, 0.36, C.dark, 16);
        barrel.rotation.x = Math.PI / 2;
        cyl(gun, 0.095, 0.095, 0.025, 0, 0.27, 1.1, '#152020', 16).rotation.x = Math.PI / 2;
      }
    for (const x of [-4.2, 4.2]) {
      box(p, 0.9, 1.9, 6.3, x, 0.95, 0, stone);
      box(p, 0.96, 0.18, 6.3, x, 1.98, 0, C.trim);
    }
    box(p, 6.3, 1.9, 0.9, 0, 0.95, -4.2, stone);
    box(p, 6.3, 0.18, 0.96, 0, 1.98, -4.2, C.trim);
    for (const x of [-2.8, 2.8]) {
      box(p, 2.5, 1.9, 0.9, x, 0.95, 4.2, stone);
      box(p, 2.55, 0.18, 0.96, x, 1.98, 4.2, C.trim);
    }
    room(4.6, 1.8, 2.6, 0, -2.7, 'garrison');
    for (const x of [-1.15, 1.15]) box(p, 0.45, 2.45, 1.25, x, 1.22, 4.2, C.trim);
    box(p, 2.75, 0.45, 1.25, 0, 2.45, 4.2, C.trim);
    box(p, 1.4, 0.24, 0.04, 0, 2.43, 4.85, C.cloth);
    for (let i = 0; i < 6; i++) box(p, 1.1, 0.22 * (i + 1), 0.35, -2.6, 0.11 * (i + 1), 2.5 - i * 0.35, C.stone);
    flag(0, -0.8, 4.4);
    return finishArchitecture(root);
  }
  if (kind === 'fort') {
    const p = part('curtainWalls');

    for (const x of [-4, 4]) box(p, 0.65, 3.1, 8, x, 1.55, 0, wall);
    box(p, 8, 3.1, 0.65, 0, 1.55, -4, wall);
    for (const x of [-2.8, 2.8]) box(p, 2.5, 3.1, 0.65, x, 1.55, 4, wall);
    for (const x of [-4, 4])
      for (const z of [-4, 4]) {
        tower(x, z, 1.0, 4.9);
        if (z < 0) {
          const cone = part('towerRoof');
          cyl(cone, 0, 1.28, 1.7, x, 6.42, z, C.roof, 16);
          cyl(cone, 1.3, 1.3, 0.09, x, 5.59, z, C.roof2, 16);
        }
      }
    for (let i = 0; i < 11; i++) {
      const x = -3.6 + i * 0.72;
      box(p, 0.36, 0.45, 0.76, x, 3.33, -4, C.trim);
      for (const s of [-1, 1]) box(p, 0.76, 0.45, 0.36, s * 4, 3.33, x, C.trim);
    }
    for (const z of [-4, 4])
      for (const x of [-2.8, 2.8]) {
        box(p, 2.55, 0.18, 0.82, x, 0.25, z, '#a4a18a');
        box(p, 2.55, 0.15, 0.78, x, 2.92, z, C.trim);
        for (const y of [0.75, 1.3, 1.85, 2.4]) box(p, 2.55, 0.026, 0.68, x, y, z, '#aaa68f');
      }
    for (const side of [-1, 1]) {
      box(p, 0.82, 0.18, 6.4, side * 4, 0.25, 0, '#a4a18a');
      box(p, 0.78, 0.15, 6.4, side * 4, 2.92, 0, C.trim);
      for (const z of [-2.5, 0, 2.5]) {
        box(p, 0.38, 2.15, 0.4, side * 4.23, 1.075, z, '#b6af97');
        box(p, 0.5, 0.14, 0.53, side * 4.23, 2.18, z, C.trim);
      }
    }
    // Gatehouse, carved arch and lowered bridge make the entrance legible from above.
    const portal = joint(root, 'fortEntrance', 0, 0, 4.4);
    const arch = mesh(new T.TorusGeometry(0.78, 0.105, 6, 20, Math.PI), mat(C.trim), portal, 0, 2.2, 0);
    for (const side of [-1, 1]) box(portal, 0.21, 2.2, 0.22, side * 0.78, 1.1, 0, C.trim);
    box(portal, 1.65, 0.13, 1.05, 0, 0.065, 0.35, C.wood);
    for (let i = 0; i < 9; i++) box(portal, 0.025, 0.025, 1.05, -0.72 + i * 0.18, 0.142, 0.35, '#514735');
    arch.name = 'gateArch';
    room(3.8, 3.4, 5.8, 0, -1.6, 'keep');
    for (const x of [-1.5, 1.5]) for (const z of [-2.9, -0.3]) tower(x, z, 0.42, 6.3);
    for (let i = 0; i < 8; i++) box(p, 0.3, 0.4, 0.25, -1.6 + i * 0.45, 6.15, 0.15, C.trim);
    for (const x of [-1.4, 1.4]) tower(x, 3.9, 0.65, 4.0);
    box(p, 1.7, 0.9, 0.9, 0, 3.1, 4, wall);
    for (let i = 0; i < 9; i++) box(p, 0.055, 2.7, 0.08, -0.7 + i * 0.175, 1.35, 4.05, C.dark);
    box(p, 1.0, 1.4, 0.025, 0, 4.4, 0.15, C.cloth);
    flag(0, 1.0, 5.0);
    return finishArchitecture(root);
  }
  if (age === 2 && (kind === 'wall' || kind === 'gate')) {
    const p = part('palisade');
    for (let i = 0; i < 23; i++) {
      const x = -2.75 + i * 0.25;
      if (kind === 'gate' && Math.abs(x) < 0.8) continue;
      cyl(p, 0.09, 0.13, 2.25, x, 1.125, 0, C.wood, 8);
      cyl(p, 0, 0.09, 0.3, x, 2.4, 0, C.wood, 8);
    }
    for (const y of [0.65, 1.65]) {
      if (kind === 'wall') beam(p, [-2.8, y, 0.13], [2.8, y, 0.13], 0.08, C.wood);
      else for (const s of [-1, 1]) beam(p, [s * 0.85, y, 0.13], [s * 2.8, y, 0.13], 0.08, C.wood);
    }
    box(p, 0.6, 0.55, 0.04, -1.7, 1.8, 0.16, C.cloth);
    if (kind === 'gate') {
      beam(p, [-0.85, 2.2, 0], [0.85, 2.2, 0], 0.12, C.wood);
      box(p, 1.6, 1.8, 0.1, 0, 0.9, 0, C.wood);
    }
    return finishArchitecture(root);
  }
  if (age === 4 && (kind === 'wall' || kind === 'gate')) {
    const p = part('artilleryRampart');
    function segment(x: number, w: number) {
      const h = 2.15,
        d = 0.72,
        b = 1.4,
        vertices = [
          -w / 2,
          0,
          -b,
          w / 2,
          0,
          -b,
          w / 2,
          0,
          b,
          -w / 2,
          0,
          b,
          -w / 2,
          h,
          -d,
          w / 2,
          h,
          -d,
          w / 2,
          h,
          d,
          -w / 2,
          h,
          d,
        ];
      const g = new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
      g.setIndex([
        0, 2, 1, 0, 3, 2, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5, 4, 5, 6, 4, 6, 7,
      ]);
      g.computeVertexNormals();
      mesh(g, mat('#959784'), p, x, 0, 0);
      box(p, w + 0.08, 0.16, 1.55, x, 2.22, 0, C.trim);
      for (const dx of [-w * 0.3, 0, w * 0.3]) {
        box(p, 0.26, 0.26, 0.04, x + dx, 1.55, 0.95, C.dark);
        box(p, 0.35, 0.08, 0.09, x + dx, 1.36, 1.02, C.trim);
      }
      box(p, w * 0.6, 0.18, 0.04, x, 1.99, 0.79, C.cloth);
    }
    if (kind === 'wall') segment(0, 5.6);
    else {
      segment(-2.8, 3.4);
      segment(2.8, 3.4);
      for (const x of [-1.2, 1.2]) {
        box(p, 0.45, 3.0, 1.6, x, 1.5, 0, C.trim);
        box(p, 0.56, 0.18, 1.75, x, 3.1, 0, C.trim);
      }
      box(p, 2.8, 0.65, 1.6, 0, 2.9, 0, C.stone);
      for (let i = 0; i < 9; i++) box(p, 0.08, 2.4, 0.12, -0.86 + i * 0.215, 1.2, 0.12, C.dark);
      box(p, 1.2, 0.27, 0.04, 0, 2.93, 0.83, C.cloth);
    }
    return finishArchitecture(root);
  }
  if (production.has(kind)) {
    yard(kind === 'factory' ? 9 : 7.2, 7.4);
    if (kind === 'barracks') {
      if (age === 2) {
        room(2.2, 4.2, 2.2, -2, -0.8, 'leftDormitory');
        room(2.2, 4.2, 2.2, 2, -0.8, 'rightDormitory');
      } else {
        room(6, 2.2, age === 4 ? 3.2 : 2.7, 0, -2, 'barrackDormitory');
        room(1.7, 3, 2.2, -2.4, 0.7, 'armoryWing');
        if (age === 4) {
          room(1.7, 2, 2.6, 2.4, 0.2, 'officerWing');
          box(root, 1, 0.8, 0.85, 0, 4.4, -2, C.trim);
          cyl(root, 0.28, 0.28, 0.04, 0, 4.5, -1.55, C.dark, 16).rotation.x = Math.PI / 2;
        }
      }
      for (let i = 0; i < 4; i++) {
        const x = 0.1 + i * 0.7;
        beam(root, [x, 0, 1], [x, 1.6, 1], 0.05, C.wood);
        beam(root, [x - 0.3, 1.2, 1], [x + 0.3, 1.2, 1], 0.04, C.wood);
        box(root, 0.42, 0.62, 0.08, x, 1.1, 1.05, C.cloth);
      }
    }
    if (kind === 'mercenaryHall') {
      const hall = part('roundGreatHall');
      cyl(hall, 1.6, 1.7, 3.6, -1, 1.8, -1.5, wall, 8);
      cyl(hall, 0, 2, 1.5, -1, 4.35, -1.5, C.roof, 8);
      room(2, 3, 2.3, 1.8, -0.7, 'contractOffice');
      box(root, 0.75, 1.7, 0.05, -1, 0.85, 0.15, C.wood);
      box(root, 0.85, 0.45, 0.08, -1, 2.0, 0.22, C.cloth);
      for (let i = 0; i < 3; i++) {
        const rack = joint(root, 'weaponRack', -0.8 + i * 0.7, 0, 2);
        beam(rack, [0, 0, 0], [0, 1.8, 0], 0.03, C.wood);
        beam(rack, [-0.3, 1.1, 0], [0.3, 1.1, 0], 0.04, C.wood);
      }
      if (age === 4) room(2.1, 1.7, 3.5, 1.9, -2.9, 'paymasterTower');
    }
    if (kind === 'stable') {
      if (age === 2) {
        for (const x of [-2.7, -1]) for (const z of [-2.7, 1.8]) beam(root, [x, 0, z], [x, 2, z], 0.08, C.wood);
        const shelter = box(root, 2.4, 0.13, 5.2, -1.8, 2.1, -0.5, C.roof);
        shelter.rotation.z = 0.12;
      } else {
        const stalls = joint(root, 'stallBlock', -2.45, 0, -0.4);
        box(stalls, 0.14, 2.1, 6, -1, 0.105 + 1.0, 0, C.wood);
        for (const z of [-3, -1.5, 0, 1.5, 3]) {
          box(stalls, 2.05, 1.3, 0.1, 0, 0.65, z, '#9a8057');
          box(stalls, 0.13, 2.25, 0.13, 1, 1.125, z, C.wood);
          beam(stalls, [1, 1.5, z], [0.55, 2.18, z], 0.045, C.wood);
        }
        box(stalls, 2.12, 0.15, 6.1, 0, 2.2, 0, C.wood);
        roof(stalls, 2.6, 6.4, 2.27);
        for (const z of [-2.25, -0.75, 0.75, 2.25]) {
          box(stalls, 0.095, 0.82, 1.2, 1, 0.41, z, C.cloth);
          for (const yy of [0.15, 0.66]) box(stalls, 0.12, 0.07, 1.2, 1.03, yy, z, C.dark);
          box(stalls, 0.65, 0.47, 0.88, -0.45, 0.24, z, '#b7a166');
          beam(stalls, [1.08, 0.11, z - 0.53], [1.08, 0.74, z + 0.53], 0.035, C.wood);
        }
        const loft = joint(root, 'hayloft', 0.35, 0, -2.65);
        for (const x of [-1.3, 1.3]) for (const z of [-0.65, 0.65]) box(loft, 0.16, 2.7, 0.16, x, 1.35, z, C.wood);
        box(loft, 2.85, 0.16, 1.6, 0, 1.8, 0, C.wood);
        for (const x of [-0.8, 0, 0.8]) {
          box(loft, 0.65, 0.6, 0.9, x, 2.15, 0, '#b4a36e');
          box(loft, 0.04, 0.62, 0.94, x, 2.16, 0, '#8d7850');
        }
        roof(loft, 3.15, 2.0, 2.7);
        box(loft, 2.7, 0.2, 0.08, 0, 1.55, 0.79, C.cloth);
        if (age === 4) {
          room(1.7, 4.1, 2.3, 2.6, -0.8, 'coachHouse');
          box(root, 0.4, 1.0, 0.12, 0, 3.8, -1.3, C.cloth);
        }
      }
      for (let i = 0; i < 4; i++) {
        box(root, 0.8, 0.7, 0.8, -1.6, 0.35, -2 + i * 1.3, '#b9a164');
        fence(-1.4, -2.4 + i * 1.3, 0.3, -2.4 + i * 1.3, 0.8);
      }
      cyl(root, 0.5, 0.55, 0.5, 1.8, 0.25, 1.8, C.wood, 16);
    }
    if (kind === 'archery') {
      if (age === 2) {
        for (const z of [-2, 1]) beam(root, [-2.7, 0, z], [-2.7, 2, z], 0.06, C.wood);
        box(root, 1.7, 0.07, 3.7, -2.5, 2.0, -0.5, C.cloth);
      } else {
        room(2, 4.8, 2.2, -2.5, -0.5, 'fletcherWorkshop');
        box(root, 4.6, 1.9, 0.22, 0.9, 0.95, -2.95, C.wood);
      }
      for (const x of [-0.5, 1, 2.5]) {
        beam(root, [x, 0, -2.6], [x, 1.6, -2.6], 0.06, C.wood);
        for (const [r, c, z] of [
          [0.43, '#c6b88e', -2.55],
          [0.28, C.cloth, -2.49],
          [0.12, C.gold, -2.43],
        ] as const) {
          const disk = cyl(root, r, r, 0.06, x, 1.3, z, c, 24);
          disk.rotation.x = Math.PI / 2;
        }
        box(root, 0.04, 0.015, 4, x, 0.085, 0.1, C.trim);
      }
    }
    if (kind === 'workshop' || kind === 'factory') {
      room(kind === 'factory' ? 7.4 : 5.5, 3, 3.3, 0, -1.5, 'machineHall');
      const chimney = part('chimney');
      for (const x of kind === 'factory' ? [-3, 3] : [2.2]) {
        box(chimney, 0.65, 6, 0.65, x, 3, -2.2, '#8c624d');
        box(chimney, 0.84, 0.25, 0.84, x, 6, -2.2, C.dark);
      }
      for (const x of [-1.4, 1.4]) {
        box(root, 1.4, 0.65, 0.9, x, 0.35, 1.2, C.wood);
        box(root, 1, 0.25, 0.4, x, 0.82, 1.2, C.dark);
      }
      if (kind === 'factory') for (let i = 0; i < 3; i++) cyl(root, 0.6, 0.6, 2, -3 + i * 1.4, 1, 2.5, '#687a79', 20);
    }
    flag(2.8, 3.8, 3.6);
    return finishArchitecture(root);
  }
  if (kind === 'silo') {
    if (age === 2) {
      cyl(root, 0.9, 1.5, 2.2, 0, 1.1, 0, '#b4976b', 20);
      mesh(new T.SphereGeometry(0.92, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('#c5ad7e'), root, 0, 2.2, 0);
      cyl(root, 1.17, 1.2, 0.15, 0, 1.15, 0, C.cloth, 20);
    } else if (age === 3) {
      for (const x of [-0.9, 0.9]) for (const z of [-0.9, 0.9]) cyl(root, 0.14, 0.2, 0.7, x, 0.35, z, C.stone, 10);
      cyl(root, 1.3, 1.3, 2.7, 0, 2.05, 0, C.wood, 8);
      cyl(root, 0, 1.6, 1.15, 0, 3.98, 0, C.roof, 8);
      for (const y of [0.85, 1.8, 3.2]) cyl(root, 1.31, 1.31, 0.08, 0, y, 0, C.cloth, 8);
    } else {
      for (const x of [-0.85, 0.85]) {
        cyl(root, 0.75, 0.75, 4.1, x, 2.05, 0, '#9eaaa0', 28);
        cyl(root, 0.35, 0.76, 0.55, x, 4.35, 0, C.roof, 28);
        for (const y of [0.4, 1.5, 2.6, 3.8]) cyl(root, 0.77, 0.77, 0.055, x, y, 0, C.cloth, 28);
      }
      for (let y = 0.3; y < 4.2; y += 0.28) beam(root, [-0.18, y, 0.78], [0.18, y, 0.78], 0.026, C.dark);
    }
    box(root, 0.45, 0.45, 0.06, 0, 0.6, age === 3 ? 1.31 : 1.0, C.wood);
  } else if (kind === 'lumberPost') {
    const p = part('timberYard');
    for (const x of [-1.5, 1.5]) for (const z of [-1, 1]) box(p, 0.14, 2.2, 0.14, x, 1.1, z, C.wood);
    if (age === 2) {
      const shelter = box(p, 3.5, 0.08, 2.6, 0, 2.2, 0, C.cloth);
      shelter.rotation.x = 0.12;
    } else roof(p, 3.5, 2.6, 2.2);
    for (let row = 0; row < 3; row++)
      for (let i = 0; i < 4 - row; i++) {
        const log = cyl(root, 0.16, 0.16, 2.4, -0.65 + i * 0.38 + row * 0.18, 0.18 + row * 0.3, 0, C.wood, 12);
        log.rotation.x = Math.PI / 2;
      }
    if (age === 4) {
      box(root, 1.4, 0.75, 0.5, 0, 0.4, 1.7, C.wood);
      const saw = cyl(root, 0.42, 0.42, 0.04, 0, 0.85, 1.7, '#929b91', 24);
      saw.rotation.z = Math.PI / 2;
    }
    box(root, 2.8, 0.18, 0.08, 0, 2.0, 1.08, C.cloth);
  } else if (kind === 'miningPost') {
    const p = part('oreSorting');
    for (let i = 0; i < 5; i++) crate(-1.4 + i * 0.6, 1.1);
    for (const x of [-1.4, 1.4]) beam(p, [x, 0, -0.5], [x, age === 2 ? 1.8 : 2.7, -0.5], 0.1, C.wood);
    beam(p, [-1.5, age === 2 ? 1.8 : 2.7, -0.5], [1.5, age === 2 ? 1.8 : 2.7, -0.5], 0.13, C.wood);
    cyl(p, 0.3, 0.3, 0.12, 0, age === 2 ? 1.6 : 2.45, -0.5, C.dark, 16).rotation.x = Math.PI / 2;
    beam(p, [0, age === 2 ? 1.6 : 2.45, -0.5], [0, 0.7, -0.5], 0.013, C.dark);
    box(root, 1.2, 0.75, 0.7, 0, 0.4, -0.5, C.stone);
    if (age === 4) {
      const wheel = cyl(root, 0.65, 0.65, 0.16, 1.3, 0.7, -0.5, C.dark, 18);
      wheel.rotation.z = Math.PI / 2;
      box(root, 2.2, 0.3, 0.8, -0.2, 1.1, -0.5, C.cloth);
    } else box(root, 1.2, 0.15, 0.72, 0, 0.82, -0.5, C.cloth);
  } else if (kind === 'dock' || kind === 'fishery') {
    const p = part('pier');
    const length = kind === 'dock' ? 8 : 4;
    for (let i = 0; i < length * 4; i++)
      box(p, kind === 'dock' ? 4.2 : 2, 0.12, 0.23, 0, 0.4, -length / 2 + i * 0.25, C.wood);
    for (const x of [-1.7, 1.7]) for (const z of [-3, 0, 3]) cyl(p, 0.13, 0.17, 1.8, x, -0.05, z, C.wood, 10);
    if (kind === 'dock') {
      const office = room(age === 4 ? 3.3 : 2.8, 2.4, age === 4 ? 3.3 : 2.3, -0.25, -2.6, 'harborWarehouse');
      office.position.y = 0.46;
      if (age === 2) {
        for (const x of [-1.6, 1.6]) beam(root, [x, 0.45, -1], [x, 2.4, -1], 0.08, C.wood);
        box(root, 3.5, 0.1, 1.7, 0, 2.4, -0.5, C.cloth);
      } else {
        const crane = part('cargoCrane');
        for (const x of [1.2, 1.8]) beam(crane, [x, 0.4, 0.2], [1.5, 4.6, 0.2], 0.085, age === 4 ? C.dark : C.wood);
        beam(crane, [1.5, 4.6, 0.2], [1.5, 4.6, 3], 0.08, C.wood);
        beam(crane, [1.5, 4.6, 3], [1.5, 1.0, 3], 0.012, C.dark);
        cyl(crane, 0.35, 0.35, 0.16, 1.5, 1.1, 0.2, C.dark, 16).rotation.z = Math.PI / 2;
      }
      for (const x of [-1.0, 0]) crate(x, 0.3);
      box(root, 3.2, 0.14, 0.07, -0.25, 1.1, -1.32, C.cloth);
    } else {
      for (let i = 0; i < 3; i++) cyl(root, 0.23, 0.19, 0.4, -0.55 + i * 0.5, 0.65, -1, C.wood, 12);
      for (const x of [-0.9, 0.9]) beam(root, [x, 0.4, -1.7], [x, 2.2, -1.7], 0.05, C.wood);
      box(root, 1.8, 0.8, 0.025, 0, 1.6, -1.7, C.cloth);
    }
  } else if (kind === 'wall' || kind === 'gate') {
    const p = part('wall');
    for (const x of kind === 'gate' ? [-2.6, 2.6] : [0]) {
      box(p, kind === 'gate' ? 3.2 : 5, 2.6, 0.65, x, 1.3, 0, wall);
      for (let i = 0; i < 7; i++)
        box(
          p,
          0.35,
          0.4,
          0.72,
          x - (kind === 'gate' ? 1.35 : 2.1) + i * (kind === 'gate' ? 0.45 : 0.7),
          2.8,
          0,
          C.trim,
        );
    }
    box(p, kind === 'gate' ? 1.1 : 3, 0.16, 0.04, kind === 'gate' ? -2.6 : 0, 1.8, 0.35, C.cloth);
    if (age === 4) {
      for (const x of kind === 'gate' ? [-2.6, 2.6] : [0]) {
        box(p, kind === 'gate' ? 3.2 : 5, 0.65, 1.25, x, 0.325, 0, '#8a8d78');
        for (const z of [-0.45, 0.45]) beam(p, [x - 1.3, 3.15, z], [x + 1.3, 3.15, z], 0.035, C.dark);
      }
    }
    if (kind === 'gate') {
      for (const x of [-1.1, 1.1]) tower(x, 0, 0.6, 3.7);
      box(p, 2, 0.7, 0.85, 0, 2.8, 0, wall);
      for (let i = 0; i < 9; i++) box(p, 0.065, 2.4, 0.1, -0.85 + i * 0.21, 1.2, 0.1, C.dark);
    }
  } else if (kind === 'farm' || kind === 'estate') {
    box(root, 6, 0.08, 6, 0, 0.04, 0, '#766344');
    box(root, 0.18, 0.65, 0.18, 3.15, 0.325, 2.8, C.wood);
    box(root, 0.2, 0.18, 0.2, 3.15, 0.56, 2.8, C.cloth);
    if (age >= 3) {
      for (const x of [-3.1, 3.1]) fence(x, -3.1, x, 3.1, 0.6);
    }
    if (age === 4) {
      const pump = part('irrigationPump');
      beam(pump, [3.1, 0, -2.4], [3.1, 1.1, -2.4], 0.09, C.dark);
      beam(pump, [3.1, 1.1, -2.4], [3.1, 1.1, -1.7], 0.035, C.dark);
      box(pump, 0.25, 0.15, 5.5, 3, 0.075, 0, C.stone);
    }
    for (let row = 0; row < 8; row++)
      for (let i = 0; i < 12; i++) {
        const x = -2.7 + row * 0.75,
          z = -2.7 + i * 0.48;
        beam(root, [x, 0.08, z], [x, 0.55, z], 0.013, '#c0a062');
        ball(root, x, 0.65, z, 0.05, 0.15, 0.04, '#d1bb6d', 0);
      }
    if (kind === 'estate') room(2.6, 2, 2.8, 0, -4, 'estateHouse');
  } else if (kind === 'tower') {
    if (age === 2) {
      tower(0, 0, 1.1, 3.6);
      box(root, 1.2, 0.55, 0.04, 0, 2.9, 1.12, C.cloth);
    } else if (age === 3) {
      tower(0, 0, 1.25, 5.0);
      cyl(root, 0, 1.6, 1.7, 0, 6.3, 0, C.roof, 12);
      box(root, 0.65, 1.2, 0.04, 0, 3.5, 1.26, C.cloth);
    } else {
      room(2.6, 2.6, 4.0, 0, 0, 'blockhouse');
      for (const x of [-1.1, 1.1]) for (const z of [-1.1, 1.1]) box(root, 0.18, 1.2, 0.18, x, 4.5, z, C.wood);
      box(root, 3.2, 0.15, 3.2, 0, 5.2, 0, C.roof);
      box(root, 2.9, 0.45, 2.9, 0, 4.15, 0, C.trim);
    }
  } else if (kind === 'hall') {
    room(age === 2 ? 4.4 : 5.2, 3.6, 3.8, 0, -0.6, 'civicHall');
    if (age === 2) {
      for (const x of [-3.2, 3.2]) {
        for (const z of [-1.5, 0, 1.5]) cyl(root, 0.12, 0.18, 2.4, x, 1.2, z, C.trim, 12);
        box(root, 1.7, 0.16, 3.6, x, 2.5, 0, C.cloth);
      }
    } else {
      room(2, 3, 2.5, -3.2, -0.4, 'recordWing');
      if (age === 4) room(2, 3, 2.5, 3.2, -0.4, 'assemblyWing');
      else {
        const civic = joint(root, 'civicLantern', 3.2, 0, -0.4);
        box(civic, 1.55, 3.6, 1.55, 0, 1.8, 0, wall);
        box(civic, 1.85, 0.19, 1.85, 0, 3.62, 0, C.trim);
        for (const x of [-0.65, 0.65])
          for (const z of [-0.65, 0.65]) {
            box(civic, 0.15, 1.35, 0.15, x, 4.34, z, C.trim);
            box(civic, 0.23, 0.12, 0.23, x, 4.95, z, C.gold);
          }
        cyl(civic, 0.28, 0.37, 0.52, 0, 4.2, 0, '#927c4e', 16);
        beam(civic, [0, 4.2, 0], [0, 4.9, 0], 0.022, C.dark);
        box(civic, 1.7, 0.15, 1.7, 0, 5.04, 0, C.trim);
        cyl(civic, 0, 1.34, 1.2, 0, 5.7, 0, C.roof, 4).rotation.y = Math.PI / 4;
        box(civic, 0.7, 1.45, 0.055, 0, 2.25, 0.8, C.cloth);
        box(civic, 0.06, 1.1, 0.06, 0, 2.25, 0.83, C.gold);
      }
    }
    if (age === 4) {
      cyl(root, 0.85, 0.85, 1.2, 0, 5.5, -0.6, C.trim, 8);
      cyl(root, 0, 1.15, 1.0, 0, 6.6, -0.6, C.roof, 8);
    }
    for (const x of [-1.4, -0.7, 0.7, 1.4]) cyl(root, 0.11, 0.16, 2.5, x, 1.25, 2.2, C.trim, 12);
    box(root, 3.5, 0.22, 1.4, 0, 2.65, 2.1, C.trim);
    flag(4.4, 2.4, 5.3);
  } else if (kind === 'house') {
    if (age === 2) {
      room(2.8, 2.7, 2.3, 0, 0, 'courtyardResidence');
      box(root, 2.4, 0.08, 1.8, 0, 0.04, 2.1, '#bda17b');
      for (const x of [-1.2, 1.2]) box(root, 0.16, 1.1, 1.8, x, 0.55, 2.1, wall);
    } else if (age === 3) {
      room(2.4, 2.5, 2.1, -0.4, 0, 'timberResidence');
      room(1.5, 1.8, 1.8, 1.2, 0.35, 'pantry');
      box(root, 0.44, 2.7, 0.44, -0.9, 2.2, -0.6, C.stone);
    } else {
      room(3.0, 2.8, 3.5, 0, 0, 'brickTownhouse');
      box(root, 0.5, 2, 0.5, -0.8, 4.0, -0.5, C.stone);
      box(root, 1.5, 0.14, 0.8, 0, 1.9, 1.8, C.trim);
      for (const x of [-0.7, 0.7]) beam(root, [x, 1.9, 2.1], [x, 2.55, 2.1], 0.025, C.dark);
      beam(root, [-0.7, 2.55, 2.1], [0.7, 2.55, 2.1], 0.025, C.dark);
    }
  } else if (kind === 'market') {
    if (age === 2) {
      box(root, 5, 0.12, 4, 0, 0.06, 0, C.trim);
    } else if (age === 3) {
      room(4.2, 1.8, 2.7, 0, -1.8, 'merchantHall');
    } else {
      room(5, 1.8, 3.8, 0, -1.8, 'exchange');
      cyl(root, 0.65, 0.7, 1.4, 0, 4.7, -1.8, C.trim, 8);
      cyl(root, 0, 0.9, 0.9, 0, 5.85, -1.8, C.roof, 8);
    }
    for (const x of [-2, 0, 2]) {
      const stall = joint(root, 'marketStall', x, 0, 1);
      for (const sx of [-0.65, 0.65]) beam(stall, [sx, 0, 0], [sx, 1.9, 0], 0.04, C.wood);
      for (let i = 0; i < 6; i++) box(stall, 0.25, 0.06, 1.4, -0.625 + i * 0.25, 1.85, 0, i % 2 ? C.light : C.cloth);
      box(stall, 1.5, 0.75, 0.7, 0, 0.4, 0, C.wood);
      for (let i = 0; i < 4; i++)
        ball(stall, -0.5 + i * 0.3, 0.85, 0, 0.1, 0.1, 0.12, i % 2 ? '#ac6449' : '#b6a15b', 1);
    }
  } else if (kind === 'tradePost') {
    const shed = part('caravanDepot');
    box(shed, 4, 0.15, 2.3, 0, 0.075, 0, C.wood);
    for (const x of [-1.8, 1.8]) for (const z of [-0.9, 0.9]) beam(shed, [x, 0.1, z], [x, 2.2, z], 0.075, C.wood);
    if (age === 2) {
      const canopy = box(shed, 4.4, 0.1, 2.7, 0, 2.2, 0, C.cloth);
      canopy.rotation.x = 0.12;
    } else roof(shed, 4.4, 2.7, 2.2);
    for (let i = 0; i < 5; i++) crate(-1.4 + i * 0.7, 0.5);
    box(shed, 3.6, 0.22, 0.06, 0, 1.9, 1, C.cloth);
    if (age === 4) {
      room(1.5, 2.2, 3.3, 2.7, 0, 'weighingOffice');
      for (const x of [-0.8, 0.8]) cyl(root, 0.14, 0.14, 1.3, x, 0.65, 2.4, C.dark, 12);
      beam(root, [-1.3, 1.3, 2.4], [1.3, 1.3, 2.4], 0.07, C.dark);
    }
  } else if (kind === 'landmark') {
    const p = part('monument');
    for (let i = 0; i < 4; i++) cyl(p, 2.6 - i * 0.4, 2.8 - i * 0.4, 0.3, 0, 0.15 + i * 0.3, 0, C.trim, 8);
    if (age === 3) {
      cyl(p, 0.55, 0.85, 5.8, 0, 4.1, 0, C.stone, 8);
      cyl(p, 1.2, 1.0, 0.3, 0, 7.1, 0, C.cloth, 8);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        beam(p, [Math.cos(a), 7.2, Math.sin(a)], [Math.cos(a), 8.2, Math.sin(a)], 0.07, C.trim);
      }
      cyl(p, 0, 1.5, 1.2, 0, 8.8, 0, C.roof, 8);
    } else {
      for (const x of [-1.4, 1.4]) box(p, 0.9, 5.8, 1.4, x, 3.6, 0, C.stone);
      box(p, 3.8, 1.1, 1.6, 0, 6.5, 0, C.trim);
      ball(p, 0, 7.65, 0, 0.75, 0.75, 0.75, C.gold, 2);
      box(p, 0.6, 2, 0.08, -1.4, 4.2, 0.73, C.cloth);
      box(p, 0.6, 2, 0.08, 1.4, 4.2, 0.73, C.cloth);
    }
  } else if (kind === 'temple') {
    const p = part('sanctuary');
    for (let i = 0; i < 3; i++) box(p, 5 - i * 0.4, 0.2, 4 - i * 0.4, 0, 0.1 + i * 0.2, 0, C.trim);
    if (age === 2) {
      room(3.3, 2.8, 3.3, 0, 0, 'classicalSanctuary');
      for (const x of [-1.8, -0.9, 0.9, 1.8]) cyl(p, 0.13, 0.19, 2.7, x, 1.95, 1.8, C.trim, 14);
    } else {
      room(3.3, 4.8, 4.1, 0, 0, 'nave');
      if (age === 3) {
        room(1.6, 1.7, 6, -2.4, 1.2, 'bellTower');
        cyl(p, 0, 1.1, 1.8, -2.4, 6.9, 1.2, C.roof, 8);
      } else {
        room(5, 1.6, 3.1, 0, -0.8, 'transept');
        mesh(new T.SphereGeometry(1.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(C.roof), p, 0, 4.3, 0);
        cyl(p, 0.25, 0.35, 0.8, 0, 6.1, 0, C.gold, 12);
      }
    }
  } else if (kind === 'academy') {
    room(5, 2, 3.5, 0, -1.5, 'library');
    room(1.8, 3.4, 2.8, -2.5, 0.7, 'lectureWing');
    if (age === 4) {
      room(1.8, 3.4, 3.8, 2.5, 0.7, 'laboratoryWing');
      cyl(root, 0.9, 1, 1.2, 2.5, 4.5, 0.7, C.trim, 20);
      mesh(new T.SphereGeometry(0.95, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(C.roof), root, 2.5, 5.1, 0.7);
      beam(root, [2.5, 5.2, 0.7], [2.9, 5.6, 1.2], 0.1, C.dark);
    } else {
      for (const x of [0.7, 1.5, 2.3]) beam(root, [x, 0, 1.5], [x, 2.4, 1.5], 0.09, C.trim);
      box(root, 2.4, 0.15, 3.1, 1.5, 2.5, 0.2, C.roof);
    }
    cyl(root, 0.7, 0.8, 0.5, 0, 0.25, 1.4, C.trim, 20);
  } else if (kind === 'embassy') {
    room(3.6, 3.8, 4.2, 0, -0.5, 'diplomaticHall');
    for (const x of [-1.2, 0, 1.2]) cyl(root, 0.1, 0.14, 2.7, x, 1.35, 2, C.trim, 12);
    box(root, 3.3, 0.2, 1.2, 0, 2.85, 2, C.trim);
    if (age === 3) {
      tower(-2, -1.4, 0.65, 4.8);
      box(root, 0.6, 1.5, 0.04, -2, 3.2, -0.73, C.cloth);
    } else {
      room(1.6, 2.5, 2.8, -2.4, -0.7, 'consularWing');
      room(1.6, 2.5, 2.8, 2.4, -0.7, 'receptionWing');
      box(root, 3.3, 0.12, 1.2, 0, 3.3, 2, C.trim);
      for (const x of [-1.4, -0.7, 0, 0.7, 1.4]) beam(root, [x, 2.9, 2.5], [x, 3.6, 2.5], 0.025, C.dark);
    }
  } else if (kind === 'arsenal') {
    if (age === 3) {
      room(4.5, 3, 3.3, 0, -0.8, 'armory');
      for (const x of [-2.4, 2.4]) tower(x, -1, 0.65, 3.7);
    } else {
      for (const x of [-1.45, 1.45]) {
        room(2.4, 4.5, 2.3, x, -0.8, 'magazine');
        box(root, 1.3, 1.7, 0.04, x, 0.85, 1.48, C.dark);
      }
      for (let i = 0; i < 7; i++) cyl(root, 0.14, 0.14, 0.3, -1.2 + i * 0.4, 0.22, 2.6, C.dark, 12);
    }
    for (let i = 0; i < 4; i++) crate(-1.1 + i * 0.7, 2);
  } else room(3.5, 3, 2.8, 0, 0);
  return finishArchitecture(root);
}
