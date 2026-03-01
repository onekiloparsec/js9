# JS9 Structure Baseline

## Current Rule

- Canonical source code lives under `src/`.
- Package output is a Vite library under `dist/library/`.
- Demo output is a Vue app under `dist/demo/`.
- Legacy runtime JS/CSS bundles live under `runtime/` and are treated as assets, not source-of-truth files.

## Layout

- `src/`
  - `lib/index.ts` (library API)
  - `viewer.ts`
  - `worker.ts`
  - `postMessage.ts`
  - `core/basicUtils.ts`
- `demo-vue/`
  - Vue-based demo app consuming the library API

## Next Moves

- Replace legacy runtime bundle loading with module-native loading.
- Rewrite remaining demos into Vue pages/components.
- Rewrite legacy help/docs for library + Vue demo workflow.
