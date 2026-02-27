# Root JavaScript Files Audit

Root-level `.js` source/entrypoint files are removed.

## Runtime Artifacts Location

Legacy runtime bundles are kept under `runtime/`:

- `runtime/viewer.js`
- `runtime/basic-utils.js`
- `runtime/plugins.js`
- `runtime/prefs.js`
- `runtime/worker.js`

## Policy

- Do not add new source-of-truth code at repository root.
- New implementation work goes in `src/` and `demo-vue/`.
