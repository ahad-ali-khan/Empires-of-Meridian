import * as T from 'three';
import {C, mat, mesh, box, cyl, ball, beam, tube, joint, finishRig, consolidate, ellipsoid as oval} from './geometry';
import {buildPerson, buildRider, rifle, type Clip} from './actors';
import {buildMine, buildFelledTree} from './nature';
import {buildBow, addShot} from './combat';

const buildings = {
  lumberPost: 'Lumber Post',
  miningPost: 'Mining Post',
  silo: 'Grain Silo',
  stable: 'Riding Stable',
  barracks: 'Barracks',
  archery: 'Archery Range',
  workshop: 'Artillery Workshop',
  dock: 'Harbor Dock',
  tradePost: 'Trade Post',
  mercenaryHall: 'Contract Hall',
  embassy: 'Alliance Embassy',
  arsenal: 'Arsenal',
  academy: 'Academy',
  temple: 'Civic Sanctuary',
  factory: 'Engine Factory',
  wall: 'Curtain Wall',
  gate: 'City Gate',
  fort: 'Coastal Fort',
  landmark: 'Meridian Beacon',
  farm: 'Grain Farm',
  estate: 'Orchard Estate',
  fishery: 'Shore Fishery',
} as const;
const soldiers = {
  militia: 'Militia',
  spearman: 'Levy Spearman',
  swordsman: 'Charter Swordsman',
  veteranRifle: 'Veteran Rifle',
  grenadier: 'Grenadier',
  pikeman: 'Long Pike',
  marksman: 'Marksman',
  skirmisher: 'Skirmisher',
  shieldBearer: 'Shield Bearer',
  saboteur: 'Saboteur',
  archer: 'Bow Archer',
  crossbow: 'Crossbow Guard',
  medic: 'Field Medic',
  engineer: 'Engineer',
  explorer: 'Frontier Explorer',
  factionGuard: 'League Guard',
  contractUnit: 'Contract Blade',
  allianceUnit: 'Alliance Sentinel',
  commander: 'Field Commander',
} as const;
const riders = {
  lightRider: 'Light Rider',
  dragoon: 'Dragoon',
  cuirassRider: 'Cuirass Rider',
  mountedScout: 'Mounted Scout',
} as const;
const engines = {
  howitzer: 'Howitzer',
  scatterGun: 'Scatter Gun',
  mortar: 'Mortar',
  rocketCart: 'Rocket Cart',
  ramWagon: 'Ram Wagon',
  siegeTower: 'Siege Tower',
  supplyWagon: 'Supply Wagon',
  builderWagon: 'Builder Wagon',
  trader: 'Trade Wagon',
  sapperTeam: 'Sapper Team',
  mobileFieldwork: 'Mobile Fieldwork',
} as const;
const vessels = {
  tradeShip: 'Trade Ship',
  transport: 'Troop Transport',
  sloop: 'Patrol Sloop',
  frigate: 'League Frigate',
  bombardVessel: 'Bombard Vessel',
  fireCraft: 'Fire Craft',
} as const;
const nature = {
  villagerFemale: 'Frontier Worker · Female',
  deer: 'Meadow Deer',
  wolf: 'Ridge Wolf',
  scoutAnimal: 'Scout Hound',
  stoneMine: 'Stone Outcrop',
  treeHalfCut: 'Oak · Half Cut',
  stump: 'Oak Stump',
  logPile: 'Stacked Timber',
  treasure: 'Supply Cache',
  bird: 'Coastal Gull',
} as const;
type BuildingKind = keyof typeof buildings;
export type ExtraKind =
  | keyof typeof buildings
  | keyof typeof soldiers
  | keyof typeof riders
  | keyof typeof engines
  | keyof typeof vessels
  | keyof typeof nature;
export const extraInfo = Object.fromEntries([
  ...Object.entries(buildings).map(([id, name]) => [
    id,
    {
      name,
      category: 'BUILDING',
      description: `${name} of the Aurelian League. Inspect its available ages and construction, damage and ruin states.`,
    },
  ]),
  ...Object.entries(soldiers).map(([id, name]) => [
    id,
    {
      name,
      category: 'FOOT UNIT',
      description: `Original ${name.toLowerCase()} equipment, articulated movement and combat poses.`,
    },
  ]),
  ...Object.entries(riders).map(([id, name]) => [
    id,
    {
      name,
      category: 'MOUNTED UNIT',
      description: `${name} with fitted stirrups, reins and an articulated mounted combat pose.`,
    },
  ]),
  ...Object.entries(engines).map(([id, name]) => [
    id,
    {
      name,
      category: 'SIEGE & LOGISTICS',
      description: `${name} with an original timber and metal chassis in League colors.`,
    },
  ]),
  ...Object.entries(vessels).map(([id, name]) => [
    id,
    {
      name,
      category: 'NAVAL',
      description: `${name} with a sealed hull, faction markings and equipment for its naval role.`,
    },
  ]),
  ...Object.entries(nature).map(([id, name]) => [
    id,
    {
      name,
      category: id === 'villagerFemale' ? 'CIVILIAN' : 'RESOURCES & WILDLIFE',
      description: `${name}. Use the available animation and condition controls to inspect its complete presentation.`,
    },
  ]),
]) as Record<ExtraKind, {name: string; category: string; description: string}>;
export const buildingKinds = new Set<string>(['hall', 'house', 'market', 'tower', ...Object.keys(buildings)]);
export const animalKinds = new Set<string>(['sheep', 'deer', 'wolf', 'scoutAnimal']);
export {eras} from './ages';
export type Condition =
  | 'intact'
  | 'construction'
  | 'damaged'
  | 'critical'
  | 'rubble'
  | 'cleared'
  | 'full'
  | 'half'
  | 'depleted'
  | 'dead'
  | 'halfCut'
  | 'stump'
  | 'sinking';
