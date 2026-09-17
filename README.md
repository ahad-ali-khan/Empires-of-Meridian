# Empires of Meridian

An original browser-based real-time strategy visual prototype built with React, Three.js, TypeScript, and Vite.

The current prototype is a visual showcase, not a complete playable RTS. It includes a procedurally placed coastal settlement, original procedural assets, weather, water, wildlife, animated units, and an asset inspection view.

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
pnpm test
pnpm build
```

`pnpm build` writes the production site to `apps/web/dist/`. It is intentionally ignored by Git.

## Controls

- Drag: orbit the camera
- Scroll: zoom
- WASD or arrow keys: pan
- Click a building: open its asset preview

The Field Lens selects lighting, weather, animation, and render quality. The Asset Forge exposes each procedural model and its available animation states.

## Project layout

```text
apps/web/                 React and Three.js showcase
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

This is the art and rendering prototype phase. Economy, combat, pathfinding, networking, and full RTS gameplay are not implemented yet.
