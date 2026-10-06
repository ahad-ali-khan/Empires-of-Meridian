import * as T from 'three';
import {C, mat, mesh, box, cyl, beam, ellipsoid as oval, tube, joint, finishRig} from './geometry';
import {addShot, animateShot, buildBow} from './combat';

export type Clip =
  | 'idle'
  | 'walk'
  | 'work'
  | 'mine'
  | 'farm'
  | 'load'
  | 'ram'
  | 'fire'
  | 'attack'
  | 'hunt'
  | 'chop'
  | 'gather'
  | 'process'
  | 'fish'
  | 'build'
  | 'heal'
  | 'carry'
  | 'graze'
  | 'flee'
  | 'die'
  | 'dead';
function face(parent: T.Group, villager: boolean, age = 4, role = '') {
  const p = joint(parent, 'head', 0, 1.6, 0);
  oval(p, 0, 0.065, 0, 0.145, 0.183, 0.133, C.skin);
  for (const s of [-1, 1]) {
    oval(p, s * 0.145, 0.064, -0.01, 0.028, 0.05, 0.024, C.skin);
    oval(p, s * 0.15, 0.066, 0.006, 0.013, 0.027, 0.011, '#ad7e60');
  }
  if (['explorer', 'skirmisher', 'marksman'].includes(role)) {
    const brim = cyl(p, 0.28, 0.28, 0.025, 0, 0.2, 0.01, C.roof2, 24);
    brim.scale.z = 0.82;
    cyl(p, 0.14, 0.17, 0.1, 0, 0.255, -0.01, C.cloth, 16);
    if (role === 'marksman') beam(p, [0.13, 0.23, 0], [0.19, 0.46, -0.04], 0.015, C.gold);
  } else if (role === 'grenadier' || role === 'veteranRifle') {
    cyl(
      p,
      0.13,
      0.17,
      role === 'grenadier' ? 0.35 : 0.28,
      0,
      role === 'grenadier' ? 0.35 : 0.32,
      0,
      role === 'grenadier' ? C.cloth : '#43483c',
      16,
    );
    box(p, 0.14, 0.19, 0.025, 0, 0.32, 0.16, C.gold);
  } else if (role === 'commander') {
    const cap = mesh(new T.ConeGeometry(0.27, 0.13, 3), mat(C.roof2), p, 0, 0.24, 0);
    cap.rotation.y = Math.PI / 2;
    beam(p, [-0.18, 0.2, 0.06], [0.18, 0.2, 0.06], 0.018, C.gold);
  } else if (role === 'medic') {
    oval(p, 0, 0.23, -0.035, 0.17, 0.13, 0.15, C.light);
  } else if (age === 1) {
    tube(
      p,
      [
        [-0.14, 0.16, 0],
        [0, 0.17, 0.14],
        [0.14, 0.16, 0],
      ],
      0.025,
      C.cloth,
    );
    oval(p, 0, 0.17, -0.025, 0.145, 0.055, 0.115, '#514536');
  } else if (!villager && age < 4) {
    const hood = role === 'archer' || role === 'crossbow';
    mesh(
      new T.SphereGeometry(0.16, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      mat(hood ? C.cloth : age === 2 ? '#ab8a51' : '#88928c'),
      p,
      0,
      0.15,
      0,
    );
    if (!hood) {
      cyl(p, 0.045, 0.155, 0.16, 0, 0.27, 0, age === 2 ? '#ab8a51' : '#88928c', 16);
      box(p, 0.028, 0.22, 0.025, 0, 0.11, 0.14, C.gold);
    } else oval(p, 0, 0.14, -0.09, 0.12, 0.12, 0.1, C.cloth);
  } else if (!villager && age === 5) {
    mesh(new T.SphereGeometry(0.19, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(C.roof2), p, 0, 0.15, 0);
    box(p, 0.18, 0.045, 0.05, 0, 0.17, 0.17, C.cloth);
  } else if (villager) {
    const brim = cyl(p, 0.22, 0.23, 0.025, 0, 0.2, 0.015, C.roof2, 24);
    brim.scale.z = 0.84;
    oval(p, 0, 0.225, -0.01, 0.175, 0.074, 0.145, C.cloth);
    const band = cyl(p, 0.177, 0.182, 0.028, 0, 0.206, -0.01, C.gold, 20);
    band.scale.z = 0.83;
  } else {
    const brim = cyl(p, 0.194, 0.201, 0.028, 0, 0.218, 0.013, C.dark, 24);
    brim.scale.z = 0.86;
    const crown = cyl(p, 0.143, 0.175, 0.185, 0, 0.3, -0.011, C.cloth, 20);
    crown.scale.z = 0.88;
    const band = cyl(p, 0.17, 0.178, 0.025, 0, 0.222, -0.01, C.gold, 20);
    band.scale.z = 0.88;
    oval(p, 0, 0.29, 0.143, 0.028, 0.038, 0.011, C.gold);
    tube(
      p,
      [
        [-0.15, 0.22, 0.07],
        [-0.1, 0.21, 0.135],
        [0.1, 0.21, 0.135],
        [0.15, 0.22, 0.07],
      ],
      0.008,
      C.gold,
    );
  }
}

function boot(p: T.Group, x: number, y: number, z: number) {
  const shaft = cyl(p, 0.086, 0.078, 0.25, x, y + 0.22, z, '#3c3930', 12);
  shaft.scale.z = 0.9;
  oval(p, x, y + 0.072, z + 0.066, 0.091, 0.077, 0.167, '#3a352c');
  oval(p, x, y + 0.021, z + 0.066, 0.096, 0.027, 0.171, '#252925');
  box(p, 0.145, 0.04, 0.11, x, y + 0.019, z - 0.029, '#252925');
  box(p, 0.055, 0.02, 0.018, x, y + 0.17, z + 0.078, C.gold);
}

export function rifle(modern = false) {
  const p = new T.Group();
  p.name = 'rifle';
  joint(p, 'shotOrigin', 0.025, modern ? 0.8 : 0.9, 0.015).rotation.x = -Math.PI / 2;
  if (modern) {
    box(p, 0.065, 0.53, 0.065, 0, 0.14, 0, '#424c4a');
    box(p, 0.1, 0.25, 0.085, 0, -0.24, 0, C.dark);
    box(p, 0.12, 0.22, 0.05, 0, -0.43, -0.015, C.roof2);
    box(p, 0.07, 0.18, 0.08, 0, -0.04, -0.1, C.dark);
    beam(p, [0.018, 0.35, 0.008], [0.018, 0.76, 0.008], 0.018, '#59635f');
    box(p, 0.09, 0.2, 0.028, 0, 0.15, 0.055, C.roof2);
    cyl(p, 0.021, 0.021, 0.03, 0.018, 0.78, 0.008, '#172321', 16);
    joint(p, 'triggerGrip', -0.018, -0.16, 0.018);
    joint(p, 'foreGrip', 0.022, 0.19, 0.018);
    return p;
  }
  // Walnut stock silhouette with a dropped butt, narrow wrist and long forestock.
  const shape = new T.Shape();
  shape.moveTo(-0.075, -0.51);
  shape.lineTo(0.06, -0.5);
  shape.lineTo(0.071, -0.36);
  shape.lineTo(0.038, -0.2);
  shape.lineTo(0.042, 0.48);
  shape.lineTo(-0.009, 0.48);
  shape.lineTo(-0.022, -0.12);
  shape.lineTo(-0.059, -0.29);
  shape.closePath();
  const g = new T.ExtrudeGeometry(shape, {
    depth: 0.054,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.012,
    bevelThickness: 0.009,
  });
  mesh(g, mat('#785234', 0.62), p, 0, 0, -0.026);
  beam(p, [0.033, -0.14, 0.013], [0.033, 0.84, 0.013], 0.021, '#515b5a');
  beam(p, [0.01, -0.05, -0.03], [0.01, 0.7, -0.03], 0.008, '#a4a999');
  for (const y of [0.11, 0.39, 0.65]) {
    const band = cyl(p, 0.031, 0.031, 0.027, 0.031, y, 0.012, '#9e9b7f', 12);
    band.material = mat('#9e9b7f', 0.4, 0.6);
  }
  const muzzle = cyl(p, 0.029, 0.028, 0.042, 0.033, 0.85, 0.013, '#6b7370', 16);
  muzzle.material = mat('#6b7370', 0.4, 0.7);
  cyl(p, 0.015, 0.015, 0.003, 0.033, 0.873, 0.013, '#151f22', 12);
  box(p, 0.071, 0.14, 0.018, 0.037, -0.11, 0.052, '#898b76');
  beam(p, [0.055, -0.05, 0.06], [0.089, 0.005, 0.064], 0.012, '#aaa991');
  box(p, 0.036, 0.03, 0.025, 0.093, 0.019, 0.064, '#555d59');
  const trigger = mesh(
    new T.TorusGeometry(0.041, 0.008, 6, 16, Math.PI * 1.8),
    mat('#c4ad73', 0.4, 0.5),
    p,
    -0.031,
    -0.18,
    0.012,
  );
  trigger.scale.y = 1.4;
  beam(p, [-0.014, -0.12, 0.013], [-0.017, -0.18, 0.013], 0.008, '#a5a792');
  box(p, 0.14, 0.018, 0.07, -0.005, -0.51, 0, '#ad9a68');
  // Flattened triangular bayonet, not another cylindrical extension.
  const bayonet = new T.BufferGeometry();
  bayonet.setAttribute(
    'position',
    new T.Float32BufferAttribute([0.054, 0.81, 0.018, 0.093, 0.84, 0.018, 0.068, 1.08, 0.018, 0.071, 0.84, 0.001], 3),
  );
  bayonet.setIndex([0, 1, 2, 0, 2, 3, 1, 3, 2, 0, 3, 1]);
  bayonet.computeVertexNormals();
  mesh(bayonet, mat('#c0c8c1', 0.28, 0.8), p);
  tube(
    p,
    [
      [-0.01, -0.36, -0.045],
      [-0.085, -0.03, -0.075],
      [-0.045, 0.37, -0.049],
    ],
    0.01,
    '#6f6044',
  );
  joint(p, 'triggerGrip', -0.018, -0.16, 0.018);
  joint(p, 'foreGrip', 0.022, 0.19, 0.018);
  return p;
}

export function buildPerson(villager = false, mounted = false, crew = false, female = false, age = 4, role = '') {
  const root = new T.Group();
  root.name = villager ? 'villager' : 'infantry';
  const body = joint(root, 'body');
  const cloth = villager
    ? female
      ? '#c9bea4'
      : '#b7ad8d'
    : age === 1
      ? '#8e7957'
      : age === 2
        ? '#c8b58a'
        : age === 3
          ? '#63766b'
          : age === 5
            ? '#526c60'
            : C.cloth;
  const profile = (
    female
      ? [
          [0.147, 1.05],
          [0.137, 1.16],
          [0.16, 1.31],
          [0.182, 1.43],
          [0.155, 1.52],
        ]
      : [
          [0.164, 1.05],
          [0.159, 1.16],
          [0.184, 1.32],
          [0.208, 1.43],
          [0.176, 1.51],
        ]
  ).map(([r, y]) => new T.Vector2(r, y));
  const torso = mesh(new T.LatheGeometry(profile, 20), mat(cloth), body);
  torso.scale.z = female ? 0.74 : 0.67;
  // Raised hems, side seams and folded collars catch the light at close range.
  for (const side of [-1, 1]) {
    tube(
      body,
      [
        [side * 0.148, 1.07, 0.075],
        [side * 0.158, 1.23, 0.094],
        [side * 0.185, 1.42, 0.065],
      ],
      0.006,
      villager ? '#968c74' : C.roof2,
    );
    const lapel = box(body, 0.059, 0.19, 0.022, side * 0.057, 1.437, 0.126, villager ? C.light : C.roof2);
    lapel.rotation.z = side * 0.33;
  }

  oval(body, 0, 1.46, 0, female ? 0.195 : 0.22, 0.079, 0.127, cloth);
  if (female) {
    oval(body, 0, 1.33, 0.05, 0.164, 0.13, 0.105, cloth);
    oval(body, 0, 0.99, 0, 0.195, 0.12, 0.12, cloth);
    root.scale.setScalar(0.93);
  }
  cyl(body, 0.066, 0.073, 0.12, 0, 1.565, 0.0, C.skin, 16);
  if (!villager) {
    const collar = cyl(body, 0.092, 0.105, 0.09, 0, 1.53, 0, C.roof2, 16);
    collar.scale.z = 0.8;
  }
  // Split cloth panels overlap the hips; mounted coat tails follow the saddle.
  for (const s of [-1, 1]) {
    if (!villager && age === 4) {
      const tail = box(body, 0.2, mounted ? 0.24 : 0.4, 0.2, s * 0.11, mounted ? 0.99 : 0.89, -0.015, cloth);
      tail.rotation.z = s * 0.08;
    }
    const seam = box(body, 0.017, 0.44, 0.025, s * 0.018, 1.25, 0.14, villager ? '#716853' : C.gold);
    seam.rotation.z = s * 0.015;
    for (let i = 0; i < 4; i++) oval(body, s * 0.025, 1.14 + i * 0.084, 0.145, 0.012, 0.012, 0.007, C.gold);
  }
  const belt = cyl(body, 0.184, 0.184, 0.061, 0, 1.04, 0, '#4b4031', 16);
  belt.scale.z = 0.72;
  box(body, 0.061, 0.055, 0.025, 0, 1.04, 0.139, C.gold);
  if (villager) {
    const apronGeo = new T.PlaneGeometry(0.32, 0.48, 6, 5);
    const ap = apronGeo.attributes.position;
    for (let i = 0; i < ap.count; i++) {
      const x = ap.getX(i),
        y = ap.getY(i);
      ap.setZ(i, 0.018 * Math.cos(x * 30) + (0.24 - y) * 0.04);
    }
    apronGeo.computeVertexNormals();
    const apron = mesh(apronGeo, mat(C.cloth), body, 0, 1.005, 0.151);
    (apron.material as T.MeshStandardMaterial).side = T.DoubleSide;
    box(body, 0.17, 0.13, 0.014, 0, 1.07, 0.188, C.roof2);
    for (const side of [-1, 1]) beam(body, [side * 0.14, 0.77, 0.18], [side * 0.15, 1.22, 0.18], 0.006, C.gold);
  } else {
    const strap = box(body, 0.048, 0.47, 0.019, 0, 1.28, 0.147, C.light);
    strap.rotation.z = -0.49;
    box(body, 0.26, 0.29, 0.12, 0, 1.24, -0.18, C.wood);
    const roll = cyl(body, 0.06, 0.06, 0.3, 0, 1.44, -0.2, C.pants, 12);
    roll.rotation.z = Math.PI / 2;
    for (const x of [-0.1, 0.1]) box(body, 0.025, 0.31, 0.026, x, 1.24, -0.25, '#453c2e');
    box(body, 0.14, 0.13, 0.06, -0.18, 1.05, 0.1, '#524333');
  }
  for (const s of [-1, 1]) {
    const leg = joint(body, `leg${s}`, s * 0.115, 1.02, 0);
    if (mounted) {
      leg.position.set(s * 0.24, 1.04, 0.02);
      leg.rotation.z = s * 0.42;
      leg.rotation.x = -0.74;
    }
    beam(leg, [0, 0, 0], [0, -0.37, 0.012], 0.103, villager ? '#726c58' : C.pants, 0.074);
    const knee = joint(leg, `knee${s}`, 0, -0.37, 0.012);
    if (mounted) knee.rotation.x = 1.0;
    oval(knee, 0, 0, 0, 0.075, 0.078, 0.071, villager ? '#726c58' : C.pants);
    beam(knee, [0, 0, 0], [0, -0.37, 0], 0.066, villager ? '#726c58' : C.pants, 0.053);
    boot(knee, 0, -0.63, 0.0);
    joint(knee, `foot${s}`, 0, -0.609, 0.066);
    const arm = joint(body, `arm${s}`, s * (female ? 0.197 : 0.22), 1.46, 0);
    arm.rotation.z = s * 0.11;
    oval(arm, 0, -0.05, 0, 0.092, 0.13, 0.085, cloth);
    beam(arm, [0, -0.06, 0], [0, -0.28, 0], 0.079, cloth, 0.057);
    if (!villager) oval(arm, s * 0.006, 0.01, 0, 0.093, 0.024, 0.092, C.gold);
    const elbow = joint(arm, `elbow${s}`, 0, -0.28, 0);
    elbow.rotation.x = -0.24;
    beam(elbow, [0, 0, 0], [0, -0.265, 0], 0.059, cloth, 0.045);
    cyl(elbow, 0.052, 0.048, 0.055, 0, -0.25, 0, villager ? C.light : C.roof2, 12);
    const hand = joint(elbow, `hand${s}`, 0, -0.3, 0);
    oval(hand, 0, 0, 0, 0.043, 0.06, 0.036, C.skin);
    for (let i = 0; i < 4; i++) oval(hand, -0.027 + i * 0.018, -0.03, 0.025, 0.009, 0.03, 0.011, C.skin);
    oval(hand, s * -0.035, 0.01, 0.033, 0.016, 0.033, 0.016, C.skin);
    if (mounted) {
      arm.rotation.x = -0.55;
      elbow.rotation.x = -0.7;
    }
  }
  if (!villager && age < 4) {
    const tunic = cyl(body, 0.17, 0.23, 0.28, 0, 0.94, 0, C.cloth, 16);
    tunic.scale.z = 0.65;
  }
  if (!villager && age === 5) {
    box(body, 0.33, 0.3, 0.11, 0, 1.26, 0.13, C.roof2);
    for (const s of [-1, 1]) box(body, 0.11, 0.1, 0.075, s * 0.095, 1.2, 0.2, C.cloth);
  }
  if (!villager && !mounted && !crew) {
    const tool = joint(body, 'tool');
    tool.add(rifle(age === 5));
    addShot(root, 'bullet', 3.6, 0.65);
  }
  if (villager) {
    const hunting = buildBow(body, age >= 3);
    hunting.traverse((o) => (o.visible = false));
    root.userData.loadout = age >= 3 ? 'crossbow' : 'archer';
    addShot(root, age >= 3 ? 'bolt' : 'arrow', 3, 1.3);
    const workTool = joint(body, 'workTool', 0.15, 1.0, 0.5);
    const pick = joint(workTool, 'pickTool');
    beam(pick, [0, -0.35, 0], [0, 0.55, 0], 0.022, '#806343');
    // The head lies in the swing plane (YZ): the tapered forward point leads.
    beam(pick, [0, 0.54, -0.08], [0, 0.49, -0.3], 0.048, '#697774', 0.003);
    beam(pick, [0, 0.54, 0.06], [0, 0.43, 0.3], 0.048, '#87938d', 0.003);
    box(pick, 0.075, 0.1, 0.15, 0, 0.53, 0, '#68746e');
    const hoe = joint(workTool, 'hoeTool');
    beam(hoe, [0, -0.3, 0], [0, 1.2, 0], 0.022, '#806343');
    box(hoe, 0.24, 0.05, 0.17, 0, 1.22, 0.07, '#73817b');
    const axe = joint(workTool, 'axeTool');
    beam(axe, [0, -0.3, 0], [0, 0.57, 0], 0.022, C.wood);
    const blade = new T.Shape();
    blade.moveTo(0, 0.43);
    blade.lineTo(0.26, 0.34);
    blade.quadraticCurveTo(0.33, 0.52, 0.24, 0.68);
    blade.lineTo(0, 0.57);
    blade.closePath();
    const bladeMesh = mesh(
      new T.ExtrudeGeometry(blade, {depth: 0.035, bevelEnabled: false}),
      mat('#89928c', 0.4, 0.6),
      axe,
    );
    bladeMesh.rotation.y = -Math.PI / 2;
    const knife = joint(workTool, 'knifeTool');
    beam(knife, [0, -0.12, 0], [0, 0.04, 0], 0.025, C.wood);
    const knifeBlade = mesh(new T.ConeGeometry(0.035, 0.22, 4), mat('#bec4b9', 0.3, 0.6), knife, 0, 0.15, 0);
    knifeBlade.scale.z = 0.25;
    const hammer = joint(workTool, 'hammerTool');
    beam(hammer, [0, -0.15, 0], [0, 0.3, 0], 0.022, C.wood);
    box(hammer, 0.2, 0.09, 0.09, 0, 0.3, 0, C.dark);
    const basket = joint(body, 'basket', -0.28, 0.93, 0.06);
    cyl(basket, 0.13, 0.1, 0.2, 0, 0, 0, C.wood, 12);
    for (let i = 0; i < 7; i++)
      oval(basket, Math.sin(i * 2.4) * 0.075, 0.11, Math.cos(i * 2.4) * 0.075, 0.035, 0.03, 0.035, '#a2493d');
    const net = joint(body, 'castNet', 0, 1.05, 0.45);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      beam(net, [0, 0, 0], [Math.cos(a), 0, Math.sin(a)], 0.005, '#b4ae8f');
    }
    for (let i = 1; i <= 5; i++) {
      const ring = mesh(new T.TorusGeometry(i / 5, 0.005, 3, 24), mat('#b4ae8f'), net);
      ring.rotation.x = Math.PI / 2;
    }
    if (female) {
      const hair = joint(body, 'hair', 0, 1.65, -0.11);
      oval(hair, 0, 0, -0.018, 0.14, 0.13, 0.045, '#594433');
      oval(hair, 0, -0.03, -0.07, 0.07, 0.065, 0.06, '#594433');
      const skirt = cyl(body, 0.175, 0.25, 0.33, 0, 0.84, 0, '#777962', 20);
      skirt.scale.z = 0.68;
    }
  }
  face(body, villager, age, role);
  // Independent upper body: work can hinge at the hips while both legs remain
  // planted. Authored grip coordinates stay in this unshifted local space.
  const upperParts = body.children.filter((o) => !/^leg-?1$/.test(o.name));
  const spine = joint(body, 'spine');
  for (const part of upperParts) spine.add(part);

  root.userData.gaitStride = 0.66;
  root.userData.attackMotion = {period: 1.8, contact: 0.72};
  root.userData.mounted = mounted;
  root.userData.villager = villager;
  root.userData.gender = female ? 'female' : 'male';
  root.userData.age = age;
  return finishRig(root);
}

function horse() {
  const root = new T.Group();
  root.name = 'horse';
  const p = joint(root, 'horseBody');
  const hair = '#2d2925',
    coat = '#85583d';
  oval(p, 0, 1.41, -0.02, 0.36, 0.43, 0.77, coat);
  oval(p, 0, 1.4, 0.48, 0.32, 0.43, 0.39, '#8e5d40');
  oval(p, 0, 1.44, -0.58, 0.36, 0.39, 0.38, coat);
  // Sweep an elliptical neck along an anatomical S-curve.
  const rings = [
    [0.4, 1.42, 0.26, 0.32],
    [0.56, 1.71, 0.245, 0.28],
    [0.68, 1.99, 0.19, 0.23],
    [0.83, 2.22, 0.14, 0.16],
  ];
  const v: number[] = [],
    ix: number[] = [];
  rings.forEach(([z, y, rx, ry], j) => {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      v.push(Math.cos(a) * rx, y + Math.sin(a) * ry * 0.4, z + Math.sin(a) * ry);
      if (j < rings.length - 1) {
        const k = j * 16 + i,
          n = j * 16 + ((i + 1) % 16);
        ix.push(k, k + 16, n, n, k + 16, n + 16);
      }
    }
  });
  const ng = new T.BufferGeometry();
  ng.setAttribute('position', new T.Float32BufferAttribute(v, 3));
  ng.setIndex(ix);
  ng.computeVertexNormals();
  mesh(ng, mat(coat), p);
  const head = joint(p, 'horseHead', 0, 2.16, 0.85);
  head.rotation.x = -0.25;
  oval(head, 0, 0, 0.1, 0.15, 0.21, 0.29, coat);
  oval(head, 0, -0.15, 0.31, 0.12, 0.14, 0.22, '#95674c');
  oval(head, 0, -0.23, 0.44, 0.13, 0.1, 0.13, '#5d4739');
  for (const s of [-1, 1]) {
    const ear = oval(head, s * 0.104, 0.26, -0.03, 0.046, 0.17, 0.057, coat);
    ear.rotation.z = -s * 0.16;
    const inner = oval(head, s * 0.105, 0.28, 0.019, 0.025, 0.106, 0.011, '#bb9072');
    inner.rotation.z = -s * 0.16;
    oval(head, s * 0.139, 0.023, 0.17, 0.027, 0.023, 0.019, '#241f19');
    oval(head, s * 0.152, 0.029, 0.176, 0.006, 0.006, 0.004, '#ded9c9');
    oval(head, s * 0.104, -0.207, 0.482, 0.024, 0.017, 0.016, '#2d2722');
    tube(
      head,
      [
        [s * 0.14, 0.1, -0.1],
        [s * 0.151, -0.07, 0.18],
        [s * 0.123, -0.21, 0.45],
      ],
      0.016,
      '#4d3b2d',
    );
  }
  tube(
    head,
    [
      [-0.13, -0.19, 0.41],
      [0, -0.24, 0.53],
      [0.13, -0.19, 0.41],
    ],
    0.018,
    '#564332',
  );
  for (let i = 0; i < 15; i++) {
    const f = i / 14;
    tube(
      p,
      [
        [0, 1.68 + f * 0.6, 0.32 + f * 0.4],
        [-0.07, 1.64 + f * 0.6, 0.29 + f * 0.4],
        [-0.11, 1.55 + f * 0.6, 0.26 + f * 0.4],
      ],
      0.025,
      hair,
    );
  }
  const tail = joint(p, 'tail', 0, 1.6, -0.83);
  for (let i = 0; i < 7; i++)
    tube(
      tail,
      [
        [0, 0, 0],
        [Math.sin(i) * 0.025, -0.18, -0.22],
        [Math.sin(i) * 0.05, -0.52, -0.27],
        [Math.sin(i) * 0.07, -0.82, -0.2],
      ],
      0.029,
      hair,
    );
  for (const x of [-0.24, 0.24])
    for (const z of [-0.55, 0.51]) {
      const front = z > 0;
      const leg = joint(p, `horseLeg${x}${z}`, x, 1.35, z);
      leg.userData.front = front;
      leg.userData.side = x;
      oval(leg, 0, -0.12, 0, 0.105, 0.25, 0.15, coat);
      beam(leg, [0, -0.19, 0], [0, -0.54, front ? 0.05 : -0.1], 0.08, coat, 0.052);
      const lower = joint(leg, 'hock', 0, -0.54, front ? 0.05 : -0.1);
      oval(lower, 0, 0, 0, 0.059, 0.077, 0.067, '#77513b');
      beam(lower, [0, -0.02, 0], [0, -0.57, 0.02], 0.047, coat, 0.037);
      oval(lower, 0, -0.53, 0.015, 0.05, 0.077, 0.059, '#b6aa8b');
      const hoof = cyl(lower, 0.047, 0.067, 0.12, 0, -0.66, 0.049, '#3e3d34', 12);
      hoof.scale.z = 1.35;
    }
  return root;
}

