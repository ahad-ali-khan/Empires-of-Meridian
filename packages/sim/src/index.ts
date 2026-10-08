import {weatherAt} from './weather';
import {applyOfflineCheat} from './offline-cheats';
import {chooseAiProductionUnit} from './ai-composition';
import {
  buildingById,
  councilChoices,
  dispatches,
  unitById,
  garrisonCapacity,
  councilRate,
  advancements,
  technologies,
  technologyById,
  productionName,
  supportByUnit,
  frontierRules,
  treasureDefinitions,
  treasureById,
} from '../../content/src/index';
import {CONTENT_VERSION} from '../../content/src/index';
import {visibleTo, updateVision, observedEntities, FOG_CELL} from './visibility';
import {coastAt, landAt, seedHash, inlandWater, terrainHeight} from './terrain';
import {
  blocked,
  approachRange,
  invalidateNavigation,
  nearestPassable,
  reachableGround,
  requestPath,
} from './navigation';
import {
  wallSpans,
  inWall,
  wallPlacementReason,
  snapWallEndpoint,
  gateConversionCost,
  gateConversionReason,
} from './walls';
import {edgeDistance, halfBounds, perimeterPoint} from './spatial';
import {chooseIntent, DEFAULT_AI_POLICY, featuresFor, teacherIntent} from './ai-policy';
import {
  PROTOCOL_VERSION,
  RESOURCE_SCALE,
  TICKS_PER_SECOND,
  WORLD_SCALE,
  type Command,
  type Difficulty,
  type MatchConfig,
  type PlayerId,
  type ResourceKind,
  type Resources,
  type SaveEnvelope,
  type Stance,
} from '../../protocol/src/index';

export const MAP_VERSION = 7;
type EntityCategory = 'unit' | 'building' | 'resource' | 'projectile' | 'treasure' | 'animal';
type Task =
  | 'idle'
  | 'move'
  | 'gather'
  | 'carry'
  | 'build'
  | 'attack'
  | 'dead'
  | 'garrison'
  | 'heal'
  | 'collect'
  | 'claim'
  | 'revive';
export interface QueueItem {
  id?: number;
  kind: string;
  remaining: number;
  total: number;
  progressRemainder?: number;
}
export interface Entity {
  id: number;
  owner: 0 | PlayerId;
  kind: string;
  category: EntityCategory;
  x: number;
  z: number;
  destX?: number;
  destZ?: number;
  hp: number;
  maxHp: number;
  amount: number;
  task: Task;
  targetId?: number;
  resourceTargetId?: number;
  homeId?: number;
  carry: Partial<Resources>;
  cooldown: number;
  range: number;
  speed: number;
  damage: number;
  population: number;
  progress: number;
  queue: QueueItem[];
  stance: Stance;
  model: string;
  visible: boolean;
  path?: [number, number][];
  pathGoal?: string;
  moving?: boolean;
  avoidTraffic?: boolean;
  trafficWait?: number;
  progressAt?: number;
  progressDistance?: number;
  progressX?: number;
  progressZ?: number;
  recoveryCount?: number;
  working?: boolean;
  wallAxis?: [number, number];
  rotation?: 0 | 1 | 2 | 3;
  buildQueue?: number[];
  initialAmount?: number;
  workSlot?: number;
  waitingSince?: number;
  resourceKind?: string;
  resourceOrigin?: {x: number; z: number};
  followId?: number;
  activeResource?: ResourceKind;
  lastWorked?: number;
  stumpSince?: number;
  beforeGarrison?: {task: Task; targetId?: number; resourceTargetId?: number};
  beforeFlee?: {task: Task; targetId?: number; resourceTargetId?: number; destX?: number; destZ?: number};
  lastTargetPosition?: {x: number; z: number};
  lastOrder?: number;
  tradeSite?: boolean;
  siteIncome?: ResourceKind;
  captureOwner?: PlayerId;
  captureProgress?: number;
  captureContested?: boolean;
  incomeProgress?: number;
  treasureId?: string;
  treasureTargetId?: number;
  guardOf?: number;
  incapacitatedAt?: number;
  recoveryProgress?: number;
  interactionProgress?: number;
  gatherRemainder?: number;
  aiScoutLeg?: number;
  orders?: Command[];
  directive?: {
    kind: 'attack-move' | 'patrol' | 'guard';
    x: number;
    z: number;
    originX: number;
    originZ: number;
    targetId?: number;
    returning?: boolean;
    chaseX?: number;
    chaseZ?: number;
    ignoredTarget?: number;
    ignoreUntil?: number;
  };
  rally?: {x: number; z: number; targetId?: number};
  garrisonedIn?: number;
  deathTick?: number;
  fleeUntil?: number;
  remembered?: boolean;
  garrisonCount?: number;
  attackAt?: number;
  attackStart?: number;
  lastHitBy?: number;
  regroupUntil?: number;
}
export interface PlayerState {
  cheatsUsed?: number;
  id: PlayerId;
  advancing?: {councilId: string; remaining: number; total: number; waiting?: string};
  resources: Resources;
  age: 1 | 2 | 3 | 4;
  renown: number;
  tokens: number;
  population: number;
  populationCap: number;
  resigned: boolean;
  modifiers: string[];
  researched: string[];
  usedDispatches: string[];
  pendingDispatches: {id: string; departureTick: number; arrivalTick: number; waiting?: string}[];
  stats: {
    gathered: Resources;
    unitsLost: number;
    unitsKilled: number;
    idleWorkerTicks: number;
    dispatches: number;
    commands: number;
    tradeIncome: Resources;
    exchanges: number;
    treasures: number;
    sitesCaptured: number;
  };
}
export interface AiTrace {
  playerId?: PlayerId;
  tick: number;
  difficulty: Difficulty;
  goal: string;
  utility: number;
  knownEnemies: number;
  army: number;
  issued: string[];
  targetId?: number;
  targetKind?: string;
  resourceFocus?: ResourceKind;
  routeIndex?: number;
}
export interface MatchState {
  v: 1;
  config: MatchConfig;
  tick: number;
  nextEntityId: number;
  nextSequence: number[];
  rng: [number, number, number, number];
  entities: Entity[];
  players: PlayerState[];
  events: {tick: number; text: string; kind: string; owner?: PlayerId}[];
  projectiles: {
    id: number;
    owner: PlayerId;
    sourceId: number;
    targetId: number;
    x: number;
    z: number;
    impactTick: number;
    damage: number;
    startTick?: number;
    startX?: number;
    startZ?: number;
    targetX?: number;
    targetZ?: number;
    kind?: string;
  }[];
  map: {
    seed: number;
    size: number;
    coastX: number;
    weather: import('../../protocol/src/index').EnvironmentWeather;
    wind: number;
    valid: boolean;
    tradeX: number;
  };
  winner: 0 | PlayerId | null;
  aiTrace: AiTrace[];
  aiTargetHistory: Record<number, number[]>;
  commandLog: Command[];
  fog: number[][];
  knowledge: Record<number, Entity>[];
}

const emptyResources = (): Resources => ({provisions: 0, timber: 0, coin: 0, metal: 0});
const startResources = (): Resources => ({provisions: 26000, timber: 22000, coin: 12000, metal: 6000});
const u32 = (n: number) => n >>> 0;
function seedRng(seed: number): [number, number, number, number] {
  let x = u32(seed || 1);
  const next = () => {
    x = u32(x + 0x9e3779b9);
    let z = x;
    z = u32((z ^ (z >>> 16)) * 0x21f0aaad);
    z = u32((z ^ (z >>> 15)) * 0x735a2d97);
    return u32(z ^ (z >>> 15));
  };
  return [next(), next(), next(), next()];
}
function random(state: MatchState) {
  let [a, b, c, d] = state.rng;
  const result = u32(((u32(a * 5) << 7) | (u32(a * 5) >>> 25)) * 9);
  const t = u32(b << 9);
  c ^= a;
  d ^= b;
  b ^= c;
  a ^= d;
  c ^= t;
  d = (d << 11) | (d >>> 21);
  state.rng = [u32(a), u32(b), u32(c), u32(d)];
  return result / 4294967296;
}
function player(id: PlayerId, populationCap: number): PlayerState {
  return {
    id,
    resources: startResources(),
    age: 1,
    renown: 0,
    tokens: 0,
    population: 5,
    populationCap: Math.min(20, populationCap),
    resigned: false,
    modifiers: [],
    researched: [],
    usedDispatches: [],
    pendingDispatches: [],
    stats: {
      gathered: emptyResources(),
      unitsLost: 0,
      unitsKilled: 0,
      idleWorkerTicks: 0,
      dispatches: 0,
      commands: 0,
      tradeIncome: emptyResources(),
      exchanges: 0,
      treasures: 0,
      sitesCaptured: 0,
    },
  };
}
function dist(a: {x: number; z: number}, b: {x: number; z: number}) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
}
function addEntity(state: MatchState, entity: Omit<Entity, 'id'>) {
  const complete = {...entity, id: state.nextEntityId++};
  state.entities.push(complete);
  return complete;
}
function unit(state: MatchState, owner: PlayerId, kind: string, x: number, z: number) {
  for (const id of state.players[owner - 1]?.researched ?? []) {
    const upgrade = technologyById.get(id)?.upgrade;
    if (upgrade?.from === kind) kind = upgrade.to;
  }
  const d = unitById.get(kind);
  if (!d) throw new Error(`Unknown unit ${kind}`);
  return addEntity(state, {
    owner,
    kind,
    category: 'unit',
    x,
    z,
    hp: d.hp,
    maxHp: d.hp,
    amount: 0,
    task: 'idle',
    carry: {},
    cooldown: 0,
    range: d.range,
    speed: d.speed,
    damage: d.damage,
    population: d.population,
    progress: 10000,
    queue: [],
    stance: kind === 'worker' ? 'defensive' : 'aggressive',
    model: d.model,
    visible: true,
  });
}
function building(
  state: MatchState,
  owner: PlayerId,
  kind: string,
  x: number,
  z: number,
  complete = true,
  rotation: 0 | 1 | 2 | 3 = 0,
) {
  invalidateNavigation(state);
  const d = buildingById.get(kind);
  if (!d) throw new Error(`Unknown building ${kind}`);
  return addEntity(state, {
    owner,
    kind,
    category: 'building',
    x,
    z,
    hp: complete ? d.hp : 1,
    maxHp: d.hp,
    amount: 0,
    task: complete ? 'idle' : 'build',
    carry: {},
    cooldown: 0,
    range: kind === 'tower' ? 1350 : 0,
    speed: 0,
    damage: kind === 'tower' ? 12 : 0,
    population: 0,
    progress: complete ? 10000 : 0,
    queue: [],
    stance: 'defensive',
    model: d.model,
    visible: true,
    rotation,
  });
}
function resource(state: MatchState, kind: string, x: number, z: number, amount: number, single = false): Entity {
  if (kind === 'timber' && !single) {
    const offsets = [
      [0, 0],
      [-800, -500],
      [750, -550],
      [-900, 700],
      [850, 850],
      [0, 1300],
    ];
    const trees = offsets
      .filter(([dx, dz]) => !blocked(state, x + dx, z + dz))
      .map(([dx, dz], i) =>
        resource(state, kind, x + dx, z + dz, Math.floor(amount / 6) + (i === 0 ? amount % 6 : 0), true),
      );
    return trees[0];
  }
  return addEntity(state, {
    owner: 0,
    kind,
    category: kind === 'deer' || kind === 'sheep' ? 'animal' : 'resource',
    x,
    z,
    hp: kind === 'deer' ? 80 : kind === 'sheep' ? 60 : 1,
    maxHp: kind === 'deer' ? 80 : kind === 'sheep' ? 60 : 1,
    amount,
    initialAmount: amount,
    task: 'idle',
    carry: {},
    cooldown: 0,
    range: 0,
    speed: kind === 'deer' ? 28 : 12,
    damage: 0,
    population: 0,
    progress: 10000,
    queue: [],
    stance: 'no-attack',
    model:
      kind === 'timber'
        ? 'tree'
        : kind === 'provisions'
          ? 'berries'
          : kind === 'coin'
            ? 'mine'
            : kind === 'metal'
              ? 'stoneMine'
              : kind,
    visible: true,
  });
}

