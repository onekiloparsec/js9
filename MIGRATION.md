# JS9 TypeScript + ESM Migration

This document tracks the current migration boundary for a browser-first JS9 library.

Companion structure tracker: `docs/migration/STRUCTURE.md`

## Current Scope

- Browser runtime is the active target.
- Legacy CLI/helper/shell/Python entrypoints have been removed from repository layout.
- Keep existing browser runtime behavior unchanged while expanding typed browser modules.
- Do not flip global module mode (`"type": "module"`) yet.

## Source Of Truth Map

Edit these files/directories as source:

- `node/browser/viewer.js`
- `node/browser/worker.ts`
- `node/browser/core/basicUtils.js`
- `node/browser/postMessage.js`
- `plugins/core/*.js`
- `plugins/archive/archive.js`
- `plugins/imexam/*.js`
- `../fixi-js/src/fixi.ts` (external sibling repo; FITS adapter source)

Treat these as generated artifacts (do not edit directly):

- `js9.min.js` (minified from `js9.js`, whose source is `node/browser/viewer.js`)
- `js9support.js` and `js9support.min.js` (legacy concatenated support bundles)
- `js9plugins.js` and `js9plugins.min.js` (legacy concatenated plugin bundles)
- `js9-allinone.js` and `js9-allinone.css` (legacy assembled all-in-one bundles)
- `js/regSelect.js` (generated from `src/regSelect.jison`)
- `js9worker.js` (compatibility symlink to `node/browser/worker.js`)
- `js9PostMessage.js` (compatibility symlink to `node/browser/postMessage.js`)

Local dependency wiring:

- JS9 `package.json` uses `@onekiloparsec/fixi-js: file:../fixi-js` during migration.

## Baseline Type Check

Current check-only TypeScript config:

- File: `tsconfig.migration.json`
- Uses `noEmit`
- Includes `node/browser/worker.ts`

Run:

```sh
tsc -p tsconfig.migration.json
```

## Next Increment

- Continue browser-core carve-outs in `node/browser/core/`.
- Add browser-focused Vitest coverage around extracted modules.
- Remove/retire stale legacy build/install docs as browser-only packaging becomes canonical.
