import {expect, test} from 'vitest';
import {ambientScene} from '../../apps/web/src/game/ambient-scene';
import {createMatch, createSnapshot} from '../../packages/sim/src/index';
import {coastAt} from '../../packages/sim/src/terrain';

test('ambient candidates exclude remembered, dead and garrisoned wildlife and stay bounded', () => {
  const state = createMatch({v: 1, seed: 73, aiCount: 0, mode: 'skirmish', difficulty: 'standard', populationCap: 100, gameSpeed: 1, fogOfWar: false});
  const snapshot = createSnapshot(state, 1), sheep = snapshot.entities.find(e => e.kind === 'sheep')!;
  snapshot.entities = Array.from({length: 400}, (_, i) => ({...sheep, id: 9000 + i, x: i * 256, z: 20 * 256}));
  snapshot.entities[0].remembered = true;
  snapshot.entities[1].hp = 0;
  snapshot.entities[2].garrisonedIn = 100;
  const sources = ambientScene(snapshot, {x: 8, z: 20});
  expect(sources.length).toBeLessThanOrEqual(128);
  expect(sources.filter(s => s.kind === 'sheep')).toHaveLength(24);
  expect(sources.map(s => s.id)).not.toEqual(expect.arrayContaining(['animal:9000', 'animal:9001', 'animal:9002']));
  expect(sources.every(s => Number.isFinite(s.x) && Number.isFinite(s.z))).toBe(true);
  snapshot.fog.fill(1);
  expect(ambientScene(snapshot).some(s => s.kind === 'shore')).toBe(false);
});

test('sea fishing grounds use surf and inland fishing grounds use water ambience', () => {
  const state = createMatch({v: 1, seed: 73, aiCount: 0, mode: 'skirmish', difficulty: 'standard', populationCap: 100, gameSpeed: 1, fogOfWar: false});
  const snapshot = createSnapshot(state, 1), fish = snapshot.entities.find(e => e.kind === 'fish')!;
  const z = 40 * 256, coast = coastAt(z, snapshot.map.size, snapshot.map.seed);
  snapshot.entities = [{...fish, id: 100, x: coast + 256, z}, {...fish, id: 101, x: coast - 12 * 256, z}];
  expect(ambientScene(snapshot)).toEqual(expect.arrayContaining([
    expect.objectContaining({id: 'water:100', kind: 'shore'}),
    expect.objectContaining({id: 'water:101', kind: 'water'}),
  ]));
});
