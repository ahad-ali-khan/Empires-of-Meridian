import * as THREE from 'three';

export type SurfaceClass = 'grass' | 'forest' | 'rock' | 'sand' | 'shallow-water' | 'road';
export type TerrainTile = {
  x: number;
  z: number;
  height: number;
  surface: SurfaceClass;
  buildable: boolean;
  passable: boolean;
};
export type NorthStarWorld = {
  terrain: { width: number; depth: number; tiles: readonly TerrainTile[] };
  group: THREE.Group;
  stats: { instances: number; shadowSettings: string; qualityTier: string };
  update: (elapsed: number, reducedMotion: boolean) => void;
  dispose: () => void;
};

const palette = {
  grass: 0x667b58,
  grassLight: 0xa3ad77,
  forest: 0x263e32,
  forestDeep: 0x1d3028,
  rock: 0x686b64,
  sand: 0xc9ab78,
  wetSand: 0x786c58,
  shallow: 0x5d9b91,
  water: 0x1e5969,
  road: 0x96795c,
  wood: 0x5a3c2a,
  woodLight: 0x8c6341,
  plaster: 0xc4b38d,
  roof: 0x6d4436,
  roofLight: 0x955b43,
  brass: 0xb99052,
  cloth: 0x9a4e3d,
  stone: 0x817c6a,
  foam: 0xd4ddca,
};
const shoreAt = (x: number): number =>
  2.5 + Math.sin(x * 0.58) * 0.34 + Math.sin(x * 1.2 + 0.8) * 0.12;
const tileHeight = (x: number, z: number): number =>
  0.12 * Math.sin(x * 0.42) + 0.08 * Math.cos(z * 0.55) + 0.035 * Math.sin((x + z) * 1.6);
const surfaceAt = (x: number, z: number, height: number): SurfaceClass => {
  if (z > shoreAt(x) + 0.22) return 'shallow-water';
  if (Math.abs(x + 1.2) < 0.34 && z < 3) return 'road';
  if (z > shoreAt(x) - 0.8) return 'sand';
  if (height > 0.16 || Math.abs(x) > 8.6) return 'rock';
  if (x < -4.4 && z < 1.9) return 'forest';
  return 'grass';
};
const colorFor = (surface: SurfaceClass): number =>
  surface === 'shallow-water' ? palette.shallow : palette[surface];

const buildTerrain = (): { mesh: THREE.Mesh; tiles: TerrainTile[]; shoreline: THREE.Vector3[] } => {
  const width = 20,
    depth = 14,
    segmentsX = 72,
    segmentsZ = 52;
  const vertices: number[] = [],
    colors: number[] = [],
    indices: number[] = [],
    tiles: TerrainTile[] = [],
    shoreline: THREE.Vector3[] = [];
  const color = new THREE.Color();
  const vertexIndex = (xIndex: number, zIndex: number): number => zIndex * (segmentsX + 1) + xIndex;
  for (let zIndex = 0; zIndex <= segmentsZ; zIndex += 1)
    for (let xIndex = 0; xIndex <= segmentsX; xIndex += 1) {
      const x = (xIndex / segmentsX - 0.5) * width,
        z = (zIndex / segmentsZ - 0.5) * depth;
      const height = tileHeight(x, z),
        surface = surfaceAt(x, z, height),
        land = z <= shoreAt(x) + 0.16;
      vertices.push(x, land ? height : -0.2, z);
      color.setHex(colorFor(surface));
      color.offsetHSL(0, 0, Math.sin(x * 2.4 + z * 1.7) * 0.035 + Math.cos(z * 3.1) * 0.02);
      colors.push(color.r, color.g, color.b);
      tiles.push({
        x,
        z,
        height,
        surface,
        buildable: surface === 'grass' || surface === 'sand' || surface === 'road',
        passable: surface !== 'rock' && surface !== 'shallow-water',
      });
    }
  for (let zIndex = 0; zIndex < segmentsZ; zIndex += 1)
    for (let xIndex = 0; xIndex < segmentsX; xIndex += 1) {
      const x = (xIndex / segmentsX - 0.5) * width,
        z = (zIndex / segmentsZ - 0.5) * depth;
      if (z >= shoreAt(x) + 0.16) continue;
      const a = vertexIndex(xIndex, zIndex),
        b = vertexIndex(xIndex + 1, zIndex),
        c = vertexIndex(xIndex, zIndex + 1),
        d = vertexIndex(xIndex + 1, zIndex + 1);
      indices.push(a, c, b, b, c, d);
    }
  for (let index = 0; index <= 36; index += 1) {
    const x = -9.6 + index * 0.53;
    shoreline.push(new THREE.Vector3(x, tileHeight(x, shoreAt(x)) + 0.012, shoreAt(x) + 0.14));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96 }),
  );
  mesh.receiveShadow = true;
  return { mesh, tiles, shoreline };
};

