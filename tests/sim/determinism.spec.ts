import {describe, expect, test} from 'vitest';
import {checksum, createMatch, createSnapshot, restoreSave, serializeSave, step} from '../../packages/sim/src/index';
import type {Command} from '../../packages/protocol/src/index';

describe('deterministic simulation', () => {
  test('same seed and canonical commands produce the same checksum', () => {
    const config = {
      v: 1 as const,
      seed: 90210,
      difficulty: 'standard' as const,
      mode: 'skirmish' as const,
      populationCap: 200,
      gameSpeed: 1,
    };
    const a = createMatch(config),
      b = createMatch(config);
    const worker = a.entities.find((e) => e.owner === 1 && e.kind === 'worker')!;
    const berry = a.entities.find((e) => e.kind === 'provisions')!;
    const commands: Command[] = [
      {v: 1, tick: 1, playerId: 1, sequence: 1, type: 'gather', entityIds: [worker.id], targetId: berry.id},
    ];
    for (let i = 0; i < 800; i++) {
      step(a, i === 0 ? commands : []);
      step(b, i === 0 ? [...commands].reverse() : []);
    }
    expect(checksum(a)).toBe(checksum(b));
    expect(createSnapshot(a, 1).players[0].resources.provisions).toBeGreaterThan(0);
  });
  test('save and restore preserve authoritative checksum', () => {
    const state = createMatch({
      v: 1,
      seed: 4,
      difficulty: 'relaxed',
      mode: 'tutorial',
      populationCap: 100,
      gameSpeed: 1,
    });
    for (let i = 0; i < 120; i++) step(state, []);
    const save = serializeSave(state, []),
      restored = restoreSave(save);
    expect(checksum(restored)).toBe(checksum(state));
  });
  test('100 map seeds keep starts and resources legal', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const state = createMatch({
        v: 1,
        seed,
        difficulty: 'ruthless',
        mode: 'skirmish',
        populationCap: 200,
        gameSpeed: 1,
      });
      expect(state.map.valid).toBe(true);
      expect(state.entities.filter((e) => e.category === 'resource').length).toBeGreaterThanOrEqual(20);
    }
  });
});
