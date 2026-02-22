# JS9 FITS Adapter Interface

JS9 can run with pluggable FITS backends. The adapter contract below is the
minimum interface required to load FITS data into JS9 images.

## Required Adapter Methods

Every FITS adapter must expose these methods:

- `handleFITSFile(file, options, handler)`
- `getFITSImage(fitsRef, hdu, options, handler)`
- `cleanupFITSFile(fitsRef, mode?)`
- `maxFITSMemory(bytes)`

`handler` must receive a JS9 HDU-like object compatible with `JS9.NewFitsImage`.

## Adapter Object Shape

Recommended adapter fields:

- `name`: adapter id (e.g. `fixi`, `myfits`)
- `options`: mutable options set by JS9 / adapter config
- `capabilities`: feature flags object
  - `fits` (boolean)
  - `wcs` (boolean)
  - `reprojection` (boolean)
  - `compression` (boolean)
- `wcsInitMode` (optional): declares how `initwcs()` expects header input
  - `"header"`: adapter expects full FITS header text
  - `"pointer"` (default): adapter expects legacy heap pointer semantics

## JS9 Registration API

JS9 exposes runtime registration helpers:

- `JS9.registerFITSAdapter(name, adapterOrFactory, opts?)`
- `JS9.unregisterFITSAdapter(name)`
- `JS9.listFITSAdapters()`
- `JS9.useFITSAdapter(name, cfg?)`

`opts.aliases` can register alternate names. `opts.configure(adapter, cfg)` can
apply JS9-specific option mapping.

## Startup Selection

JS9 selects a backend using:

- `JS9.globalOpts.fitsAdapter` (preferred)
- default fallback: `fixi`

Built-in fallback order during startup:

1. configured adapter
2. `fixi`

## Built-in `fixi` Runtime Options

When using `fixi`, JS9 reads:

- `JS9.globalOpts.fixiURL` (JS bundle)
- `JS9.globalOpts.fixiWasmURL` (WASM binary)
- `JS9.globalOpts.fitsCompliance` (`strict` or `compat`)

This contract is designed so JS9 remains MIT and backend implementations can be
maintained independently.

## Optional Capability Methods

Adapters can expose optional methods. JS9 will only call these when capability
flags indicate support:

- `computeZscale(data, width, height, bitpix, opts)` for image scaling (`z1/z2`)
- `initwcs(header, hlength?)`, `freewcs(id)`, `wcsinfo(id)`, `pix2wcs(id, x, y)`,
  `wcs2pix(id, ra, dec)`, `wcssys(id, sys?)`, `wcsunits(id, units?)`
- `reg2wcs(id, region)`, `saostrtod(text)`, `saodtostr(value, type, precision)`, `saodtype()`
- `vmalloc(...)`, `vfree(...)`, `vheap`, `vmemcpy(...)`, `vstrcpy(...)`,
  `vfile(...)`, `vread(...)`, `vunlink(...)`, `vsize(...)`, `vmount(...)`,
  `arrfile(...)`, `listhdu(...)` for legacy virtual-file workflows
- `reproject(...)`, `madd(...)`, `imgtbl(...)`, `makehdr(...)`, `shrinkhdr(...)`
- `regcnts(...)` for region-count analysis

Capability flags are normalized by JS9 during adapter registration. If a flag is
omitted, JS9 infers it from method presence.

Extended capability keys:

- `fits`
- `wcs`
- `scaling`
- `reprojection`
- `analysis`
- `compression`
