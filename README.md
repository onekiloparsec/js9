[![DOI](https://zenodo.org/badge/24642171.svg)](https://doi.org/10.5281/zenodo.596052)

JS9 (reborn): astronomical image display everywhere
==========================================

Attribution
-----------

This project is based on the original JS9 work by **Eric Mandel** and **Alexey Vikhlinin**, developed at the Center for
Astrophysics | Harvard & Smithsonian.

For this fork/migration, attribution is centralized here in `README.md` instead of being repeated in per-file headers.

What does it do?
----------------

- display FITS images, binary tables, data cubes, and multi-extension files
- colormaps, scaling, pan, zoom, binning, blending, print, export ...
- region support: create, manipulate, import, export, ...
- drag and drop images, regions, catalogs
- runs on Macs, Linux, Windows, iPads, iPhones, ...
- browser-only viewer runtime
- utilizes WebAssembly (FITS processing at near native speed!)

How can I try it out?
---------------------

Go to the [JS9 web site](https://js9.si.edu) (assuming it is still live at the Center for Astrophysics) and drag a
[FITS](https://fits.gsfc.nasa.gov/) data file onto the JS9 display:

    https://js9.si.edu

You can even specify a remote FITS file and associated image display parameters
as part of the URL:

    https://js9.si.edu/js9/js9.html?url=https://hea-www.cfa.harvard.edu/~eric/coma.fits.gz&colormap=cool

The JS9 web site also contains on-line documentation, demos, and
release downloads.


To install or not to install ...
--------------------------------

For many users, there is no need to install JS9: simply use the [JS9 web
site](https://js9.si.edu) to display your data.

Installing JS9 allows you to create your own web pages and tailor site
parameters. Grab the latest version from [JS9 on GitHub](https://github.com/ericmandel/js9):

    git clone https://github.com/ericmandel/js9

For Vite-based development:

    npm install
    npm run dev

Then open:

    http://localhost:5173

Build artifacts:

    npm run build:lib   # Vite library output in dist/library
    npm run build:demo  # Vue demo output in dist/demo

Canonical source locations:

    src
    demo-vue

Legacy non-module runtime assets are stored under:

    runtime

## FITS/XISF Extraction Boundary (`fixi-js`)

This fork now supports an extracted FITS adapter layer in a sibling repository:

    ../fixi-js

JS9 prefers the `Fixi` adapter for FITS handling from the direct package
dependency path:

- `node_modules/@onekiloparsec/fixi-js/dist/fixi.js`
- `node_modules/@onekiloparsec/fixi-js/dist/fixi_core.wasm`

JS9 now uses a fixi-first FITS runtime path:

- `fixi` Rust/WASM initializes FITS support directly in JS runtime
- legacy `cfitsio` runtime paths are not used by default startup

Default behavior with `Fixi` enabled:

- `JS9.globalOpts.fitsCompliance = "strict"` (enforce core FITS HDU constraints)
- set `fitsCompliance` to `"compat"` for legacy-permissive behavior

Review notes for compliance-related behavior changes:

- `docs/fixi-fits-compliance.md`
- `docs/fits-adapter-interface.md`

JS9 references `fixi-js` as a local dev dependency:

    "@onekiloparsec/fixi-js": "file:../fixi-js"

What's the license?
-------------------

JS9 is distributed under the terms of The MIT License.

What's the recent release history?
----------------------------------
[![DOI](https://zenodo.org/badge/24642171.svg)](https://doi.org/10.5281/zenodo.596052)  __v3.9.0__ &nbsp; (12/13/2024)

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.6675771.svg)](https://doi.org/10.5281/zenodo.6675771)  __v3.8.0__
&nbsp; (06/21/2022)

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.6554571.svg)](https://doi.org/10.5281/zenodo.6554571)  __v3.7.0__
&nbsp; (05/16/2022)

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.5815246.svg)](https://doi.org/10.5281/zenodo.5815246)  __v3.6.2__
&nbsp; (01/03/2022)

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.5205774.svg)](https://doi.org/10.5281/zenodo.5205774)  __v3.6.1__
&nbsp; (08/16/2021)

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.5148424.svg)](https://doi.org/10.5281/zenodo.5148424)  __v3.6.0__
&nbsp; (07/30/2021)

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.4891274.svg)](https://doi.org/10.5281/zenodo.4891274)  __v3.5.0__
&nbsp; (06/01/2021)

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.4739157.svg)](https://doi.org/10.5281/zenodo.4739157)  __v3.4.0__
&nbsp; (05/05/2021)

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.4322843.svg)](https://doi.org/10.5281/zenodo.4322843) __v3.3.1__
&nbsp; (12/15/2020)

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.4320789.svg)](https://doi.org/10.5281/zenodo.4320789) __v3.3.0__
&nbsp; (12/14/2020)

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.4252893.svg)](https://doi.org/10.5281/zenodo.4252893) __v3.2.0__
&nbsp; (11/06/2020)

Historical Developers
------------------

Eric Mandel, Alexey Vikhlinin

Center for Astrophysics | Harvard & Smithsonian
