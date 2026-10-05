# Game completion roadmap

Scope: the original `data.md` plus accepted changes in the conversation. Four ages (Stone, Classical, Medieval, Industrial); Modern is excluded. Assets and fixtures are not completed gameplay. Each stage needs runnable code, regression evidence, current status, and a meaningful commit before its release gate closes.

## Dependency order

1. **Offline rules:** real Dispatch deliveries and cancellation; council choices and modifiers; research and upgrades; full contextual orders; trade, treasures, alliances; support abilities and naval mechanics.
2. **Offline certification:** tutorial coverage, legal-information AI, full matches, save/load and replay determinism, map fairness, performance and interaction repairs.
3. **Online foundation:** authenticated identity, durable database migrations, room transport, server ownership validation, synchronized starts, reconnect, snapshots, results and replays.
4. **Social multiplayer:** private/public lobbies, invites, readiness, teams, chat, pings, moderation, team voice, spectators and online recovery.
5. **Competitive systems:** matchmaking, ratings, seasons, complete second faction, additional victory modes, balance and network impairment testing.
6. **Content breadth:** remaining factions, ten map biomes, full unit/building/technology/deck collections, mode rules, campaign opening and challenges.
7. **Player tools:** compendium, deck builder, replay viewer/seeking, complete settings/hotkeys, localization and scenario editor.
8. **Production release:** distinct audio performances and adaptive music; accessibility, hardware performance, online security, deployments, scaling, backups, observability, operations and complete campaign.

## Delivered increment — Dispatch lifecycle

Owner: content, protocol, deterministic simulation and match HUD.

Invariant: token reservation, departure, delivery, population and refunds are simulation decisions; presentation displays immutable results. Preserve stable card IDs. New content version explicitly rejects incompatible saves.

Acceptance: 24 distinct validated starter cards; reserve tokens rather than grant instant resources; cancellation only before departure; reject duplicate once-only cards; wait for a completed owned arrival site, available population and free spawn positions; deliver real resource bundles and units; expose all legal cards, effects, timers, waiting reasons and cancellation; save/load and replay checksum parity during transit. Opponents must not receive private pending card information.

Rollback: Git history retains the pre-lifecycle offline implementation. No unsupported save conversion is attempted.

This increment is not completion of the whole Dispatch product. Custom deck authoring, collection variants, research-effect cards and Aurelian paid rerouting follow the underlying research/faction systems.

## Release gates still open

Full milestone gates in `data.md` and the accepted Milestone 1 plan remain authoritative. No stage is complete from passing unit tests alone. Hardware FPS, remote networking, complete human playthroughs and production operations require recorded evidence.

## Verified increments

- Dispatch lifecycle: commit `e8598a5`; six new simulation regressions, full 49-test unit suite, lint/build and live Chromium interaction passed.
- Council progression: choice UI for all three advances, nine council choices, validated shared costs/rates, real gathering/training/market/carrying/combat effects, integer fractional production, hall-dependent advancement and inspectable active bonuses. Regression coverage includes timed delivery, missing hall, mid-training replay/save parity, actual market payouts and projectile damage for either player. Dispatch capacity also counts already-reserved training population.

- Research and production: seven validated technologies, shared timed building queues, prerequisite/age/ownership checks, duplicate prevention, full upfront reservation, cancellation refunds, reserved-population release, research completion bonuses, and real Forged Blades militia-to-swordsman conversion. AI orders research through the player command path. Research persists across save/load. Full unit suite and focused browser results are recorded in `PROJECT_STATE.md`.

## Next increment — dependable contextual commands

Audit and complete queued orders, attack-move, patrol, guard, support abilities and command feedback. Verify interruption/recovery and moving-target engagement with replayable tests before adding trade/treasure systems. Offline full-match, AI, cross-browser and hardware certification still precede online work.

No networking, chat, campaigns, additional factions, or whole-game completion is claimed by these increments.
