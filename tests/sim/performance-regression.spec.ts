import {expect, test} from 'vitest';
import {checksum, createMatch, step} from '../../packages/sim/src/index';
import {updateVision} from '../../packages/sim/src/visibility';
import {findPath} from '../../packages/sim/src/navigation';
import type {Command} from '../../packages/protocol/src/index';

test('visibility memory remains detached and evicts only rediscovered missing resources', () => {
  const state = createMatch({
    v: 1,
    seed: 73,
    aiCount: 0,
    difficulty: 'standard',
    mode: 'skirmish',
    populationCap: 200,
    gameSpeed: 1,
  });
  const resource = state.entities.find((e) => e.category === 'resource' && state.knowledge[0][e.id])!;
  resource.carry = {timber: 700};
  resource.path = [[resource.x, resource.z]];
  updateVision(state);
  const memory = state.knowledge[0][resource.id];
  resource.carry.timber = 900;
  resource.path[0][0]++;
  expect(memory.carry.timber).toBe(700);
  expect(memory.path![0][0]).toBe(resource.x);
  state.entities = state.entities.filter((e) => e.id !== resource.id);
  updateVision(state);
  expect(state.knowledge[0][resource.id]).toBeUndefined();
  // Removing all sight sources must retain a previously observed resource;
  // derived membership indexes cannot leak its current depletion through fog.
  const hidden = state.entities.find((e) => e.category === 'resource' && state.knowledge[0][e.id])!;
  const known = state.knowledge[0][hidden.id];
  state.entities = state.entities.filter((e) => e.owner !== 1 && e.id !== hidden.id);
  updateVision(state);
  expect(state.knowledge[0][hidden.id]).toEqual(known);
});

test('reused pathfinding workspace cannot mutate a previously returned route', () => {
  const state = createMatch({
    v: 1,
    seed: 73,
    difficulty: 'standard',
    mode: 'skirmish',
    populationCap: 200,
    gameSpeed: 1,
  });
  const from = state.entities.find((e) => e.owner === 1 && e.kind === 'worker')!;
  const to = state.entities.find((e) => e.owner === 2 && e.kind === 'worker')!;
  const route = findPath(state, from, to.x, to.z);
  const captured = structuredClone(route);
  expect(route.at(-1)).toEqual([to.x, to.z]);
  findPath(state, to, from.x, from.z);
  expect(route).toEqual(captured);
  route.shift();
  expect(findPath(state, from, to.x, to.z)).toEqual(captured);
});

test('four-player economy replay preserves pre-optimization golden checksums', () => {
  const state = createMatch({
    v: 1,
    seed: 73,
    aiCount: 3,
    difficulty: 'standard',
    mode: 'skirmish',
    populationCap: 200,
    gameSpeed: 1,
  });
  const workers = state.entities.filter((e) => e.owner === 1 && e.kind === 'worker');
  const commands: Command[] = workers.map((worker, i) => {
    const kind = ['provisions', 'timber', 'coin'][i % 3];
    const target = state.entities
      .filter((e) => e.kind === kind && e.amount > 0)
      .sort(
        (a, b) =>
          (a.x - worker.x) ** 2 + (a.z - worker.z) ** 2 - ((b.x - worker.x) ** 2 + (b.z - worker.z) ** 2) ||
          a.id - b.id,
      )[0];
    return {v: 1, tick: 1, playerId: 1, sequence: i + 1, type: 'gather', entityIds: [worker.id], targetId: target.id};
  });
  for (let i = 0; i < 1200; i++) {
    step(state, i === 0 ? commands : []);
    if (i === 599) expect(checksum(state)).toBe('d559cc8477c782e8');
  }
  expect(checksum(state)).toBe('bcfd1e604139826c');
}, 30000);
