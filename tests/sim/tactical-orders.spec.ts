import {expect, test} from 'vitest';
import {unitById} from '../../packages/content/src/index';
import {
  createSnapshot,
  createMatch,
  step,
  serializeSave,
  restoreSave,
  checksum,
  type MatchState,
  type Entity,
} from '../../packages/sim/src/index';
import {blocked} from '../../packages/sim/src/navigation';
import type {Command} from '../../packages/protocol/src/index';
function fixture() {
  const s = createMatch({
    v: 1,
    seed: 73,
    mode: 'skirmish',
    difficulty: 'standard',
    populationCap: 200,
    gameSpeed: 1,
    aiCount: 0,
    fogOfWar: false,
  });
  const base = structuredClone(s.entities.find((e) => e.kind === 'worker')!);
  s.entities = [];
  const add = (kind: string, x = base.x, z = base.z, owner: 1 | 2 = 1) => {
    const d = unitById.get(kind)!;
    const e: Entity = {
      ...structuredClone(base),
      id: s.nextEntityId++,
      kind,
      model: d.model,
      x,
      z,
      owner,
      hp: d.hp,
      maxHp: d.hp,
      damage: d.damage,
      speed: d.speed,
      range: d.range,
      task: 'idle',
      stance: 'no-attack',
      carry: {},
      queue: [],
    };
    s.entities.push(e);
    return e;
  };
  return {s, add, base};
}
function order(s: MatchState, fields: object) {
  step(s, [{v: 1, tick: s.tick + 1, sequence: s.tick + 1, playerId: 1, ...fields} as Command]);
}
function run(s: MatchState, n: number) {
  for (let i = 0; i < n; i++) step(s, []);
}
function distance(e: Entity, x: number, z: number) {
  return Math.max(Math.abs(e.x - x), Math.abs(e.z - z));
}
test('Shift queue preserves active movement, then executes a second destination and persists deterministically', () => {
  const {s, add} = fixture(),
    e = add('worker');
  const x = e.x,
    z = e.z;
  order(s, {type: 'move', entityIds: [e.id], x: x + 1400, z});
  order(s, {type: 'move', entityIds: [e.id], x: x + 1400, z: z + 1400, queued: true});
  expect(e.destZ).toBe(z);
  expect(e.orders).toHaveLength(1);
  const restored = restoreSave(serializeSave(s));
  run(s, 160);
  run(restored, 160);
  expect(checksum(s)).toBe(checksum(restored));
  expect(e.orders).toHaveLength(0);
  expect(distance(e, x + 1400, z + 1400)).toBeLessThan(200);
});
test('new immediate orders replace a queue and stop clears queued actions and combat wind-up', () => {
  const {s, add} = fixture(),
    e = add('militia');
  order(s, {type: 'move', entityIds: [e.id], x: e.x + 1800, z: e.z});
  order(s, {type: 'patrol', entityIds: [e.id], x: e.x + 1800, z: e.z + 800, queued: true});
  expect(e.orders).toHaveLength(1);
  order(s, {type: 'move', entityIds: [e.id], x: e.x, z: e.z + 1000});
  expect(e.orders).toEqual([]);
  e.attackAt = s.tick + 4;
  order(s, {type: 'stop', entityIds: [e.id]});
  expect(e.task).toBe('idle');
  expect(e.attackAt).toBeUndefined();
  expect(e.directive).toBeUndefined();
});
test('invalid targets do not erase existing orders and dead queued targets skip with visible feedback', () => {
  const {s, add} = fixture(),
    e = add('worker'),
    target = add('militia', e.x + 2000, e.z, 2);
  order(s, {type: 'move', entityIds: [e.id], x: e.x + 1000, z: e.z});
  order(s, {type: 'heal', entityIds: [e.id], targetId: target.id});
  expect(e.task).toBe('move');
  expect(s.events.at(-1)?.kind).toBe('rejected');
  order(s, {type: 'attack', entityIds: [e.id], targetId: target.id, queued: true});
  target.hp = 0;
  target.task = 'dead';
  run(s, 100);
  expect(e.orders).toHaveLength(0);
  expect(s.events.some((e) => e.text.includes('Queued order skipped'))).toBe(true);
});
test('attack-move engages an enemy and returns to its commanded destination', () => {
  const {s, add} = fixture(),
    e = add('militia');
  e.stance = 'aggressive';
  const x = e.x,
    z = e.z;
  const target = add('militia', x + 1000, z, 2);
  target.hp = 11;
  target.damage = 0;
  order(s, {type: 'attack-move', entityIds: [e.id], x: x + 2600, z});
  expect(e.task).toBe('attack');
  run(s, 240);
  expect(target.hp).toBe(0);
  expect(distance(e, x + 2600, z)).toBeLessThan(200);
  expect(e.directive).toBeUndefined();
});
test('patrol repeatedly returns to both ends and can be stopped', () => {
  const {s, add} = fixture(),
    e = add('militia'),
    x = e.x,
    z = e.z;
  expect(blocked(s, x + 1200, z)).toBe(false);
  order(s, {type: 'patrol', entityIds: [e.id], x: x + 1200, z});
  run(s, 35);
  expect(e.directive?.returning).toBe(true);
  run(s, 40);
  expect(e.directive?.returning).toBe(false);
  order(s, {type: 'stop', entityIds: [e.id]});
  expect(e.directive).toBeUndefined();
  const pos = e.x;
  run(s, 20);
  expect(e.x).toBe(pos);
});
test('guards follow moving friendly targets and release the order when their target dies', () => {
  const {s, add} = fixture(),
    e = add('militia'),
    friend = add('worker', e.x + 1200, e.z);
  order(s, {type: 'guard', entityIds: [e.id], targetId: friend.id});
  expect(e.directive?.kind).toBe('guard');
  friend.x += 1600;
  run(s, 100);
  expect(distance(e, friend.x, friend.z)).toBeLessThan(1000);
  friend.hp = 0;
  friend.task = 'dead';
  run(s, 1);
  expect(e.directive).toBeUndefined();
});
test('medics approach injured friendlies and heal on fixed ticks, never enemies or machines', () => {
  const {s, add} = fixture(),
    e = add('medic'),
    friend = add('militia', e.x + 1800, e.z);
  friend.hp = friend.maxHp - 20;
  order(s, {type: 'heal', entityIds: [e.id], targetId: friend.id});
  expect(friend.hp).toBe(friend.maxHp - 20);
  expect(e.working).toBe(false);
  run(s, 140);
  expect(friend.hp).toBe(friend.maxHp);
  const machine = add('ramWagon', e.x + 500, e.z);
  machine.hp -= 20;
  order(s, {type: 'heal', entityIds: [e.id], targetId: machine.id});
  expect(s.events.at(-1)?.kind).toBe('rejected');
  expect(machine.hp).toBe(machine.maxHp - 20);
});
test('group queues reserve separated destinations and ignore duplicate unit IDs', () => {
  const {s, add} = fixture(),
    a = add('worker'),
    b = add('worker', a.x, a.z + 400);
  const x = a.x + 1500,
    z = a.z + 1000;
  order(s, {type: 'move', entityIds: [a.id, b.id, a.id], x, z});
  expect([a.destX, a.destZ]).not.toEqual([b.destX, b.destZ]);
  order(s, {type: 'move', entityIds: [a.id, b.id, a.id], x: x + 800, z, queued: true});
  expect(a.orders).toHaveLength(1);
  expect(b.orders).toHaveLength(1);
});
test('queued activations do not duplicate the authoritative command log', () => {
  const {s, add} = fixture(),
    e = add('worker'),
    x = e.x,
    z = e.z;
  order(s, {type: 'move', entityIds: [e.id], x: x + 500, z});
  order(s, {type: 'move', entityIds: [e.id], x: x + 500, z: z + 500, queued: true});
  expect(s.commandLog.map((c) => c.type)).toEqual(['move', 'move']);
  run(s, 100);
  expect(s.commandLog).toHaveLength(2);
});
test('hidden guard and attack targets are rejected without replacing current movement', () => {
  const {s, add} = fixture(),
    e = add('militia'),
    target = add('militia', e.x + 1000, e.z, 2);
  s.config.fogOfWar = true;
  s.fog[0].fill(0);
  order(s, {type: 'move', entityIds: [e.id], x: e.x + 2000, z: e.z});
  target.x = s.map.size - 600;
  target.z = s.map.size - 600;
  order(s, {type: 'attack', entityIds: [e.id], targetId: target.id});
  expect(e.task).toBe('move');
  expect(s.events.at(-1)?.kind).toBe('rejected');
});
test('guards defend their friendly target and resume guarding after the enemy dies', () => {
  const {s, add} = fixture(),
    guard = add('militia'),
    friend = add('worker', guard.x + 700, guard.z),
    enemy = add('militia', guard.x + 1300, guard.z, 2);
  guard.stance = 'aggressive';
  enemy.hp = 11;
  enemy.damage = 0;
  order(s, {type: 'guard', entityIds: [guard.id], targetId: friend.id});
  expect(guard.task).toBe('attack');
  run(s, 100);
  expect(enemy.hp).toBe(0);
  expect(guard.directive?.kind).toBe('guard');
  expect(guard.task).not.toBe('attack');
});
test('worker flee recovery restores its original destination and retains subsequent orders', () => {
  const {s, add} = fixture(),
    e = add('worker'),
    enemy = add('militia', e.x + 500, e.z, 2),
    goal = e.x + 10000;
  order(s, {type: 'move', entityIds: [e.id], x: goal, z: e.z});
  order(s, {type: 'move', entityIds: [e.id], x: goal, z: e.z + 1000, queued: true});
  s.projectiles.push({
    id: s.nextEntityId++,
    owner: 2,
    sourceId: enemy.id,
    targetId: e.id,
    x: e.x,
    z: e.z,
    impactTick: s.tick + 1,
    damage: 1,
  });
  step(s, []);
  expect(e.beforeFlee?.destX).toBe(goal);
  enemy.hp = 0;
  enemy.task = 'dead';
  run(s, 100);
  expect(e.beforeFlee).toBeUndefined();
  expect(e.destX).toBe(goal);
  expect(e.orders).toHaveLength(1);
});
test('repeatedly failed movement reports failure and permits the next queued order', () => {
  const {s, add} = fixture(),
    e = add('worker'),
    x = e.x,
    z = e.z;
  order(s, {type: 'move', entityIds: [e.id], x: x + 3000, z});
  order(s, {type: 'move', entityIds: [e.id], x: x + 1000, z: z + 600, queued: true});
  e.recoveryCount = 10;
  step(s, []);
  expect(e.task).toBe('idle');
  expect(s.events.at(-1)?.text).toContain('Movement failed');
  step(s, []);
  expect(e.task).toBe('move');
  expect(e.orders).toHaveLength(0);
});
test('simultaneous ordered commands replay identically under input permutation', () => {
  const {s, add} = fixture(),
    a = add('worker'),
    b = add('militia', a.x, a.z + 700);
  const restored = restoreSave(serializeSave(s));
  const commands: Command[] = [
    {v: 1, tick: 1, sequence: 1, playerId: 1, type: 'move', entityIds: [a.id], x: a.x + 2000, z: a.z},
    {v: 1, tick: 1, sequence: 2, playerId: 1, type: 'patrol', entityIds: [b.id], x: b.x + 1500, z: b.z},
  ];
  step(s, commands);
  step(restored, [...commands].reverse());
  run(s, 200);
  run(restored, 200);
  expect(checksum(s)).toBe(checksum(restored));
});

