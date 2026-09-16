---
name: rts-deterministic-simulation
description: Fixed-tick, fixed-point RTS simulation, command order, checksums, and replay stability.
---

# Deterministic simulation

## Invariants

- Simulation code advances only on a fixed tick; rendering interpolates snapshots.
- State uses integer/fixed-point representations with documented scales. No `Date`,
  wall-clock deltas, platform RNG, floating-point ordering, or unordered iteration.
- Commands are canonicalized and ordered by `(tick, playerId, sequence)` before use.
- Every non-cosmetic random result comes from a recorded deterministic seed/stream.
- Serialization has a canonical versioned byte representation and a stable checksum.

## Workflow

Model rules as pure transitions: `nextState = step(previousState, orderedCommands)`.
On each protocol/schema change, add golden replay, checksum, and command-permutation
tests. Fail closed on invalid command ticks or sequence gaps; emit redacted diagnostic
metadata sufficient to locate the first divergent tick.

Never let scene state, UI state, network timing, cosmetic effects, or asset loading
write into simulation state.