export function createMatch(config: MatchConfig): MatchState {
  const playerCount = 1 + Math.max(0, Math.min(3, Math.trunc(config.aiCount ?? 1)));

  const size = {small: 256, medium: 320, large: 448}[config.mapSize ?? 'medium'] * WORLD_SCALE;
  const state: MatchState = {
    v: 1,
    config: {...config},
    tick: 0,
    nextEntityId: 1,
    nextSequence: Array(playerCount).fill(1),
    rng: seedRng(config.seed),
    entities: [],
    players: Array.from({length: playerCount}, (_, i) => player((i + 1) as PlayerId, config.populationCap)),
    events: [],
    projectiles: [],
    map: {
      seed: config.seed,
      size,
      coastX: coastAt(size / 2, size, config.seed),
      ...weatherAt(config.seed, 0),
      valid: true,
      tradeX: 80 * WORLD_SCALE,
    },
    winner: null,
    aiTrace: [],
    aiTargetHistory: {},
    commandLog: [],
    fog: Array.from({length: playerCount}, () => Array(Math.ceil(size / FOG_CELL) ** 2).fill(0)),
    knowledge: Array.from({length: playerCount}, () => ({})),
  };
  const w = size / WORLD_SCALE,
    jitter = seedHash(config.seed, 80) % 11;
  const startCandidates = [
    [
      Math.floor(coastAt(Math.floor(w * 0.77) * 256, size, config.seed) / 256) - 24 - (jitter % 4),
      Math.floor(w * 0.77),
    ],
    [Math.floor(w * 0.28) + jitter, Math.floor(w * 0.23)],
  ];
  startCandidates.push(
    [Math.floor(coastAt(Math.floor(w * 0.23) * 256, size, config.seed) / 256) - 24, Math.floor(w * 0.23)],
    [Math.floor(w * 0.25), Math.floor(w * 0.82)],
  );
  const offset = seedHash(config.seed, 91) % startCandidates.length,
    order = playerCount === 2 ? [0, 2] : playerCount === 3 ? [0, 1, 3] : [0, 1, 2, 3],
    starts = order.map((i) => startCandidates[(i + offset) % startCandidates.length]);
  for (const [i, [sx, sz]] of starts.slice(0, playerCount).entries()) {
    const owner = (i + 1) as PlayerId,
      x = sx * WORLD_SCALE,
      z = sz * WORLD_SCALE,
      sign = x < size / 2 ? 1 : -1;
    building(state, owner, 'hall', x, z);
    building(state, owner, 'house', x - sign * 9 * WORLD_SCALE, z + 7 * WORLD_SCALE);
    building(state, owner, 'barracks', x - sign * 10 * WORLD_SCALE, z - 9 * WORLD_SCALE);
    const spawnSlots = new Set<string>();
    for (let w = 0; w < 4; w++) {
      const spawn = nearestPassable(
          state,
          x + sign * 8 * WORLD_SCALE,
          z + Math.trunc((w - 1.5) * 1.5 * WORLD_SCALE),
          owner,
          spawnSlots,
        ) ?? [x + sign * 9 * WORLD_SCALE, z],
        worker = unit(state, owner, 'worker', spawn[0], spawn[1]);
      spawnSlots.add(`${spawn[0]},${spawn[1]}`);
      if (w % 2) worker.model = 'villagerFemale';
    }
    const explorerSpawn =
      nearestPassable(state, x + sign * 8 * WORLD_SCALE, z - 7 * WORLD_SCALE, owner, spawnSlots) ??
      ([x + sign * 9 * WORLD_SCALE, z - 7 * WORLD_SCALE] as const);
    unit(state, owner, 'explorer', explorerSpawn[0], explorerSpawn[1]);
    resource(state, 'provisions', x + sign * 10 * WORLD_SCALE, z + 2 * WORLD_SCALE, 36000);
    resource(state, 'timber', x + sign * 14 * WORLD_SCALE, z - 6 * WORLD_SCALE, 52000);
    resource(state, 'coin', x + sign * 18 * WORLD_SCALE, z + 10 * WORLD_SCALE, 42000);
    resource(state, 'metal', x + sign * 20 * WORLD_SCALE, z - 13 * WORLD_SCALE, 30000);
    resource(state, 'deer', x + sign * 12 * WORLD_SCALE, z + 13 * WORLD_SCALE, 18000);
    resource(state, 'sheep', x + sign * 7 * WORLD_SCALE, z - 12 * WORLD_SCALE, 12000);
  }
  for (let i = 0; i < Math.floor((w * w) / 170); i++) {
    const x = Math.trunc((10 + random(state) * (w * 0.81 - 20)) * WORLD_SCALE),
      z = Math.trunc((10 + random(state) * (w - 20)) * WORLD_SCALE);
    if (
      !landAt(x, z, size, config.seed) ||
      state.entities.some((e) => dist(e, {x, z}) < (e.category === 'building' ? 12 : 5) * WORLD_SCALE)
    )
      continue;
    resource(
      state,
      i % 13 === 0
        ? 'coin'
        : i % 13 === 1
          ? 'metal'
          : i % 13 === 2
            ? 'provisions'
            : i % 13 === 3
              ? 'sheep'
              : i % 13 === 4
                ? 'deer'
                : 'timber',
      x,
      z,
      i % 13 === 3 || i % 13 === 4 ? 14000 : 45000 + i * 1000,
    );
  }
  // Fish follow the complete shoreline network, including inland tributaries.
  // Choose bank-adjacent positions and keep shoals separated, so every fishing
  // ground has a plausible, reachable shore instead of a fixed central scan.
  const fishBudget = Math.round(w / 20);
  for (let i = 0; i < Math.max(8, Math.round(w / 28)); i++) {
    const z = Math.trunc(size * (0.1 + (i / (Math.max(8, Math.round(w / 28)) - 1)) * 0.8));
    resource(state, 'fish', coastAt(z, size, config.seed) - 128, z, 50000);
  }
  let lakeFish = 0;
  for (let z = 8 * 256; z < size - 8 * 256 && lakeFish < fishBudget; z += 4 * 256)
    for (let x = 8 * 256; x < coastAt(z, size, config.seed) - 4 * 256 && lakeFish < fishBudget; x += 3 * 256) {
      if (
        !inlandWater(x, z, size, config.seed) ||
        ![
          [900, 0],
          [-900, 0],
          [0, 900],
          [0, -900],
        ].some(([dx, dz]) => landAt(x + dx, z + dz, size, config.seed)) ||
        state.entities.some((e) => e.kind === 'fish' && dist(e, {x, z}) < 10 * 256)
      )
        continue;
      resource(state, 'fish', x, z, 35000);
      lakeFish++;
    }
  const frontierStarts = state.entities.filter((e) => e.kind === 'explorer');
  function objectivePosition(kind: string, x: number, z: number) {
    const reachability = reachableGround(state, frontierStarts);
    for (let radius = 0; radius <= 12; radius++)
      for (let dz = -radius; dz <= radius; dz++)
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
          const px = Math.trunc(x + dx * 4 * 256),
            pz = Math.trunc(z + dz * 4 * 256);
          if (placementReason(state, kind, px, pz)) continue;
          const end = {x: px, z: pz + Math.ceil((buildingById.get(kind)?.footprint[1] ?? 2) * 256) + 450};
          if (blocked(state, end.x, end.z)) continue;
          const cell = Math.floor(end.z / 256) * reachability.n + Math.floor(end.x / 256);
          if (!reachability.cells[cell]) continue;
          return {x: px, z: pz};
        }
  }
  for (const ratio of [0.32, 0.5, 0.68]) {
    const z = Math.trunc(size * ratio),
      position = objectivePosition('tradePost', Math.trunc(coastAt(z, size, config.seed) * 0.5), z);
    if (!position) continue;
    const site = building(state, 1, 'tradePost', position.x, position.z);
    site.owner = 0;
    site.tradeSite = true;
    site.siteIncome = 'coin';
    site.captureProgress = 0;
    site.incomeProgress = 0;
  }
  const treasurePositions = [
    ...frontierStarts.map((e) => ({x: e.x - 14 * 256, z: e.z})),
    {x: Math.trunc(size * 0.4), z: Math.trunc(size * 0.42)},
    {x: Math.trunc(size * 0.36), z: Math.trunc(size * 0.6)},
  ];
  for (const [index, desired] of treasurePositions.entries()) {
    const position = objectivePosition('house', desired.x, desired.z);
    if (!position) continue;
    const definition = treasureDefinitions[index < frontierStarts.length ? 0 : 1 + (seedHash(config.seed, index) % 2)];
    const chest = addEntity(state, {
      owner: 0,
      kind: 'treasure',
      category: 'treasure',
      ...position,
      hp: 1,
      maxHp: 1,
      amount: 1,
      task: 'idle',
      carry: {},
      cooldown: 0,
      range: 0,
      speed: 0,
      damage: 0,
      population: 0,
      progress: 10000,
      queue: [],
      stance: 'no-attack',
      model: 'treasure',
      visible: true,
      treasureId: definition.id,
    });
    for (let i = 0; i < definition.guards; i++) {
      const spawn = nearestPassable(state, chest.x + (i ? 800 : -800), chest.z + 600);
      if (!spawn) continue;
      const guard = unit(state, 1, 'militia', spawn[0], spawn[1]);
      guard.owner = 0;
      guard.guardOf = chest.id;
      guard.stance = 'aggressive';
    }
  }
  updateVision(state);
  return state;
}

