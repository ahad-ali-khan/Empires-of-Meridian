# Empires of Meridian

An original browser-based real-time strategy game in development, built with React, Three.js, TypeScript, and Vite.

The default route contains the offline tutorial and skirmish prototype. The original Temperate Coast showcase and Asset Forge remain at `/dev/forge` in development. Milestone 1 is still in progress; its full match, AI evaluation, cross-browser determinism, and hardware performance release gates have not been certified.

## Requirements

- Node.js 22 or later
- pnpm 11 or later

## Run locally

```sh
pnpm install
pnpm dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173).

## Commands

```sh
pnpm typecheck
pnpm test:unit
pnpm test
pnpm build
```

`pnpm build` writes the production site to `apps/web/dist/`. It is intentionally ignored by Git.

## Controls

- Drag empty terrain: orbit the camera
- Shift-drag: box-select units; Shift-click: add to selection
- Scroll: zoom
- WASD or middle-drag: pan
- Click: select a unit, building, or resource
- Right-click: contextual work, combat, movement, construction, or garrison order
- With a production building selected, right-click: set its rally point
- Ctrl/Cmd + 1–9: assign a control group; 1–9: select it
- Space: focus selection; X: stop

In the development showcase, the Field Lens selects lighting, weather, animation, and render quality. The Asset Forge exposes procedural models and their animation states. Match setup offers seed, map size, fog, population, speed, and AI difficulty. Farms accept two workers. Completed central halls and forts can shelter villagers; their selection panel releases the garrison.

## Project layout

```text
apps/web/                 Offline game, simulation worker, showcase and Forge
apps/api/                 Development HTTP service
apps/game-server/         Transport foundation
packages/sim/            Fixed-tick economy, navigation, combat and AI
packages/protocol/       Commands, saves and worker messages
packages/content/        Gameplay definitions
packages/asset-tools/     Original procedural models and animation rigs
tests/                    Placement, geometry, and animation regression tests
data.md                   Product and game design brief
```

## Git setup

After creating an empty repository on your Git host, run the following from this directory:

```sh
git remote add origin <YOUR_REPOSITORY_URL>
git add .
git commit -m "Initial visual prototype"
git branch -M main
git push -u origin main
```

If Git reports an Xcode license error on macOS, accept it first with:

```sh
sudo xcodebuild -license
```

## Status

The project is now an offline playable vertical slice with fixed-tick economy, combat, pathfinding, production, saves, fog, and an actively evaluated AI opponent. Multiplayer remains foundation work; full release gates for cross-browser determinism, AI balance, and sustained hardware performance are still open.
