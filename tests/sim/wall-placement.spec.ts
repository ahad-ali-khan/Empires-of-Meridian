import {expect, test} from 'vitest';
import * as T from 'three';
import {createMatch, step, checksum, serializeSave, restoreSave, placementReason} from '../../packages/sim/src/index';
import {gateConversionReason, wallPlacementReason, wallSpans, snapWallEndpoint} from '../../packages/sim/src/walls';
import {buildAsset} from '../../packages/asset-tools/src/models';
import {alignWall, updateWallPreview} from '../../apps/web/src/game/renderer/wall-view';
import {terrainHeight} from '../../packages/sim/src/terrain';

function fixture() {
  const s = createMatch({
    v: 1,
    seed: 73,
    mode: 'skirmish',
    difficulty: 'standard',
    aiCount: 0,
    populationCap: 100,
    gameSpeed: 1,
  });
  s.players[0].age = 2;
  s.entities = s.entities.filter((e) => e.category === 'unit');
  const worker = s.entities.find((e) => e.kind === 'worker')!;
  let spans = wallSpans(worker.x + 20 * 256, worker.z, worker.x + 30 * 256, worker.z);
  for (let r = 0; r < 20 && wallPlacementReason(s, spans, 1); r++)
    spans = wallSpans((20 + r * 5) * 256, 20 * 256, (30 + r * 5) * 256, 20 * 256);
  expect(wallPlacementReason(s, spans, 1)).toBe('');
  return {s, worker, spans};
}

test('wall commands reserve exactly the preview spans, reject duplicates and validate gate conversions', () => {
  const {s, worker, spans} = fixture(),
    first = spans[0],
    last = spans.at(-1)!;
  const command = {
    v: 1 as const,
    tick: 1,
    playerId: 1 as const,
    sequence: 1,
    type: 'build' as const,
    workerIds: [worker.id],
    buildingId: 'wall',
    x: first.x - first.dx / 2,
    z: first.z - first.dz / 2,
    endX: last.x + last.dx / 2,
    endZ: last.z + last.dz / 2,
  };
  step(s, [command]);
  const walls = s.entities.filter((e) => e.kind === 'wall');
  expect(walls).toHaveLength(spans.length);
  const funds = {...s.players[0].resources};
  step(s, [{...command, tick: 2, sequence: 2}]);
  expect(s.entities.filter((e) => e.kind === 'wall')).toHaveLength(spans.length);
  expect(s.players[0].resources).toEqual(funds);
  expect(s.events.at(-1)!.text).toContain('overlap');
  const wall = walls[0];
  expect(gateConversionReason(wall, 1, 2)).toContain('Finish');
  wall.progress = 10000;
  expect(gateConversionReason(wall, 1, 1)).toContain('Classical');
  s.players[0].age = 2;
  const copy = restoreSave(serializeSave(s));
  const gate = {
    v: 1 as const,
    tick: 3,
    playerId: 1 as const,
    sequence: 3,
    type: 'convert-gate' as const,
    buildingId: wall.id,
  };
  step(s, [gate]);
  step(copy, [gate]);
  expect(wall.kind).toBe('gate');
  expect(checksum(s)).toBe(checksum(copy));
  const end = {x: wall.x + wall.wallAxis![0] / 2, z: wall.z + wall.wallAxis![1] / 2};
  expect(snapWallEndpoint(s, end.x + 90, end.z + 70, 1)).toEqual(end);
});

test('wall preview and finished spans share their exact width and terrain transform', () => {
  const {s, spans} = fixture(),
    ghost = new T.Group();
  updateWallPreview(ghost, spans, 2, s.map.size / 256, s.map.seed, false);
  expect(ghost.children).toHaveLength(spans.length);
  const model = buildAsset('wall', 2);
  alignWall(model, spans[0], s.map.size / 256, s.map.seed);
  model.updateMatrixWorld(true);
  const width = new T.Box3().setFromObject(model).getSize(new T.Vector3()).x;
  expect(width).toBeCloseTo(Math.hypot(spans[0].dx, spans[0].dz) / 256, 4);
  const preview = ghost.children[0].children[0] as T.Group;
  expect(preview.matrix.elements).toEqual(model.matrix.elements);
  expect(ghost.children[0].position.y).toBe(
    terrainHeight(spans[0].x / 256, spans[0].z / 256, s.map.size / 256, s.map.seed),
  );
});

