# ADR 0004: Future multiplayer transport

Status: Accepted for the foundation; transport gameplay is deferred.

Colyseus owns future room lifecycle and transport. Rooms will accept the same versioned commands used offline and publish visibility-filtered snapshots. The Milestone 1 match remains local-first; the game-server currently exposes a deterministic fixture room and health endpoint so protocol drift is caught without turning multiplayer into part of this milestone.
