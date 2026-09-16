# Project state

## Current milestone

Phase 0 — repository baseline and thin foundation (complete for the local track;
service orchestration is intentionally deferred).

## Verified

- [x] Project-local skills and agent guidance are present.
- [x] pnpm workspace, Turbo task graph, strict TypeScript, ESLint, Prettier, Vitest,
      and Playwright configuration are present.
- [x] `packages/sim` contains fixed-point, deterministic PRNG, canonical command order,
      and checksum primitives with tests.
- [x] `packages/protocol`, `packages/content`, and `packages/presentation` boundaries
      exist with minimal typed contracts.
- [x] `apps/web` launches a local Three.js canvas with a WebGL renderer path.
- [x] `pnpm build` passes (5 workspace builds; Vite warns that the initial Three.js
      chunk is larger than 500 kB, to address during Phase 1 asset/code splitting).
- [x] `pnpm verify` passes: Prettier, ESLint, strict typecheck, 7 Turbo test tasks,
      and one Playwright browser smoke test.
- [x] Playwright Chromium 153.0.8010.12 is installed locally; smoke test passed in
      2.6 seconds with no page errors.

## Not yet verified

- [x] Install/availability of the Playwright Chromium browser.
- [x] `pnpm verify` (run after dependency install and first fixes).
- [ ] WebGPU capability detection and explicit fallback benchmark.
- [ ] Local Postgres/Redis services; Docker is not installed on this machine.
- [ ] API, authoritative game server, and worker packages (deferred until a real
      consumer exists; no fake gameplay endpoints are being added in Phase 0).

## Last verified commit

`572531a06b69b207d5af5e5bee44fe4df3c1b6b5` — `chore: establish phase 0 foundation`

## Known failures/blockers

- Browser test will require a locally installed Playwright browser binary.
- Full API/game-server/worker/Postgres/Redis orchestration is deferred until a real
  consumer and a Docker runtime (or explicitly chosen local-service alternative) are
  available; no fake gameplay endpoints were added.

## Next three tasks

1. Begin the Phase 1 visual north-star fixture: original crest/wordmark, semantic
   temperate-coast scene, first asset kit, camera, and HUD composition.
2. Add capability detection and a measured WebGPU/WebGL backend choice.
3. Capture Phase 1 visual/performance evidence at all supported aspect ratios.
