# ADR 0003: versioned content data

Status: accepted for Phase 0

Gameplay definitions use stable kebab-case IDs, explicit content versions, and typed
envelopes in `packages/content`. Later schemas will validate units, buildings,
technologies, dispatches, factions, maps, and modes at load time and generate UI
reference data from the same source. Display text and presentation references remain
separate from authoritative values.
