import {expect, test} from 'vitest';
import {createMatch, step, checksum, restoreSave, serializeSave} from '../../packages/sim/src/index';
import {buildAsset, animateAsset} from '../../packages/asset-tools/src/models';
const config = {
  v: 1 as const,
  seed: 73,
  difficulty: 'standard' as const,
  mode: 'skirmish' as const,
  populationCap: 100,
  gameSpeed: 1,
  aiCount: 0 as const,
  fogOfWar: false,
};
test('shore workers keep fishing through repeated delivery trips and save restoration', () => {
  const s = createMatch(config),
    w = s.entities.find((e) => e.kind === 'worker')!;
  const fish = s.entities
    .filter((e) => e.kind === 'fish')
    .sort((a, b) => Math.hypot(a.x - w.x, a.z - w.z) - Math.hypot(b.x - w.x, b.z - w.z))[0];
  // Simulate stale collision state left by a previous order.
  w.avoidTraffic = true;
  w.trafficWait = 7;
  w.waitingSince = -500;
  step(s, [{v: 1, tick: 1, sequence: 1, playerId: 1, type: 'gather', entityIds: [w.id], targetId: fish.id}]);
  for (let i = 0; i < 1500; i++) step(s, []);
  expect(s.players[0].stats.gathered.provisions).toBeGreaterThanOrEqual(2000);
  expect(['gather', 'carry']).toContain(w.task);
  const copy = restoreSave(serializeSave(s));
  for (let i = 0; i < 100; i++) {
    step(s, []);
    step(copy, []);
  }
  expect(checksum(copy)).toBe(checksum(s));
});
test('idle cannon never flashes or sends its crew through a firing cycle, ram has a moving beam', () => {
  const cannon = buildAsset('cannon');
  for (const t of [0, 1.5, 3, 5.05, 12.05]) {
    animateAsset(cannon, t, 'idle');
    expect(cannon.getObjectByName('muzzleFlash')?.visible).toBe(false);
    expect(cannon.getObjectByName('swab')?.visible).toBe(false);
    expect(cannon.getObjectByName('loader')?.position.x).toBe(-1.15);
  }
  const ram = buildAsset('ramWagon');
  animateAsset(ram, 0.5, 'attack');
  expect(ram.getObjectByName('ramBeam')?.position.z).toBeLessThan(0);
  animateAsset(ram, 1.3, 'attack');
  expect(ram.getObjectByName('ramBeam')?.position.z).toBeGreaterThan(0);
  animateAsset(ram, 2, 'idle');
  expect(ram.getObjectByName('ramBeam')?.position.z).toBe(0);
});
test('nonaggressive workers flee hostile attacks while retaining their cargo', () => {
  const s = createMatch(config),
    w = s.entities.find((e) => e.kind === 'worker')!;
  w.carry.timber = 300;
  const enemy = {
    ...structuredClone(w),
    id: s.nextEntityId++,
    owner: 2 as const,
    kind: 'militia',
    task: 'attack' as const,
    targetId: w.id,
    x: w.x + 240,
    z: w.z,
    damage: 5,
    stance: 'aggressive' as const,
  };
  s.entities.push(enemy);
  const start = {x: w.x, z: w.z};
  for (let i = 0; i < 12; i++) step(s, []);
  expect(w.hp).toBeLessThan(w.maxHp);
  expect(w.beforeFlee).toBeDefined();
  expect(w.carry.timber).toBe(300);
  expect([w.x, w.z]).not.toEqual([start.x, start.z]);
});
test('a crowd routes around a hall without losing commands or stacking on one point', () => {
  const s = createMatch(config),
    sample = s.entities.find((e) => e.kind === 'worker')!,
    hall = s.entities.find((e) => e.kind === 'hall')!;
  s.entities = s.entities.filter((e) => e.category === 'building');
  const crowd = Array.from({length: 48}, (_, i) => {
    const e = structuredClone(sample);
    e.id = s.nextEntityId++;
    e.x = hall.x - 12 * 256 + (i % 8) * 360;
    e.z = hall.z - 5 * 256 + Math.floor(i / 8) * 360;
    e.task = 'idle';
    e.path = undefined;
    e.pathGoal = undefined;
    return e;
  });
  s.entities.push(...crowd);
  step(s, [
    {
      v: 1,
      tick: 1,
      sequence: 1,
      playerId: 1,
      type: 'move',
      entityIds: crowd.map((e) => e.id),
      x: hall.x + 15 * 256,
      z: hall.z,
    },
  ]);
  for (let i = 0; i < 1100; i++) step(s, []);
  expect(crowd.filter((e) => e.task === 'idle').length).toBeGreaterThanOrEqual(46);
  expect(new Set(crowd.map((e) => `${Math.round(e.x / 128)},${Math.round(e.z / 128)}`)).size).toBeGreaterThanOrEqual(
    46,
  );
  expect(crowd.every((e) => !e.recoveryCount)).toBe(true);
});
