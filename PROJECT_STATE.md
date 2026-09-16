# Project state

## Current milestone

Phase 1 — visual north star (implementation complete; visual/performance review gate
pending).

## Verified

- [x] Project-local skills and agent guidance are present.
- [x] pnpm workspace, Turbo task graph, strict TypeScript, ESLint, Prettier, Vitest,
      and Playwright configuration are present.
- [x] `packages/sim` contains fixed-point, deterministic PRNG, canonical command order,
      and checksum primitives with tests.
- [x] `packages/protocol`, `packages/content`, and `packages/presentation` boundaries
      exist with minimal typed contracts.
- [x] `apps/web` launches a local Three.js canvas with a WebGL renderer path.
- [x] `pnpm build` passes (5 workspace builds; Vite still warns that the North Star
      and WebGPU chunks are larger than 500 kB, tracked for measured optimization).
- [x] `pnpm verify` passes: Prettier, ESLint, strict typecheck, 7 Turbo test tasks,
      and five Playwright browser checks.
- [x] Playwright Chromium 153.0.8010.12 is installed locally; smoke test passed in
      2.6 seconds with no page errors.
- [x] Deterministic North Star semantic terrain fixture with grass, forest, rock, sand,
      road, and shallow-water classes.
- [x] Original procedural settlement kit: central hall, houses, cannon, workers,
      infantry, cavalry, fishing boat, wall/gate, banners, trees, road, and rain.
- [x] Original SVG Meridian crest/wordmark treatment and field-atlas HUD composition.
- [x] WebGPU capability selection with WebGL fallback and explicit backend status.
- [x] Local asset manifest and `/asset-preview.html` workshop route.
- [x] Five browser checks pass across 1280×720, 1920×1080, ultrawide, and asset preview.

## Not yet verified

- [x] Install/availability of the Playwright Chromium browser.
- [x] `pnpm verify` (run after dependency install and first fixes).
- [x] WebGPU capability detection and explicit WebGL fallback path; benchmark is pending.
- [ ] Local Postgres/Redis services; Docker is not installed on this machine.
- [ ] API, authoritative game server, and worker packages (deferred until a real
      consumer exists; no fake gameplay endpoints are being added in Phase 0).

## Last verified implementation commit

`c6df70073ebcf018d51315c4f652d3df67e9e370` — `feat: build phase 1 visual north star`

## Known failures/blockers

- Phase 1 visual sign-off and renderer budget captures are still pending.
- Vite reports a >500 kB North Star and WebGPU chunk; code splitting/asset budgets
  need a measured follow-up.
- Full API/game-server/worker/Postgres/Redis orchestration is deferred until a real
  consumer and a Docker runtime (or explicitly chosen local-service alternative) are
  available; no fake gameplay endpoints were added.

## Next three tasks

1. Run the visual/performance review at supported aspect ratios and record sign-off.
2. Add measured renderer budgets and reduce/split the >500 kB visual chunks where the
   capture shows a real startup or memory problem.
3. Begin Phase 2 game-feel lab: selection, camera motion, command feedback, and
   deterministic combat sandbox.
