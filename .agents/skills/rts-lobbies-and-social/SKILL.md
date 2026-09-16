---
name: rts-lobbies-and-social
description: Private/public lobbies, party state, matchmaker, chat moderation, and voice tokens.
---

# Lobbies and social

Treat lobby membership, party state, ready state, map/mode selection, and matchmaking
as server-owned versioned state. Authorize every transition and prevent clients from
choosing opponents, room ownership, or final settings unilaterally. Chat is untrusted:
rate-limit, bound length, escape output, audit moderation actions, and define reports,
blocks, and retention rules.

Issue voice tokens server-side with minimum grants, room binding, short expiry, and no
client-held service secret. Reconnect behavior must be idempotent and privacy-safe.