const makeMaterial = (color: number, roughness = 0.82, metalness = 0): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });
const box = (size: THREE.Vector3, color: number, roughness = 0.82): THREE.Mesh =>
  new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), makeMaterial(color, roughness));

const createWater = (): THREE.Mesh => {
  const geometry = new THREE.PlaneGeometry(34, 25, 36, 24),
    positions = geometry.getAttribute('position');
  for (let index = 0; index < positions.count; index += 1)
    positions.setZ(index, Math.sin(index * 0.7) * 0.025);
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  const water = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: palette.water,
      roughness: 0.22,
      metalness: 0.18,
      transparent: true,
      opacity: 0.93,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.23, 5);
  water.receiveShadow = true;
  return water;
};

const createShoreBand = (shoreline: THREE.Vector3[]): THREE.Group => {
  const group = new THREE.Group(),
    wetVertices: number[] = [],
    foamVertices: number[] = [];
  shoreline.forEach((point, index) => {
    const next = shoreline[Math.min(index + 1, shoreline.length - 1)]!,
      tangent = next.clone().sub(point).normalize(),
      normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
    const inland = point.clone().addScaledVector(normal, -0.68);
    wetVertices.push(point.x, point.y - 0.005, point.z, inland.x, inland.y - 0.005, inland.z);
    if (index % 2 === 0) foamVertices.push(point.x, point.y + 0.008, point.z);
  });
  const wetGeometry = new THREE.BufferGeometry();
  wetGeometry.setAttribute('position', new THREE.Float32BufferAttribute(wetVertices, 3));
  const wetIndices: number[] = [];
  for (let index = 0; index < shoreline.length - 1; index += 1)
    wetIndices.push(
      index * 2,
      index * 2 + 1,
      index * 2 + 2,
      index * 2 + 1,
      index * 2 + 3,
      index * 2 + 2,
    );
  wetGeometry.setIndex(wetIndices);
  wetGeometry.computeVertexNormals();
  const wetMesh = new THREE.Mesh(wetGeometry, makeMaterial(palette.wetSand, 1));
  wetMesh.receiveShadow = true;
  const foamGeometry = new THREE.BufferGeometry();
  foamGeometry.setAttribute('position', new THREE.Float32BufferAttribute(foamVertices, 3));
  group.add(
    wetMesh,
    new THREE.Line(
      foamGeometry,
      new THREE.LineBasicMaterial({ color: palette.foam, transparent: true, opacity: 0.48 }),
    ),
  );
  return group;
};

const createRoad = (): THREE.Mesh => {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.2, 0.03, 3.1),
    new THREE.Vector3(-1, 0.04, 1.4),
    new THREE.Vector3(-0.4, 0.05, -0.2),
    new THREE.Vector3(0.4, 0.05, -2.1),
  ]);
  const road = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 22, 0.38, 6, false),
    makeMaterial(palette.road, 1),
  );
  road.scale.y = 0.12;
  road.receiveShadow = true;
  return road;
};