export function buildRider(age = 4) {
  const root = horse();
  root.name = 'cavalry';
  root.userData.gaitStride = 1.05;
  root.userData.attackMotion = {period: 1.8, contact: 0.72};
  const p = root.getObjectByName('horseBody') as T.Group;
  // Drape a curved cloth over the horse's back instead of inserting a plank.
  const positions: number[] = [],
    indices: number[] = [];
  for (let j = 0; j <= 8; j++)
    for (let i = 0; i <= 12; i++) {
      const u = (i / 12) * Math.PI;
      positions.push(Math.cos(u) * 0.415, 1.52 + Math.sin(u) * 0.34, -0.48 + (j / 8) * 0.78);
      if (i < 12 && j < 8) {
        const k = j * 13 + i;
        indices.push(k, k + 1, k + 13, k + 1, k + 14, k + 13);
      }
    }
  const cloth = new T.BufferGeometry();
  cloth.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  cloth.setIndex(indices);
  cloth.computeVertexNormals();
  const cm = mat(C.cloth);
  cm.side = T.DoubleSide;
  mesh(cloth, cm, p);
  oval(p, 0, 1.87, -0.07, 0.24, 0.07, 0.31, '#513c2b');
  oval(p, 0, 1.96, -0.33, 0.24, 0.13, 0.066, '#71513a');
  oval(p, 0, 1.97, 0.19, 0.18, 0.12, 0.063, '#71513a');
  const rider = buildPerson(false, true, false, false, age);
  rider.name = 'rider';
  rider.position.set(0, 1.01, -0.08);
  rider.scale.setScalar(0.88);
  p.add(rider);
  p.updateMatrixWorld(true);
  for (const s of [-1, 1]) {
    const foot = p.worldToLocal(rider.getObjectByName(`foot${s}`)!.getWorldPosition(new T.Vector3()));
    const stirrup = joint(p, `stirrup${s}`, foot.x, foot.y + 0.065, foot.z);
    const loop = mesh(new T.TorusGeometry(0.1, 0.012, 6, 20), mat('#b0a47f', 0.45, 0.5), stirrup);
    loop.rotation.y = Math.PI / 2;
    loop.scale.set(1.5, 0.65, 1);
    tube(
      p,
      [
        [s * 0.22, 1.91, -0.07],
        [foot.x, 1.59, foot.z],
        [foot.x, foot.y + 0.13, foot.z],
      ],
      0.017,
      '#554334',
    );
  }
  for (const s of [-1, 1]) {
    const grip = joint(rider.getObjectByName('body') as T.Group, `reinGrip${s}`, s * 0.1, 1.2, 0.28);
    p.updateMatrixWorld(true);
    const end = p.worldToLocal(grip.getWorldPosition(new T.Vector3()));
    tube(p, [[s * 0.13, 1.98, 1.28], [s * 0.2, 1.92, 0.68], end.toArray()], 0.012, '#56442d');
  }
  const lance = joint(p, 'lance', 0.62, 1.88, 0.06);
  beam(lance, [0, -0.25, 0], [0, 2.6, 0], 0.019, '#856a43');
  cyl(lance, 0.032, 0.027, 0.09, 0, 0, 0, '#b5a06b', 12);
  joint(lance, 'lanceGrip');
  const spear = new T.OctahedronGeometry(0.12);
  spear.scale(0.38, 2.4, 0.18);
  mesh(spear, mat('#c1c9c3', 0.3, 0.75), lance, 0, 2.8, 0);
  const flag = new T.Shape();
  flag.moveTo(0, 0);
  flag.lineTo(0.47, -0.07);
  flag.lineTo(0.35, -0.14);
  flag.lineTo(0.46, -0.23);
  flag.lineTo(0, -0.22);
  const flagMat = mat('#3e7778');
  flagMat.side = T.DoubleSide;
  mesh(new T.ShapeGeometry(flag), flagMat, lance, 0, 2.44, 0);
  return finishRig(root);
}

