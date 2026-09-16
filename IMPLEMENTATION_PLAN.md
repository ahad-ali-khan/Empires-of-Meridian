# Empires of Meridian — visual-first implementation plan

This plan turns `data.md` into an executable sequence. The first meaningful outcome
is a reviewable, original battlefield that already communicates scale, faction
identity, selection, motion, impact, and atmosphere. Backend breadth follows only
after the visual language and interaction feel have been accepted.

## How to use this plan

Every phase has four gates:

1. **Visual gate** — screenshots/video at 1280×720, 1920×1080, 16:10, and ultrawide;
   no clipped HUD, unreadable silhouettes, or unexplained effects.
2. **Feel gate** — a human can perform the intended interaction and explain its
   consequence without waiting, hunting for controls, or relying on sound alone.
3. **Engineering gate** — tests, performance evidence, versioned content, and explicit
   ownership boundaries pass.
4. **Scope gate** — incomplete work is recorded in `PROJECT_STATE.md`; no fake menu,
   fake matchmaking, scripted combat, or silent button is presented as finished.

At each gate, record the exact command, capture, device profile, known failures, and
the next three tasks. A phase cannot be “mostly done”: unresolved gate failures stay
in that phase.

## Non-negotiable sequencing

- The render sandbox and feel lab use the real package boundaries (`sim` snapshots,
  `presentation` intents, renderer-owned scene), even when their fixtures are tiny.
- Visual experiments never write simulation state. Cosmetic motion, audio, particles,
  and asset loads cannot affect checksums, pathing, visibility, or combat.
- Aurelian League is the first complete faction; Veyran Commonwealth is the second.
- A usable vertical slice precedes online breadth. Two-player authority precedes ranked.
- Every imported asset is original, generated in-repository, or recorded with source,
  license, author, URL, modifications, and attribution in `THIRD_PARTY_ASSETS.md`.
- `rts-*` project skills override generic Three.js advice where determinism,
  authority, accessibility, IP, or performance conflict.

## Phase 0 — repository baseline and thin foundation

**Purpose:** make later visual work safe to iterate on without spending the first
milestone on infrastructure that players cannot see.

**Work**

- Inspect the repository and preserve existing work; create/update `PROJECT_STATE.md`.
- Establish the monorepo baseline from the brief only if the repository has no sound
  alternative: `apps/web`, `apps/game-server`, `apps/api`, `apps/worker`, and packages
  for `sim`, `protocol`, `content`, `presentation`, `ui`, `asset-tools`, and
  `test-harness`.
- Add strict TypeScript, formatting/linting, unit-test runner, browser-test runner,
  workspace scripts, and a single local start command. Pin exact dependency versions.
- Write ADRs for deterministic simulation, transport, rendering backend/fallback,
  content data, licensing, deployment split, and voice architecture.
- Add a risk register covering divergence, pathfinding scale, GPU variance, content
  scope, art/audio capacity, server cost, cheating, reconnect, and IP contamination.
- Implement fixed-point primitives, seeded PRNG streams, canonical IDs, versioned
  content envelopes, command/snapshot/checksum types, and a minimal Three.js canvas.
- Add `.env.example` with safe local defaults. Keep secrets, build output, volumes,
  and caches out of version control.

**Deliverable:** a blank but real canvas, a pure simulation package runnable in Node and
a browser worker, and CI that can lint, typecheck, test, and launch one Playwright
smoke flow.

**Gate:** Node and Chromium agree on fixed-point/PRNG fixtures; the renderer has a
verified WebGL fallback path; no network or credential access occurs at startup.

**Rollback point:** retain only package boundaries, ADRs, and tests if a chosen
framework prevents a fast visual loop; do not add speculative engine abstractions.

## Phase 1 — visual north star (first player-visible milestone)

**Purpose:** answer “does this look and read like Empires of Meridian?” before building
the economy, server, or eight-faction content set.

**Work**

- Define the painterly strategic-realism language: warm daylight, cool readable
  shadows, compressed three-quarter scale, earth/forest/stone/cloth/oxidized-metal
  palette, restrained faction accents, and field-atlas/command-desk UI tokens.
- Create an original SVG wordmark and geometric crest. Add a provenance record and
  an explicit “not derived from existing game branding” review.
- Build a deterministic temperate-coast scene fixture: semantic height/slope/surface
  layers, shoreline, shallow water, cliffs, road, forest edge, buildable plateau,
  resources, and a readable central hall site.
