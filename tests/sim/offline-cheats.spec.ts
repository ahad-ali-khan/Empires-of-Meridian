import {expect, test} from 'vitest';
import {checksum, createMatch, restoreSave, serializeSave, step} from '../../packages/sim/src/index';
import type {Command, OfflineCheat} from '../../packages/protocol/src/index';

const config = {v: 1, seed: 73, mode: 'skirmish', difficulty: 'standard', aiCount: 1, populationCap: 100, gameSpeed: 1} as const;
const command = (cheat: OfflineCheat, entityIds: number[] = []): Command => ({v: 1, tick: 1, playerId: 1, sequence: 1, type: 'offline-cheat', cheat, entityIds});

test('cheats require the offline host capability and an AI skirmish', () => {
  for (const match of [config, {...config, offlineCheats: true, mode: 'tutorial' as const}, {...config, offlineCheats: true, aiCount: 0 as const}]) {
    const state = createMatch(match), before = {...state.players[0].resources};
    step(state, [command('resources')]);
    expect(state.players[0].resources).toEqual(before);
    expect(state.players[0].cheatsUsed).toBeUndefined();
    expect(state.commandLog).toHaveLength(0);
    expect(state.events.some(e => e.kind === 'rejected' && /offline skirmishes/.test(e.text))).toBe(true);
  }
});

test('offline cheats are deterministic, saved, replayed and cannot heal opponents', () => {
  const a = createMatch({...config, offlineCheats: true}), b = createMatch({...config, offlineCheats: true});
  const before = {...a.players[0].resources};
  step(a, [command('resources')]);
  step(b, [command('resources')]);
  expect(checksum(a)).toBe(checksum(b));
  expect(a.players[0].resources.timber).toBe(before.timber + 100000);
  expect(a.players[0].cheatsUsed).toBe(1);
  const restored = restoreSave(serializeSave(a));
  expect(checksum(restored)).toBe(checksum(a));
  expect(restored.commandLog[0].type).toBe('offline-cheat');
  const own = a.entities.find(e => e.owner === 1 && e.kind === 'worker')!, enemy = a.entities.find(e => e.owner === 2 && e.kind === 'worker')!;
  own.hp = Math.floor(own.maxHp / 2);
  enemy.hp = Math.floor(enemy.maxHp / 2);
  const enemyHp = enemy.hp;
  step(a, [{...command('heal', [own.id, enemy.id]), tick: 2, sequence: 2}]);
  expect(own.hp).toBe(own.maxHp);
  expect(enemy.hp).toBe(enemyHp);
  step(a, [{...command('reveal'), tick: 3, sequence: 3}]);
  expect(a.fog[0].every(cell => cell === 2)).toBe(true);
  expect(a.players[0].cheatsUsed).toBe(3);
});
