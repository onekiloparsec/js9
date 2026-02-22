# Fixi FITS Compliance Notes

This document tracks JS9 behaviors that should be reviewed when strict FITS compliance is enabled through `fixi-js`.

## Current strict checks enforced by `fixi-js`

- `BITPIX` must exist and be one of: `8`, `16`, `32`, `64`, `-32`, `-64`.
- `NAXIS` must exist and be `>= 0`.
- For `NAXIS > 0`, axis dimensions must be present and non-negative.

## Current compatibility policy

- JS9 defaults to `fitsCompliance: "strict"` for `fixi-js`.
- Set `JS9.globalOpts.fitsCompliance = "compat"` to keep permissive legacy behavior.
- JS9 now boots FITS through `fixi` Rust/WASM by default (no legacy cfitsio runtime required).
- JS9 zscale now runs through adapter-native `computeZscale()` when provided by
  `fixi-js` (no legacy heap dependency for zscale).
- JS9 WCS runtime calls (`initwcs/freewcs/wcsinfo/wcssys/wcsunits/pix2wcs/wcs2pix`
  and `sao*` helpers) are now adapter-provided by `fixi-js`.
- JS9 now binds low-level FITS runtime helpers from whichever adapter is active
  (instead of hard-wiring legacy globals during startup), with safe fallbacks
  when an adapter does not provide a capability.
- JS9 now hard-checks adapter capabilities before running `regcnts` and Montage
  mosaic/reprojection flows, so unsupported backends fail with explicit errors
  instead of null-function runtime crashes.
- `fixi-js` currently uses a lightweight WCS implementation for this interface
  (affine CD/CDELT/CROTA support). Full wcslib-equivalent projection parity and
  reprojection/montage workflows are still pending.

## JS9-specific behavior to review next

- Extension selection conventions (user-facing zero-based `extnum` vs internal FITS/CFITSIO indexing).
- Event-table binning defaults that may rely on non-standard assumptions in extension naming.
- Lenient handling of mixed or partially-missing header keywords in legacy datasets.
