import {expect, test} from 'vitest';
import {technologies, councilRate, unitById} from '../../packages/content/src/index';
import {
  checksum,
  createMatch,
  restoreSave,
  serializeSave,
  step,
  evaluatedAttackDamage,
  type MatchState,
} from '../../packages/sim/src/index';
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
  });
  s.players[0].resources = {provisions: 100000, timber: 100000, coin: 100000, metal: 100000};
  const hall = s.entities.find((e) => e.owner === 1 && e.kind === 'hall')!;
  return {s, p: s.players[0], hall};
}
function order(s: MatchState, fields: object, playerId = 1) {
  step(s, [{v: 1, tick: s.tick + 1, sequence: s.tick + 1, playerId, ...fields} as Command]);
}
function run(s: MatchState, n: number) {
  for (let i = 0; i < n; i++) step(s, []);
}
test('research is paid upfront, timed, applied once, and replay-identical after save/load', () => {
  const {s, p, hall} = fixture();
  const t = technologies.find((t) => t.id === 'improved-tools')!;
  order(s, {type: 'research', buildingId: hall.id, technologyId: t.id});
  expect(p.resources.provisions).toBe(100000 - t.cost.provisions);
  expect(p.researched).toEqual([]);
  run(s, 137);
  const restored = restoreSave(serializeSave(s));
  run(s, t.ticks - 138);
  run(restored, t.ticks - 138);
  expect(checksum(restored)).toBe(checksum(s));
  expect(p.researched).toEqual([t.id]);
  expect(councilRate(p.modifiers, 'gather')).toBe(12500);
  order(s, {type: 'research', buildingId: hall.id, technologyId: t.id});
  expect(hall.queue).toEqual([]);
  expect(p.resources.provisions).toBe(95000);
});
test('wrong owner, wrong building, early age, missing prerequisite, duplicates and missing funds reject without payment', () => {
  const {s, p, hall} = fixture();
  for (const fields of [
    {technologyId: 'carrying-packs'},
    {technologyId: 'formation-drills'},
    {technologyId: 'missing'},
  ])
    order(s, {type: 'research', buildingId: hall.id, ...fields});
  p.age = 2;
  order(s, {type: 'research', buildingId: hall.id, technologyId: 'carrying-packs'});
  order(s, {type: 'research', buildingId: hall.id, technologyId: 'improved-tools'}, 2);
  expect(hall.queue).toEqual([]);
  expect(p.resources.provisions).toBe(100000);
  p.resources.provisions = 0;
  order(s, {type: 'research', buildingId: hall.id, technologyId: 'improved-tools'});
  expect(hall.queue).toEqual([]);
  p.resources.provisions = 100000;
  order(s, {type: 'research', buildingId: hall.id, technologyId: 'improved-tools'});
  order(s, {type: 'research', buildingId: hall.id, technologyId: 'improved-tools'});
  expect(hall.queue).toHaveLength(1);
  expect(p.resources.provisions).toBe(95000);
});
test('unstarted research behind training cancels for full refund and stale IDs cannot cancel another job', () => {
  const {s, p, hall} = fixture();
  order(s, {type: 'train', buildingId: hall.id, unitId: 'worker'});
  order(s, {type: 'research', buildingId: hall.id, technologyId: 'improved-tools'});
  const id = hall.queue[1].id!;
  expect(hall.queue[1].remaining).toBe(400);
  order(s, {type: 'cancel-production', buildingId: hall.id, queueId: id});
  expect(hall.queue).toHaveLength(1);
  expect(p.resources.provisions).toBe(100000 - unitById.get('worker')!.cost.provisions);
  order(s, {type: 'cancel-production', buildingId: hall.id, queueId: id});
  expect(hall.queue).toHaveLength(1);
});
test('started jobs refund half and cancellation releases exactly the reserved unit population', () => {
  const {s, p, hall} = fixture();
  const population = p.population;
  order(s, {type: 'train', buildingId: hall.id, unitId: 'worker'});
  order(s, {type: 'train', buildingId: hall.id, unitId: 'worker'});
  const id = hall.queue[0].id!;
  expect(p.population).toBe(population + 2);
  order(s, {type: 'cancel-production', buildingId: hall.id, queueId: id});
  expect(p.population).toBe(population + 1);
  expect(p.resources.provisions).toBe(100000 - unitById.get('worker')!.cost.provisions * 1.5);
  const remaining = hall.queue[0].id!;
  order(s, {type: 'cancel-production', buildingId: hall.id, queueId: remaining}, 2);
  expect(hall.queue).toHaveLength(1);
});
test('research pauses with an unfinished building and training bonuses do not accelerate it', () => {
  const {s, p, hall} = fixture();
  p.modifiers.push('production');
  order(s, {type: 'research', buildingId: hall.id, technologyId: 'improved-tools'});
  expect(hall.queue[0].remaining).toBe(399);
  hall.progress = 9000;
  run(s, 10);
  expect(hall.queue[0].remaining).toBe(399);
  hall.progress = 10000;
  run(s, 399);
  expect(p.researched).toEqual(['improved-tools']);
});
test('completed prerequisites unlock subsequent research and real carry modifier', () => {
  const {s, p, hall} = fixture();
  p.age = 2;
  order(s, {type: 'research', buildingId: hall.id, technologyId: 'improved-tools'});
  run(s, 399);
  order(s, {type: 'research', buildingId: hall.id, technologyId: 'carrying-packs'});
  run(s, 399);
  expect(p.researched).toEqual(['improved-tools', 'carrying-packs']);
  expect(councilRate(p.modifiers, 'carry')).toBe(15000);
});
test('combat upgrade changes evaluated damage only after completing research', () => {
  const {s, p, hall} = fixture();
  p.age = 2;
  hall.kind = 'barracks';
  const source = {...s.entities.find((e) => e.kind === 'worker')!, kind: 'militia'};
  order(s, {type: 'research', buildingId: hall.id, technologyId: 'tempered-arms'});
  expect(evaluatedAttackDamage(s, source, 100)).toBe(100);
  run(s, 499);
  expect(evaluatedAttackDamage(s, source, 100)).toBe(110);
});
test('destroying a production building clears its queue and releases reserved population without refunds', () => {
  const {s, p, hall} = fixture();
  hall.kind = 'barracks';
  order(s, {type: 'train', buildingId: hall.id, unitId: 'militia'});
  const population = p.population,
    money = p.resources.provisions;
  const source = s.entities.find((e) => e.kind === 'worker')!;
  s.projectiles.push({
    id: s.nextEntityId++,
    owner: 1,
    sourceId: source.id,
    targetId: hall.id,
    x: hall.x,
    z: hall.z,
    impactTick: s.tick + 1,
    damage: 100000,
  });
  step(s, []);
  expect(hall.hp).toBe(0);
  expect(hall.queue).toEqual([]);
  expect(p.population).toBe(population - 1);
  expect(p.resources.provisions).toBe(money);
});

