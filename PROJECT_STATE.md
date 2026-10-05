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


Contextual orders continuation (content version 7): each mobile entity has an owner-private bounded queue. Shift-right-click appends move, gather, attack, resume-build, garrison, attack-move, patrol, guard and heal orders; immediate orders replace queued work, Stop clears it, and invalid orders preserve existing work. Completed or invalid queued targets advance deterministically. Patrol/guard remain persistent until replaced; harvesting queues wait for local resource exhaustion. Group destinations reserve separate positions even around blocked terrain. Attack-move engages visible enemies and resumes its route, with bounded pursuit. Guards follow and defend friendly targets. Medics heal living friendly units using validated range, rate and cooldown data, with automatic nearby treatment and a distinct treatment pose; machines and dead units cannot be healed. Buttons, T/P/G/H targeting keys, crosshair, queue inspection and event feedback are wired to player commands; WASD camera controls are retained.

Recovery fixes: worker fleeing retains its original movement destination and pending orders; queued actions cannot activate prematurely during escape. Repeated movement failures produce visible feedback and permit subsequent orders. Hold stops persistent patrol and queued movement. Internal queued activation does not fabricate command-log entries or inflate input statistics. Saves retain orders, directives, treatment cooldowns and recovery state; old content versions are explicitly unsupported.

Evidence: 82/82 unit tests across 14 files, including 16 tactical-order scenarios and a treatment-pose regression; command permutation and save/load final checksums agree. Three Chromium flows (tactical orders, research/production, Dispatch/council) pass without page errors. ESLint, strict app/package typecheck and production build pass; existing bundle-size warning remains. Full human match playthroughs, cross-browser replay certification and M1 hardware performance are not certified by this increment.

Next: trade, treasures, neutral objectives and remaining specialized support/blueprint commands, then offline certification before online work.

## Frontier economy and explorer objectives — October 5

Content version 8 and map recipe version 6 add three capturable trade sites and starting/contested treasure caches. Placement uses fixed footprints and a connected-ground flood check against all starts; invalid candidates are rejected. Connected ground is computed once per placement search, avoiding repeated A* searches over rejected candidates. Full objective fairness across every map recipe remains a certification task.

Completed markets exchange 100 Provisions, Timber or Metal for 130 Coin, or sell the same lot for 80 Coin. Ownership, completion, direction, resource kind and available funds are validated before spending. Nearby markets provide a 20% gathering bonus with saved fractional work; market and council/research gathering bonuses add. Identical market areas do not stack.

Trade sites are claimed through boundary contact and timed work, accelerated by at most three claimants. Opposing nearby units pause capture and income; abandoning an uncontested attempt decays its progress. Ownership can transfer through the same legal command path. Captured sites pay a selected resource every ten seconds. Nearby completed markets and player-built depots each add 20%, alongside commerce bonuses; the panel displays the actual payout. AI explorers collect legally observed caches and claim observed sites, choose income from their economy focus, and can pay to return incapacitated explorers. Army targeting excludes capturable sites rather than issuing invalid attacks against them.

Three validated cache types deliver resources and Renown once. Linked guards defend guarded caches; explorers must defeat them before collection resumes. Explorer defeats incapacitate rather than remove the unit or release its population reservation. Allied contact rescue, uninterrupted safe-territory recovery and a paid return to a clear completed-hall exit all restore half health. Saves preserve partial collection, capture disputes, selected income, income timers, recovery progress and fractional gathering. Downed explorers and neutral objectives have minimap markers; hidden static objectives retain their last observed fog memory.

Validation: eleven frontier simulation regressions cover exact exchanges, legality, guarded and once-only rewards, contested captures, hostile ownership transfer, income bonuses, hidden treasure memory, explorer recovery and save/restore checksum parity. Live Chromium flows cover buy/sell, contextual treasure collection, site capture and income choice, and selecting/returning an incapacitated explorer through the real worker. Earlier Dispatch/council, production/research and tactical-order flows are also retained. Final verification: 93/93 simulation tests across 15 files pass with one test worker; all five Chromium flows pass without page errors. Earlier parallel runs and a host pause produced timing failures; the final single-worker run completes in 77.69s and the browser run in 41.3s. Lint, strict typecheck and production build pass; the existing bundle-size advisory remains.

Compatibility: older content/map save versions fail explicitly; no migration is claimed. Moving trade convoys, neutral alliance contracts, treasure-granted units/upgrades, trade-dominance victory and complete AI/frontier balance certification remain future work. Human full matches, cross-browser replay parity and sustained M1 Air performance remain uncertified. These changes do not complete Milestone 1 or the whole game.

Next: specialized support and queued construction placement, neutral alliance contracts and naval rules; then comprehensive offline tutorial/match/AI/replay/performance certification before multiplayer.

## Crowd movement, attack responsiveness and building lots

Workers no longer treat idle soldiers as static navigation obstacles; only terrain and structures participate in A*. Friendly moving traffic can cross without pushing another entity, while distinct work and formation slots still separate destinations. Delivery accepts contact with any accessible drop-off boundary and temporary congestion retains the harvesting job. Moving-target replanning uses two-world-unit destination cells and at most eight movement path requests per tick, in stable entity order. Deferred actors keep their route and retry; save/restore produces the same checksum. This bounds search bursts when commanding a large army rather than allowing every attacker to replan in one worker tick.

Playable building views and placement ghosts share a ground-lot helper. Artwork retains its proportions and is contained inside the fixed lot; unused age-dependent space is shown as a foundation. Explicit placement edges match the lot. Rotated foundations use the simulation's rotated bounds. Construction board offsets now keep their whole width within the reservation. The original Coast showcase geometry is retained.

Evidence: 96/96 simulation tests across 16 files pass with one worker. New checks cover a worker crossing idle infantry, 48 attacking units with a per-tick path bound and replay/save parity, and every playable building's available first-three-age lot and construction bounds. Six Chromium flows passed across the regression run and a corrected group-attack test; the latter confirms a live 24-unit attack and continuing simulation clock. An initial browser fixture projected its target under the HUD and was corrected to place the target on the visible battlefield. Fresh lint/typecheck/build validation accompanies the commit. CPU profile at 834 entities: 1.99 ms/tick and 0.95 ms/live snapshot on this host; this does not certify GPU FPS or sustained M1 Air performance.

## Queued construction and cancellation — October 5

Content version 9 supports Shift-placement of validated, paid building blueprints while preserving each builder's current task. Queued structures and wall segments use the same bounded order queue as other actions; ordinary placement replaces pending work. Placement rotation is preserved while repeating blueprints. Overlap and full-queue failures do not spend resources. Unfinished buildings remain resumable after Stop.

The selected-building panel cancels owned unfinished construction, returning 100% for an untouched blueprint or 50% once work begins. Cancellation releases its footprint, removes stale builder orders and resumes remaining work. Completed or foreign structures cannot be cancelled, and repeat cancellation cannot refund twice. Existing saves with older content versions are explicitly unsupported.

Fresh verification: 101/101 simulation tests across 17 files pass, including sequential construction, queue preservation, overlap validation, refunds and save/checksum parity. Two Chromium movement/construction flows pass through the real worker and UI, including Shift-placement, rotation and cancellation. ESLint, strict typecheck and production build pass; the existing bundle-size advisory remains. A captured placement preview was inspected visually. Full-match, hardware performance and milestone release gates remain open.
