# Phase 1 visual review

## Review build

Run `pnpm --filter @meridian/web dev` and open:

- `http://127.0.0.1:4173/` — battlefield target
- `http://127.0.0.1:4173/asset-preview.html` — local procedural asset workshop

The scene is intentionally code-native and original. It uses a temperate-coast
semantic fixture with a settlement, coastal water, forest, road, wall/gate, workers,
infantry, cavalry, cannon, ship, banners, rain, and the field-atlas HUD.

## Review checklist

- [x] Original Meridian crest and wordmark treatment.
- [x] Warm daylight, cool readable shadows, earth/forest/stone/cloth palette.
- [x] Three-quarter camera with readable settlement scale.
- [x] Resource bar, weather/forecast, event feed, minimap, selection desk, and controls
      hint are visible without occupying the battlefield.
- [x] Ownership and status use shape, outline, labels, and color rather than color alone.
- [x] Reduced-motion control hides rain and suppresses cosmetic movement.
- [x] Asset workshop exposes provenance, manifest count, LOD target, and remote-load policy.
- [x] No remote asset URLs or third-party assets are present.

## Evidence

The Playwright suite captures launch and layout evidence at 1280×720, 1920×1080, and
2560×1080 and loads the asset preview route. The current build reports these large
chunks:

- `north-star`: about 578 kB minified
- `three.webgpu`: about 581 kB minified

These are tracked as optimization work, not hidden behind an adjusted warning.

## Remaining gate

Collect renderer metrics on a representative desktop and an integrated-graphics
profile: frame time, draw calls, triangle count, texture memory, shader compile time,
and context-loss recovery. Phase 2 should not begin claiming performance readiness
until those captures exist.