test('Forged Blades transforms living militia, preserves health and orders, and upgrades future queued militia', () => {
  const {s, p, hall} = fixture();
  p.age = 2;
  hall.kind = 'barracks';
  const worker = s.entities.find((e) => e.kind === 'worker')!;
  const d = unitById.get('militia')!;
  const soldier = {
    ...structuredClone(worker),
    id: s.nextEntityId++,
    kind: 'militia',
    model: d.model,
    maxHp: d.hp,
    hp: Math.trunc(d.hp / 2),
    damage: d.damage,
    task: 'move' as const,
    destX: worker.x + 2000,
    destZ: worker.z,
  };
  s.entities.push(soldier);
  order(s, {type: 'research', buildingId: hall.id, technologyId: 'forged-blades'});
  order(s, {type: 'train', buildingId: hall.id, unitId: 'militia'});
  run(s, 497);
  const goalX = hall.x + 3000;
  soldier.task = 'move';
  soldier.destX = goalX;
  soldier.destZ = hall.z + 4000;
  soldier.path = undefined;
  run(s, 1);
  const upgraded = unitById.get('swordsman')!;
  expect(soldier.kind).toBe('swordsman');
  expect(soldier.model).toBe(upgraded.model);
  expect(soldier.hp).toBe(Math.trunc((Math.trunc(d.hp / 2) * upgraded.hp) / d.hp));
  expect(soldier.destX).toBe(goalX);
  run(s, d.trainTicks);
  expect(s.entities.filter((e) => e.owner === 1 && e.kind === 'swordsman')).toHaveLength(2);
  expect(s.entities.some((e) => e.owner === 1 && e.kind === 'militia')).toBe(false);
});