const createTreeVariant = (
  variant: number,
  position: THREE.Vector3,
  scale: number,
): THREE.Group => {
  const tree = new THREE.Group(),
    trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.2, 1.15, 7),
      makeMaterial(palette.wood, 1),
    );
  trunk.position.y = 0.57;
  tree.add(trunk);
  const branches: readonly [number, number, number, number, number][] = [
    [0.18, 0.9, 0.1, 0.12, 0.46],
    [-0.18, 1.08, -0.04, -0.18, 0.38],
    [0.08, 1.34, -0.14, 0.24, 0.3],
  ];
  branches.slice(0, variant === 0 ? 3 : variant === 1 ? 2 : 1).forEach(([x, y, z, rz, length]) => {
    const branch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.065, length, 5),
      makeMaterial(palette.wood, 1),
    );
    branch.position.set(x, y, z);
    branch.rotation.z = rz;
    tree.add(branch);
  });
  const crowns: readonly [number, number, number, number][] =
    variant === 0
      ? [
          [0, 1.45, 0, 0.82],
          [0.36, 1.72, -0.08, 0.54],
          [-0.34, 1.68, 0.05, 0.58],
        ]
      : variant === 1
        ? [
            [0, 1.55, 0, 0.9],
            [0.2, 1.85, 0.1, 0.5],
          ]
        : [
            [0, 1.62, 0, 0.72],
            [-0.3, 1.75, -0.1, 0.46],
          ];
  crowns.forEach(([x, y, z, radius], index) => {
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(radius, radius * 1.25, 7),
      makeMaterial(index === 0 ? palette.forest : palette.forestDeep, 1),
    );
    crown.position.set(x, y, z);
    crown.rotation.y = index * 0.7;
    tree.add(crown);
  });
  tree.position.copy(position);
  tree.scale.setScalar(scale);
  return tree;
};

const createBanner = (position: THREE.Vector3, color: number): THREE.Group => {
  const banner = new THREE.Group(),
    pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 1.5, 6),
      makeMaterial(palette.brass, 0.42, 0.45),
    ),
    cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.32), makeMaterial(color, 1));
  pole.position.y = 0.75;
  cloth.position.set(0.2, 1.18, 0);
  banner.add(pole, cloth);
  banner.position.copy(position);
  return banner;
};

const createHall = (position: THREE.Vector3): THREE.Group => {
  const hall = new THREE.Group(),
    foundation = box(new THREE.Vector3(2.3, 0.22, 1.8), palette.stone, 1),
    body = box(new THREE.Vector3(2.05, 1.2, 1.55), palette.plaster),
    roof = new THREE.Mesh(new THREE.ConeGeometry(1.52, 0.72, 4), makeMaterial(palette.roof, 0.92)),
    eave = box(new THREE.Vector3(2.3, 0.12, 1.8), palette.roofLight, 0.9),
    door = box(new THREE.Vector3(0.32, 0.68, 0.05), palette.wood, 0.9),
    beamA = box(new THREE.Vector3(2.16, 0.11, 0.12), palette.wood, 0.9),
    beamB = box(new THREE.Vector3(0.12, 1.15, 0.12), palette.wood, 0.9),
    chimney = box(new THREE.Vector3(0.24, 0.64, 0.24), palette.stone, 1);
  foundation.position.y = 0.11;
  body.position.y = 0.78;
  roof.position.y = 1.75;
  roof.rotation.y = Math.PI / 4;
  eave.position.y = 1.42;
  door.position.set(0, 0.5, 0.8);
  beamA.position.set(0, 1.18, 0.8);
  beamB.position.set(-0.72, 0.8, 0.8);
  chimney.position.set(-0.5, 1.92, -0.36);
  hall.add(
    foundation,
    body,
    roof,
    eave,
    door,
    beamA,
    beamB,
    chimney,
    createBanner(new THREE.Vector3(0.98, 0, -0.68), palette.cloth),
  );
  hall.position.copy(position);
  return hall;
};