test('converting a wall at a T junction rejects the blocked passage without charging resources', () => {
  const {s, worker, spans} = fixture(),
    first = spans[0],
    last = spans.at(-1)!;
  const base = {
    v: 1 as const,
    playerId: 1 as const,
    type: 'build' as const,
    workerIds: [worker.id],
    buildingId: 'wall',
  };
  step(s, [
    {
      ...base,
      tick: 1,
      sequence: 1,
      x: first.x - first.dx / 2,
      z: first.z - first.dz / 2,
      endX: last.x + last.dx / 2,
      endZ: last.z + last.dz / 2,
    },
  ]);
  const walls = s.entities.filter((e) => e.kind === 'wall');
  walls.forEach((e) => (e.progress = 10000));
  const wall = walls[0];
  const branch = [1, -1]
    .map((sign) => wallSpans(wall.x, wall.z, wall.x, wall.z + sign * 5 * 256))
    .find((route) => !wallPlacementReason(s, route, 1));
  expect(branch).toBeDefined();
  const segment = branch![0];
  step(s, [
    {
      ...base,
      tick: 2,
      sequence: 2,
      x: segment.x - segment.dx / 2,
      z: segment.z - segment.dz / 2,
      endX: segment.x + segment.dx / 2,
      endZ: segment.z + segment.dz / 2,
    },
  ]);
  expect(s.entities.filter((e) => e.kind === 'wall')).toHaveLength(walls.length + 1);
  expect(gateConversionReason(wall, 1, 2, s)).toContain('passage');
  const funds = {...s.players[0].resources},
    restored = restoreSave(serializeSave(s));
  const conversion = {
    v: 1 as const,
    tick: 3,
    playerId: 1 as const,
    sequence: 3,
    type: 'convert-gate' as const,
    buildingId: wall.id,
  };
  step(s, [conversion]);
  step(restored, [conversion]);
  expect(wall.kind).toBe('wall');
  expect(s.players[0].resources).toEqual(funds);
  expect(s.events.at(-1)!.text).toContain('passage');
  expect(checksum(s)).toBe(checksum(restored));
});

test('a directly built rotated enemy wall blocks its real axis and permits routes beside it', () => {
  const s = createMatch({
    v: 1,
    seed: 73,
    mode: 'skirmish',
    difficulty: 'standard',
    aiCount: 1,
    populationCap: 100,
    gameSpeed: 1,
  });
  s.players[1].age = 2;
  s.entities = s.entities.filter((e) => e.category === 'unit');
  const builder = s.entities.find((e) => e.owner === 2 && e.kind === 'worker')!;
  let site: {x: number; z: number; beside: ReturnType<typeof wallSpans>} | undefined;
  for (let z = 15; z < 100 && !site; z += 5)
    for (let x = 15; x < 100 && !site; x += 5) {
      const beside = wallSpans((x + 2) * 256, z * 256, (x + 7) * 256, z * 256);
      if (!placementReason(s, 'wall', x * 256, z * 256, 1) && !wallPlacementReason(s, beside, 1))
        site = {x: x * 256, z: z * 256, beside};
    }
  expect(site).toBeDefined();
  step(s, [
    {
      v: 1,
      tick: 1,
      playerId: 2,
      sequence: 1,
      type: 'build',
      workerIds: [builder.id],
      buildingId: 'wall',
      x: site!.x,
      z: site!.z,
      rotation: 1,
    },
  ]);
  const wall = s.entities.find((e) => e.owner === 2 && e.kind === 'wall')!;
  expect(wall).toBeDefined();
  expect(wall.rotation).toBe(1);
  expect(wall.wallAxis).toBeUndefined();
  expect(wallPlacementReason(s, site!.beside, 1)).toBe('');
  const crossing = wallSpans(site!.x - 2 * 256, site!.z, site!.x + 2 * 256, site!.z);
  expect(wallPlacementReason(s, crossing, 1)).toContain('another player');
});
