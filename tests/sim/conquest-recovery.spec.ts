import {expect, test} from 'vitest';
import {createMatch, placementReason, step} from '../../packages/sim/src/index';
import {buildingById} from '../../packages/content/src/index';

function ruinedSettlement() {
  const state = createMatch({
    v: 1,
    seed: 73,
    difficulty: 'standard',
    mode: 'skirmish',
    populationCap: 200,
    gameSpeed: 1,
  });
  const hall = state.entities.find((e) => e.owner === 1 && e.kind === 'hall')!;
  state.entities = state.entities.filter((e) => e.owner !== 1 || e.category !== 'building');
  state.tick = 601;
  return {state, hall};
}

test('surviving workers prevent infrastructure loss from ending a recoverable match', () => {
  const {state, hall} = ruinedSettlement();
  const worker = state.entities.find((e) => e.owner === 1 && e.kind === 'worker')!;
  step(state, []);
  expect(state.players[0].resigned).toBe(false);
  expect(state.winner).toBeNull();
  state.players[0].resources = {...buildingById.get('hall')!.cost};
  expect(placementReason(state, 'hall', hall.x, hall.z)).toBeUndefined();
  step(state, [
    {
      v: 1,
      tick: state.tick + 1,
      sequence: 1,
      playerId: 1,
      type: 'build',
      buildingId: 'hall',
      workerIds: [worker.id],
      x: hall.x,
      z: hall.z,
    },
  ]);
  const replacement = state.entities.find((e) => e.owner === 1 && e.kind === 'hall');
  expect(replacement).toBeDefined();
  expect(replacement!.progress).toBeLessThan(10000);
  expect(worker.task).toBe('build');
  expect(state.winner).toBeNull();
});

test('a remaining army without workers, hall or production loses by conquest', () => {
  const {state} = ruinedSettlement();
  state.entities = state.entities.filter((e) => e.owner !== 1 || e.kind !== 'worker');
  expect(state.entities.some((e) => e.owner === 1 && e.category === 'unit' && e.hp > 0)).toBe(true);
  step(state, []);
  expect(state.players[0].resigned).toBe(true);
  expect(state.winner).toBe(2);
});
