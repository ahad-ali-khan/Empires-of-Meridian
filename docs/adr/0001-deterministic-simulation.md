# ADR 0001: Deterministic simulation

Status: Accepted

The authoritative match runs at 20 fixed ticks per second with integer world positions, resource hundredths, stable entity ordering, versioned commands, and named seeded random streams. Browser animation, React state, wall-clock time, and network timing may display the match but never modify it. The same simulation package runs in a worker and in Node fixtures.

The present checksum uses canonical JSON and FNV-1a 64. A binary little-endian codec remains a release-gate item before replays become a compatibility promise.