export function buildSheep() {
  const p = new T.Group();
  p.name = 'sheep';
  const body = joint(p, 'sheepBody');
  oval(body, 0, 0.66, 0, 0.31, 0.31, 0.48, '#d8d1b9');
  for (let i = 0; i < 52; i++) {
    const a = i * 2.39996,
      y = 1 - (2 * (i + 0.5)) / 52,
      r = Math.sqrt(1 - y * y);
    oval(
      body,
      Math.cos(a) * r * 0.28,
      0.66 + y * 0.26,
      Math.sin(a) * r * 0.44,
      0.09,
      0.09,
      0.09,
      i % 3 ? '#e5dfca' : '#cdc7b2',
    );
  }
  const collar = cyl(body, 0.175, 0.175, 0.075, 0, 0.77, 0.38, C.cloth, 18);
  collar.rotation.x = Math.PI / 2;
  oval(body, 0, 0.66, 0.45, 0.035, 0.043, 0.023, C.gold);
  const head = joint(body, 'sheepHead', 0, 0.8, 0.44);
  oval(head, 0, 0, 0.1, 0.13, 0.17, 0.19, '#635b4c');
  oval(head, 0, -0.09, 0.23, 0.085, 0.079, 0.12, '#746955');
  for (const s of [-1, 1]) {
    const ear = oval(head, s * 0.17, 0.04, 0.03, 0.13, 0.035, 0.065, '#9b9178');
    ear.rotation.z = s * 0.25;
    oval(head, s * 0.114, 0.027, 0.17, 0.018, 0.019, 0.011, '#201f1b');
  }
  for (const x of [-0.19, 0.19])
    for (const z of [-0.27, 0.27]) {
      const leg = joint(body, `sheepLeg${x}${z}`, x, 0.55, z);
      beam(leg, [0, 0, 0], [0, -0.43, 0], 0.045, '#79715d', 0.031);
      for (const s of [-1, 1]) oval(leg, s * 0.019, -0.48, 0.016, 0.022, 0.06, 0.055, '#3c3d33');
    }
  const tail = joint(body, 'sheepTail', 0, 0.75, -0.44);
  oval(tail, 0, -0.08, -0.04, 0.07, 0.14, 0.067, '#d8d1b9');
  return finishRig(p);
}
export function buildFish() {
  const p = new T.Group();
  p.name = 'fish';
  oval(p, 0, 0, 0, 0.09, 0.15, 0.36, '#7ba7a0');
  oval(p, 0, 0.052, -0.03, 0.075, 0.1, 0.29, '#496e71');
  for (const s of [-1, 1]) oval(p, s * 0.072, 0.026, 0.22, 0.018, 0.02, 0.013, '#182e30');
  const tail = joint(p, 'fishTail', 0, 0, -0.29);
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0, 0, 0.18, -0.22, 0, -0.18, -0.22], 3));
  g.computeVertexNormals();
  const m = mat('#678e8c');
  m.side = T.DoubleSide;
  mesh(g, m, tail);
  return finishRig(p);
}

