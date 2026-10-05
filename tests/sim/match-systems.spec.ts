import {expect, test} from 'vitest';
import {
  createMatch,
  createSnapshot,
  step,
  checksum,
  placementReason,
  serializeSave,
  restoreSave,
  type Entity,
  type MatchState,
} from '../../packages/sim/src/index';
import {unitById, garrisonCapacity} from '../../packages/content/src/index';
import {coastAt} from '../../packages/sim/src/terrain';
import type {Command, MatchConfig, PlayerId} from '../../packages/protocol/src/index';
const config: MatchConfig = {
  v: 1,
  seed: 73,
  difficulty: 'standard',
  mode: 'skirmish',
  populationCap: 200,
  gameSpeed: 1,
  mapSize: 'small',
  fogOfWar: false,
};
function command(s: MatchState, fields: object) {
  step(s, [{v: 1, tick: s.tick + 1, sequence: s.tick + 1, playerId: 1, ...fields} as Command]);
}
function ticks(s: MatchState, n: number) {
  for (let i = 0; i < n; i++) step(s, []);
}
function actor(s: MatchState, owner: PlayerId, kind: string, x: number, z: number): Entity {
  const template = s.entities.find((e) => e.category === 'unit')!,
    d = unitById.get(kind)!;
  return {
    ...structuredClone(template),
    id: s.nextEntityId++,
    owner,
    kind,
    model: d.model,
    x,
    z,
    hp: d.hp,
    maxHp: d.hp,
    speed: d.speed,
    damage: d.damage,
    range: d.range,
    population: d.population,
    task: 'idle',
    cooldown: 0,
    path: undefined,
    targetId: undefined,
    queue: [],
    carry: {},
  };
}

