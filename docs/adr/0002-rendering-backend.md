# ADR 0002: Three.js renderer and fallback

Status: accepted for Phase 0

Three.js owns the in-game scene and render loop outside React. Phase 0 uses a minimal
WebGL renderer path so the project is runnable on ordinary hardware. Phase 1 adds
capability detection, a measured WebGPU path, and a readable WebGL fallback; gameplay
and semantic terrain data remain identical across backends.