- Create the first procedural asset kit: Aurelian buildings, one worker, one infantry
  silhouette, one cavalry silhouette, one field cannon, a fishing boat, trees, rocks,
  walls, gate, banners, props, and damage-state variants. Use shared materials,
  generated UVs, LODs, and separate picking/collision proxies.
- Implement the camera, zoom bands, terrain edge constraints, fog, sun/hemispheric
  fill, shadows, water shoreline, restrained post effect, and a quality switch. Start
  with WebGPU detection but ensure WebGL renders the same readable scene.
- Build a functional HUD composition over the canvas: top resource strip, minimap
  placeholder backed by scene truth, bottom selection/command panel, alerts, and a
  settings overlay. The controls need not have full game rules yet, but visible focus,
  Escape/Enter behavior, scaling, contrast, and reduced-motion paths must work.
- Add original procedural placeholder sound families and music stems only where they
  clarify interaction. Mark every placeholder in the asset manifest.
- Add an asset-preview route showing turntable, bounds, normals, animation clips,
  LOD, material variants, and texture memory.

**Deliverable:** a 60–90 second visual review build with a camera flyover, terrain
close/far shots, a small settlement, a ship at shore, faction accents, a damaged
building, rain/wind toggle, minimap, and HUD at all supported aspect ratios.

**Visual gate:** reviewers can identify worker/infantry/cavalry/artillery/ship,
terrain passability, ownership, damage state, and selected target at normal zoom;
the scene feels intentionally authored rather than primitive or noisy.

**Feel gate:** camera movement, zoom-to-cursor, focus, hover, and panel transitions
are stable; no layout animation occurs under the cursor; reduced motion removes shake,
flashes, and unnecessary transitions.

**Engineering gate:** frame-time, draw calls, triangles, texture memory, shader compile
time, and context-loss recovery are captured for the fixture. All assets are local and
licensed/original. No React component owns an individual simulation/render entity.

**Rollback point:** keep the visual tokens, scene fixture, and asset manifest; delete
only the effect or asset variant that fails the readability/performance budget.

## Phase 2 — game-feel lab

**Purpose:** make the battlefield satisfying to command before it becomes content-
complete. This is a testable interaction laboratory, not a fake game screen.

**Work**

- Wire real input routing: drag selection, double-click type selection, shift add/
  remove, control groups, contextual right-click, attack-move, stop, patrol, guard,
  formation keys, camera pan/rotate/zoom, bookmarks, alert cycling, chat focus, and
  remapping with conflict checks for QWERTY, AZERTY, and physical-code layouts.
- Add stable-ID picking proxies, destination pips, route lines, formation previews,
  invalid-path labels, selection circles, health/status bars, and ownership cues using
  shape/outline as well as color.
- Create a small deterministic combat sandbox with two squads, a wall, a cannon,
  and a target. Implement acquire → face → wind-up → release → recovery; projectile
  impact and animation/audio event markers must agree at 20 Hz.
- Create a worker/economy feel fixture with idle, walk, gather, carry, deposit, build,
  repair, flee, and dead states. Show effective income/minute and idle time without
  exposing unnecessary formulas.
- Add formation movement with stable slots, corridor/fine navigation interfaces,
  soft avoidance, and bounded stuck recovery. Exercise cliffs, water, chokepoints,
  and blocked slots in the fixture.
- Add camera-readable VFX: muzzle smoke, impact, dust, construction, healing,
  capture, dispatch arrival, collapse, water spray, wake, and rain. Pool effects and
  scale them by distance/quality; no effect may obscure a target or write back to sim.
- Add event-driven audio feedback: one group acknowledgement, rate-limited alerts,
  distinct invalid-command response, positional combat bed, and adaptive placeholder
  stems with minimum dwell times.

**Deliverable:** a “command feel” build where a reviewer can select, move, attack,
form, focus fire, retreat, build, and inspect consequences in under five minutes.

**Gate:** selected actions feel immediate; intended command-to-feedback latency and
p95 UI task time are measured; no unit spins, stacks, or vibrates indefinitely;
every required cue has text/shape support and audio is additive.

**Rollback point:** keep input contracts and event markers; remove nonessential VFX,
camera shake, or audio layers before weakening readability.

## Phase 3 — Milestone 1 offline vertical slice

**Purpose:** turn the approved visual/feel language into one honest, finishable RTS.

**Scope**

- One validated temperate-coast map; Aurelian League; Frontier, Settlement, and
  Bastion eras; four stockpiled resources plus Renown.