test('seeds change coastline and separated starts; map size changes playable area', () => {
  const a = createMatch(config),
    b = createMatch({...config, seed: 74}),
    large = createMatch({...config, mapSize: 'large'});
  expect(a.entities.filter((e) => e.kind === 'hall').map((e) => [e.x, e.z])).not.toEqual(
    b.entities.filter((e) => e.kind === 'hall').map((e) => [e.x, e.z]),
  );
  expect(coastAt(a.map.size / 2, a.map.size, 73)).not.toBe(coastAt(a.map.size / 2, a.map.size, 74));
  const [p, q] = a.entities.filter((e) => e.kind === 'hall');
  expect(Math.hypot(p.x - q.x, p.z - q.z)).toBeGreaterThan(a.map.size * 0.5);
  expect(large.map.size).toBe(320 * 256);
});
test('unfinished production rejects training, resumes building, then honors rally', () => {
  const s = createMatch({...config, aiCount: 0}),
    worker = s.entities.find((e) => e.owner === 1 && e.kind === 'worker')!,
    hall = s.entities.find((e) => e.owner === 1 && e.kind === 'hall')!;
  // Isolate construction from the newly generated treasure-guard encounters.
  s.entities = s.entities.filter((e) => !e.guardOf);
  s.players[0].resources.timber = 100000;
  let spot = {x: hall.x, z: hall.z + 25 * 256};
  for (let dx = -30; dx <= 30; dx += 8)
    for (let dz = 16; dz <= 35; dz += 8) {
      const p = {x: hall.x + dx * 256, z: hall.z + dz * 256};
      if (!placementReason(s, 'barracks', p.x, p.z)) spot = p;
    }
  expect(placementReason(s, 'barracks', spot.x, spot.z)).toBe('');
  command(s, {type: 'build', workerIds: [worker.id], buildingId: 'barracks', ...spot});
  const b = s.entities.filter((e) => e.owner === 1 && e.kind === 'barracks').at(-1)!;
  expect(b.progress).toBeLessThan(10000);
  command(s, {type: 'train', buildingId: b.id, unitId: 'militia'});
  expect(b.queue).toHaveLength(0);
  command(s, {type: 'stop', entityIds: [worker.id]});
  const progress = b.progress;
  ticks(s, 20);
  expect(b.progress).toBe(progress);
  worker.x = b.x;
  worker.z = b.z + 6 * 256;
  command(s, {type: 'resume-build', entityIds: [worker.id], targetId: b.id});
  ticks(s, 950);
  expect(b.progress).toBe(10000);
  command(s, {type: 'rally', buildingIds: [b.id], x: b.x - 10 * 256, z: b.z + 10 * 256});
  command(s, {type: 'train', buildingId: b.id, unitId: 'militia'});
  ticks(s, 361);
  const recruit = s.entities.find((e) => e.owner === 1 && e.kind === 'militia')!;
  expect(recruit).toBeDefined();
  expect(recruit.destX).toBe(b.rally!.x);
});
test('advancement takes 30 seconds and save restores progress', () => {
  const s = createMatch(config);
  s.players[0].resources.provisions = 100000;
  s.players[0].resources.timber = 100000;
  command(s, {type: 'advance', councilId: 'harvest-council'});
  expect(s.players[0].age).toBe(1);
  ticks(s, 200);
  const restored = restoreSave(serializeSave(s));
  expect(checksum(restored)).toBe(checksum(s));
  ticks(s, 400);
  ticks(restored, 400);
  expect(s.players[0].age).toBe(2);
  expect(checksum(restored)).toBe(checksum(s));
});
test('fog remembers last seen resources but never hidden mobile enemies', () => {
  const s = createMatch({...config, fogOfWar: true}),
    worker = s.entities.find((e) => e.owner === 1 && e.kind === 'worker')!,
    ore = s.entities.find((e) => e.kind === 'coin')!,
    enemy = s.entities.find((e) => e.owner === 2 && e.kind === 'worker')!;
  s.entities = [worker, ore, enemy];
  worker.x = ore.x;
  worker.z = ore.z + 300;
  enemy.x = ore.x + 600;
  enemy.z = ore.z;
  enemy.stance = 'no-attack';
  ticks(s, 5);
  const first = createSnapshot(s, 1);
  expect(first.entities.some((e) => e.id === enemy.id)).toBe(true);
  const amount = ore.amount;
  worker.x = 5 * 256;
  worker.z = 5 * 256;
  ore.amount -= 1000;
  ticks(s, 5);
  const hidden = createSnapshot(s, 1);
  expect(hidden.entities.find((e) => e.id === ore.id)).toMatchObject({amount, remembered: true});
  expect(hidden.entities.some((e) => e.id === enemy.id)).toBe(false);
  worker.x = ore.x;
  worker.z = ore.z;
  ticks(s, 5);
  expect(createSnapshot(s, 1).entities.find((e) => e.id === ore.id)?.amount).toBe(ore.amount);
});
test('sheep ownership transfers to the nearest player and deer flee when hit', () => {
  const s = createMatch(config),
    sheep = s.entities.find((e) => e.kind === 'sheep')!,
    deer = s.entities.find((e) => e.kind === 'deer')!,
    a = s.entities.find((e) => e.owner === 1 && e.kind === 'worker')!,
    b = s.entities.find((e) => e.owner === 2 && e.kind === 'worker')!;
  s.entities = [sheep, deer, a, b];
  a.x = sheep.x + 600;
  a.z = sheep.z;
  b.x = sheep.x + 1800;
  b.z = sheep.z;
  ticks(s, 10);
  expect(sheep.owner).toBe(1);
  b.x = sheep.x + 50;
  ticks(s, 10);
  expect(sheep.owner).toBe(2);
  a.x = deer.x;
  a.z = deer.z + 600;
  const before = [deer.x, deer.z];
  command(s, {type: 'gather', entityIds: [a.id], targetId: deer.id});
  ticks(s, 30);
  expect(deer.hp).toBeLessThan(deer.maxHp);
  expect([deer.x, deer.z]).not.toEqual(before);
});
test('garrison hides and protects workers and release returns them to play', () => {
  const s = createMatch(config),
    worker = s.entities.find((e) => e.owner === 1 && e.kind === 'worker')!,
    hall = s.entities.find((e) => e.owner === 1 && e.kind === 'hall')!;
  command(s, {type: 'garrison', entityIds: [worker.id], targetId: hall.id});
  ticks(s, 100);
  expect(worker.garrisonedIn).toBe(hall.id);
  expect(createSnapshot(s, 1).entities.some((e) => e.id === worker.id)).toBe(false);
  expect(garrisonCapacity('hall', 3)).toBeGreaterThan(garrisonCapacity('hall', 1));
  command(s, {type: 'ungarrison', buildingId: hall.id});
  expect(worker.garrisonedIn).toBeUndefined();
});
test('superior numbers and unit stats win without difficulty damage bonuses', () => {
  const results: string[] = [];
  for (const difficulty of ['relaxed', 'standard', 'ruthless'] as const) {
    const s = createMatch({...config, difficulty});
    const soldiers = [
      ...Array.from({length: 6}, (_, i) => actor(s, 1, 'swordsman', 80 * 256 + i * 100, 80 * 256)),
      ...Array.from({length: 2}, (_, i) => actor(s, 2, 'militia', 80 * 256 + i * 100, 82 * 256)),
    ];
    s.entities = soldiers;
    ticks(s, 350);
    expect(s.entities.filter((e) => e.owner === 2 && e.hp > 0)).toHaveLength(0);
    expect(s.entities.filter((e) => e.owner === 1 && e.hp > 0).length).toBeGreaterThanOrEqual(4);
    results.push(JSON.stringify(s.entities.map((e) => [e.owner, e.hp])));
  }
  expect(new Set(results).size).toBe(1);
});
test('attackers take separate deterministic approach slots instead of stacking', () => {
  const s = createMatch(config),
    target = s.entities.find((e) => e.owner === 2 && e.category === 'building')!;
  const soldiers = Array.from({length: 4}, (_, i) =>
    actor(s, 1, 'swordsman', target.x - 16 * 256 + i * 120, target.z - 16 * 256),
  );
  s.entities.push(...soldiers);
  command(s, {type: 'attack', entityIds: soldiers.map((e) => e.id), targetId: target.id});
  ticks(s, 90);

  const alive = soldiers.filter((e) => e.hp > 0);
  expect(alive.length).toBeGreaterThanOrEqual(3);
  expect(new Set(alive.map((e) => `${e.x},${e.z}`)).size).toBeGreaterThan(1);
});
test('depletion and old unprocessed carcasses clear the map', () => {
  const s = createMatch(config),
    ore = s.entities.find((e) => e.kind === 'coin')!,
    animal = s.entities.find((e) => e.kind === 'deer')!;
  ore.amount = 0;
  animal.hp = 0;
  animal.task = 'dead';
  animal.deathTick = 0;
  s.tick = 1801;
  step(s, []);
  expect(s.entities.some((e) => e.id === ore.id || e.id === animal.id)).toBe(false);
});
