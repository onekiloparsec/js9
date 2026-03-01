// @ts-nocheck
/* JS9 FITS runtime installer extracted from viewer.js. */

/*global Fixi */

"use strict";

function JS9InstallFITSRuntime(JS9){
    // registered FITS adapters, keyed by canonical name
    JS9.fitsAdapters = JS9.fitsAdapters || {};
    JS9.fitsAdapterAliases = JS9.fitsAdapterAliases || {};
    JS9.fitsAdapterCapabilityDefaults = {
	fits: true,
	wcs: false,
	scaling: false,
	reprojection: false,
	analysis: false,
	compression: false
    };
    JS9.fitsRuntimeMethodNames = [
	"vmalloc",
	"vfree",
	"vmemcpy",
	"vstrcpy",
	"vfile",
	"vread",
	"vunlink",
	"vsize",
	"vmount",
	"arrfile",
	"listhdu",
	"initwcs",
	"freewcs",
	"wcsinfo",
	"wcssys",
	"wcsunits",
	"pix2wcs",
	"wcs2pix",
	"reg2wcs",
	"saostrtod",
	"saodtostr",
	"saodtype",
	"zscale",
	"tanhdr",
	"reproject",
	"madd",
	"imgtbl",
	"makehdr",
	"shrinkhdr",
	"imsection",
	"regcnts"
    ];
    JS9.fitsRuntimeValueNames = [
	"vheap"
    ];
    JS9.fitsRuntimeFallbacks = JS9.fitsRuntimeFallbacks || {};

    JS9.captureFITSRuntimeFallbacks = function(){
	let i, key;
	for(i=0; i<JS9.fitsRuntimeMethodNames.length; i++){
	    key = JS9.fitsRuntimeMethodNames[i];
	    JS9.fitsRuntimeFallbacks[key] = JS9[key];
	}
	for(i=0; i<JS9.fitsRuntimeValueNames.length; i++){
	    key = JS9.fitsRuntimeValueNames[i];
	    JS9.fitsRuntimeFallbacks[key] = JS9[key];
	}
	if( !JS9.wcsInitMode ){
	    JS9.wcsInitMode = "pointer";
	}
    };

    JS9.bindFITSRuntime = function(adapter){
	let i, key, fallback, candidate, mode;
	adapter = adapter || JS9.fits || {};
	for(i=0; i<JS9.fitsRuntimeMethodNames.length; i++){
	    key = JS9.fitsRuntimeMethodNames[i];
	    candidate = adapter[key];
	    fallback = JS9.fitsRuntimeFallbacks[key];
	    if( typeof candidate === "function" ){
		JS9[key] = candidate.bind(adapter);
	    } else if( {}.hasOwnProperty.call(JS9.fitsRuntimeFallbacks, key) ){
		JS9[key] = fallback;
	    }
	}
	for(i=0; i<JS9.fitsRuntimeValueNames.length; i++){
	    key = JS9.fitsRuntimeValueNames[i];
	    candidate = adapter[key];
	    fallback = JS9.fitsRuntimeFallbacks[key];
	    if( candidate !== undefined ){
		JS9[key] = candidate;
	    } else if( {}.hasOwnProperty.call(JS9.fitsRuntimeFallbacks, key) ){
		JS9[key] = fallback;
	    }
	}
	mode = (adapter.wcsInitMode || "").toString().trim().toLowerCase();
	JS9.wcsInitMode = (mode === "header") ? "header" : "pointer";
    };

    JS9.resolveFITSAdapterName = function(name){
	const alias = (name || "").toString().trim().toLowerCase();
	if( !alias ){
	    return "";
	}
	return JS9.fitsAdapterAliases[alias] || alias;
    };

    JS9.validateFITSAdapter = function(adapter, name){
	const missing = [];
	const required = ["handleFITSFile", "getFITSImage", "cleanupFITSFile", "maxFITSMemory"];
	let i, key;
	const inferCapability = (capability, methods) => {
	    let j;
	    if( typeof adapter.capabilities[capability] === "boolean" ){
		return adapter.capabilities[capability];
	    }
	    for(j=0; j<methods.length; j++){
		if( typeof adapter[methods[j]] !== "function" ){
		    return false;
		}
	    }
	    return true;
	};
	if( !adapter || typeof adapter !== "object" ){
	    JS9.error(`invalid FITS adapter '${name}': expected an object`);
	}
	for(i=0; i<required.length; i++){
	    key = required[i];
	    if( typeof adapter[key] !== "function" ){
		missing.push(key);
	    }
	}
	if( missing.length ){
	    JS9.error(`invalid FITS adapter '${name}': missing method(s): ${missing.join(", ")}`);
	}
	adapter.options = adapter.options || {};
	adapter.capabilities = JS9.extend(
	    {},
	    JS9.fitsAdapterCapabilityDefaults,
	    adapter.capabilities || {}
	);
	adapter.capabilities.fits = inferCapability(
	    "fits",
	    ["handleFITSFile", "getFITSImage", "cleanupFITSFile", "maxFITSMemory"]
	);
	adapter.capabilities.wcs = inferCapability(
	    "wcs",
	    ["initwcs", "pix2wcs", "wcs2pix"]
	);
	adapter.capabilities.scaling = inferCapability(
	    "scaling",
	    ["computeZscale"]
	) || inferCapability("scaling", ["zscale"]);
	adapter.capabilities.reprojection = inferCapability(
	    "reprojection",
	    ["reproject", "madd", "imgtbl", "makehdr", "shrinkhdr"]
	);
	adapter.capabilities.analysis = inferCapability(
	    "analysis",
	    ["regcnts"]
	);
	adapter.capabilities.compression = inferCapability(
	    "compression",
	    ["compress", "decompress"]
	);
	return adapter;
    };

    JS9.registerFITSAdapter = function(name, adapterOrFactory, opts){
	let i;
	let canonical;
	let aliases;
	opts = opts || {};
	canonical = JS9.resolveFITSAdapterName(name);
	if( !canonical ){
	    JS9.error("missing FITS adapter name in JS9.registerFITSAdapter()");
	}
	JS9.fitsAdapters[canonical] = {
	    name: canonical,
	    factory: adapterOrFactory,
	    configure: opts.configure
	};
	JS9.fitsAdapterAliases[canonical] = canonical;
	aliases = opts.aliases || [];
	for(i=0; i<aliases.length; i++){
	    if( aliases[i] ){
		JS9.fitsAdapterAliases[aliases[i].toString().trim().toLowerCase()] = canonical;
	    }
	}
	return canonical;
    };

    JS9.unregisterFITSAdapter = function(name){
	const canonical = JS9.resolveFITSAdapterName(name);
	const aliases = Object.keys(JS9.fitsAdapterAliases);
	let i, alias;
	if( !canonical ){
	    return false;
	}
	delete JS9.fitsAdapters[canonical];
	for(i=0; i<aliases.length; i++){
	    alias = aliases[i];
	    if( JS9.fitsAdapterAliases[alias] === canonical ){
		delete JS9.fitsAdapterAliases[alias];
	    }
	}
	return true;
    };

    JS9.listFITSAdapters = function(){
	return Object.keys(JS9.fitsAdapters).sort();
    };

    JS9.useFITSAdapter = function(name, cfg){
	let entry, adapter;
	const canonical = JS9.resolveFITSAdapterName(name);
	if( !canonical ){
	    return null;
	}
	entry = JS9.fitsAdapters[canonical];
	if( !entry ){
	    return null;
	}
	if( typeof entry.factory === "function" ){
	    adapter = entry.factory(cfg || {});
	} else if( entry.factory && typeof entry.factory === "object" ){
	    adapter = entry.factory;
	} else {
	    JS9.error(`invalid FITS adapter '${canonical}': expected object or factory`);
	}
	JS9.validateFITSAdapter(adapter, canonical);
	if( typeof entry.configure === "function" ){
	    entry.configure(adapter, cfg || {});
	}
	JS9.fits = adapter;
	JS9.fits.ready = true;
	JS9.fits.name = canonical;
	JS9.fits.options = JS9.fits.options || {};
	JS9.fits.options.error = JS9.error;
	JS9.fits.options.waiting = JS9.waiting;
	if( typeof JS9.bindFITSRuntime === "function" ){
	    JS9.bindFITSRuntime(JS9.fits);
	}
	return canonical;
    };

    // configure or return the fits library
    JS9.fitsLibrary = function(s, opts){
	let t;
	opts = opts || {};
	const fail = (message) => {
	    if( opts.silent ){
		throw new Error(message);
	    }
	    JS9.error(message);
	};
	const configureDefaultOptions = () => {
	    // set up default options
	    JS9.fits.options = JS9.fits.options || {};
	    JS9.fits.options.handler = JS9.NewFitsImage;
	    JS9.fits.options.error = JS9.error;
	    if( JS9.userOpts.fits ){
		JS9.fits.options.extlist =  JS9.userOpts.fits.extlist;
		JS9.fits.options.table = {
		    xdim: JS9.userOpts.fits.xdim,
		    ydim: JS9.userOpts.fits.ydim,
		    bin: JS9.userOpts.fits.bin || 1
		};
		JS9.fits.options.image = {
		    xdim: JS9.userOpts.fits.ixdim || JS9.userOpts.fits.xmax,
		    ydim: JS9.userOpts.fits.iydim || JS9.userOpts.fits.ymax,
		    bin: JS9.userOpts.fits.ibin || 1
		};
	    } else {
		JS9.fits.options.extlist =  JS9.globalOpts.extlist;
		JS9.fits.options.table = {bin: (JS9.globalOpts.table.bin || 1)};
		// NB: dims are deprecated 11/27/16
		if( JS9.notNull(JS9.globalOpts.table.xdim) ){
		    JS9.fits.options.table.xdim = JS9.globalOpts.table.xdim;
		} else if( JS9.notNull(JS9.globalOpts.dims) ){
		    JS9.fits.options.table.xdim = JS9.globalOpts.dims[0];
		}
		if( JS9.notNull(JS9.globalOpts.table.ydim) ){
		    JS9.fits.options.table.ydim = JS9.globalOpts.table.ydim;
		} else if( JS9.notNull(JS9.globalOpts.dims) ){
		    JS9.fits.options.table.ydim = JS9.globalOpts.dims[1];
		}
		JS9.fits.options.image = {bin: (JS9.globalOpts.image.bin || 1)};
		if( JS9.notNull(JS9.globalOpts.image.xdim) ){
		    JS9.fits.options.image.xdim = JS9.globalOpts.image.xdim;
		} else if( JS9.notNull(JS9.globalOpts.xmax) ){
		    JS9.fits.options.image.xdim = JS9.globalOpts.xmax;
		}
		if( JS9.notNull(JS9.globalOpts.image.ydim) ){
		    JS9.fits.options.image.ydim = JS9.globalOpts.image.ydim;
		} else if( JS9.notNull(JS9.globalOpts.ymax) ){
		    JS9.fits.options.image.ydim = JS9.globalOpts.ymax;
		}
	    }
	    if( JS9.fits.maxFITSMemory && JS9.globalOpts.maxMemory ){
		JS9.fits.maxFITSMemory(JS9.globalOpts.maxMemory);
	    }
	};
	const registerBuiltinAdapters = () => {
	    if( {}.hasOwnProperty.call(window, "Fixi") &&
		typeof Fixi.createRustWasmAdapter === "function" ){
		JS9.registerFITSAdapter("fixi", () => {
		    return Fixi.createRustWasmAdapter();
		}, {
		    aliases: ["fixi-js"],
		    configure: (adapter) => {
			if( adapter && adapter.backend &&
			    typeof Fixi.configureForJS9 === "function" ){
			    Fixi.configureForJS9(adapter, {
				globalOpts: JS9.globalOpts,
				userFits: JS9.userOpts.fits,
				handler: JS9.NewFitsImage,
				error: JS9.error,
				waiting: JS9.waiting,
				maxMemory: JS9.globalOpts.maxMemory,
				fitsCompliance: JS9.globalOpts.fitsCompliance
			    });
			} else {
			    configureDefaultOptions();
			}
		    }
		});
	    }
	};
	registerBuiltinAdapters();
	if( !s ){
	    return (JS9.fits && JS9.fits.name) ? JS9.fits.name : "";
	}
	t = JS9.useFITSAdapter(s, {
	    globalOpts: JS9.globalOpts,
	    userFits: JS9.userOpts.fits
	});
	if( t ){
	    return t;
	}
	switch(s.toString().toLowerCase()){
	case "fixi":
	case "fixi-js":
	    if( !{}.hasOwnProperty.call(window, "Fixi") ){
		fail("fixi library is not available");
	    }
	    fail("fixi rust/wasm backend is not available");
	    break;
	case "cfitsio":
	    fail("legacy cfitsio backend is not available in this JS9 build");
	    break;
	default:
	    fail(`unknown fits library: ${s}`);
	    break;
	}
	return "";
    };
}

if( typeof globalThis !== "undefined" ){
    globalThis.JS9InstallFITSRuntime = JS9InstallFITSRuntime;
}
