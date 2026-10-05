import {expect, test} from 'vitest';
import * as T from 'three';
import {buildAsset, type AssetKind} from '../../packages/asset-tools/src/models';
import {buildings, unitById} from '../../packages/content/src/index';
import {applyCondition} from '../../packages/asset-tools/src/presentation';
import {prepareBuildingView} from '../../apps/web/src/game/renderer/building-view';
import {createMatch, step, checksum, serializeSave, restoreSave, type Entity} from '../../packages/sim/src/index';
import {findPath, navigationWork} from '../../packages/sim/src/navigation';

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
  const base = structuredClone(s.entities.find((e) => e.kind === 'worker')!);
  s.entities = [];
  const actor = (kind: string, x: number, z: number, owner: 0 | 1 | 2 = 1) => {
    const d = unitById.get(kind)!;
    const e: Entity = {
      ...structuredClone(base),
      id: s.nextEntityId++,
      kind,
      model: d.model,
      owner,
      x,
      z,
      hp: d.hp,
      maxHp: d.hp,
      speed: d.speed,
      damage: d.damage,
      range: d.range,
      stance: 'no-attack',
      task: 'idle',
    };
    s.entities.push(e);
    return e;
  };
  return {s, base, actor};
}

test('idle soldiers do not turn a clear worker route into a terrain detour', () => {
  const {s, base, actor} = fixture();
  const worker = actor('worker', base.x, base.z);
  for (let i = -4; i <= 4; i++) actor('militia', base.x + 900, base.z + i * 350);
  expect(findPath(s, worker, base.x + 2400, base.z)).toEqual([[base.x + 2400, base.z]]);
  step(s, [
    {v: 1, tick: 1, sequence: 1, playerId: 1, type: 'move', entityIds: [worker.id], x: base.x + 2400, z: base.z},
  ]);
  for (let i = 0; i < 140; i++) step(s, []);
  expect(worker.task).toBe('idle');
  expect(worker.x).toBe(base.x + 2400);
});

test('a group attack bounds path work and resumes every attacker without blocking the match clock', () => {
  const {s, base, actor} = fixture();
  const target = actor('militia', base.x + 4500, base.z, 0);
  target.guardOf = 999999;
  target.hp = target.maxHp = 100000;
  const army = Array.from({length: 48}, (_, i) =>
    actor('militia', base.x - 1000 + (i % 8) * 200, base.z - 900 + Math.floor(i / 8) * 300),
  );
  const starts = army.map((e) => [e.x, e.z]);
  step(s, [
    {v: 1, tick: 1, sequence: 1, playerId: 1, type: 'attack', entityIds: army.map((e) => e.id), targetId: target.id},
  ]);
  expect(navigationWork(s)).toBeLessThanOrEqual(8);
  for (let i = 0; i < 80; i++) {
    step(s, []);
    expect(navigationWork(s)).toBeLessThanOrEqual(8);
  }
  expect(s.tick).toBe(81);
  army.forEach((e, i) => expect([e.x, e.z]).not.toEqual(starts[i]));
  const copy = restoreSave(serializeSave(s));
  for (let i = 0; i < 80; i++) {
    step(s, []);
    step(copy, []);
  }
  expect(checksum(copy)).toBe(checksum(s));
});

test('all playable building previews and construction lots stay inside their age-independent edges', () => {
  for (const definition of buildings) {
    if (definition.id === 'wall' || definition.id === 'gate') continue;
    for (const age of [1, 2, 3]) {
      if (age < definition.age) continue;
      let art: T.Group;
      try {
        art = buildAsset(definition.model as AssetKind, age);
      } catch {
        art = buildAsset(definition.model as AssetKind);
      }
      const model = prepareBuildingView(art, definition.id)!;
      for (const state of ['intact', 'construction'] as const) {
        if (state === 'construction') applyCondition(model, definition.id, state);
        const bounds = new T.Box3().setFromObject(model);
        expect(
          Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x)),
          `${definition.id}/${age}/${state} X`,
        ).toBeLessThanOrEqual(definition.footprint[0] + 0.001);
        expect(
          Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z)),
          `${definition.id}/${age}/${state} Z`,
        ).toBeLessThanOrEqual(definition.footprint[1] + 0.001);
      }
      const pad = model.getObjectByName('groundFootprint')!;
      const size = new T.Box3().setFromObject(pad).getSize(new T.Vector3());
      expect(size.x).toBeCloseTo(definition.footprint[0] * 2);
      expect(size.z).toBeCloseTo(definition.footprint[1] * 2);
    }
  }
});
