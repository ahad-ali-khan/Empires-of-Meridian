# ADR 0002: Validated content data

Status: Accepted

Gameplay numbers and stable IDs live in `packages/content`. Zod validates definitions at module load and the reference generator derives readable documentation from those definitions. Procedural asset factories map presentation IDs to models and cannot define costs, damage, training time, unlock age, or other authoritative rules.
