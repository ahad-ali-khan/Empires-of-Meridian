# Offline audio pipeline

The game uses semantic audio events. Simulation events remain authoritative; the browser only turns them into sound. No audio timing changes a match result.

## Local production stack

- Kokoro-82M with the MLX wrapper for local English voice lines on Apple Silicon.
- Audacity for cleanup, loudness normalization, trimming, and batch export.
- LMMS for music and loops.
- Web Audio API for procedural UI cues, impacts, weather, resource work, and distance-safe fallback sounds.

Rendered voice and music files can be added later without changing simulation code. The current fallback is intentionally self-contained so a clean checkout has audible feedback immediately.

## Registered event families

`ui.*` covers menu, selection, command accepted/rejected, placement, queue, cursor, alert, pause, save, and victory/defeat feedback.

`resource.*` covers gathering, carrying, deposit, depletion, tree fall, mine chunk break, farming, fishing, hunting, carcass processing, and drop-off.

`construction.*` covers blueprint, scaffold, hammer, stage changes, repair, completion, damage, fire, collapse, rubble, walls, gates, and garrison access.

`production.*` and `research.*` cover queue changes, population-cap blocking, training, technology, age advancement, council choices, Renown, and Dispatches.

`combat.*` covers attack wind-up, melee contact, projectile launch/flight/impact, material impacts, armor, shields, explosions, cannon recoil, building weapons, destruction, and machine break-apart.

`wildlife.*` covers sheep, deer, wolves, hounds, horses, birds, fish jumps, fleeing, capture, death, and carcasses.

`weather.*` covers clear ambience, wind, rain, thunder, lightning, water, shore foam, boat wake, fire, smoke, and environmental transitions.

Every event should eventually have three or more variations, a priority, a concurrency limit, and optional material, surface, owner, distance, and intensity parameters. High-volume events are throttled by the mixer.

## Licensing rule

Generated files and downloaded files must be recorded with source, creator, license, model, modification date, and checksum in the asset manifest. Do not ship a voice or sound whose model or source license is unclear.
