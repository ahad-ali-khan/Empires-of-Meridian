import {test, expect} from 'vitest';
import {createMatch, step, checksum, serializeSave, restoreSave} from '../../packages/sim/src/index';
import {blocked} from '../../packages/sim/src/navigation';
import {wallSpans} from '../../packages/sim/src/walls';
test('wall lines reserve complete costs, build successively, bend and convert into owner-passable gates', () => {
  const s = createMatch({
    v: 1,
    seed: 73,
    difficulty: 'standard',
    mode: 'skirmish',
    populationCap: 100,
    gameSpeed: 1,
    aiCount: 0,
    fogOfWar: false,
  });
  s.players[0].age = 2;
  s.players[0].resources.timber = 100000;
  s.players[0].resources.metal = 100000;
  const workers = s.entities.filter((e) => e.kind === 'worker');
  // Isolate the wall fixture from forests and incidental wildlife traffic.
  s.entities = s.entities.filter((e) => e.category === 'building' || e.kind === 'worker');
  workers.forEach((w, i) => {
    w.x = 40 * 256;
    w.z = (57 + i * 2) * 256;
  });
  step(s, [
    {
      v: 1,
      tick: 1,
      playerId: 1,
      sequence: 1,
      type: 'build',
      buildingId: 'wall',
      workerIds: workers.map((e) => e.id),
      x: 42 * 256,
      z: 58 * 256,
      endX: 52 * 256,
      endZ: 58 * 256,
    },
  ]);
  const walls = s.entities.filter((e) => e.kind === 'wall');
  expect(walls).toHaveLength(2);
  expect(s.players[0].resources.timber).toBe(95000);
  expect(blocked(s, walls[0].x, walls[0].z, 1)).toBe(true);
  for (let i = 0; i < 800; i++) step(s, []);
  expect(walls.every((e) => e.progress === 10000)).toBe(true);
  step(s, [{v: 1, tick: s.tick + 1, playerId: 1, sequence: 2, type: 'convert-gate', buildingId: walls[0].id}]);
  expect(walls[0].kind).toBe('gate');
  expect(blocked(s, walls[0].x, walls[0].z, 1)).toBe(false);
  expect(blocked(s, walls[0].x, walls[0].z, 2)).toBe(true);
  const copy = restoreSave(serializeSave(s));
  expect(checksum(copy)).toBe(checksum(s));
  const diagonal = wallSpans(52 * 256, 58 * 256, 58 * 256, 64 * 256);
  expect(diagonal.every((e) => e.dx === e.dz)).toBe(true);
});
