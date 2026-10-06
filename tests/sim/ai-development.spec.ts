import {expect, test} from 'vitest';
import {buildingById, unitById} from '../../packages/content/src/index';
import {
  createMatch,
  step,
  checksum,
  serializeSave,
  restoreSave,
  placementReason,
  canSee,
  type Entity,
  type MatchState,
} from '../../packages/sim/src/index';
import type {PlayerId} from '../../packages/protocol/src/index';

const initial = createMatch({
  v: 1,
  seed: 73,
  difficulty: 'standard',
  mode: 'skirmish',
  aiCount: 1,
  populationCap: 200,
  gameSpeed: 1,
  mapSize: 'small',
  fogOfWar: true,
});
function fixture() {
  const s = structuredClone(initial);
  s.entities = s.entities.filter((e) => e.owner > 0 && ['unit', 'building'].includes(e.category));
  s.entities.forEach((e) => (e.stance = 'no-attack'));
  s.tick = 49;
  s.players[1].age = 4;
  s.players[1].populationCap = 200;
  s.players[1].resources = {provisions: 100000, timber: 100000, coin: 100000, metal: 100000};
  return s;
}
function legalSite(s: MatchState, kind: string) {
  for (let z = 16; z < s.map.size / 256 - 16; z += 16)
    for (let x = 16; x < s.map.size / 256 - 16; x += 16)
      if (!placementReason(s, kind, x * 256, z * 256)) return {x: x * 256, z: z * 256};
  throw new Error(`No legal fixture site for ${kind}`);
}
function addBuilding(s: MatchState, kind: string, owner: PlayerId = 2, point = legalSite(s, kind)): Entity {
  const d = buildingById.get(kind)!;
  const e: Entity = {
    ...structuredClone(initial.entities.find((e) => e.kind === 'hall')!),
    id: s.nextEntityId++,
    owner,
    kind,
    model: d.model,
    ...point,
    hp: d.hp,
    maxHp: d.hp,
    progress: 10000,
    queue: [],
    task: 'idle',
    damage: 0,
    range: 0,
    carry: {},
  };
  s.entities.push(e);
  return e;
}
function addUnit(s: MatchState, kind: string, owner: PlayerId = 2, point?: {x: number; z: number}): Entity {
  const d = unitById.get(kind)!,
    hall = s.entities.find((e) => e.owner === owner && e.kind === 'hall');
  const e: Entity = {
    ...structuredClone(initial.entities.find((e) => e.kind === 'worker')!),
    id: s.nextEntityId++,
    owner,
    kind,
    model: d.model,
    ...(point ?? {x: hall!.x + 9 * 256, z: hall!.z}),
    hp: d.hp,
    maxHp: d.hp,
    damage: d.damage,
    range: d.range,
    speed: d.speed,
    population: d.population,
    queue: [],
    carry: {},
    task: 'idle',
    stance: 'no-attack',
    targetId: undefined,
    path: undefined,
    lastOrder: undefined,
  };
  s.entities.push(e);
  return e;
}

test('Industrial AI commands legally reserve rifles and dragoons across completed production sites', () => {
  const s = fixture(),
    barracks = s.entities.find((e) => e.owner === 2 && e.kind === 'barracks')!;
  const stable = addBuilding(s, 'stable');
  addUnit(s, 'cuirassRider');
  const restored = restoreSave(serializeSave(s));
  step(s, []);
  step(restored, []);
  const trained = s.commandLog.filter((c) => c.playerId === 2 && c.type === 'train');
  expect(trained.some((c) => c.type === 'train' && c.buildingId === barracks.id && c.unitId === 'veteranRifle')).toBe(
    true,
  );
  expect(trained.some((c) => c.type === 'train' && c.buildingId === stable.id && c.unitId === 'dragoon')).toBe(true);
  expect(barracks.queue[0].kind).toBe('veteranRifle');
  expect(stable.queue[0].kind).toBe('dragoon');
  expect(checksum(s)).toBe(checksum(restored));
});