const rigs = new WeakMap<T.Object3D, Map<string, T.Object3D>>();
const down = new T.Vector3(0, -1, 0);
function armTo(rig: Map<string, T.Object3D>, side: number, target: T.Vector3) {
  const arm = rig.get(`arm${side}`),
    elbow = rig.get(`elbow${side}`),
    hand = rig.get(`hand${side}`);
  if (!arm || !elbow || !hand) return;
  const shoulder = arm.position,
    delta = target.clone().sub(shoulder),
    distance = Math.min(0.578, Math.max(0.03, delta.length())),
    direction = delta.normalize();
  const upper = 0.28,
    lower = 0.3,
    along = (upper * upper - lower * lower + distance * distance) / (2 * distance),
    bend = Math.sqrt(Math.max(0, upper * upper - along * along));
  const hint = (arm.userData.pole as T.Vector3 | undefined)?.clone() ?? new T.Vector3(side * 0.55, -0.85, -0.12);
  hint.addScaledVector(direction, -hint.dot(direction)).normalize();
  const elbowPoint = shoulder.clone().addScaledVector(direction, along).addScaledVector(hint, bend);
  const upperDirection = elbowPoint.clone().sub(shoulder).normalize();
  const foreDirection = target.clone().sub(elbowPoint).normalize();
  const planeNormal = upperDirection.clone().cross(foreDirection).normalize();
  if (planeNormal.lengthSq() < 0.001) planeNormal.set(1, 0, 0);
  const up = upperDirection.clone().negate(),
    forward = planeNormal.clone().cross(up).normalize();
  arm.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(planeNormal, up, forward));
  elbow.position.set(0, -upper, 0);
  const lowerDirection = foreDirection.applyQuaternion(arm.quaternion.clone().invert());
  elbow.quaternion.setFromUnitVectors(down, lowerDirection);
  hand.position.set(0, -lower, 0);
  // The elbow plane follows the shoulder, while the palm counter-rotates onto
  // the grip. A moving elbow must never drag the hand off its held tool.
  const grip = arm.userData.gripRotation as T.Quaternion | undefined;
  if (grip) hand.quaternion.copy(arm.quaternion).multiply(elbow.quaternion).invert().multiply(grip);
  else hand.rotation.set(-0.16, side * (arm.userData.wristRoll ?? 0.18), side * 0.08);
}

