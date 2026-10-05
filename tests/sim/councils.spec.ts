import {expect, test} from 'vitest';
import {advancements, councilChoices, councilModifiers, unitById} from '../../packages/content/src/index';
import {checksum, createMatch, restoreSave, serializeSave, step, type MatchState} from '../../packages/sim/src/index';
import type {Command} from '../../packages/protocol/src/index';
function match() {
  return createMatch({
    v: 1,
    seed: 73,
    mode: 'skirmish',
    difficulty: 'standard',
    populationCap: 200,
    gameSpeed: 1,
    aiCount: 0,
  });
}
function run(s: MatchState, ticks: number) {
  for (let i = 0; i < ticks; i++) step(s, []);
}
function order(s: MatchState, fields: object) {
  step(s, [{v: 1, tick: s.tick + 1, sequence: s.tick + 1, playerId: 1, ...fields} as Command]);
}

test('every age has three legal council choices and every choice has a described modifier', () => {
  for (const age of [2, 3, 4]) expect(councilChoices.filter((c) => c.age === age)).toHaveLength(3);
  for (const c of councilChoices) expect(councilModifiers[c.modifier].description.length).toBeGreaterThan(10);
});
test('advancement reserves full cost and applies the chosen delivery and bonus after its duration', () => {
  const s = match(),
    p = s.players[0],
    a = advancements[0],
    c = councilChoices.find((c) => c.id === 'charter-guard')!;
  p.resources = {provisions: 100000, timber: 100000, coin: 100000, metal: 100000};
  order(s, {type: 'advance', councilId: c.id});
  expect(p.resources.provisions).toBe(100000 - a.cost.provisions);
  expect(p.age).toBe(1);
  expect(p.modifiers).toHaveLength(0);
  run(s, a.ticks - 2);
  expect(p.age).toBe(1);
  step(s, []);
  expect(p.age).toBe(2);
  expect(p.modifiers).toEqual(['military']);
  expect(p.resources.provisions).toBe(100000 - a.cost.provisions + c.delivery.provisions);
  expect(p.resources.coin).toBe(100000 + c.delivery.coin);
});
test('an incomplete hall prevents ordering advancement and pauses an existing advance', () => {
  const s = match(),
    p = s.players[0],
    hall = s.entities.find((e) => e.kind === 'hall')!;
  p.resources = {provisions: 100000, timber: 100000, coin: 100000, metal: 100000};
  hall.progress = 9000;
  hall.task = 'idle';
  order(s, {type: 'advance', councilId: 'harvest-council'});
  expect(p.advancing).toBeUndefined();
  expect(p.resources.provisions).toBe(100000);
  hall.progress = 10000;
  order(s, {type: 'advance', councilId: 'harvest-council'});
  const remaining = p.advancing!.remaining;
  hall.progress = 9000;
  run(s, 20);
  expect(p.advancing!.remaining).toBe(remaining);
  expect(p.advancing!.waiting).toContain('central hall');
  hall.progress = 10000;
  step(s, []);
  expect(p.advancing!.remaining).toBe(remaining - 1);
});
test('guild training uses integer fractional progress and remains identical after a mid-queue save', () => {
  const s = match(),
    p = s.players[0],
    hall = s.entities.find((e) => e.kind === 'hall')!;
  p.modifiers = ['production'];
  order(s, {type: 'train', buildingId: hall.id, unitId: 'worker'});
  run(s, 99);
  expect(hall.queue[0].remaining).toBe(unitById.get('worker')!.trainTicks - 125);
  const restored = restoreSave(serializeSave(s));
  run(s, 100);
  run(restored, 100);
  expect(checksum(restored)).toBe(checksum(s));
});
test('Coastal Trade changes actual market income', () => {
  const baseline = match(),
    bonus = match();
  for (const s of [baseline, bonus]) {
    const hall = s.entities.find((e) => e.kind === 'hall')!;
    s.entities.push({...structuredClone(hall), id: s.nextEntityId++, kind: 'market', x: hall.x + 5000});
  }
  bonus.players[0].modifiers = ['market'];
  run(baseline, 100);
  run(bonus, 100);
  expect(bonus.players[0].resources.coin - baseline.players[0].resources.coin).toBe(20);
});
test('military, artillery and defensive councils change actual projectile damage equally for either player', () => {
  for (const owner of [1, 2] as const) {
    const s = createMatch({...match().config, aiCount: 1});
    const source = s.entities.find((e) => e.owner === owner && e.kind === 'worker')!;
    source.kind = 'cannon';
    source.damage = 100;
    const enemy = owner === 1 ? 2 : 1;
    const target = s.entities.find((e) => e.owner === enemy && e.kind === 'hall')!;
    s.players[owner - 1].modifiers = ['military', 'industrial-military'];
    s.players[enemy - 1].modifiers = ['defense'];
    const hp = target.hp;
    s.projectiles.push({
      id: s.nextEntityId++,
      owner,
      sourceId: source.id,
      targetId: target.id,
      x: target.x,
      z: target.z,
      impactTick: 1,
      damage: 100,
    });
    step(s, []);
    expect(hp - target.hp).toBe(112);
  }
});
