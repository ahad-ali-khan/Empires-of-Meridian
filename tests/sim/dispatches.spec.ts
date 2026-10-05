import {expect, test} from 'vitest';
import {dispatches} from '../../packages/content/src/index';
import {
  checksum,
  createMatch,
  createSnapshot,
  restoreSave,
  serializeSave,
  step,
  type MatchState,
} from '../../packages/sim/src/index';
import type {Command} from '../../packages/protocol/src/index';
function match() {
  const s = createMatch({
    v: 1,
    seed: 73,
    mode: 'skirmish',
    difficulty: 'standard',
    populationCap: 200,
    gameSpeed: 1,
    aiCount: 0,
  });
  s.players[0].tokens = 10;
  return s;
}
function order(s: MatchState, type: 'dispatch' | 'cancel-dispatch', dispatchId: string) {
  step(s, [{v: 1, tick: s.tick + 1, playerId: 1, sequence: s.tick + 1, type, dispatchId} as Command]);
}
function until(s: MatchState, tick: number) {
  while (s.tick < tick) step(s, []);
}

test('all 24 starter cards have distinct names and valid effects', () => {
  expect(dispatches).toHaveLength(24);
  expect(new Set(dispatches.map((d) => d.name)).size).toBe(24);
  for (const card of dispatches)
    expect(card.units.length || Object.values(card.resources).some((n) => n > 0)).toBeTruthy();
});
test('resources arrive on the scheduled tick and a card cannot be sent twice', () => {
  const s = match(),
    p = s.players[0],
    before = p.resources.provisions;
  order(s, 'dispatch', 'charter-1');
  expect(p.tokens).toBe(9);
  expect(p.resources.provisions).toBe(before);
  const arrival = p.pendingDispatches[0].arrivalTick;
  order(s, 'dispatch', 'charter-1');
  expect(p.tokens).toBe(9);
  until(s, arrival - 1);
  expect(p.resources.provisions).toBe(before);
  step(s, []);
  expect(p.resources.provisions).toBe(before + 15000);
  expect(p.stats.dispatches).toBe(1);
  order(s, 'dispatch', 'charter-1');
  expect(p.tokens).toBe(9);
  expect(p.pendingDispatches).toHaveLength(0);
});
test('cancellation refunds before departure and rejects at or after departure', () => {
  const s = match(),
    p = s.players[0];
  order(s, 'dispatch', 'charter-1');
  order(s, 'cancel-dispatch', 'charter-1');
  expect(p.tokens).toBe(10);
  expect(p.pendingDispatches).toHaveLength(0);
  expect(p.usedDispatches).toHaveLength(0);
  order(s, 'dispatch', 'charter-1');
  until(s, p.pendingDispatches[0].departureTick - 1);
  order(s, 'cancel-dispatch', 'charter-1');
  expect(p.tokens).toBe(9);
  expect(p.pendingDispatches).toHaveLength(1);
});
test('unit deliveries wait at population cap and then spawn distinct real workers', () => {
  const s = match(),
    p = s.players[0];
  const before = s.entities.filter((e) => e.owner === 1 && e.kind === 'worker').length;
  p.populationCap = 1;
  order(s, 'dispatch', 'charter-5');
  until(s, p.pendingDispatches[0].arrivalTick);
  expect(p.pendingDispatches[0].waiting).toContain('population');
  expect(s.entities.filter((e) => e.owner === 1 && e.kind === 'worker')).toHaveLength(before);
  p.populationCap = 200;
  step(s, []);
  expect(s.entities.filter((e) => e.owner === 1 && e.kind === 'worker')).toHaveLength(before + 2);
  const created = s.entities.filter((e) => e.owner === 1 && e.kind === 'worker').slice(-2);
  expect([created[0].x, created[0].z]).not.toEqual([created[1].x, created[1].z]);
  expect(p.pendingDispatches).toHaveLength(0);
});
test('a missing arrival site delays resource delivery until a completed site exists', () => {
  const s = match(),
    p = s.players[0],
    hall = s.entities.find((e) => e.owner === 1 && e.kind === 'hall')!;
  order(s, 'dispatch', 'charter-1');
  hall.progress = 9000;
  hall.task = 'idle';
  until(s, p.pendingDispatches[0].arrivalTick);
  expect(p.pendingDispatches[0].waiting).toContain('central hall');
  hall.progress = 10000;
  step(s, []);
  expect(p.usedDispatches).toEqual(['charter-1']);
});
test('save/load during transit preserves final checksums and hides the charter from enemies', () => {
  const s = match();
  order(s, 'dispatch', 'charter-6');
  until(s, 150);
  const restored = restoreSave(serializeSave(s));
  expect(checksum(restored)).toBe(checksum(s));
  const onlineShape = createMatch({...s.config, aiCount: 1});
  onlineShape.players[0].tokens = 1;
  order(onlineShape, 'dispatch', 'charter-1');
  expect(createSnapshot(onlineShape, 2).players[0].pendingDispatches).toHaveLength(0);
  expect(createSnapshot(s, 1).players[0].pendingDispatches).toHaveLength(1);
  until(s, 650);
  until(restored, 650);
  expect(checksum(restored)).toBe(checksum(s));
  expect(s.players[0].usedDispatches).toEqual(['charter-6']);
  expect(s.entities.filter((e) => e.owner === 1 && e.kind === 'militia')).toHaveLength(3);
});

test('delivery respects population reserved by unfinished training queues', () => {
  const s = match(),
    p = s.players[0],
    hall = s.entities.find((e) => e.owner === 1 && e.kind === 'hall')!;
  const live = s.entities
    .filter((e) => e.owner === 1 && e.category === 'unit')
    .reduce((sum, e) => sum + e.population, 0);
  p.populationCap = live + 2;
  hall.queue = [{kind: 'worker', remaining: 1000, total: 1000}];
  p.population = live + 1;
  order(s, 'dispatch', 'charter-5');
  until(s, p.pendingDispatches[0].arrivalTick);
  expect(p.pendingDispatches[0].waiting).toContain('population');
  p.populationCap += 1;
  step(s, []);
  expect(p.pendingDispatches).toHaveLength(0);
  expect(p.population).toBe(live + 3);
});
