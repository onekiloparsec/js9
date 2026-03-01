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

- `src/lib/index.ts` (library loader API)
- `src/viewer.ts`
- `src/worker.ts`
- `src/core/basicUtils.ts`
- `src/postMessage.ts`
- `demo-vue/*`

Generated or distribution artifacts (do not edit directly):

- `dist/library/*`
- `dist/demo/*`
- generated runtime bundles in `generated/runtime/`
- copied browser runtime assets in `runtime/`

## Build Commands

- Library build: `npm run build:lib`
- Demo dev: `npm run dev:demo`
- Demo build: `npm run build:demo`
- Plugin-inclusive builds: use `JS9_INCLUDE_PLUGINS=1` (or `npm run build:lib:plugins` / `npm run build:demo:plugins`)

## Runtime Manifests

- `manifests/runtime-core.json` defines the core runtime copy surface.
- `manifests/runtime-plugins.json` defines optional plugin/runtime surfaces.
- Vite copy targets are manifest-driven to avoid copying whole legacy directories by default.
