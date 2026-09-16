# ADR 0007: voice transport

Status: proposed for Milestone 2

Voice is optional and independent of the deterministic game server. A server-issued,
short-lived, room-scoped LiveKit (or equivalent SFU) token grants only the required
publish/subscribe permissions. Voice failure must never pause or disconnect gameplay.