const createHouse = (position: THREE.Vector3, scale: number): THREE.Group => {
  const house = new THREE.Group(),
    base = box(new THREE.Vector3(1.45, 0.16, 1.15).multiplyScalar(scale), palette.stone, 1),
    body = box(new THREE.Vector3(1.28, 0.78, 0.98).multiplyScalar(scale), palette.plaster),
    roof = new THREE.Mesh(
      new THREE.ConeGeometry(0.9 * scale, 0.52 * scale, 4),
      makeMaterial(palette.roofLight, 0.9),
    ),
    door = box(new THREE.Vector3(0.22, 0.42, 0.05).multiplyScalar(scale), palette.wood),
    window = box(new THREE.Vector3(0.26, 0.2, 0.04).multiplyScalar(scale), palette.brass, 0.5);
  base.position.y = 0.08 * scale;
  body.position.y = 0.54 * scale;
  roof.position.y = 1.15 * scale;
  roof.rotation.y = Math.PI / 4;
  door.position.set(0, 0.33 * scale, 0.51 * scale);
  window.position.set(-0.34 * scale, 0.62 * scale, 0.51 * scale);
  house.add(base, body, roof, door, window);
  house.position.copy(position);
  return house;
};
const createWorkshop = (position: THREE.Vector3): THREE.Group => {
  const workshop = createHouse(position, 0.78),
    lean = box(new THREE.Vector3(0.75, 0.52, 0.8), palette.wood, 1),
    roof = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.08, 0.95),
      makeMaterial(palette.roof, 0.95),
    );
  lean.position.set(0.65, 0.3, 0.05);
  roof.position.set(0.65, 0.6, 0.05);
  roof.rotation.z = -0.12;
  workshop.add(lean, roof);
  return workshop;
};
const createDock = (position: THREE.Vector3): THREE.Group => {
  const dock = new THREE.Group(),
    deck = box(new THREE.Vector3(2.2, 0.14, 0.62), palette.woodLight, 1);
  deck.position.y = -0.02;
  deck.rotation.y = -0.18;
  dock.add(deck);
  for (let index = -1; index <= 1; index += 1) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 0.85, 7),
      makeMaterial(palette.wood, 1),
    );
    post.position.set(index * 0.78, -0.34, -0.2);
    dock.add(post);
  }
  dock.position.copy(position);
  return dock;
};
const createBoat = (position: THREE.Vector3): THREE.Group => {
  const boat = new THREE.Group(),
    hull = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.34, 1.45, 5, 10),
      makeMaterial(palette.wood, 0.72),
    ),
    rim = box(new THREE.Vector3(1.65, 0.08, 0.52), palette.woodLight, 0.75),
    mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.05, 1.55, 8),
      makeMaterial(palette.wood, 0.9),
    ),
    sail = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.76), makeMaterial(palette.plaster, 1));
  hull.rotation.x = Math.PI / 2;
  hull.position.y = -0.02;
  rim.position.y = 0.22;
  mast.position.y = 0.86;
  sail.position.set(0.16, 0.94, 0);
  boat.add(hull, rim, mast, sail);
  boat.position.copy(position);
  boat.rotation.y = -0.34;
  return boat;
};
const createProps = (): THREE.Group => {
  const props = new THREE.Group(),
    positions: readonly [number, number, number][] = [
      [-2.7, 0.14, -0.35],
      [-2.45, 0.14, -0.12],
      [1.8, 0.16, -0.65],
      [2.12, 0.16, -0.58],
    ];
  positions.forEach(([x, y, z], index) => {
    const crate = box(
      new THREE.Vector3(0.28, 0.25, 0.28),
      index % 2 ? palette.woodLight : palette.wood,
      1,
    );
    crate.position.set(x, y, z);
    crate.rotation.y = index * 0.42;
    props.add(crate);
  });
  const cart = box(new THREE.Vector3(0.9, 0.1, 0.5), palette.woodLight, 1);
  cart.position.set(-2.25, 0.18, 0.55);
  props.add(cart);
  return props;
};
const createRain = (): THREE.Points => {
  const positions = new Float32Array(110 * 3);
  for (let index = 0; index < 110; index += 1) {
    positions[index * 3] = ((index * 37) % 200) / 10 - 10;
    positions[index * 3 + 1] = ((index * 23) % 90) / 10 + 1;
    positions[index * 3 + 2] = ((index * 53) % 140) / 10 - 7;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: 0xc5ddd9, size: 0.035, transparent: true, opacity: 0.2 }),
  );
  points.visible = false;
  return points;
};

