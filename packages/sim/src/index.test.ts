import { describe, expect, it } from 'vitest';
import {
  DeterministicRng,
  checksum,
  fromFixed,
  multiplyFixed,
  orderCommands,
  toFixed,
} from './index';

describe('deterministic simulation primitives', () => {
  it('round-trips fixed point values and multiplies deterministically', () => {
    expect(fromFixed(toFixed(1.234))).toBe(1.234);
    expect(multiplyFixed(toFixed(1.5), toFixed(2))).toBe(toFixed(3));
  });

  it('orders commands independently of input order', () => {
    const commands = [
      { tick: 2, playerId: 2, sequence: 0, type: 'b', payload: {} },
      { tick: 1, playerId: 2, sequence: 1, type: 'c', payload: {} },
      { tick: 1, playerId: 1, sequence: 9, type: 'a', payload: {} },
    ];
    expect(orderCommands(commands).map(({ type }) => type)).toEqual(['a', 'c', 'b']);
  });

  it('replays the same seeded stream and checksum', () => {
    const one = new DeterministicRng(42);
    const two = new DeterministicRng(42);
    expect([one.nextUint32(), one.nextUint32()]).toEqual([two.nextUint32(), two.nextUint32()]);
    expect(checksum({ b: 2, a: 1 })).toBe(checksum({ a: 1, b: 2 }));
  });
});
