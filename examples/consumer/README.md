# JS9 consumer demo

A standalone Vue consumer of `@onekiloparsec/js9` — installs the published
package from GitHub Packages and exercises the full integration shape we
recommend for downstream apps (e.g. `arcsecond-front`).

This directory is **not part of the published package**. It exists to verify
the published artifact and to give consumers a copy-pasteable starting point.

> Looking for the in-repo dev demo (live source tree, no registry round-trip)?
> That's `../../demo-vue/`. Run it from the repo root with `npm run dev:demo`.
> See the top-level README's "Two demos, two purposes" section for when to use
> which.

## Run

```sh
cd examples/consumer
npm install         # resolves @onekiloparsec/js9 from npm.pkg.github.com
npm run dev         # http://localhost:5180
```

Auth: a GitHub PAT with `read:packages` must be available. The local `.npmrc`
points the `@onekiloparsec` scope at GitHub Packages; the token itself is
expected to live in your global `~/.npmrc`.

## What it shows

- **`<JS9View>`** — fits its parent, refits + recentres on parent resize, refits on load.
- **`<JS9Controls>`** — drop-in toolbar bound to the viewer's controller: zoom (out / fit / 1:1 / in), scale dropdown (linear / log / sqrt / asinh / histeq), colormap dropdown (grey / heat / cool / viridis / magma / plasma).
- **`<JS9Pixel3D>`** — a small canvas that renders an isometric surface of the N×N pixel window under the cursor. Useful for inspecting bright sources.

The three components communicate via a `JS9DisplayController` exposed by
`<JS9View @ready>`. They can be placed independently on a page.

## File layout

```
src/
  main.ts              entry point
  App.vue              demo layout: viewer pane + controls + pixel3d + sliders
  components/
    JS9View.vue        fit-to-parent JS9 viewer
    JS9Controls.vue    zoom / scale / colormap toolbar
    JS9Pixel3D.vue     cursor-region surface plot
  lib/
    js9Loader.ts       memoised loadJS9Runtime
    js9Builder.ts      per-display controller (load, fit, resize, getPixelGrid, onMouseMove)
    types.ts           shared type aliases
```

This mirrors the layout used by `arcsecond-front` under `src/libraries/js9/`,
so the demo doubles as a reference implementation.
