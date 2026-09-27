import {expect, test} from 'vitest';
import {
  createMatch,
  step,
  createSnapshot,
  serializeSave,
  restoreSave,
  checksum,
  type MatchState,
} from '../../packages/sim/src/index';
import type {Command} from '../../packages/protocol/src/index';
const setup = (aiCount: 0 | 1 | 2 | 3 = 1) =>
  createMatch({
    v: 1,
    seed: 73,
    difficulty: 'standard',
    mode: 'skirmish',
    populationCap: 200,
    gameSpeed: 1,
    aiCount,
    fogOfWar: false,
  });
function order(s: MatchState, fields: object) {
  step(s, [{v: 1, tick: s.tick + 1, sequence: s.tick + 1, playerId: 1, ...fields} as Command]);
}
function ticks(s: MatchState, n: number) {
  for (let i = 0; i < n; i++) step(s, []);
}
test('zero to three AI opponents get independent players, starts, commands and save state', () => {
  for (const count of [0, 1, 2, 3] as const) {
    const s = setup(count);
    expect(s.players.length).toBe(count + 1);
    expect(s.entities.filter((e) => e.kind === 'hall')).toHaveLength(count + 1);
    ticks(s, 200);
    for (const p of s.players.slice(1)) expect(s.commandLog.some((c) => c.playerId === p.id)).toBe(true);
    const copy = restoreSave(serializeSave(s));
    expect(checksum(copy)).toBe(checksum(s));
    if (!count) expect(s.winner).toBeNull();
    else expect(createSnapshot(s, 1).players.length).toBe(count + 1);
  }
});
test('hall garrison deposits mixed cargo, protects workers, fires arrows and resumes their old job', () => {
  const s = setup(),
    hall = s.entities.find((e) => e.owner === 1 && e.kind === 'hall')!,
    w = s.entities.find((e) => e.owner === 1 && e.kind === 'worker')!,
    tree = s.entities.find((e) => e.kind === 'timber')!;
  order(s, {type: 'gather', entityIds: [w.id], targetId: tree.id});
  w.carry = {timber: 400, coin: 200};
  const before = {...s.players[0].resources};
  order(s, {type: 'garrison', entityIds: [w.id], targetId: hall.id});
  ticks(s, 200);
  expect(w.garrisonedIn).toBe(hall.id);
  expect(w.carry).toEqual({});
  expect(s.players[0].resources.timber).toBe(before.timber + 400);
  expect(s.players[0].resources.coin).toBe(before.coin + 200);
  const enemy = s.entities.find((e) => e.owner === 2 && e.kind === 'worker')!;
  enemy.x = hall.x + 9 * 256;
  enemy.z = hall.z;
  const hp = enemy.hp;
  ticks(s, 60);
  expect(enemy.hp).toBeLessThan(hp);
  order(s, {type: 'ungarrison', buildingId: hall.id, returnToWork: true});
  expect(w.garrisonedIn).toBeUndefined();
  expect(w.resourceTargetId).toBe(tree.id);
  expect(w.task).toBe('gather');
});
test('a new job retains prior cargo but its active resource and ten-unit limit change', () => {
  const s = setup(),
    w = s.entities.find((e) => e.owner === 1 && e.kind === 'worker')!,
    tree = s.entities.find((e) => e.kind === 'timber')!;
  w.carry = {coin: 500};
  order(s, {type: 'gather', entityIds: [w.id], targetId: tree.id});
  expect(w.activeResource).toBe('timber');
  let worked = false,
    depositedPriorCargo = false;
  for (let i = 0; i < 200; i++) {
    step(s, []);
    depositedPriorCargo ||= s.players[0].stats.gathered.coin >= 500;
    if ((w.carry.timber ?? 0) > 0) {
      worked = true;
      if (!depositedPriorCargo) expect(w.carry.coin).toBe(500);
    }
    expect(w.carry.timber ?? 0).toBeLessThanOrEqual(1000);
  }
  expect(worked).toBe(true);
  expect(depositedPriorCargo).toBe(true);
});
test('idle units are never displaced by another unit walking past', () => {
  const s = setup(0),
    workers = s.entities.filter((e) => e.kind === 'worker'),
    a = workers[0],
    b = workers[1];
  a.x = 40 * 256;
  a.z = 60 * 256;
  b.x = a.x + 800;
  b.z = a.z;
  const start = {x: b.x, z: b.z};
  order(s, {type: 'move', entityIds: [a.id], x: a.x + 2200, z: a.z});
  ticks(s, 160);
  expect({x: b.x, z: b.z}).toEqual(start);
  expect(a.x).toBeGreaterThan(b.x + 400);
});
test('shore and inland fishing sites remain present and reachable', () => {
  const s = setup(0),
    fish = s.entities.filter((e) => e.kind === 'fish');
  expect(fish.length).toBeGreaterThanOrEqual(7);
  const w = s.entities.find((e) => e.kind === 'worker')!,
    site = fish.sort((a, b) => Math.hypot(a.x - w.x, a.z - w.z) - Math.hypot(b.x - w.x, b.z - w.z))[0];
  expect(site).toBeDefined();
  order(s, {type: 'gather', entityIds: [w.id], targetId: site.id});
  ticks(s, 450);
  expect(s.players[0].stats.gathered.provisions + (w.carry.provisions ?? 0)).toBeGreaterThan(0);
});
