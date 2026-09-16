---
name: threejs-shaders
description: Controlled Three.js shader and uniform reference.
---

# Three.js shaders

Keep shaders small, shared, and feature-gated. Drive uniforms from render time,
camera, and immutable snapshot data only. Do not write simulation state, use random
unseeded gameplay effects, or branch into per-unit material permutations. Verify a
fallback material and profile GPU cost on the target scene.
