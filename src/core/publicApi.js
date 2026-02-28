/* JS9 browser viewer core. Attribution is centralized in README.md. */

"use strict";

function JS9InstallPublicApi(JS9){
JS9.parsePublicArgs = function(args){
    let display = null;
    const argv = Array.from(args);
    const obj = argv[argv.length-1];
    // look for object containing display property as last arg
    if( obj && (typeof obj === "object")       &&
	{}.hasOwnProperty.call(obj, "display") &&
	(Object.keys(obj).length === 1)        ){
	display = obj.display;
	argv.pop();
    }
    // return results
    return {argv, display};
};

// some public routines are just a wrapper around the underlying image call
// others require a new func
JS9.mkPublic = function(name, s){
    if( typeof s === "string" ){
	if( JS9.Image.prototype[s] ){
	    JS9[name] = function(...args){
		let got;
		const {display, argv} = JS9.parsePublicArgs(args);
		const im = JS9.getImage(display);
		if( im ){
		    // call the image method
		    got = im[s](...argv);
		    // don't return image handle, it can't be serialized
		    if( (got === im) || (got === im.display) ){
			return JS9.globalOpts.quietReturn ? "" : "OK";
		    }
		    return got;
		}
	    };
	    JS9.publics[name] = JS9[name];
	} else {
	    JS9.error(`unknown image func for mkPublic: ${s}`);
	}
    } else if( typeof s === "function" ){
	JS9[name] = s;
	JS9.publics[name] = JS9[name];
    } else {
	JS9.error(`unsupported type for mkPublic: ${typeof s}`);
    }
};

JS9.mkPublic("CloseImage", "closeImage");
JS9.mkPublic("DisplayImage", "displayImage");
JS9.mkPublic("DisplayExtension", "displayExtension");
JS9.mkPublic("DisplaySlice", "displaySlice");
JS9.mkPublic("DisplaySection", "displaySection");
JS9.mkPublic("BlendImage", "blendImage");
JS9.mkPublic("MaskImage", "maskImage");
JS9.mkPublic("GetColormap", "getColormap");
JS9.mkPublic("SetColormap", "setColormap");
JS9.mkPublic("GetZoom", "getZoom");
JS9.mkPublic("SetZoom", "setZoom");
JS9.mkPublic("GetPan", "getPan");
JS9.mkPublic("SetPan", "setPan");
JS9.mkPublic("AlignPanZoom", "alignPanZoom");
JS9.mkPublic("GetScale", "getScale");
JS9.mkPublic("SetScale", "setScale");
JS9.mkPublic("GetOpacity", "getOpacity");
JS9.mkPublic("SetOpacity", "setOpacity");
JS9.mkPublic("SetFlip", "setFlip");
JS9.mkPublic("GetFlip", "getFlip");
JS9.mkPublic("SetRotate", "setRotate");
JS9.mkPublic("GetRotate", "getRotate");
JS9.mkPublic("SetRot90", "setRot90");
JS9.mkPublic("GetRot90", "getRot90");
JS9.mkPublic("GetParam", "getParam");
JS9.mkPublic("SetParam", "setParam");
JS9.mkPublic("CopyParams", "copyParams");
JS9.mkPublic("GetValPos", "updateValpos");
JS9.mkPublic("ImageToDisplayPos", "imageToDisplayPos");
JS9.mkPublic("DisplayToImagePos", "displayToImagePos");
JS9.mkPublic("ImageToLogicalPos", "imageToLogicalPos");
JS9.mkPublic("LogicalToImagePos", "logicalToImagePos");
JS9.mkPublic("GetWCSUnits", "getWCSUnits");
JS9.mkPublic("SetWCSUnits", "setWCSUnits");
JS9.mkPublic("GetWCS", "getWCS");
JS9.mkPublic("SetWCS", "setWCS");
JS9.mkPublic("GetWCSSys", "getWCSSys");
JS9.mkPublic("SetWCSSys", "setWCSSys");
JS9.mkPublic("ShowShapeLayer", "showShapeLayer");
JS9.mkPublic("ActiveShapeLayer", "activeShapeLayer");
JS9.mkPublic("ToggleShapeLayers", "toggleShapeLayers");
JS9.mkPublic("AddShapes", "addShapes");
JS9.mkPublic("RemoveShapes", "removeShapes");
JS9.mkPublic("GetShapes", "getShapes");
JS9.mkPublic("ChangeShapes", "changeShapes");
JS9.mkPublic("CopyShapes", "copyShapes");
JS9.mkPublic("SelectShapes", "selectShapes");
JS9.mkPublic("UnselectShapes", "unselectShapes");
JS9.mkPublic("GroupShapes", "groupShapes");
JS9.mkPublic("UngroupShapes", "ungroupShapes");
JS9.mkPublic("DisplayCoordGrid", "displayCoordGrid");
JS9.mkPublic("Print", "print");
JS9.mkPublic("SavePNG", "savePNG");
JS9.mkPublic("SaveJPEG", "saveJPEG");
JS9.mkPublic("SaveFITS", "saveFITS");
JS9.mkPublic("UploadFITSFile", "uploadFITSFile");
JS9.mkPublic("CountsInRegions", "countsInRegions");
JS9.mkPublic("RadialProfile", "radialProfile");
JS9.mkPublic("Plot3D", "plot3d");
JS9.mkPublic("RunAnalysis", "runAnalysis");
JS9.mkPublic("GetAnalysis", "getAnalysis");
JS9.mkPublic("RawDataLayer", "rawDataLayer");
JS9.mkPublic("GaussBlurData", "gaussBlurData");
JS9.mkPublic("ImarithData", "imarithData");
JS9.mkPublic("RotateData", "rotateData");
JS9.mkPublic("ReprojectData", "reprojectData");
JS9.mkPublic("ShiftData", "shiftData");
JS9.mkPublic("FilterRGBImage", "filterRGBImage");
JS9.mkPublic("MoveToDisplay", "moveToDisplay");

// lookup an image
// eslint-disable-next-line no-unused-vars
JS9.mkPublic("LookupImage", function(...args){
    const obj = JS9.parsePublicArgs(args);
    return JS9.lookupImage(obj.argv[0], obj.display);
});

// lookup a display
// eslint-disable-next-line no-unused-vars
JS9.mkPublic("LookupDisplay", function(...args){
    const obj = JS9.parsePublicArgs(args);
    return JS9.lookupDisplay(obj.argv[0]||obj.display, obj.argv[1]);
});

// display next (or prev) image in a given display
// eslint-disable-next-line no-unused-vars
JS9.mkPublic("DisplayNextImage", function(...args){
    let n, display;
    const obj = JS9.parsePublicArgs(args);
    display = JS9.lookupDisplay(obj.display);
    if( display ){
	n = parseFloat(obj.argv[0]) || 1;
	return display.nextImage(n);
    }
});

// rename a display:
// RenameDisplay(nid)                  # change def. id (usually "JS9") to nid
// RenameDisplay(nid, {display: oid})  # change oid to nid
// RenameDisplay(oid, nid)             # change oid to nid
JS9.mkPublic("RenameDisplay", function(...args){
    let nid, oid, disp;
    const obj = JS9.parsePublicArgs(args);
    switch( obj.argv.length ){
    case 0:
	return;
    case 1:
	oid = obj.display;
	nid = obj.argv[0];
	break;
    default:
	oid = obj.argv[0];
	nid = obj.argv[1];
	break;
    }
    disp = JS9.lookupDisplay(oid);
    if( disp && disp.id ){
	oid = disp.id;
	// save the orignal id, since existing plugins use it
	if( !disp.oid ){
	    disp.oid = oid;
	}
	// set the new id
	disp.id = nid;
	// tell the helper to recognize the new instead of the old
	JS9.helper.send("renameDisplay", {odisplay: oid, ndisplay: disp.id});
    }
});

// close all displayed images
// eslint-disable-next-line no-unused-vars
JS9.mkPublic("CloseDisplay", function(...args){
    let i, s, im, disp, template, regexp;
    const obj = JS9.parsePublicArgs(args);
    disp = JS9.lookupDisplay(obj.argv[0], false);
    if( !disp ){
	disp = JS9.lookupDisplay(obj.display);
	s = obj.argv[0];
    }
    template = obj.argv[1] || s;
    if( template ){
	try{ regexp = new RegExp(template); }
	catch(e){ JS9.error(`invalid regexp for CloseDisplay: ${template}`); }
    }
    // reverse loop because we slice JS9.images
    for(i=JS9.images.length-1; i>=0; i--){
	im = JS9.images[i];
	if( im.display === disp ){
	    if( regexp ){
		if( im.id.match(regexp)       ||
		    im.file.match(regexp)     ||
		    im.fitsFile.match(regexp) ){
		    im.closeImage();
		}
	    } else {
		im.closeImage();
	    }
	}
    }
});

// add a colormap to JS9
JS9.mkPublic("AddColormap", function(...args){
    let colormap, a1, a2, a3, a4, reader, cobj;
    const obj = JS9.parsePublicArgs(args);
    const obj2cmap = (xobj, opts) => {
	let i, tobj;
	if( typeof xobj !== "object" ){
	    JS9.error("invalid colormap object for JS9.AddColormap()");
	}
	if( !JS9.isArray(xobj) ){
	    xobj = [xobj];
	}
	for(i=0; i<xobj.length; i++){
	    tobj = xobj[i];
	    if( !tobj.name ){
		JS9.error("missing name for colormap in JS9.AddColormap()");
	    }
	    if( tobj.vertices ){
		JS9.AddColormap(tobj.name,
				tobj.vertices[0],
				tobj.vertices[1],
				tobj.vertices[2],
				opts);
	    } else if( tobj.colors ){
		JS9.AddColormap(tobj.name, tobj.colors, opts);
	    } else {
		JS9.error("unknown colormap type for JS9.AddColormap()");
	    }
	}
    };
    colormap = obj.argv[0];
    a1 = obj.argv[1];
    a2 = obj.argv[2];
    a3 = obj.argv[3];
    a4 = obj.argv[4];
    if( colormap instanceof Blob ){
	// file reader object from openLocalLoadColormap
	reader = new FileReader();
	reader.onload = (ev) => {
	    try{ cobj = JSON.parse(ev.target.result); }
	    catch(e){ JS9.error("can't parse JSON colormap", e); }
	    obj2cmap(cobj, a1);
	};
	reader.readAsText(colormap);
    } else if( typeof colormap  === "object" ){
	// from LoadColormap
	obj2cmap(colormap, a1);
    } else {
	switch(obj.argv.length){
	case 1:
	    // json formatted string
	    try{ cobj = JSON.parse(colormap); }
	    catch(e){ JS9.error("can't parse JSON colormap", e); }
	    obj2cmap(cobj);
	    break;
	case 2:
	case 3:
	    if( typeof a1 === "string" ){
		try{ a1 = JSON.parse(a1); }
		catch(e){ JS9.error("can't parse JSON colormap", e); }
	    }
	    JS9.checkNew(new JS9.Colormap(colormap, a1));
	    if( obj.argv.length === 2 ){
		JS9.globalOpts.topColormaps.push(colormap);
	    } else if( typeof a2 !== "object" || a2.toplevel !== false ){
		JS9.globalOpts.topColormaps.push(colormap);
	    }
	    break;
	case 4:
	case 5:
	    if( typeof a1 === "string" ){
		try{ a1 = JSON.parse(a1); }
		catch(e){ JS9.error("can't parse JSON colormap", e); }
	    }
	    if( typeof a2 === "string" ){
		try{ a2 = JSON.parse(a2); }
		catch(e){ JS9.error("can't parse JSON colormap", e); }
	    }
	    if( typeof a3 === "string" ){
		try{ a3 = JSON.parse(a3); }
		catch(e){ JS9.error("can't parse JSON colormap", e); }
	    }
	    JS9.checkNew(new JS9.Colormap(colormap, a1, a2, a3));
	    if( obj.argv.length === 4 ){
		JS9.globalOpts.topColormaps.push(colormap);
	    } else if( !a4 || typeof a4 !== "object" || a4.toplevel !== false ){
		JS9.globalOpts.topColormaps.push(colormap);
	    }
	    break;
	default:
	    JS9.error("AddColormap() requires a colormap name and 1 or 3 args");
	    break;
	}
    }
});

// load a colormap file
JS9.mkPublic("LoadColormap", function(...args){
    let file, opts;
    const obj = JS9.parsePublicArgs(args);
    file = obj.argv[0];
    opts = obj.argv[1];
    // sanity check
    if( !file ){
	JS9.error("JS9.LoadColormap: no file specified for colormap load");
    }
    // convert blob to string
    if( typeof file === "object" ){
	JS9.AddColormap(file, opts);
    } else if( typeof file === "string" ){
	file = JS9.fixPath(file, opts);
	JS9.fetchURL(null, file, null, (data) => {
	    JS9.AddColormap(data, opts);
	});
    } else {
	// oops!
	JS9.error(`unknown file type for LoadColormap: ${typeof file}`);
    }
});

// set RGB mode (and maybe the images themselves)
JS9.mkPublic("SetRGBMode", function(...args){
    let i, im, mode, imobj;
    const obj = JS9.parsePublicArgs(args);
    const disp = JS9.lookupDisplay(obj.display);
    const colors = ["red", "green", "blue"];
    const ids = ["rid", "gid", "bid"];
    mode = obj.argv[0];
    imobj = obj.argv[1];
    if( mode === undefined ){
	mode =  !disp.rgb.active;
    }
    if( imobj ){
	for(i=0; i<3; i++){
	    im = imobj[ids[i]];
	    if( typeof im === "string" ){
		im = JS9.LookupImage(im);
	    }
	    if( !im ){
		continue;
	    }
	    im.setColormap(colors[i]);
	}
    }
    if( mode === "true" ){
	mode = true;
    } else if( mode === "false" ){
	mode = false;
    }
    disp.rgb.active = !!mode;
    JS9.DisplayImage({display: obj.display});
    return disp.rgb.active;
});

// get RGB mode info
JS9.mkPublic("GetRGBMode", function(...args){
    const obj = JS9.parsePublicArgs(args);
    const disp = JS9.lookupDisplay(obj.display);
    return {active: disp.rgb.active,
	    rid: disp.rgb.rim ? disp.rgb.rim.id: null,
	    gid: disp.rgb.gim ? disp.rgb.gim.id: null,
	    bid: disp.rgb.bim ? disp.rgb.bim.id: null};
});

// set/clear valpos flag
JS9.mkPublic("SetValPos", function(...args){
    let mode;
    let got = null;
    const obj = JS9.parsePublicArgs(args);
    const im = JS9.getImage(obj.display);
    mode = obj.argv[0];
    if( im ){
	got = im.params.valpos;
	im.params.valpos = mode;
    }
    return got;
});

// set/clear image inherit flag
JS9.mkPublic("SetImageInherit", function(...args){
    let mode;
    let got = null;
    const obj = JS9.parsePublicArgs(args);
    const im = JS9.getImage(obj.display);
    mode = obj.argv[0];
    if( im ){
	got = im.params.inherit;
	im.params.inherit = mode;
    }
    return got;
});

JS9.mkPublic("GetImageInherit", function(...args){
    let got = null;
    const obj = JS9.parsePublicArgs(args);
    const im = JS9.getImage(obj.display);
    if( im ){
	got = im.params.inherit;
    }
    return got;
});

// display in-page FITS images
JS9.mkPublic("Load", function(...args){
    let i, s, im, disp, display, func, blob, bytes, topts, tfile, vfile;
    let file, opts;
    let ptype = "fits";
    const obj = JS9.parsePublicArgs(args);
    file = obj.argv[0];
    opts = obj.argv[1];
    // sanity check
    if( !file ){
	JS9.error("JS9.Load: no file specified for image load");
    }
    // check for display
    if( obj.display ){
	display = obj.display;
    } else {
	if( JS9.displays.length > 0 ){
	    display = JS9.displays[0].id;
	} else {
	    display = JS9.DEFID;
	}
    }
    // opts is optional
    opts = opts || {};
    // opts can be an object or json
    if( typeof opts === "object" ){
	// make a copy so we can modify it
	opts = JS9.extend(true, {}, opts);
    } else if( typeof opts === "string" ){
	// convert json to object
	try{ opts = JSON.parse(opts); }
	catch(e){ opts = { /* empty */ }; }
    }
    // if display was implicit, add it to opts
    opts.display = opts.display || display;
    // check for onload func
    if( opts.onload ){
	func = opts.onload;
    } else if( JS9.imageOpts.onload ){
	func = JS9.imageOpts.onload;
	opts.onload = func;
    }
    // unset previous fetch status before new load
    delete JS9.fetchURL.status;
    // handle blob containing FITS
	if( file instanceof Blob ){
	    if( file.path || file.name ){
		// file/path name (path is available in some drag/drop contexts)
		opts.file = JS9.cleanPath(file.path || file.name);
	    // does this image already exist?
	    if( typeof opts.refresh === "object" ){
		im = opts.refresh;
	    } else {
		im = JS9.lookupImage(opts.file, opts.display);
	    }
	    if( im ){
		// do we refresh or redisplay?
		if( JS9.isNull(opts.refresh) ){
		    opts.refresh = JS9.globalOpts.reloadRefresh;
		}
		if( opts.refresh ){
		    // save the handle of the image we will be refreshing
		    opts.refresh = im;
		} else{
		    // if not refreshing, just re-display and exit
		    im.displayImage("display", opts);
		    im.refreshLayers();
		    im.display.clearMessage();
		    if( opts.onload ){
			try{ JS9.xeqByName(opts.onload, window, im); }
			catch(e){ JS9.error("in image onload callback", e,
					    false); }
		    }
		    JS9.waiting(false);
		    return;
		}
	    } else {
		// remove any extraneous refresh flag
		delete opts.refresh;
	    }
	} else {
	    // remove any extraneous refresh flag
	    delete opts.refresh;
	}
	if( !opts.file ){
	    opts.file = JS9.ANON + JS9.uniqueID();
	}
	// look for a mime type to tell us how to process this blob
	if( file.type && file.type.includes("image/") ){
	    switch(file.type){
	    case "image/fits":
		break;
	    default:
		ptype = "img";
		break;
	    }
	} else if( opts.file.split(".").pop().match(/(png|jpg|jpeg)/i) ){
	    ptype = "img";
	}
	// processing type: img or fits
	    switch(ptype){
	    case "fits":
		topts = JS9.extend(true, {}, JS9.fits.options, opts);
		// see if a local-access path can be used directly
		if( file.path && opts.localAccess ){
		    vfile = JS9.localAccess(file.path);
		// if so, use the local file instead of storing a vfile
		if( vfile ){
		    file = file.path;
		    topts.file = file;
		    topts.vfile = vfile;
		}
	    }
	    try{ JS9.handleFITSFile(file, topts, JS9.NewFitsImage); }
	    catch(e){ JS9.error("can't process FITS file", e); }
	    break;
	case "img":
	    try{ JS9.handleImageFile(file, opts, JS9.Load); }
	    catch(e){ JS9.error("can't process IMG file", e); }
	    break;
	}
	return;
    }
    // handle raw (fits) data objects
    if( typeof file === "object" ){
	JS9.checkNew(new JS9.Image(file, opts, func));
	return;
    }
    // it's gotta be a string: in-memory FITS, url, or filename
    if( typeof file !== "string" ){
	JS9.error(`unknown file type for Load: ${typeof file}`);
    }
    // convert in-memory base64-encoded FITS to a binary string
    if( file.slice(0,12) === "U0lNUExFICA9" ){
	file = window.atob(file);
    }
    // handle in-memory FITS by converting to a blob
    if( file.slice(0,9) === "SIMPLE  =" ){
	bytes = [];
	for(i=0; i<file.length; i++){
	    bytes[i] = file.charCodeAt(i);
	}
	blob = new Blob([new Uint8Array(bytes)]);
	if( !opts.file ){
	    opts.file = JS9.ANON + JS9.uniqueID();
	}
	blob.name = opts.file;
	topts = JS9.extend(true, {}, JS9.fits.options, opts);
	try{ JS9.handleFITSFile(blob, topts, JS9.NewFitsImage); }
	catch(e){ JS9.error("can't process FITS file", e); }
	return;
    }
    // do we refresh or redisplay?
    if( JS9.isNull(opts.refresh) ){
	opts.refresh = JS9.globalOpts.reloadRefresh;
    }
    if( opts.refresh ){
	// use passed im handle, if possible
	if( typeof opts.refresh === "object" ){
	    im = opts.refresh;
	} else {
	    // look for already-loaded image
	    s = file.split("/").reverse()[0];
	    im = JS9.lookupImage(s, opts.display);
	    if( im ){
		opts.refresh = im;
	    }
	}
    } else {
	// look for already-loaded image
	s = file.split("/").reverse()[0];
	im = JS9.lookupImage(s, opts.display);
    }
    // if already loaded and not refreshing, just redisplay and exit
    if( im && !opts.refresh ){
	// display image, 2D graphics, etc.
	im.displayImage("all", opts);
	im.display.clearMessage();
	if( opts.onload ){
	    try{ JS9.xeqByName(opts.onload, window, im); }
	    catch(e){ JS9.error("in image onload callback", e, false); }
	}
	JS9.waiting(false);
	return;
    }
    // security checks
    file = JS9.cleanPath(file);
    // run js9 fits2fits converter?
    if( JS9.fits2fits(opts.display, file, opts) ){
	return;
    }
    // at this point, we either access a local file or fetch the URL
    if( opts.display ){
	disp = JS9.lookupDisplay(opts.display);
    }
    JS9.waiting(true, disp);
    // cleanup previous FITS file support, if necessary
    // do this before we handle the new FITS file, or else
    // we end up with a memory leak in the runtime heap!
    if( im && opts.refresh ){
	JS9.cleanupFITSFile(im.raw, true);
    }
    // file with optional path normalization
    file = JS9.fixPath(file, opts);
    // remove extension so we can find the file itself
    tfile = file.replace(/\[.*\]/, "");
    // are we able to access a local file directly, without fetching?
    // note to myself: cfitsio uncompresses .gz files into memory, so
    // there is no benefit to having ".gz" in the localTemplates list.
    vfile = JS9.localAccess(file);
    if( vfile ){
	// access local file directly
	topts = JS9.extend(true, {}, JS9.fits.options, opts);
	topts.file = file;
	topts.vfile = vfile;
	// give spinner a chance to start up
	window.setTimeout(() => {
	    try{ JS9.handleFITSFile(file, topts, JS9.NewFitsImage); }
	    catch(e){ JS9.error("can't process FITS file", e); }
	}, 0);
    } else {
	// fetch file
	JS9.fetchURL(file, tfile, opts);
    }
});

// create a new instance of JS9 in a window (light or new)
JS9.mkPublic("LoadWindow", function(...args){
    let s, id, display, did, head, body, win, winid, initialURL, xobj;
    let wid, wtype, wurl, idbase, title, warr, wwidth, wheight;
    let file, opts, type, html, winopts;
    const lopts = JS9.lightOpts[JS9.LIGHTWIN];
    const obj = JS9.parsePublicArgs(args);
    const byId = function(value){
	return document.getElementById(value);
    };
    const resolveNode = function(value){
	if( !value ){
	    return null;
	}
	if( JS9.isWrappedCollection(value) ){
	    return value[0];
	}
	if( typeof value === "string" ){
	    return value.charAt(0) === "#" ?
		document.querySelector(value) :
		document.getElementById(value);
	}
	return value;
    };
    const onElementAvailable = function(rootSelector, selector, callback){
	let target;
	const root = document.querySelector(rootSelector);
	if( !root || typeof MutationObserver === "undefined" ){
	    return;
	}
	target = root.querySelector(selector);
	if( target ){
	    callback(target);
	    return;
	}
	(new MutationObserver((mutations, observer) => {
	    target = root.querySelector(selector);
	    if( target ){
		observer.disconnect();
		callback(target);
	    }
	})).observe(root, {childList: true, subtree: true});
    };
    const removeDisplay = (display) => {
	// remove from display list
	const idx = JS9.inArray(display, JS9.displays);
	if( idx >= 0 ){ JS9.displays.splice(idx, 1); }
    };
    const getHTML = (id, opts, winopts) => {
	let html, display;
	opts = opts || {};
	if( opts.clone ){
	    display = JS9.lookupDisplay(opts.clone, false);
	}
	if( winopts ){
	    warr = winopts.match(/(.*width=)([0-9]+)(px,height=)([0-9]+)(px.*)/, "$1@@H@@$3");
	    wwidth  = parseInt(warr[2], 10);
	    wheight = parseInt(warr[4], 10);
	}
        // make up the html with the unique id
        html = "<hr class='hline0'>";
	// menubar
	if( !display                                        ||
	    (byId(`${opts.clone}Menubar`)                   &&
	     !display.pluginInstances.JS9Menubar.isDynamic) ){
	    html += `<div class='JS9Menubar' id='${id}Menubar'></div>`;
	} else if( winopts ){
	    wheight -= 40;
	}
	// display
	html += `<div class='JS9' id='${id}'></div>`;
	// colorbar
	if( !display                                         ||
	    (byId(`${opts.clone}Colorbar`)                   &&
	     !byId(`${opts.clone}Statusbar`)                 &&
	     !display.pluginInstances.JS9Colorbar.isDynamic) ){
	    if( display && display.pluginInstances.JS9Colorbar ){
		s = `data-showTicks='${display.pluginInstances.JS9Colorbar.showTicks}'`;
	    } else {
		s = "";
	    }
	    html += `<div style='margin-top: 2px;'><div class='JS9Colorbar' id='${id}Colorbar' ${s}></div></div>`;
	    if( display && display.pluginInstances.JS9Colorbar &&
		!display.pluginInstances.JS9Colorbar.showTicks ){
		wheight -= 15;
	    }
	} else if( winopts ){
	    wheight -= 44;
	}
	if( !display                                         ||
	    (byId(`${opts.clone}Statusbar`)                  &&
	     !display.pluginInstances.JS9Statusbar.isDynamic) ){
	    html += `<div class='JS9Statusbar' id='${id}Statusbar'></div>`;
	} else if( winopts ){
	    wheight -= 40;
	}
	if( winopts ){
	    if( JS9.Dysel.retrievePlugins().length ){
		wwidth  += 2;
		wheight += 2;
	    }
	    return {html: html, winopts: warr[1] + String(wwidth) + warr[3] + String(wheight) + warr[5]};
	}
	return html;
    };
    // create display and load image into a light window
    const lightLoad = (file, opts) => {
	let display;
        // create the new JS9 Display
        display = new JS9.Display(id);
	// save the light window id;
	display.winid = winid;
	// add to list of displays
	JS9.helper.send("addDisplay", {"display": id});
        // instantiate new plugins
        JS9.instantiatePlugins();
        // load the image into this display
        opts.display = id;
        // just becomes a standard load
	if( file ){
	    JS9.Load(file, opts);
	}
	return display;
    };
    // close a light window, moving images if necessary
    const lightClose = (display) => {
	let i, im;
	let got = 0;
	const ims = [];
	// make a list of images in his display
	for(i=0; i<JS9.images.length; i++){
	    im = JS9.images[i];
	    if( im.display.id === id ){
		ims.push(im);
	    }
	}
	// done if no images
	if( !ims.length ){
	    // remove display
	    removeDisplay(display);
	    return true;
	}
	// sanity check: the moveto display must exist
	// (and not be the display we are destroying)
	if( JS9.globalOpts.lightWinClose === "move" ){
	    if( JS9.isNull(JS9.globalOpts.lightWinMoveTo) ||
		JS9.globalOpts.lightWinMoveTo === id      ){
		got = 0;
	    } else {
		for(i=0, got=0; i<JS9.displays.length; i++){
		    if( JS9.displays[i].id ===
			JS9.globalOpts.lightWinMoveTo ){
			got++;
			break;
		    }
		}
	    }
	    if( !got ){
		JS9.globalOpts.lightWinClose = "ask";
		delete JS9.globalOpts.lightWinMoveTo;
	    }
	}
	switch(JS9.globalOpts.lightWinClose ){
	case "close":
	    // remove display
	    removeDisplay(display);
	    // close them all
	    for(i=0; i<ims.length; i++){
		try{ ims[i].closeImage(); }
		catch(ignore){ /* empty */ }
	    }
	    return true;
	case "move":
	    // remove display
	    removeDisplay(display);
	    // move them to the first display
	    for(i=0; i<ims.length; i++){
		try{ ims[i].moveToDisplay(JS9.globalOpts.lightWinMoveTo); }
		catch(ignore){ /* empty */ }
	    }
	    return true;
	case "ask":
	default:
	    wid = `lightCloseID${JS9.uniqueID()}`;
	    if( JS9.allinone ){
		wtype = "inline";
		wurl = JS9.allinone.lightCloseHTML;
	    } else {
		wtype = "ajax";
		wurl = JS9.InstallDir(JS9.lightOpts.lcloseURL);
	    }
	    onElementAvailable(JS9.lightOpts[JS9.LIGHTWIN].topid,
			       "#lightWinCloseForm",
			       () => {
				   let i, el, option;
				   // on arrival, add JS9 displays to 'move' part of form
				   el = document.getElementById("lightWinCloseSel");
				   if( !el ){
				       return;
				   }
				   for(i=0; i<JS9.displays.length; i++){
				       if( JS9.displays[i].id !== id ){
					   option = document.createElement("option");
					   option.value = JS9.displays[i].id;
					   option.textContent = JS9.displays[i].id;
					   el.appendChild(option);
				       }
				   }
			       });
	    did = JS9.lightWin(wid, wtype, wurl, "Closing a light window",
			       lopts.lcloseWin);
	    display = resolveNode(did);
	    if( display ){
		display.dataset.dispid = id;
		display.dataset.winid = winid;
	    }
	    return false;
	}
    };
    // input args
    file = obj.argv[0];
    opts = obj.argv[1];
    type = obj.argv[2];
    html = obj.argv[3];
    winopts = obj.argv[4];
    // opts is optional
    opts = opts || {};
    // opts can be an object or json
    if( typeof opts === "object" ){
	// make a copy so we can modify it
	opts = JS9.extend(true, {}, opts);
    } else if( typeof opts === "string" ){
	// convert json to object
	try{ opts = JSON.parse(opts); }
	catch(e){ opts = {}; }
    }
    // default window type
    type = type || "light";
    //  default base id
    idbase = `${type}win`;
    // create the specified type of window
    switch(type){
    case "light":
        // use supplied id or make a reasonably unique id for the JS9 elements
	if( opts.id ){
	    id = opts.id;
	    delete opts.id;
	} else {
            id = idbase + JS9.uniqueID();
	}
        // and a second one for controlling the light window
        did = `d${id}`;
	// inner html housing JS9 display, etc.
	if( html ){
	    // html specified: def window opts is standard light image window
	    winopts = winopts || lopts.imageWin;
	} else {
	    // no html specified: use originating display setup, if possible,
	    // otherwise use defaults, and always use default window opts
	    xobj = getHTML(id, opts, lopts.imageWin);
	    // always use returned html (there being no other option)
	    html = xobj.html;
	    // but only use the new winopts if no winopts was specified
            winopts = winopts || xobj.winopts;
	}
	// nice title
	title = sprintf(`JS9 Display${JS9.IDFMT}`, id);
        // create the light window
        winid = JS9.lightWin(did, "inline", html, title, winopts);
	// set up display and load image
	display = lightLoad(file, opts);
	// on window close, we need to deal with the displayed images
	winid.onclose = () => {
	    return lightClose(display);
	};
	// return the id
	return id;
    case "new":
        // use supplied id or make a reasonably unique id for the JS9 elements
	if( opts.id ){
	    id = opts.id;
	    delete opts.id;
	} else {
            id = idbase + JS9.uniqueID();
	}
	// window opts
	winopts = winopts || `width=${JS9.globalOpts.newWindowWidth}, height=${ JS9.globalOpts.newWindowHeight}`;
        // get our own file's header for css and js files
        // if page is generated on the server side, hardwire ...
        // if JS9 is not installed, hardwire ...
        head = document.getElementsByTagName("head")[0].innerHTML;
        // but why doesn't the returned header contain the js9 js file??
	// umm... it seems to have it, at least FF does as of 8/25/15 ...
	if( !head.match(/src=["'].*js9\.js/)         &&
	    !head.match(/src=["'].*js9\.min\.js/)    &&
	    !head.match(/src=["'].*js9-viewer\.js/)  &&
	    !head.match(/src=["'].*viewer\.js/) ){
            head += '<script type="text/javascript" src="viewer.js"></script>';
	}
        // make a body containing the JS9 elements and the preload call
        body = html || getHTML(id, opts);
        // combine head and body into a full html file
        html = `<html><head>${head}</head><body`;
	if( file ){
            html += sprintf(" onload='JS9.Preload(\"%s\",%s);'",
			    file, JSON.stringify(opts));
	}
        html += `>${body}</body></html>\n`;
	// open the new window
	win = window.open(initialURL, id, winopts);
	if( !win ){
	    JS9.error("could not create window (check your pop-up blockers)");
	    return;
	}
	if( win.document ){
            // open it (not strictly necessary but ...)
            win.document.open();
            // overwrite the doc with our html
            win.document.write(html);
            // must close!
            win.document.close();
	} else if( win.postMessage ){
	    JS9.error("LoadWindow('new') is disabled on the Desktop for security reasons");
	} else {
	    JS9.error("no method available for drawing image into window");
	}
	// return the id
	return id;
    }
});

// load a link using back-end server as a proxy
JS9.mkPublic("LoadProxy", function(...args){
    let f, disp, url, opts, oname;
    const obj = JS9.parsePublicArgs(args);
    url = obj.argv[0];
    opts = obj.argv[1];
    if( !JS9.globalOpts.loadProxy ){
	JS9.error("proxy load not available for server");
    }
    if( !JS9.globalOpts.workDir ){
	JS9.error("proxy load requires a temp workDir for server");
    }
    if( !url ){
	JS9.error("no url specified for proxy load");
    }
    url = url.trim();
    if( url.match(/dropbox\.com/) ){
	// http://stackoverflow.com/questions/20757891/cross-origin-image-load-from-cross-enabled-site-is-denied
	url = url.replace("www.dropbox.com", "dl.dropboxusercontent.com");
	// https://blogs.dropbox.com/developers/2013/08/programmatically-download-content-from-share-links/
	url = `${url.replace('?dl=0', '')}?raw=1`;
    } else if( url.match(/drive\.google\.com/) ){
	url=url.replace(/\/file\/d\/(\w+)\/\w+\?usp=sharing/,
			"/uc?export=download&id=$1");
    }
    if( obj.display ){
	disp = JS9.lookupDisplay(obj.display);
    }
    // opts is optional
    opts = opts || {};
    // opts can be an object or json
    if( typeof opts === "object" ){
	// make a copy so we can modify it
	opts = JS9.extend(true, {}, opts);
    } else if( typeof opts === "string" ){
	// convert json to object
	try{ opts = JSON.parse(opts); }
	catch(e){ opts = {}; }
    }
    // output filename specified?
    if( opts.ofile ){
	oname = opts.ofile;
	delete opts.ofile;
    } else {
	oname = "";
    }
    JS9.waiting(true, disp);
    JS9.Send("loadproxy", {"cmd": `js9Xeq loadproxy ${url} ${oname}`}, (r) => {
        let robj, files, pf;
	// return type can be string or object
	if( typeof r === "object" ){
	    // object from node.js
	    robj = r;
	} else {
	    // string from cgi
	    if( r.search(JS9.analOpts.epattern) >=0 ){
		robj = {stderr: r};
	    } else {
		robj = {stdout: r};
	    }
	}
	robj.errcode = robj.errcode || 0;
	if( robj.stderr ){
	    JS9.error(robj.stderr);
	} else if( robj.stdout ){
	    // output is file and possibly parentFile
	    files = robj.stdout.split(/\s+/);
	    if( files && files[0] ){
		f = JS9.cleanPath(files[0]);
		// proxy file
		opts.proxyFile = f;
		// relative path: add install dir prefix
		if( f.charAt(0) !== "/" ){
		    f = JS9.InstallDir(f);
		}
		if( files[1] ){
		    pf = JS9.cleanPath(files[1]);
		    opts.parentFile = pf;
		    opts.proxyParent = pf;
		}
		    // preserve proxy path as-is
		    opts.fixpath = false;
		// save original url
		opts.proxyURL = url;
		// load new file
		JS9.Load(f, opts, {display: obj.display});
	    }
	} else {
	    JS9.error("internal error: no return from load proxy command");
	}
    });
});

// save array of files to preload or preload immediately,
// depending on the state of processing
JS9.mkPublic("Preload", function(...args){
    let i, j, mode, urlexp, func, arg1;
    let emsg = "";
    let pobj = null;
    let dobj = null;
    let alen = args.length;
    const oalerts = JS9.globalOpts.alerts;
    const obj = JS9.parsePublicArgs(args);
    const baseexp = JS9.URLEXP;
    const sesexp = /\.ses$/;
    const cmapexp = /\.cmap$/;
    arg1 = obj.argv[0];
    // for socketio and loadProxy, support LoadProxy calls
    if( JS9.globalOpts.loadProxy && JS9.helper.baseurl ){
	urlexp = new RegExp(`^${JS9.helper.baseurl}`);
    }
    if( obj.display ){
	dobj = {display: obj.display};
	alen = alen - 1;
    }
    // check the state of processing
    switch(alen){
    case 0:
	// if we are connected and have previously saved images, load now
	// if connected is undefined, we have no back-end and we do our best
	if( ((JS9.helper.connected === null) || JS9.helper.connected) &&
	    JS9.fits.name && (JS9.preloads.length > 0) ){
	    mode = 2;
	} else {
	    // do nothing
	    mode = 3;
	}
	break;
    case 1:
	// boolean => we are ready to load
	if( typeof arg1 === "boolean" ){
	    // if we have previously saved images, load now
	    if( arg1 && (JS9.preloads.length > 0) ){
		mode = 2;
	    } else {
		// do nothing
		mode = 3;
	    }
	} else {
	    // image args => if we are connected,  we can load the images now
	    if( ((JS9.helper.connected === null) || JS9.helper.connected) &&
	        JS9.fits.name ){
		mode = 1;
	    } else {
		// save images and wait
		mode = 0;
	    }
	}
	break;
    default:
	// image args => if we already are connected, we can load the images now
	if( ((JS9.helper.connected === null) || JS9.helper.connected) &&
	    JS9.fits.name ){
	    mode = 1;
	} else {
	    // save images and wait
	    mode = 0;
	}
	break;
    }
    switch(mode){
    case 0:
	// save preload image(s) for later
	for(i=0; i<alen; i++){
	    j = i + 1;
	    if( (j < alen) && (typeof args[j] === "object") ){
		pobj = JS9.extend(true, {}, args[j]);
		JS9.preloads.push([args[i], pobj, dobj]);
		i++;
	    } else if( (j < alen) && args[j].startsWith("{") ){
		try{ pobj = JSON.parse(args[j]); }
		catch(e){ pobj = null; }
		JS9.preloads.push([args[i], pobj, dobj]);
		i++;
	    } else {
		JS9.preloads.push([args[i], null, dobj]);
	    }
	}
	break;
    case 1:
	// preload the image(s) now from args
	JS9.globalOpts.alerts = false;
	for(i=0; i<alen; i++){
	    if( urlexp                      &&
		args[i].match(baseexp) &&
		!args[i].match(urlexp) ){
		func = JS9.LoadProxy;
	    } else if( args[i].match(sesexp) ){
		func = JS9.LoadSession;
	    } else if( args[i].match(cmapexp) ){
		func = JS9.LoadColormap;
	    } else {
		func = JS9.Load;
	    }
	    j = i + 1;
	    if( (j < alen) && (typeof args[j] === "object") ){
		if( func === JS9.Load || func === JS9.LoadProxy ){
		    JS9.preloadwaiting.push(
			{id: JS9.cleanPath(args[i]), loaded: false}
		    );
		}
		try{
		    if( dobj ){
			func(args[i], args[j], dobj);
		    } else {
			func(args[i], args[j]);
		    }
		}
		catch(e){ emsg = `${emsg} ${args[i]}`;}
		i++;
	    } else if( (j < alen) && args[j].startsWith("{") ){
		try{ pobj = JSON.parse(args[j]); }
		catch(e){ pobj = null; }
		if( func === JS9.Load || func === JS9.LoadProxy ){
		    JS9.preloadwaiting.push(
			{id: JS9.cleanPath(args[i]), loaded: false}
		    );
		}
		try{
		    if( dobj ){
			func(args[i], pobj, dobj);
		    } else {
			func(args[i], pobj);
		    }
		}
		catch(e){ emsg = `${emsg} ${args[i]}`;}
		i++;
	    } else {
		if( func === JS9.Load || func === JS9.LoadProxy ){
		    JS9.preloadwaiting.push(
			{id: JS9.cleanPath(args[i]), loaded: false}
		    );
		}
		try{
		    if( dobj ){
			func(args[i], null, dobj);
		    } else {
			func(args[i], null);
		    }
		}
		catch(e){ emsg = `${emsg} ${args[i]}`;}
	    }
	}
	JS9.globalOpts.alerts = oalerts;
	if( emsg ){ JS9.error(`could not preload image(s): ${emsg}`);}
	break;
    case 2:
	// preload the image(s) now from saved args
	JS9.globalOpts.alerts = false;
	for(i=0; i<JS9.preloads.length; i++){
	    if( urlexp                            &&
		JS9.preloads[i][0].match(baseexp) &&
		!JS9.preloads[i][0].match(urlexp) ){
		func = JS9.LoadProxy;
	    } else if( JS9.preloads[i][0].match(sesexp) ){
		func = JS9.LoadSession;
	    } else if( JS9.preloads[i][0].match(cmapexp) ){
		func = JS9.LoadColormap;
	    } else {
		func = JS9.Load;
	    }
	    if( func === JS9.Load || func === JS9.LoadProxy ){
		JS9.preloadwaiting.push(
		    {id: JS9.cleanPath(JS9.cleanPath(JS9.preloads[i][0])),
		     loaded: false}
		);
	    }
	    try{
		if( JS9.preloads[i][2] ){
		    func(JS9.preloads[i][0], JS9.preloads[i][1],
			 JS9.preloads[i][2]);
		} else {
		    func(JS9.preloads[i][0], JS9.preloads[i][1]);
		}
	    }
	    catch(e){ emsg = `${emsg} ${JS9.preloads[i][0]}`;}
	}
	JS9.globalOpts.alerts = oalerts;
	if( emsg ){ JS9.error(`could not preload image(s): ${emsg}`);}
	// remove saved args so we don't reload them on reconnect
	JS9.preloads = [];
	break;
    case 3:
	// do nothing
	break;
    default:
	break;
    }
});

// refresh existing image
JS9.mkPublic("RefreshImage", function(...args){
    let fits, opts;
    const obj = JS9.parsePublicArgs(args);
    const im = JS9.getImage(obj.display);
    const retry = (hdu) => {
	im.refreshImage(hdu, opts);
    };
    fits = obj.argv[0];
    opts = obj.argv[1] || {};
    if( im ){
	opts.id = im.id;
	if( fits instanceof Blob ){
	    // cleanup previous FITS heap before handling the new FITS file,
	    // or we end up with a memory leak in the runtime heap
	    if( !opts.rawid || opts.rawid === im.raw.id ){
		JS9.cleanupFITSFile(im.raw, true);
	    }
	    try{ JS9.handleFITSFile(fits, JS9.fits.options, retry); }
	    catch(e){ JS9.error("can't refresh FITS file", e); }
	} else {
	    im.refreshImage(fits, opts);
	}
    } else if( fits instanceof Blob ){
	JS9.Load(...args);
    }
});

// get specified status
JS9.mkPublic("GetStatus", function(...args){
    const obj = JS9.parsePublicArgs(args);
    const im = JS9.getImage(obj.argv[1] || obj.display);
    const stat = obj.argv[0] || "load";
    if( !obj.argv.length ){
	return ["Load", "CreateMosaic", "DisplaySection", "LoadCatalog", "LoadRegions", "ReprojectData", "RotateData", "RunAnalysis"];
    }
    // if the fetch is still running or failed, return the status
    if( JS9.fetchURL.status && stat.match(/^(pre)?load$/i) ){
	return JS9.fetchURL.status;
    }
    // return status for specified image
    if( im ){
	return im.getStatus(stat);
    }
    return "none";
});

// get status of a Load ("complete" means ... complete)
JS9.mkPublic("GetLoadStatus", function(...args){
    return JS9.GetStatus("load", ...args);
});

// http://stackoverflow.com/questions/400212/how-do-i-copy-to-the-clipboard-in-javascript
JS9.mkPublic("CopyToClipboard", function(text, im){
    let msg, successful, textArea;
    const scroll = JS9.getDocumentScroll();
    const x = scroll.x, y = scroll.y;
    // save text for pseudo-pasting
    JS9.clipboard = text;
    // tmp textarea which from which the selection will be copied
    textArea = document.createElement("textarea");
    //
    // *** styling is an extra step which is likely not required. ***
    //
    // Why is it here? To ensure:
    // 1. the element is able to have focus and selection.
    // 2. if element was to flash render it has minimal visual impact.
    // 3. less flakyness with selection and copying which **might** occur if
    //    the textarea element is not visible.
    //
    // The likelihood is the element won't even render, not even a flash,
    // so some of these are just precautions. However in IE the element
    // is visible whilst the popup box asking the user for permission for
    // the web page to copy to the clipboard.
    //
    // Place in top-left corner of screen regardless of scroll position.
    textArea.style.position = "fixed";
    textArea.style.top = 0;
    textArea.style.left = 0;
    // Ensure it has a small width and height. Setting to 1px / 1em
    // doesn't work as it gives a negative w/h on some browsers.
    textArea.style.width = "2em";
    textArea.style.height = "2em";
    // We don't need padding, reducing the size if it does flash render.
    textArea.style.padding = 0;
    // Clean up any borders.
    textArea.style.border = "none";
    textArea.style.outline = "none";
    textArea.style.boxShadow = "none";
    // Avoid flash of white box if rendered for any reason.
    textArea.style.background = "transparent";
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
	successful = document.execCommand("copy");
	if( successful ){
	    msg = "OK";
	} else {
	    msg = "MANUAL";
	    if( JS9.BROWSER[2].match(/Mac/) ){
		window.prompt("copy to clipboard: Cmd+C", text);
	    } else {
		window.prompt("copy to clipboard: Ctrl+C", text);
	    }
	}
    } catch (err){
	msg = "ERROR";
    }
    document.body.removeChild(textArea);
    // refocus on display, but undo any scrolling
    // (otherwise, the next keydown has no effect)
    if( im && im.display ){
	im.display.displayConjq.focus();
	window.scrollTo(x, y);
    }
    return msg;
});

JS9.mkPublic("CopyFromClipboard", function(){
    return JS9.clipboard || "";
});

// bring up the file dialog box and open selected FITS file(s)
JS9.mkPublic("OpenFileMenu", function(...args){
    const obj = JS9.parsePublicArgs(args);
    const display = JS9.lookupDisplay(obj.display);
    const el = display ? document.getElementById(`openLocalLoad-${display.id}`) : null;
    if( el ){
	el.click();
    }
});

// bring up the file dialog box and open selected region files(s)
JS9.mkPublic("OpenRegionsMenu", function(...args){
    const obj = JS9.parsePublicArgs(args);
    const display = JS9.lookupDisplay(obj.display);
    const el = display ? document.getElementById(`openLocalLoadRegions-${display.id}`) : null;
    if( el ){
	el.click();
    }
});

// bring up the file dialog box and load selected session files(s)
JS9.mkPublic("OpenSessionMenu", function(...args){
    const obj = JS9.parsePublicArgs(args);
    const display = JS9.lookupDisplay(obj.display);
    const el = display ? document.getElementById(`openLocalLoadSession-${display.id}`) : null;
    if( el ){
	el.click();
    }
});

// bring up the file dialog box and open selected catalog file
JS9.mkPublic("OpenCatalogsMenu", function(...args){
    const obj = JS9.parsePublicArgs(args);
    const display = JS9.lookupDisplay(obj.display);
    const el = display ? document.getElementById(`openLocalLoadCatalog-${display.id}`) : null;
    if( el ){
	el.click();
    }
});

// bring up the file dialog box and load selected colormap file(s)
JS9.mkPublic("OpenColormapMenu", function(...args){
    const obj = JS9.parsePublicArgs(args);
    const display = JS9.lookupDisplay(obj.display);
    const el = display ? document.getElementById(`openLocalLoadColormap-${display.id}`) : null;
    if( el ){
	el.click();
    }
});

// save a colormap to disk
JS9.mkPublic("SaveColormap", function(...args){
    let fname, im, cobj, s, blob, arg1, arg2;
    const obj = JS9.parsePublicArgs(args);
    const convertjson = (arg1) => {
	let s = arg1;
	if( typeof arg1 === "string" ){
	    try{ s = JSON.parse(arg1); }
	    catch(e){ /* empty */ }
	}
	return s;
    };
    const getarr = (arr) => {
	let i, c;
	const cobj = [];
	for(i=0; i<arr.length; i++){
	    c = JS9.lookupColormap(arr[i]);
	    if( c ){
		c = JS9.extend(true, {}, c);
		delete c.type;
		cobj.push(c);
	    }
	}
	if( cobj.length === 1 ){
	    return cobj[0];
	}
	return cobj;
    };
    arg1 = obj.argv[0];
    arg2 = obj.argv[1];
    if( {}.hasOwnProperty.call(window, "saveAs") ){
	// check for json strings in arg1 and/or arg2
	im = JS9.getImage(obj.display);
	if( im ){
	    // convert json to object
	    arg1 = convertjson(arg1);
	    arg2 = convertjson(arg2);
	    if( !arg1 ){
		fname = "js9.cmap";
		cobj = JS9.extend(true, {}, im.cmapObj);
		delete cobj.type;
	    } else if( typeof arg1 === "string" ){
		fname = arg1;
		if( typeof arg2 === "string" ){
		    cobj = getarr([arg2]);
		} else if( JS9.isArray(arg2) ){
		    cobj = getarr(arg2);
		} else {
		    cobj = JS9.extend(true, {}, im.cmapObj);
		    delete cobj.type;
		}
	    } else if( JS9.isArray(arg1) ){
		fname = "js9.cmap";
		cobj = getarr(arg1);
	    }
	    // convert to json
	    s = JSON.stringify(cobj);
	    // then convert json to blob
	    blob = new Blob([s], {type: "text/plain"});
	    // save to disk
	    JS9.saveAs(blob, fname);
	}
    } else {
	JS9.error("no saveAs() available to save colormap");
    }
    return fname;
});

// call the image constructor as a func
JS9.mkPublic("NewFitsImage", function(...args){
    let func, disp, im, hdu, opts;
    const obj = JS9.parsePublicArgs(args);
    hdu = obj.argv[0];
    opts = obj.argv[1] || {};
    disp = JS9.lookupDisplay(obj.display || opts.display || JS9.DEFID);
    if( opts.refresh ){
	if( typeof opts.refresh === "object" ){
	    // use passed image handle
	    im = opts.refresh;
	} else if( disp && disp.image ){
	    // use current image
	    im = disp.image;
	}
	if( im ){
	    // refresh the image
	    if( opts.onload ){
		opts.onrefresh = opts.onload;
		delete opts.onload;
	    }
	    im.refreshImage(hdu, opts);
	} else {
	    // fallback if we have no image: make a new image
	    if( opts.onload ){
		func = opts.onload;
	    }
	    JS9.checkNew(new JS9.Image(hdu, opts, func));
	}
    } else {
	// make a new image
	if( opts.onload ){
	    func = opts.onload;
	}
	JS9.checkNew(new JS9.Image(hdu, opts, func));
    }
});

// return the image object for the specified image name or the display id
JS9.mkPublic("GetImage", function(...args){
    const obj = JS9.parsePublicArgs(args);
    let id = obj.argv[0];
    if( typeof id !== "string" ){
	id = obj.display;
    }
    return JS9.getImage(id);
});

// return the image data and auxiliary info for the current image
JS9.mkPublic("GetImageData", function(...args){
    const obj = JS9.parsePublicArgs(args);
    const im = JS9.getImage(obj.display);
    let dflag = obj.argv[0];
    // return data and auxiliary info
    if( im ){
	return im.getImageData(dflag);
    }
    return null;
});

// return the image data and aux info for all images loaded into this display
JS9.mkPublic("GetDisplayData", function(...args){
    let i, id, im, dflag;
    const imarr = [];
    const obj = JS9.parsePublicArgs(args);
    id = obj.display || JS9.displays[0].id;
    dflag = obj.argv[0];
    for(i=0; i<JS9.images.length; i++){
	im = JS9.images[i];
	if( im.display.id === id ){
	    imarr.push(im.getImageData(dflag));
	}
    }
    return imarr;
});

// return the FITS header as a string
JS9.mkPublic("GetFITSHeader", function(...args){
    let flag;
    let s = "";
    const obj = JS9.parsePublicArgs(args);
    const im = JS9.getImage(obj.display);
    flag = obj.argv[0];
    if( im && im.raw ){
	s = JS9.raw2FITS(im.raw, {addcr: flag});
    }
    return s;
});

// turn on and off blending, redisplaying image
JS9.mkPublic("BlendDisplay", function(...args){
    let i, im, mode;
    const imarr = [];
    const obj = JS9.parsePublicArgs(args);
    const id = obj.display || JS9.DEFID;
    const disp = JS9.lookupDisplay(id);
    mode = obj.argv[0];
    if( !disp ){
	JS9.error(`no JS9 display found: ${id}`);
    }
    if( (mode === undefined) || (mode === "mode") ){
	return disp.blendMode;
    }
    if( mode === "list" ){
	for(i=0; i<JS9.images.length; i++){
	    im = JS9.images[i];
	    if( (im.display.id === id) && im.blend.active ){
		imarr.push(im.id);
	    }
	}
	return imarr;
    }
    if( mode === "reset" ){
	for(i=0; i<JS9.images.length; i++){
	    im = JS9.images[i];
	    if( (im.display.id === id) && im.blend.active ){
		im.blendImage(false);
	    }
	}
	mode = false;
    }
    if( mode === "true" ){
	mode = true;
    } else if( mode === "false" ){
	mode = false;
    }
    // it's true or false
    disp.blendMode = !!mode;
    if( disp.image ){
	// trigger option redisplay
	disp.image.xeqPlugins("image", "ondisplayblend");
	// redisplay image
	disp.image.displayImage();
    }
    return disp.blendMode;
});

// load auxiliary file, if available
// s is the aux file type
JS9.mkPublic("LoadAuxFile", function(...args){
    let file, func;
    const obj = JS9.parsePublicArgs(args);
    const im = JS9.getImage(obj.display);
    file = obj.argv[0];
    func = obj.argv[1];
    if( im ){
	im.loadAuxFile(file, func);
    } else {
	JS9.error(`could not find image for aux file: ${file}`);
    }
});

// run analysis from a Web page form
JS9.mkPublic("SubmitAnalysis", function(...args){
    let topjq, formjq, dispid, im, errstr, el, aname, func, tobj;
    const a = JS9.lightOpts[JS9.LIGHTWIN];
    const obj = JS9.parsePublicArgs(args);
    el = obj.argv[0];
    aname = obj.argv[1];
    func = obj.argv[2];
    // if analysis name was not passed, it was saved in the light window div
    if( aname ){
	dispid =  JS9.lookupDisplay(obj.display).id;
    } else {
	topjq = el.closest(a.top);
	aname = topjq ? topjq.dataset.aname : null;
	dispid = topjq ? topjq.dataset.dispid : null;
    }
    // make sure we have a task name
    if( !aname ){
	errstr = "internal error: could not find analysis task name";
    } else if( dispid ){
	im = JS9.getImage(dispid);
    }
    // make sure we have an image and run the analysis
    if( im ){
	formjq = el.closest("form");
	// make sure unchecked elements are in the array
	try{
	    tobj = [];
	    if( formjq ){
		Array.from(new FormData(formjq).entries()).forEach(([name, value]) => {
		    tobj.push({name, value});
		});
		formjq.querySelectorAll("input[type=checkbox]:not(:checked)").forEach((checkbox) => {
		    tobj.push({name: checkbox.name, value: "false"});
		});
	    }
	}
	catch(e){ tobj = null; }
	im.runAnalysis(aname, tobj, func);
    } else {
	errstr = "internal error: could not find image";
    }
    // handle errors
    if( errstr ){
	JS9.error(errstr);
    }
    // prevent form from being submitted
    return false;
});

// send a message to the back-end server
JS9.mkPublic("Send", function(msg, obj, cb){
    if( JS9.helper.connected ){
	JS9.helper.send(msg, obj, cb);
    } else {
	JS9.error("no JS9 helper available");
    }
});

// get display position from event
JS9.mkPublic("EventToDisplayPos", function(evt){
    return JS9.eventToDisplayPos(evt);
});

// convert image position to wcs (in degrees)
// NB: input image coordinates are 1-indexed
JS9.mkPublic("PixToWCS", function(...args){
    let s, arr, arg0, ix, iy;
    let x = 1.0;
    const obj = JS9.parsePublicArgs(args);
    const im = JS9.getImage(obj.display);
    if( im ){
	arg0 = obj.argv[0];
	if( typeof arg0 === "object" &&
	    JS9.notNull(arg0.x) && JS9.notNull(arg0.y) ){
	    ix = arg0.x;
	    iy = arg0.y;
	} else {
	    ix = obj.argv[0];
	    iy = obj.argv[1];
	}
	if( !JS9.isNumber(ix) || !JS9.isNumber(iy) ){
	    JS9.error("invalid input for PixToWCS");
	}
	if( im.validWCS() ){
	    s = JS9.pix2wcs(im.raw.wcs, ix, iy).trim();
	    arr = s.split(/ +/);
	    if( (im.params.wcsunits === "sexagesimal") &&
		(im.params.wcssys !== "galactic" )     &&
		(im.params.wcssys !== "ecliptic" )     ){
		x = 15.0;
	    }
	    return {ra: JS9.saostrtod(arr[0]) * x,
		    dec: JS9.saostrtod(arr[1]),
		    sys: arr[2],
		    str: s};
	}
    }
});
// backwards compatibility
JS9.Pix2WCS = JS9.PixToWCS;

// convert wcs to image position
// NB: returned image coordinates are 1-indexed
JS9.mkPublic("WCSToPix", function(...args){
    let str, x, y, arr, arg0, ra, dec;
    const obj = JS9.parsePublicArgs(args);
    const im = JS9.getImage(obj.display);
    if( im ){
	arg0 = obj.argv[0];
	if( typeof arg0 === "object" &&
	    JS9.notNull(arg0.ra) && JS9.notNull(arg0.dec) ){
	    ra = arg0.ra;
	    dec = arg0.dec;
	} else {
	    ra = obj.argv[0];
	    dec = obj.argv[1];
	}
	if( !JS9.isNumber(ra) || !JS9.isNumber(dec) ){
	    JS9.error("invalid input for WCSToPix");
	}
	if( im.validWCS() ){
	    arr = JS9.wcs2pix(im.raw.wcs, ra, dec).trim().split(/ +/);
	    x = parseFloat(arr[0]);
	    y = parseFloat(arr[1]);
	    str = sprintf("%f %f", x, y);
	    return {x, y, str};
	}
    }
    return null;
});
// backwards compatibility
JS9.WCS2Pix = JS9.WCSToPix;

// initialize a new shape layer
JS9.mkPublic("NewShapeLayer", function(...args){
    let layer, opts;
    const obj = JS9.parsePublicArgs(args);
    const im = JS9.getImage(obj.display);
    layer = obj.argv[0];
    opts = obj.argv[1];
    if( im ){
	return im.display.newShapeLayer(layer, opts);
    }
    return null;
});

// add a region
// eslint-disable-next-line no-unused-vars
JS9.mkPublic("AddRegions", function(...args){
    let region, opts;
    const obj = JS9.parsePublicArgs(args);
    const im = JS9.getImage(obj.display);
    region = obj.argv[0];
    opts = obj.argv[1];
    if( im ){
	if( !region ){
	    JS9.error("no region specified for AddRegions");
	}
	return im.addShapes("regions", region, opts);
    }
    return null;
});

// remove one or more regions
JS9.mkPublic("RemoveRegions", function(...args){
    const obj = JS9.parsePublicArgs(args);
    const im = JS9.getImage(obj.display);
    let region = obj.argv[0];
    if( im ){
	im.removeShapes("regions", region);
	im.display.clearMessage("regions");
	return JS9.globalOpts.quietReturn ? "" : "OK";
    }
    return null;
});

// copy one or more regions
JS9.mkPublic("CopyRegions", function(...args){
    const obj = JS9.parsePublicArgs(args);
    const im = JS9.getImage(obj.display);
    let to = obj.argv[0];
    let region = obj.argv[1];
    if( im ){
	im.copyRegions(to, region);
	return JS9.globalOpts.quietReturn ? "" : "OK";
    }
    return null;
});

// get one or more regions
// eslint-disable-next-line no-unused-vars
JS9.mkPublic("GetRegions", function(...args){
    const obj = JS9.parsePublicArgs(args);
    const im = JS9.getImage(obj.display);
    if( im ){
	obj.argv.unshift("regions");
	return im.getShapes(...obj.argv);
    }
    return null;
});

// list regions
JS9.mkPublic("ListRegions", function(...args){
    let region, opts;
    const obj = JS9.parsePublicArgs(args);
    const im = JS9.getImage(obj.display);
    if( im ){
	region = obj.argv[0] || "all";
	opts = obj.argv[1] || {mode: 2};
	return im.listRegions(region, opts, opts.layer);
    }
    return null;
});

// list groups
JS9.mkPublic("ListGroups", function(...args){
    let region, opts;
    const obj = JS9.parsePublicArgs(args);
    const im = JS9.getImage(obj.display);
    if( im ){
	region = obj.argv[0] || "all";
	opts = obj.argv[1] || {};
	return im.listGroups(region, opts, opts.layer);
    }
    return null;
});

// edit currently selected region or multi-selected regions
JS9.mkPublic("EditRegions", function(...args){
    let layer, ao;
    const obj = JS9.parsePublicArgs(args);
    const im = JS9.getImage(obj.display);
    if( im ){
	layer = im.layers.regions;
	if( layer ){
	    ao = layer.canvas.getActiveObject();
	    if( ao && ao.type !== "activeSelection" ){
		// no active selection, edit this region
		im.displayRegionsForm(ao);
	    } else {
		// active selection or no regions: multi
		im.displayRegionsForm(null, {multi: true});
	    }
	}
    }
    return null;
});

// change one or more regions
JS9.mkPublic("ChangeRegions", function(...args){
    const obj = JS9.parsePublicArgs(args);
    const im = JS9.getImage(obj.display);
    let region = obj.argv[0];
    let opts = obj.argv[1];
    if( im ){
	im.changeShapes("regions", region, opts);
    }
    return null;
});

// save regions to disk
// eslint-disable-next-line no-unused-vars
JS9.mkPublic("SaveRegions", function(...args){
    const obj = JS9.parsePublicArgs(args);
    const im = JS9.getImage(obj.display);
    let file = obj.argv[0];
    let which = obj.argv[1];
    let layer = obj.argv[2];
    if( im ){
	if( obj.argv.length === 1 && file === "dialogbox" ){
	    im.displayRegionsForm(null, {type: "save"});
	} else {
	    return im.saveRegions(file, which, layer);
	}
    }
    return null;
});

// select one or more regions
// eslint-disable-next-line no-unused-vars
JS9.mkPublic("SelectRegions", function(...args){
    let region, opts;
    const obj = JS9.parsePublicArgs(args);
    const im = JS9.getImage(obj.display);
    region = obj.argv[0];
    opts = obj.argv[1];
    if( im ){
	return im.selectShapes("regions", region, opts);
    }
    return null;
});

// unselect one or more regions
// eslint-disable-next-line no-unused-vars
JS9.mkPublic("UnselectRegions", function(...args){
    let region, opts;
    const obj = JS9.parsePublicArgs(args);
    const im = JS9.getImage(obj.display);
    region = obj.argv[0];
    opts = obj.argv[1];
    if( im ){
	return im.unselectShapes("regions", region, opts);
    }
    return null;
});

// group one or more regions
// eslint-disable-next-line no-unused-vars
JS9.mkPublic("GroupRegions", function(...args){
    let region, opts;
    const obj = JS9.parsePublicArgs(args);
    const im = JS9.getImage(obj.display);
    region = obj.argv[0];
    opts = obj.argv[1];
    if( im ){
	return im.groupShapes("regions", region, opts);
    }
    return null;
});

// ungroup one or more regions
// eslint-disable-next-line no-unused-vars
JS9.mkPublic("UngroupRegions", function(...args){
    let region, opts;
    const obj = JS9.parsePublicArgs(args);
    const im = JS9.getImage(obj.display);
    region = obj.argv[0];
    opts = obj.argv[1];
    if( im ){
	return im.ungroupShapes("regions", region, opts);
    }
    return null;
});

// edit region tags, e.g. add source, remove background
// e.g. JS9.ChangeRegionTags("selected", "source", "background");
JS9.mkPublic("ChangeRegionTags", function(...args){
    const obj = JS9.parsePublicArgs(args);
    const im = JS9.getImage(obj.display);
    let which = obj.argv[0];
    let add1  = obj.argv[1];
    let rem1  = obj.argv[2];
    if( im ){
	return im.changeRegionTags(which, add1, rem1);
    }
    return null;
});

// toggle region tags, e.g. source <-> background, include <-> exclude
// e.g. JS9.ToggleRegionTags("selected", "source", "background");
JS9.mkPublic("ToggleRegionTags", function(...args){
    const obj = JS9.parsePublicArgs(args);
    const im = JS9.getImage(obj.display);
    let which = obj.argv[0];
    let x1 = obj.argv[1];
    let x2 = obj.argv[2];
    if( im ){
	return im.toggleRegionTags(which, x1, x2);
    }
    return null;
});

// unremove previously removed regions
// eslint-disable-next-line no-unused-vars
JS9.mkPublic("UnremoveRegions", function(...args){
    const obj = JS9.parsePublicArgs(args);
    const im = JS9.getImage(obj.display);
    if( im ){
	return im.unremoveRegions();
    }
    return null;
});

// load a DS9/funtools regions file
JS9.mkPublic("LoadRegions", function(...args){
    let s, reader, file, opts;
    const obj = JS9.parsePublicArgs(args);
    const im = JS9.getImage(obj.display);
    const addregions = (reg, ropts) => {
	if( ropts && ropts.display !== undefined ){ delete ropts.display; }
	// add the regions
	im.addShapes("regions", reg, ropts);
	// set status
	im.setStatus("loadRegions", "complete");
	// onload callback, if necessary
	if( opts && opts.onload ){
	    try{ JS9.xeqByName(opts.onload, window, im); }
	    catch(e){ JS9.error("in regions onload callback", e, false); }
	}
    };
    file = obj.argv[0];
    opts = obj.argv[1];
    // sanity check
    if( !file ){
	JS9.error("JS9.LoadRegions: no file specified for regions load");
    }
    // no action if no current image
    if( !im ){
	return;
    }
    // set status
    im.setStatus("loadRegions", "processing");
    // opts is optional
    opts = opts || {};
    // opts can be an object or json
    if( typeof opts === "object" ){
	// make a copy so we can modify it
	opts = JS9.extend(true, {}, opts);
    } else if( typeof opts === "string" ){
	// convert json to object
	try{ opts = JSON.parse(opts); }
	catch(e){ opts = {}; }
    }
    // convert blob to string
    if( typeof file === "object" ){
	s = file.path || file.name;
	if( s ){
	    opts.file = s.split("/").reverse()[0];
	}
	// file reader object
	reader = new FileReader();
	reader.onload = (ev) => {
	    addregions(ev.target.result, opts);
	};
	reader.readAsText(file);
    } else if( typeof file === "string" ){
	opts.responseType = "text";
	file = JS9.fixPath(file, opts);
	opts.file = file.split("/").reverse()[0];
	JS9.fetchURL(null, file, opts, addregions);
    } else {
	// oops!
	JS9.error(`unknown file type for LoadRegions: ${typeof file}`);
    }
});

// construct directory starting with where JS9 is installed
JS9.mkPublic("InstallDir", function(dir){
    // sanity check
    if( !dir ){ return ""; }
    // add path to install directory, clean path a little bit
    return JS9.cleanPath(JS9.INSTALLDIR + dir);
});

// add new display divs and/or new plugins
JS9.mkPublic("AddDivs", function(...args){
    let i, j, div, dexist, id;
    const obj = JS9.parsePublicArgs(args);
    // process all divs
    for(i=0; i< obj.argv.length; i++){
	// get next id
	id = obj.argv[i];
	// sanity check
	if( !id ){
	    continue;
	}
	// make sure div exists ...
	if( !document.getElementById(id) ){
	    if( JS9.DEBUG ){
		JS9.log("warning: can't find div, skipping AddDivs(): %s", id);
	    }
	    continue;
	}
	// ... but has not already been added
	for(j=0; j<JS9.displays.length; j++){
	    div = JS9.displays[j];
	    if( div.id === id ){
		dexist = true;
		break;
	    }
	}
	// add div as a new display
	if( !dexist ){
	    // add this display to array of displays
	    JS9.checkNew(new JS9.Display(id));
	    // tell helper about display
	    JS9.helper.send("addDisplay", {"display": id});
	} else if( JS9.DEBUG ){
	    JS9.log("warning: div already added, skipping AddDivs(): %s", id);
	}
    }
    // re-instantiate plugins
    JS9.instantiatePlugins();
});

// instantiate plugins when startup ordering fires before scripts are loaded,
// e.g., Require.js
JS9.mkPublic("InstantiatePlugins", function(){
    JS9.instantiatePlugins();
});

// change the size of a display
JS9.mkPublic("ResizeDisplay", function(...args){
    let got, display;
    const obj = JS9.parsePublicArgs(args);
    // special handling of first string arg:
    // might be display name or might be resize params
    if( typeof obj.argv[0] === "string" &&
	!JS9.isNumber(obj.argv[0])      &&
	obj.argv[0] !== "full"          &&
	obj.argv[0] !== "reset"         &&
	obj.argv[0] !== "image"         ){
	display = JS9.lookupDisplay(obj.argv[0] || obj.display);
	obj.argv.splice(0,1);
    } else {
	display = JS9.lookupDisplay(obj.display);
    }
    if( !display ){
	JS9.error("invalid display for resize");
    }
    got = display.resize(...obj.argv);
    if( got === display ){
	return JS9.globalOpts.quietReturn ? "" : "OK";
    }
    return got;
});

// select (or de-select) a display as the current display
JS9.mkPublic("SelectDisplay", function(...args){
    const obj = JS9.parsePublicArgs(args);
    const display = JS9.lookupDisplay(obj.argv[0] || obj.display);
    if( !display ){
	JS9.error("invalid display for select");
    }
    if( !{}.hasOwnProperty.call(JS9, "Menubar") ){
	JS9.error("Menubar is required for display selection");
    }
    JS9.Menubar.onclick(display);
    return;
});

// gather images from other displays into display
JS9.mkPublic("GatherDisplay", function(...args){
    let display, did, opts;
    const obj = JS9.parsePublicArgs(args);
    switch(obj.argv.length){
    case 0:
	did = obj.display;
	opts = null;
	break;
    case 1:
	if( typeof obj.argv[0] === "object" ||
	    (typeof obj.argv[0] === "string" && obj.argv[0].charAt(0) === "{")){
	    did = obj.display;
	    opts = obj.argv[0];
	} else {
	    did = obj.argv[0] || obj.display;
	}
	break;
    default:
	did = obj.argv[0] || obj.display;
	opts = obj.argv[1];
	break;
    }
    display = JS9.lookupDisplay(did);
    if( !display ){
	JS9.error("invalid display for gather");
    }
    display.gather(opts);
    return;
});

// separate images in a display into new displays
JS9.mkPublic("SeparateDisplay", function(...args){
    let display, did, opts;
    const obj = JS9.parsePublicArgs(args);
    switch(obj.argv.length){
    case 0:
	did = obj.display;
	opts = null;
	break;
    case 1:
	if( typeof obj.argv[0] === "object" ||
	    (typeof obj.argv[0] === "string" && obj.argv[0].charAt(0) === "{")){
	    did = obj.display;
	    opts = obj.argv[0];
	} else {
	    did = obj.argv[0] || obj.display;
	}
	break;
    default:
	did = obj.argv[0] || obj.display;
	opts = obj.argv[1];
	break;
    }
    display = JS9.lookupDisplay(did);
    if( !display ){
	JS9.error("invalid display for separate");
    }
    display.separate(display, opts);
    return;
});

// center the image in a display
JS9.mkPublic("CenterDisplay", function(...args){
    const obj = JS9.parsePublicArgs(args);
    const display = JS9.lookupDisplay(obj.argv[0] || obj.display);
    if( !display ){
	JS9.error("invalid display for center");
    }
    display.center();
    return;
});

// close all images and remove this display (lightwin or grid only)
JS9.mkPublic("RemoveDisplay", function(...args){
    let idx, cel, el;
    const obj = JS9.parsePublicArgs(args);
    const display = JS9.lookupDisplay(obj.argv[0] || obj.display);
    if( !display ){
	JS9.error("invalid display for remove");
    }
    idx = JS9.inArray(display, JS9.displays);
    if( idx >= 0 ){
	cel = display.divjq.closest(".JS9GridContainer");
	el = display.divjq.closest(".JS9GridItem");
	if( cel.length > 0 && el.length > 0 ){
	    if( cel.find(".JS9GridItem").length > 1 ){
		// close all images
		JS9.CloseDisplay(display.id);
		// remove DOM element from grid
		el.remove();
		JS9.displays.splice(idx, 1);
	    } else {
		JS9.error(`can't remove last display in grid: ${display.id}`);
	    }
	} else if( display.winid && display.winid.close ){
	    // close all images
	    JS9.CloseDisplay(display.id);
	    // close light window
	    display.winid.close();
	} else {
	    JS9.error("can only remove displays within a grid or lightwins");
	}
    } else {
	JS9.error(`can't find display in display list: ${display.id}`);
    }
});

// save a session (current image, images in current display, or all images)
JS9.mkPublic("SaveSession", function(...args){
    let fname, display, disp, arg1, arg2;
    let opts = {};
    const obj = JS9.parsePublicArgs(args);
    arg1 = obj.argv[0];
    arg2 = obj.argv[1];
    // opts can be an object or json or a filename
    if( typeof arg1 === "object" ){
	// make a copy so we can modify it
	opts = JS9.extend(true, {}, arg1);
    } else if( typeof arg1 === "string" ){
	// try to convert json to object, but default to a file name
	try{ opts = JSON.parse(arg1); }
	catch(e){
	    fname = arg1;
	    // but is there a second opts arg?
	    if( arg2 ){
		if( typeof arg2 === "object" ){
		    opts = JS9.extend(true, {}, arg2);
		} else {
		    try{ opts = JSON.parse(arg2); }
		    catch(e2){ opts = {}; }
		}
	    }
	}
    }
    // default save mode
    if( !opts.mode ){
	opts.mode = "display";
    }
    // check for display
    if( obj.display ){
	display = obj.display;
    } else if( opts.display ){
	display = opts.display;
    } else {
	if( JS9.displays.length > 0 ){
	    display = JS9.displays[0].id;
	} else {
	    display = JS9.DEFID;
	}
    }
    // display we are saving
    disp = JS9.lookupDisplay(display);
    // better have an image
    if( !disp.image ){
	return null;
    }
    // default filename, if none specified
    if( !fname ){
	if( opts.mode === "display" ){
	    // generic file name for saving multiple images
	    fname = `js9-${new Date().toISOString().slice(0,10)}.ses`;
	} else {
	    // file name tied to image being saved
	    fname = `${disp.image.id}.ses`;
	}
    }
    // save the session
    return disp.image.saveSession(fname, opts);
});

// load a session file
JS9.mkPublic("LoadSession", function(...args){
    let display, reader, disp, file, opts;
    const obj = JS9.parsePublicArgs(args);
    file = obj.argv[0];
    opts = obj.argv[1];
    // sanity check
    if( !file ){
	JS9.error("JS9.LoadSession: no file specified for load");
    }
    // opts is optional
    opts = opts || {};
    // opts can be an object or json
    if( typeof opts === "object" ){
	// make a copy so we can modify it
	opts = JS9.extend(true, {}, opts);
    } else if( typeof opts === "string" ){
	// convert json to object
	try{ opts = JSON.parse(opts); }
	catch(e){ opts = {}; }
    }
    // check for display
    if( obj.display ){
	display = obj.display;
    } else if( opts.display ){
	display = opts.display;
    } else {
	if( JS9.displays.length > 0 ){
	    display = JS9.displays[0].id;
	} else {
	    display = JS9.DEFID;
	}
    }
    disp = JS9.lookupDisplay(display);
    opts.display = disp.id;
    // convert blob to json object
    if( typeof file === "object" ){
	// file reader object
	reader = new FileReader();
	reader.onload = (ev) => {
	    const jobj = JSON.parse(ev.target.result);
	    opts.sessionPath =  JS9.dirname(file.path || file.name || "");
	    disp.loadSession(jobj, opts);
	};
	reader.readAsText(file);
    } else if( typeof file === "string" ){
	opts.responseType = "text";
	opts.display = disp.id;
	file = JS9.fixPath(file, opts);
	JS9.fetchURL(null, file, opts, (jstr, opts) => {
	    const jobj = JSON.parse(jstr);
	    opts.sessionPath =  JS9.dirname(file);
            disp.loadSession(jobj, opts);
	});
    } else {
	// oops!
	JS9.error(`unknown file type for LoadSession: ${typeof file}`);
    }
});

// save regions to disk
// eslint-disable-next-line no-unused-vars
JS9.mkPublic("SaveCatalog", function(...args){
    const obj = JS9.parsePublicArgs(args);
    const im = JS9.getImage(obj.display);
    let fname = obj.argv[0];
    let which = obj.argv[1];
    if( im ){
	return im.saveCatalog(fname, which);
    }
    return;
});

// load a starbase catalog file
JS9.mkPublic("LoadCatalog", function(...args){
    let reader, im, layer, file, opts;
    const obj = JS9.parsePublicArgs(args);
    layer = obj.argv[0];
    file = obj.argv[1];
    opts = obj.argv[2];
    // special case: 1 arg is the catalog, not the layer
    // i.e., file reader object from openLocalLoadCotalog
    if( layer instanceof Blob ){
	opts = file;
	file = layer;
	layer = null;
    }
    // sanity check
    if( !file ){
	JS9.error("JS9.LoadCatalog: no file specified for catalog load");
    }
    // an image must loaded into the display
    im = JS9.getImage(obj.display);
    if( !im ){
	return;
    }
    // set status
    im.setStatus("loadCatalog", "processing");
    // opts is optional
    opts = opts || {};
    // opts can be an object or json
    if( typeof opts === "object" ){
	// make a copy so we can modify it
	opts = JS9.extend(true, {}, opts);
    } else if( typeof opts === "string" ){
	// convert json to object
	try{ opts = JSON.parse(opts); }
	catch(e){ opts = {}; }
    }
    // convert blob to string
    if( file instanceof Blob ){
	// file reader object
	reader = new FileReader();
	reader.onload = (ev) => {
	    // improve the filename, if possible
	    if( !layer && file.name ){
		layer = file.name.replace(/\.[^.]*$/, "");
	    }
	    // load the catalog
	    im.loadCatalog(layer, ev.target.result, opts);
	    // set status
	    im.setStatus("loadCatalog", "complete");
	    // onload callback
	    if( opts && opts.onload ){
		try{ JS9.xeqByName(opts.onload, window, im); }
		catch(e){ JS9.error("in catalog onload callback", e, false); }
	    }
	};
	reader.readAsText(file);
    } else if( typeof file === "string" ){
	if( file.match(/\t/) ){
	    // it's a table (contains a tab)
	    im.loadCatalog(layer, file, opts);
	    // set status
	    im.setStatus("loadCatalog", "complete");
	    // onload callback
	    if( opts && opts.onload ){
		try{ JS9.xeqByName(opts.onload, window, im); }
		catch(e){ JS9.error("in catalog onload callback", e, false); }
	    }
	} else {
	    // its a file: retrieve and load the catalog
	    opts.responseType = "text";
	    file = JS9.fixPath(file, opts);
	    JS9.fetchURL(null, file, opts, (s) => {
		// load the catalog
		im.loadCatalog(layer, s, opts);
		// set status
		im.setStatus("loadCatalog", "complete");
		// onload callback
		if( opts && opts.onload ){
		    try{ JS9.xeqByName(opts.onload, window, im); }
		    catch(e){ JS9.error("in catalog onload callback", e, false); }
		}
	    });
	}
    } else {
	// oops!
	JS9.error(`unknown file type for LoadCatalog: ${typeof file}`);
    }
});

// create an image mosaic
JS9.mkPublic("CreateMosaic", function(...args){
    const obj = JS9.parsePublicArgs(args);
    const display = JS9.lookupDisplay(obj.display);
    let ims = obj.argv[0];
    let opts = obj.argv[1];
    if( display ){
	return display.createMosaic(ims, opts);
    }
});

// display the named plugin
JS9.mkPublic("DisplayPlugin", function(...args){
    let i, plugin, pname, lcname, name;
    const obj = JS9.parsePublicArgs(args);
    const display = JS9.lookupDisplay(obj.display);
    name = obj.argv[0];
    if( display && obj.argv[0] ){
	lcname = name.toLowerCase();
	for(i=0; i<JS9.plugins.length; i++){
	    plugin = JS9.plugins[i];
	    pname = plugin.name;
	    if( (pname === name) ||
		(pname.toLowerCase().substr(-lcname.length) === lcname) ){
		display.displayPlugin(plugin);
		return;
	    }
	}
	JS9.error(`can't find plugin: ${name}`);
    }
});

//  display a help page (or a general url, actually)
JS9.mkPublic("DisplayHelp", function(hname){
    let id, title, url, help;
    const opts = JS9.lightOpts[JS9.LIGHTWIN].textWin;
    const type = "iframe";
    // sanity check
    if( !hname ){ return; }
    title = hname.split("/").reverse()[0];
    id = `help_${JS9.uniqueID()}`;
    // look for known help file
    help = JS9.helpOpts[hname];
    if( help ){
	// help file
	url = JS9.InstallDir(`${help.type}/${help.url}`);
	JS9.lightWin(id, type, url, help.title || title, opts);
    } else {
	// its a random url
	JS9.lightWin(id, type, hname, title, opts);
    }
});

// display a light window
// eslint-disable-next-line no-unused-vars
JS9.mkPublic("LightWindow", function(...args){
    const obj = JS9.parsePublicArgs(args);
    let id      = obj.argv[0] || `lightWindow${JS9.uniqueID()}`;
    let type    = obj.argv[1] || "inline";
    let content = obj.argv[2];
    let title   = obj.argv[3] || "JS9 light window";
    let opts    = obj.argv[4] || JS9.lightOpts[JS9.LIGHTWIN].textWin;
    if( !content ){
	JS9.error("no content specified for LightWindow");
    }
    return JS9.lightWin(id, type, content, title, opts);
});
}

if( typeof globalThis !== "undefined" ){
    globalThis.JS9InstallPublicApi = JS9InstallPublicApi;
}
