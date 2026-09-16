---
name: rts-threejs-renderer
description: Chunk rendering, instancing, LOD, picking proxies, disposal, and WebGPU fallback.
---

# RTS Three.js renderer

Own the Three.js renderer and scene outside React. Render immutable/interpolated
simulation snapshots; never write gameplay state. Partition terrain and static props
into cullable chunks, share geometry/materials, instance repeated units/props, and use
profiled LOD transitions. Pick against simple per-entity proxies mapped to stable IDs.

Budget and capture draw calls, triangles, texture memory, shadow cost, frame time, and
GC churn. Every allocation has an owner and explicit disposal path. Feature-detect
WebGPU; retain a tested WebGL fallback with equivalent gameplay readability, and make
advanced effects optional rather than a launch requirement.
