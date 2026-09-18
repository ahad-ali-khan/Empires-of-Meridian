# Empires of Meridian

Current scope: **visual review prototype**, requested by the user before implementation of the complete game. The latest instruction deliberately prioritizes art before the brief's Milestone 0. No milestone gate is claimed passed.

Implemented: a local Three.js settlement and Asset Forge with 89 original procedural assets, articulated animation previews, resource demonstrations, and weather.

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

The resource sandbox is a visual demonstration. Deterministic economy/combat, navigation, production queues, multiplayer, saves and full playable matches remain unimplemented. No milestone gate is claimed passed.
