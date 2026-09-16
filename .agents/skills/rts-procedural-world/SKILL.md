---
name: rts-procedural-world
description: Biome recipes, terrain semantics, weather, habitat, and generated-world validation.
---

# Procedural world

Generate maps from a versioned seed plus biome recipe. Separate authoritative terrain
layers (height, passability, resources, spawn/goal constraints, weather rules) from
render-only decoration. Use deterministic integer/noise inputs and canonical iteration.

Validate every generated map before it can host a match: valid spawns, symmetric or
intentionally asymmetric fairness constraints, connected routes, legal resource access,
no blocked objectives, and bounded generation time. Cliffs and water must share their
semantics with navigation. Weather may change only explicitly modeled simulation
layers; grass, particles, and wildlife remain cosmetic.
