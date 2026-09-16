---
name: rts-authoritative-multiplayer
description: Server validation, snapshots, reconnects, room ownership, and anti-cheat boundaries.
---

# Authoritative multiplayer

The server owns rooms, tick progression, simulation state, legality checks, and final
results. Clients submit intent with identity, tick, sequence, and payload; the server
authenticates, rate-limits, validates ownership/cost/cooldown/target visibility, then
orders accepted commands deterministically. Clients never submit state deltas.

Use versioned snapshot/delta formats, bounded input queues, reconnect tokens with
expiry and rotation, and a defined reconnect window. Keep anti-cheat evidence and
moderation events redacted. Do not expose admin, matchmaker, database, or voice
credentials to clients; treat all lobby/chat and replay inputs as hostile.
