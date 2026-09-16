---
name: threejs-lighting
description: Readable, budgeted RTS lighting reference.
---

# Three.js lighting

Use a stable directional key, ambient/IBL contribution, fog, and restrained shadows
to preserve unit silhouette and player-color readability. Measure shadow-map cost and
avoid per-unit real-time lights. Lighting is presentation-only and cannot influence
visibility, combat, or any authoritative simulation decision.