- Workers with explicit task states and depletion/renewal economy; central hall,
  housing, drop sites, farms, fisheries, barracks, stable, artillery works, market,
  trade post, outpost, walls/gates, and repair/garrison behavior.
- Twelve readable combat units, explorer, hunt/herd animals, fishing ground,
  treasures, trade route, Dispatches starter decks, fog/memory, minimap, formations,
  deterministic combat, Standard AI, Standard Conquest, pause/speed offline, save/
  load, and post-game summary.
- Tutorial that teaches scouting, economy, counters, construction, one era choice,
  dispatch timing, and one comeback objective without scripted combat pretending to
  be simulation.
- Semantic environment slice: forest harvesting, shore water, gentle rain/wind,
  grass/foliage response, ambient birds/fish, weather forecast, and environment debug
  overlay. Keep severe hazards out of standard play.

**Implementation order inside the phase:** content schemas and pure rules → map and
navigation → economy/production → combat/formation → visibility/objectives/dispatches
→ AI → presentation/audio → tutorial/post-game → save/replay fixtures.

**Gate:** a new player completes a 20–35 minute tutorial/skirmish with no console
errors, silent required action, missing feedback, stuck army, or manual database edit.
Run 100 fixed-seed AI matches without crash or checksum variance; Node and browser
replays agree. Do not begin online work until this gate passes.

## Phase 4 — Milestone 2 multiplayer proof

**Purpose:** prove authority and recovery with the smallest useful online surface.

**Scope**

- Guest practice plus account/session boundary, private lobby, invite code, public
  lobby, ready-state invalidation, map/content hash agreement, and two-player room.
- Server-authenticated intent commands, ownership/visibility/cost/cooldown/rate checks,
  canonical ordering, snapshots/deltas, checksums, replay command log, compressed
  recovery snapshot, reconnect window, resign, spectator handoff, and result write.
- Team/all chat with plain-text rendering, mute/block/report/rate limits; basic
  room-scoped LiveKit voice token, push-to-talk, mute/deafen, and independent failure.
- Network impairment harness for RTT, jitter, loss, reorder, duplicate, disconnect,
  reconnect, and server drain.

**Gate:** two remote browsers finish a 45-minute match under 150 ms RTT and 2% loss;
forced disconnect resumes from a snapshot; a modified client cannot grant resources
or control an enemy; final result and replay are persisted exactly once. Voice failure
does not stall gameplay.

## Phase 5 — Milestone 3 competitive core

**Purpose:** make the core strategically deep and measurable.

- Complete Veyran Commonwealth first, then all five eras and the shared roster:
  infantry/counter infantry, cavalry, artillery, siege/logistics, naval, exceptional
  units, buildings, technologies, councilor choices, dispatch cards, and upgrade
  paths. Preserve stable IDs and explicit counters.
- Add Hard/Expert AI using legal information, faction doctrine, headless metrics,
  deterministic scenarios, and no hidden resources/vision.
- Add ranked 1v1, unranked quick match, team queues, spectator delay, Glicko-2,
  seasons, dodge/disconnect/grief/chat penalties with appeal-friendly audit records.
- Add Treaty, Resource Surge, Established Empire, Summit Hold, and Trade Dominance;
  make every victory path announced, interruptible, and visible in HUD/minimap.
- Add economy/military/technology/map-control/dispatch statistics, balance dashboards,
  matchup simulations, and content validation generated from schemas.

**Gate:** closed playtest finds no blocking usability defect; no faction has an
obviously broken opening/counter across representative maps; median match is near
30 minutes with 80% between 20–50; 95% of completed matches have one valid result
and replay.

## Phase 6 — Milestone 4 content breadth

**Purpose:** expand the approved language without multiplying unknowns.

- Add Sable Marches, Kesh Dominion, Namar Sultanates, Ilari Concord, Dhoran Clans,
  and Thalassic Republic using the same schema and composable modifiers.
- Add all ten launch biomes, naval-heavy maps, all listed modes, campaign missions
  1–3, Art of Command challenges, complete starter/deck collections, compendium, and
  faction asset kits. Every faction gets one economy rule, one military rule, one
  signature system, two unique structures, four unique/replacement units, twelve
  technologies, and at least 24 dispatches, each with cost/counter/opportunity cost.
- Add glTF bake/validation, shared skeleton/animation conventions, LODs, original
  adaptive score, expanded audio, localization pipeline, and biome-specific semantic
  environment recipes.