export function clipsFor(kind: string): Clip[] {
  if (kind === 'villager' || kind === 'villagerFemale')
    return [
      'idle',
      'walk',
      'mine',
      'farm',
      'gather',
      'chop',
      'process',
      'fish',
      'build',
      'carry',
      'hunt',
      'attack',
      'die',
      'dead',
    ];
  if (animalKinds.has(kind))
    return kind === 'wolf' || kind === 'scoutAnimal'
      ? ['idle', 'walk', 'flee', 'attack', 'die', 'dead']
      : ['idle', 'walk', 'graze', 'flee', 'die', 'dead'];
  if (kind === 'cavalry' || kind in riders) return ['idle', 'walk', 'attack', 'die', 'dead'];
  if (kind === 'infantry' || kind in soldiers)
    return ['idle', 'walk', 'attack', ...(kind === 'medic' ? ['heal' as Clip] : []), 'die', 'dead'];
  if (kind === 'cannon' || ['howitzer', 'scatterGun', 'mortar'].includes(kind)) return ['fire', 'walk'];
  if (kind in engines) return ['idle', 'walk', 'attack'];
  if (kind === 'tradeShip' || kind === 'transport' || kind === 'fishingBoat') return ['idle'];
  if (kind === 'ship' || kind in vessels) return ['idle', 'attack'];
  if (kind === 'fish' || kind === 'bird') return ['idle', 'walk'];
  return [];
}
export function conditionsFor(kind: string): Condition[] {
  if (buildingKinds.has(kind)) return ['intact', 'construction', 'damaged', 'critical', 'rubble', 'cleared'];
  if (kind === 'mine' || kind === 'stoneMine') return ['full', 'half', 'depleted'];
  if (kind === 'tree' || kind === 'pine') return ['intact', 'halfCut', 'stump', 'cleared'];
  if (kind === 'ship' || kind === 'fishingBoat' || kind in vessels) return ['intact', 'damaged', 'sinking'];
  return [];
}

function roof(g: T.Group, w: number, d: number, y: number) {
  for (const s of [-1, 1]) {
    const panel = box(g, w, 0.13, d * 0.59, 0, y + 0.48, s * d * 0.24, C.roof);
    panel.rotation.x = s * 0.48;
    for (let i = 0; i < 6; i++) {
      const seam = box(g, w, 0.035, 0.025, 0, y + 0.97 - i * 0.16, (s * i * d) / 12, C.roof2);
      seam.rotation.x = s * 0.48;
    }
  }
  beam(g, [-w * 0.5, y + 0.99, 0], [w * 0.5, y + 0.99, 0], 0.07, C.roof2);
}
function room(g: T.Group, w: number, d: number, h: number, x = 0, z = 0) {
  const p = joint(g, 'wing', x, 0, z);
  box(p, w + 0.25, 0.22, d + 0.25, 0, 0.11, 0, C.trim);
  box(p, w, h, d, 0, h / 2 + 0.2, 0, C.stone);
  roof(p, w + 0.45, d + 0.5, h + 0.2);
  box(p, 0.78, 1.5, 0.08, 0, 0.97, d / 2 + 0.04, C.wood);
  for (const xx of [-w * 0.32, w * 0.32]) {
    box(p, 0.5, 0.68, 0.08, xx, 1.5, d / 2 + 0.04, C.trim);
    box(p, 0.34, 0.51, 0.09, xx, 1.5, d / 2 + 0.09, C.glass);
    box(p, 0.025, 0.52, 0.025, xx, 1.5, d / 2 + 0.15, C.gold);
  }
}
function crate(g: T.Group, x: number, y: number, z: number) {
  box(g, 0.55, 0.5, 0.55, x, y + 0.25, z, C.wood);
  for (const dx of [-0.2, 0.2]) box(g, 0.045, 0.53, 0.57, x + dx, y + 0.25, z, C.gold);
}
function banner(g: T.Group, x: number, y: number, z: number) {
  beam(g, [x, 0, z], [x, y, z], 0.035, C.gold);
  box(g, 0.72, 0.45, 0.025, x + 0.37, y - 0.28, z, C.cloth);
  box(g, 0.74, 0.035, 0.03, x + 0.37, y - 0.28, z, C.gold);
}
function wheel(g: T.Group, x: number, y: number, z: number, r = 0.48) {
  const p = joint(g, 'rollingWheel', x, y, z);
  const tire = mesh(new T.TorusGeometry(r, 0.045, 6, 20), mat(C.dark), p);
  tire.rotation.y = Math.PI / 2;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    beam(p, [0, 0, 0], [0, Math.cos(a) * r, Math.sin(a) * r], 0.025, C.wood);
  }
  return p;
}
function gun(g: T.Group, x: number, y: number, z: number) {
  const b = cyl(g, 0.12, 0.17, 1.2, x, y, z, C.dark, 16);
  b.rotation.x = Math.PI / 2;
  cyl(g, 0.11, 0.11, 0.03, x, y - 0.02, z, '#171f1c', 16);
}