test('later-age AI expansion reserves one factory with a legal full footprint', () => {
  const s = fixture();
  for (let i = 0; i < 4; i++) addUnit(s, 'worker');
  for (const kind of ['stable', 'archery', 'market', 'workshop', 'academy', 'arsenal']) addBuilding(s, kind);
  const before = structuredClone(s),
    restored = restoreSave(serializeSave(s));
  step(s, []);
  step(restored, []);
  const orders = s.commandLog.filter((c) => c.playerId === 2 && c.type === 'build');
  expect(orders).toHaveLength(1);
  const order = orders[0];
  expect(order.type).toBe('build');
  if (order.type !== 'build') throw new Error('Expected factory build command');
  expect(order.buildingId).toBe('factory');
  expect(placementReason(before, order.buildingId, order.x, order.z)).toBe('');
  const factory = s.entities.find((e) => e.owner === 2 && e.kind === 'factory')!;
  expect(factory).toBeDefined();
  expect(factory.progress).toBeLessThan(10000);
  expect(factory.x).toBe(order.x);
  expect(factory.z).toBe(order.z);
  expect(checksum(s)).toBe(checksum(restored));
});

function skirmish(hidden = false) {
  const s = fixture(),
    hall = s.entities.find((e) => e.owner === 2 && e.kind === 'hall')!;
  s.tick = 99;
  const point = legalSite(s, 'house');
  s.entities = [hall];
  s.players[1].resources = {provisions: 0, timber: 0, coin: 0, metal: 0};
  const soldier = addUnit(s, hidden ? 'militia' : 'veteranRifle', 2, point);
  const target = addBuilding(s, 'house', 1, {x: point.x + 6 * 256, z: point.z});
  const incoming = addUnit(s, 'swordsman', 1, {x: point.x + (hidden ? 2944 : 768), z: point.z + (hidden ? 2944 : 0)});
  soldier.task = 'attack';
  soldier.targetId = target.id;
  soldier.lastOrder = 1;
  soldier.cooldown = 100;
  incoming.task = 'attack';
  incoming.targetId = soldier.id;
  incoming.cooldown = 100;
  return {s, soldier, target, incoming};
}

test('an AI soldier attacking a building reacts to a visible incoming attacker', () => {
  const {s, soldier, incoming} = skirmish();
  expect(canSee(s, 2, incoming)).toBe(true);
  const restored = restoreSave(serializeSave(s));
  step(s, []);
  step(restored, []);
  expect(soldier.targetId).toBe(incoming.id);
  expect(
    s.commandLog.some(
      (c) => c.playerId === 2 && c.type === 'attack' && c.targetId === incoming.id && c.entityIds.includes(soldier.id),
    ),
  ).toBe(true);
  expect(checksum(s)).toBe(checksum(restored));
});

test('reactive defense never obtains a hidden attacker from authoritative state', () => {
  const {s, soldier, target, incoming} = skirmish(true);
  expect(canSee(s, 2, incoming)).toBe(false);
  step(s, []);
  expect(soldier.targetId).toBe(target.id);
  expect(s.commandLog.some((c) => c.playerId === 2 && c.type === 'attack' && c.targetId === incoming.id)).toBe(false);
});

test('AI preserves medics as healers while combat troops attack a visible target', () => {
  const s = fixture(),
    hall = s.entities.find((e) => e.owner === 2 && e.kind === 'hall')!,
    point = legalSite(s, 'house');
  s.entities = [hall];
  s.players[1].resources = {provisions: 0, timber: 0, coin: 0, metal: 0};
  const troops = Array.from({length: 10}, () => addUnit(s, 'veteranRifle', 2, point));
  troops[0].hp = Math.trunc(troops[0].maxHp / 2);
  const injured = troops[0].hp,
    medic = addUnit(s, 'medic', 2, point);
  const target = addBuilding(s, 'house', 1, {x: point.x + 6 * 256, z: point.z});
  step(s, []);
  const attacks = s.commandLog.filter((c) => c.playerId === 2 && c.type === 'attack' && c.targetId === target.id);
  expect(attacks.length).toBeGreaterThan(0);
  expect(attacks.some((c) => c.type === 'attack' && c.entityIds.includes(medic.id))).toBe(false);
  expect(medic.task).toBe('heal');
  expect(troops[0].hp).toBeGreaterThan(injured);
});
