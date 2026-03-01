// @ts-nocheck
/* JS9 FITS/runtime bootstrap extracted from viewer.js. */

/*global Fixi */

"use strict";

function JS9InstallFITSBootstrap(JS9){
    // ---------------------------------------------------------------------
    // the init routine to start up the FITS runtime
    // ---------------------------------------------------------------------
    
    JS9.initRuntime = function(){
        const loadFixi = (next) => {
    	let fixiURL;
    	if( !JS9.globalOpts.fixiURL ||
    	    {}.hasOwnProperty.call(window, "Fixi") ){
    	    next();
    	    return;
    	}
    	fixiURL = JS9.InstallDir(JS9.globalOpts.fixiURL);
    	try{
    	    // optional extraction file: continue even if unavailable
    	    JS9.loadScript(fixiURL, next, next);
    	}
    	catch(ignore){
    	    next();
    	}
        };
        // sanity check: do only once
        if( JS9.fits && JS9.fits.ready ){ return; }
        // FITS is initialized via extracted runtimes by default (fixi Rust/WASM).
        loadFixi(() => {
    	JS9.initFITS();
        });
    };
    
    // initialize FITS support
    JS9.initFITS = function(){
        let initOpts;
        let fixiBaseURL;
        const signalJS9Ready = () => {
    	if( JS9.helper.ready && JS9.inited && !JS9.readied ){
    	    JS9.triggerDocumentEvent("JS9:ready", {status: "OK"});
    	}
        };
        const preferredAdapter = () => {
    	const configured = JS9.globalOpts.fitsAdapter;
    	if( JS9.notNull(configured) ){
    	    if( String(configured).trim() ){
    		return String(configured).trim();
    	    }
    	}
    	return "fixi";
        };
        const adapterIdentity = (name) => {
    	const lowered = (name || "").toString().trim().toLowerCase();
    	let resolved;
    	if( !lowered ){
    	    return "";
    	}
    	resolved = JS9.resolveFITSAdapterName(lowered);
    	if( resolved && resolved !== lowered ){
    	    return resolved;
    	}
    	switch(lowered){
    	case "fixi-js":
    	    return "fixi";
    	default:
    	    return lowered;
    	}
        };
        const adapterCandidates = () => {
    	const out = [];
    	const seen = {};
    	const add = (name) => {
    	    const raw = (name || "").toString().trim();
    	    const id = adapterIdentity(raw);
    	    if( !raw || !id || seen[id] ){
    		return;
    	    }
    	    seen[id] = true;
    	    out.push(raw);
    	};
    	add(preferredAdapter());
    	add("fixi");
    	return out;
        };
        const installRuntimeFallbacks = () => {
    	// default runtime fallbacks when no adapter supplies a capability.
    	JS9.vmalloc = JS9.vmalloc || (() => {
    	    JS9.error("virtual FITS memory operations are not available in the active FITS adapter");
    	});
    	JS9.vfree = JS9.vfree || (() => {});
    	JS9.vheap = JS9.vheap || null;
    	JS9.vmemcpy = JS9.vmemcpy || (() => {});
    	JS9.vstrcpy = JS9.vstrcpy || (() => {});
    	JS9.vfile = JS9.vfile || (() => {
    	    JS9.error("virtual FITS files are not available in the active FITS adapter");
    	});
    	JS9.vread = JS9.vread || (() => null);
    	JS9.vunlink = JS9.vunlink || (() => {});
    	JS9.vsize = JS9.vsize || (() => -1);
    	JS9.vmount = JS9.vmount || (() => 0);
    	JS9.arrfile = JS9.arrfile || (() => null);
    	JS9.listhdu = JS9.listhdu || (() => null);
    	JS9.initwcs = JS9.initwcs || (() => 0);
    	JS9.freewcs = JS9.freewcs || (() => 0);
    	JS9.wcsinfo = JS9.wcsinfo || (() => null);
    	JS9.wcssys = JS9.wcssys || (() => null);
    	JS9.wcsunits = JS9.wcsunits || (() => null);
    	JS9.pix2wcs = JS9.pix2wcs || (() => "");
    	JS9.wcs2pix = JS9.wcs2pix || (() => "");
    	JS9.reg2wcs = JS9.reg2wcs || (() => "");
    	JS9.saostrtod = JS9.saostrtod || ((x) => parseFloat(x || 0));
    	JS9.saodtostr = JS9.saodtostr || ((x) => String(x));
    	JS9.saodtype = JS9.saodtype || (() => 0);
    	JS9.zscale = JS9.zscale || null;
    	JS9.tanhdr = JS9.tanhdr || null;
    	JS9.reproject = JS9.reproject || null;
    	JS9.madd = JS9.madd || null;
    	JS9.imgtbl = JS9.imgtbl || null;
    	JS9.makehdr = JS9.makehdr || null;
    	JS9.shrinkhdr = JS9.shrinkhdr || null;
    	JS9.imsection = JS9.imsection || null;
    	JS9.regcnts = JS9.regcnts || null;
        };
        const mountHostFS = () => {
	    if( JS9.hostFS && typeof JS9.vmount === "function" ){
		try{
		    if( !JS9.vmount("/", JS9.hostFS) ){
			delete JS9.hostFS;
    		}
    	    }
    	    catch(ignore){
    		delete JS9.hostFS;
    	    }
    	}
        };
        const initFixiRuntime = () => {
    	return new Promise((resolve, reject) => {
    	    if( !{}.hasOwnProperty.call(window, "Fixi") ){
    		reject(new Error("fixi runtime not loaded"));
    		return;
    	    }
    	    if( typeof Fixi.init !== "function" ){
    		resolve();
    		return;
    	    }
    	    initOpts = {fitsCompliance: JS9.globalOpts.fitsCompliance};
    	    if( JS9.globalOpts.fixiURL ){
    		fixiBaseURL = JS9.InstallDir(JS9.globalOpts.fixiURL).replace(/[^/]*$/, "");
    		initOpts.baseURL = fixiBaseURL;
    	    }
    	    if( JS9.globalOpts.fixiWasmURL ){
    		initOpts.wasmURL = JS9.InstallDir(JS9.globalOpts.fixiWasmURL);
    	    }
    	    Fixi.init(initOpts).then(() => {
    		resolve();
    	    }).catch((e) => {
    		reject(e);
    	    });
    	});
        };
        const activateAdapter = (name) => {
    	const selected = JS9.fitsLibrary(name, {silent: true});
    	if( !selected ){
    	    throw new Error(`unable to activate FITS adapter: ${name}`);
    	}
        };
        const finishSuccess = () => {
    	JS9.tmp.initFITSInProgress = false;
    	mountHostFS();
    	signalJS9Ready();
        };
        const finishFailure = (error) => {
    	JS9.tmp.initFITSInProgress = false;
    	JS9.error("no FITS backend available (check fixi runtime and adapter configuration)", error);
        };
        const activateSequentially = (candidates, idx, lastError) => {
    	let name, identity;
    	const next = (error) => {
    	    activateSequentially(candidates, idx + 1, error || lastError);
    	};
    	if( idx >= candidates.length ){
    	    finishFailure(lastError || new Error("unknown FITS initialization failure"));
    	    return;
    	}
    	name = candidates[idx];
    	identity = adapterIdentity(name);
    	if( identity === "fixi" ){
    	    initFixiRuntime().then(() => {
    		try{
    		    activateAdapter(name);
    		    finishSuccess();
    		}
    		catch(e){
    		    next(e);
    		}
    	    }).catch((e) => {
    		next(e);
    	    });
    	    return;
    	}
    	try{
    	    activateAdapter(name);
    	    finishSuccess();
    	}
    	catch(e){
    	    next(e);
    	}
        };
        // sanity check: do only once
        if( JS9.fits && JS9.fits.ready ){
    	return;
        }
        if( JS9.tmp.initFITSInProgress ){
    	return;
        }
        JS9.tmp.initFITSInProgress = true;
        installRuntimeFallbacks();
        if( typeof JS9.captureFITSRuntimeFallbacks === "function" ){
    	JS9.captureFITSRuntimeFallbacks();
        }
        activateSequentially(adapterCandidates(), 0, null);
    };
}

if( typeof globalThis !== "undefined" ){
    globalThis.JS9InstallFITSBootstrap = JS9InstallFITSBootstrap;
}
