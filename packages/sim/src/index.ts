export const TICKS_PER_SECOND = 20;
export const FIXED_SCALE = 1000;

export type Fixed = number;

export const toFixed = (value: number): Fixed => Math.round(value * FIXED_SCALE);
export const fromFixed = (value: Fixed): number => value / FIXED_SCALE;
export const multiplyFixed = (left: Fixed, right: Fixed): Fixed =>
  Math.round((left * right) / FIXED_SCALE);

export type Command = {
  tick: number;
  playerId: number;
  sequence: number;
  type: string;
  payload: Readonly<Record<string, unknown>>;
};

export const orderCommands = (commands: readonly Command[]): Command[] =>
  [...commands].sort(
    (a, b) => a.tick - b.tick || a.playerId - b.playerId || a.sequence - b.sequence,
  );

export class DeterministicRng {
  #state: number;

  constructor(seed: number) {
    this.#state = seed >>> 0 || 0x6d2b79f5;
  }

  nextUint32(): number {
    let x = this.#state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.#state = x >>> 0;
    return this.#state;
  }

  nextFixed(): Fixed {
    return Math.floor((this.nextUint32() / 0x100000000) * FIXED_SCALE);
  }
}

const canonicalize = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
    .join(',')}}`;
};

export const canonicalState = (state: unknown): string => canonicalize(state);

export const checksum = (state: unknown): string => {
  let hash = 0x811c9dc5;
  for (const char of canonicalState(state)) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};
