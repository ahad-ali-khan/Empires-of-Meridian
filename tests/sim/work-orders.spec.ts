import {expect, test} from 'vitest';
import {
  createMatch,
  step,
  type MatchState,
  type Entity,
  checksum,
  serializeSave,
  restoreSave,
} from '../../packages/sim/src/index';
import {buildingById, unitById} from '../../packages/content/src/index';
import {blocked} from '../../packages/sim/src/navigation';
import {perimeterPoint} from '../../packages/sim/src/spatial';
import type {Command} from '../../packages/protocol/src/index';
const setup = () =>
  createMatch({
    v: 1,
    seed: 73,
    difficulty: 'standard',
    mode: 'skirmish',
    populationCap: 200,
    gameSpeed: 1,
    fogOfWar: false,
    mapSize: 'small',
  });
function order(s: MatchState, fields: object) {
  step(s, [{v: 1, tick: s.tick + 1, playerId: 1, sequence: s.tick + 1, ...fields} as Command]);
}
function ticks(s: MatchState, n: number) {
  for (let i = 0; i < n; i++) step(s, []);
}
function building(s: MatchState, kind: string, x: number, z: number) {
  const d = buildingById.get(kind)!;
  const e = {
    ...s.entities.find((e) => e.kind === 'hall')!,
    id: s.nextEntityId++,
    kind,
    model: d.model,
    x,
    z,
    hp: d.hp,
    maxHp: d.hp,
    queue: [],
    progress: 10000,
  };
  s.entities.push(e);
  return e;
}
test('workers approach before working, occupy different berry positions, and visibly carry provisions', () => {
  const s = setup(),
    workers = s.entities.filter((e) => e.owner === 1 && e.kind === 'worker'),
    b = s.entities.find((e) => e.kind === 'provisions')!;
  order(s, {type: 'gather', entityIds: workers.map((e) => e.id), targetId: b.id});
  expect(workers.every((e) => !e.working)).toBe(true);
  let active: Entity[] = [];
  for (let i = 0; i < 100 && active.length < 2; i++) {
    ticks(s, 1);
    active = workers.filter((e) => e.working);
  }
  expect(active.length).toBeGreaterThan(1);
  expect(new Set(active.map((e) => e.workSlot)).size).toBe(active.length);
  for (const a of active)
    for (const c of active)
      if (a !== c) expect(Math.max(Math.abs(a.x - c.x), Math.abs(a.z - c.z))).toBeGreaterThan(200);
  expect(workers.some((e) => (e.carry.provisions ?? 0) > 0)).toBe(true);
});
test('timber depletion retargets nearby trees after delivering the last load', () => {
  const s = setup(),
    w = s.entities.find((e) => e.owner === 1 && e.kind === 'worker')!,
    tree = s.entities.find((e) => e.kind === 'timber')!;
  tree.amount = 24;
  order(s, {type: 'gather', entityIds: [w.id], targetId: tree.id});
  ticks(s, 650);
  expect(tree.amount).toBe(0);
  expect(tree.stumpSince).toBeDefined();
  expect(w.resourceTargetId).not.toBe(tree.id);
  expect(w.resourceKind).toBe('timber');
  expect(w.task).not.toBe('idle');
  expect(s.players[0].stats.gathered.timber).toBeGreaterThan(0);
  ticks(s, Math.max(1, 601 - (s.tick - tree.stumpSince!)));
  expect(s.entities.some((e) => e.id === tree.id)).toBe(false);
});
test('a farm accepts two workers and rejects excess without garrisoning', () => {
  const s = setup(),
    workers = s.entities.filter((e) => e.owner === 1 && e.kind === 'worker'),
    f = building(s, 'farm', 50 * 256, 70 * 256);
  workers.forEach((w, i) => {
    w.x = f.x - 1800;
    w.z = f.z + i * 300;
  });
  order(s, {type: 'gather', entityIds: workers.map((e) => e.id), targetId: f.id});
  ticks(s, 80);
  expect(workers.filter((e) => e.working)).toHaveLength(2);
  expect(workers.every((e) => !e.garrisonedIn)).toBe(true);
  ticks(s, 60);
  expect(workers.filter((e) => e.task === 'idle')).toHaveLength(2);
});
test('captured sheep follow their captor, then obey a direct move order', () => {
  const s = setup(),
    w = s.entities.find((e) => e.owner === 1 && e.kind === 'worker')!,
    sheep = s.entities.find((e) => e.kind === 'sheep')!;
  w.x = 40 * 256;
  w.z = 60 * 256;
  sheep.x = w.x - 300;
  sheep.z = w.z;
  sheep.owner = 0;
  ticks(s, 10);
  expect(sheep.owner).toBe(1);
  expect(sheep.followId).toBe(w.id);
  w.z += 1800;
  ticks(s, 20);
  expect(sheep.task).toBe('move');
  const x = sheep.x - 1200,
    z = sheep.z;
  order(s, {type: 'move', entityIds: [sheep.id], x, z});
  expect(sheep.followId).toBeUndefined();
  ticks(s, 115);
  expect(Math.abs(sheep.x - x)).toBeLessThan(220);
});
test('fort builders make progress and mounted recruits honor a stable rally', () => {
  const s = setup(),
    w = s.entities.find((e) => e.owner === 1 && e.kind === 'worker')!,
    fort = building(s, 'fort', 50 * 256, 70 * 256);
  fort.progress = 0;
  fort.hp = 1;
  w.x = fort.x - 2500;
  w.z = fort.z;
  order(s, {type: 'resume-build', entityIds: [w.id], targetId: fort.id});
  ticks(s, 180);
  expect(fort.progress).toBeGreaterThan(100);
  const stable = building(s, 'stable', 75 * 256, 72 * 256),
    rally = {x: stable.x + 3000, z: stable.z};
  order(s, {type: 'rally', buildingIds: [stable.id], ...rally});
  stable.queue = [{kind: 'lightRider', remaining: 1, total: 1}];
  ticks(s, 2);
  const rider = s.entities.find((e) => e.owner === 1 && e.kind === 'lightRider')!;
  expect(rider).toBeDefined();
  expect(rider.destX).toBe(rally.x);
  expect(blocked(s, rider.x, rider.z)).toBe(false);
  ticks(s, 120);
  expect(Math.abs(rider.x - rally.x)).toBeLessThan(220);
  order(s, {type: 'move', entityIds: [rider.id], x: rally.x, z: rally.z - 2500});
  ticks(s, 100);
  expect(Math.abs(rider.z - (rally.z - 2500))).toBeLessThan(220);
  const restored = restoreSave(serializeSave(s));
  ticks(s, 20);
  ticks(restored, 20);
  expect(checksum(restored)).toBe(checksum(s));
});
test('workers repair damaged completed buildings', () => {
  const s = setup(),
    worker = s.entities.find((e) => e.owner === 1 && e.kind === 'worker')!,
    hall = s.entities.find((e) => e.owner === 1 && e.kind === 'hall')!;
  hall.hp = Math.trunc(hall.maxHp / 2);
  worker.x = hall.x - 2500;
  worker.z = hall.z;
  order(s, {type: 'resume-build', entityIds: [worker.id], targetId: hall.id});
  ticks(s, 220);
  expect(hall.progress).toBe(10000);
  expect(hall.hp).toBeGreaterThan(Math.trunc(hall.maxHp / 2));
  expect(worker.task).toBe('idle');
});
test('workers choose open resource and drop-off slots around blocking units', () => {
  const s = setup(),
    worker = s.entities.find((e) => e.owner === 1 && e.kind === 'worker')!,
    resource = s.entities.find((e) => e.kind === 'provisions')!,
    hall = s.entities.find((e) => e.owner === 1 && e.kind === 'hall')!,
    blocker = {...structuredClone(worker), id: s.nextEntityId++, task: 'idle' as const};
  const blockedResourceSlot = perimeterPoint(resource, 0, 165);
  blocker.x = blockedResourceSlot.x;
  blocker.z = blockedResourceSlot.z;
  s.entities.push(blocker);
  worker.x = resource.x - 2500;
  worker.z = resource.z;
  order(s, {type: 'gather', entityIds: [worker.id], targetId: resource.id});
  ticks(s, 180);
  expect(worker.working || worker.task === 'carry').toBe(true);
  const dropSlot = perimeterPoint(hall, 0, 120);
  blocker.x = dropSlot.x;
  blocker.z = dropSlot.z;
  worker.carry.provisions = 1000;
  worker.task = 'carry';
  worker.homeId = hall.id;
  worker.targetId = hall.id;
  worker.x = hall.x - 2500;
  worker.z = hall.z;
  ticks(s, 180);
  expect(s.players[0].resources.provisions).toBeGreaterThan(26000);
});
test('workers route around a standing soldier crowd on the way to work', () => {
  const s = setup(),
    worker = s.entities.find((e) => e.owner === 1 && e.kind === 'worker')!,
    resource = s.entities.find((e) => e.kind === 'provisions')!,
    soldier = s.entities.find((e) => e.owner === 1 && e.category === 'unit' && e.kind !== 'worker')!;
  const crowd = Array.from({length: 5}, (_, i) => ({
    ...structuredClone(soldier),
    id: s.nextEntityId++,
    x: resource.x - 1800 + (i % 3) * 110,
    z: resource.z - 220 + Math.floor(i / 3) * 110,
    task: 'idle' as const,
    stance: 'no-attack' as const,
  }));
  s.entities.push(...crowd);
  worker.x = resource.x - 4200;
  worker.z = resource.z;
  order(s, {type: 'gather', entityIds: [worker.id], targetId: resource.id});
  ticks(s, 260);
  expect(worker.working || worker.task === 'carry').toBe(true);
});