- Keep severe storms, floods, night raids, moving hazards, and environmental fire in
  explicitly declared campaign/co-op/scenario modes until separately balanced.

**Gate:** every faction has legal openings, counter coverage, AI doctrine, UI/table
references, original visual kit, complete localization keys, and valid deck/content
hashes. No missing model, icon, sound, or license reaches a production build.

## Phase 7 — Milestone 5 polish, social, scenarios, and scale

**Purpose:** finish the product around a stable competitive core.

- Complete missions 4–12, cooperative siege, scenario editor (safe JSON import/export,
  no arbitrary code), replay seeking, parties/friends, moderation tooling, reporting,
  and social/privacy retention behavior.
- Complete front-end routes/states: first launch, menus, campaign, skirmish,
  multiplayer/party/queue/lobby, compendium/deck builder, loading, HUD/overlays,
  post-game, replay, settings, credits, and every specified recovery/error state.
- Replace or formally review functional audio placeholders; finish captions,
  subtitles, audio buses, accessibility settings, color-safe palettes, keyboard-only
  paths, 80–160% UI scaling, reduced motion, mono/dynamic range, and screen-reader
  equivalents where applicable.
- Add horizontal room scaling, regional room ownership, graceful draining, backups,
  restore/privacy deletion, readiness/liveness checks, dashboards, and incident
  runbooks. Keep Kubernetes out unless a demonstrated need appears.

**Gate:** performance budgets pass on representative 8-player/800-pop and integrated
graphics fixtures; no critical/high security issue remains; supported accessibility
flows have no known blocker; staging survives target concurrency; rollback preserves
active rooms, ratings, and replay compatibility.

## Cross-cutting workstreams

### Simulation and protocol

Keep `packages/sim` pure and fixed-tick at 20 Hz. Use integer/fixed-point state,
canonical `(tick, playerId, sequence)` ordering, named deterministic random streams,
versioned serialization, checksums, and golden replays. Rendering interpolates snapshots
and cannot influence outcomes. Protocol adapters keep Colyseus (or a better verified
equivalent) out of simulation code.

### Content and balance

Use Zod-validated versioned data for units, buildings, technologies, dispatches,
factions, maps, modes, and modifiers. Generate tooltips/reference tables from the
same source. Run deterministic scenario simulations, matchup matrices, economy curves,
and human playtests; never hide rules in UI or mutate content from an untrusted service.

### Rendering and assets

Three.js scene ownership stays outside React. Stream chunked terrain, instance repeated
props, share materials/geometries, use semantic picking proxies, LODs, pooled effects,
and explicit disposal. WebGPU is preferred only when verified; WebGL must remain a
readable fallback. The asset manifest and IP review are release blockers.

### Backend and security

PostgreSQL is the durable source for identity, lobby metadata, decks, ratings, matches,
reports, and audit records. Redis is ephemeral coordination/presence. Object storage
holds compressed replays/scenarios with signed access. Validate and bound every HTTP,
WebSocket, deck, scenario, chat, upload, and compressed input. Add SAST, dependency,
secret, lockfile, XSS/CSRF/SSRF/prototype-pollution, token replay, and duplicate-result
tests. No scanner or skill uploads source or reads secrets by default.

### Observability and evidence

Track frame time, simulation tick debt, path queue, draw calls, memory, bandwidth, RTT,
input delay, checksums, command rejects, reconnects, room lifetime, queue wait, match
completion, crashes, faction/map outcomes, and accessibility use only under documented
consent. Logs are structured and redacted. Every bug fix adds the smallest regression
fixture that would have caught it.

## First three executable tasks

1. Inspect the current repository; create `PROJECT_STATE.md`, ADR directory, risk
   register, and the phase checklist without claiming any milestone complete.
2. Implement the thin Phase 0 package/test baseline and blank renderer, then prove the
   one-command local start and Node/Chromium deterministic fixtures.
3. Build the Phase 1 temperate-coast visual target (wordmark, crest, palette, semantic
   terrain, first asset kit, camera, HUD composition, lighting, water, weather, and
   asset-preview route) and run its four gates before adding gameplay breadth.

## Reporting template

For each work session report: (1) what is genuinely playable/operational, (2) files and
systems changed, (3) tests and measured performance, (4) known limitations and whether
they block the current phase, (5) exact next three tasks, and (6) commit hash or why no
commit was created. Update `PROJECT_STATE.md` before handing work to another agent.
