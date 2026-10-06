import {expect, test} from 'vitest';
import {createMatch, step, canSee, placementReason, checksum} from '../../packages/sim/src/index';
import {coastAt} from '../../packages/sim/src/terrain';
import {unitById} from '../../packages/content/src/index';
import {blocked} from '../../packages/sim/src/navigation';
import type {Command} from '../../packages/protocol/src/index';
const config = {
  v: 1 as const,
  seed: 90210,
  difficulty: 'standard' as const,
  mode: 'skirmish' as const,
  populationCap: 200,
  gameSpeed: 1,
};

test('a worker reaches berries and deposits a full load without entering buildings', () => {
  const s = createMatch(config),
    worker = s.entities.find((e) => e.owner === 1 && e.kind === 'worker')!,
    berries = s.entities.find((e) => e.kind === 'provisions')!;
  for (let i = 0; i < 1800; i++) {
    step(
      s,
      i
        ? []
        : [{v: 1, tick: 1, playerId: 1, sequence: 1, type: 'gather', entityIds: [worker.id], targetId: berries.id}],
    );
    expect(blocked(s, worker.x, worker.z)).toBe(false);
  }
  expect(s.players[0].stats.gathered.provisions).toBeGreaterThanOrEqual(1000);
});
test('group movement reserves distinct destinations and routes around the hall', () => {
  const a = createMatch(config),
    b = createMatch(config),
    workers = a.entities.filter((e) => e.owner === 1 && e.kind === 'worker');
  const command: Command = {
    v: 1,
    tick: 1,
    playerId: 1,
    sequence: 1,
    type: 'move',
    entityIds: workers.map((e) => e.id),
    x: workers[0].x,
    z: workers[0].z - 24 * 256,
  };
  for (let i = 0; i < 450; i++) {
    step(a, i ? [] : [command]);
    step(b, i ? [] : [command]);
    for (const w of workers) expect(blocked(a, w.x, w.z)).toBe(false);
  }
  expect(new Set(workers.map((e) => e.x + ',' + e.z)).size).toBe(4);
  expect(workers.every((e) => e.task === 'idle')).toBe(true);
  expect(checksum(a)).toBe(checksum(b));
});
test('the AI must discover a target before issuing an attack', () => {
  const s = createMatch(config);
  for (let i = 0; i < 1800; i++) {
    const before = s.commandLog.length;
    step(s, []);
    for (const c of s.commandLog.slice(before))
      if (c.playerId === 2 && c.type === 'attack') {
        const target = s.entities.find((e) => e.id === c.targetId)!;
        expect(canSee(s, 2, target)).toBe(true);
      }
  }
  expect(s.players[1].stats.gathered.provisions).toBeGreaterThan(0);
  expect(s.players[1].stats.gathered.timber).toBeGreaterThan(0);
  expect(s.aiTrace.some((entry) => entry.playerId === 2 && entry.goal === 'scout')).toBe(true);
});
test('developed AI attacks a legally visible target through its validated command path', () => {
  const s = createMatch({...config, mapSize: 'small', fogOfWar: false}),
    hall = s.entities.find((e) => e.owner === 2 && e.kind === 'hall')!,
    template = s.entities.find((e) => e.owner === 2 && e.kind === 'worker')!,
    definition = unitById.get('militia')!;
  for (let i = 0; i < 5; i++)
    s.entities.push({
      ...structuredClone(template),
      id: s.nextEntityId++,
      kind: definition.id,
      model: definition.model,
      category: 'unit',
      hp: definition.hp,
      maxHp: definition.hp,
      damage: definition.damage,
      range: definition.range,
      speed: definition.speed,
      population: definition.population,
      task: 'idle',
      x: hall.x + 1000 + i * 120,
      z: hall.z + 1500,
    });
  s.tick = 49;
  step(s, []);
  const entry = s.aiTrace.filter((e) => e.playerId === 2).at(-1);
  expect(entry?.goal).toBe('engage');
  const command = s.commandLog.find((c) => c.playerId === 2 && c.type === 'attack');
  expect(command).toBeDefined();
  const target = s.entities.find((e) => e.id === command!.targetId)!;
  expect(canSee(s, 2, target)).toBe(true);
  expect(target.owner).toBe(1);
});
test('placement rejects overlap and shoreline footprints', () => {
  const s = createMatch(config),
    hall = s.entities.find((e) => e.kind === 'hall')!;
  expect(placementReason(s, 'house', hall.x + 300, hall.z)).toContain('overlaps');
  expect(placementReason(s, 'hall', coastAt(80 * 256, s.map.size, s.map.seed), 80 * 256)).toContain('dry land');
});
