# Empires of Meridian

Current scope: **offline gameplay implementation and playtest repair**. The default route is the tutorial/skirmish prototype; the original coast showcase and Asset Forge remain at `/dev/forge`. No milestone release gate is claimed passed. See `docs/PLAYTEST_REPAIR_2026-09-18.md` for current changes, regression evidence and remaining verification.

September 19 continuation: map generation is version 5 with three seed-driven macro terrain recipes and distant start rotation. Buildings/resources use shared square simulation bounds; work, garrison and drop-off orders choose legal perimeter points. Group recovery now measures actual displacement and a 48-unit obstruction regression passes. Building placement renders the authored translucent model, supports Q/E rotation, and applies the same rotated footprint to validation and navigation. The playable content registry now exposes Stone through Industrial definitions and all registered unit/building models validate at their unlock age. See `docs/WORLD_SCALE_MAP_AND_AUDIO_DIRECTION_2026-09-19.md` for scale, battlefield grammar, metrics and the recommended audio workflow.

Implemented: a local Three.js settlement and Asset Forge with original procedural assets, articulated animation previews, resource demonstrations, weather, and an actively developed deterministic offline match.

Current verification slice: `pnpm typecheck`, `pnpm test:unit`, `pnpm test`, and `pnpm ai:evaluate:local`. The offline AI now records target, route, and resource-focus telemetry; the local evaluator runs 40 deterministic small-map matches for 3,600 ticks by default and reports strategy/route/target variety. A 100-seed early-match stress run completed with 100 unique checksums and no crashes at 2,400 ticks; full-length conquest balance is still open. Multiplayer remains a foundation fixture, not a release-ready authoritative service.

The repeatable headless profile (`pnpm tsx scripts/profile-sim.ts`) currently measures about 1.37 ms per simulation tick and 0.63 ms per live snapshot at 825 entities on this host. This is a CPU simulation sample, not a sustained GPU or M1 Air frame-rate claim; the renderer performance gate remains open.

- [ ] Milestone 0: foundation, deterministic fixtures, services, CI
- [ ] Milestone 1: offline vertical slice
- [ ] Milestone 2: multiplayer proof
- [ ] Milestone 3: competitive core
- [ ] Milestone 4: content breadth
- [ ] Milestone 5: polish and scale

## September 17 visual revision

- Four supported ages: Stone, Classical, Medieval, Industrial. Modern Age is removed. Unlock and retirement metadata restrict Forge age choices.
- Building types use distinct footprints and layouts. Forts, watchtowers, civic halls and houses have different world proportions. Forge has a shared-camera scale comparison, because fitting each asset individually hides size differences.
- Walls and gates progress from timber palisades to battlemented masonry to thick, sloping artillery defenses.
- Stone Age barracks and club-armed militia are included. Forge previews the Classical forged-blade upgrade to swordsman. This is content metadata and an inspection workflow, not a completed match research/training system.
- Damage preserves closed mesh topology, with deformation, charring, fire, roof collapse and rubble instead of deleting isolated triangles. Construction, cleared, resource depletion and felled-tree states are inspectable.
- Weapon grip tests cover rifles, bows, crossbows, mining tools and mounted equipment. Ranged units have cosmetic projectiles. Workers hunt with bows before Medieval and crossbows thereafter; hunted deer alternate running and resting in the resource demo.
- Dock warehouses/cranes are restored; workers, faction accents, female proportions, naval silhouettes and role-specific unit equipment have been revised.

Validation: `pnpm test` — 17 passing checks, including all default asset factories, 100 layout seeds, age restrictions, building proportions, damage topology, tool grips, projectile visibility and net landing. `pnpm build` passes, with Vite's existing bundle-size advisory. Native Chrome inspection confirmed the live settlement and Forge; the final damage and scale revisions still need a complete visual sweep. Chrome control was interrupted by active user interaction. A single 60 FPS HUD observation is not a hardware benchmark or a sustained performance guarantee.

The September 17 section above is historical. Fixed-tick economy/combat, navigation, production, local saves and the offline match shell now have implementations under active playtest. Multiplayer and the complete Milestone 1 acceptance gates remain unfinished.

## October 5 completion sequence

The full game remains incomplete. `docs/COMPLETION_ROADMAP.md` records the dependency order from offline rule completion through multiplayer, social, competitive/content systems and production certification.

Dispatch lifecycle increment: content version 4, 24 distinct resource/unit cards, reserved tokens, five-second pre-departure cancellation/refund, deterministic travel, once-only rules, arrival-site/population/spawn waiting, legal AI use, private charter state, and full card/timer HUD. Older content-version saves are explicitly unsupported; no migration is claimed.

Fresh evidence: six Dispatch simulation regressions pass, including mid-transit save/restore final checksum parity; full unit suite 49/49 passes; ESLint and production build pass (existing bundle-size advisory). A real Chromium interaction test passes: all 24 cards, real worker delivery text, token reservation, transit display and cancellation/refund, without page errors. Headless software rendering stalled menu clicks; Metal rendering on this macOS host completed the flow in 7.1s. No full-match or milestone release gate is certified.

Next three tasks: complete council modifier effects and choice UI; implement research/upgrade queues; expand reliable command coverage before offline certification and multiplayer.

Council continuation: content version 5 introduces validated advancement costs/durations and modifier definitions. All nine council choices are exposed in the HUD with resource deliveries and permanent effects. Gathering, unit production, building defense, military/artillery damage, market income and worker carrying effects use deterministic shared rates; production retains integer fractional progress across saves. A missing hall pauses advancement. Selected damage/carry capacity uses the same rules as the simulation. Incoming Dispatch units respect population reserved by existing production queues.

Verification: 13 focused Dispatch/council simulation tests and the Chromium charter/council interaction pass; lint/typecheck and production build pass. Full unit suite: 56/56 tests pass across 12 files. Existing content versions are rejected with an unsupported-version message; migration remains future work.

Next: research/upgrade queues and refunds; dependable queued/attack-move/patrol/guard/heal/deploy commands; trade/treasure/neutral objectives. Online work follows offline certification.


Research continuation (content version 6): seven schema-validated technologies with ages, sites, costs, durations and prerequisites. Unit training and research use a shared timed building queue. Jobs have stable command-sequence IDs so cancellation cannot accidentally remove a shifted queue item. Unstarted jobs refund 100%; started jobs refund 50%. Unit cancellation and building destruction release reserved population; destruction gives no refund. Research modifiers affect real economy/training/combat values. Forged Blades upgrades living and subsequently created militia to swordsmen, preserving health fraction and existing orders. AI requests research through the same validator. World labels and selected-building panels show both job types, cancellation refunds, availability and effects.

Verification: full unit suite 65/65 across 13 files; nine research/production regressions cover completion, prerequisites, legality, cancellation, destruction, upgrades and mid-research save/restore checksum parity. Chromium research/production and Dispatch/council flows pass without page errors. Lint, strict app/package typecheck and production build pass; existing bundle-size advisory remains. Old content-version saves are rejected; no migration is available. Full offline match certification, hardware performance, multiplayer and full-game completion remain open.

Next: dependable contextual/queued commands and support abilities, then trade/treasures/neutral objectives and offline certification.
