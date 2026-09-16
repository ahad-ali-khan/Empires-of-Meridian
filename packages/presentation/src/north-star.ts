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
  update: (elapsed: number, reducedMotion: boolean) => void;
  dispose: () => void;
};

const palette = {
  grass: 0x66704f,
  grassLight: 0x87916a,
  forest: 0x374b36,
  rock: 0x6c6d66,
  sand: 0xb39a6c,
  water: 0x4f7880,
  road: 0x8e795c,
  wood: 0x684b35,
  plaster: 0xb29a73,
  roof: 0x514b42,
  brass: 0xb18b4d,
  cloth: 0x9d563c,
  stone: 0x817d72,
};

const tileHeight = (x: number, z: number): number =>
  0.08 * Math.sin(x * 0.7) + 0.06 * Math.cos(z * 0.9) + 0.035 * Math.sin((x + z) * 1.5);

const surfaceAt = (x: number, z: number, height: number): SurfaceClass => {
  if (z > 3.6 && x < 2.5) return 'shallow-water';
  if (Math.abs(x + 1.2) < 0.35 && z < 3.1) return 'road';
  if (height > 0.12 || Math.abs(x) > 7.5) return 'rock';
  if (x < -4 && z < 1.6) return 'forest';
  if (z > 2.5) return 'sand';
  return 'grass';
};

const buildTerrain = (): { mesh: THREE.Mesh; tiles: TerrainTile[] } => {
  const width = 18;
  const depth = 12;
  const segmentsX = 36;
  const segmentsZ = 24;
  const geometry = new THREE.BufferGeometry();
  const vertices: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const tiles: TerrainTile[] = [];
  const color = new THREE.Color();

  for (let zIndex = 0; zIndex <= segmentsZ; zIndex += 1) {
    for (let xIndex = 0; xIndex <= segmentsX; xIndex += 1) {
      const x = (xIndex / segmentsX - 0.5) * width;
      const z = (zIndex / segmentsZ - 0.5) * depth;
      const height = tileHeight(x, z);
      const surface = surfaceAt(x, z, height);
      vertices.push(x, height, z);
      const tone =
        surface === 'grass'
          ? palette.grass
          : palette[surface === 'shallow-water' ? 'water' : surface];
      color.setHex(tone);
      color.offsetHSL(0, 0, ((xIndex * 17 + zIndex * 11) % 9) / 180 - 0.025);
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
  }

  for (let zIndex = 0; zIndex < segmentsZ; zIndex += 1) {
    for (let xIndex = 0; xIndex < segmentsX; xIndex += 1) {
      const row = segmentsX + 1;
      const a = zIndex * row + xIndex;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    metalness: 0,
  });
  return { mesh: new THREE.Mesh(geometry, material), tiles };
};

const createWater = (): THREE.Mesh => {
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(6.6, 3.3),
    new THREE.MeshStandardMaterial({
      color: palette.water,
      roughness: 0.24,
      metalness: 0.1,
      transparent: true,
      opacity: 0.86,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(2.8, 0.015, 4.15);
  return water;
};

const createTreeInstances = (): THREE.Group => {
  const group = new THREE.Group();
  const trunk = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.09, 0.13, 0.75, 6),
    new THREE.MeshStandardMaterial({ color: palette.wood, roughness: 1 }),
    22,
  );
  const canopy = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.55, 1),
    new THREE.MeshStandardMaterial({ color: palette.forest, roughness: 1 }),
    22,
  );
  const matrix = new THREE.Matrix4();
  let index = 0;
  for (let x = -7.4; x < -3.1; x += 0.85) {
    for (let z = -3.3; z < 1.6; z += 1.1) {
      const jitter = Math.sin(x * 4.7 + z * 2.1) * 0.2;
      const position = new THREE.Vector3(x + jitter, 0.38, z + jitter);
      const scale = 0.8 + (index % 4) * 0.08;
      matrix.compose(position, new THREE.Quaternion(), new THREE.Vector3(1, scale, 1));
      trunk.setMatrixAt(index, matrix);
      matrix.compose(
        new THREE.Vector3(position.x, position.y + 0.6 * scale, position.z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, index * 0.7, 0)),
        new THREE.Vector3(scale, scale, scale),
      );
      canopy.setMatrixAt(index, matrix);
      index += 1;
      if (index === 22) break;
    }
    if (index === 22) break;
  }
  trunk.instanceMatrix.needsUpdate = true;
  canopy.instanceMatrix.needsUpdate = true;
  group.add(trunk, canopy);
  return group;
};

