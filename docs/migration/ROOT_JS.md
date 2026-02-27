# Root JavaScript Files Audit

Root-level `.js` source/entrypoint files are removed.

## Runtime Artifacts Location

Legacy runtime bundles are kept under `runtime/`:

- `runtime/viewer.js`
- `runtime/math-utils.js`
- `runtime/basic-utils.js`
- `runtime/fits-runtime.js`
- `runtime/prefs.js`
- `runtime/worker.js`

Plugin runtime source-of-truth now lives under `src/`:

- `src/plugins/`
- `src/analysis-plugins/`
- `src/analysis-wrappers/`
- `src/params/`

## Policy

- Do not add new source-of-truth code at repository root.
- New implementation work goes in `src/` and `demo-vue/`.
