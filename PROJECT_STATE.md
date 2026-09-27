# Empires of Meridian

Current scope: **offline gameplay implementation and playtest repair**. The default route is the tutorial/skirmish prototype; the original coast showcase and Asset Forge remain at `/dev/forge`. No milestone release gate is claimed passed. See `docs/PLAYTEST_REPAIR_2026-09-18.md` for current changes, regression evidence and remaining verification.

September 19 continuation: map generation is version 5 with three seed-driven macro terrain recipes and distant start rotation. Buildings/resources use shared square simulation bounds; work, garrison and drop-off orders choose legal perimeter points. Group recovery now measures actual displacement and a 48-unit obstruction regression passes. Building placement renders the authored translucent model, supports Q/E rotation, and applies the same rotated footprint to validation and navigation. The playable content registry now exposes Stone through Industrial definitions and all registered unit/building models validate at their unlock age. See `docs/WORLD_SCALE_MAP_AND_AUDIO_DIRECTION_2026-09-19.md` for scale, battlefield grammar, metrics and the recommended audio workflow.

Implemented: a local Three.js settlement and Asset Forge with original procedural assets, articulated animation previews, resource demonstrations, weather, and an actively developed deterministic offline match.

Current verification slice: `pnpm typecheck`, `pnpm test:unit`, and `pnpm ai:evaluate:local`. The offline AI now records target, route, and resource-focus telemetry; the local evaluator runs 40 deterministic small-map matches for 3,600 ticks by default and reports strategy/route/target variety. Multiplayer remains a foundation fixture, not a release-ready authoritative service.

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