export const createNorthStarWorld = (): NorthStarWorld => {
  const group = new THREE.Group(),
    terrain = buildTerrain(),
    water = createWater(),
    shore = createShoreBand(terrain.shoreline),
    rain = createRain(),
    trees = new THREE.Group();
  const treePositions = [
    [-8.8, -0.02, -3.4, 0, 1.05],
    [-7.8, 0.02, -2.4, 1, 0.9],
    [-6.7, 0.04, -3.2, 2, 1.2],
    [-5.9, 0.02, -2.3, 0, 0.82],
    [-5, 0.01, -3.45, 1, 1.08],
    [-4.5, 0.02, -2.5, 2, 0.9],
    [-8.1, 0.01, -1.3, 2, 1.08],
    [-6.8, 0.02, -1.2, 0, 0.88],
    [-4.2, 0.02, -1, 1, 1],
    [3.9, 0.02, -2.4, 2, 0.9],
    [4.8, 0.04, -2.9, 0, 1.12],
  ] as const;
  treePositions.forEach(([x, y, z, variant, scale]) =>
    trees.add(createTreeVariant(variant, new THREE.Vector3(x, y, z), scale)),
  );
  group.add(
    terrain.mesh,
    water,
    shore,
    createRoad(),
    trees,
    rain,
    createHall(new THREE.Vector3(0, 0, -0.15)),
    createHouse(new THREE.Vector3(2.3, 0, -0.65), 0.82),
    createWorkshop(new THREE.Vector3(-2.25, 0, -0.85)),
    createDock(new THREE.Vector3(3, 0, 2.75)),
    createBoat(new THREE.Vector3(4.55, 0.02, 4.2)),
    createProps(),
  );
  const grass = new THREE.Group();
  for (let index = 0; index < 34; index += 1) {
    const x = -4.2 + (index % 9) * 0.9,
      z = 1.8 + Math.floor(index / 9) * 0.48 + Math.sin(index) * 0.12;
    const tuft = new THREE.Mesh(
      new THREE.ConeGeometry(0.09, 0.34, 4),
      makeMaterial(palette.grassLight, 1),
    );
    tuft.position.set(x, 0.16, z);
    tuft.rotation.z = -0.18 + (index % 3) * 0.12;
    grass.add(tuft);
  }
  group.add(grass);
  const boat = group.children.find(
    (child) => child instanceof THREE.Group && child.position.x > 4 && child.position.z > 3,
  ) as THREE.Group;
  const stats = { instances: 11 + 34, shadowSettings: 'soft sun · 2048²', qualityTier: 'HIGH' };
  const update = (elapsed: number, reducedMotion: boolean): void => {
    rain.visible = !reducedMotion;
    if (!reducedMotion) {
      const positions = rain.geometry.getAttribute('position');
      for (let index = 0; index < positions.count; index += 1)
        positions.setY(index, positions.getY(index) < 0.25 ? 9 : positions.getY(index) - 0.025);
      positions.needsUpdate = true;
    }
    [trees, boat, rain].forEach((object, index) => {
      object.rotation.z = reducedMotion ? 0 : Math.sin(elapsed * 0.35 + index) * 0.006;
    });
  };
  const dispose = (): void => {
    const geometries = new Set<THREE.BufferGeometry>(),
      materials = new Set<THREE.Material>();
    group.traverse((object) => {
      if (
        object instanceof THREE.Mesh ||
        object instanceof THREE.Points ||
        object instanceof THREE.Line ||
        object instanceof THREE.InstancedMesh
      ) {
        geometries.add(object.geometry);
        if (Array.isArray(object.material)) object.material.forEach((item) => materials.add(item));
        else materials.add(object.material);
      }
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
  };
  return { terrain: { width: 18, depth: 12, tiles: terrain.tiles }, group, stats, update, dispose };
};
