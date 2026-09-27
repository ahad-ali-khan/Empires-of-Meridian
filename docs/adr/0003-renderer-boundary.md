# ADR 0003: Simulation and renderer boundary

Status: Accepted

`packages/presentation` converts immutable snapshots and events to render intents. Three.js views interpolate and animate those intents. Pointer and keyboard input produce protocol commands; renderer code has no reference to mutable match state. Cosmetic random values use presentation-only state.
