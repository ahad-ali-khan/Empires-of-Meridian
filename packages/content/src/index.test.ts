import { describe, expect, it } from 'vitest';
import { assertStableId } from './index';

describe('content boundary', () => {
  it('accepts stable ids and rejects ambiguous ids', () => {
    expect(assertStableId('aurelian-worker')).toBe('aurelian-worker');
    expect(() => assertStableId('Aurelian Worker')).toThrow();
  });
});
