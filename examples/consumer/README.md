# JS9 consumer demo

A minimal standalone consumer of `@onekiloparsec/js9` — installs from GitHub
Packages, runs a Vite dev server, and lets you load a FITS file in the browser.

This directory is **not part of the published package**. It exists only to
verify and showcase consumption of the published artifact.

## Run

```sh
cd examples/consumer
npm install         # resolves @onekiloparsec/js9 from npm.pkg.github.com
npm run dev         # http://localhost:5180
```

Auth: a GitHub PAT with `read:packages` must be available. The local `.npmrc`
points the `@onekiloparsec` scope at GitHub Packages; the token itself is
expected to live in your global `~/.npmrc` (already configured on this machine).

## What it does

- Imports `loadJS9Runtime` and `getJS9` from `@onekiloparsec/js9`.
- Mirrors the package's bundled runtime (`dist/library/runtime/`) at `/runtime`
  via `vite-plugin-static-copy`, so the loader can fetch it.
- Provides three ways to load FITS data:
  - Drag-drop onto the JS9 display.
  - File picker.
  - "Load remote sample" button (fetches a public sample from CfA).
