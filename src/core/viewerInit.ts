// @ts-nocheck
/* JS9 browser viewer core. Attribution is centralized in README.md. */

/*global JS9Prefs, JS9Inline, dhtmlwindow, Jupyter, Plotly, ImageFilters, parent */

"use strict";

function JS9InstallViewerInit(JS9){
JS9.init = function(){
    let uopts, url, ufile, dopts, arr;
    let shapeDefaults;
    const watchForInputs = (root, callback) => {
	if( !root || typeof MutationObserver === "undefined" ){
	    return;
	}
	root.querySelectorAll("input").forEach((input) => {
	    callback(input);
	});
	(new MutationObserver((mutations) => {
	    mutations.forEach((mutation) => {
		mutation.addedNodes.forEach((node) => {
		    if( !node || node.nodeType !== 1 ){
			return;
		    }
		    if( node.matches && node.matches("input") ){
			callback(node);
		    }
		    if( node.querySelectorAll ){
			node.querySelectorAll("input").forEach((input) => {
			    callback(input);
			});
		    }
		});
	    });
	})).observe(root, {childList: true, subtree: true});
    };
    // sanity check: need HTML5 canvas and JSON
    if( !window.HTMLCanvasElement || !JSON ){
	JS9.error("your browser does not support JS9 (no HTML5 canvas and/or JSON). Please try a modern version of Firefox, Chrome, Safari, Opera, or Edge.");
    }
    // get relative location of installed viewer css file
    // which tells us where JS9 installed files (and the helper) are located
    //
    // allow specification of installdir in js9prefs.js
    // check this manually: it's happening before processing the prefs
    if( {}.hasOwnProperty.call(window, "JS9Prefs") &&
	typeof JS9Prefs === "object"               ){
	if( JS9Prefs.globalOpts && JS9Prefs.globalOpts.installDir ){
	    JS9.INSTALLDIR = JS9Prefs.globalOpts.installDir;
	}
    }
    if( !JS9.INSTALLDIR ){
	try{
	    // process all links which end in 'viewer.css' or legacy 'js9.css'
	    document.querySelectorAll('link[href$="viewer.css"], link[href$="js9.css"]').forEach((element) => {
		const h = element.getAttribute("href");
		if( h ){
		    // must really end in a recognized viewer stylesheet name
		    if( h.split("/").reverse()[0] === "js9.css" ||
			h.split("/").reverse()[0] === "viewer.css" ){
			// set install dir to its directory
			JS9.INSTALLDIR = h.replace(/(js9|viewer)\.css$/, "");
		    }
		}
	    });
	} catch(e){
	    JS9.INSTALLDIR = "";
	}
	if( JS9.INSTALLDIR ){
	    JS9.INSTALLDIR = JS9.cleanPath(JS9.INSTALLDIR);
	}
    }
    if( JS9.INSTALLDIR && JS9.INSTALLDIR.slice(-1) !== "/" ){
	// make sure there is a trailing slash
	JS9.INSTALLDIR += "/";
    }
    JS9.TOROOT = JS9.INSTALLDIR.replace(/([^/.])+/g, "..");
    // if the js9 inline object exists, add it the JS9 object
    if( {}.hasOwnProperty.call(window, "JS9Inline") &&
	typeof JS9Inline === "object"               ){
	JS9.inline = JS9.extend(true, {}, JS9Inline);
    }
    // set up the dynamic drive html window
    if( JS9.LIGHTWIN === "dhtml" ){
	// Creation of dhtmlwindowholder was done by a document.write in
	// dhtmlwindow.js. We removed it from dhtmlwindow.js file because it
		// interfered with the older viewer.css lookup above. Oh boy ...
	// But it has to be somewhere!
	if( !document.getElementById("dhtmlwindowholder") ){
	    const holder = document.createElement("div");
	    const span = document.createElement("span");
	    holder.id = "dhtmlwindowholder";
	    span.style.display = "none";
	    span.textContent = ".";
	    holder.appendChild(span);
	    document.body.appendChild(holder);
	}
	// allow in-line specification of images for all-in-one configuration
	if( JS9.inline ){
	    dhtmlwindow.imagefiles = [JS9.inline["images/min.gif"],
				      JS9.inline["images/close.gif"],
				      JS9.inline["images/restore.gif"],
				      JS9.inline["images/resize.gif"]];
	} else if( JS9.allinone ){
	    dhtmlwindow.imagefiles = [JS9.allinone.min,
				      JS9.allinone.close,
				      JS9.allinone.restore,
				      JS9.allinone.resize];
	} else {
	    dhtmlwindow.imagefiles=[JS9.InstallDir("images/min.gif"),
				    JS9.InstallDir("images/close.gif"),
				    JS9.InstallDir("images/restore.gif"),
				    JS9.InstallDir("images/resize.gif")];
	}
	// once a window is loaded, set jupyter focus, if necessary
	if( {}.hasOwnProperty.call(window, "Jupyter") ){
	    watchForInputs(document.querySelector(JS9.lightOpts[JS9.LIGHTWIN].topid),
			   (el) => {
			       if( el.parentElement ){
				   JS9.jupyterFocus(el.parentElement);
			       }
			   });
	}
    }
    // use plotly if loaded separately, otherwise use internal flot
    JS9.globalOpts.plotLibrary = JS9.globalOpts.plotLibrary || "flot";
    if( (JS9.globalOpts.plotLibrary === "plotly") &&
	!{}.hasOwnProperty.call(window, "Plotly") ){
	JS9.globalOpts.plotLibrary = "flot";
    }
    // if js9 prefs were defined/loaded explicitly, merge properties
    if( {}.hasOwnProperty.call(window, "JS9Prefs") &&
	typeof JS9Prefs === "object"               ){
	JS9.mergePrefs(JS9Prefs);
    } else {
	// look for and load json pref files
	// (set this to false in the page to avoid loading a prefs file)
	if( JS9.PREFSFILE ){
	    // load site preferences, if possible
	    JS9.loadPrefs(JS9.InstallDir(JS9.PREFSFILE), 0);
	    // load page preferences, if possible
	    JS9.loadPrefs(JS9.PREFSFILE, 0);
	}
    }
    // if JS9 prefs have regionOpts, transfer them to Regions.opts
    if( {}.hasOwnProperty.call(JS9, "Regions") ){
	JS9.extend(true, JS9.Regions.opts, JS9.regionOpts);
    }
    delete JS9.regionOpts;
    // if JS9 prefs have catalogOpts, transfer them to Catalogs.opts
    if( {}.hasOwnProperty.call(JS9, "Catalogs") ){
	JS9.extend(true, JS9.Catalogs.opts, JS9.catalogOpts);
    }
    delete JS9.catalogOpts;
    // if JS9 prefs have crosshairOpts, transfer them to Crosshair.opts
    if( {}.hasOwnProperty.call(JS9, "Crosshair") ){
	JS9.extend(true, JS9.Crosshair.opts, JS9.crosshairOpts);
    }
    delete JS9.crosshairOpts;
    // if JS9 prefs have gridOpts, transfer them to Grid.opts
    if( {}.hasOwnProperty.call(JS9, "Grid") ){
	JS9.extend(true, JS9.Grid.opts, JS9.gridOpts);
    }
    delete JS9.gridOpts;
    // backward-compatible fabricOpts prefs now target the active shape engine
    shapeDefaults = JS9.ShapeEngine.getDefaultOptions();
    if( shapeDefaults ){
	JS9.extend(true, shapeDefaults, JS9.fabricOpts);
	JS9.ShapeEngine.applyDefaults(shapeDefaults);
    }
    delete JS9.fabricOpts;
    // regularize resize params
    if( !JS9.globalOpts.resize ){
	JS9.globalOpts.resizeHandle = false;
    }
    // backward compatibility (we moved this property 7/2018)
    if( JS9.analOpts.prependJS9Dir !== undefined ){
	JS9.globalOpts.prependJS9Dir = JS9.analOpts.prependJS9Dir;
	delete JS9.analOpts.prependJS9Dir;
    }
    // backward compatibility (we moved this property 7/2018)
    if( JS9.analOpts.dataDir !== undefined ){
	JS9.globalOpts.dataDir = JS9.analOpts.dataDir;
	delete JS9.analOpts.dataDir;
    }
    // backward compatibility (we renamed this property 8/2020)
    if( JS9.globalOpts.regionsToClipboard !== undefined &&
	JS9.globalOpts.regToClipboard === undefined     ){
	JS9.globalOpts.regToClipboard = JS9.globalOpts.regionsToClipboard;
	delete JS9.globalOpts.regionsToClipboard;
    }
    // backward compatibility (we renamed this property 8/2020)
    if( JS9.globalOpts.regionDisplay !== undefined  &&
	JS9.globalOpts.regDisplay === undefined     ){
	JS9.globalOpts.regDisplay = JS9.globalOpts.regionDisplay;
	delete JS9.globalOpts.regionDisplay;
    }
    // backward compatibility (we renamed this property 8/2020)
    if( JS9.globalOpts.regionConfigSize !== undefined  &&
	JS9.globalOpts.regConfigSize === undefined     ){
	JS9.globalOpts.regConfigSize = JS9.globalOpts.regionConfigSize;
	delete JS9.globalOpts.regionConfigSize;
    }
    // backward compatibility (we renamed this property 8/2020)
    if( JS9.globalOpts.regionTemplates !== undefined  &&
	JS9.globalOpts.regTemplates === undefined     ){
	JS9.globalOpts.regTemplates = JS9.globalOpts.regionTemplates;
	delete JS9.globalOpts.regionTemplates;
    }
    // turn off resize on mobile platforms
    if( JS9.BROWSER[3] ){
	JS9.globalOpts.resizeHandle = false;
    }
    // replace with global opts with user opts, if necessary
    if( {}.hasOwnProperty.call(window, "localStorage") &&
	JS9.globalOpts.localStorage                    ){
	try{ uopts = localStorage.getItem("globals"); }
	catch(e){ uopts = null; }
	if( uopts ){
	    try{ JS9.userOpts.displays = JSON.parse(uopts); }
	    catch(ignore){ /* empty */ }
	    if( JS9.userOpts.displays ){
		JS9.extend(true, JS9.globalOpts, JS9.userOpts.displays);
	    }
	}
	try{ uopts = localStorage.getItem("images"); }
	catch(e){ uopts = null; }
	if( uopts ){
	    try{ JS9.userOpts.images = JSON.parse(uopts); }
	    catch(ignore){ /* empty */ }
	    if( JS9.userOpts.images ){
		JS9.extend(true, JS9.imageOpts, JS9.userOpts.images);
	    }
	}
	// this gets replaced below
	try{ uopts = localStorage.getItem("fits"); }
	catch(e){ uopts = null; }
	if( uopts ){
	    try{ JS9.userOpts.fits = JSON.parse(uopts); }
	    catch(ignore){ /* empty */ }
	}
	try{ uopts = localStorage.getItem("regions"); }
	catch(e){ uopts = null; }
	if( uopts ){
	    try{ JS9.userOpts.regions = JSON.parse(uopts); }
	    catch(ignore){ /* empty */ }
	    if( JS9.userOpts.regions ){
		JS9.extend(true, JS9.Regions.opts, JS9.userOpts.regions);
	    }
	}
	try{ uopts = localStorage.getItem("grid"); }
	catch(e){ uopts = null; }
	if( uopts ){
	    try{ JS9.userOpts.images = JSON.parse(uopts); }
	    catch(ignore){ /* empty */ }
	    if( JS9.userOpts.images ){
		JS9.extend(true, JS9.Grid.opts, JS9.userOpts.images);
	    }
	}
	try{ uopts = localStorage.getItem("catalog"); }
	catch(e){ uopts = null; }
	if( uopts ){
	    try{ JS9.userOpts.images = JSON.parse(uopts); }
	    catch(ignore){ /* empty */ }
	    if( JS9.userOpts.images ){
		JS9.extend(true, JS9.Catalogs.Opts, JS9.userOpts.images);
	    }
	}
    }
    // set debug flag
    JS9.DEBUG = JS9.DEBUG || JS9.globalOpts.debug || 0;
    // init main display(s)
    document.querySelectorAll("div.JS9").forEach((element) => {
	JS9.checkNew(new JS9.Display(element));
    });
    // load web worker
    if( window.Worker && !JS9.allinone){
	try{ JS9.worker = new JS9.WebWorker(JS9.InstallDir(JS9.WORKERFILE)); }
	catch(e){ /* empty */ }
    }
    // for allinone files, runtime scripts are already loaded so init FITS now
    if( JS9.allinone ){
	JS9.initFITS();
    } else {
	// load optional runtime scripts, then initialize FITS
	JS9.initRuntime();
    }
    // initialize helper support
    JS9.helper = new JS9.Helper();
    // add handler for postMessage events
    window.addEventListener("message", (ev) => {
	let s, msg;
	// For Chrome, origin property is in the ev.originalEvent object
	let origin = ev.origin || ev.originalEvent.origin;
	const data = ev.data;
	if( origin === "null" ){
	    origin = "unknown";
	}
	// if postMessage handling is disabled, just (log and) return
	if( !JS9.globalOpts.postMessage ){
	    if( JS9.DEBUG ){
		s = `JS9 ignoring postMessage, origin: ${origin}`;
		if( typeof data === "string" ){
		    s += ` data: ${data}`;
		} else if( typeof data === "object" ){
		    s += ` obj: ${JSON.stringify(Object.keys(data))}`;
		} else {
		    s += ` typeof: ${typeof data}`;
		}
		JS9.log(s);
	    }
	    return;
	}
	if( typeof data === "string" ){
	    // json string passed (we hope)
	    try{ msg = JSON.parse(data); }
	    catch(e){ JS9.error(`can't parse msg: ${data}`, e); }
	} else if( typeof data === "object" ){
	    // object was passed directly
	    msg = data;
	} else {
	    JS9.error("invalid msg from postMessage");
	}
	// call the msg handler for JS9 API calls
	JS9.msgHandler(msg, (stdout, stderr, errcode, a) => {
	    let res;
            a = a || {};
	    res = {name: a.name, rtype: a.rtype, rdata: stdout,
		   stdout: stdout, stderr: stderr, errcode: errcode};
	    parent.postMessage({cmd: msg.cmd, res: res}, "*");
	});
    }, false);
    // initialize image filters
    if( {}.hasOwnProperty.call(window, "ImageFilters") ){
	JS9.ImageFilters = ImageFilters;
    }
    // initialize colormaps
    JS9.initColormaps();
    // initialize console commands
    JS9.initCommands();
    // init analysis
    JS9.initAnalysis();
    // register essential plugins
    JS9.RegisterPlugin(JS9.MouseTouch.CLASS, JS9.MouseTouch.NAME,
		       JS9.MouseTouch.init,
		       {menuItem: "Mouse/Touch",
			onplugindisplay: JS9.MouseTouch.init,
			help: "help/mousetouch.html",
			winTitle: "Mouse/Touch Actions",
			winResize: true,
			winDims: [JS9.MouseTouch.WIDTH,JS9.MouseTouch.HEIGHT]});
    JS9.RegisterPlugin(JS9.Regions.CLASS, JS9.Regions.NAME,
		       JS9.Regions.init,
		       {divArgs: ["regions"],
			winDims: [0, 0]});
    JS9.RegisterPlugin(JS9.Crosshair.CLASS, JS9.Crosshair.NAME,
		       JS9.Crosshair.init,
		       {onmousemove: JS9.Crosshair.display,
			onkeyboardaction: JS9.Crosshair.keyaction,
			onkeyup: JS9.Crosshair.keyup,
			onimageload: JS9.Crosshair.create,
			winDims: [0, 0]});
    JS9.RegisterPlugin(JS9.Grid.CLASS, JS9.Grid.NAME,
		       JS9.Grid.init,
		       {onsetpan:      JS9.Grid.regrid,
			onsetzoom:     JS9.Grid.regrid,
			onsetwcssys:   JS9.Grid.regrid,
			onsetwcsunits: JS9.Grid.regrid,
			onimageload:   JS9.Grid.regrid,
			onupdateprefs: JS9.Grid.regrid,
			winDims:       [0, 0]});
    JS9.RegisterPlugin(JS9.Dysel.CLASS, JS9.Dysel.NAME,
		       JS9.Dysel.init,
		       {onimageload:   JS9.Dysel.imageload,
			onimageclose:  JS9.Dysel.imageclose,
			winDims:       [0, 0]});
    JS9.RegisterPlugin(JS9.Titlebar.CLASS, JS9.Titlebar.NAME,
		       JS9.Titlebar.init,
		       { onimageload:  JS9.Titlebar.imageload,
			 onimagedisplay: JS9.Titlebar.imagedisplay,
			 onimageclose: JS9.Titlebar.imageclose,
			 winDims: [0, 0]});
    // find divs associated with each plugin and run the constructor
    JS9.instantiatePlugins();
    // sort plugins
    JS9.plugins.sort((a,b) => {
	const t1 = a.opts.menuItem;
	const t2 = b.opts.menuItem;
	if( !t1 ){
	    return 1;
	}
	if( !t2 ){
	    return -1;
	}
	if( t1 < t2 ){
	    return -1;
	}
	if( t1 > t2 ){
	    return 1;
	}
	return 0;
    });
    // check web page url for file to load, if necessary
    // check for display rename
    if( JS9.globalOpts.processQueryParams ){
	url = new URL(window.location);
	if( url.searchParams ){
	    uopts = {};
	    arr = null;
	    for (const [key, value] of url.searchParams){
		switch(key){
		case "url":
		case "file":
		    ufile = value;
		    break;
		case "display":
		    dopts = {display: value};
		    break;
		case "renamedisplay":
		    arr=value.split(/[:,]/);
		    break;
		default:
		    uopts[key] = value;
		    break;
		}
	    }
	    // rename display when all is ready
	    if( arr ){
		JS9.prerename = [...arr];
	    }
	    // preload file, if necessary
	    if( ufile ){
		if( dopts ){
		    JS9.Preload(ufile, uopts, dopts);
		} else {
		    JS9.Preload(ufile, uopts);
		}
	    }
	}
    }
    // scroll to top
    window.scrollTo(0, 0);
    // signal JS9 init is complete
    JS9.inited = true;
    JS9.triggerDocumentEvent("JS9:init");
};
}

if( typeof globalThis !== "undefined" ){
    globalThis.JS9InstallViewerInit = JS9InstallViewerInit;
}
