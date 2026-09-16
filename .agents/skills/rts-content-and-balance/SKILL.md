---
name: rts-content-and-balance
description: Data schemas, factions, units, counters, upgrades, dispatches, and balance simulations.
---

# Content and balance

Express factions, units, abilities, upgrades, costs, cooldowns, counters, and scripted
dispatches as versioned, schema-validated data. Keep display strings/art separate from
authoritative values. Define integer scales and legal ranges at the schema boundary.

Balance changes require deterministic scenario simulations, matchup matrices, economy
curves, and replayable fixtures. Preserve stable IDs; migrations must explicitly map
retired content. Do not hide game rules in renderer/UI code or mutate content at runtime
from a service response.