const material = (color: number, roughness = 0.82): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: color === palette.brass ? 0.5 : 0,
  });

const box = (size: THREE.Vector3, color: number): THREE.Mesh =>
  new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material(color));

const createBanner = (color: number, position: THREE.Vector3): THREE.Group => {
  const banner = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 1.5, 6),
    material(palette.brass),
  );
  pole.position.y = 0.75;
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.28), material(color, 1));
  cloth.position.set(0.2, 1.18, 0);
  banner.add(pole, cloth);
  banner.position.copy(position);
  return banner;
};

const createBuilding = (position: THREE.Vector3, scale: number, accent: number): THREE.Group => {
  const building = new THREE.Group();
  const body = box(new THREE.Vector3(1.35 * scale, 0.8 * scale, 1.1 * scale), palette.plaster);
  body.position.y = 0.4 * scale;
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(0.96 * scale, 0.55 * scale, 4),
    material(palette.roof),
  );
  roof.position.y = 1.05 * scale;
  roof.rotation.y = Math.PI / 4;
  const door = box(new THREE.Vector3(0.2 * scale, 0.42 * scale, 0.035), palette.wood);
  door.position.set(0, 0.22 * scale, 0.56 * scale);
  const trim = box(new THREE.Vector3(1.1 * scale, 0.08 * scale, 0.04), accent);
  trim.position.set(0, 0.68 * scale, 0.58 * scale);
  building.add(
    body,
    roof,
    door,
    trim,
    createBanner(accent, new THREE.Vector3(0.56 * scale, 0, -0.5 * scale)),
  );
  building.position.copy(position);
  return building;
};

const createUnit = (
  position: THREE.Vector3,
  kind: 'worker' | 'infantry' | 'cavalry',
): THREE.Group => {
  const unit = new THREE.Group();
  const bodyColor = kind === 'worker' ? palette.plaster : palette.cloth;
  const body =
    kind === 'cavalry'
      ? box(new THREE.Vector3(0.62, 0.36, 1.05), palette.wood)
      : box(new THREE.Vector3(0.34, 0.5, 0.26), bodyColor);
  body.position.y = kind === 'cavalry' ? 0.38 : 0.42;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), material(0xc28d69));
  head.position.set(0, kind === 'cavalry' ? 0.9 : 0.78, kind === 'cavalry' ? 0.05 : 0);
  const hat = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 0.09, 8),
    material(palette.brass),
  );
  hat.position.set(0, head.position.y + 0.14, head.position.z);
  unit.add(body, head, hat);
  if (kind === 'infantry') {
    const rifle = box(new THREE.Vector3(0.06, 0.06, 0.72), palette.wood);
    rifle.position.set(0.24, 0.52, 0.05);
    rifle.rotation.x = -0.3;
    rifle.rotation.z = -0.28;
    unit.add(rifle);
  }
  if (kind === 'worker') {
    const tool = box(new THREE.Vector3(0.04, 0.05, 0.5), palette.wood);
    tool.position.set(-0.22, 0.52, 0.02);
    tool.rotation.z = -0.5;
    unit.add(tool);
  }
  unit.position.copy(position);
  return unit;
};

const createCannon = (position: THREE.Vector3): THREE.Group => {
  const cannon = new THREE.Group();
  const wheels = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.24, 0.12, 12),
    material(palette.wood),
  );
  wheels.rotation.z = Math.PI / 2;
  wheels.position.y = 0.27;
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.18, 0.82, 10),
    material(palette.brass, 0.45),
  );
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(0.28, 0.54, 0);
  cannon.add(wheels, barrel);
  cannon.position.copy(position);
  return cannon;
};

