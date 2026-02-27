# JS9 Vite Migration

This document tracks migration toward a Vite library plus Vue demo architecture.

Companion docs:
- `docs/migration/STRUCTURE.md`
- `docs/migration/ROOT_JS.md`

## Active Direction

- Primary deliverable is a Vite-built JS library (`dist/library`).
- Demo surface is a Vue app (`demo-vue/`).
- Root script entrypoints are removed from source layout.
- Legacy JS9 runtime bundles are served from `runtime/` while source modernization continues.

## Source Of Truth

Edit source here:

- `src/lib/index.js` (library loader API)
- `src/viewer.js`
- `src/worker.ts`
- `src/core/basicUtils.js`
- `src/postMessage.js`
- `demo-vue/*`

Generated or distribution artifacts (do not edit directly):

- `dist/library/*`
- `dist/demo/*`
- legacy runtime bundles in `runtime/`

## Build Commands

- Library build: `npm run build:lib`
- Demo dev: `npm run dev:demo`
- Demo build: `npm run build:demo`
