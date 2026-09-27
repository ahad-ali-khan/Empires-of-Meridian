# World scale, battlefield composition, and audio direction

## Decision

Empires of Meridian treats one rendered world unit as one metre and 256 deterministic simulation units as one rendered metre. This keeps the authored asset scale, renderer, path grid, projectile travel, interaction bounds, and map generator on one explicit conversion.

We will tune game feel against visible and timed outcomes rather than copying undocumented constants from another game:

- A worker is roughly 1.65–1.8 m tall and occupies a soft personal-space core of about 0.5 m.
- Formation destinations are normally 2 m apart. Work sites use reserved perimeter slots instead of overlapping workers.
- A normal play camera should show roughly 30–50 world metres across the useful center of the screen; the strategic zoom may show much more while preserving every entity with lower detail.
- Civil buildings generally span 6–14 m. Defensive landmarks and forts can be larger, but their gameplay footprint remains explicit and stable across visual age variants.
- Map sizes are 192, 256, and 320 m per side today. These values must be assessed through travel times, rush distance, safe-resource time, contested-resource time, and camera occupancy before final balance lock.

The public Age of Empires III random-map documentation describes map X/Z size in metres, places players through circular, square, and authored-area rules, and says official maps scale with player count. It does not publish the art-to-collision ratio, unit capsule dimensions, camera framing constants, or internal avoidance implementation. Those values must not be invented or presented as copied facts.

## Why the old generated map felt flat

The previous generator varied noise, coastline knots, one lake center, and resource scatter, but retained the same macro composition on every seed. Random noise changes detail; it does not create a different strategic story. The result lacked distinct lanes, readable regions, protected economy pockets, contest points, landmarks, and meaningful choices between safe and exposed expansion.

## Battlefield grammar

Generation should happen in this order:

1. Choose a versioned macro recipe.
2. Place player regions with a minimum travel-time separation.
3. Create two or more primary connections and at least one secondary or destructible route.
4. Place coast, lakes, cliffs, ramps, highlands, clearings, and trade paths as named regions.
5. Reserve stable square footprints for starts, buildings, resources, objectives, and interaction perimeters.
6. Place equal starting budgets per player, then safe secondary resources, then higher-value contested resources.
7. Place forests as patches with edges and openings rather than uniformly scattered trees.
8. Place wildlife by habitat and flee space; place fish only where a legal shoreline work slot exists.
9. Validate reachability, rush-distance variance, resource budgets, shoreline access, slope, overlap, and navigation connectivity. Repair or reject the seed.
10. Decorate only after semantic regions and gameplay reservations pass.

The first implementation now selects among three seed-driven inland-water/highland compositions, rotates fair start pairs across distant regions, points starting resources toward playable interior, and keeps the coast seed-driven. The next map pass should add an explicit region graph, authored trade-route curves, named forest clearings, and contested resource rings rather than adding more height noise.

## Required map metrics

For every accepted seed, record:

- Ground travel time between opposing central halls.
- Travel time from each central hall to its nearest food, timber, coin, metal, fish, and trade objective.
- Per-player starting and secondary resource budgets.
- Number and width of independent passable routes between player regions.
- Buildable area within 20 m and 40 m of each start.
- Shoreline work-slot count for each fish habitat.
- Maximum start-to-start and start-to-objective fairness delta.
- Stuck recovery, failed-path, and unreachable-order counts from a deterministic scout sweep.

## Interaction and placement contract

- Buildings and resources use square axis-aligned bounds in simulation space. A quarter-turn swaps rectangular width and depth.
- Preview, obstruction, construction scaffolding, navigation, work slots, and renderer foundations consume the same dimensions.
- Units build and garrison at the building perimeter. They gather at reserved resource perimeter slots.
- A formation routes around static world geometry, shares its route while in transit, and separates into stable reserved destinations.
- Recovery is based on actual displacement, so a legitimate detour is not mistaken for a stall.

## Audio production recommendation

The best directly installable assistant workflow found is the official ElevenLabs sound-effects skill:

```sh
npx skills add elevenlabs/skills --skill sound-effects
```

It requires an ElevenLabs account and API key. The official workflow can generate timed effects and 48 kHz WAV output; the Sound Effects API also supports duration, prompt influence, and seamless loops. It is suitable for creating original action, Foley, mechanical, production, weather, ambience, and UI source material.

Generation alone is not a finished game mix. Every audible event should have a small variation set, distance and obstruction treatment, concurrency limits, loudness normalization, clean loop points, faction/material metadata, and a licensing/source entry. Repeated actions such as chopping, mining, firing, impacts, hoof steps, production, and selection need several related samples so they do not sound identical. Final review should happen in context at low and high unit counts, with UI priority protected from battle noise.

Sources:

- Age of Empires Support, Random Map Scripting Commands: https://support.ageofempires.com/hc/en-us/articles/8478836252564-Random-Map-Scripting-Commands
- Age of Empires Support, Custom Maps Guide: https://support.ageofempires.com/hc/en-us/articles/8478444858388-Custom-Maps-Guide
- ElevenLabs, Sound Effects quickstart: https://elevenlabs.io/docs/eleven-api/guides/cookbooks/sound-effects
- ElevenLabs, Sound Effects overview: https://elevenlabs.io/docs/overview/capabilities/sound-effects
- ElevenLabs, Agent Tooling: https://elevenlabs.io/docs/eleven-api/resources/agent-tooling