const createShip = (position: THREE.Vector3): THREE.Group => {
  const ship = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 1.7, 4, 8), material(palette.wood));
  hull.rotation.x = Math.PI / 2;
  hull.position.y = 0.16;
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 1.55, 8),
    material(palette.wood),
  );
  mast.position.y = 0.9;
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.8), material(palette.plaster, 1));
  sail.position.set(0.17, 0.95, 0);
  ship.add(hull, mast, sail);
  ship.position.copy(position);
  ship.rotation.y = -0.32;
  return ship;
};

const createRoad = (): THREE.Mesh => {
  const road = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 7.2), material(palette.road));
  road.rotation.x = -Math.PI / 2;
  road.rotation.z = -0.18;
  road.position.set(-1.1, 0.02, -0.25);
  return road;
};

const createRain = (): THREE.Points => {
  const positions = new Float32Array(90 * 3);
  for (let index = 0; index < 90; index += 1) {
    positions[index * 3] = ((index * 37) % 180) / 10 - 9;
    positions[index * 3 + 1] = ((index * 23) % 80) / 10 + 1;
    positions[index * 3 + 2] = ((index * 53) % 120) / 10 - 6;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: 0xb5d0ce, size: 0.045, transparent: true, opacity: 0.28 }),
  );
  points.visible = false;
  return points;
};

export const createNorthStarWorld = (): NorthStarWorld => {
  const group = new THREE.Group();
  const terrain = buildTerrain();
  const water = createWater();
  const trees = createTreeInstances();
  const rain = createRain();
  group.add(terrain.mesh, water, trees, createRoad(), rain);

  group.add(createBuilding(new THREE.Vector3(0, 0, -0.1), 1.4, palette.cloth));
  group.add(createBuilding(new THREE.Vector3(2.05, 0, -0.55), 0.75, palette.brass));
  group.add(createBuilding(new THREE.Vector3(-2.05, 0, -0.85), 0.82, palette.cloth));
  group.add(createBuilding(new THREE.Vector3(2.65, 0, 1.2), 0.68, palette.brass));

  const wall = box(new THREE.Vector3(5.9, 0.56, 0.18), palette.stone);
  wall.position.set(0.1, 0.28, -2.05);
  group.add(wall);
  const gate = box(new THREE.Vector3(1.0, 0.65, 0.22), palette.wood);
  gate.position.set(0.1, 0.32, -2.08);
  group.add(gate);
  group.add(createCannon(new THREE.Vector3(1.55, 0, -1.58)));
  group.add(createShip(new THREE.Vector3(2.95, 0.04, 4.05)));

  const units = [
    createUnit(new THREE.Vector3(-0.75, 0, 2.0), 'worker'),
    createUnit(new THREE.Vector3(-0.15, 0, 2.25), 'worker'),
    createUnit(new THREE.Vector3(0.9, 0, 1.65), 'infantry'),
    createUnit(new THREE.Vector3(1.45, 0, 1.85), 'infantry'),
    createUnit(new THREE.Vector3(-2.25, 0, 1.55), 'cavalry'),
  ];
  units.forEach((unit) => group.add(unit));

  const windObjects = [trees, ...units, group.children.find((child) => child === rain)].filter(
    (child): child is THREE.Object3D => child !== undefined,
  );

  const update = (elapsed: number, reducedMotion: boolean): void => {
    if (reducedMotion) {
      rain.visible = false;
      return;
    }
    rain.visible = true;
    const positions = rain.geometry.getAttribute('position');
    for (let index = 0; index < positions.count; index += 1) {
      const y = positions.getY(index) - 0.025;
      positions.setY(index, y < 0.25 ? 8 : y);
    }
    positions.needsUpdate = true;
    windObjects.forEach((object, index) => {
      object.rotation.z = Math.sin(elapsed * 0.55 + index * 0.7) * 0.008;
    });
  };

  const dispose = (): void => {
    group.traverse((object) => {
      if (
        object instanceof THREE.Mesh ||
        object instanceof THREE.Points ||
        object instanceof THREE.InstancedMesh
      ) {
        object.geometry.dispose();
        if (Array.isArray(object.material)) object.material.forEach((item) => item.dispose());
        else object.material.dispose();
      }
    });
  };

  return { terrain: { width: 18, depth: 12, tiles: terrain.tiles }, group, update, dispose };
};
