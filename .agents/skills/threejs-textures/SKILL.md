---
name: threejs-textures
description: Local texture, UV atlas, and HDR optimization reference.
---

# Three.js textures

Load only bundled, hashed local assets. Define UV-atlas padding and mip behavior;
use compressed textures only after target-device verification. Color maps are sRGB;
data maps are not. Cap anisotropy and texture resolution according to the renderer
budget. Dispose textures with the owning asset/chunk.
