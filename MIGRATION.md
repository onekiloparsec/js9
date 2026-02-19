# JS9 TypeScript + ESM Migration

This document defines the first migration boundary for moving JS9 to TypeScript and ESM in low-risk increments.

## Scope of Step 1

- Keep runtime behavior unchanged.
- Keep the existing build chain (`Makefile` + concat/minify scripts) unchanged.
- Do not flip global module mode (`"type": "module"`) yet.
- Start with one isolated pilot target: `js9Regions.ts`.

## Source Of Truth Map

Edit these files/directories as source:

- `js9.js`
- `js9worker.js`
- `js9Helper.js`
- `js9Msg.js`
- `js9PostMessage.js`
- `js9Regions.ts`
- `js9Electron.js`
- `js9ElectronPreload.js`
- `js9ElectronMainMenu.js`
- `plugins/core/*.js`
- `plugins/archive/archive.js`
- `plugins/fitsy/*.js`
- `plugins/imexam/*.js`
- `build/*` scripts
- `Makefile.in`

Treat these as generated artifacts (do not edit directly):

- `js9.min.js` (minified from `js9.js`)
- `js9support.js` and `js9support.min.js` (concatenated from `JSFILES` in `Makefile.in`)
- `js9plugins.js` (concatenated from `PLUGINFILES` in `Makefile.in`)
- `js9plugins.min.js` (minified plugin bundle)
- `js9-allinone.js` and `js9-allinone.css` (assembled by `build/mkallinone`)
- `js/regSelect.js` (generated from `src/regSelect.jison`)
- `js9Regions.js` (generated from `js9Regions.ts` in migration stage)

Notes:

- Some plugin files (for example `plugins/archive/archive.js` and `plugins/imexam/imexam.js`) already contain bundled wrapper code and still act as source for current releases.
- Existing release artifacts at repository root are part of packaging and should be preserved until migration stages replace them deliberately.

## Step 1 Baseline Type Check

Step 1 adds a check-only TypeScript config:

- File: `tsconfig.migration.json`
- Uses `noEmit`
- Includes only `js9Regions.ts`

Run:

```sh
tsc -p tsconfig.migration.json
```

If `tsc` is not installed locally yet, install TypeScript in a later step before enforcing this check in CI.

## Exit Criteria For Step 1

- Boundaries between source and generated files are documented.
- A single pilot file (`js9Regions.ts`) is selected.
- Type-check baseline exists with zero runtime impact.

## Planned Step 2 (next incremental move)

- Compile `js9Regions.ts` to `js9Regions.js` with no behavior change.
- Keep output compatible with current Node usage (CommonJS during transition).
- Add npm script(s) for repeatable type check/build for this pilot only.
