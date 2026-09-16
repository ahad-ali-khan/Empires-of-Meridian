import { describe, expect, it } from 'vitest';
import { createNorthStarWorld } from './north-star';

describe('North Star semantic world fixture', () => {
  it('contains stable terrain semantics with passability and surfaces', () => {
    const first = createNorthStarWorld();
    const second = createNorthStarWorld();
    expect(first.terrain.width).toBe(18);
    expect(first.terrain.depth).toBe(12);
    expect(first.terrain.tiles).toEqual(second.terrain.tiles);
    expect(first.terrain.tiles.some((tile) => tile.surface === 'shallow-water')).toBe(true);
    expect(first.terrain.tiles.some((tile) => tile.surface === 'forest')).toBe(true);
    first.dispose();
    second.dispose();
  });
});
