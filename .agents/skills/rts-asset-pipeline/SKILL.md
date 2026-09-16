---
name: rts-asset-pipeline
description: Original procedural models, glTF validation, LODs, animation events, and licensing.
---

# Asset pipeline

Use original or appropriately licensed source assets only. Maintain an asset manifest
with source, license, author, checksum, target budgets, and generated outputs. Validate
glTF structure, external references, materials, texture dimensions, triangle counts,
LODs, skeleton limits, and animation clip/event names before acceptance.

Animation events must be versioned data consumed by deterministic simulation only when
their timing is explicitly authored in ticks; visual interpolation remains cosmetic.
Do not accept remote asset URLs or embedded executable content. See `rts-ip-compliance`
before importing any reference.