function canPay(p: PlayerState, cost: Resources) {
  return (Object.keys(cost) as ResourceKind[]).every((k) => p.resources[k] >= cost[k]);
}
function pay(p: PlayerState, cost: Resources) {
  for (const k of Object.keys(cost) as ResourceKind[]) p.resources[k] -= cost[k];
}
function owned(state: MatchState, id: number, owner: PlayerId) {
  const e = state.entities.find((x) => x.id === id);
  return e && e.owner === owner && e.hp > 0 ? e : undefined;
}
function event(state: MatchState, text: string, kind = 'info', owner?: PlayerId) {
  state.events.push({tick: state.tick, text, kind, owner});
  if (state.events.length > 60) state.events.shift();
}
export function placementReason(
  state: Pick<MatchState, 'entities' | 'map'>,
  kind: string,
  x: number,
  z: number,
  rotation: 0 | 1 | 2 | 3 = 0,
) {
  const d = buildingById.get(kind);
  if (!d) return 'Unknown building.';
  const footprint = rotation % 2 ? [d.footprint[1], d.footprint[0]] : d.footprint,
    [hx, hz] = footprint.map((n) => Math.ceil(n * 256));
  const heights: number[] = [];
  for (const xx of [x - hx, x, x + hx])
    for (const zz of [z - hz, z, z + hz]) {
      if (!landAt(xx, zz, state.map.size, state.map.seed))
        return 'Choose dry land: the footprint crosses water, a cliff, or the map edge.';
      heights.push(Math.round(terrainHeight(xx / 256, zz / 256, state.map.size / 256, state.map.seed) * 256));
    }
  if (Math.max(...heights) - Math.min(...heights) > 640)
    return 'Too steep for a level foundation. Choose a gentler slope.';
  for (const e of state.entities) {
    if (e.hp <= 0 || e.category === 'unit' || e.category === 'animal' || (e.category === 'resource' && e.amount <= 0))
      continue;
    if (e.wallAxis) {
      if (inWall(e, x, z, Math.max(hx, hz) + 160)) return 'This footprint overlaps a wall.';
      continue;
    }
    const [ehx, ehz] = halfBounds(e);
    if (Math.abs(e.x - x) < hx + ehx + 180 && Math.abs(e.z - z) < hz + ehz + 180)
      return 'This footprint overlaps a building or resource.';
  }
  return '';
}
export const canSee = visibleTo;
type UnitCommand = Extract<Command, {entityIds: number[]}> & {queued?: boolean};
const unitOrderTypes = [
  'move',
  'attack-move',
  'patrol',
  'gather',
  'attack',
  'guard',
  'heal',
  'resume-build',
  'garrison',
  'collect-treasure',
  'claim-site',
  'revive',
];
function orderReason(state: MatchState, e: Entity, c: UnitCommand) {
  if (e.garrisonedIn) return 'Release sheltered units before ordering them.';
  if ('x' in c)
    return Number.isSafeInteger(c.x) &&
      Number.isSafeInteger(c.z) &&
      c.x >= 0 &&
      c.z >= 0 &&
      c.x < state.map.size &&
      c.z < state.map.size
      ? ''
      : 'Choose a point inside the map.';
  if (!('targetId' in c)) return 'Invalid unit order.';
  const t = state.entities.find((t) => t.id === c.targetId);
  if (!t || t.remembered || !canSee(state, e.owner as PlayerId, t)) return 'That target is no longer visible.';
  if (c.type === 'collect-treasure')
    return e.kind === 'explorer' &&
      t.category === 'treasure' &&
      t.hp > 0 &&
      t.amount > 0 &&
      !!treasureById.get(t.treasureId ?? '')
      ? ''
      : 'Select an explorer and an unclaimed treasure.';
  if (c.type === 'claim-site')
    return e.category === 'unit' && t.tradeSite && t.hp > 0 && t.owner !== e.owner
      ? ''
      : 'Select units and a neutral or opposing trade site.';
  if (c.type === 'revive')
    return e.category === 'unit' && t.owner === e.owner && t.incapacitatedAt !== undefined && t.id !== e.id
      ? ''
      : 'Select a living ally and an incapacitated explorer.';
  if (c.type === 'guard')
    return t.hp > 0 && t.owner === e.owner && t.id !== e.id && ['unit', 'building'].includes(t.category)
      ? ''
      : 'Guard a living friendly unit or building.';
  if (c.type === 'heal')
    return supportByUnit.has(e.kind) &&
      t.owner === e.owner &&
      t.hp > 0 &&
      t.hp < t.maxHp &&
      t.category === 'unit' &&
      !unitById.get(t.kind)?.tags.includes('artillery') &&
      !unitById.get(t.kind)?.tags.includes('siege')
      ? ''
      : 'A medic can heal an injured friendly living unit.';
  if (c.type === 'attack')
    return e.category === 'unit' &&
      e.damage > 0 &&
      t.hp > 0 &&
      !t.tradeSite &&
      (t.owner !== e.owner || t.kind === 'sheep') &&
      ['unit', 'building', 'animal'].includes(t.category)
      ? ''
      : 'This unit cannot attack that target.';
  if (c.type === 'gather')
    return e.kind === 'worker' &&
      (t.amount > 0 || (t.kind === 'farm' && t.owner === e.owner && t.progress === 10000)) &&
      (t.category === 'resource' || t.category === 'animal' || t.kind === 'farm')
      ? ''
      : 'Select a worker and an available resource.';
  if (c.type === 'resume-build')
    return e.kind === 'worker' &&
      t.owner === e.owner &&
      t.category === 'building' &&
      t.hp > 0 &&
      (t.progress < 10000 || t.hp < t.maxHp)
      ? ''
      : 'Select workers and an unfinished or damaged friendly building.';
  if (c.type === 'garrison')
    return e.kind === 'worker' &&
      t.owner === e.owner &&
      t.hp > 0 &&
      t.progress === 10000 &&
      garrisonCapacity(t.kind, state.players[e.owner - 1].age) > 0
      ? ''
      : 'Select villagers and a completed central hall or fort.';
  return 'Invalid unit order.';
}
function startUnitOrder(state: MatchState, e: Entity, c: UnitCommand) {
  e.directive = undefined;
  e.treasureTargetId = undefined;
  e.interactionProgress = 0;
  e.attackAt = undefined;
  e.attackStart = undefined;
  e.lastTargetPosition = undefined;
  e.path = undefined;
  e.pathGoal = undefined;
  e.workSlot = undefined;
  e.waitingSince = undefined;
  e.beforeFlee = undefined;
  e.fleeUntil = undefined;
  e.followId = undefined;
  e.buildQueue = undefined;
  e.working = false;
  e.recoveryCount = 0;
  e.progressAt = undefined;
  e.progressDistance = undefined;
  if (c.type === 'collect-treasure' || c.type === 'claim-site' || c.type === 'revive') {
    e.task = c.type === 'collect-treasure' ? 'collect' : c.type === 'claim-site' ? 'claim' : 'revive';
    e.targetId = c.targetId;
    e.resourceTargetId = undefined;
    if (c.type === 'collect-treasure') e.treasureTargetId = c.targetId;
  } else if (c.type === 'guard' || c.type === 'heal') {
    e.task = c.type === 'heal' ? 'heal' : 'idle';
    e.targetId = c.targetId;
    if (c.type === 'guard')
      e.directive = {kind: 'guard', x: e.x, z: e.z, originX: e.x, originZ: e.z, targetId: c.targetId};
  } else if (c.type === 'attack-move' || c.type === 'patrol') {
    applyCommand(state, {...c, type: 'move', entityIds: [e.id], queued: false, tick: state.tick}, true);
    if (e.destX !== undefined && e.destZ !== undefined)
      e.directive = {kind: c.type, x: e.destX, z: e.destZ, originX: e.x, originZ: e.z};
  } else applyCommand(state, {...c, entityIds: [e.id], queued: false, tick: state.tick} as Command, true);
}
function issueUnitOrders(state: MatchState, command: Command) {
  if (!unitOrderTypes.includes(command.type) || !('entityIds' in command)) return false;
  const c = command as UnitCommand;
  const ids = [...new Set(c.entityIds)].sort((a, b) => a - b),
    columns = Math.ceil(Math.sqrt(ids.length)),
    reserved = new Set<string>();
  let accepted = 0,
    reason = 'Select owned mobile units.';
  for (const [i, id] of ids.entries()) {
    const e = owned(state, id, c.playerId);
    if (!e || !(e.category === 'unit' || e.kind === 'sheep')) continue;
    const single = {...c, entityIds: [id]} as UnitCommand;
    if ('x' in single) {
      const invalidPoint = orderReason(state, e, single);
      if (invalidPoint) {
        reason = invalidPoint;
        continue;
      }
      single.x = Math.trunc(single.x + ((i % columns) - (columns - 1) / 2) * 512);
      single.z = Math.trunc(single.z + (Math.floor(i / columns) - (Math.ceil(ids.length / columns) - 1) / 2) * 512);
      const destination = nearestPassable(state, single.x, single.z, e.owner, reserved);
      if (!destination) {
        reason = 'No passable destination near that point.';
        continue;
      }
      [single.x, single.z] = destination;
      reserved.add(`${single.x},${single.z}`);
    }
    const invalid = orderReason(state, e, single);
    if (invalid) {
      reason = invalid;
      continue;
    }
    if (c.queued && (e.task !== 'idle' || e.directive || e.orders?.length)) {
      if ((e.orders?.length ?? 0) >= 32) {
        reason = 'Order queue is full (32 orders).';
        continue;
      }
      (e.orders ??= []).push(single);
    } else {
      if (!c.queued) e.orders = [];
      startUnitOrder(state, e, single);
    }
    accepted++;
  }
  event(
    state,
    accepted
      ? `${c.queued ? 'Queued' : 'Ordered'} ${c.type} for ${accepted} unit${accepted === 1 ? '' : 's'}.${accepted < ids.length ? ` ${ids.length - accepted} skipped: ${reason}` : ''}`
      : reason,
    accepted ? 'order' : 'rejected',
    c.playerId,
  );
  return true;
}
function updateDirective(state: MatchState, e: Entity) {
  const d = e.directive;
  if (!d || !e.owner) return;
  const guarded =
    d.kind === 'guard'
      ? state.entities.find((t) => t.id === d.targetId && t.hp > 0 && t.owner === e.owner && !t.garrisonedIn)
      : undefined;
  if (d.kind === 'guard' && !guarded) {
    e.directive = undefined;
    e.task = 'idle';
    return;
  }
  const anchor = guarded ?? {x: d.x, z: d.z};
  if (e.task === 'attack') {
    const target = state.entities.find((t) => t.id === e.targetId && t.hp > 0 && !t.garrisonedIn);
    const leash = guarded ?? {x: d.chaseX ?? e.x, z: d.chaseZ ?? e.z};
    if (target && canSee(state, e.owner as PlayerId, target) && dist(target, leash) <= 12 * WORLD_SCALE) return;
    if (target) {
      d.ignoredTarget = target.id;
      d.ignoreUntil = state.tick + 100;
    }
    e.task = 'idle';
    e.targetId = undefined;
    e.attackAt = undefined;
    e.path = undefined;
  }
  if (e.task !== 'move' && e.task !== 'idle') return;
  if (e.damage > 0 && e.kind !== 'medic' && e.stance !== 'no-attack') {
    const enemy = nearest(
      state,
      e,
      (t) =>
        (t.owner > 0 || t.guardOf !== undefined) &&
        t.owner !== e.owner &&
        !(t.id === d.ignoredTarget && state.tick < (d.ignoreUntil ?? 0)) &&
        ['unit', 'building'].includes(t.category) &&
        !t.tradeSite &&
        !t.garrisonedIn &&
        canSee(state, e.owner as PlayerId, t) &&
        dist(e, t) <= 8 * WORLD_SCALE &&
        (!guarded || dist(t, guarded) <= 10 * WORLD_SCALE),
    );
    if (enemy) {
      if (!guarded) {
        d.chaseX = e.x;
        d.chaseZ = e.z;
      }
      e.task = 'attack';
      e.targetId = enemy.id;
      e.path = undefined;
      return;
    }
  }
  if (guarded) {
    const point = perimeterPoint(guarded, e.id % 8, guarded.category === 'building' ? 400 : 500);
    if (dist(e, guarded) > (guarded.category === 'building' ? approachRange(guarded) + 700 : 900)) {
      e.task = 'move';
      e.destX = point.x;
      e.destZ = point.z;
    } else e.task = 'idle';
  } else if (e.task === 'idle') {
    if (d.kind === 'attack-move' && dist(e, anchor) <= 200) {
      e.directive = undefined;
      return;
    }
    if (d.kind === 'patrol' && dist(e, {x: d.returning ? d.originX : d.x, z: d.returning ? d.originZ : d.z}) <= 200)
      d.returning = !d.returning;
    e.destX = d.returning ? d.originX : d.x;
    e.destZ = d.returning ? d.originZ : d.z;
    e.task = 'move';
    e.path = undefined;
  }
}
function applyCommand(state: MatchState, c: Command, internal = false) {
  if (
    c.v !== 1 ||
    !Number.isSafeInteger(c.sequence) ||
    !Number.isSafeInteger(c.tick) ||
    !state.players.some((p) => p.id === c.playerId) ||
    c.tick > state.tick + 5 ||
    c.tick < state.tick - 2
  )
    return;
  const p = state.players[c.playerId - 1];
  if (p.resigned || state.winner) return;
  if (c.type === 'offline-cheat') {
    const reason = applyOfflineCheat(state, c);
    event(state, reason || `Offline cheat applied: ${c.cheat}.`, reason ? 'rejected' : 'order', p.id);
    if (!reason && !internal) state.commandLog.push(structuredClone(c));
    return;
  }
  if (!internal) p.stats.commands++;
  if (!internal && issueUnitOrders(state, c)) {
    state.commandLog.push(structuredClone(c));
    return;
  }
  if (c.type === 'exchange') {
    const market = owned(state, c.buildingId, p.id);
    if (
      !market ||
      market.kind !== 'market' ||
      market.progress < 10000 ||
      !['provisions', 'timber', 'metal'].includes(c.resource) ||
      !['buy', 'sell'].includes(c.direction)
    ) {
      event(state, 'Choose a completed owned market and a valid exchange.', 'rejected', p.id);
      return;
    }
    const debit = c.direction === 'buy' ? 'coin' : c.resource,
      credit = c.direction === 'buy' ? c.resource : 'coin';
    const debitAmount = c.direction === 'buy' ? frontierRules.buyCoin : frontierRules.exchangeLot,
      creditAmount = c.direction === 'buy' ? frontierRules.exchangeLot : frontierRules.sellCoin;
    if (p.resources[debit] < debitAmount) {
      event(state, 'Not enough resources for this exchange.', 'rejected', p.id);
      return;
    }
    p.resources[debit] -= debitAmount;
    p.resources[credit] += creditAmount;
    p.stats.exchanges++;
    event(
      state,
      `${c.direction === 'buy' ? 'Bought' : 'Sold'} ${frontierRules.exchangeLot / 100} ${c.resource}.`,
      'trade',
      p.id,
    );
  }
  if (c.type === 'site-income') {
    const site = owned(state, c.siteId, p.id);
    if (!site?.tradeSite || !['provisions', 'timber', 'coin', 'metal'].includes(c.resource)) {
      event(state, 'Select an owned trade site.', 'rejected', p.id);
      return;
    }
    site.siteIncome = c.resource;
    event(state, `Trade site income set to ${c.resource}.`, 'trade', p.id);
  }
  if (c.type === 'recall-explorer') {
    const explorer = state.entities.find(
      (e) => e.id === c.entityId && e.owner === p.id && e.kind === 'explorer' && e.incapacitatedAt !== undefined,
    );
    const hall = state.entities.find((e) => e.owner === p.id && e.kind === 'hall' && e.hp > 0 && e.progress === 10000);
    const point = hall && nearestPassable(state, hall.x, hall.z + approachRange(hall) + 500, p.id);
    if (!explorer || !point || p.resources.coin < frontierRules.recallCoin) {
      event(state, 'Explorer return requires a completed hall, clear entrance and 100 Coin.', 'rejected', p.id);
      return;
    }
    p.resources.coin -= frontierRules.recallCoin;
    explorer.x = point[0];
    explorer.z = point[1];
    recoverExplorer(state, explorer);
  }
  if (c.type === 'resign') {
    p.resigned = true;
    if (c.playerId === 1) state.winner = state.players.find((x) => x.id !== 1 && !x.resigned)?.id ?? 0;
    else checkVictory(state);
    event(state, `Player ${c.playerId} resigned`, 'victory');
    return;
  }
  if (c.type === 'stop') {
    let stopped = 0;
    for (const id of c.entityIds) {
      const e = owned(state, id, c.playerId);
      if (e?.category === 'unit' || e?.kind === 'sheep') {
        stopped++;
        e.orders = [];
        e.directive = undefined;
        e.treasureTargetId = undefined;
        e.attackAt = undefined;
        e.beforeFlee = undefined;
        e.fleeUntil = undefined;
        e.followId = undefined;
        e.working = false;
        e.task = 'idle';
        e.path = undefined;
        e.pathGoal = undefined;
        e.targetId = undefined;
        e.resourceTargetId = undefined;
        e.workSlot = undefined;
        e.waitingSince = undefined;
        e.avoidTraffic = false;
        e.trafficWait = 0;
        e.progressAt = undefined;
        e.progressDistance = undefined;
        e.recoveryCount = 0;
      }
    }
    event(
      state,
      stopped ? `Stopped ${stopped} units; queued orders cleared.` : 'Select owned mobile units to stop.',
      stopped ? 'order' : 'rejected',
      p.id,
    );
  }
  if (c.type === 'move') {
    const ids = [...c.entityIds].sort((a, b) => a - b),
      columns = Math.ceil(Math.sqrt(ids.length)),
      reserved = new Set<string>();
    for (const [i, id] of ids.entries()) {
      const e = owned(state, id, c.playerId);
      if (e?.category === 'unit' || e?.kind === 'sheep') {
        e.task = 'move';
        e.targetId = undefined;
        e.resourceTargetId = undefined;
        const requestedX = Math.trunc(c.x + ((i % columns) - (columns - 1) / 2) * 512),
          requestedZ = Math.trunc(c.z + (Math.floor(i / columns) - (Math.ceil(ids.length / columns) - 1) / 2) * 512),
          destination = nearestPassable(state, requestedX, requestedZ, e.owner, reserved);
        if (!destination) continue;
        [e.destX, e.destZ] = destination;
        reserved.add(`${e.destX},${e.destZ}`);
        e.path = undefined;
        e.pathGoal = undefined;
        e.lastOrder = state.tick;
        e.buildQueue = undefined;
        e.beforeFlee = undefined;
        e.fleeUntil = undefined;
        e.avoidTraffic = false;
        e.trafficWait = 0;
        e.followId = undefined;
        e.workSlot = undefined;
        e.waitingSince = undefined;
        e.progressAt = undefined;
        e.progressDistance = undefined;
        e.recoveryCount = 0;
      }
    }
  }
  if (c.type === 'gather' || c.type === 'attack') {
    const target = state.entities.find(
      (e) => e.id === c.targetId && (e.hp > 0 || (c.type === 'gather' && e.category === 'animal' && e.amount > 0)),
    );
    if (!target || !canSee(state, c.playerId, target)) return;
    for (const id of c.entityIds) {
      const e = owned(state, id, c.playerId);
      if (
        !e ||
        e.category !== 'unit' ||
        (c.type === 'gather' && e.kind !== 'worker') ||
        (c.type === 'attack' && target.owner === c.playerId && target.kind !== 'sheep')
      )
        continue;
      e.targetId = target.id;
      e.task = c.type;
      e.resourceTargetId = c.type === 'gather' ? target.id : undefined;
      e.resourceKind = target.kind;
      e.activeResource = resourceKind(target);
      e.resourceOrigin = {x: target.x, z: target.z};
      e.workSlot = undefined;
      e.waitingSince = undefined;
      e.path = undefined;
      e.pathGoal = undefined;
      e.lastOrder = state.tick;
      e.buildQueue = undefined;
      e.beforeFlee = undefined;
      e.fleeUntil = undefined;
      e.avoidTraffic = false;
      e.trafficWait = 0;
      e.attackAt = undefined;
      e.progressAt = undefined;
      e.progressDistance = undefined;
      e.recoveryCount = 0;
    }
  }
  if (c.type === 'stance')
    for (const id of c.entityIds) {
      const e = owned(state, id, c.playerId);
      if (e) {
        e.stance = c.stance;
        if (c.stance === 'stand-ground') {
          e.directive = undefined;
          e.orders = [];
          e.attackAt = undefined;
          e.task = 'idle';
          e.path = undefined;
          e.targetId = undefined;
        }
      }
    }
  if (c.type === 'train') {
    const b = owned(state, c.buildingId, c.playerId),
      d = unitById.get(c.unitId);
    if (
      !b ||
      b.progress < 10000 ||
      b.category !== 'building' ||
      !d ||
      d.age > p.age ||
      p.population + d.population > p.populationCap ||
      !buildingById.get(b.kind)?.production.includes(d.id) ||
      !canPay(p, d.cost)
    )
      return;
    pay(p, d.cost);
    b.queue.push({id: c.sequence, kind: d.id, remaining: d.trainTicks, total: d.trainTicks});
    p.population += d.population;
  }
  if (c.type === 'research') {
    const b = owned(state, c.buildingId, p.id),
      t = technologyById.get(c.technologyId);
    const reason =
      !b || b.category !== 'building' || b.progress < 10000
        ? 'Select a completed owned research building.'
        : !t || t.building !== b.kind
          ? 'This building cannot research that technology.'
          : t.age > p.age
            ? 'Advance to the required age first.'
            : p.researched.includes(t.id) ||
                state.entities.some(
                  (e) => e.owner === p.id && e.hp > 0 && e.queue.some((q) => q.kind === `research:${t.id}`),
                )
              ? 'Technology already completed or queued.'
              : t.prerequisites.some((id) => !p.researched.includes(id))
                ? 'Complete prerequisite research first.'
                : !canPay(p, t.cost)
                  ? 'Not enough resources.'
                  : undefined;
    if (reason || !b || !t) {
      event(state, reason ?? 'Invalid research.', 'rejected', p.id);
      return;
    }
    pay(p, t.cost);
    b.queue.push({id: c.sequence, kind: `research:${t.id}`, remaining: t.ticks, total: t.ticks});
    event(state, `${t.name} queued`, 'research', p.id);
  }
  if (c.type === 'cancel-production') {
    const b = owned(state, c.buildingId, p.id);
    const index = b?.queue.findIndex((q) => q.id === c.queueId) ?? -1;
    if (!b || index < 0) return;
    const q = b.queue[index],
      research = q.kind.startsWith('research:');
    const definition = research ? technologyById.get(q.kind.slice(9)) : unitById.get(q.kind);
    if (!definition) return;
    // Full refund before work begins; half thereafter, including a blocked exit.
    const refund = q.remaining === q.total && !q.progressRemainder ? 10000 : 5000;
    for (const kind of Object.keys(definition.cost) as ResourceKind[])
      p.resources[kind] += Math.trunc((definition.cost[kind] * refund) / 10000);
    if (!research) p.population = Math.max(0, p.population - (unitById.get(q.kind)?.population ?? 0));
    b.queue.splice(index, 1);
    event(state, `${productionName(q.kind)} cancelled; ${refund / 100}% refunded`, 'production-cancelled', p.id);
  }
  if (c.type === 'build') {
    const d = buildingById.get(c.buildingId);
    if (!d || d.age > p.age) {
      event(state, d ? `${d.name} requires age ${d.age}.` : 'Unknown building.', 'rejected', p.id);
      return;
    }
    const selectedBuilders = [...new Set(c.workerIds)]
      .sort((a, b) => a - b)
      .map((id) => owned(state, id, c.playerId))
      .filter((e): e is Entity => e?.kind === 'worker');
    const queueCount =
      d.id === 'wall' && c.endX !== undefined && c.endZ !== undefined ? wallSpans(c.x, c.z, c.endX, c.endZ).length : 1;
    if (c.queued && selectedBuilders.some((w) => (w.orders?.length ?? 0) + queueCount > 32)) {
      event(state, 'Builder order queue is full (32 orders). No blueprint or cost reserved.', 'rejected', p.id);
      return;
    }
    if (d.id === 'wall' && c.endX !== undefined && c.endZ !== undefined) {
      const start = snapWallEndpoint(state, c.x, c.z, p.id),
        end = snapWallEndpoint(state, c.endX, c.endZ, p.id);
      const spans = wallSpans(start.x, start.z, end.x, end.z);
      const cost = Object.fromEntries(Object.entries(d.cost).map(([k, n]) => [k, n * spans.length])) as Resources;
      const workers = selectedBuilders;
      const reason =
        wallPlacementReason(state, spans, p.id) ||
        (c.queued && workers.some((w) => (w.orders?.length ?? 0) + spans.length > 32)
          ? 'Builder order queue is full (32 orders).'
          : '');
      if (reason || !workers.length || !canPay(p, cost)) {
        event(state, reason || 'Not enough resources or no builders selected.', 'rejected', p.id);
        return;
      }
      pay(p, cost);
      const ids = spans.map((span) => {
        const b = building(state, p.id, 'wall', span.x, span.z, false);
        b.wallAxis = [span.dx, span.dz];
        return b.id;
      });
      for (const w of workers) {
        if (c.queued) {
          for (const targetId of ids)
            issueUnitOrders(state, {
              v: 1,
              tick: state.tick,
              playerId: p.id,
              sequence: c.sequence,
              type: 'resume-build',
              entityIds: [w.id],
              targetId,
              queued: true,
            });
          continue;
        }
        const current = state.entities.find((e) => e.id === w.targetId && e.kind === 'wall' && e.progress < 10000);
        if (w.task === 'build' && current) {
          w.buildQueue = [...(w.buildQueue ?? []), ...ids];
          continue;
        }
        startUnitOrder(state, w, {
          v: 1,
          tick: state.tick,
          playerId: p.id,
          sequence: c.sequence,
          type: 'resume-build',
          entityIds: [w.id],
          targetId: ids[0],
        });
        w.orders = [];
        w.targetId = ids[0];
        w.buildQueue = ids.slice(1);
        w.workSlot = undefined;
        w.path = undefined;
        w.pathGoal = undefined;
        w.waitingSince = undefined;
      }
      invalidateNavigation(state);
      event(state, `${ids.length} wall ${ids.length === 1 ? 'segment' : 'segments'} reserved.`, 'build', p.id);
      state.commandLog.push(structuredClone(c));
      return;
    }
    const reason = placementReason(state, c.buildingId, c.x, c.z, c.rotation);
    if (reason || !canPay(p, d.cost)) {
      if (c.playerId === 1) event(state, reason || 'Not enough resources.', 'rejected');
      return;
    }
    const workers = selectedBuilders;
    if (!workers.length) return;
    pay(p, d.cost);
    const b = building(state, c.playerId, d.id, c.x, c.z, false, c.rotation);
    issueUnitOrders(state, {
      v: 1,
      tick: state.tick,
      playerId: p.id,
      sequence: c.sequence,
      type: 'resume-build',
      entityIds: workers.map((w) => w.id),
      targetId: b.id,
      queued: c.queued,
    });
    event(state, `${d.name} blueprint reserved${c.queued ? ' and queued' : ''}.`, 'build', p.id);
  }
  if (c.type === 'cancel-construction') {
    const b = owned(state, c.buildingId, p.id);
    const d = b && buildingById.get(b.kind);
    if (!b || !d || b.category !== 'building' || b.progress === 10000 || b.tradeSite) {
      event(state, 'Select an owned unfinished structure to cancel.', 'rejected', p.id);
      return;
    }
    const refund = b.progress === 0 ? 10000 : 5000;
    for (const kind of Object.keys(d.cost) as ResourceKind[])
      p.resources[kind] += Math.trunc((d.cost[kind] * refund) / 10000);
    state.entities = state.entities.filter((e) => e.id !== b.id);
    for (const worker of state.entities.filter((e) => e.owner === p.id && e.kind === 'worker')) {
      worker.orders = worker.orders?.filter((q) => !('targetId' in q && q.targetId === b.id));
      worker.buildQueue = worker.buildQueue?.filter((id) => id !== b.id);
      if (worker.task === 'build' && worker.targetId === b.id) {
        worker.task = worker.buildQueue?.length ? 'build' : 'idle';
        worker.targetId = undefined;
        worker.path = undefined;
        worker.pathGoal = undefined;
        worker.workSlot = undefined;
        worker.working = false;
      }
    }
    invalidateNavigation(state);
    event(state, `${d.name} construction cancelled; ${refund / 100}% refunded.`, 'construction-cancelled', p.id);
  }
  if (c.type === 'convert-gate') {
    const b = owned(state, c.buildingId, p.id),
      d = buildingById.get('gate')!;
    const cost = gateConversionCost(),
      reason =
        gateConversionReason(b, p.id, p.age, state) ||
        (!canPay(p, cost) ? 'Not enough resources to convert this wall to a gate.' : '');
    if (reason || !b) {
      event(state, reason || 'Choose a completed wall segment.', 'rejected', p.id);
      return;
    }
    pay(p, cost);
    const health = b.hp / b.maxHp;
    b.kind = 'gate';
    b.model = d.model;
    b.maxHp = d.hp;
    b.hp = Math.max(1, Math.trunc(d.hp * health));
    invalidateNavigation(state);
    event(state, 'Gate opened for your units; enemy units remain blocked.', 'build', p.id);
  }
  if (c.type === 'rally') {
    for (const id of c.buildingIds) {
      const b = owned(state, id, c.playerId);
      if (b?.category === 'building') b.rally = {x: c.x, z: c.z, targetId: c.targetId};
    }
  }
  if (c.type === 'resume-build' || c.type === 'garrison') {
    const b = owned(state, c.targetId, c.playerId);
    if (b?.category === 'building') {
      for (const id of c.entityIds) {
        const e = owned(state, id, c.playerId);
        if (
          e?.kind === 'worker' &&
          (c.type === 'resume-build'
            ? b.progress < 10000 || b.hp < b.maxHp
            : b.progress === 10000 && garrisonCapacity(b.kind, p.age) > 0)
        ) {
          if (c.type === 'garrison')
            e.beforeGarrison = {task: e.task, targetId: e.targetId, resourceTargetId: e.resourceTargetId};
          e.task = c.type === 'resume-build' ? 'build' : 'garrison';
          e.targetId = b.id;
          e.path = undefined;
          e.pathGoal = undefined;
        }
      }
    }
  }
  if (c.type === 'ungarrison') {
    const b = owned(state, c.buildingId, c.playerId);
    if (b)
      for (const [index, e] of state.entities.filter((e) => e.garrisonedIn === b.id).entries()) {
        e.garrisonedIn = undefined;
        e.task = 'move';
        const exits = SLOT_DIRECTIONS.map(([dx, dz]) => ({
          x: b.x + Math.trunc((dx * (approachRange(b) + 400 + Math.floor(index / 8) * 300)) / 1024),
          z: b.z + Math.trunc((dz * (approachRange(b) + 400 + Math.floor(index / 8) * 300)) / 1024),
        })).filter((p) => !blocked(state, p.x, p.z));
        const exit = exits[index % exits.length];
        if (!exit) {
          e.garrisonedIn = b.id;
          continue;
        }
        e.x = exit.x;
        e.z = exit.z;
        e.destX = b.rally?.x ?? b.x + ((e.id % 5) - 2) * 400;
        e.destZ = b.rally?.z ?? e.z + 900;
        e.path = undefined;
        e.pathGoal = undefined;
        if (c.returnToWork && e.beforeGarrison) {
          Object.assign(e, e.beforeGarrison);
          if (
            e.beforeGarrison.task === 'gather' &&
            !state.entities.some((t) => t.id === e.targetId && (t.amount > 0 || t.kind === 'farm'))
          )
            continueGather(state, e);
        }
        e.beforeGarrison = undefined;
      }
  }
  if (c.type === 'advance') {
    const next = p.age + 1;
    const choice = councilChoices.find((x) => x.id === c.councilId && x.age === next);
    const advancement = advancements.find((x) => x.age === next);
    const hall = state.entities.find((e) => e.owner === p.id && e.kind === 'hall' && e.hp > 0 && e.progress === 10000);
    if (!choice || !advancement || !hall || p.advancing || !canPay(p, advancement.cost)) {
      event(
        state,
        'Cannot advance: a completed hall, legal council choice and resources are required.',
        'rejected',
        p.id,
      );
      return;
    }
    pay(p, advancement.cost);
    p.advancing = {councilId: choice.id, remaining: advancement.ticks, total: advancement.ticks};
    event(state, 'Age advancement started — 30 seconds.', 'age', p.id);
  }
  if (c.type === 'dispatch') {
    const d = dispatches.find((x) => x.id === c.dispatchId);
    if (
      !d ||
      d.age > p.age ||
      p.tokens < d.tokenCost ||
      p.usedDispatches.includes(d.id) ||
      p.pendingDispatches.some((q) => q.id === d.id)
    ) {
      event(state, 'Cannot send Dispatch: check age, tokens, and once-only availability.', 'rejected', p.id);
      return;
    }
    p.tokens -= d.tokenCost;
    p.pendingDispatches.push({
      id: d.id,
      departureTick: state.tick + d.departureTicks,
      arrivalTick: state.tick + d.arrivalTicks,
    });
    event(state, `${d.name} queued — departing in ${d.departureTicks / 20}s.`, 'dispatch-queued', p.id);
  }
  if (c.type === 'cancel-dispatch') {
    const index = p.pendingDispatches.findIndex((q) => q.id === c.dispatchId);
    const pending = p.pendingDispatches[index];
    if (!pending || state.tick >= pending.departureTick) {
      event(state, 'Cannot cancel a departed Dispatch.', 'rejected', p.id);
      return;
    }
    const card = dispatches.find((d) => d.id === pending.id)!;
    p.tokens += card.tokenCost;
    p.pendingDispatches.splice(index, 1);
    event(state, `${card.name} canceled; tokens refunded.`, 'dispatch-canceled', p.id);
  }
  if (!internal) state.commandLog.push(structuredClone(c));
}
function moveToward(state: MatchState, e: Entity, x: number, z: number) {
  const distance = Math.max(Math.abs(x - e.x), Math.abs(z - e.z));
  if (e.progressAt === undefined || state.tick - e.progressAt >= 20) {
    const moved =
      e.progressX === undefined || e.progressZ === undefined
        ? Infinity
        : Math.max(Math.abs(e.x - e.progressX), Math.abs(e.z - e.progressZ));
    if (moved < 64) {
      e.path = undefined;
      e.pathGoal = undefined;
      e.avoidTraffic = true;
      e.recoveryCount = (e.recoveryCount ?? 0) + 1;
    } else e.recoveryCount = 0;
    e.progressAt = state.tick;
    e.progressDistance = distance;
    e.progressX = e.x;
    e.progressZ = e.z;
  }
  const key = `${Math.floor(x / 512)},${Math.floor(z / 512)}`;
  if (e.pathGoal !== key || !e.path || (!e.path.length && state.tick % 10 === e.id % 10)) {
    const path = requestPath(state, e, x, z);
    if (path !== undefined) {
      e.path = path;
      e.pathGoal = key;
      if (path.length) e.avoidTraffic = false;
    }
  }
  const point = e.path?.[0];
  if (!point) {
    e.moving = false;
    return;
  }
  const dx = point[0] - e.x,
    dz = point[1] - e.z,
    m = Math.max(Math.abs(dx), Math.abs(dz), 1),
    speed = Math.min(e.speed, m),
    nx = e.x + Math.trunc((dx * speed) / m),
    nz = e.z + Math.trunc((dz * speed) / m);
  if (blocked(state, nx, nz, e.owner) && !blocked(state, e.x, e.z, e.owner)) {
    const corner = [
      [e.x + Math.trunc((dx * speed) / m), e.z],
      [e.x, e.z + Math.trunc((dz * speed) / m)],
    ]
      .filter(([sx, sz]) => !blocked(state, sx, sz, e.owner))
      .sort(
        (a, b) =>
          Math.max(Math.abs(point[0] - a[0]), Math.abs(point[1] - a[1])) -
          Math.max(Math.abs(point[0] - b[0]), Math.abs(point[1] - b[1])),
      )[0];
    if (corner) {
      [e.x, e.z] = corner;
      e.moving = true;
      return;
    }
    e.path = undefined;
    return;
  }
  if (occupied(state, e, nx, nz)) {
    e.trafficWait = (e.trafficWait ?? 0) + 1;
    if (e.trafficWait >= 8) {
      e.avoidTraffic = true;
      e.path = undefined;
      e.trafficWait = 0;
    }
    // Sample deterministic steering headings instead of switching between two
    // perpendicular points.  This lets a unit walk around a stationary crowd
    // or a building corner without the left/right oscillation that used to
    // strand workers between jobs.
    const headings = [
      [1024, 0],
      [946, 392],
      [724, 724],
      [392, 946],
      [0, 1024],
      [-392, 946],
      [-724, 724],
      [-946, 392],
      [-1024, 0],
      [-946, -392],
      [-724, -724],
      [-392, -946],
      [0, -1024],
      [392, -946],
      [724, -724],
      [946, -392],
    ] as const;
    const currentClearance = trafficClearance(state, e, e.x, e.z);
    const candidates = headings
      .map(([hx, hz], order) => {
        const sx = e.x + Math.trunc((hx * speed) / 1024),
          sz = e.z + Math.trunc((hz * speed) / 1024),
          clearance = trafficClearance(state, e, sx, sz);
        return {sx, sz, clearance, distance: Math.max(Math.abs(point[0] - sx), Math.abs(point[1] - sz)), order};
      })
      .filter((c) => !blocked(state, c.sx, c.sz, e.owner) && (c.clearance >= 128 || c.clearance > currentClearance + 8))
      .sort(
        (a, b) =>
          a.distance - b.distance || b.clearance - a.clearance || ((a.order + e.id) % 16) - ((b.order + e.id) % 16),
      );
    const steer = candidates[0];
    if (steer) {
      e.x = steer.sx;
      e.z = steer.sz;
      e.moving = true;
      return;
    }
    e.moving = false;
    return;
  }
  e.x = nx;
  e.z = nz;
  e.trafficWait = 0;
  e.moving = true;
  if (m <= e.speed) e.path?.shift();
}
function homeFor(state: MatchState, e: Entity) {
  return state.entities
    .filter(
      (x) =>
        x.owner === e.owner &&
        x.category === 'building' &&
        x.hp > 0 &&
        x.progress === 10000 &&
        ['hall', 'lumberPost', 'miningPost', 'silo'].includes(x.kind),
    )
    .sort((a, b) => edgeDistance(e, a) - edgeDistance(e, b) || a.id - b.id)[0];
}
function depositCargo(state: MatchState, e: Entity) {
  const p = state.players[e.owner - 1];
  if (!p) return;
  for (const k of ['provisions', 'timber', 'coin', 'metal'] as ResourceKind[]) {
    const n = e.carry[k] ?? 0;
    p.resources[k] += n;
    p.stats.gathered[k] += n;
    delete e.carry[k];
  }
}
function resourceKind(e: Entity): ResourceKind {
  return e.kind === 'timber' ? 'timber' : e.kind === 'coin' ? 'coin' : e.kind === 'metal' ? 'metal' : 'provisions';
}
function continueGather(state: MatchState, e: Entity) {
  e.workSlot = undefined;
  const origin = e.resourceOrigin ?? e;
  const next = state.entities
    .filter(
      (t) =>
        t.kind === e.resourceKind &&
        t.amount > 0 &&
        dist(origin, t) < 16 * 256 &&
        canSee(state, e.owner as PlayerId, t) &&
        Array.from({length: t.kind === 'farm' ? 2 : 8}, (_, i) =>
          perimeterPoint(t, t.kind === 'farm' ? i * 4 : i, t.category === 'building' ? 125 : 165),
        ).some((p) => !blocked(state, p.x, p.z, e.owner)),
    )
    .sort((a, b) => edgeDistance(e, a) - edgeDistance(e, b) || a.id - b.id)[0];
  if (next) {
    e.targetId = next.id;
    e.resourceTargetId = next.id;
    e.task = 'gather';
    e.path = undefined;
    e.pathGoal = undefined;
    e.waitingSince = undefined;
    e.progressAt = undefined;
    e.progressDistance = undefined;
    e.recoveryCount = 0;
  } else {
    e.task = 'idle';
    event(state, 'No matching resources remain nearby.', 'gather', e.owner as PlayerId);
  }
}
const SLOT_DIRECTIONS = [
  [1024, 0],
  [724, 724],
  [0, 1024],
  [-724, 724],
  [-1024, 0],
  [-724, -724],
  [0, -1024],
  [724, -724],
];
function nearestPerimeter(state: MatchState, e: Entity, target: Entity, gap = 120) {
  return Array.from({length: 8}, (_, slot) => perimeterPoint(target, slot, gap))
    .filter((p) => !blocked(state, p.x, p.z, e.owner))
    .sort(
      (a, b) =>
        Number(occupied(state, e, a.x, a.z)) - Number(occupied(state, e, b.x, b.z)) ||
        dist(e, a) - dist(e, b) ||
        a.z - b.z ||
        a.x - b.x,
    )[0];
}
function approachWork(state: MatchState, e: Entity, target: Entity) {
  const peers = state.entities.filter(
    (t) =>
      t.id !== e.id &&
      t.hp > 0 &&
      ((t.targetId === target.id && (t.task === 'gather' || t.task === 'build')) ||
        (target.kind === 'farm' && t.task === 'carry' && t.resourceTargetId === target.id)),
  );
  const capacity = target.kind === 'farm' ? 2 : 8;
  const radius = target.category === 'building' ? 125 : 165;
  const point = (slot: number) => {
    return perimeterPoint(target, target.kind === 'farm' ? slot * 4 : slot, radius);
  };
  if (e.workSlot === undefined || peers.some((t) => t.workSlot === e.workSlot && t.id < e.id)) {
    e.workSlot = Array.from({length: capacity}, (_, i) => i)
      .filter(
        (i) =>
          !peers.some((t) => t.workSlot === i) &&
          !blocked(state, point(i).x, point(i).z, e.owner) &&
          !occupied(state, e, point(i).x, point(i).z),
      )
      .sort((a, b) => dist(e, point(a)) - dist(e, point(b)) || a - b)[0];
    e.path = undefined;
    e.pathGoal = undefined;
  }
  if (e.workSlot === undefined) {
    e.waitingSince ??= state.tick;
    if (state.tick - e.waitingSince > 120) {
      e.task = 'idle';
      event(state, 'Work site is full or unreachable. Choose another site.', 'rejected', e.owner as PlayerId);
    }
    return false;
  }
  const p = point(e.workSlot);
  if (Math.max(Math.abs(e.x - p.x), Math.abs(e.z - p.z)) > 65) {
    moveToward(state, e, p.x, p.z);
    if (e.moving) e.waitingSince = undefined;
    if (!e.moving) {
      e.waitingSince ??= state.tick;
      if (state.tick - e.waitingSince > 120) {
        e.workSlot = undefined;
        e.task = 'idle';
        event(state, 'Cannot reach this work site.', 'rejected', e.owner as PlayerId);
      }
    }
    return false;
  }
  e.waitingSince = undefined;
  return true;
}
const traffic = new WeakMap<MatchState, Map<string, Entity[]>>();
function prepareTraffic(state: MatchState) {
  const bins = new Map<string, Entity[]>();
  for (const e of state.entities)
    if (e.hp > 0 && !e.garrisonedIn && (e.category === 'unit' || e.category === 'animal')) {
      const k = Math.floor(e.x / 512) + ',' + Math.floor(e.z / 512),
        list = bins.get(k) ?? [];
      list.push(e);
      bins.set(k, list);
    }
  traffic.set(state, bins);
}
function occupied(state: MatchState, e: Entity, x: number, z: number) {
  // A formation follows one static route and resolves separation at its
  // reserved slots. Treating every squad mate as a hard obstacle while the
  // group is in transit creates reciprocal deadlocks at narrow passages.
  if (
    e.task === 'move' &&
    e.destX !== undefined &&
    e.destZ !== undefined &&
    Math.max(Math.abs(e.destX - e.x), Math.abs(e.destZ - e.z)) > 256
  )
    return false;
  const bins = traffic.get(state);
  if (!bins) return false;
  for (let dz = -1; dz <= 1; dz++)
    for (let dx = -1; dx <= 1; dx++)
      for (const other of bins.get(Math.floor(x / 512) + dx + ',' + (Math.floor(z / 512) + dz)) ?? []) {
        if (other.id === e.id || other.garrisonedIn || other.hp <= 0) continue;
        if (other.owner === e.owner && other.moving && !other.working && !e.working) continue;
        const d = Math.max(Math.abs(x - other.x), Math.abs(z - other.z)),
          old = Math.max(Math.abs(e.x - other.x), Math.abs(e.z - other.z));
        // Units are soft traffic, not navigation blockers.  Keep only a small
        // personal-space core here: work/formation slots provide the wider
        // separation at destinations, while this lets a column flow through a
        // dense starting cluster instead of mutually sealing every exit.
        if (d < 128 && d < old) return true;
      }
  return false;
}
function trafficClearance(state: MatchState, e: Entity, x: number, z: number) {
  const bins = traffic.get(state);
  if (!bins) return 4096;
  let clearance = 4096;
  for (let dz = -1; dz <= 1; dz++)
    for (let dx = -1; dx <= 1; dx++)
      for (const other of bins.get(Math.floor(x / 512) + dx + ',' + (Math.floor(z / 512) + dz)) ?? [])
        if (other.id !== e.id && !other.garrisonedIn && other.hp > 0)
          clearance = Math.min(clearance, Math.max(Math.abs(x - other.x), Math.abs(z - other.z)));
  return clearance;
}
type EconomyView = Pick<MatchState, 'tick' | 'entities' | 'players'>;
const economyStructures = new WeakMap<EconomyView, {tick: number; count: number; buildings: Entity[]}>();
function economyBuildings(state: EconomyView) {
  let cached = economyStructures.get(state);
  if (!cached || cached.tick !== state.tick || cached.count !== state.entities.length) {
    cached = {
      tick: state.tick,
      count: state.entities.length,
      buildings: state.entities.filter((e) => ['market', 'tradePost'].includes(e.kind)),
    };
    economyStructures.set(state, cached);
  }
  return cached.buildings;
}
export function marketAreaRate(state: EconomyView, owner: PlayerId, point: {x: number; z: number}) {
  return economyBuildings(state).some(
    (e) =>
      e.owner === owner &&
      e.kind === 'market' &&
      e.hp > 0 &&
      e.progress === 10000 &&
      dist(e, point) <= frontierRules.marketRadius,
  )
    ? frontierRules.marketRate
    : 10000;
}
export function sitePayout(state: EconomyView, site: Entity) {
  const p = state.players[site.owner - 1];
  if (!p) return 0;
  const depot = economyBuildings(state).some(
    (e) =>
      e.owner === p.id &&
      e.kind === 'tradePost' &&
      !e.tradeSite &&
      e.hp > 0 &&
      e.progress === 10000 &&
      dist(e, site) <= frontierRules.marketRadius,
  )
    ? frontierRules.depotRate
    : 10000;
  return Math.trunc(
    (frontierRules.siteIncome *
      (councilRate(p.modifiers, 'market') + marketAreaRate(state, p.id, site) + depot - 20000)) /
      10000,
  );
}
function recoverExplorer(state: MatchState, e: Entity) {
  e.incapacitatedAt = undefined;
  e.recoveryProgress = undefined;
  e.deathTick = undefined;
  e.hp = Math.max(1, Math.trunc(e.maxHp / 2));
  e.task = 'idle';
  e.targetId = undefined;
  e.path = undefined;
  e.pathGoal = undefined;
  e.attackAt = undefined;
  e.cooldown = 40;
  e.interactionProgress = 0;
  event(state, 'Explorer recovered at half health.', 'explorer-recovered', e.owner as PlayerId);
}
function updateFrontier(state: MatchState) {
  for (const site of state.entities.filter((e) => e.tradeSite && e.hp > 0).sort((a, b) => a.id - b.id)) {
    const nearby = state.entities.filter(
      (e) =>
        e.category === 'unit' &&
        e.hp > 0 &&
        !e.garrisonedIn &&
        e.owner > 0 &&
        edgeDistance(e, site) <= frontierRules.siteRadius,
    );
    const owners = [...new Set(nearby.map((e) => e.owner))];
    site.captureContested = owners.length > 1;
    const claimants = nearby.filter(
      (e) => e.task === 'claim' && e.targetId === site.id && e.working && e.owner !== site.owner,
    );
    if (!site.captureContested && claimants.length) {
      const owner = claimants[0].owner as PlayerId;
      if (site.captureOwner !== owner) {
        site.captureOwner = owner;
        site.captureProgress = 0;
      }
      site.captureProgress = (site.captureProgress ?? 0) + Math.min(3, claimants.length);
      if (site.captureProgress >= frontierRules.siteCaptureTicks) {
        site.owner = owner;
        site.captureProgress = 0;
        site.captureOwner = undefined;
        site.incomeProgress = 0;
        state.players[owner - 1].stats.sitesCaptured++;
        event(state, 'Trade site secured. Choose its income in the selection panel.', 'site-captured', owner);
      }
    } else if (!claimants.length && !site.captureContested) {
      site.captureProgress = Math.max(0, (site.captureProgress ?? 0) - 1);
      if (!site.captureProgress) site.captureOwner = undefined;
    }
    if (site.owner && !site.captureContested && !(site.captureProgress ?? 0)) {
      site.incomeProgress = (site.incomeProgress ?? 0) + 1;
      if (site.incomeProgress >= frontierRules.siteIncomeTicks) {
        const p = state.players[site.owner - 1],
          kind = site.siteIncome ?? 'coin',
          amount = sitePayout(state, site);
        p.resources[kind] += amount;
        p.stats.tradeIncome[kind] += amount;
        site.incomeProgress = 0;
        event(state, `Trade route delivered ${amount / 100} ${kind}.`, 'trade', p.id);
      }
    }
  }
  for (const e of state.entities.filter((e) => e.incapacitatedAt !== undefined)) {
    const safe = state.entities.some(
      (b) =>
        b.owner === e.owner &&
        ['hall', 'fort'].includes(b.kind) &&
        b.hp > 0 &&
        b.progress === 10000 &&
        dist(e, b) <= 20 * 256,
    );
    const threatened = state.entities.some(
      (t) =>
        t.hp > 0 &&
        t.owner !== e.owner &&
        (t.owner > 0 || t.guardOf !== undefined) &&
        t.category === 'unit' &&
        dist(e, t) <= 10 * 256,
    );
    if (safe && !threatened) {
      e.recoveryProgress = (e.recoveryProgress ?? 0) + 1;
      if (e.recoveryProgress >= frontierRules.safeRecoveryTicks) recoverExplorer(state, e);
    } else e.recoveryProgress = 0;
  }
}
function updateUnit(state: MatchState, e: Entity) {
  if (e.hp <= 0 || e.garrisonedIn) return;
  e.moving = false;
  e.working = false;
  if (e.cooldown > 0) e.cooldown--;
  const p = e.owner ? state.players[e.owner - 1] : undefined;
  if (e.guardOf !== undefined) {
    const chest = state.entities.find((t) => t.id === e.guardOf && t.hp > 0);
    const enemy =
      chest &&
      nearest(
        state,
        e,
        (t) => t.owner > 0 && t.hp > 0 && t.category === 'unit' && !t.garrisonedIn && dist(t, chest) <= 8 * 256,
      );
    if (enemy) {
      if (e.targetId !== enemy.id) {
        e.attackAt = undefined;
        e.path = undefined;
      }
      e.task = 'attack';
      e.targetId = enemy.id;
    } else if (chest && dist(e, chest) > 1600) {
      e.task = 'move';
      e.destX = chest.x + (e.id % 2 ? 800 : -800);
      e.destZ = chest.z + 600;
    } else {
      e.task = 'idle';
      e.attackAt = undefined;
    }
  }
  if (e.task === 'idle' && e.treasureTargetId !== undefined) {
    e.task = 'collect';
    e.targetId = e.treasureTargetId;
  }
  if (e.task === 'collect' || e.task === 'claim' || e.task === 'revive') {
    const target = state.entities.find((t) => t.id === e.targetId && (t.hp > 0 || t.incapacitatedAt !== undefined));
    if (!target || (e.owner && !canSee(state, e.owner as PlayerId, target))) {
      e.task = 'idle';
      e.treasureTargetId = undefined;
      e.targetId = undefined;
      event(state, 'Interaction target is no longer available.', 'rejected', e.owner as PlayerId);
      return;
    }
    if (e.task === 'claim' && target.owner === e.owner) {
      e.task = 'idle';
      e.targetId = undefined;
      return;
    }
    if (e.task === 'revive' && target.incapacitatedAt === undefined) {
      e.task = 'idle';
      e.targetId = undefined;
      return;
    }
    if (e.task === 'collect') {
      const guard = nearest(state, e, (t) => t.guardOf === target.id && t.hp > 0);
      if (guard) {
        e.task = 'attack';
        e.targetId = guard.id;
        e.path = undefined;
        return;
      }
    }
    const point = perimeterPoint(target, e.id % 8, 180);
    if (edgeDistance(e, target) > 300) {
      moveToward(state, e, point.x, point.z);
      return;
    }
    e.working = true;
    if (e.task === 'claim') return;
    e.interactionProgress = (e.interactionProgress ?? 0) + 1;
    if (e.task === 'revive' && e.interactionProgress >= frontierRules.reviveTicks) {
      recoverExplorer(state, target);
      e.task = 'idle';
      e.targetId = undefined;
      e.interactionProgress = 0;
    } else if (e.task === 'collect' && e.interactionProgress >= frontierRules.treasureWorkTicks && p) {
      const definition = treasureById.get(target.treasureId ?? '');
      if (definition && target.amount > 0) {
        for (const kind of Object.keys(definition.reward) as ResourceKind[])
          p.resources[kind] += definition.reward[kind];
        p.renown += definition.renown;
        p.stats.treasures++;
        target.amount = 0;
        target.hp = 0;
        target.deathTick = state.tick;
        event(
          state,
          `${definition.name} recovered: resources and ${definition.renown / 1000} Renown.`,
          'treasure',
          p.id,
        );
      }
      e.task = 'idle';
      e.targetId = undefined;
      e.treasureTargetId = undefined;
      e.interactionProgress = 0;
    }
    return;
  }

  if (e.kind === 'worker' && e.beforeFlee && state.tick >= (e.fleeUntil ?? 0)) {
    const threat = state.entities.some(
      (t) =>
        t.hp > 0 &&
        (t.owner > 0 || t.guardOf !== undefined) &&
        t.owner !== e.owner &&
        t.damage > 0 &&
        dist(e, t) < 8 * 256 &&
        canSee(state, e.owner as PlayerId, t),
    );
    if (!threat) {
      Object.assign(e, e.beforeFlee);
      e.beforeFlee = undefined;
      e.fleeUntil = undefined;
      e.path = undefined;
      e.pathGoal = undefined;
      e.workSlot = undefined;
      e.waitingSince = undefined;
    }
  }
  if (e.task === 'idle' && e.beforeFlee) return;
  updateDirective(state, e);
  if (e.task === 'idle' && !e.directive && e.orders?.length) {
    // One activation per tick bounds work even when several targets have disappeared.
    const next = e.orders.shift()! as UnitCommand;
    const reason = orderReason(state, e, next);
    if (reason) event(state, `Queued order skipped: ${reason}`, 'rejected', e.owner as PlayerId);
    else startUnitOrder(state, e, next);
  }
  if (e.task === 'idle' && !e.directive && e.kind === 'medic' && e.owner) {
    const target = nearest(
      state,
      e,
      (t) =>
        t.owner === e.owner &&
        t.category === 'unit' &&
        t.hp < t.maxHp &&
        !t.garrisonedIn &&
        !unitById.get(t.kind)?.tags.some((tag) => ['artillery', 'siege'].includes(tag)) &&
        dist(e, t) <= 8 * WORLD_SCALE,
    );
    if (target) {
      e.task = 'heal';
      e.targetId = target.id;
    }
  }
  if (e.task === 'heal') {
    const target = state.entities.find(
      (t) => t.id === e.targetId && t.hp > 0 && t.owner === e.owner && !t.garrisonedIn,
    );
    const ability = supportByUnit.get(e.kind);
    if (!target || !ability || target.hp >= target.maxHp || !canSee(state, e.owner as PlayerId, target)) {
      e.task = 'idle';
      e.targetId = undefined;
      return;
    }
    if (dist(e, target) > ability.range) {
      const point = combatPoint(target, e);
      moveToward(state, e, point.x, point.z);
      return;
    }
    e.working = true;
    if (!e.cooldown) {
      target.hp = Math.min(target.maxHp, target.hp + ability.amount);
      e.cooldown = ability.cooldown;
      event(state, 'Friendly unit healed.', 'heal', e.owner as PlayerId);
    }
    return;
  }
  if (e.kind === 'worker' && e.task === 'idle' && p) p.stats.idleWorkerTicks++;
  if (
    e.task === 'idle' &&
    e.owner &&
    e.category === 'unit' &&
    e.kind !== 'worker' &&
    e.kind !== 'medic' &&
    !e.directive &&
    e.stance !== 'no-attack'
  ) {
    const enemy = nearest(
      state,
      e,
      (t) =>
        (t.owner !== 0 || t.guardOf !== undefined) &&
        t.owner !== e.owner &&
        t.category === 'unit' &&
        canSee(state, e.owner as PlayerId, t) &&
        dist(e, t) < 8 * WORLD_SCALE,
    );
    if (enemy) {
      e.task = 'attack';
      e.targetId = enemy.id;
    }
  }

  if (e.task === 'garrison') {
    const b = state.entities.find((x) => x.id === e.targetId && x.hp > 0 && x.progress === 10000);
    if (!b || !p) {
      e.task = 'idle';
      return;
    }
    const entry = nearestPerimeter(state, e, b);
    if (!entry) {
      e.task = 'idle';
      event(state, 'No accessible garrison entrance.', 'rejected', p.id);
      return;
    }
    if (Math.max(Math.abs(e.x - entry.x), Math.abs(e.z - entry.z)) > 70) {
      moveToward(state, e, entry.x, entry.z);
      return;
    }
    if (state.entities.filter((x) => x.garrisonedIn === b.id).length < garrisonCapacity(b.kind, p.age)) {
      if (b.kind === 'hall') depositCargo(state, e);
      e.garrisonedIn = b.id;
      e.task = 'idle';
      e.x = b.x;
      e.z = b.z;
    } else {
      e.task = 'idle';
      event(state, 'Garrison is full.', 'rejected', p.id);
    }
    return;
  }
  if (e.task === 'move') {
    if ((e.recoveryCount ?? 0) >= 10) {
      e.task = 'idle';
      e.directive = undefined;
      e.targetId = undefined;
      e.path = undefined;
      e.attackAt = undefined;
      e.recoveryCount = 0;
      event(
        state,
        'Movement failed after repeated recovery attempts. Choose another destination.',
        'rejected',
        e.owner as PlayerId,
      );
      return;
    }
    let x = e.destX ?? e.x,
      z = e.destZ ?? e.z;
    if (blocked(state, x, z, e.owner)) {
      const repaired = nearestPassable(state, x, z, e.owner);
      if (!repaired) {
        e.task = 'idle';
        event(state, 'No reachable destination near that point.', 'rejected', e.owner as PlayerId);
        return;
      }
      [x, z] = repaired;
      e.destX = x;
      e.destZ = z;
      e.path = undefined;
      e.pathGoal = undefined;
    }
    if (dist(e, {x, z}) <= Math.max(e.speed, 180) && !blocked(state, x, z, e.owner) && !occupied(state, e, x, z)) {
      e.x = x;
      e.z = z;
      e.destX = undefined;
      e.destZ = undefined;
      e.task = 'idle';
      e.recoveryCount = 0;
      e.progressAt = undefined;
      e.progressDistance = undefined;
      e.progressX = undefined;
      e.progressZ = undefined;
    } else moveToward(state, e, x, z);
    return;
  }
  if (e.task === 'build') {
    const b = state.entities.find((x) => x.id === e.targetId && x.hp > 0);
    if (!b || b.hp >= b.maxHp) {
      const next = e.buildQueue?.find((id) =>
        state.entities.some((b) => b.id === id && b.hp > 0 && b.progress < 10000),
      );
      if (next) {
        e.targetId = next;
        e.buildQueue = e.buildQueue!.filter((id) => id !== next);
        e.workSlot = undefined;
        e.path = undefined;
        e.waitingSince = undefined;
        return;
      }
      e.task = 'idle';
      return;
    }
    if (!approachWork(state, e, b)) return;
    e.working = true;
    const d = buildingById.get(b.kind)!;
    const buildMultiplier = councilRate(p?.modifiers ?? [], 'construction') / 10000;
    if (b.progress < 10000) {
      b.progress = Math.min(10000, b.progress + buildMultiplier * Math.max(8, Math.trunc(10000 / d.buildTicks)));
      b.hp = Math.max(1, Math.trunc((b.maxHp * b.progress) / 10000));
    } else {
      b.hp = Math.min(b.maxHp, b.hp + buildMultiplier * Math.max(8, Math.trunc(b.maxHp / d.buildTicks)));
    }
    if (b.progress === 10000 && b.hp >= b.maxHp) {
      b.task = 'idle';
      if (d.population) p!.populationCap = Math.min(state.config.populationCap, p!.populationCap + d.population);
      event(state, `${d.name} completed`, 'build', e.owner as PlayerId);
      if (!e.buildQueue?.length) e.task = 'idle';
    }
    return;
  }
  if (e.task === 'gather') {
    const target = state.entities.find(
      (x) =>
        x.id === e.targetId &&
        (x.amount > 0 || (x.kind === 'farm' && x.progress === 10000 && x.owner === e.owner)) &&
        (x.hp > 0 || x.category === 'animal'),
    );
    if (!target) {
      continueGather(state, e);
      return;
    }
    if (target.category === 'animal' && target.hp > 0) {
      if (dist(e, target) > 6 * WORLD_SCALE) {
        moveToward(state, e, target.x, target.z);
        return;
      }
      e.working = true;
      if (e.cooldown === 0) {
        e.cooldown = 40;
        launchProjectile(state, e, target, 20, 10);
      }
      return;
    }
    if (!approachWork(state, e, target)) return;
    e.working = true;
    const gatherProgress =
      (e.gatherRemainder ?? 0) +
      12 * (councilRate(p?.modifiers ?? [], 'gather') + (p ? marketAreaRate(state, p.id, e) : 10000) - 10000);
    e.gatherRemainder = gatherProgress % 10000;
    const kind = resourceKind(target),
      rate = Math.trunc(gatherProgress / 10000),
      capacity = Math.trunc((1000 * councilRate(p?.modifiers ?? [], 'carry')) / 10000),
      take = Math.max(
        0,
        Math.min(rate, capacity - (e.carry[kind] ?? 0), target.kind === 'farm' ? rate : target.amount),
      );
    e.activeResource = kind;
    target.lastWorked = state.tick;
    if (target.kind !== 'farm') target.amount -= take;
    e.carry[kind] = (e.carry[kind] ?? 0) + take;
    if ((e.carry[kind] ?? 0) >= capacity || (target.kind !== 'farm' && target.amount <= 0)) {
      e.task = 'carry';
      e.resourceTargetId = target.id;
      const h = homeFor(state, e);
      e.homeId = h?.id;
      e.targetId = h?.id;
    }
    return;
  }
  if (e.task === 'carry') {
    const h = state.entities.find((x) => x.id === e.homeId && x.hp > 0);
    if (!h) {
      e.task = 'idle';
      return;
    }
    if (edgeDistance(e, h) > 200) {
      const drop = nearestPerimeter(state, e, h);
      if (drop) moveToward(state, e, drop.x, drop.z);
      // Temporary congestion is not a failed harvesting order.
      return;
    }
    depositCargo(state, e);
    const r = state.entities.find((x) => x.id === e.resourceTargetId && (x.amount > 0 || x.kind === 'farm'));
    if (r) {
      e.targetId = r.id;
      e.task = 'gather';
    } else continueGather(state, e);
    return;
  }
  if (e.task === 'attack') {
    const target = state.entities.find((x) => x.id === e.targetId && x.hp > 0 && !x.garrisonedIn);
    if (!target) {
      e.task = 'idle';
      return;
    }
    if (e.owner && !canSee(state, e.owner as PlayerId, target)) {
      e.task = e.lastTargetPosition ? 'move' : 'idle';
      e.destX = e.lastTargetPosition?.x;
      e.destZ = e.lastTargetPosition?.z;
      e.targetId = undefined;
      e.attackAt = undefined;
      e.path = undefined;
      return;
    }
    e.lastTargetPosition = {x: target.x, z: target.z};
    const range = Math.max(e.range, 280),
      targetDistance = ['building', 'resource'].includes(target.category) ? edgeDistance(e, target) : dist(e, target);
    if (targetDistance > range) {
      e.attackAt = undefined;
      const approach = combatPoint(target, e);
      if (e.stance === 'stand-ground') {
        e.task = 'idle';
        return;
      }
      moveToward(state, e, approach.x, approach.z);
      return;
    }
    e.working = true;
    if (e.cooldown === 0 && !e.attackAt) {
      e.attackStart = state.tick;
      e.attackAt = state.tick + 8;
    }
    if (e.attackAt && state.tick >= e.attackAt) {
      e.attackAt = undefined;
      e.cooldown = unitById.get(e.kind)?.cooldown ?? 35;
      if (e.range > 0) {
        launchProjectile(state, e, target, e.damage, Math.max(4, Math.trunc(targetDistance / 220)));
      } else damage(state, e, target, e.damage);
    }
  }
}
export function evaluatedAttackDamage(
  state: Pick<MatchState, 'players'>,
  source: Entity | undefined,
  amount: number,
  target?: Entity,
) {
  const attacker = source?.owner ? state.players[source.owner - 1] : undefined;
  const defender = target?.owner ? state.players[target.owner - 1] : undefined;
  if (source?.category === 'unit' && source.kind !== 'worker' && attacker) {
    const artillery = unitById.get(source.kind)?.tags.includes('artillery');
    amount = Math.max(1, Math.trunc((amount * councilRate(attacker.modifiers, 'military')) / 10000));
    if (artillery) amount = Math.max(1, Math.trunc((amount * councilRate(attacker.modifiers, 'artillery')) / 10000));
  }
  if (target?.category === 'building' && defender)
    amount = Math.max(1, Math.trunc((amount * councilRate(defender.modifiers, 'buildingDamage')) / 10000));
  return amount;
}
function damage(state: MatchState, source: Entity | undefined, target: Entity, amount: number) {
  amount = evaluatedAttackDamage(state, source, amount, target);
  target.hp = Math.max(0, target.hp - amount);
  if (
    target.hp > 0 &&
    target.kind === 'worker' &&
    source &&
    source.owner !== target.owner &&
    target.stance !== 'aggressive' &&
    target.task !== 'attack' &&
    target.task !== 'garrison'
  ) {
    const options = SLOT_DIRECTIONS.map(([dx, dz]) => ({x: target.x + dx * 2, z: target.z + dz * 2}))
      .filter((p) => !blocked(state, p.x, p.z))
      .sort((a, b) => dist(b, source) - dist(a, source) || a.x - b.x || a.z - b.z);
    const safe = options[0];
    if (safe) {
      target.beforeFlee ??= {
        task: target.task,
        targetId: target.targetId,
        resourceTargetId: target.resourceTargetId,
        destX: target.destX,
        destZ: target.destZ,
      };
      target.fleeUntil = state.tick + 100;
      target.task = 'move';
      target.destX = safe.x;
      target.destZ = safe.z;
      target.path = undefined;
      target.pathGoal = undefined;
      target.attackAt = undefined;
      target.working = false;
    }
  }
  if (target.kind === 'deer' && target.hp > 0 && source) {
    const dx = target.x - source.x,
      dz = target.z - source.z,
      m = Math.max(1, Math.abs(dx), Math.abs(dz));
    target.destX = target.x + Math.trunc((dx * 2500) / m);
    target.destZ = target.z + Math.trunc((dz * 2500) / m);
    target.speed = 76;
    target.fleeUntil = state.tick + 60;
    target.task = 'move';
    target.path = undefined;
    target.pathGoal = undefined;
  }
  if (target.hp === 0 && target.kind === 'explorer') {
    target.incapacitatedAt = state.tick;
    target.recoveryProgress = 0;
    target.deathTick = state.tick;
    target.task = 'dead';
    target.orders = [];
    target.directive = undefined;
    target.treasureTargetId = undefined;
    target.attackAt = undefined;
    event(
      state,
      'Explorer incapacitated. Send an ally, return for Coin, or recover near a safe hall.',
      'explorer-down',
      target.owner as PlayerId,
    );
    return;
  }
  if (target.hp === 0) {
    target.task = 'dead';
    target.deathTick = state.tick;
    target.lastHitBy = source?.id;
    for (const e of state.entities.filter((e) => e.garrisonedIn === target.id)) {
      e.garrisonedIn = undefined;
      e.x = target.x + ((e.id % 5) - 2) * 300;
      e.z = target.z + approachRange(target) + 300;
      e.task = 'idle';
    }
    const victim = target.owner ? state.players[target.owner - 1] : undefined,
      attacker = source?.owner ? state.players[source.owner - 1] : undefined;
    if (target.category === 'building' && victim) {
      victim.population = Math.max(
        0,
        victim.population - target.queue.reduce((n, q) => n + (unitById.get(q.kind)?.population ?? 0), 0),
      );
      target.queue = [];
    }
    if (target.category === 'unit' && victim) {
      victim.population = Math.max(0, victim.population - target.population);
      victim.stats.unitsLost++;
    }
    if (attacker) attacker.stats.unitsKilled++;
    event(state, `${target.kind} was destroyed`, 'combat', target.owner ? target.owner : source?.owner || undefined);
  }
}
function launchProjectile(state: MatchState, e: Entity, target: Entity, damage: number, ticks: number) {
  state.projectiles.push({
    id: state.nextEntityId++,
    owner: e.owner as PlayerId,
    sourceId: e.id,
    targetId: target.id,
    x: e.x,
    z: e.z,
    startTick: state.tick,
    startX: e.x,
    startZ: e.z,
    targetX: target.x,
    targetZ: target.z,
    kind: e.kind === 'cannon' ? 'shell' : e.kind === 'crossbow' ? 'bolt' : 'arrow',
    impactTick: state.tick + ticks,
    damage,
  });
}
function updateProjectiles(state: MatchState) {
  const entities = new Map(state.entities.map((e) => [e.id, e]));
  for (const shot of state.projectiles) {
    const t = entities.get(shot.targetId),
      s = entities.get(shot.sourceId);
    if (t && t.hp > 0 && !t.garrisonedIn) {
      shot.targetX = t.x;
      shot.targetZ = t.z;
      const remain = Math.max(1, shot.impactTick - state.tick);
      shot.x += Math.trunc((t.x - shot.x) / remain);
      shot.z += Math.trunc((t.z - shot.z) / remain);
      if (state.tick >= shot.impactTick) damage(state, s, t, shot.damage);
    }
  }
  state.projectiles = state.projectiles.filter(
    (x) => x.impactTick > state.tick && (entities.get(x.targetId)?.hp ?? 0) > 0,
  );
}
function updateBuildings(state: MatchState, b: Entity) {
  if (b.hp <= 0 || b.progress < 10000) return;
  const sheltered = state.entities.filter((e) => e.garrisonedIn === b.id);
  if (state.tick % 20 === 0) for (const e of sheltered) e.hp = Math.min(e.maxHp, e.hp + 1);
  if (['hall', 'fort', 'tower'].includes(b.kind)) {
    b.cooldown = Math.max(0, b.cooldown - 1);
    const age = state.players[b.owner - 1]?.age ?? 1,
      range = (b.kind === 'fort' ? 16 : b.kind === 'tower' ? 13 : 11) * 256;
    if (b.cooldown === 0 && (b.kind !== 'hall' || sheltered.length > 0)) {
      const target = nearest(
        state,
        b,
        (e) =>
          e.owner !== 0 &&
          e.owner !== b.owner &&
          !e.garrisonedIn &&
          e.category === 'unit' &&
          dist(e, b) <= range &&
          canSee(state, b.owner as PlayerId, e),
      );
      if (target) {
        b.cooldown = 35;
        launchProjectile(
          state,
          b,
          target,
          (b.kind === 'fort' ? 12 : 7) + age * 2 + Math.min(8, sheltered.length),
          Math.max(4, Math.trunc(dist(b, target) / 220)),
        );
      }
    }
  }
  if (!b.queue.length) return;
  const q = b.queue[0];
  const owner = state.players[b.owner - 1];
  const research = q.kind.startsWith('research:');
  const progress = (q.progressRemainder ?? 0) + (research ? 10000 : councilRate(owner?.modifiers ?? [], 'production'));
  q.remaining = Math.max(0, q.remaining - Math.trunc(progress / 10000));
  q.progressRemainder = progress % 10000;
  if (q.remaining <= 0) {
    if (research) {
      const t = technologyById.get(q.kind.slice(9));
      if (t && owner && !owner.researched.includes(t.id)) {
        owner.researched.push(t.id);
        owner.modifiers.push(t.modifier);
        if (t.upgrade) {
          const d = unitById.get(t.upgrade.to)!;
          for (const e of state.entities.filter(
            (e) => e.owner === owner.id && e.category === 'unit' && e.hp > 0 && e.kind === t.upgrade!.from,
          )) {
            e.hp = Math.max(1, Math.trunc((e.hp * d.hp) / e.maxHp));
            e.maxHp = d.hp;
            e.kind = d.id;
            e.model = d.model;
            e.damage = d.damage;
            e.range = d.range;
            e.speed = d.speed;
            e.attackAt = undefined;
            e.attackStart = undefined;
          }
        }
        event(state, `${t.name} research complete`, 'research-complete', owner.id);
      }
      b.queue.shift();
      return;
    }
    const d = unitById.get(q.kind)!;
    const candidates = SLOT_DIRECTIONS.map(([dx, dz]) => ({
      x: b.x + Math.trunc((dx * (approachRange(b) + 400)) / 1024),
      z: b.z + Math.trunc((dz * (approachRange(b) + 400)) / 1024),
    })).filter(
      (p) =>
        !blocked(state, p.x, p.z) &&
        !state.entities.some(
          (e) => e.hp > 0 && !e.garrisonedIn && (e.category === 'unit' || e.category === 'animal') && dist(e, p) < 260,
        ),
    );
    const exit = candidates.sort((a, c) => (b.rally ? dist(a, b.rally) - dist(c, b.rally) : a.z - c.z))[0];
    if (!exit) return;
    const created = unit(state, b.owner as PlayerId, d.id, exit.x, exit.z);
    if (created.kind === 'worker' && created.id % 2) created.model = 'villagerFemale';
    if (b.rally) {
      created.task = 'move';
      created.destX = b.rally.x;
      created.destZ = b.rally.z;
      const target = state.entities.find((e) => e.id === b.rally?.targetId);
      if (created.kind === 'worker' && target && target.amount > 0) {
        created.task = 'gather';
        created.targetId = target.id;
        created.resourceTargetId = target.id;
        created.resourceKind = target.kind;
        created.resourceOrigin = {x: target.x, z: target.z};
      }
    }
    b.queue.shift();
    event(state, `${unitById.get(created.kind)!.name} trained`, 'train', b.owner as PlayerId);
  }
}
function nearest(state: MatchState, from: Entity, pred: (e: Entity) => boolean) {
  let best: Entity | undefined,
    distance = Infinity;
  for (const e of state.entities) {
    if (e.hp <= 0 || !pred(e)) continue;
    const d = dist(from, e);
    if (d < distance || (d === distance && e.id < (best?.id ?? Infinity))) {
      best = e;
      distance = d;
    }
  }
  return best;
}
function combatPoint(target: Entity, attacker: Entity) {
  const slot = (attacker.id + target.id) % SLOT_DIRECTIONS.length;
  const [dx, dz] = SLOT_DIRECTIONS[slot];
  if (target.category === 'building') {
    const gap = Math.max(220, attacker.range > 0 ? Math.min(900, attacker.range - 120) : 220);
    return perimeterPoint(target, slot, gap);
  }
  const radius = attacker.range > 0 ? Math.max(260, Math.min(900, attacker.range - 120)) : 280;
  return {x: target.x + Math.trunc((dx * radius) / 1024), z: target.z + Math.trunc((dz * radius) / 1024)};
}
function aiCommands(state: MatchState, owner: PlayerId = 2): Command[] {
  const p = state.players[owner - 1];
  if (!p || p.resigned) return [];
  const difficulty = state.config.difficulty,
    interval = difficulty === 'relaxed' ? 100 : difficulty === 'standard' ? 50 : 25;
  if (state.tick % interval) return [];
  const issued: Command[] = [],
    next = () => state.nextSequence[owner - 1]++,
    base = {v: 1 as const, tick: state.tick, playerId: owner};
  const mine = state.entities.filter((e) => e.owner === owner && e.hp > 0),
    workers = mine.filter((e) => e.kind === 'worker'),
    army = mine.filter(
      (e) =>
        e.category === 'unit' && e.damage > 0 && !supportByUnit.has(e.kind) && !['worker', 'explorer'].includes(e.kind),
    );
  const seen = state.entities.filter(
      (e) => e.owner !== 0 && e.owner !== owner && !e.tradeSite && e.hp > 0 && canSee(state, owner, e),
    ),
    hall = mine.find((e) => e.kind === 'hall');
  const assigned: Record<string, number> = {provisions: 0, timber: 0, coin: 0, metal: 0};
  for (const w of workers) {
    const r = state.entities.find((e) => e.id === w.resourceTargetId || e.id === w.targetId);
    if (r && ['gather', 'carry'].includes(w.task)) assigned[resourceKind(r)]++;
  }
  for (const w of workers.filter((x) => x.task === 'idle' && !x.beforeFlee && !x.garrisonedIn)) {
    const wanted = (['provisions', 'timber', 'metal', 'coin'] as ResourceKind[]).sort(
      (a, b) =>
        (p.resources[a] + assigned[a] * 7000) / (a === 'provisions' ? 3 : a === 'timber' ? 2 : 1) -
        (p.resources[b] + assigned[b] * 7000) / (b === 'provisions' ? 3 : b === 'timber' ? 2 : 1),
    );
    let r: Entity | undefined;
    for (const kind of wanted) {
      r = nearest(
        state,
        w,
        (e) => e.category === 'resource' && resourceKind(e) === kind && e.amount > 0 && canSee(state, owner, e),
      );
      if (r) break;
    }
    if (r) {
      assigned[resourceKind(r)]++;
      issued.push({...base, sequence: next(), type: 'gather', entityIds: [w.id], targetId: r.id});
    }
  }
  const resourceFocus = (['provisions', 'timber', 'metal', 'coin'] as ResourceKind[]).sort(
    (a, b) =>
      (p.resources[a] + assigned[a] * 7000) / (a === 'provisions' ? 3 : a === 'timber' ? 2 : 1) -
      (p.resources[b] + assigned[b] * 7000) / (b === 'provisions' ? 3 : b === 'timber' ? 2 : 1),
  )[0];
  for (const site of mine.filter((e) => e.tradeSite && e.siteIncome !== resourceFocus))
    issued.push({...base, sequence: next(), type: 'site-income', siteId: site.id, resource: resourceFocus});
  const downedScout = state.entities.find((e) => e.owner === owner && e.incapacitatedAt !== undefined);
  if (downedScout && hall?.progress === 10000 && p.resources.coin >= frontierRules.recallCoin)
    issued.push({...base, sequence: next(), type: 'recall-explorer', entityId: downedScout.id});
  const workerGoal = Math.max(12, Math.min(18, Math.ceil(p.populationCap * 0.2)));
  if (hall && workers.length < workerGoal && hall.queue.length < 1 && canPay(p, unitById.get('worker')!.cost))
    issued.push({...base, sequence: next(), type: 'train', buildingId: hall.id, unitId: 'worker'});
  const scout = mine.find((e) => e.kind === 'explorer');
  if (scout?.task === 'idle') {
    const treasure = nearest(state, scout, (t) => t.category === 'treasure' && t.hp > 0 && canSee(state, owner, t));
    const site = nearest(
      state,
      scout,
      (t) => !!t.tradeSite && t.owner !== owner && t.hp > 0 && canSee(state, owner, t),
    );
    if (treasure)
      issued.push({...base, sequence: next(), type: 'collect-treasure', entityIds: [scout.id], targetId: treasure.id});
    else if (site)
      issued.push({...base, sequence: next(), type: 'claim-site', entityIds: [scout.id], targetId: site.id});
  }

  const oppositeZ = hall && hall.z > state.map.size / 2 ? 0.23 : 0.77,
    oppositeX = hall && hall.x > state.map.size / 2 ? 0.25 : 0.72;
  const searchRoute = [
    [0.72, oppositeZ],
    [oppositeX, oppositeZ],
    [0.25, 0.5],
    [0.72, 1 - oppositeZ],
    [0.25, 1 - oppositeZ],
    [0.5, 0.18],
  ];
  if (scout && scout.task === 'idle' && !issued.some((c) => 'entityIds' in c && c.entityIds.includes(scout.id))) {
    // Advance after finishing a leg, rather than idling at the same waypoint
    // until the clock enters another minute. Route from our known starting side.
    for (let tries = 0; tries < searchRoute.length; tries++) {
      const leg = scout.aiScoutLeg ?? 0,
        point = searchRoute[leg % searchRoute.length];
      scout.aiScoutLeg = leg + 1;
      const destination = nearestPassable(
        state,
        Math.trunc(point[0] * state.map.size),
        Math.trunc(point[1] * state.map.size),
        owner,
      );
      if (!destination) continue;
      issued.push({
        ...base,
        sequence: next(),
        type: 'move',
        entityIds: [scout.id],
        x: destination[0],
        z: destination[1],
      });
      break;
    }
  }

  if (
    hall &&
    p.population + 3 >= p.populationCap &&
    p.populationCap < state.config.populationCap &&
    !mine.some((e) => e.kind === 'house' && e.progress < 10000) &&
    canPay(p, buildingById.get('house')!.cost)
  ) {
    const builder = workers.find((e) => e.task !== 'build');
    if (builder) {
      outer: for (const radius of [15, 24, 33])
        for (const [dx, dz] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          [1, 1],
          [-1, 1],
        ]) {
          const x = hall.x + dx * radius * 256,
            z = hall.z + dz * radius * 256;
          if (!placementReason(state, 'house', x, z)) {
            issued.push({...base, sequence: next(), type: 'build', workerIds: [builder.id], buildingId: 'house', x, z});
            break outer;
          }
        }
    }
  }
  const threat = hall ? seen.filter((e) => e.category === 'unit' && dist(e, hall) < 24 * 256) : [];
  // Plan over a private budget and queue copy; only validated commands change the match.
  const budget = {...p, resources: {...p.resources}},
    planned = mine.map((e) => ({...e, queue: [...e.queue]}));
  for (const command of issued)
    if (command.type === 'train') {
      const definition = unitById.get(command.unitId)!;
      pay(budget, definition.cost);
      budget.population += definition.population;
      planned.find((e) => e.id === command.buildingId)?.queue.push({kind: definition.id, remaining: 1, total: 1});
    }
  for (const command of issued) if (command.type === 'build') pay(budget, buildingById.get(command.buildingId)!.cost);
  // Diversify infrastructure gradually, instead of spending the entire economy
  // on one barracks. A single expansion may be under construction at a time.
  if (
    hall &&
    workers.length >= 8 &&
    !mine.some((e) => e.category === 'building' && e.progress < 10000) &&
    !issued.some((c) => c.type === 'build')
  ) {
    const priorities = ['stable', 'archery', 'market', 'workshop', 'academy', 'arsenal', 'factory'],
      kind = priorities.find((id) => {
        const definition = buildingById.get(id)!;
        return definition.age <= p.age && !mine.some((e) => e.kind === id) && canPay(budget, definition.cost);
      }),
      builder = workers.filter((e) => !e.garrisonedIn && e.task !== 'build').sort((a, b) => a.id - b.id)[0];
    if (kind && builder) {
      search: for (const radius of [16, 24, 32, 40])
        for (const [dx, dz] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          [1, 1],
          [-1, 1],
          [1, -1],
          [-1, -1],
        ]) {
          const x = hall.x + dx * radius * WORLD_SCALE,
            z = hall.z + dz * radius * WORLD_SCALE;
          if (placementReason(state, kind, x, z)) continue;
          issued.push({...base, sequence: next(), type: 'build', workerIds: [builder.id], buildingId: kind, x, z});
          pay(budget, buildingById.get(kind)!.cost);
          break search;
        }
    }
  }
  for (const site of planned
    .filter((e) => e.category === 'building' && e.queue.length < 2)
    .sort((a, b) => a.id - b.id)) {
    if (site.kind === 'hall') continue;
    const choice = chooseAiProductionUnit(budget, site, planned, seen);
    if (!choice) continue;
    issued.push({...base, sequence: next(), type: 'train', buildingId: site.id, unitId: choice});
    const definition = unitById.get(choice)!;
    pay(budget, definition.cost);
    budget.population += definition.population;
    site.queue.push({kind: choice, remaining: definition.trainTicks, total: definition.trainTicks});
  }
  const researchSite = mine.filter((e) => e.category === 'building' && e.progress === 10000 && !e.queue.length);
  const technology = technologies.find(
    (t) =>
      t.age <= p.age &&
      !p.researched.includes(t.id) &&
      t.prerequisites.every((id) => p.researched.includes(id)) &&
      canPay(budget, t.cost) &&
      researchSite.some((b) => b.kind === t.building) &&
      !mine.some((b) => b.queue.some((q) => q.kind === `research:${t.id}`)),
  );
  if (technology && workers.length >= 8) {
    pay(budget, technology.cost);
    issued.push({
      ...base,
      sequence: next(),
      type: 'research',
      buildingId: researchSite.find((b) => b.kind === technology.building)!.id,
      technologyId: technology.id,
    });
  }
  if (p.age < 4 && !p.advancing && workers.length >= 8) {
    const advancement = advancements.find((x) => x.age === p.age + 1);
    if (advancement && canPay(budget, advancement.cost))
      issued.push({
        ...base,
        sequence: next(),
        type: 'advance',
        councilId: p.age === 1 ? 'harvest-council' : p.age === 2 ? 'field-command' : 'industrial-guilds',
      });
  }
  if (p.tokens > 0) {
    const card = dispatches.find(
      (d) =>
        d.age <= p.age &&
        d.tokenCost <= p.tokens &&
        !p.usedDispatches.includes(d.id) &&
        !p.pendingDispatches.some((q) => q.id === d.id),
    );
    if (card) issued.push({...base, sequence: next(), type: 'dispatch', dispatchId: card.id});
  }
  // A small starting force should begin scouting before the economy has
  // snowballed. Difficulty changes patience, never combat stats or costs.
  const threshold = difficulty === 'relaxed' ? 8 : difficulty === 'standard' ? 5 : 4;
  const aiFeatures = featuresFor(state, owner);
  const learnedIntent = chooseIntent(DEFAULT_AI_POLICY, aiFeatures);
  // The policy is still recorded and used for non-trivial states, but a
  // defensive tie in the small offline model must not stall a healthy army.
  // With no nearby threat and no known enemy, the legal action is development
  // and scouting; once the scout reveals a target, the policy can engage.
  const policyIntent =
    learnedIntent === 'defend' && aiFeatures.enemyNearBase === 0 && aiFeatures.knownEnemies === 0
      ? teacherIntent(aiFeatures)
      : learnedIntent;
  let goal: string = issued.some((c) => c.type === 'move' && scout && c.entityIds.includes(scout.id))
    ? 'scout'
    : policyIntent;
  const enemyDefenses = seen.filter(
    (e) => e.category === 'building' && ['tower', 'fort', 'wall', 'gate'].includes(e.kind),
  );
  const enemyProduction = seen.filter(
    (e) => e.category === 'building' && ['barracks', 'stable', 'workshop', 'archery', 'factory'].includes(e.kind),
  );
  const recentTargets = state.aiTargetHistory[owner] ?? [];
  const target = (threat.length ? threat : seen)
    .filter((e) => e.category === 'unit' || e.category === 'building')
    .sort(
      (a, b) =>
        aiTargetScore(b, enemyDefenses, enemyProduction, hall, recentTargets) -
          aiTargetScore(a, enemyDefenses, enemyProduction, hall, recentTargets) || a.id - b.id,
    )[0];
  const routeIndex = (Math.floor(state.tick / 900) + owner) % 6;
  const reacting = new Set<number>();
  for (const soldier of army) {
    const current = state.entities.find((e) => e.id === soldier.targetId),
      attacker = seen
        .filter(
          (e) =>
            e.category === 'unit' &&
            e.damage > 0 &&
            dist(e, soldier) < 12 * WORLD_SCALE &&
            (e.targetId === soldier.id || (current?.category === 'building' && e.task === 'attack')),
        )
        .sort((a, b) => dist(a, soldier) - dist(b, soldier) || a.id - b.id)[0];
    if (
      !attacker ||
      soldier.targetId === attacker.id ||
      soldier.garrisonedIn ||
      (soldier.lastOrder && state.tick - soldier.lastOrder < interval)
    )
      continue;
    issued.push({...base, sequence: next(), type: 'attack', entityIds: [soldier.id], targetId: attacker.id});
    reacting.add(soldier.id);
  }
  const strategicAttack =
    (policyIntent === 'defend' && threat.length > 0 && army.length >= 2) ||
    (policyIntent === 'engage' && army.length >= threshold && !army.some((e) => (e.regroupUntil ?? 0) > state.tick)) ||
    (army.length >= threshold && !army.some((e) => (e.regroupUntil ?? 0) > state.tick));
  if (strategicAttack) {
    goal = policyIntent === 'defend' ? 'defend' : policyIntent === 'engage' ? 'engage' : 'scout and pressure';
    if (target) {
      goal = threat.length ? 'defend' : 'engage';
      const ready = army.filter(
        (e) =>
          e.task === 'idle' &&
          !reacting.has(e.id) &&
          e.hp * 4 >= e.maxHp * 3 &&
          (e.regroupUntil ?? 0) <= state.tick &&
          e.targetId !== target.id &&
          (!e.lastOrder || state.tick - e.lastOrder > interval * 2),
      );
      if (ready.length)
        issued.push({
          ...base,
          sequence: next(),
          type: 'attack',
          entityIds: ready.map((e) => e.id),
          targetId: target.id,
        });
      const history = (state.aiTargetHistory[owner] ??= []);
      history.push(target.id);
      if (history.length > 6) history.shift();
    } else {
      // If the explorer is dead or still crossing a large map, send a healthy
      // detachment to the next legal search waypoint. This creates pressure
      // without granting the AI knowledge of hidden entities.
      goal = 'scout';
      if (army.length >= threshold && state.tick % 600 === 0) {
        const w = state.map.size,
          search = searchRoute[(Math.floor(state.tick / 600) + owner) % searchRoute.length];
        issued.push({
          ...base,
          sequence: next(),
          type: 'move',
          entityIds: army.filter((e) => e.task === 'idle').map((e) => e.id),
          x: Math.trunc(search[0] * w),
          z: Math.trunc(search[1] * w),
        });
      }
    }
  }
  if (hall && difficulty !== 'relaxed' && policyIntent === 'regroup') {
    const injured = army.filter((e) => e.hp * 4 < e.maxHp && e.task === 'attack');
    if (injured.length) {
      goal = 'regroup';
      issued.push({
        ...base,
        sequence: next(),
        type: 'move',
        entityIds: injured.map((e) => e.id),
        x: hall.x,
        z: hall.z + 8 * 256,
      });
      for (const e of injured) e.regroupUntil = state.tick + 220;
    }
  }
  state.aiTrace.push({
    playerId: owner,
    tick: state.tick,
    difficulty,
    goal,
    utility: Math.min(1000, army.length * 70 + p.age * 120),
    knownEnemies: seen.length,
    army: army.length,
    issued: issued.map((x) => x.type),
    targetId: target?.id,
    targetKind: target?.kind,
    resourceFocus,
    routeIndex,
  });
  if (state.aiTrace.length > 500) state.aiTrace.shift();
  return issued;
}
function aiTargetScore(
  target: Entity,
  defenses: Entity[],
  production: Entity[],
  base: Entity | undefined,
  recentTargets: number[],
) {
  let score = 0;
  if (target.category === 'building') {
    score += target.kind === 'hall' ? 780 : defenses.includes(target) ? 250 : production.includes(target) ? 760 : 520;
    if (defenses.some((d) => dist(d, target) < 8 * 256)) score -= 120;
  } else {
    const tags = unitById.get(target.kind)?.tags ?? [];
    score += tags.includes('worker') ? 300 : tags.includes('support') ? 680 : 520;
    if (defenses.some((d) => dist(d, target) < 10 * 256)) score -= 420;
  }
  if (base) score -= Math.trunc(dist(base, target) / 256);
  score += Math.max(0, 180 - target.hp);
  score -= recentTargets.filter((id) => id === target.id).length * 180;
  return score;
}
function updateDispatches(state: MatchState, p: PlayerState) {
  for (const pending of [...p.pendingDispatches]) {
    if (state.tick === pending.departureTick)
      event(state, `${dispatches.find((d) => d.id === pending.id)!.name} departed.`, 'dispatch-departed', p.id);
    if (state.tick < pending.arrivalTick) continue;
    const card = dispatches.find((d) => d.id === pending.id)!;
    const sites = state.entities
      .filter((e) => e.owner === p.id && e.hp > 0 && e.progress === 10000 && (e.kind === 'hall' || e.kind === 'fort'))
      .sort((a, b) => a.id - b.id);
    let reason: string | undefined;
    const population = card.units.reduce(
      (total, delivery) => total + unitById.get(delivery.unitId)!.population * delivery.count,
      0,
    );
    const livePopulation = state.entities
      .filter((e) => e.owner === p.id && (e.hp > 0 || e.incapacitatedAt !== undefined) && e.category === 'unit')
      .reduce((total, e) => total + e.population, 0);
    if (!sites.length) reason = 'Waiting for a completed central hall or fort.';
    else if (
      livePopulation +
        state.entities
          .filter((e) => e.owner === p.id && e.hp > 0 && e.category === 'building')
          .reduce((total, e) => total + e.queue.reduce((n, q) => n + (unitById.get(q.kind)?.population ?? 0), 0), 0) +
        population >
      p.populationCap
    )
      reason = 'Waiting for population space.';
    const spawns: {kind: string; x: number; z: number; site: Entity}[] = [];
    if (!reason)
      for (const delivery of card.units)
        for (let count = 0; count < delivery.count; count++) {
          let spot: {x: number; z: number; site: Entity} | undefined;
          for (const site of sites) {
            for (let ring = 0; ring < 6 && !spot; ring++) {
              for (const [dx, dz] of SLOT_DIRECTIONS) {
                const radius = approachRange(site) + 450 + ring * 450;
                const candidate = {
                  x: site.x + Math.trunc((dx * radius) / 1024),
                  z: site.z + Math.trunc((dz * radius) / 1024),
                  site,
                };
                if (
                  blocked(state, candidate.x, candidate.z) ||
                  spawns.some((e) => dist(e, candidate) < 300) ||
                  state.entities.some(
                    (e) =>
                      e.hp > 0 &&
                      !e.garrisonedIn &&
                      (e.category === 'unit' || e.category === 'animal') &&
                      dist(e, candidate) < 300,
                  )
                )
                  continue;
                spot = candidate;
                break;
              }
            }
            if (spot) break;
          }
          if (!spot) {
            reason = 'Waiting for clear ground at the arrival site.';
            break;
          }
          spawns.push({...spot, kind: delivery.unitId});
        }
    if (reason) {
      if (pending.waiting !== reason) event(state, `${card.name}: ${reason}`, 'dispatch-waiting', p.id);
      pending.waiting = reason;
      continue;
    }
    for (const kind of Object.keys(card.resources) as ResourceKind[]) p.resources[kind] += card.resources[kind];
    for (const spawn of spawns) {
      const created = unit(state, p.id, spawn.kind, spawn.x, spawn.z);
      if (created.kind === 'worker' && created.id % 2) created.model = 'villagerFemale';
      if (spawn.site.rally) {
        created.task = 'move';
        created.destX = spawn.site.rally.x;
        created.destZ = spawn.site.rally.z;
      }
    }
    p.population =
      livePopulation +
      population +
      state.entities
        .filter((e) => e.owner === p.id && e.hp > 0 && e.category === 'building')
        .reduce((total, e) => total + e.queue.reduce((n, q) => n + (unitById.get(q.kind)?.population ?? 0), 0), 0);
    p.stats.dispatches++;
    p.usedDispatches.push(card.id);
    p.pendingDispatches.splice(p.pendingDispatches.indexOf(pending), 1);
    event(state, `${card.name} arrived for Player ${p.id}`, 'dispatch', p.id);
  }
}
function passiveSystems(state: MatchState) {
  for (const p of state.players) {
    updateDispatches(state, p);
    if (p.advancing) {
      const hall = state.entities.find(
        (e) => e.owner === p.id && e.kind === 'hall' && e.hp > 0 && e.progress === 10000,
      );
      p.advancing.waiting = hall ? undefined : 'Waiting for a completed central hall.';
      if (hall) p.advancing.remaining--;
      if (p.advancing.remaining <= 0) {
        const choice = councilChoices.find((c) => c.id === p.advancing!.councilId)!;
        p.age = choice.age as 2 | 3 | 4;
        if (!p.modifiers.includes(choice.modifier)) p.modifiers.push(choice.modifier);
        for (const k of Object.keys(choice.delivery) as ResourceKind[]) p.resources[k] += choice.delivery[k];
        p.advancing = undefined;
        event(state, `Player ${p.id} advanced to age ${p.age}`, 'age', p.id);
      }
    }
    if (state.tick % 600 === 0) {
      p.renown += 1000;
      if (p.renown >= 10000) {
        p.renown -= 10000;
        p.tokens++;
        event(state, `Dispatch token earned by Player ${p.id}`, 'dispatch');
      }
    }
    const markets = state.entities.filter(
      (e) => e.owner === p.id && e.kind === 'market' && e.hp > 0 && e.progress === 10000,
    ).length;
    if (markets && state.tick % 100 === 0)
      p.resources.coin += Math.trunc((markets * 100 * councilRate(p.modifiers, 'market')) / 10000);
  }
}
function updateAnimals(state: MatchState) {
  for (const animal of state.entities.filter((e) => e.category === 'animal' && e.hp > 0)) {
    if (animal.kind === 'deer' && animal.fleeUntil && state.tick >= animal.fleeUntil) {
      animal.task = 'idle';
      animal.fleeUntil = undefined;
      animal.speed = 28;
      animal.path = undefined;
    }
    if (animal.kind === 'sheep' && state.tick % 10 === 0) {
      const closest = state.entities
        .filter(
          (e) =>
            e.owner !== 0 &&
            e.hp > 0 &&
            !e.garrisonedIn &&
            (e.category === 'unit' || (e.category === 'building' && e.progress === 10000)),
        )
        .map((e) => ({e, d: dist(animal, e) - (e.category === 'building' ? approachRange(e) : 0)}))
        .filter((x) => x.d < 5 * 256)
        .sort((a, b) => a.d - b.d || a.e.id - b.e.id)[0];
      if (closest && animal.owner !== closest.e.owner) {
        animal.owner = closest.e.owner;
        animal.task = 'idle';
        animal.followId = closest.e.category === 'unit' ? closest.e.id : undefined;
        animal.path = undefined;
      }
    }
    const leader = state.entities.find((e) => e.id === animal.followId && e.hp > 0 && e.owner === animal.owner);
    if (leader && dist(animal, leader) > 700) {
      animal.task = 'move';
      animal.destX = leader.x - 500;
      animal.destZ = leader.z + ((animal.id % 3) - 1) * 350;
    }
    if (!leader && animal.task === 'idle' && state.tick % 160 === (animal.id % 8) * 20) {
      const dx = ((seedHash(state.map.seed, animal.id + state.tick) % 7) - 3) * 150,
        dz = ((seedHash(state.map.seed, animal.id + state.tick + 1) % 7) - 3) * 150;
      if (!blocked(state, animal.x + dx, animal.z + dz)) {
        animal.destX = animal.x + dx;
        animal.destZ = animal.z + dz;
        animal.task = 'move';
        animal.path = undefined;
      }
    }
  }
  state.entities = state.entities.filter((e) => {
    if (e.kind === 'timber' && e.amount < (e.initialAmount ?? e.amount) * 0.5) {
      if (state.tick - (e.lastWorked ?? state.tick) > 2400) {
        e.amount = 0;
        e.stumpSince ??= state.tick;
      }
      if (e.amount <= 0) {
        e.stumpSince ??= state.tick;
        return state.tick - e.stumpSince < 600;
      }
    }
    if (e.category === 'resource' && e.amount <= 0) return false;
    if (e.category === 'animal' && (e.amount <= 0 || (e.hp <= 0 && state.tick - (e.deathTick ?? 0) > 1800)))
      return false;
    if (e.incapacitatedAt !== undefined) return true;
    return !(e.hp <= 0 && e.category !== 'animal' && state.tick - (e.deathTick ?? 0) > 140);
  });
}
function checkVictory(state: MatchState) {
  if (state.winner || state.players.length === 1) return;
  for (const p of state.players) {
    const hall = state.entities.some((e) => e.owner === p.id && e.kind === 'hall' && e.hp > 0),
      production = state.entities.some(
        (e) =>
          e.owner === p.id &&
          e.category === 'building' &&
          e.progress === 10000 &&
          e.hp > 0 &&
          buildingById.get(e.kind)?.production.length,
      ),
      canRebuild = state.entities.some(
        (e) => e.owner === p.id && e.category === 'unit' && e.hp > 0 && e.kind === 'worker',
      );
    // A surviving worker can restore the central hall and economy. Losing
    // infrastructure alone must not eliminate that player's recovery chance.
    if (!hall && !production && !canRebuild && state.tick > 600) {
      p.resigned = true;
      if (p.id === 1) state.winner = state.players.find((x) => x.id !== 1 && !x.resigned)?.id ?? 0;
    }
  }
  const alive = state.players.filter((p) => !p.resigned);
  if (alive.length === 1) {
    state.winner = alive[0].id;
    event(state, `Player ${state.winner} wins by conquest`, 'victory');
  }
}

