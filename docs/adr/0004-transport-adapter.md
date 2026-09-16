# ADR 0004: transport adapter

Status: proposed for Milestone 2

The protocol package owns versioned command and snapshot envelopes. A room transport
(Colyseus or a maintained equivalent) will sit behind an adapter so `packages/sim`
never imports framework classes. Selection of the transport waits for the multiplayer
proof phase and an official-docs/version review.
