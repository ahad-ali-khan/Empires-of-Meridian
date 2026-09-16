---
name: threejs-materials
description: PBR material and material-budget reference for the RTS renderer.
---

# Three.js materials

Use a small shared palette of `MeshStandardMaterial`-compatible materials. Set color
textures to sRGB; leave normal, roughness, metallic, AO, and masks as data textures.
Avoid unique material instances, expensive transmission, and per-unit shader variants.
Validate texture slots and material counts in performance fixtures.