export function step(state: MatchState, commands: Command[]) {
  if (state.winner) return state;
  state.tick++;
  const weather = weatherAt(state.map.seed, state.tick);
  if (weather.weather !== state.map.weather) event(state, `Weather changing to ${weather.weather}.`, 'weather');
  Object.assign(state.map, weather);
  const all = [...commands, ...state.players.filter((p) => p.id !== 1).flatMap((p) => aiCommands(state, p.id))].sort(
    (a, b) => a.tick - b.tick || a.playerId - b.playerId || a.sequence - b.sequence,
  );
  for (const c of all) applyCommand(state, c);
  prepareTraffic(state);
  for (const e of [...state.entities].sort((a, b) => a.id - b.id)) {
    if (e.category === 'unit' || (e.category === 'animal' && e.hp > 0)) updateUnit(state, e);
    else if (e.category === 'building') updateBuildings(state, e);
  }
  updateProjectiles(state);
  updateFrontier(state);
  passiveSystems(state);
  updateAnimals(state);
  if (state.tick % 5 === 0) updateVision(state);
  checkVictory(state);
  return state;
}

export interface MatchSnapshot {
  offlineCheats?: boolean;
  tick: number;
  winner: 0 | PlayerId | null;
  players: PlayerState[];
  entities: Entity[];
  projectiles: MatchState['projectiles'];
  events: MatchState['events'];
  map: MatchState['map'];
  fog: number[];
  fogWidth: number;
  checksum: string;
  aiTrace: AiTrace[];
}
export function createSnapshot(state: MatchState, viewer: PlayerId, includeChecksum = true): MatchSnapshot {
  const occupants = new Map<number, number>();
  for (const e of state.entities)
    if (e.garrisonedIn) occupants.set(e.garrisonedIn, (occupants.get(e.garrisonedIn) ?? 0) + 1);
  return {
    offlineCheats: state.config.offlineCheats,
    tick: state.tick,
    winner: state.winner,
    players: structuredClone(
      state.players.map((p) =>
        p.id === viewer ? p : {...p, pendingDispatches: [], usedDispatches: [], researched: []},
      ),
    ),
    entities: structuredClone(
      observedEntities(state, viewer).map((e) => ({
        ...e,
        orders: e.owner === viewer ? e.orders : undefined,
        directive: e.owner === viewer ? e.directive : undefined,
        garrisonCount: e.owner === viewer ? (occupants.get(e.id) ?? 0) : undefined,
      })),
    ),
    projectiles: structuredClone(state.projectiles.filter((p) => visibleTo(state, viewer, p))),
    events: structuredClone(state.events.filter((e) => !e.owner || e.owner === viewer)),
    map: {...state.map},
    fog: [...state.fog[viewer - 1]],
    fogWidth: Math.ceil(state.map.size / FOG_CELL),
    checksum: includeChecksum ? checksum(state) : '',
    aiTrace: structuredClone(state.aiTrace.slice(-8)),
  };
}
function canonical(state: MatchState) {
  return JSON.stringify(
    {
      v: state.v,
      config: state.config,
      tick: state.tick,
      nextEntityId: state.nextEntityId,
      nextSequence: state.nextSequence,
      rng: state.rng,
      entities: [...state.entities].sort((a, b) => a.id - b.id),
      players: state.players,
      projectiles: [...state.projectiles].sort((a, b) => a.id - b.id),
      map: state.map,
      winner: state.winner,
      aiTargetHistory: state.aiTargetHistory,
      fog: state.fog,
      knowledge: state.knowledge,
    },
    (_key, value) =>
      value && typeof value === 'object' && !Array.isArray(value)
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((key) => [key, value[key]]),
          )
        : value,
  );
}
export function checksum(state: MatchState) {
  let hi = 0xcbf29ce4,
    lo = 0x84222325;
  for (const byte of new TextEncoder().encode(canonical(state))) {
    lo = (lo ^ byte) >>> 0;
    const product = lo * 435;
    hi = (Math.imul(hi, 435) + Math.imul(lo, 256) + Math.floor(product / 4294967296)) >>> 0;
    lo = product >>> 0;
  }
  return hi.toString(16).padStart(8, '0') + lo.toString(16).padStart(8, '0');
}
export function serializeSave(state: MatchState, commandLog: Command[] = state.commandLog): SaveEnvelope {
  return {
    v: 1,
    contentVersion: CONTENT_VERSION,
    mapVersion: MAP_VERSION,
    protocolVersion: PROTOCOL_VERSION,
    state: canonical(state),
    commandLog: structuredClone(commandLog),
    checksum: checksum(state),
  };
}
export function restoreSave(save: SaveEnvelope): MatchState {
  if (
    save.v !== 1 ||
    save.contentVersion !== CONTENT_VERSION ||
    save.mapVersion !== MAP_VERSION ||
    save.protocolVersion !== PROTOCOL_VERSION
  )
    throw new Error('This save uses an unsupported game version.');
  const state = JSON.parse(save.state) as MatchState;
  if (checksum(state) !== save.checksum) throw new Error('Save checksum is invalid.');
  state.commandLog = structuredClone(save.commandLog);
  state.events = [];
  state.aiTrace = [];
  return state;
}
export const scales = {WORLD_SCALE, RESOURCE_SCALE, TICKS_PER_SECOND};