export function buildBuilding(kind: BuildingKind) {
  const g = new T.Group();
  if (kind === 'lumberPost' || kind === 'miningPost') {
    for (const x of [-1.5, 1.5]) for (const z of [-0.9, 0.9]) box(g, 0.16, 2.1, 0.16, x, 1.05, z, C.wood);
    roof(g, 3.5, 2.6, 1.9);
    if (kind === 'lumberPost')
      for (let layer = 0; layer < 3; layer++)
        for (let i = 0; i < 4 - layer; i++) {
          const log = cyl(g, 0.15, 0.16, 2.4, -0.8 + i * 0.36 + layer * 0.17, 0.17 + layer * 0.28, 0, '#866743', 10);
          log.rotation.x = Math.PI / 2;
          cyl(
            g,
            0.14,
            0.14,
            0.02,
            -0.8 + i * 0.36 + layer * 0.17,
            0.17 + layer * 0.28,
            1.21,
            '#c5a777',
            10,
          ).rotation.x = Math.PI / 2;
        }
    else {
      for (let i = 0; i < 4; i++) crate(g, -0.8 + i * 0.5, 0, -0.45);
      for (let i = 0; i < 6; i++) ball(g, Math.sin(i) * 0.6, 0.2, Math.cos(i) * 0.4, 0.2, 0.22, 0.18, '#8e9384', 0);
      beam(g, [1.1, 0.2, 0.4], [1.1, 1.3, 0.4], 0.045, C.wood);
      beam(g, [0.8, 1.22, 0.4], [1.4, 1.22, 0.4], 0.06, C.dark);
    }
    banner(g, -1.7, 2.6, 1);
  } else if (kind === 'silo') {
    cyl(g, 1.15, 1.3, 3.6, 0, 1.8, 0, '#b6a786', 28);
    cyl(g, 0, 1.45, 1.25, 0, 4.22, 0, C.roof, 28);
    for (const y of [0.35, 1.35, 2.6, 3.55]) cyl(g, 1.17, 1.17, 0.055, 0, y, 0, C.cloth, 28);
    for (let y = 0.2; y < 3.6; y += 0.28) beam(g, [0.86, y, 0.85], [1.18, y, 0.85], 0.025, C.wood);
    for (const x of [0.86, 1.18]) beam(g, [x, 0, 0.85], [x, 3.8, 0.85], 0.035, C.wood);
    box(g, 0.5, 0.8, 0.08, 0, 0.4, 1.24, C.wood);
    crate(g, -1.4, 0, 0.7);
  } else if (kind === 'dock' || kind === 'fishery') {
    for (let i = 0; i < 24; i++) box(g, 4, 0.12, 0.25, 0, 0.7, -3 + i * 0.27, C.wood);
    for (const x of [-1.8, 1.8]) for (const z of [-2.5, 0, 2.5]) cyl(g, 0.12, 0.15, 1.8, x, 0.45, z, C.wood, 12);
    room(g, 2, 1.8, 1.7, -0.8, -2);
    beam(g, [1.3, 0.7, -1], [1.3, 3.4, -1], 0.08, C.wood);
    beam(g, [1.3, 3.4, -1], [1.3, 3.4, 1.3], 0.07, C.wood);
    beam(g, [1.3, 3.4, 1.3], [1.3, 1.2, 1.3], 0.012, C.dark);
    for (let i = 0; i < 3; i++) crate(g, 0.8, 0.76, -1.5 + i * 0.7);
    banner(g, -1.9, 3.4, 2.5);
  } else if (kind === 'wall' || kind === 'gate' || kind === 'fort') {
    const segment = (x: number, z: number, r = 0) => {
      const p = joint(g, 'wallSegment', x, 0, z);
      p.rotation.y = r;
      box(p, 5, 2.3, 0.7, 0, 1.15, 0, C.stone);
      for (let i = 0; i < 7; i++) box(p, 0.4, 0.45, 0.8, -2.2 + i * 0.72, 2.5, 0, C.trim);
    };
    if (kind === 'wall') segment(0, 0);
    else if (kind === 'gate') {
      segment(-3.5, 0);
      segment(3.5, 0);
      box(g, 2, 1, 0.8, 0, 2.3, 0, C.stone);
      const door = joint(g, 'gateDoor', -0.94, 0, 0.1);
      box(door, 1.9, 1.9, 0.15, 0.94, 0.95, 0, C.wood);
      for (let i = 0; i < 7; i++) box(door, 0.05, 1.9, 0.18, i * 0.29, 0.95, 0, C.dark);
    } else {
      for (const x of [-3.5, 3.5])
        for (const z of [-3.5, 3.5]) {
          cyl(g, 0.85, 0.95, 3.6, x, 1.8, z, C.stone, 8);
          cyl(g, 0.98, 0.98, 0.24, x, 3.65, z, C.trim, 8);
          banner(g, x, 4.7, z);
        }
      for (const z of [-3.5, 3.5]) segment(0, z);
      for (const x of [-3.5, 3.5]) segment(x, 0, Math.PI / 2);
      room(g, 3.4, 2.5, 3, 0, -1);
    }
  } else if (kind === 'farm' || kind === 'estate') {
    box(g, 7, 0.08, 7, 0, 0.04, 0, '#756849');
    for (let row = 0; row < 10; row++) {
      const x = -3 + row * 0.65;
      box(g, 0.12, 0.06, 6.4, x, 0.1, 0, '#8b7550');
      for (let j = 0; j < 14; j++) {
        const z = -3 + j * 0.44;
        if (kind === 'farm') {
          beam(g, [x, 0.1, z], [x, 0.6, z], 0.018, '#baa464');
          ball(g, x, 0.67, z, 0.065, 0.16, 0.055, '#d3bd71', 0);
        } else if (j % 4 === 0) {
          beam(g, [x, 0, z], [x, 1.2, z], 0.035, C.wood);
          ball(g, x, 1.1, z, 0.27, 0.25, 0.28, '#5e7742', 1);
          ball(g, x + 0.13, 1.12, z + 0.19, 0.06, 0.06, 0.06, '#ad5240', 1);
        }
      }
    }
    if (kind === 'estate') room(g, 2.5, 2.1, 2.4, 0, -4.6);
  } else if (kind === 'landmark') {
    for (let i = 0; i < 4; i++) cyl(g, 2.8 - i * 0.4, 3 - i * 0.4, 0.35, 0, 0.18 + i * 0.35, 0, C.trim, 12);
    cyl(g, 0.7, 1.2, 6, 0, 4.3, 0, C.stone, 12);
    cyl(g, 1.7, 1.4, 0.35, 0, 7.5, 0, C.gold, 12);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      beam(g, [Math.cos(a) * 1.3, 7.5, Math.sin(a) * 1.3], [Math.cos(a) * 1.3, 8.7, Math.sin(a) * 1.3], 0.08, C.trim);
    }
    cyl(g, 0, 1.9, 1.4, 0, 9.3, 0, C.roof, 12);
    ball(g, 0, 8.1, 0, 0.5, 0.6, 0.5, '#e4bb67', 2);
  } else {
    const wide = kind === 'stable' || kind === 'barracks' || kind === 'workshop' || kind === 'factory';
    room(g, wide ? 5.6 : 3.6, 3.4, kind === 'academy' || kind === 'temple' ? 3.6 : 2.5);
    if (kind === 'stable') {
      for (let i = 0; i < 3; i++) {
        const x = -1.8 + i * 1.8;
        box(g, 1.3, 1.5, 0.09, x, 1, 1.75, C.wood);
        box(g, 1.38, 0.1, 0.14, x, 1.76, 1.78, C.trim);
        for (let j = 0; j < 4; j++)
          beam(g, [x - 0.55 + j * 0.36, 1.8, 1.8], [x - 0.55 + j * 0.36, 2.5, 1.8], 0.025, C.dark);
      }
      for (const x of [-3, 3]) beam(g, [x, 0, 2.2], [x, 1.3, 2.2], 0.06, C.wood);
      beam(g, [-3, 1.1, 2.2], [3, 1.1, 2.2], 0.045, C.wood);
    }
    if (kind === 'archery') {
      for (const x of [-2, 0, 2]) {
        beam(g, [x, 0, 3], [x, 1.6, 3], 0.06, C.wood);
        const target = cyl(g, 0.42, 0.42, 0.09, x, 1.4, 3, '#dbcc9d', 20);
        target.rotation.x = Math.PI / 2;
        const inner = cyl(g, 0.23, 0.23, 0.1, x, 1.4, 3.03, C.cloth, 20);
        inner.rotation.x = Math.PI / 2;
      }
    }
    if (kind === 'barracks' || kind === 'arsenal' || kind === 'mercenaryHall') {
      for (let i = 0; i < 5; i++) {
        const x = -1.2 + i * 0.6;
        beam(g, [x, 0.1, 2.5], [x, 2.1, 2.5], 0.025, C.wood);
        mesh(new T.ConeGeometry(0.09, 0.28, 4), mat('#a0aaa3', 0.4, 0.6), g, x, 2.2, 2.5);
      }
      beam(g, [-1.5, 1.1, 2.5], [1.5, 1.1, 2.5], 0.06, C.wood);
    }
    if (kind === 'workshop' || kind === 'factory') {
      box(g, 0.65, 5, 0.65, 2.2, 2.5, -1, C.stone);
      box(g, 0.85, 0.2, 0.85, 2.2, 5, -1, C.trim);
      box(g, 1.5, 0.75, 0.9, 1.4, 0.4, 2.4, '#616663');
      const anvil = box(g, 0.85, 0.2, 0.38, 1.4, 0.95, 2.4, C.dark);
      anvil.rotation.y = 0.2;
      for (const x of [-1.8, -0.8]) wheel(g, x, 0.55, 2.6, 0.52);
      if (kind === 'factory') {
        room(g, 3, 3, 3.3, -4, -1);
        for (let i = 0; i < 3; i++) cyl(g, 0.15, 0.15, 2, 1 - i * 0.6, 4, -1, C.dark, 12);
      }
    }
    if (kind === 'academy' || kind === 'temple' || kind === 'embassy') {
      for (const x of [-1.4, -0.7, 0.7, 1.4]) cyl(g, 0.1, 0.13, 2.6, x, 1.3, 2.2, C.trim, 12);
      roof(g, 3.6, 1.4, 2.55);
      if (kind === 'temple') {
        mesh(new T.SphereGeometry(1.25, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(C.roof), g, 0, 4.5, 0);
        cyl(g, 0.2, 0.3, 0.8, 0, 5.6, 0, C.gold, 12);
      }
    }
    if (kind === 'tradePost') {
      for (let i = 0; i < 5; i++) crate(g, -1 + i * 0.6, 0, 2.4);
      banner(g, -2.2, 3.4, 1.6);
    }
    banner(g, wide ? -2.7 : -1.6, 3.7, 1.8);
  }
  // Explicit authored era overlays retain the same footprint and door locations.
  const base = consolidate(g);
  base.name = kind;
  addEraTiers(base);
  return base;
}
export function addEraTiers(root: T.Group) {
  const bounds = new T.Box3().setFromObject(root),
    size = bounds.getSize(new T.Vector3());
  for (let era = 2; era <= 5; era++) {
    const tier = joint(root, `era${era}`);
    tier.userData.era = era;
    if (era === 2)
      for (const x of [-1, 1])
        box(
          tier,
          0.12,
          Math.min(size.y, 2.6),
          0.14,
          x * size.x * 0.43,
          Math.min(size.y, 2.6) / 2,
          size.z * 0.46,
          C.wood,
        );
    if (era === 3) for (const x of [-1, 1]) box(tier, 0.2, 0.18, size.z * 0.8, x * size.x * 0.43, 0.22, 0, C.trim);
    if (era === 4) {
      box(tier, size.x * 0.72, 0.1, 0.12, 0, Math.min(size.y * 0.68, 2.9), size.z * 0.47, C.cloth);
      for (const x of [-1, 1])
        ball(tier, x * size.x * 0.38, Math.min(size.y * 0.68, 2.9), size.z * 0.49, 0.07, 0.1, 0.04, C.gold, 1);
    }
    if (era === 5) {
      banner(tier, 0, size.y + 0.65, 0);
      box(tier, size.x * 0.6, 0.055, 0.08, 0, Math.min(size.y * 0.7, 3), size.z * 0.48, C.gold);
    }
    tier.visible = false;
  }
}

