---
name: threejs-interaction
description: Raycasting, selection, camera, and world-input reference.
---

# Three.js interaction

Raycast against dedicated, simple picking proxies and map hits to stable entity IDs.
Camera controls and pointer feedback are client presentation; validate every command
against an authoritative world state. Use deterministic grid coordinates for command
targets rather than floating render positions. See `rts-pathfinding-formations`.