function ease(value: number) {
  const f = T.MathUtils.clamp(value, 0, 1);
  return f * f * (3 - 2 * f);
}
function strikeCurve(t: number, period = 1.8) {
  const f = (t % period) / period;
  return f < 0.28
    ? -0.34 * ease(f / 0.28)
    : f < 0.4
      ? -0.34 + 1.34 * ease((f - 0.28) / 0.12)
      : f < 0.48
        ? 1
        : f < 0.82
          ? 1 - ease((f - 0.48) / 0.34)
          : 0;
}
function plantLeg(rig: Map<string, T.Object3D>, side: number, t: number, bodyY: number) {
  const leg = rig.get(`leg${side}`),
    knee = rig.get(`knee${side}`);
  if (!leg || !knee) return;
  const phase = ((((t * 6) / (Math.PI * 2) + (side === 1 ? 0 : 0.5)) % 1) + 1) % 1;
  const stance = phase < 0.6;
  const z = stance ? 0.19 - (phase / 0.6) * 0.38 : -0.19 + ease((phase - 0.6) / 0.4) * 0.38;
  const lift = stance ? 0 : Math.sin(((phase - 0.6) / 0.4) * Math.PI) * 0.12;
  placeFoot(rig, side, z, lift, bodyY);
}
function placeFoot(rig: Map<string, T.Object3D>, side: number, z: number, lift: number, bodyY: number) {
  const leg = rig.get(`leg${side}`),
    knee = rig.get(`knee${side}`);
  if (!leg || !knee) return;
  const dy = leg.position.y - (0.042 + lift - bodyY),
    a = Math.hypot(0.37, 0.012),
    b = Math.hypot(0.609, 0.066);
  const distance = Math.min(a + b - 0.002, Math.hypot(dy, z));
  const direction = Math.atan2(z, dy),
    upper = Math.acos(T.MathUtils.clamp((a * a + distance * distance - b * b) / (2 * a * distance), -1, 1));
  const lower = Math.acos(T.MathUtils.clamp((b * b + distance * distance - a * a) / (2 * b * distance), -1, 1));
  leg.rotation.x = -direction - upper + Math.atan2(0.012, 0.37);
  knee.rotation.x = -direction + lower + Math.atan2(0.066, 0.609) - leg.rotation.x;
}
function showPart(object: T.Object3D | undefined, visible: boolean) {
  object?.traverse((o) => (o.visible = visible));
}
export function animateAsset(root: T.Object3D, t: number, clip: Clip = 'idle') {
  const ram = root.getObjectByName('ramBeam');
  if (ram) {
    const phase = (t % 1.75) / 1.75;
    ram.position.z =
      clip === 'attack'
        ? phase < 0.65
          ? (-0.45 * phase) / 0.65
          : phase < 0.8
            ? -0.45 + ((phase - 0.65) / 0.15) * 0.85
            : 0.4 * (1 - (phase - 0.8) / 0.2)
        : 0;
  }
  const crown = root.getObjectByName('fallenCrown');
  if (crown) {
    const f = T.MathUtils.smoothstep(t, 0, 1.5);
    crown.rotation.z = (f * Math.PI) / 2;
    crown.position.y = f * crown.userData.landY;
  }
  if (root.name === 'sapperTeam') {
    root.children.forEach((child) => animateAsset(child, t, clip));
    return;
  }
  if (root.name === 'cannon' || root.userData.artillery) {
    const active = clip === 'attack' || clip === 'fire',
      phase = active ? t % 7 : 0,
      loader = root.getObjectByName('loader'),
      rammer = root.getObjectByName('rammer');
    const loading = active ? (phase < 1 ? phase : phase < 2 ? 1 : phase < 3 ? 3 - phase : 0) : 0;
    const ramming =
      phase < 2 ? 0 : phase < 2.6 ? (phase - 2) / 0.6 : phase < 4.2 ? 1 : phase < 5 ? (5 - phase) / 0.8 : 0;
    if (loader) {
      loader.position.set(-1.15 + loading * 1.55, 0, -0.68 + loading * 2.67);
      loader.rotation.y = loading > 0.99 ? -2.17 : loading > 0 ? 0.53 : Math.PI / 2;
      animateAsset(loader, t, !active ? clip : loading > 0 && loading < 1 ? 'walk' : 'load');
      showPart(loader.getObjectByName('ammo'), active && phase < 2);
    }
    if (rammer) {
      rammer.position.set(1.23 - ramming * 0.85, 0, 0.46 + ramming * 1.89);
      rammer.rotation.y = ramming > 0.99 ? -Math.PI / 2 : -0.42;
      animateAsset(rammer, t, !active ? clip : ramming > 0 && ramming < 1 ? 'walk' : 'ram');
    }
    const swab = root.getObjectByName('swab');
    if (swab) {
      showPart(swab, active && ramming > 0.99);
      swab.position.z = 2.4 + Math.sin((phase - 2.6) * Math.PI * 3) * 0.13;
    }
    for (const [crew, side] of [
      [loader, -1],
      [rammer, 1],
    ] as const)
      if (crew) {
        crew.userData.pushing = clip === 'walk';
        if (clip === 'walk') {
          crew.position.set(side * 1.0, 0, -0.62);
          crew.rotation.y = 0;
          animateAsset(crew, t, 'walk');
          showPart(crew.getObjectByName('ammo'), false);
        }
      }
    root.traverse((o) => {
      if (o.name.startsWith('cannonWheel')) o.rotation.x = clip === 'walk' ? t * 1.4 : 0;
    });
    const barrel = root.getObjectByName('barrel');
    if (barrel) barrel.position.z = 0.15 - (active && phase >= 5 ? 0.28 * Math.exp(-(phase - 5) * 10) : 0);
    const flash = root.getObjectByName('muzzleFlash');
    showPart(flash, active && phase > 5 && phase < 5.11);
    animateShot(root, t, clip === 'fire' || clip === 'attack');
    return;
  }
  let rig = rigs.get(root);
  if (!rig) {
    rig = new Map();
    root.traverse((o) => {
      if (o.name) rig!.set(o.name, o);
    });
    rigs.set(root, rig);
  }
  const wave = Math.sin(t * 6),
    walk = clip === 'walk' || clip === 'flee',
    work = clip === 'work' || clip === 'graze',
    attack = clip === 'attack' || clip === 'hunt',
    mining = clip === 'mine' || (clip === 'attack' && root.userData.villager),
    farming = clip === 'farm',
    chopping = clip === 'chop';
  const body = rig.get('body');
  if (body) {
    body.position.set(0, walk ? -0.042 + Math.cos(t * 12) * 0.008 : Math.sin(t * 1.9) * 0.005, 0);
    body.rotation.set(walk ? 0.025 : 0, 0, walk ? Math.sin(t * 6) * 0.015 : 0);
    const mounted = rig.has('horseBody') || root.userData.mounted;
    let castPoint: T.Vector3 | undefined;
    const spine = rig.get('spine');
    if (spine) {
      spine.rotation.set(0, 0, 0);
      spine.position.set(0, 0, 0);
    }
    for (const s of [-1, 1]) {
      const leg = rig.get(`leg${s}`),
        knee = rig.get(`knee${s}`),
        arm = rig.get(`arm${s}`),
        elbow = rig.get(`elbow${s}`);
      if (arm) {
        const exertion = mining || chopping || clip === 'build' ? strikeCurve(t, 2.4) : attack ? strikeCurve(t) : 0;
        const reach = clip === 'gather' ? Math.sin(t * 2.8) : farming ? Math.sin(t * 2.2) : exertion;
        // Scapular lift/protraction and an action-specific elbow pole create a
        // three-dimensional reach, rather than rotating every arm in one plane.
        arm.position.set(s * (root.userData.gender === 'female' ? 0.197 : 0.22), 1.46, 0);
        arm.position.y += Math.max(0, -exertion) * 0.065 + Math.max(0, reach) * 0.012;
        arm.position.z += Math.max(0, reach) * 0.035;
        arm.userData.pole ??= new T.Vector3();
        const bow = attack && root.userData.loadout === 'archer';
        (arm.userData.pole as T.Vector3).set(
          s * (bow ? 1 : 0.58 + Math.abs(reach) * 0.4),
          bow ? (s === 1 ? 0.22 : -0.18) : -0.76 + Math.max(0, -exertion) * 1.35,
          -0.3 + reach * 0.4 + (walk ? Math.sin(t * 6 + s) * 0.16 : 0),
        );
        arm.userData.wristRoll = 0.18 + reach * 0.38;
        delete arm.userData.gripRotation;
      }
      if (leg) leg.rotation.x = mounted ? -0.74 : walk ? wave * s * 0.42 : 0;
      if (knee) knee.rotation.x = mounted ? 1 : 0;
      if (walk && !mounted) plantLeg(rig, s, t, body.position.y);
      const shot = t % 3.6,
        reload = shot > 1.2 ? Math.sin(((shot - 1.2) / 2.4) * Math.PI) : 0,
        recoil = shot < 0.13 ? Math.sin((shot / 0.13) * Math.PI) * 0.09 : 0;
      if (arm)
        arm.rotation.set(
          mounted
            ? -0.55
            : work
              ? -0.35 + Math.sin(t * 2) * 0.15
              : attack
                ? -0.98 + reload * 0.65 + recoil
                : walk
                  ? -wave * s * 0.27
                  : -0.06,
          0,
          s * 0.11,
        );
      if (elbow) elbow.rotation.set(mounted ? -0.7 : work ? -0.4 : attack ? -0.6 : -0.24, 0, 0);
      const hand = rig.get(`hand${s}`);
      if (hand) hand.rotation.set(-0.16, s * 0.18, s * 0.08);
      if (walk && !mounted)
        armTo(
          rig,
          s,
          new T.Vector3(s * (0.22 + 0.06 * Math.cos(t * 6)), 1.02 + Math.abs(wave) * 0.075, -wave * s * 0.23),
        );
    }
    const head = rig.get('head');
    if (head) {
      head.rotation.y = attack ? 0 : Math.sin(t * 0.7) * 0.035;
      head.rotation.x = walk ? -0.02 : Math.sin(t * 1.2) * 0.012;
    }
    for (const name of ['mantle', 'shortCape']) {
      const cape = rig.get(name);
      if (cape) {
        cape.rotation.x = walk ? 0.1 + Math.sin(t * 6 - 0.5) * 0.035 : Math.sin(t * 1.7) * 0.013;
        cape.rotation.z = walk ? Math.sin(t * 3) * 0.025 : 0;
      }
    }
    const tool = rig.get('tool');
    if (tool) {
      const reload = attack && t % 3.6 > 1.1 ? Math.sin((((t % 3.6) - 1.1) / 2.5) * Math.PI) : 0;
      const kick = attack ? Math.max(0, 1 - Math.abs((t % 3.6) - 0.71) / 0.09) * 0.06 : 0;
      tool.position.set(0.04, attack ? 1.4 - reload * 0.16 : 1.23, 0.16 - kick);
      tool.rotation.set(attack ? Math.PI / 2 - reload * 0.65 : 0.36, 0, attack ? -0.08 : 0.22);
      tool.updateMatrix();
      for (const [side, name] of [
        [1, 'triggerGrip'],
        [-1, 'foreGrip'],
      ] as const) {
        const grip = rig.get(name);
        if (grip) {
          const point = grip.position.clone().applyMatrix4(tool.matrix);
          rig.get(`arm${side}`)!.userData.gripRotation = tool.quaternion
            .clone()
            .multiply(new T.Quaternion().setFromEuler(new T.Euler(0, (side * Math.PI) / 2, 0)));
          armTo(rig, side, point);
        }
      }
    }
    const workTool = rig.get('workTool');
    const held = rig.get('heldWeapon');
    if (root.userData.villager) showPart(held, clip === 'hunt');
    if (held && (!root.userData.villager || clip === 'hunt')) {
      const role = root.userData.loadout,
        phase = t % 3,
        draw = attack ? Math.min(1, phase / 1.3) : 0;
      if (role === 'archer') {
        held.position.set(
          -0.065,
          attack ? 1.41 : 1.2,
          0.35 - (attack ? Math.max(0, 1 - Math.abs(phase - 1.38) / 0.08) * 0.014 : 0),
        );
        held.rotation.set(0, 0, 0);
        held.updateMatrix();
        armTo(rig, -1, held.position.clone());
        const pull = phase < 1.3 ? draw : 0,
          grip = rig.get('drawGrip')!;
        grip.position.z = -0.07 - pull * 0.24;
        armTo(rig, 1, grip.position.clone().applyMatrix4(held.matrix));
        for (const [name, y] of [
          ['stringLower', -0.48],
          ['stringUpper', 0.48],
        ] as const) {
          const segment = rig.get(name)!,
            end = new T.Vector3(0, y, 0.08),
            delta = end.clone().sub(grip.position);
          segment.position.copy(end.add(grip.position).multiplyScalar(0.5));
          segment.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.clone().normalize());
          segment.scale.y = delta.length();
        }
        const arrow = rig.get('nockedArrow');
        if (arrow) arrow.position.z = -pull * 0.24;
        showPart(arrow, !attack || phase < 1.3 || phase > 2.4);
      } else if (role === 'crossbow') {
        held.position.set(
          0.02,
          attack ? 1.37 : 1.15,
          0.23 - (attack ? Math.max(0, 1 - Math.abs(phase - 1.37) / 0.07) * 0.035 : 0),
        );
        held.rotation.set(0, 0, 0);
        held.updateMatrix();
        for (const [side, name] of [
          [1, 'bowGrip'],
          [-1, 'supportGrip'],
        ] as const)
          armTo(rig, side, rig.get(name)!.position.clone().applyMatrix4(held.matrix));
        showPart(rig.get('nockedArrow'), !attack || phase < 1.3 || phase > 2.5);
      } else if (role === 'grenadier' || role === 'saboteur') {
        const windup = phase < 0.8 ? phase / 0.8 : phase < 1.3 ? 1 - (phase - 0.8) / 0.5 : 0;
        held.position.set(0.25, 1.35 + windup * 0.4, 0.14 - windup * 0.18);
        held.rotation.set(0, 0, 0);
        armTo(rig, 1, held.position.clone());
        showPart(held, !attack || phase < 1.3 || phase > 2.4);
      } else {
        const swing = attack ? strikeCurve(t) : 0,
          thrust = ['spearman', 'pikeman', 'allianceUnit'].includes(role),
          lunge = Math.max(0, swing) * 0.15;
        body.position.z = lunge;
        body.rotation.y = attack ? -swing * 0.12 : 0;
        held.position.set(0.19, 1.26 + (thrust ? 0 : -swing * 0.08), 0.19 + (thrust ? swing * 0.18 : lunge * 0.35));
        held.rotation.set(
          attack ? (thrust ? 1.3 + swing * 0.12 : 0.25 + swing * 1.6) : 0.2,
          0,
          attack ? (thrust ? -0.1 : -0.25 + swing * 0.25) : -0.18,
        );
        armTo(rig, 1, held.position.clone());
      }
    } else body.position.z = 0;
    const shield = rig.get('heldShield');
    if (shield) {
      shield.position.set(-0.28, 1.14, 0.25);
      armTo(rig, -1, shield.position.clone());
    }
    if (workTool) {
      workTool.visible = mining || farming || chopping || clip === 'process' || clip === 'build';
      showPart(rig.get('pickTool'), mining);
      showPart(rig.get('hoeTool'), farming);
      showPart(rig.get('axeTool'), chopping);
      showPart(rig.get('knifeTool'), clip === 'process');
      showPart(rig.get('hammerTool'), clip === 'build');
      showPart(rig.get('basket'), clip === 'gather' || clip === 'carry');
      showPart(rig.get('castNet'), clip === 'fish');
      if (mining || farming || chopping || clip === 'build') {
        if (chopping) {
          const swing = strikeCurve(t, 2.4);
          body.rotation.x = Math.max(0, swing) * 0.07;
          workTool.position.set(
            0.03 + swing * 0.07,
            1.25 + Math.max(0, -swing) * 0.7 - Math.max(0, swing) * 0.12,
            0.2 + Math.max(0, swing) * 0.1,
          );
          workTool.rotation.set(-0.55 + swing * 1.75, 0, 0.06);
        } else if (mining || clip === 'build') {
          const swing = -0.55 + strikeCurve(t, 2.4) * 2.6;
          body.rotation.x = Math.max(0, swing) * 0.035;
          workTool.position.set(
            0.03,
            1.4 + Math.max(0, -swing) * 0.17 - Math.max(0, swing) * 0.07,
            0.22 - Math.max(0, -swing) * 0.06 + Math.max(0, swing) * 0.055,
          );
          workTool.rotation.set(swing, 0, 0.06);
        } else {
          const pull = 0.5 - 0.5 * Math.cos(t * 2.2);
          body.rotation.x = 0.08 + pull * 0.055;
          body.position.y = -0.04;
          workTool.position.set(0.03, 1.25, 0.13 + pull * 0.08);
          workTool.rotation.set(2.7 + pull * 0.21, 0, 0.03);
        }
        for (const side of [-1, 1])
          rig.get(`arm${side}`)!.userData.gripRotation = workTool.quaternion
            .clone()
            .multiply(new T.Quaternion().setFromEuler(new T.Euler(0, (side * Math.PI) / 2, 0)));
        armTo(rig, 1, new T.Vector3(0, -0.1, 0).applyQuaternion(workTool.quaternion).add(workTool.position));
        armTo(rig, -1, new T.Vector3(0, 0.12, 0).applyQuaternion(workTool.quaternion).add(workTool.position));
      } else if (clip === 'process') {
        body.position.y = -0.26;
        workTool.position.set(0.12, 1.1, 0.22 + Math.sin(t * 4) * 0.025);
        workTool.rotation.set(2.1, 0, 0.2);
        armTo(rig, 1, workTool.position.clone());
        armTo(rig, -1, new T.Vector3(-0.15, 1.12, 0.22));
        for (const s of [-1, 1]) {
          rig.get(`leg${s}`)!.rotation.x = -0.55;
          rig.get(`knee${s}`)!.rotation.x = 1.15;
        }
      }
      if (clip === 'gather') {
        armTo(rig, 1, new T.Vector3(0.13, 1.25 + Math.sin(t * 2.8) * 0.1, 0.28));
        armTo(rig, -1, new T.Vector3(-0.28, 1.1, 0.12));
      }
      if (clip === 'fish') {
        const phase = (t % 5) / 5,
          net = rig.get('castNet')!;
        root.updateMatrixWorld(true);
        const start = body.localToWorld(new T.Vector3(0, 1.25, 0.3)),
          target = root.userData.fishingTarget
            ? new T.Vector3(...root.userData.fishingTarget)
            : root.localToWorld(new T.Vector3(0, 0.025, 3));
        const range = start.distanceTo(target);
        if (range > 6) {
          showPart(net, false);
        } else {
          const f =
              phase < 0.2 ? 0 : phase < 0.55 ? (phase - 0.2) / 0.35 : phase < 0.78 ? 1 : 1 - (phase - 0.78) / 0.22,
            point = start.clone().lerp(target, f);
          point.y += Math.sin(f * Math.PI) * (phase < 0.55 ? 0.8 : 0.12);
          castPoint = point;
          net.scale.setScalar(0.12 + f * 0.83);
          net.rotation.set(0, 0, 0);
        }
        armTo(rig, 1, new T.Vector3(0.15, 1.3, 0.3));
        armTo(rig, -1, new T.Vector3(-0.13, 1.32, 0.28));
      }
    }
    if (mounted) {
      body.position.y = 0;
      for (const s of [-1, 1]) {
        const grip = rig.get(`reinGrip${s}`);
        if (grip) armTo(rig, s, grip.position.clone());
      }
      if (attack) {
        if (tool) {
          tool.updateMatrix();
          for (const [s, name] of [
            [1, 'triggerGrip'],
            [-1, 'foreGrip'],
          ] as const)
            armTo(rig, s, rig.get(name)!.position.clone().applyMatrix4(tool.matrix));
        } else armTo(rig, 1, new T.Vector3(0.28, 1.25, 0.15));
      } else if (tool) {
        tool.position.set(0.26, 1.25, -0.24);
        tool.rotation.set(0, 0, 0.2);
      }
    }
    if (clip === 'heal') {
      body.position.z = 0.03;
      armTo(rig, 1, new T.Vector3(0.12, 1.06 + Math.sin(t * 3) * 0.035, 0.42));
      armTo(rig, -1, new T.Vector3(-0.12, 1.05, 0.34));
    }
    if (clip === 'load') {
      const phase = t % 7,
        lift = phase < 2 ? Math.sin((phase / 2) * Math.PI) : 0;
      armTo(rig, 1, new T.Vector3(0.12, 0.85 + lift * 0.35, 0.4));
      armTo(rig, -1, new T.Vector3(-0.1, 0.88 + lift * 0.32, 0.4));
    }
    if (clip === 'ram') {
      const phase = t % 7,
        stroke = phase > 2 && phase < 4 ? Math.sin((phase - 2) * Math.PI * 2) * 0.11 : 0;
      armTo(rig, 1, new T.Vector3(0.12, 1.15, 0.35 + stroke));
      armTo(rig, -1, new T.Vector3(-0.1, 1.18, 0.48 + stroke));
    }
    if (root.userData.pushing) {
      armTo(rig, 1, new T.Vector3(0.1, 1.1, 0.3));
      armTo(rig, -1, new T.Vector3(-0.1, 1.1, 0.3));
    }
    if (spine && !mounted) {
      let bend = walk ? 0.035 : 0,
        twist = walk ? Math.sin(t * 6) * 0.065 : 0;
      let crouch = 0;
      if (mining || chopping || clip === 'build') {
        const force = strikeCurve(t, 2.4);
        bend = -0.14 + Math.max(0, force) * 0.69;
        twist = (chopping ? 0.18 : 0.07) * force;
        crouch = Math.max(0, force) * 0.14;
        if (head) head.rotation.x = -bend * 0.35;
      } else if (farming) {
        bend = 0.38 + (0.5 - 0.5 * Math.cos(t * 2.2)) * 0.18;
        crouch = 0.1;
      } else if (clip === 'process') {
        bend = 0.48;
        twist = Math.sin(t * 4) * 0.06;
        crouch = 0.31;
      } else if (clip === 'gather') {
        bend = 0.18 + Math.sin(t * 2.8) * 0.12;
        twist = Math.sin(t * 1.4) * 0.14;
        crouch = 0.04;
      } else if (clip === 'heal') {
        bend = 0.22;
        crouch = 0.12;
      } else if (clip === 'load') {
        bend = 0.24 + Math.sin(t * 2) * 0.1;
        crouch = 0.1;
      } else if (clip === 'ram') {
        bend = 0.22 + Math.sin(t * 4) * 0.09;
        twist = -0.09;
      } else if (clip === 'fish') {
        const phase = (t % 5) / 5;
        bend = phase < 0.2 ? -0.17 * ease(phase / 0.2) : phase < 0.55 ? 0.28 * ease((phase - 0.2) / 0.35) : 0.2;
        twist = Math.sin(phase * Math.PI * 2) * 0.1;
      } else if (attack) {
        const force = strikeCurve(t);
        bend = tool ? 0.06 : Math.max(0, force) * 0.24;
        twist = tool ? -0.1 : force * 0.14;
        crouch = tool ? 0.035 : Math.max(0, force) * 0.08;
      }
      if (!walk) body.rotation.set(0, 0, 0);
      if (crouch > 0) body.position.y = -crouch;
      spine.rotation.set(bend, twist, 0);
      spine.position.set(0, 1.05 * (1 - Math.cos(bend)), -1.05 * Math.sin(bend));
      if (!walk && (crouch > 0 || attack))
        for (const side of [-1, 1]) placeFoot(rig, side, side === 1 ? 0.15 : -0.08, 0, body.position.y);
    }
    // A cast is a world-space trajectory. Resolve it after the full body pose,
    // so bending the fisher cannot lift the net off the water or shift its target.
    if (castPoint) {
      const net = rig.get('castNet')!;
      root.updateMatrixWorld(true);
      net.position.copy(net.parent!.worldToLocal(castPoint));
      net.quaternion.copy(net.parent!.getWorldQuaternion(new T.Quaternion())).invert();
    }
  }
  for (const [name, o] of rig) {
    if (name.startsWith('horseLeg')) {
      o.rotation.x = walk
        ? Math.sin(t * 6 + (o.userData.side > 0 ? Math.PI : 0) + (o.userData.front ? 0 : Math.PI)) * 0.36
        : Math.sin(t * 0.7) * 0.012;
      const h = o.getObjectByName('hock');
      if (h) h.rotation.x = walk ? Math.max(0, -o.rotation.x) * 1.2 : 0;
    }
    if (name.startsWith('sheepLeg'))
      o.rotation.x = walk ? Math.sin(t * 6 + (name.includes('-') ? Math.PI : 0)) * 0.3 : 0;
    if (name.startsWith('animalLeg')) {
      o.rotation.x = walk
        ? Math.sin(t * (clip === 'flee' ? 10 : 6) + (o.position.x * o.position.z > 0 ? 0 : Math.PI)) * 0.38
        : 0;
      const knee = o.getObjectByName('animalKnee');
      if (knee) knee.rotation.x = walk ? Math.max(0, -o.rotation.x) * 1.7 : 0;
    }
    if (name.startsWith('birdWing')) o.rotation.z = (name.endsWith('-1') ? -1 : 1) * Math.sin(t * 5) * 0.55;
    if (name === 'rollingWheel') o.rotation.x = walk ? t * 2 : 0;
  }
  const horseBody = rig.get('horseBody');
  if (horseBody) {
    horseBody.position.y = walk ? Math.cos(t * 12) * 0.022 : Math.sin(t) * 0.005;
    horseBody.position.z = 0;
    horseBody.rotation.x = walk ? Math.sin(t * 6) * 0.012 : 0;
  }
  const horseHead = rig.get('horseHead');
  if (horseHead) horseHead.rotation.x = -0.25 + (walk ? Math.sin(t * 6 - 0.5) * 0.045 : Math.sin(t * 1.3) * 0.018);
  for (const name of ['tail', 'animalTail']) {
    const tail = rig.get(name);
    if (tail) {
      tail.rotation.z = Math.sin(t * 1.7) * 0.12;
      tail.rotation.x = walk ? Math.sin(t * 3) * 0.07 : 0;
    }
  }
  const sh = rig.get('sheepHead');
  if (sh) {
    sh.rotation.x = work ? 0.75 + Math.sin(t * 2.8) * 0.1 : Math.sin(t * 0.8) * 0.05;
    sh.rotation.y = Math.sin(t) * 0.05;
  }
  const st = rig.get('sheepTail');
  if (st) st.rotation.x = Math.sin(t * 4) * 0.17;
  const ft = rig.get('fishTail');
  if (ft) ft.rotation.y = Math.sin(t * 9) * 0.55;
  const lance = rig.get('lance'),
    rider = rig.get('rider');
  if (lance && rider) {
    if (attack) {
      root.updateMatrixWorld(true);
      const hand = rig.get('hand1')!;
      lance.position.copy(lance.parent!.worldToLocal(hand.getWorldPosition(new T.Vector3())));
      lance.rotation.x = 0.85 + ease(Math.min((t % 1.8) / 0.5, 1)) * 0.62;
      horseBody!.position.z = Math.max(0, strikeCurve(t)) * 0.11;
    } else {
      lance.position.set(0.62, 1.88, 0.06);
      lance.rotation.x = 0.08;
    }
  }
  const saber = rig.get('mountedSaber');
  if (saber && body) {
    if (attack) {
      root.updateMatrixWorld(true);
      saber.position.copy(body.worldToLocal(rig.get('hand1')!.getWorldPosition(new T.Vector3())));
      saber.rotation.x = 1.2 + Math.sin(t * 5) * 0.7;
    } else {
      saber.position.set(-0.3, 1.0, -0.04);
      saber.rotation.x = 3.0;
    }
  }
  const dying = clip === 'dead' || clip === 'die';
  const death = clip === 'dead' ? 1 : Math.min(1, t);
  const animalHead = rig.get('animalHead');
  if (animalHead) animalHead.rotation.x = work ? 0.55 + Math.sin(t * 2) * 0.12 : attack ? Math.sin(t * 7) * 0.22 : 0;
  const animalBody = rig.get('animalBody');
  if (animalBody) {
    const lunge = attack ? Math.max(0, strikeCurve(t, 1.6)) : 0;
    animalBody.position.z = lunge * 0.65;
    animalBody.position.y = lunge * 0.18;
    for (const [name, leg] of rig)
      if (name.startsWith('animalLeg') && attack) leg.rotation.x = leg.position.z > 0 ? -lunge * 0.65 : lunge * 0.5;
    const jaw = rig.get('animalJaw');
    if (jaw) jaw.rotation.x = lunge * 0.65;
  }
  const fall = rig.get('horseBody') || rig.get('sheepBody') || rig.get('animalBody') || rig.get('body');
  if (fall) {
    fall.rotation.set(0, 0, 0);
    if (dying) {
      const angle =
        root.userData.deathDirection ?? root.uuid.split('').reduce((n, c) => n + c.charCodeAt(0), 0) * 2.39996;
      root.userData.deathDirection = angle;
      fall.quaternion.setFromAxisAngle(new T.Vector3(Math.cos(angle), 0, Math.sin(angle)), (death * Math.PI) / 2);
      fall.position.y = 0;
      root.updateMatrixWorld(true);
      const bounds = new T.Box3();
      fall.traverseVisible((o) => {
        if (o instanceof T.Mesh) {
          o.geometry.computeBoundingBox();
          bounds.union(o.geometry.boundingBox!.clone().applyMatrix4(o.matrixWorld));
        }
      });
      const ground = root.getWorldPosition(new T.Vector3()).y;
      if (!bounds.isEmpty())
        fall.position.y = Math.max(0, ground - bounds.min.y) / root.getWorldScale(new T.Vector3()).y;
    } else if (fall !== body && fall !== horseBody && fall !== animalBody) fall.position.y = 0;
  }
  animateShot(root, t, root.userData.villager ? clip === 'hunt' : attack || clip === 'fire');
}