function animal(kind: 'deer' | 'wolf' | 'scoutAnimal') {
  const g = new T.Group(),
    p = joint(g, 'animalBody'),
    deer = kind === 'deer',
    coat = deer ? '#967652' : kind === 'wolf' ? '#727b78' : '#89674b';
  g.userData.animal = true;
  oval(p, 0, deer ? 0.94 : 0.67, 0, deer ? 0.23 : 0.22, deer ? 0.3 : 0.25, deer ? 0.5 : 0.55, coat);
  oval(p, 0, deer ? 0.96 : 0.69, 0.27, deer ? 0.235 : 0.25, deer ? 0.32 : 0.29, 0.27, coat);
  oval(p, 0, deer ? 0.96 : 0.65, -0.33, deer ? 0.23 : 0.2, deer ? 0.28 : 0.24, 0.26, coat);
  beam(p, [0, deer ? 1.01 : 0.75, 0.28], [0, deer ? 1.43 : 0.99, 0.43], deer ? 0.13 : 0.17, coat, deer ? 0.095 : 0.13);
  oval(p, 0, deer ? 0.81 : 0.56, 0.33, 0.13, deer ? 0.22 : 0.14, 0.15, deer ? '#bfad88' : '#9b9d8d');
  const head = joint(p, 'animalHead', 0, deer ? 1.43 : 0.91, deer ? 0.43 : 0.5);
  oval(head, 0, 0, 0, 0.13, 0.2, 0.23, coat);
  oval(head, 0, -0.07, 0.22, 0.095, 0.09, 0.2, coat);
  oval(head, 0, -0.06, 0.38, 0.067, 0.05, 0.035, C.dark);
  if (!deer) {
    const jaw = joint(head, 'animalJaw', 0, -0.1, 0.12);
    oval(jaw, 0, -0.035, 0.14, 0.09, 0.035, 0.18, '#514e46');
    for (const s of [-1, 1])
      for (let i = 0; i < 3; i++)
        mesh(new T.ConeGeometry(0.012, 0.035, 5), mat(C.light), jaw, s * 0.06, -0.002, 0.08 + i * 0.07);
  }
  for (const s of [-1, 1]) {
    const ear = oval(head, s * 0.11, 0.22, -0.035, 0.055, 0.15, 0.05, coat);
    ear.rotation.z = s * 0.3;
    oval(head, s * 0.115, 0.035, 0.13, 0.021, 0.022, 0.012, '#212a26');
    if (deer) {
      tube(
        head,
        [
          [s * 0.08, 0.2, -0.06],
          [s * 0.19, 0.48, -0.12],
          [s * 0.26, 0.71, -0.17],
        ],
        0.022,
        '#c0ad88',
      );
      beam(head, [s * 0.17, 0.4, -0.1], [s * 0.32, 0.56, 0.06], 0.019, '#c0ad88', 0.004);
    }
  }
  for (const x of [-0.16, 0.16])
    for (const z of [-0.35, 0.35]) {
      const leg = joint(p, `animalLeg${x}${z}`, x, deer ? 0.93 : 0.65, z),
        upper = deer ? 0.37 : 0.25,
        lower = deer ? 0.36 : 0.21;
      oval(leg, 0, -0.1, 0, deer ? 0.065 : 0.079, 0.16, 0.089, coat);
      beam(leg, [0, -0.05, 0], [0, -upper, z > 0 ? 0.025 : -0.06], deer ? 0.043 : 0.059, coat, 0.028);
      const knee = joint(leg, 'animalKnee', 0, -upper, z > 0 ? 0.025 : -0.06);
      oval(knee, 0, 0, 0, 0.04, 0.05, 0.048, coat);
      beam(knee, [0, 0, 0], [0, -lower, 0.015], 0.028, coat, 0.019);
      oval(knee, 0, -lower - 0.08, 0.05, deer ? 0.047 : 0.065, 0.064, deer ? 0.073 : 0.09, C.dark);
    }

  const tail = joint(p, 'animalTail', 0, deer ? 1 : 0.78, -0.43);
  tube(
    tail,
    [
      [0, 0, 0],
      [0, -0.1, -0.22],
      [0, -0.29, -0.42],
    ],
    deer ? 0.038 : 0.068,
    coat,
  );
  if (kind === 'scoutAnimal') cyl(p, 0.16, 0.16, 0.075, 0, 0.85, 0.4, C.cloth, 16).rotation.x = Math.PI / 2;
  const result = finishRig(g);
  result.name = kind;
  result.userData.animal = true;
  result.userData.attackMotion = {period: 1.6, contact: 0.64};
  result.userData.gaitStride = deer ? 0.86 : 0.73;
  return result;
}
function footUnit(kind: keyof typeof soldiers, age = 4) {
  const rifle = ['veteranRifle', 'marksman', 'skirmisher'].includes(kind),
    g = buildPerson(false, false, !rifle, false, age, kind),
    body = (g.getObjectByName('spine') ?? g.getObjectByName('body')) as T.Group;
  g.userData.loadout = rifle ? 'rifle' : kind;
  g.userData.attackMotion = {period: 1.8, contact: 0.72};
  if (!rifle) {
    const held =
      kind === 'archer' || kind === 'crossbow' ? buildBow(body, kind === 'crossbow') : joint(body, 'heldWeapon');
    if (kind === 'militia') {
      beam(held, [0, -0.12, 0], [0, 0.58, 0], 0.035, C.wood, 0.055);
      oval(held, 0, 0.54, 0, 0.08, 0.13, 0.075, C.wood);
      box(body, 0.3, 0.37, 0.045, 0, 1.2, 0.17, '#8f805f');
      g.scale.setScalar(0.96);
    } else if (['spearman', 'pikeman', 'allianceUnit'].includes(kind)) {
      beam(held, [0, -0.35, 0], [0, kind === 'pikeman' ? 2.3 : 1.4, 0], 0.022, C.wood);
      mesh(
        new T.OctahedronGeometry(0.12),
        mat('#aeb7ad', 0.3, 0.7),
        held,
        0,
        kind === 'pikeman' ? 2.44 : 1.54,
        0,
      ).scale.set(0.45, 2, 0.25);
    } else if (kind === 'archer' || kind === 'crossbow') {
      addShot(g, kind === 'archer' ? 'arrow' : 'bolt', 3, 1.3);
      const quiver = joint(body, 'quiver', 0.16, 1.3, -0.22);
      cyl(quiver, 0.07, 0.07, 0.32, 0, 0, 0, C.wood, 12);
      for (let i = 0; i < 5; i++)
        beam(
          quiver,
          [Math.sin(i) * 0.04, 0, Math.cos(i) * 0.04],
          [Math.sin(i) * 0.04, 0.3, Math.cos(i) * 0.04],
          0.006,
          C.light,
        );
    } else if (kind === 'grenadier' || kind === 'saboteur') {
      ball(held, 0, 0, 0, 0.065, 0.075, 0.065, C.dark, 2);
      beam(held, [0, 0.06, 0], [0.03, 0.12, 0], 0.009, C.gold);
      joint(held, 'shotOrigin');
      addShot(g, 'grenade', 3, 1.3);
      for (const s of [-1, 1]) ball(body, s * 0.19, 1.04, 0.15, 0.045, 0.055, 0.045, C.dark, 1);
    } else if (kind === 'medic') {
      box(held, 0.22, 0.17, 0.12, 0, 0, 0, C.light);
      box(held, 0.13, 0.025, 0.015, 0, 0, 0.07, C.cloth);
      box(held, 0.025, 0.1, 0.015, 0, 0, 0.07, C.cloth);
    } else if (kind === 'engineer') {
      beam(held, [0, -0.15, 0], [0, 0.3, 0], 0.025, C.wood);
      box(held, 0.23, 0.09, 0.09, 0, 0.31, 0, C.dark);
    } else {
      beam(held, [0, -0.12, 0], [0, 0.05, 0], 0.023, C.wood);
      box(held, 0.19, 0.025, 0.05, 0, 0.06, 0, C.gold);
      const blade = mesh(new T.ConeGeometry(0.07, 0.72, 4), mat('#b4bfb7', 0.27, 0.8), held, 0, 0.42, 0);
      blade.scale.z = 0.22;
    }
    joint(held, 'weaponGrip');
    if (['shieldBearer', 'swordsman', 'factionGuard', 'allianceUnit'].includes(kind)) {
      const shield = joint(body, 'heldShield');
      oval(shield, 0, 0, 0, 0.2, 0.31, 0.045, C.cloth);
      oval(shield, 0, 0, 0.035, 0.08, 0.08, 0.025, C.gold);
    }
  }
  if (['veteranRifle', 'factionGuard', 'commander', 'shieldBearer'].includes(kind)) {
    oval(body, 0, 1.28, 0.12, 0.18, 0.22, 0.045, '#717d78');
    for (const s of [-1, 1]) oval(body, s * 0.22, 1.46, 0, 0.12, 0.045, 0.11, C.gold);
  }
  // Large silhouette cues remain readable at the normal strategic camera distance.
  if (['commander', 'factionGuard', 'contractUnit'].includes(kind)) {
    const cape = joint(body, 'mantle', 0, 1.46, -0.14);
    const cloth = mesh(
      new T.CylinderGeometry(0.2, 0.35, 0.68, 12, 1, true, 0, Math.PI),
      mat(kind === 'contractUnit' ? '#765b49' : C.cloth),
      cape,
      0,
      -0.3,
      -0.04,
    );
    cloth.rotation.y = Math.PI;
  }
  if (kind === 'shieldBearer') {
    const shield = body.getObjectByName('heldShield');
    if (shield) {
      shield.scale.set(1.65, 1.3, 1);
      box(shield, 0.36, 0.55, 0.045, 0, 0, 0, C.cloth);
    }
  }
  if (kind === 'pikeman') {
    for (const side of [-1, 1]) oval(body, side * 0.25, 1.45, 0, 0.15, 0.09, 0.13, '#88938b');
    cyl(body, 0.18, 0.21, 0.35, 0, 1.27, 0, '#7b8780', 12);
  }
  if (kind === 'archer') {
    const hood = joint(body, 'shoulderCowl', 0, 1.48, 0);
    cyl(hood, 0.16, 0.29, 0.18, 0, 0, 0, C.cloth, 12);
    g.scale.setScalar(0.96);
  }
  if (kind === 'crossbow') {
    oval(body, 0, 1.27, 0.13, 0.2, 0.24, 0.065, '#786249');
    const pavise = joint(body, 'backPavise', -0.08, 1.21, -0.25);
    box(pavise, 0.45, 0.77, 0.07, 0, 0, 0, C.cloth);
    box(pavise, 0.05, 0.78, 0.09, 0, 0, 0, C.gold);
  }
  if (kind === 'grenadier') {
    for (const side of [-1, 1]) {
      box(body, 0.15, 0.21, 0.1, side * 0.23, 1.07, 0.1, C.wood);
      oval(body, side * 0.23, 1.45, 0, 0.13, 0.065, 0.13, C.gold);
    }
    g.scale.setScalar(1.07);
  }
  if (kind === 'saboteur') {
    const pack = joint(body, 'chargePack', 0, 1.23, -0.23);
    for (const x of [-0.13, 0, 0.13]) cyl(pack, 0.055, 0.055, 0.4, x, 0, 0, '#9e6844', 10);
    box(pack, 0.42, 0.07, 0.16, 0, 0, 0, C.dark);
  }
  if (kind === 'medic') {
    box(body, 0.34, 0.48, 0.035, 0, 1.18, 0.19, C.light);
    const bag = joint(body, 'medicalSatchel', -0.26, 1.0, 0);
    box(bag, 0.22, 0.24, 0.2, 0, 0, 0, C.light);
    box(bag, 0.14, 0.035, 0.025, 0, 0, 0.11, C.cloth);
    box(bag, 0.035, 0.14, 0.025, 0, 0, 0.11, C.cloth);
  }
  if (kind === 'engineer') {
    box(body, 0.3, 0.48, 0.04, 0, 1.13, 0.2, C.wood);
    const pack = joint(body, 'toolPack', 0, 1.3, -0.24);
    box(pack, 0.37, 0.32, 0.16, 0, 0, 0, C.wood);
    beam(pack, [-0.24, -0.2, 0], [0.24, 0.37, 0], 0.03, C.dark);
  }
  if (kind === 'marksman') {
    g.scale.set(0.94, 1.04, 0.94);
    const cape = joint(body, 'shortCape', 0, 1.45, -0.17);
    box(cape, 0.48, 0.38, 0.045, 0, -0.18, 0, '#6b7952');
  }
  if (kind === 'skirmisher') {
    g.scale.setScalar(0.95);
    for (const side of [-1, 1]) box(body, 0.13, 0.18, 0.11, side * 0.21, 1.0, 0.11, C.wood);
  }
  if (kind === 'allianceUnit') {
    const shield = body.getObjectByName('heldShield');
    if (shield) {
      shield.scale.set(1.2, 0.75, 1);
      cyl(shield, 0.24, 0.24, 0.04, 0, 0, 0.03, C.gold, 16).rotation.x = Math.PI / 2;
    }
  }
  return finishRig(g);
}

