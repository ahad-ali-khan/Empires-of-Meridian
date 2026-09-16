---
name: threejs-loaders
description: Local-only glTF, texture, and HDR loading with explicit states.
---

# Three.js loaders

Load allowlisted local assets via a manifest with progress, cancellation, error, and
disposal paths. Pin decoder/transcoder files in the app bundle; never point loaders
at a CDN or arbitrary URL. Validate glTF before runtime use and separate cosmetic
load failures from simulation state. See `rts-asset-pipeline` for acceptance rules.
