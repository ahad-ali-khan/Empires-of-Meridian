import {expect, test} from 'vitest';
import {buildingById} from '../../packages/content/src/index';
import {
  createMatch,
  step,
  placementReason,
  checksum,
  serializeSave,
  restoreSave,
  type MatchState,
} from '../../packages/sim/src/index';
import {wallSpans, wallPlacementReason} from '../../packages/sim/src/walls';
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
  const worker = s.entities.find((e) => e.kind === 'worker')!,
    hall = s.entities.find((e) => e.kind === 'hall')!;
  s.entities = [worker, hall];
  s.players[0].resources.timber = 100000;
  const spots: {x: number; z: number}[] = [];
  for (let z = -25; z <= 25; z += 10)
    for (let x = -25; x <= 25; x += 10) {
      const point = {x: hall.x + x * 256, z: hall.z + z * 256};
      if (!placementReason(s, 'house', point.x, point.z)) spots.push(point);
    }
  return {s, worker, spots};
}
function command(s: MatchState, fields: object) {
  step(s, [{v: 1, tick: s.tick + 1, sequence: s.tick + 1, playerId: 1, ...fields} as Command]);
}
function run(s: MatchState, n: number) {
  for (let i = 0; i < n; i++) step(s, []);
}

test('Shift blueprints reserve costs and footprints, preserve movement, then build in order across saves', () => {
  const {s, worker, spots} = fixture();
  command(s, {type: 'move', entityIds: [worker.id], x: spots[0].x, z: spots[0].z + 1200});
  command(s, {type: 'build', workerIds: [worker.id], buildingId: 'house', ...spots[0], queued: true, rotation: 1});
  command(s, {type: 'build', workerIds: [worker.id], buildingId: 'house', ...spots[1], queued: true});
  const plans = s.entities.filter((e) => e.kind === 'house');
  expect(worker.task).toBe('move');
  expect(worker.orders?.map((c) => c.type)).toEqual(['resume-build', 'resume-build']);
  expect(plans.map((e) => e.progress)).toEqual([0, 0]);
  expect(s.players[0].resources.timber).toBe(100000 - 2 * buildingById.get('house')!.cost.timber);
  expect(placementReason(s, 'house', spots[0].x, spots[0].z)).toContain('overlaps');
  const copy = restoreSave(serializeSave(s));
  run(s, 1800);
  run(copy, 1800);
  expect(plans.map((e) => e.progress)).toEqual([10000, 10000]);
  expect(worker.orders).toEqual([]);
  expect(checksum(s)).toBe(checksum(copy));
});

test('invalid queued placement and a full order queue do not reserve money or erase work', () => {
  const {s, worker, spots} = fixture();
  command(s, {type: 'build', workerIds: [worker.id], buildingId: 'house', ...spots[0]});
  const first = worker.targetId,
    money = s.players[0].resources.timber;
  command(s, {type: 'build', workerIds: [worker.id], buildingId: 'house', ...spots[0], queued: true});
  expect(worker.targetId).toBe(first);
  expect(s.players[0].resources.timber).toBe(money);
  worker.orders = Array.from({length: 32}, () => ({type: 'move' as const, x: worker.x, z: worker.z}));
  command(s, {type: 'build', workerIds: [worker.id], buildingId: 'house', ...spots[1], queued: true});
  expect(s.entities.filter((e) => e.kind === 'house')).toHaveLength(1);
  expect(s.players[0].resources.timber).toBe(money);
  expect(worker.orders).toHaveLength(32);
});

test('immediate construction replaces queued work, Stop leaves reserved structures resumable', () => {
  const {s, worker, spots} = fixture();
  command(s, {type: 'move', entityIds: [worker.id], x: worker.x + 2000, z: worker.z});
  command(s, {type: 'build', workerIds: [worker.id], buildingId: 'house', ...spots[0], queued: true});
  const reserved = s.entities.find((e) => e.kind === 'house')!;
  command(s, {type: 'build', workerIds: [worker.id], buildingId: 'house', ...spots[1]});
  expect(worker.orders).toEqual([]);
  expect(worker.targetId).not.toBe(reserved.id);
  command(s, {type: 'stop', entityIds: [worker.id]});
  expect(reserved.progress).toBe(0);
  command(s, {type: 'resume-build', entityIds: [worker.id], targetId: reserved.id});
  run(s, 1000);
  expect(reserved.progress).toBe(10000);
});

test('cancelling a reserved blueprint releases its footprint, order and cost exactly once', () => {
  const {s, worker, spots} = fixture();
  command(s, {type: 'move', entityIds: [worker.id], x: worker.x + 2500, z: worker.z});
  command(s, {type: 'build', workerIds: [worker.id], buildingId: 'house', ...spots[0], queued: true});
  const plan = s.entities.find((e) => e.kind === 'house')!;
  expect(plan.progress).toBe(0);
  command(s, {type: 'cancel-construction', buildingId: plan.id});
  expect(s.entities.some((e) => e.id === plan.id)).toBe(false);
  expect(worker.orders).toEqual([]);
  expect(worker.task).toBe('move');
  expect(s.players[0].resources.timber).toBe(100000);
  expect(placementReason(s, 'house', spots[0].x, spots[0].z)).toBe('');
  command(s, {type: 'cancel-construction', buildingId: plan.id});
  expect(s.players[0].resources.timber).toBe(100000);
  command(s, {type: 'build', workerIds: [worker.id], buildingId: 'house', ...spots[0]});
  const active = s.entities.find((e) => e.kind === 'house')!;
  active.progress = 100;
  const money = s.players[0].resources.timber;
  command(s, {type: 'cancel-construction', buildingId: active.id});
  expect(s.players[0].resources.timber).toBe(money + Math.trunc(buildingById.get('house')!.cost.timber / 2));
});

test('queued wall chains preserve movement and execute each reserved segment', () => {
  const {s, worker, spots} = fixture();
  s.players[0].age = 2;
  s.players[0].resources.metal = 100000;
  const start = spots.find((p) => !wallPlacementReason(s, wallSpans(p.x, p.z, p.x + 2500, p.z), 1))!;
  expect(start).toBeDefined();
  command(s, {type: 'move', entityIds: [worker.id], x: worker.x + 2500, z: worker.z});
  command(s, {
    type: 'build',
    workerIds: [worker.id],
    buildingId: 'wall',
    ...start,
    endX: start.x + 2500,
    endZ: start.z,
    queued: true,
  });
  const walls = s.entities.filter((e) => e.kind === 'wall');
  expect(walls.length).toBeGreaterThan(1);
  expect(worker.task).toBe('move');
  expect(worker.orders).toHaveLength(walls.length);
  run(s, 1800);
  expect(walls.every((e) => e.progress === 10000)).toBe(true);
});