test('snapshots expose own order queues but never an opponents pending commands', () => {
  const {s, add} = fixture(),
    e = add('worker'),
    enemy = add('militia', e.x + 1200, e.z, 2);
  order(s, {type: 'move', entityIds: [e.id], x: e.x + 2000, z: e.z});
  order(s, {type: 'move', entityIds: [e.id], x: e.x + 1000, z: e.z + 600, queued: true});
  enemy.orders = structuredClone(e.orders);
  enemy.directive = {kind: 'patrol', x: enemy.x + 3000, z: enemy.z, originX: enemy.x, originZ: enemy.z};
  const snap = createSnapshot(s, 1);
  expect(snap.entities.find((t) => t.id === e.id)?.orders).toHaveLength(1);
  expect(snap.entities.find((t) => t.id === enemy.id)?.orders).toBeUndefined();
  expect(snap.entities.find((t) => t.id === enemy.id)?.directive).toBeUndefined();
});

test('hold stance stops a patrol and clears pending movement instead of restarting it', () => {
  const {s, add} = fixture(),
    e = add('militia');
  order(s, {type: 'patrol', entityIds: [e.id], x: e.x + 2000, z: e.z});
  order(s, {type: 'move', entityIds: [e.id], x: e.x + 1000, z: e.z + 1000, queued: true});
  order(s, {type: 'stance', entityIds: [e.id], stance: 'stand-ground'});
  const x = e.x,
    z = e.z;
  run(s, 30);
  expect(e.directive).toBeUndefined();
  expect(e.orders).toHaveLength(0);
  expect([e.x, e.z]).toEqual([x, z]);
});
