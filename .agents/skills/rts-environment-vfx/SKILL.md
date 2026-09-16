---
name: rts-environment-vfx
description: Shader-only grass, wind, water, rain, and cosmetic wildlife.
---

# Environment VFX

Drive grass, wind, water, precipitation, and wildlife through render-time uniforms,
seeded cosmetic streams, and shaders/instancing. They may read snapshots but cannot
write simulation, targeting, pathfinding, visibility, resource, or collision state.
Provide quality tiers, particle caps, pause behavior, reduced-motion support, and a
static fallback. Validate that weather legibility never masks player-owned units.
