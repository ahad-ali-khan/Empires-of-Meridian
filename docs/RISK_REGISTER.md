# Phase 0 risk register

| Risk                     | Likelihood | Impact   | Trigger                                          | Mitigation                                                             | Proof/owner                                 |
| ------------------------ | ---------- | -------- | ------------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------- |
| Deterministic divergence | Medium     | Critical | Node/browser checksum differs                    | Fixed-point state, canonical ordering, golden fixtures                 | Simulation owner; cross-runtime replay test |
| Pathfinding at scale     | High       | High     | Tick debt or stuck formations in 800-pop fixture | Two-level nav, bounded jobs, deterministic recovery                    | Simulation owner; Phase 2 stress fixture    |
| Browser GPU variation    | High       | High     | WebGPU unavailable or shader/context failure     | WebGL fallback, feature detection, quality tiers                       | Renderer owner; Phase 1 device matrix       |
| Content scope            | High       | High     | Faction/biome work blocks gates                  | Two factions first, schema-driven content, phase gates                 | Design owner; Phase 5 content dashboard     |
| Art/audio capacity       | High       | Medium   | Placeholder assets reach production              | Procedural first kit, manifest, IP review, explicit placeholder labels | Art owner; Phase 1 asset review             |
| Server cost              | Medium     | High     | Room density exceeds budget                      | Room ownership, bounded snapshots, capacity dashboards                 | Operations owner; Phase 7 load test         |
| Cheating                 | Medium     | Critical | Client submits state or hidden-info request      | Server authority, validation, anomaly logging, review tooling          | Multiplayer owner; Phase 4 tamper tests     |
| Reconnect/desync         | Medium     | Critical | Client misses commands or checksum               | Snapshot recovery, command log, quarantine on repeat mismatch          | Multiplayer owner; Phase 4 impairment test  |
| IP contamination         | Medium     | Critical | Untracked reference or asset enters build        | Original-art rule, provenance manifest, compliance review              | Creative owner; every asset gate            |
| Missing local services   | High       | Medium   | Docker unavailable for Postgres/Redis            | Keep Phase 0 pure/local; record blocker; choose runtime before M2      | Operations owner; PROJECT_STATE.md          |