export function buildExtended(kind: ExtraKind, base: (kind: string) => T.Group, age = 4): T.Group {
  let g: T.Group;
  if (kind in buildings) return buildBuilding(kind as BuildingKind);
  if (kind === 'villagerFemale') return buildPerson(true, false, false, true, age);
  if (kind === 'deer' || kind === 'wolf' || kind === 'scoutAnimal') return animal(kind);
  if (kind === 'stoneMine') return buildMine(true);
  if (kind === 'treeHalfCut') return buildFelledTree(127);
  if (kind === 'stump') {
    g = new T.Group();
    cyl(g, 0.24, 0.34, 0.46, 0, 0.23, 0, '#79644a', 12);
    cyl(g, 0.23, 0.23, 0.015, 0, 0.47, 0, '#c4ab7c', 12);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      beam(g, [0, 0.25, 0], [Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5], 0.09, '#79644a', 0.03);
    }
    return consolidate(g);
  }
  if (kind === 'logPile') {
    g = new T.Group();
    for (let y = 0; y < 3; y++)
      for (let i = 0; i < 4 - y; i++) {
        const log = cyl(g, 0.17, 0.17, 2, i * 0.36 + y * 0.18, 0.18 + y * 0.3, 0, C.wood, 12);
        log.rotation.x = Math.PI / 2;
      }
    return consolidate(g);
  }
  if (kind === 'treasure') {
    g = new T.Group();
    for (let i = 0; i < 3; i++) crate(g, (i - 1) * 0.6, 0, 0);
    banner(g, -0.8, 1.5, -0.4);
    return consolidate(g);
  }
  if (kind === 'bird') {
    g = new T.Group();
    oval(g, 0, 0, 0, 0.08, 0.08, 0.23, '#dadbcd');
    for (const s of [-1, 1]) {
      const wing = joint(g, `birdWing${s}`);
      const geo = new T.BufferGeometry().setAttribute(
        'position',
        new T.Float32BufferAttribute([0, 0, 0.1, s * 0.7, 0, -0.1, s * 0.22, 0, -0.2], 3),
      );
      geo.computeVertexNormals();
      const m = mat('#d5d9cd');
      m.side = T.DoubleSide;
      mesh(geo, m, wing);
    }
    return g;
  }
  if (kind in soldiers) return footUnit(kind as keyof typeof soldiers, age);
  if (kind in riders) {
    g = buildRider(age);
    g.userData.mountedRole = kind;
    const body = (g.getObjectByName('spine') ?? g.getObjectByName('body')) as T.Group,
      lance = g.getObjectByName('lance')!;
    lance.removeFromParent();
    if (kind === 'dragoon') {
      joint(body, 'tool').add(rifle());
      addShot(g, 'bullet', 3.6, 0.65);
    } else if (kind !== 'mountedScout') {
      const saber = joint(body, 'mountedSaber');
      beam(saber, [0, -0.09, 0], [0, 0.06, 0], 0.024, C.wood);
      box(saber, 0.16, 0.025, 0.055, 0, 0.06, 0, C.gold);
      tube(
        saber,
        [
          [0, 0.08, 0],
          [0.015, 0.36, 0],
          [0.07, 0.65, 0],
          [0.13, 0.78, 0],
        ],
        0.027,
        '#bcc6bc',
      );
    }
    if (kind === 'cuirassRider') oval(body, 0, 1.3, 0.13, 0.19, 0.22, 0.05, '#8a9690');
    return g;
  }
  if (['howitzer', 'scatterGun', 'mortar'].includes(kind)) {
    g = base('cannon');
    const b = g.getObjectByName('barrel')!;
    b.scale.y = kind === 'mortar' ? 0.45 : kind === 'howitzer' ? 0.7 : 0.9;
    b.scale.x = b.scale.z = kind === 'scatterGun' ? 1.25 : 1.12;
    if (kind === 'mortar') b.rotation.x = 0.62;
    return g;
  }
  if (kind in vessels) {
    g = base(kind === 'sloop' ? 'fishingBoat' : 'ship');
    if (kind === 'sloop') g.scale.setScalar(1.5);
    if (kind === 'frigate') g.scale.set(1.15, 1.05, 1.2);
    const equip = joint(g, 'navalEquipment');
    if (kind === 'tradeShip' || kind === 'transport')
      for (let i = 0; i < 6; i++) crate(equip, i % 2 ? -0.65 : 0.65, 0.95, -1.4 + Math.floor(i / 2) * 1.1);
    if (kind === 'frigate' || kind === 'bombardVessel')
      for (const s of [-1, 1])
        for (let i = 0; i < (kind === 'frigate' ? 5 : 2); i++) {
          const p = joint(equip, 'broadside', s * 1.25, 1.12, -2 + i * 0.9);
          p.rotation.y = (s * Math.PI) / 2;
          gun(p, 0, 0, 0);
        }
    if (kind === 'fireCraft')
      for (let i = 0; i < 7; i++) cyl(equip, 0.22, 0.22, 0.55, ((i % 2) - 0.5) * 1.1, 1.2, -2 + i * 0.55, C.wood, 12);
    return g;
  }
  if (kind === 'sapperTeam') {
    g = new T.Group();
    for (const x of [-0.7, 0.7]) {
      const soldier = footUnit('engineer');
      soldier.position.x = x;
      g.add(soldier);
    }
    return g;
  }
  g = new T.Group();
  const chassis = joint(g, 'chassis');
  for (const x of [-0.68, 0.68]) for (const z of [-0.8, 0.8]) wheel(chassis, x, 0.52, z);
  box(chassis, 1.5, 0.18, 2.6, 0, 0.65, 0, C.wood);
  for (const x of [-0.7, 0.7]) box(chassis, 0.08, 0.46, 2.6, x, 0.94, 0, C.cloth);
  if (kind === 'rocketCart') {
    for (let i = 0; i < 7; i++) {
      const rack = joint(chassis, 'rocket', -0.5 + i * 0.17, 1.2, 0);
      rack.rotation.x = 0.7;
      beam(rack, [0, -0.45, 0], [0, 0.9, 0], 0.05, C.dark);
      mesh(new T.ConeGeometry(0.055, 0.16, 8), mat(C.gold), rack, 0, 0.99, 0);
    }
    addShot(g, 'rocket', 3, 0.8, [0, 1.8, 0.4]);
  } else if (kind === 'siegeTower') {
    for (const x of [-0.65, 0.65]) for (const z of [-1, 1]) box(chassis, 0.13, 4, 0.13, x, 2.6, z, C.wood);
    for (const y of [1.8, 3, 4.5]) box(chassis, 1.5, 0.13, 2.5, 0, y, 0, C.wood);
    roof(chassis, 1.9, 2.7, 4.6);
  } else if (kind === 'ramWagon') {
    roof(chassis, 1.8, 3, 1.7);
    const assembly = joint(chassis, 'ramBeam');
    const ram = cyl(assembly, 0.18, 0.2, 3.4, 0, 1.1, 0, C.wood, 14);
    ram.rotation.x = Math.PI / 2;
    ball(assembly, 0, 1.1, 1.8, 0.22, 0.22, 0.23, C.dark, 1);
  } else if (kind === 'mobileFieldwork') {
    for (let i = 0; i < 8; i++)
      beam(chassis, [-0.7 + i * 0.2, 0.6, 1], [-0.7 + i * 0.2, 1.7, 1.5], 0.045, C.wood, 0.003);
  } else {
    for (let i = 0; i < 4; i++) crate(chassis, ((i % 2) - 0.5) * 0.65, 0.75, -0.7 + Math.floor(i / 2) * 0.85);
    if (kind === 'builderWagon') {
      beam(chassis, [-0.6, 1, 0.9], [-0.6, 2.7, -0.6], 0.06, C.wood);
      beam(chassis, [0.6, 1, 0.9], [0.6, 2.7, -0.6], 0.06, C.wood);
      for (let i = 0; i < 6; i++)
        beam(chassis, [-0.6, 1 + i * 0.28, 0.9 - i * 0.25], [0.6, 1 + i * 0.28, 0.9 - i * 0.25], 0.035, C.wood);
    }
  }
  banner(chassis, 0.7, 2.3, -1);
  return finishRig(g);
}
