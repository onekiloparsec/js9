# JS9 TypeScript + ESM Migration

This document defines the first migration boundary for moving JS9 to TypeScript and ESM in low-risk increments.

Companion structure tracker: `docs/migration/STRUCTURE.md`

## Scope of Step 1

- Keep runtime behavior unchanged.
- Keep the existing build chain (`Makefile` + concat/minify scripts) intact while introducing a parallel Vite packaging path.
- Remove Electron packaging entrypoints from the active build/install path.
- Do not flip global module mode (`"type": "module"`) yet.
- Start with isolated pilot targets: `node/cli/regions.ts` and `node/browser/worker.ts`.

## Source Of Truth Map

Edit these files/directories as source:

- `node/browser/viewer.js`
- `../fixi-js/src/fixi.ts` (external sibling repo; FITS adapter source)
- `node/browser/worker.ts`
- `node/browser/core/basicUtils.js`
- `node/helper/helper.js`
- `node/cli/msg.js`
- `node/browser/postMessage.js`
- `node/cli/regions.ts`
- `plugins/core/*.js`
- `plugins/archive/archive.js`
- `plugins/imexam/*.js`
- `build/*` scripts
- `Makefile.in`

Treat these as generated artifacts (do not edit directly):

- `js9.min.js` (minified from `js9.js`, whose source is `node/browser/viewer.js`)
- `js9support.js` and `js9support.min.js` (concatenated from `JSFILES` in `Makefile.in`)
- `js9plugins.js` (concatenated from `PLUGINFILES` in `Makefile.in`)
- `js9plugins.min.js` (minified plugin bundle)
- `js9-allinone.js` and `js9-allinone.css` (assembled by `build/mkallinone`)
- `js/regSelect.js` (generated from `src/regSelect.jison`)
- `js9.js` (compatibility symlink to `node/browser/viewer.js`)
- `js9worker.js` (compatibility symlink to `node/browser/worker.js`)
- `js9Regions.js` (compatibility wrapper)
- `node/cli/regions.js` (generated from `node/cli/regions.ts`)
- `node/browser/worker.js` (generated from `node/browser/worker.ts`)
- `js9Msg.js` (compatibility wrapper)
- `js9Helper.js` (compatibility wrapper)
- `js9PostMessage.js` (compatibility symlink to `node/browser/postMessage.js`)

Local dependency wiring:

- JS9 `package.json` uses `@onekiloparsec/fixi-js: file:../fixi-js` during migration.

Notes:

- Some plugin files (for example `plugins/archive/archive.js` and `plugins/imexam/imexam.js`) already contain bundled wrapper code and still act as source for current releases.
- Existing release artifacts at repository root are part of packaging and should be preserved until migration stages replace them deliberately.

## Step 1 Baseline Type Check

Step 1 adds a check-only TypeScript config:

- File: `tsconfig.migration.json`
- Uses `noEmit`
- Includes `node/cli/regions.ts` and `node/browser/worker.ts`

Run:

```sh
tsc -p tsconfig.migration.json
```

If `tsc` is not installed locally yet, install TypeScript in a later step before enforcing this check in CI.

## Exit Criteria For Step 1

- Boundaries between source and generated files are documented.
- Pilot files (`node/cli/regions.ts`, `node/browser/worker.ts`) are selected.
- Type-check baseline exists with zero runtime impact.

## Planned Next Increment

- Expand browser-core carve-outs in `node/browser/core/` with pure helpers only.
- Start TypeScript pilot for `node/cli/msg.js`.
- Add first Vitest browser/core tests once Vite packaging smoke tests are stable.
