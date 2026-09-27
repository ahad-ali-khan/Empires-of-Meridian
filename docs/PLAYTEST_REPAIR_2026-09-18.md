# Offline playtest repair — September 18

This records an implementation and regression pass, not completion of Milestone 1.

## Interaction and simulation

- The playable renderer reuses the original procedural models, environment and free orbit camera. Empty-ground drag orbits; Shift-drag selects. Camera-relative WASD and middle-drag pan.
- Grid paths now finish at the exact requested world point. Previously, workers could stop at the center of the final navigation cell, outside their work-position tolerance. Animation now requires an authoritative working state, rather than assuming any gathering order means the worker is already at the site.
- Forests contain individual resource entities with narrow trunk picking proxies. Previously six visible trees shared one oversized resource selection box. Depleted trees retarget matching resources within 16 world units of the original work site, after depositing the final load.
- Gathering and construction reserve distinct approach positions. Farms reserve two worker positions, including during deposit trips. Excess workers wait up to six simulation seconds, then give explicit feedback. Movers yield and replan around occupied cells; they do not displace idle units.
- Sheep accept movement commands. Newly captured sheep follow a nearby capturing unit until manually ordered elsewhere. Buildings can also capture sheep. Ownership transfers still use the closest eligible influence.
- Production exits are selected from unblocked perimeter candidates. Recruits inherit the stored world-space rally. Selected buildings display persistent rally markers; queue labels show queued unit names, in addition to the complete selection-panel queue.
- Construction resumes through worker context orders. Fort workers use reachable perimeter work positions. Incomplete structures cannot produce units. Farm context orders gather renewable provisions rather than attempting garrisoning.
- Worker cargo is visible as a resource prop and named in the selection panel. Hover cursors distinguish mining, chopping, gathering, farming, hunting, fishing, processing, attacking, building and garrisoning.
- Chopping uses a forward-facing axe edge and a dedicated swing. Trees switch to felled wood and stump geometry during harvesting. Buildings use authored damage, fire, critical collapse and rubble states at health thresholds.

## Map and presentation

Map generation version 4 contains seeded coastlines, individually harvestable forests, a lake basin, raised highland, cliff barriers and a traversable ramp. Rendering, navigation, buildability and minimap share terrain definitions. Skirmishes support zero through three AI opponents with independent starts, fog, economies and command sequences. Previously saved generation versions are rejected with the existing readable version error; begin a new match for these changes.

Terrain stays above the water plane except at declared water surfaces. Picking assistance is limited to a small screen-space radius around mobile entities. Unit picking bounds exclude long weapons. Trees remain instanced; changing resource identity does not require one draw call per tree mesh.

## Verification

- Simulation regression suite: 27 passing tests, covering economy, work slots, farm capacity, sheep orders, resource retargeting, fort construction, mounted rally/movement, visibility memory, timed advancement, equal-stat combat across difficulties, deterministic save continuation, independent AI players, mixed cargo, garrison defense, non-pushing movement, inland/shore fishing, and terrain connectivity.
- Browser and original asset suite: 23 passing tests, including tutorial launch/pause, selection/orbit/zoom, production/rally, Forge, 100 showcase placement seeds, model geometry, damage states, weapon grips and authored animation checks.
- A representative browser capture reported 323 draw calls and about 706,000 triangles. This is one scene sample, not a sustained performance benchmark.

Still required for release: full tutorial and 1v1 playthroughs, comprehensive AI evaluation across 100 matches, browser-to-Node golden replay comparison, map fairness certification across sizes, maximum-population crowd testing, and sustained M1 Air performance captures. The presentation death motion is a bounded articulated fall simulation, not a general-purpose rigid-body physics engine.

## Movement performance investigation

In a Node headless sample with seed 73 and 829 entities, 600 simulation steps averaged 6.19 ms and 100 full live snapshots averaged 22.62 ms. After caching vision-source lists and navigation topology, steps averaged 1.29 ms. Live snapshots averaged 1.52 ms after removing full-state checksumming from the ten-Hz presentation stream and counting garrison occupants once per snapshot. The public snapshot interface still computes a checksum by default; saves and determinism tests retain full checksums. The fast worker presentation path explicitly opts out.

The renderer now tests conservative entity bounds against the camera frustum, skips off-screen animation work, and compacts visible parts into instance batches. Zero-scale instances no longer consume vertex work for every hidden unit. Terrain and water meshes are bounded to the map, with a dark edge wall while retaining the sky. These are CPU and rendering changes, not a verified 60 FPS hardware result.

Research references: [Three.js frustum documentation](https://threejs.org/docs/pages/Frustum.html), [InstancedMesh documentation](https://threejs.org/docs/pages/InstancedMesh.html), [Forgotten Empires gathering guidance](https://www.forgottenempires.net/strategy/age-of-empires-ii-strategy-center/resource-gathering), [official garrison/return-to-work update](https://www.ageofempires.com/news/age-of-empires-ii-definitive-edition-update-107882/). These describe public behavior and APIs; this project does not claim access to AoE's private engine implementation.

Resource collection remains rate-based and position-gated in the simulation. Cosmetic axe contacts cannot change resource totals. Workers retain previously carried resources when switching jobs, show only the active resource prop, and carry at most ten units of each resource before depositing. Town-hall garrisoning deposits all cargo; forts retain it until later delivery. Back-to-work restores the previous job. Fallen wood abandoned for 120 seconds becomes a stump; stumps clear after another 30 seconds.

## September 19 continuation

- Static terrain/building topology remains authoritative for A*. Moving squads no longer turn one another into a sealed wall; they share their route in transit and separate into reserved formation destinations. Deterministic steering handles local traffic and building corners. Recovery measures actual displacement, so a valid detour can move away from its final goal without being repeatedly reset.
- A worker regression now covers repeated shore-fishing delivery trips through save/restore. A 48-unit crowd regression crosses a central-hall obstruction, retains its orders, and reaches distinct destinations.
- Buildings and resources share square bounds for collision, interaction distance, work slots, foundations and navigation. Garrison and deposit orders choose the closest accessible edge. Construction scaffolding stays inside the authored footprint.
- Building placement uses an authored translucent model and square footprint instead of a flat tile alone. Q/E rotates in quarter turns; the authoritative command stores the rotation and swaps rectangular collision dimensions.
- Map generation version 5 selects one of three inland-water/highland macro recipes, rotates opposing starts across distant regions, and orients each starting economy toward the playable interior. This is the first composition pass; region graphs, trade-route curves and contest-ring validation remain open.
- Stone, Classical, Medieval and Industrial progression is playable. Newly registered land buildings and units are exposed according to content age, and a regression builds every registered presentation model at its unlock age.

Fresh verification after these changes: 34 deterministic unit checks pass, strict TypeScript passes, the production build passes with the existing bundle-size advisory, and four Playwright interaction flows pass (selection/camera, production/rally, wall/gate placement, and worker chopping/cargo). The browser sample reported 362 draw calls and about 728,000 triangles; the headless frame interval is not a valid hardware FPS measurement.
