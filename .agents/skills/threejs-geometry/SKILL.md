---
name: threejs-geometry
description: BufferGeometry, terrain meshes, and safe instancing reference.
---

# Three.js geometry

Prefer indexed `BufferGeometry`, typed arrays, and shared immutable geometry.
Use `InstancedMesh` for repeated static renderables, with a profiling-backed instance
budget. Recompute bounds after dynamic geometry edits. Keep navigation/collision
grids independent of render tessellation. See `rts-procedural-world` and
`rts-threejs-renderer` for authoritative constraints.
