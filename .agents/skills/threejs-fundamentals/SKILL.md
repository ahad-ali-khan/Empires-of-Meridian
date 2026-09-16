---
name: threejs-fundamentals
description: Safe Three.js scene, camera, renderer, transform, and cleanup reference.
---

# Three.js fundamentals

Use Three.js directly; React may own UI but not the scene graph or render loop.
Keep a single renderer and explicit scene lifecycle. Cap device pixel ratio, update
camera projection on resize, and dispose GPU resources when a scene/chunk leaves.
Use an RTS-friendly perspective camera and a documented world-axis convention.

Do not load remote assets or mutate simulation state from render-frame callbacks.
See `rts-threejs-renderer` for project constraints.
