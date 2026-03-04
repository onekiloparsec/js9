# JS9 Migration Memory

## Project
Astronomical FITS image viewer for the browser. Migrating from legacy ES5 global-namespace codebase to a Vite+TypeScript library. Low-level FITS I/O delegated to sibling package `@onekiloparsec/fixi-js` (file:../fixi-js).

## Key Architecture
- **Library entry**: `src/lib/index.ts` → exports `loadJS9Runtime()` and `getJS9()`
- **Runtime bundle**: `src/runtime-bundle.ts` → side-effect imports, Vite IIFE → `generated/runtime/runtime.js`
- **Viewer**: `src/viewer.ts` (17,877 lines) — IIFE that creates and exposes `globalThis.JS9`
- **Core modules**: `src/core/*.ts` (23 files) — each sets `globalThis.XxxName = XxxName` at end
- **Plugin modules**: `src/plugins/**/*.ts` — loaded separately via `pluginScripts` option
- All source files have `// @ts-nocheck` (migration in progress)

## Build Pipeline
```
build:runtime:ts      → tsc → generated/runtime/worker.js (+ legacy individual files)
build:runtime:bundle  → vite IIFE → generated/runtime/runtime.js  (25 modules, ~984 KB)
build:lib             → vite lib → dist/library/js9.{es,umd}.js + manifest copy
build:demo            → vite → dist/demo/ + manifest copy
```

**Key**: `prebuild:lib` runs both `build:runtime:ts` AND `build:runtime:bundle` before the main Vite build.

## Phase 1 Complete (runtime bundle consolidation)
- Replaced 20+ sequential `<script>` tag loads with a single `runtime.js` IIFE bundle
- Added `globalThis.JS9 = JS9` to end of `src/viewer.ts` (Rollup scopes `var` inside IIFE)
- `CORE_SCRIPTS` in `src/lib/index.ts` is now just `["prefs.js", "runtime.js"]`
- Rollup renames internal identifiers (e.g., `JS9` → `JS9$1`) but `globalThis.JS9` is correct
- `manifests/runtime-core.json` now references only: prefs.js, prefs.json, CSS, runtime.js, worker.js, fonts, images, fixi assets

## GlobalThis Pattern (how modules communicate)
Each core module (e.g., mathUtils.ts): `const JS9MathUtils = {...}; globalThis.JS9MathUtils = JS9MathUtils`
viewer.ts checks: `if (typeof CoreBasicUtils === "function") { CoreBasicUtils(JS9); }`
This works inside the bundle IIFE because JS scope chain reaches globalThis.

## Migration Roadmap
1. ✅ Phase 1: Collapse runtime into single IIFE bundle
2. ✅ Phase 2: Remove `@ts-nocheck` from leaf files (sprintf, mathUtils, gaussBlur, colormaps, browserCompat)
3. ✅ Phase 3: Add `.d.ts` type exports for library consumers
4. ✅ Phase 4: Convert namespace injection → ES module exports
5. Phase 5: Break up viewer.ts (17k lines)
6. Phase 6: Add vitest tests for FITS pipeline

## Phase 2 Notes (leaf file typing)
- `sprintf.ts` / `browserCompat.ts`: IIFEs, already module-like — no `export {}` needed
- `mathUtils.ts` / `colormaps.ts`: Added `export {}` to avoid TS2451 ("Cannot redeclare block-scoped variable") conflict between `const`/`function` at global-script scope and `declare var` in js9-core.d.ts
- `gaussBlur.ts`: Uses `var` (not `const`) so compatible with `declare var` without `export {}`; no globalThis assignment (works via IIFE scope chain in bundle)
- `colormaps.ts`: Also needed `const a: number[][] = []` for two arrays previously inferred as `never[]`
- All globals declared in `src/types/js9-core.d.ts` via `declare global {}`
- `ts:migration:check` passes with zero errors after Phase 2

## Phase 4 Notes (ES module exports)
- 5 typed leaf modules converted: sprintf, gaussBlur, mathUtils, colormaps, browserCompat
- `sprintf.ts`: Removed IIFE, now `export const sprintf/vsprintf`. Uses rest params `(...args)`.
- `gaussBlur.ts`: Removed IIFE wrapper, now `export function gaussBlur`.
- `mathUtils.ts`: Imports sprintf, `export { JS9MathUtils }` replaces globalThis assignment.
- `colormaps.ts`: `export { JS9InstallColormaps }` replaces globalThis assignment.
- `browserCompat.ts`: Removed IIFE, all 5 values exported: `saveAs`, `ResizeSensor`, `Spinner`, `ddtabcontent`, `dhtmlwindow`.
- `viewer.ts`: Added 5 import lines (after `export {}`); replaced `{}.hasOwnProperty.call(window, "X")` guards with `typeof X === "function"` for saveAs, ResizeSensor, Spinner.
- `viewerUtils.ts`, `publicApi.ts`: Added `import { sprintf }`. `viewerInit.ts`: Added `import { dhtmlwindow }`.
- `runtime-bundle.ts`: Removed the 5 explicit side-effect imports for converted modules (pulled in transitively).
- `js9-core.d.ts`: Removed all `declare global` entries for the 5 converted modules (no longer globals).
- `ts:migration:check` passes with zero errors. Bundle still 25 modules / ~984 KB.

## Phase 3 Notes (declaration files)
- New files: `src/lib/types.ts` (all exported public interfaces), `tsconfig.lib.json`
- `build:lib:types` script runs `tsc -p tsconfig.lib.json` → emits `dist/library/index.d.ts` + `dist/library/types.d.ts`
- `build:lib` now chains: `vite build && npm run build:lib:types`
- `package.json` has `"types": "dist/library/index.d.ts"` and `"exports[.].types"` (must come before import/require)
- `src/viewer.ts` got `export {}` so its `var JS9` is module-scoped, avoiding conflict with `declare global { var JS9: JS9Namespace }`
- `src/lib/index.ts` now fully typed (no @ts-nocheck), re-exports all public types
- `JS9Namespace` has explicit typed methods + `[key: string]: unknown` escape hatch for the untyped remainder

## Key Files
- `src/runtime-bundle.ts` — import order = original CORE_SCRIPTS order (critical!)
- `vite.runtime.config.mjs` — `format: iife`, `treeshake: false`, `emptyOutDir: false`
- `manifests/runtime-core.json` — drives static copy in both lib and demo builds
- `manifests/runtime-plugins.json` — optional plugins (JS9_INCLUDE_PLUGINS=1)
- `src/types/js9-core.d.ts` — only real type definitions so far

## User Preferences
- Demo (demo-vue/) is the validation step for migration changes
- Engineering quality: performance, no vendor deps (except fixi-js), full TS support
