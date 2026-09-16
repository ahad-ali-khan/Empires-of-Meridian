# ADR 0001: deterministic simulation boundary

Status: accepted for Phase 0

The authoritative simulation will be a pure TypeScript package runnable in Node and a
browser worker. It advances at 20 fixed ticks per second, uses documented fixed-point
integers, canonical `(tick, playerId, sequence)` command ordering, named seeded random
streams, versioned serialization, and checksums. Rendering, React, network timing,
asset loading, and audio cannot write simulation state.

The small primitives in `packages/sim` are the first executable proof of this boundary.
