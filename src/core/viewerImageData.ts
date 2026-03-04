// @ts-nocheck
/* JS9 Image.prototype data processing, scaling, session, and catalog methods. */
import { sprintf } from './sprintf';
import { gaussBlur } from './gaussBlur';
import { saveAs } from './browserCompat';
"use strict";

function JS9InstallImageData(JS9) {

// get color map name
JS9.Image.prototype.getColormap = function(){
    if(  this.cmapObj ){
	return {colormap: this.cmapObj.name,
		contrast: this.params.contrast,
		bias: this.params.bias};
    }
};

// set color map
// calling sequences:
//   setColormap(name);
//   setColormap(name, contrast, bias);
//   setColormap(name, staticOpts);
//   setColormap(contrast, bias);
//   setColormap(staticOpts);
//   setColormap("rgb");
//   setColormap("invert");
//   setColormap("reset");
JS9.Image.prototype.setColormap = function(...args){
    let [arg, arg2, arg3] = args;
    let arr;
    const setCmap = (arg) => {
	if( this.cmapObj ){
	    // unset rgb mode, if necessary
	    switch(this.cmapObj.name){
	    case "red":
		if( this.display.rgb.rim === this ){
		    this.display.rgb.rim = null;
		}
		break;
	    case "green":
		if( this.display.rgb.gim === this ){
		    this.display.rgb.gim = null;
		}
		break;
	    case "blue":
		if( this.display.rgb.bim === this ){
		    this.display.rgb.bim = null;
		}
		break;
	    }
	}
	// remove previous static colormap
	delete this.staticObj;
	// add the new colormap
	this.cmapObj = JS9.lookupColormap(arg);
	this.params.colormap = this.cmapObj.name;
	// for static colormaps, copy the static object (we might edit it)
	if( this.cmapObj.type === "static" ){
	    this.staticObj = JS9.extend(true, {}, this.cmapObj);
	}
	// set rgb mode, if necessary
	switch(arg){
	case "red":
	    this.display.rgb.rim = this;
	    break;
	case "green":
	    this.display.rgb.gim = this;
	    break;
	case "blue":
	    this.display.rgb.bim = this;
	    break;
	default:
	    break;
	}
	// new colormap, turn off image overlay
	this.params.overlay = false;
    };
    const setContrastBias = (arg1, arg2) => {
	arg1 = parseFloat(arg1);
	if( !Number.isNaN(arg1) ){
	    this.params.contrast = arg1;
	}
	arg2 = parseFloat(arg2);
	if( !Number.isNaN(arg2) ){
	    this.params.bias = arg2;
	}
    };
    const setStatic = (a) => {
	let i, j, color, dval;
	for(i=0; i<a.length; i++){
	    if( !JS9.isArray(a[i]) || typeof a[i][0] !== "string" ){ continue; }
	    for(j=0; j<this.staticObj.colors.length; j++){
		color = this.staticObj.colors[j];
		if( a[i][0] === color.name ){
		    switch(a[i].length){
		    case 2:
			if( a[i][1] === false || a[i][1] === "false" ){
			    // active
			    color.active = false;
			} else if( a[i][1] === true || a[i][1] === "true" ){
			    // active
			    color.active = true;
			} else {
			    // alpha
			    dval = parseFloat(a[i][1]);
			    if( dval > 0 && dval <= 1 ){
				dval = dval * 255;
			    }
			    color.alpha = dval;
			}
			break;
		    case 3:
			// min and max
			color.min = parseFloat(a[i][1]);
			if( Number.isNaN(color.min) ){
			    color.min = -Infinity;
			}
			color.max = parseFloat(a[i][2]);
			if( Number.isNaN(color.max) ){
			    color.max = Infinity;
			}
			break;
		    default:
			break;
		    }
		    break;
		}
	    }
	}
	// new colormap, turn off image overlay
	this.params.overlay = false;
    }
    // is this core service disabled?
    // (only if the colormap has been set at least once!)
    if( JS9.inArray("colormap", this.params.disable) >= 0 && this.cmapObj ){
	return;
    }
    switch(args.length){
    case 1:
	switch(arg){
	case "rgb":
	    this.display.rgb.active = !this.display.rgb.active;
	    break;
	case "overlay":
	    if( this.offscreen ){
		this.params.overlay = !this.params.overlay;
	    }
	    break;
	case "invert":
	    this.params.invert = !this.params.invert;
	    break;
	case "reset":
	    this.params.invert = JS9.imageOpts.invert;
	    this.params.contrast = JS9.imageOpts.contrast;
	    this.params.bias = JS9.imageOpts.bias;
	    break;
	default:
	    if( this.cmapObj && this.cmapObj.type === "static" ){
		if( JS9.isArray(arg) ){
		    setStatic(arg);
		} else if( typeof arg === "string" && arg.charAt(0) === '[' ){
		    try{
			arr = JSON.parse(arg);
			setStatic(arr);
		    }
		    catch(e){
			JS9.error(`can't parse JSON in setColormap: ${arg}`, e);
		    }
		} else {
		    setCmap(arg);
		}
	    } else if( typeof arg === "string" ){
		setCmap(arg);
	    }
	    break;
	}
	break;
    case 2:
	if( JS9.isNumber(arg) && JS9.isNumber(arg2) ){
	    setContrastBias(arg, arg2);
	} else if( this.cmapObj && this.cmapObj.type === "static" ){
	    setCmap(arg);
	    setStatic(arg2);
	}
	break;
    case 3:
	setCmap(arg);
	setContrastBias(arg2, arg3);
	break;
    default:
	break;
    }
    this.displayImage("colors");
    // hack: delete filterRGBImage from stash to avoid restore during reproject
    this.xeqStashDiscard("filterRGBImage");
    // extended plugins
    if( JS9.globalOpts.extendedPlugins ){
	this.xeqPlugins("image", "onsetcolormap");
    }
    return this;
};

// get scale factor
JS9.Image.prototype.getScale = function(){
    if( this.params.scale ){
	return {scale: this.params.scale,
		scalemin: this.params.scalemin,
		scalemax: this.params.scalemax,
	        scaleclipping: this.params.scaleclipping};
    }
};

// set scale factor
JS9.Image.prototype.setScale = function(...args){
    let [s0, s1, s2] = args;
    const newscale = (s) => {
	if( JS9.scales.includes(s) ){
	    this.params.scale = s;
	} else if( s === "dataminmax" ){
	    this.params.scaleclipping = "dataminmax";
	    this.params.scalemin = this.raw.dmin;
	    this.params.scalemax = this.raw.dmax;
	} else if( s === "zscale" ){
	    if( (this.params.z1 === undefined) ||
		(this.params.z2 === undefined) ){
		this.zscale(false);
	    }
	    this.params.scaleclipping = "zscale";
	    this.params.scalemin = this.params.z1;
	    this.params.scalemax = this.params.z2;
	} else if( s === "zmax" ){
	    if( (this.params.z1 === undefined) ){
		this.zscale(false);
	    }
	    this.params.scaleclipping = "zmax";
	    this.params.scalemin = this.params.z1;
	    this.params.scalemax = this.raw.dmax;
	} else if( s === "user" ){
	    this.params.scaleclipping = "user";
	} else {
	    JS9.error(`unknown scale: ${s}`);
	}
    };
    // is this core service disabled?
    if( JS9.inArray("scale", this.params.disable) >= 0 ){
	return;
    }
    if( args.length ){
	switch(args.length){
	case 1:
	    newscale(s0);
	    break;
	case 2:
	    this.params.scalemin = parseFloat(s0);
	    this.params.scalemax = parseFloat(s1);
	    this.params.scaleclipping = "user";
	    break;
        default:
	    newscale(s0);
	    if( (s0 !== "zscale") && (s0 !== "zmax") ){
		this.params.scalemin = parseFloat(s1);
		this.params.scalemax = parseFloat(s2);
		this.params.scaleclipping = "user";
	    }
	    break;
	}
	this.params.precision =
	    JS9.floatPrecision(this.params.scalemin, this.params.scalemax);
	this.displayImage("colors");
    }
    // extended plugins
    if( JS9.globalOpts.extendedPlugins ){
	this.xeqPlugins("image", "onsetscale");
    }
    return this;
};

// get opacity factor
JS9.Image.prototype.getOpacity = function(){
    let obj = {};
    if( JS9.notNull(this.params.opacity) ){
	obj.opacity = this.params.opacity;
    } else {
	obj.opacity = 1;
    }
    if( JS9.notNull(this.params.flooropacity) ){
	obj.flooropacity = this.params.flooropacity;
	obj.floorvalue = this.params.floorvalue;
    }
    return obj;
};

// set opacity factor:
// set default opacity for all pixels
//   setOpacity(0.9)
// set opacity floor: for pixel values <= 1st arg assign 2nd arg as opacity
//   setOpacity(5, 0.2)
// set default opacity, for pixel values <= 2nd arg, assign 3rd arg as opacity
//   setOpacity(0.9, 5, 0.2)
// reset default opacity to 1
//   setOpacity("reset")
// remove opacity floor
//   setOpacity("resetfloor")
// reset default opacity to 1, remove opacity floor
//   setOpacity("resetall")
JS9.Image.prototype.setOpacity = function(...args){
    let [a1, a2, a3] = args;
    // is this core service disabled?
    if( JS9.inArray("opacity", this.params.disable) >= 0 ){
	return;
    }
    if( args.length ){
	switch(args.length){
	case 1:
	    if( typeof a1 === "string" ){
		if( a1.toLowerCase() === "reset" ){
		    this.params.opacity = 1;
		} else if( a1.toLowerCase() === "resetfloor" ){
		    delete this.params.floorvalue;
		    delete this.params.flooropacity;
		} else if( a1.toLowerCase() === "resetall" ){
		    this.params.opacity = 1;
		    delete this.params.floorvalue;
		    delete this.params.flooropacity;
		}
	    } else if( JS9.isNumber(a1) ){
		this.params.opacity = parseFloat(a1);
	    }
	    break;
	case 2:
	    if( JS9.isNumber(a1) && JS9.isNumber(a2) ){
		this.params.floorvalue = parseFloat(a1);
		this.params.flooropacity = parseFloat(a2);
	    }
	    break;
	case 3:
	    if( JS9.isNumber(a1) ){
		this.params.opacity = parseFloat(a1);
	    }
	    if( JS9.isNumber(a2) && JS9.isNumber(a3) ){
		this.params.floorvalue = parseFloat(a2);
		this.params.flooropacity = parseFloat(a3);
	    }
	    break;
        default:
	    break;
	}
	// if we just set opacity (not reset), it must mean we want to use it,
	// so turn off opacity masking, if necessary
	if(  typeof a1 === "number" ||
	    (typeof a1 === "string" && !a1.match(/reset/)) ){
	    if( this.mask.active && this.mask.im ){
		this.mask.active = false;
	    }
	}
	this.displayImage("colors");
    }
    // extended plugins
    if( JS9.globalOpts.extendedPlugins ){
	this.xeqPlugins("image", "onsetopacity");
    }
    return this;
};

// get an image param value
JS9.Image.prototype.getParam = function(param){
    // sanity check
    if( !param ){ return null; }
    // return param object
    if( param === "all" ){
	return this.params;
    }
    // return value
    return this.params[param];
};

// set an image param value
JS9.Image.prototype.setParam = function(param, value){
    let i, idx, ovalue, obj;
    const getval = (s) => {
	if( s === "true" ){
	    return true;
	}
	if( s === "false" ){
	    return false;
	}
	if( !JS9.isNumber(s) ){
	    return s;
	}
	return parseFloat(s);
    };
    // sanity check
    if( !param ){ return null; }
    // convert strings to values
    value = getval(value);
    // merge in new params
    if( param === "all" && typeof value === "object" ){
	JS9.extend(true, this.params, value);
	// call core methods as needed
	if( value.colormap || value.contrast || value.bias ){
	    obj = this.getColormap();
	    value.colormap = value.colormap || obj.colormap;
	    value.contrast = value.contrast || obj.contrast;
	    value.bias = value.bias || obj.bias;
	    this.setColormap(value.colormap, value.contrast, value.bias);
	}
	if( value.scale || value.scalemin || value.scalemax ){
	    obj = this.getScale();
	    value.scale = value.scale || obj.scale;
	    value.scalemin = value.scalemin || obj.scalemin;
	    value.scalemax = value.scalemax || obj.scalemax;
	    this.setScale(value.scale, value.scalemin, value.scalemax);
	}
	if( value.flip ){
	    this.setFlip("reset");
	    this.setFlip(value.flip);
	}
	if( value.rot90 ){
	    this.setRot90("reset");
	    this.setRot90(value.rot90);
	}
	if( value.rotate ){
	    this.setRotate("reset");
	    this.setRotate(value.rotate);
	}
	if( value.invert ){
	    this.params.invert = value.invert;
	    this.displayImage("colors");
	}
	if( value.zoom ){
	    this.setZoom(value.zoom);
	}
	if( value.wcssys ){
	    this.setWCSSys(value.wcssys);
	}
	if( value.wcsunits ){
	    this.setWCSUnits(value.wcsunits);
	}
	return this.params;
    } else if( param === "disable" ){
	if( !JS9.isArray(value) ){
	    value = [value];
	}
	for(i=0; i<value.length; i++){
	    idx = JS9.inArray(value[i], this.params.disable);
	    if( idx < 0 ){
		this.params.disable.push(value[i]);
	    }
	}
	return this.params.disable;
    } else if( param === "enable" ){
	if( !JS9.isArray(value) ){
	    value = [value];
	}
	for(i=0; i<value.length; i++){
	    idx = JS9.inArray(value[i], this.params.disable);
	    if( idx >= 0 ){
		this.params.disable.splice(idx, 1);
	    }
	}
	return this.params.disable;
    }
    // save old value
    ovalue = this.params[param];
    // set new value
    this.params[param] = value;
    // call core methods as needed
    switch(param){
    case "colormap":
	this.setColormap(value);
	break;
    case "invert":
	this.displayImage("colors");
	break;
    case "contrast":
	obj = this.getColormap();
	this.setColormap(obj.colormap, value, obj.bias);
	break;
    case "bias":
	obj = this.getColormap();
	this.setColormap(obj.colormap, obj.contrast, value);
	break;
    case "overlay":
	this.displayImage("colors");
	break;
    case "flip":
	this.setFlip("reset");
	this.setFlip(value);
	break;
    case "rot90":
	this.setRot90("reset");
	this.setRot90(value);
	break;
    case "rotate":
	this.setRotate("reset");
	this.setRotate(value);
	break;
    case "scale":
	this.setScale(value);
	break;
    case "scalemin":
	obj = this.getScale();
	this.setScale("user", value, obj.scalemax);
	break;
    case "scalemax":
	obj = this.getScale();
	this.setScale("user", obj.scalemin, value);
	break;
    case "scaleclipping":
	obj = this.getScale();
	this.setScale(value, obj.scalemin, obj.scalemax);
	break;
    case "wcssys":
	this.setWCSSys(value);
	break;
    case "wcsunits":
	this.setWCSUnits(value);
	break;
    case "zoom":
	this.setZoom(value);
	break;
    }
    // return old value
    return ovalue;
};

// copy params from one image to another
JS9.Image.prototype.copyParams = function(params, images, opts){
    let i, j, im, param, val;
    let xims = [];
    // sanity check
    if( !params ){ return; }
    // opts is optional
    opts = opts || {};
    if( typeof params === "string" && params.charAt(0) === '[' ){
	try{ params = JSON.parse(params); }
	catch(e){ JS9.error(`can't parse JSON in copyParams: ${params}`, e); }
    }
    if( !JS9.isArray(params) ){ params = [params]; }
    // do regions first to avoid problems with changes to the current image
    i = JS9.inArray("regions", params);
    if( i >= 0 ){
	params.splice(i, 1);
	params.unshift("regions");
    }
    // default is all images
    images = images || JS9.images;
    if( typeof images === "string" && images.charAt(0) === '[' ){
	try{ images = JSON.parse(images); }
	catch(e){ JS9.error(`can't parse JSON in copyParams: ${images}`, e); }
    }
    if( !JS9.isArray(images) ){ images = [images]; }
    // for each image
    for(i=0; i<images.length; i++){
	im = images[i];
	// im can be an image handle or image id
	if( typeof im === "string" ){
	    im = JS9.lookupImage(im);
	    if( !im ){
		JS9.error(`unknown image for copyParams`);
	    }
	}
	// but don't do myself
	if( im === this ){
	    continue;
	}
	// save the currently displayed image
	if( im !== im.display.image ){
	    if( JS9.inArray(im.display.image, xims) < 0 ){
		xims.push(im.display.image);
	    }
	}
	try{
	    // set each param
	    for(j=0; j<params.length; j++){
		param = params[j];
		switch(param){
		case "alignment":
		    im.alignPanZoom(this);
		    break;
		case "contrastbias":
		    val = this.getParam("contrast");
		    im.setParam("contrast", val);
		    val = this.getParam("bias");
		    im.setParam("bias", val);
		    break;
		case "pan":
		    val = this.getPan();
		    im.setPan(JS9.pix2pix(this, im, {x: val.ox, y: val.oy}));
		    break;
		case "regions":
		    this.copyRegions(im);
		    break;
		case "shapes":
		    if( opts.layer ){
			this.copyShapes(opts.layer, im);
		    }
		    break;
		case "wcs":
		    val = this.getParam("wcssys");
		    im.setParam("wcssys", val);
		    val = this.getParam("wcsunits");
		    im.setParam("wcsunits", val);
		    break;
		default:
		    val = this.getParam(param);
		    im.setParam(param, val);
		    break;
		}
	    }
	} catch(e){
	    JS9.error(`could not copy params for ${im.id}`);
	}
	finally{
	    // re-display image(s),  necessary
	    if( xims.length ){
		for(i=0; i<xims.length; i++){
		    xims[i].displayImage();
		}
	    }
	}
    }
};

// get status
JS9.Image.prototype.getStatus = function(status){
    if( JS9.isNull(status) || typeof status !== "string" ){
	return undefined;
    }
    switch(status.toLowerCase()){
    case "close":
	return this.status.close;
    case "displaysection":
    case "displayextension":
	return this.status.displaySection;
    case "createmosaic":
	return this.status.createMosaic;
    case "load":
    case "preload":
	// if the fetch is still running or failed, return the status
	if( JS9.fetchURL.status ){
	    return JS9.fetchURL.status;
	}
	return this.status.load;
    case "loadcatalog":
	return this.status.loadCatalog;
    case "loadcolormap":
	return this.status.loadColormap;
    case "loadproxy":
	return this.status.loadProxy;
    case "loadregions":
	return this.status.loadRegions;
    case "loadsession":
	return this.status.loadSession;
    case "reproject":
    case "reprojectdata":
    case "rotate":
    case "rotatedata":
	return this.status.reprojectData;
    case "runanalysis":
	return this.status.runAnalysis;
    case "separate":
	return this.status.separate;
    case "uploadfitsfile":
	return this.status.uploadFITSFile;
    default:
	return undefined;
    }
};

// set status
JS9.Image.prototype.setStatus = function(id, status){
    if( JS9.notNull(id) && JS9.notNull(status) ){
	switch(status){
	case "error":
	case "complete":
	    delete this.status.cur;
	    break;
	default:
	    this.status.cur = id;
	    break;
	}
    }
    this.status[id] = status;
};

// re-calculate data min and max (and set scale params, if necessary)
//
// Important note 7/10/2020:
// Chrome was taking either 35ms ... or 7+ seconds to find the min/max on a
// 2048x2048 int image (casa.fits in js9debug.html). The slowdown was random.
// We optimized the loop in this way:
//   1. assign data[i] to val instead of accessing data[i] more than once
//   2. use direct min/max compare instead of Math.min() and Math.max
//   3. use local params instead of this.raw, this.params, this.raw.data
// These changes appear to have helped but the underlying cause is unknown.
JS9.Image.prototype.dataminmax = function(dmin, dmax){
    let i, raw, params, data, val, blankval, reminscale, remaxscale;
    // convenience variables
    raw = this.raw;
    params = this.params;
    data = this.raw.data;
    // rescale?
    reminscale = Number.isNaN(params.scalemin) || !Number.isFinite(params.scalemin) || JS9.isNull(params.scalemin);
    remaxscale = Number.isNaN(params.scalemax) || !Number.isFinite(params.scalemax) || JS9.isNull(params.scalemax);
    // might have to redo scaling if it's tied to current data min or max
    if( params.scaleclipping === "dataminmax" ){
	if( (raw.dmin === params.scalemin) || JS9.isNull(raw.dmin) ){
	    reminscale = true;
	}
	if( (raw.dmax === params.scalemax) || JS9.isNull(raw.dmax) ){
	    remaxscale = true;
	}
    }
    // used supplied values, if possible
    if( JS9.notNull(dmin) && JS9.notNull(dmax) ){
	raw.dmin = dmin;
	raw.dmax = dmax;
    } else {
	// re-calculate data min and max values
	raw.dmin = Number.MAX_VALUE;
	raw.dmax = Number.MIN_VALUE;
	// get data min and max, ignoring type-dependent blank values
	if( raw.bitpix > 0 ){
	    // integer data: BLANK header value specifies data value to ignore
	    if( raw.header.BLANK !== undefined ){
		blankval = raw.header.BLANK;
		for(i=0; i<data.length; i++){
		    val = data[i];
		    if( val !== blankval ){
			if( val < raw.dmin ){ raw.dmin = val; }
			if( val > raw.dmax ){ raw.dmax = val; }
		    }
		}
	    } else {
		for(i=0; i<data.length; i++){
		    val = data[i];
		    if( val < raw.dmin ){ raw.dmin = val; }
		    if( val > raw.dmax ){ raw.dmax = val; }
		}
	    }
	} else {
	    // float data: ignore NaN, infinity
	    for(i=0; i<data.length; i++){
		val = data[i];
		if( !Number.isNaN(val) && Number.isFinite(val) ){
		    if( val < raw.dmin ){ raw.dmin = val; }
		    if( val > raw.dmax ){ raw.dmax = val; }
		}
	    }
	}
    }
    // re-set scaling values, if necessary
    if( reminscale ){ params.scalemin = raw.dmin; }
    if( remaxscale ){ params.scalemax = raw.dmax; }
    // set new precision
    params.precision = JS9.floatPrecision(params.scalemin, params.scalemax);
    // allow chaining
    return this;
};

// the zscale calculation
JS9.Image.prototype.zscale = function(setvals){
    let s, rawdata, bufsize, buf, vals, res, z1, z2;
    const parseZscaleResult = (result) => {
	let arr;
	if( JS9.isNull(result) || result === undefined ){
	    return null;
	}
	if( JS9.isArray(result) ){
	    if( result.length >= 2 ){
		return [parseFloat(result[0]), parseFloat(result[1])];
	    }
	    return null;
	}
	if( typeof result === "object" ){
	    if( JS9.notNull(result.z1) && JS9.notNull(result.z2) ){
		return [parseFloat(result.z1), parseFloat(result.z2)];
	    }
	    return null;
	}
	if( typeof result === "string" ){
	    arr = result.trim().split(/\s+/);
	    if( arr.length >= 2 ){
		return [parseFloat(arr[0]), parseFloat(arr[1])];
	    }
	}
	return null;
    };
    // sanity check
    if( !this.raw || !this.raw.data ){ return this; }
    rawdata = this.raw.data;
    // preferred path: use zscale implementation supplied by the active FITS adapter
    if( JS9.fits && typeof JS9.fits.computeZscale === "function" ){
	try{
	    res = JS9.fits.computeZscale(
		rawdata,
		this.raw.width,
		this.raw.height,
		this.raw.bitpix,
		{
		    contrast: this.params.zscalecontrast,
		    numsamples: this.params.zscalesamples,
		    perline: this.params.zscaleline
		}
	    );
	    vals = parseZscaleResult(res);
	    if( vals ){
		z1 = vals[0];
		z2 = vals[1];
		if( Number.isFinite(z1) && Number.isFinite(z2) ){
		    this.params.z1 = z1;
		    this.params.z2 = z2;
		    if( setvals === "zmax" ){
			this.params.scalemin = this.params.z1;
			this.params.scalemax = this.raw.dmax;
		    } else if( setvals ){
			this.params.scalemin = this.params.z1;
			this.params.scalemax = this.params.z2;
		    }
		    this.params.precision =
			JS9.floatPrecision(this.params.scalemin, this.params.scalemax);
		    return this;
		}
	    }
	    JS9.log("adapter computeZscale() returned invalid values, using fallback path");
	}
	catch(e){
	    JS9.log("adapter computeZscale() failed, using fallback path", e);
	}
    }
    if( !JS9.zscale ){ return this; }
    // allocate space for the image in the runtime heap
    bufsize = rawdata.length * rawdata.BYTES_PER_ELEMENT;
    try{ buf = JS9.vmalloc(bufsize); }
    catch(e){ JS9.error(`image too large for zscale malloc: ${bufsize}`, e); }
    // copy the raw image data to the heap
    // try{ JS9.vheap.set(new Uint8Array(rawdata.buffer), buf); }
    try{ JS9.vmemcpy(new Uint8Array(rawdata.buffer), buf); }
    catch(e){ JS9.error(`can't copy image to zscale heap: ${bufsize}`, e); }
    // call the zscale routine
    s = JS9.zscale(buf,
		   this.raw.width,
		   this.raw.height,
		   this.raw.bitpix,
		   this.params.zscalecontrast,
		   this.params.zscalesamples,
		   this.params.zscaleline);
    // free runtime heap space
    JS9.vfree(buf);
    // clean up return values
    vals = s.trim().split(/\s+/);
    // save z1 and z2
    this.params.z1 = parseFloat(vals[0]);
    this.params.z2 = parseFloat(vals[1]);
    // make z1 and z2 the scale clip values, if necessary
    if( setvals === "zmax" ){
	this.params.scalemin = this.params.z1;
	this.params.scalemax = this.raw.dmax;
    } else if( setvals ){
	this.params.scalemin = this.params.z1;
	this.params.scalemax = this.params.z2;
    }
    this.params.precision =
	JS9.floatPrecision(this.params.scalemin, this.params.scalemax);
    // allow chaining
    return this;
};

// background-subtracted counts in regions
// eslint-disable-next-line no-unused-vars
JS9.Image.prototype.countsInRegions = function(...args){
    let i, s, vfile, bvfile, sect, ext, filter, bin, opts, cmdswitches;
    let sregions = "field";
    let bregions = "";
    const getreg = (arg, def) => {
	let ii, rarr, reg, narg;
	const regrexp= /(annulus|box|circle|ellipse|line|polygon|point|text) *\(/;
	// if we have no region, we're done
	if( !arg ){
	    return def;
	}
	if( typeof arg === "string" ){
	    narg = this.expandMacro(arg);
	    // if we have no region, we're done
	    if( !narg ){
		return def;
	    }
	    // if its a known region, we're done
	    if( narg.match(regrexp) ){
		return narg;
	    }
	}
	// look for a region specifier
	rarr = this.getShapes("regions", arg);
	// no region are returned: this is an error
	if( !rarr || !rarr.length ){
	    JS9.error(`no regions found: ${arg}`);
	}
	// compose a region string from the returned regions
	narg = "";
	for(ii=0; ii<rarr.length; ii++){
	    reg = rarr[ii];
	    if( this.params.wcssys ){
		// put wcs sys at the start
		if( !narg ){
		    narg = reg.wcssys || "";
		}
		// add wcs region string
		narg += `; ${reg.wcsstr}`;
	    } else {
		// put image sys at the start
		if( !narg ){
		    narg = reg.imsys || "";
		}
		// add image region string
		narg += `; ${reg.imstr}`;
	    }
	}
	return narg || def;
    };
    // sanity check
    if( !this.raw.hdu || !this.raw.hdu.fits || !this.raw.hdu.fits.vfile ){
	JS9.error(`no virtual file available for regcnts: ${this.id}`);
    }
    if( !(JS9.fits && JS9.fits.capabilities &&
	  JS9.fits.capabilities.analysis) ||
	typeof JS9.regcnts !== "function" ){
	JS9.error("countsInRegions is not supported by the active FITS adapter");
    }
    // convert json to an object
    for(i=0; i<args.length; i++){
	s = args[i];
	if( typeof s === "string" && s.charAt(0) === '{' ){
	    try{ args[i] = JSON.parse(s); }
	    catch(e){ JS9.error(`can't parse JSON arg in regcnts: ${s}`, e); }
	}
    }
    // analyze args
    switch(args.length){
    case 0:
	break;
    case 1:
	if( typeof args[0] === "object" ){
	    opts = args[0];
	} else {
	    sregions = getreg(args[0], "field");
	}
	break;
    case 2:
	sregions = getreg(args[0], "field");
	if( typeof args[1] === "object" ){
	    opts = args[1];
	} else {
	    bregions = getreg(args[1], "");
	}
	break;
    default:
	sregions = getreg(args[0], "field");
	bregions = getreg(args[1], "");
	opts = args[2];
	break;
    }
    // opts is optional
    opts = opts || {};
    // reduce can be taken from the global value
    opts.reduce = opts.reduce || JS9.globalOpts.reduceRegcnts;
    // same for reduction dims
    opts.dim = opts.dim ||
	Math.max(JS9.globalOpts.image.xdim, JS9.globalOpts.image.ydim);
    // check for command switches
    cmdswitches = opts.cmdswitches || "";
    // get final file, including filters and extensions
    vfile = this.raw.hdu.fits.vfile;
    ext =  this.file.match(/\[.*\]/);
    if( ext ){
	vfile += ext;
    }
    if( this.imtab === "table" ){
	filter = this.raw.hdu.table.filter;
	if( filter && !vfile.match(filter) ){
	    if( vfile.match(/\]\[/) ){
		vfile = `${vfile.slice(0, -1)}&&${filter}]`;
	    } else {
		vfile += `[${filter}]`;
	    }
	}
    } else if( this.raw.header.NAXIS === 3 &&
	       cmdswitches.search(/(^| )-c/) < 0 ){
	cmdswitches += ` -c ${this.raw.hdu.slice || 1}`;
    }
    // reduce file size, if necessary and possible
    if( opts.reduce && !this.parentFile && this.raw.header.NAXIS < 3 ){
	const {xdim, ydim} = this.fileDimensions();
	bin = Math.floor((Math.max(xdim, ydim) / opts.dim) + 0.5);
	if( bin > 1 ){
	    if( this.imtab === "table" ){
		// for tables, regcnts has a -b switch
		cmdswitches += ` -b ${bin}`;
	    } else {
		// for images, make a temporary binned file
		if( typeof JS9.imsection !== "function" ){
		    JS9.error("countsInRegions image reduction requires imsection capability in the active FITS adapter");
		}
		bvfile = `bin${bin}_${vfile.split("/").reverse()[0]}`;
		sect = `0@0,0@0,${bin}`;
		JS9.imsection(vfile, bvfile, sect, "");
		vfile = bvfile;
	    }
	}
    }
    // could take a while ...
    JS9.waiting(true, this.display);
    // call low-level regcnts
    s = JS9.regcnts(vfile, sregions, bregions, cmdswitches);
    // all done waiting
    JS9.waiting(false);
    // remove binned file, if necessary
    if( bvfile ){
	JS9.vunlink(bvfile);
    }
    // check for regions or cfitio errors
    if( s.match(/^ERROR/) || s.match(/FITSIO status/) ){
	JS9.error(s);
    }
    // display in a lightwin, if necessary
    if( opts.lightwin ){
	// display counts in a light window
	this.displayAnalysis("text", s, {divid: JS9.globalOpts.analysisDiv});
    }
    // return results, including errors
    return s;
};

// radial profile plot
// eslint-disable-next-line no-unused-vars
JS9.Image.prototype.radialProfile = function(...args){
    let i, s, xlabel, ylabel, obj, cobj, pobj, res, el, opts;
    let color, errorbars, errorcolor;
    const carr = [];
    const swobj = {cmdswitches: "-G -j -r"};
    // make up arg list, add required radial profile switches to opts
    for(i=0; i<args.length; i++){
	if( typeof args[i] === "object" ){
	    // integrate our switches into passed opts
	    cobj = JS9.extend(true, {}, args[i], swobj);
	    carr.push(cobj);
	    opts = cobj;
	} else {
	    carr.push(args[i]);
	}
    }
    // if no opts supplied, add the switches manually
    if( !cobj ){
	carr.push(swobj);
    }
    // opts is optional
    opts = opts || {};
    // call regcnts routine
    s = this.countsInRegions(...carr);
    // need a json string in return
    if( s ){
	try{ obj = JSON.parse(s); }
	catch(e){ JS9.error("can't parse regcnts JSON", e); }
    }
    if( !obj || !obj.columnUnits || !obj.columnUnits.radii ){
	JS9.error("no radii available for radial profile");
    }
    // get plot labels
    xlabel = obj.columnUnits.radii;
    ylabel = obj.columnUnits.surfBrightness;
    // get plot colors
    color = opts.color || "green";
    errorcolor = opts.errorcolor || "red";
    if( JS9.isNull(opts.errorbars) || opts.errorbars ){
	errorbars = "y";
    } else {
	errorbars = "n";
    }
    // init plot object
    pobj = {color: sprintf("%s", color), label : sprintf("surface brightness(%s) vs. radius(%s)", ylabel, xlabel), points:{"errorbars" : sprintf("%s", errorbars), "yerr" : {"show" : "true", "color" : sprintf("%s", errorcolor)}}, data: []};
    // add data values
    for(i=0; i<obj.backgroundSubtractedResults.length; i++){
	res = obj.backgroundSubtractedResults[i];
	if( res.radius2 === "undefined" ||
	    res.radius2 === "NA"        ||
	    res.radius1 > res.radius2   ){
	    JS9.error("radial profile source region must be an annulus");
	}
	el = [(res.radius1 + res.radius2)/2, res.surfBrightness, res.surfError];
	pobj.data.push(el);
    }
    // display results
    return this.displayAnalysis("plot", pobj,
				{divid: JS9.globalOpts.analysisDiv});
};

// plot of a 3D cube a region
// eslint-disable-next-line no-unused-vars
JS9.Image.prototype.plot3d = function(src, bkg, opts){
    let i, j, s, arr, jobj, el, pobj, color, mode, divid, xlabel, ylabel;
    let index3, xoff, xdelt;
    const counts=[];
    if( !this.raw.header || this.raw.header.NAXIS !== 3 ){
	JS9.error("plot3d requires a data cube with 3 dimensions");
    }
    // opts is optional
    opts = JS9.extend(true, {}, opts, JS9.globalOpts.plot3d);
    // slice
    opts.cube = opts.cube || "*:*:all";
    // make sure 'all' is specified
    arr = opts.cube.split(":");
    for(i=0; i<arr.length; i++){
	if( arr[i] === "all" ){
	    index3 = i+1;
	    break;
	}
    }
    if( !index3 ){
	JS9.error("plot3d requires specification of cube's third index");
    }
    // but these regcnts command switches are not
    opts.cmdswitches = `-j -c ${opts.cube}`;
    // average or sum?
    mode =  opts.mode || "avg";
    // for avg: what sort of area (pixels or arcsec)?
    if( !opts.areaunits ){
	opts.areaunits = "pixels";
	opts.cmdswitches += " -p";
    } else if( opts.areaunits.match(/^p/) ){
	opts.areaunits = "pixels";
	opts.cmdswitches += " -p";
    } else if( opts.areaunits.match(/^a/) ){
	opts.areaunits = "arcsec";
    } else {
	opts.areaunits = "pixels";
	opts.cmdswitches += " -p";
    }
    // plot colors
    color = opts.color || "green";
    // get counts in regions for all slices in the cube
    s = this.countsInRegions(src, bkg, opts);
    // convert to json format
    if( s ){
	try{ jobj = JSON.parse(s); }
	catch(e){ JS9.error(`can't parse regcnts results: ${s}`, e); }
    }
    if( !jobj ){
	JS9.error("no regcnts info available for plot3d");
    }
    // init plot object
    s = this.raw.header[`CTYPE${String(index3)}`];
    if( s ){
	xlabel = s.toLowerCase();
    } else {
	xlabel = "slice";
    }
    if( mode === "avg" ){
	if( opts.areaunits === "pixels"){
	    ylabel = "counts/pixel**2";
	} else {
	    ylabel = "counts/arcsec**2";
	}
    } else {
	ylabel = "summed counts";
    }
    pobj = {color: sprintf("%s", color), label : sprintf("%s vs %s ", ylabel, xlabel), data: []};
    // offset for 3rd dimension
    xoff = this.raw.header[`CRVAL${String(index3)}`]  || 0;
    xdelt = this.raw.header[`CDELT${String(index3)}`] || 1;
    // get bkgd-subtracted counts in each slice
    for(i=0; i<jobj.source.cubeSlices; i++){
        s = `backgroundSubtractedResults${String(i+1)}`;
	counts[i] = 0;
	for(j=0; j<jobj[s].length; j++){
	    if( mode === "avg" ){
		counts[i] += jobj[s][j].surfBrightness;
	    } else {
		counts[i] += jobj[s][j].netCounts;
	    }
	}
	el = [(i * xdelt) + xoff, counts[i]];
	pobj.data.push(el);
    }
    // which div?
    divid = opts.divid || JS9.globalOpts.analysisDiv;
    // display results
    return this.displayAnalysis("plot", pobj, {divid});
};

// make (or select) a raw data layer
// calling sequences:
//   im.rawDataLayer(obj, func) -- editing existing or create new raw data layer
// where obj can contain:
//    rawid: id of new raw data (default: "alt")
//    oraw: id of raw data to pass to func or "current" (default: "raw0")
//    from: string describing origin of this raw data (def: "func")
// or:
//   im.rawDataLayer(id, func) -- editing existing or create new raw data layer
// or:
//   im.rawDataLayer(id) -- switch to existing raw data later with specified id
// or:
//   im.rawDataLayer(id, "remove") -- remove raw data later with specified id
// or:
//   im.rawDataLayer() -- return name of the current layer
JS9.Image.prototype.rawDataLayer = function(...args){
    let i, j, id, mode, raw, oraw, nraw, rawid, cur, nlen, carr, im;
    let [opts, func] = args;
    // no arg => return name of current raw
    if( !args.length ){
	return this.raw.id;
    }
    // opts is optional
    opts = opts || {};
    // opts is a string with second arg a func: generate opts object
    // opts is a string, no func: switch to a different raw data layer
    // opts is a string + "remove": remove specified layer
    if( typeof opts === "string" ){
	if( typeof func === "function" ){
	    // change: rawDataLayer(id, func) to rawDataLater(obj, func)
	    opts = {rawid: opts};
	} else {
	    id = opts;
	    mode = func;
	    // look for raw layer with the specified id
	    for(i=0; i<this.raws.length; i++){
		raw = this.raws[i];
		// are we deleting this raw layer?
		if( id === raw.id ){
		    if( mode === "remove" ){
			if( id === JS9.RAWID0 ){
			    JS9.error("can't remove primary (raw0) data layer");
			}
			// delete vfile associated with this layer?
			if( raw.hdu && raw.hdu.fits ){
			    carr = JS9.lookupVfile(raw.hdu.fits.vfile);
			    if( carr.length <= 1 ){
				JS9.cleanupFITSFile(raw, true);
			    }
			}
			// default is to go back to original raw data
			this.raw = this.raws[0];
			// but go back to origin of this layer if necessary
			if( raw.current0 && raw.current0.id ){
			    // look for origin
			    for(j=0; j<this.raws.length; j++){
				if( raw.current0.id === this.raws[j].id ){
				    // found it!
				    this.raw = this.raws[j];
				    break;
				}
			    }
			}
			// remove stash calls for this id from other images
			for(j=0; j<JS9.images.length; j++){
			    im = JS9.images[j];
			    if( im && im.xeqstash ){
				im.xeqStashDiscard(id);
			    }
			}
			// remove layer
			this.raws.splice(i, 1);
		    } else {
			// switch to new raw layer
			this.raw = raw;
		    }
		    // configure the current raw layer
		    if( this.raw.header.BITPIX ){
			this.raw.bitpix = this.raw.header.BITPIX;
		    }
		    // reset imtab
		    this.imtab = this.raw.imtab || this.imtab;
		    // set data min and max, ensuring a rescale
		    this.params.scalemin = undefined;
		    this.params.scalemax = undefined;
		    this.dataminmax();
		    // reset section
		    this.mkSection();
		    // reinit coordinate transforms
		    this.initWCS();
		    this.initLCS();
		    // redisplay using these data
		    this.displayImage("all");
		    // refresh layers
		    this.refreshLayers();
		    // extended plugins
		    if( JS9.globalOpts.extendedPlugins ){
			this.xeqPlugins("image", "onrawdatalayer");
		    }
		    return true;
		}
	    }
	    // did not find the specified layer
	    return false;
	}
    }
    // otherwise, sanity check if we are going to change data
    if( typeof func !== "function" ){ return false; }
    // but the id is not
    rawid = opts.rawid || JS9.RAWIDX;
    // which of the "old" raws do we pass to func?
    if( opts.oraw === undefined ){
	opts.oraw = "current0";
    }
    if( opts.oraw === "current" ){
	// use currently active raw
	oraw = this.raw;
    } else if( opts.oraw === "current0" ){
	// current0: use original current data for this layer
	// iff this layer is the same as current active layer
	if( this.raw.id === rawid ){
	    oraw = this.raw.current0;
	} else {
	    // otherwise, use currently active raw layer
	    oraw = this.raw;
	}
    } else {
	// look for oraw matching 'oraw' property
	for(i=0; i<this.raws.length; i++){
	    raw = this.raws[i];
	    if( opts.oraw === raw.id ){
		oraw = raw;
		break;
	    }
	}
    }
    // if all else fails: use initial (raw0)
    if( !oraw ){
	oraw = this.raws[0];
    }
    // look for existing nraw by id
    cur = -1;
    for(i=0; i<this.raws.length; i++){
	if( rawid === this.raws[i].id ){
	    nraw = this.raws[i];
	    cur = i;
	    break;
	}
    }
    // if we don't have an existing nraw, make a copy from oraw
    if( (cur < 0) || opts.alwaysCopy ){
	// make copy
	nraw = JS9.extend(true, {}, oraw);
	// save current for next time
	nraw.current0 = oraw;
	// but ensure data is a copy, not a pointer to the original!
	if( opts.bitpix ){
	    // different bitpix from oraw specified?
	    switch(opts.bitpix){
	    case 8:
		nraw.data = new Uint8Array(oraw.height * oraw.width);
		break;
	    case 16:
		nraw.data = new Int16Array(oraw.height * oraw.width);
		break;
	    case -16:
		nraw.data = new Uint16Array(oraw.height * oraw.width);
		break;
	    case 32:
		nraw.data = new Int32Array(oraw.height * oraw.width);
		break;
	    case -32:
		nraw.data = new Float32Array(oraw.height * oraw.width);
		break;
	    case -64:
		nraw.data = new Float64Array(oraw.height * oraw.width);
		break;
	    default:
		JS9.error(`unsupported bitpix: ${opts.bitpix}`);
		break;
	    }
	    // copy data and convert data type
	    nlen = nraw.width * nraw.height;
	    for(i=0; i<nlen; i++){
		nraw.data[i] = oraw.data[i];
	    }
	    nraw.bitpix = opts.bitpix;
	} else {
	    switch(oraw.bitpix){
	    case 8:
		nraw.data = new Uint8Array(oraw.data);
		break;
	    case 16:
		nraw.data = new Int16Array(oraw.data);
		break;
	    case -16:
		nraw.data = new Uint16Array(oraw.data);
		break;
	    case 32:
		nraw.data = new Int32Array(oraw.data);
		break;
	    case -32:
		nraw.data = new Float32Array(oraw.data);
		break;
	    case -64:
		nraw.data = new Float64Array(oraw.data);
		break;
	    default:
		JS9.error(`unsupported bitpix: ${oraw.bitpix}`);
		break;
	    }
	}
	// set id for copy
	nraw.id = rawid;
	// where did this raw data come from?
	nraw.from = opts.from || nraw.from || "func";
    }
    // call the func to fill in the nraw data
    if( func.call(this, oraw, nraw, opts) ){
	// replace existing nraw with new version
	if( cur >= 0 ){
	    this.raws[cur] = nraw;
	} else {
	    this.raws.push(nraw);
	}
	// assign this nraw to the high-level raw data object
	this.raw = nraw;
	// renew bitpix, if necessary
	if( this.raw.header.bitpix ){
	    this.raw.bitpix = this.raw.header.bitpix;
	}
	// re-calculate min and max, if necesary
	if( opts.dataminmax !== false ){
	    this.dataminmax();
	}
	// re-init coordinate systems, if necessary
	if( opts.updatewcs ){
	    // init WCS, if possible
	    this.initWCS();
	    // init the logical coordinate system, if possible
	    this.initLCS();
	}
	// reset pan, if necessary
	if( opts.resetpan ){
	    this.setPan();
	}
	// refresh shape layers
	this.refreshLayers();
	// redisplay using these data
	this.displayImage("all", opts);
	// redo flip and rot
	this.reFlipRot();
    }
    return true;
};

// perform a gaussian blur on the raw data
// creates a new raw data layer ("gaussBlur")
JS9.Image.prototype.gaussBlurData = function(sigma, opts){
    if( sigma === undefined ){
	JS9.error("missing sigma value for gaussBlurData");
    }
    // save value
    this.params.sigma = sigma;
    // opts is optional
    opts = opts || {};
    // opts can be an object or json
    if( typeof opts === "string" ){
	try{ opts = JSON.parse(opts); }
	catch(e){ JS9.error(`can't parse gaussBlur opts: ${opts}`, e); }
    }
    // the blurred image will be floating point
    if( this.raw.bitpix === -64 ){
	opts.bitpix = -64;
    } else {
	opts.bitpix = -32;
    }
    // use origin of current
    opts.oraw = "current0";
    // nraw should be a floating point copy of oraw
    opts.alwaysCopy = true;
    // new layer
    opts.rawid = opts.rawid || "gaussBlur";
    // pass the options
    opts.sigma = sigma;
    // save this routine so it can be reconstituted in a restored session
    this.xeqStashSave("gaussBlurData", [sigma], opts.rawid);
    // call routine to generate (or modify) the new layer
    this.rawDataLayer(opts, (oraw, nraw) => {
	let tdata;
	// nraw contains a floating point copy of oraw
	// make a temporary copy of nraw data for calculations
	switch(nraw.bitpix){
	case -32:
	    tdata = new Float32Array(nraw.data);
	    break;
	case -64:
	    tdata = new Float64Array(nraw.data);
	    break;
	default:
	    JS9.error(`invalid temp bitpix for gaussBlur: ${nraw.bitpix}`);
	    break;
	}
	// the heart of the matter!
	gaussBlur(tdata, nraw.data, nraw.width, nraw.height, sigma);
	return true;
    });
    // allow chaining
    return this;
};

// perform arithmetic operations on the raw data
// creates a new raw data layer ("imarith")
JS9.Image.prototype.imarithData = function(...args){
    let im;
    let [op, arg1, opts] = args;
    // no args means return the available ops
    if( !args.length ){
	return ["add", "sub", "mul", "div", "min", "max", "reset"];
    }
    // opts is optional
    opts = opts || {};
    // opts can be an object or json
    if( typeof opts === "string" ){
	try{ opts = JSON.parse(opts); }
	catch(e){ JS9.error(`can't parse imarith opts: ${opts}`, e); }
    }
    opts.rawid = opts.rawid || "imarith";
    // special case: reset by deleting the layer
    if( (op === "reset") || (op === "remove") ){
	this.rawDataLayer(opts.rawid, "remove");
	return;
    }
    // sanity check
    if( op === undefined || arg1 === undefined ){
	JS9.error("missing arg(s) for image arithmetic");
    }
    // save this routine so it can be reconstituted in a restored session
    this.xeqStashSave("imarithData", args.slice(), opts.rawid);
    // operation: add, sub, mul, div ...
    switch(op){
    case "add":
    case "sub":
    case "mul":
    case "div":
    case "min":
    case "max":
	opts.op = op;
	break;
    default:
	JS9.error(`invalid operator for image arithmetic: ${op}`);
	break;
    }
    // arg1: can be an image object or a numeric value
    if( typeof arg1 === "object" ){
	if( (this.raw.width  !== arg1.raw.width)  ||
	    (this.raw.height !== arg1.raw.height) ){
	    JS9.error("images must be the same size for image arithmetic");
	}
	opts.argtype = "image";
	opts.argval = arg1;
    } else if( JS9.isNumber(arg1) ){
	opts.argtype = "value";
	opts.argval = arg1;
    } else {
	// lookup the image by name
	im = JS9.lookupImage(arg1);
	if( !im ){
	    JS9.error(`imarith arg1 must be an image or a constant: ${arg1}`);
	}
	opts.argval = im;
	opts.argtype = "image";
    }
    // check for invalid args
    if( (opts.op === "div") &&
	(opts.argtype === "value") && (opts.argval === 0) ){
	JS9.error("imarith can't divide by zero (nor can anyone else)");
    }
    // choose a decent bitpix
    if( !opts.bitpix ){
	switch(opts.argtype){
	case "image":
	    if( (this.raw.bitpix > 0) && (opts.argval.raw.bitpix > 0) ){
		opts.bitpix = Math.max(this.raw.bitpix, opts.argval.raw.bitpix);
	    } else if( (this.raw.bitpix < 0) && (opts.argval.raw.bitpix < 0) ){
		opts.bitpix = Math.min(this.raw.bitpix, opts.argval.raw.bitpix);
	    } else if( (this.raw.bitpix < 0) && (opts.argval.raw.bitpix > 0) ){
		opts.bitpix = this.raw.bitpix;
	    } else {
		opts.bitpix = opts.argval.raw.bitpix;
	    }
	    break;
	case "value":
	    if( this.raw.bitpix === -64 ){
		opts.bitpix = -64;
	    } else {
		opts.bitpix = -32;
	    }
	    break;
	}
    }
    // nraw should be a opts.bitpix copy of oraw
    opts.alwaysCopy = true;
    // use current
    opts.oraw = "current";
    // call routine to generate (or modify) the new layer
    this.rawDataLayer(opts, (oraw, nraw, opts) => {
	let i, val;
	switch(opts.argtype){
	case "image":
	    val = opts.argval.raw.data;
	    switch(opts.op){
	    case "add":
		for(i=0; i<nraw.data.length; i++){
		    nraw.data[i] += val[i];
		}
		break;
	    case "sub":
		for(i=0; i<nraw.data.length; i++){
		    nraw.data[i] -= val[i];
		}
		break;
	    case "mul":
		for(i=0; i<nraw.data.length; i++){
		    nraw.data[i] *= val[i];
		}
		break;
	    case "div":
		for(i=0; i<nraw.data.length; i++){
		    if( val[i] === 0 ){
			nraw.data[i] = 0;
		    } else {
			nraw.data[i] /= val[i];
		    }
		}
		break;
	    case "min":
		for(i=0; i<nraw.data.length; i++){
		    nraw.data[i] = Math.min(nraw.data[i], val[i]);
		}
		break;
	    case "max":
		for(i=0; i<nraw.data.length; i++){
		    nraw.data[i] = Math.max(nraw.data[i], val[i]);
		}
		break;
	    default:
		JS9.error(`unknown operation for imarith: ${opts.op}`);
		break;
	    }
	    break;
	case "value":
	    val = opts.argval;
	    switch(opts.op){
	    case "add":
		for(i=0; i<nraw.data.length; i++){
		    nraw.data[i] += val;
		}
		break;
	    case "sub":
		for(i=0; i<nraw.data.length; i++){
		    nraw.data[i] -= val;
		}
		break;
	    case "mul":
		for(i=0; i<nraw.data.length; i++){
		    nraw.data[i] *= val;
		}
		break;
	    case "div":
		for(i=0; i<nraw.data.length; i++){
		    if( val === 0 ){
			nraw.data[i] = 0;
		    } else {
			nraw.data[i] /= val;
		    }
		}
		break;
	    case "min":
		for(i=0; i<nraw.data.length; i++){
		    nraw.data[i] = Math.min(nraw.data[i], val);
		}
		break;
	    case "max":
		for(i=0; i<nraw.data.length; i++){
		    nraw.data[i] = Math.max(nraw.data[i], val);
		}
		break;
	    default:
		JS9.error(`unknown op for imarith: ${opts.op}`);
		break;
	    }
	    break;
	default:
	    JS9.error(`unknown arg type for imarith: ${opts.argtype}`);
	    break;
	}
	return true;
    });
    // allow chaining
    return this;
};

// linear shift of raw data (cheap alignment for CFA MicroObservatory)
// creates a new raw data layer ("shift")
JS9.Image.prototype.shiftData = function(...args){
    let [x, y, opts] = args;
    if( x === undefined || y === undefined ){
	JS9.error("missing translation value(s) for shiftData");
    }
    // opts is optional
    opts = opts || {};
    // opts can be an object or json
    if( typeof opts === "string" ){
	try{ opts = JSON.parse(opts); }
	catch(e){ JS9.error(`can't parse shift opts: ${opts}`, e); }
    }
    opts.rawid = opts.rawid || "shift";
    opts.x = parseFloat(x);
    opts.y = parseFloat(y);
    // save this routine so it can be reconstituted in a restored session
    this.xeqStashSave("shiftData", args.slice(), opts.rawid);
    this.rawDataLayer(opts, (oraw, nraw, opts) => {
	let i, oi, oj, ni, nj, nlen, oU8, nU8, ooff, noff, blankval;
	const bpp = oraw.data.BYTES_PER_ELEMENT;
	if( nraw.xoff === undefined ){
	    nraw.xoff = 0;
	}
	if( nraw.yoff === undefined ){
	    nraw.yoff = 0;
	}
	nraw.xoff += opts.x;
	nraw.yoff += opts.y;
	if( !opts.fill || opts.fill === "clear" ){
	    if( nraw.bitpix > 0 ){
		blankval = opts.blank || nraw.header.BLANK || 0;
		nraw.header.BLANK = blankval;
	    } else {
		blankval = NaN;
	    }
	    if( typeof nraw.data.fill === "function" ){
		nraw.data.fill(blankval);
	    } else {
		for(i=0; i<nraw.data.length; i++){
		    nraw.data[i] = blankval;
		}
	    }
	}
	for(oj=0; oj<oraw.height; oj++){
	    nj = oj + nraw.yoff;
	    if( (nj < 0) || (nj >= oraw.height) ){
		continue;
	    }
	    oi = 0;
	    ni = oi + nraw.xoff;
	    nlen = oraw.width;
	    if( ni < 0 ){
		oi -= ni;
		nlen += ni;
		ni = 0;
	    }
	    if( (ni + nlen) > oraw.width ){
		nlen -= (ni + nlen) - oraw.width;
	    }
	    if( nlen <= 0 ){
		return false;
	    }
	    ooff = (oj * oraw.width + oi) * bpp;
	    oU8 = new Uint8Array(oraw.data.buffer, ooff, nlen * bpp);
	    noff = (nj * oraw.width + ni) * bpp;
	    nU8 = new Uint8Array(nraw.data.buffer, noff, nlen * bpp);
	    nU8.set(oU8);
	}
	return true;
    });
    // allow chaining
    return this;
};

// rotate image by changing WCS info and calling reprojectData
// creates a new raw data layer ("rotate")
// angle is in degrees (since CROTA2 is in degrees)
JS9.Image.prototype.rotateData = function(...args){
    let raw, oheader, nheader, arad, sinrot, cosrot, pos, arr;
    let ocdelt1 = 0.0;
    let ocdelt2 = 0.0;
    let [angle, opts] = args;
    // sanity checks
    if( !this.raws || !this.raws[0] ){
	JS9.error("no raw data for reprojection");
    }
    // go back to original data for reprojection
    raw = this.raws[0];
    if( !raw.header || !raw.wcsinfo ){
	JS9.error("no WCS info available for reprojection");
    }
    // opts is optional
    opts = opts || {};
    // opts can be an object or json
    if( typeof opts === "string" ){
	try{ opts = JSON.parse(opts); }
	catch(e){ JS9.error(`can't parse rotate opts: ${opts}`, e); }
    }
    // save stash name
    opts.stash = "rotateData";
    // but make sure we can set the id
    opts.rawid = "rotate";
    // rotate raw data
    opts.oraw = JS9.RAWID0;
    // maintain current section, unless specified otherwise
    if( opts.resetSection !== true ){
	opts.resetSection = false;
    }
    // old and new header
    oheader = raw.header;
    nheader = JS9.extend(true, {}, oheader);
    // rotate around current center or file center (i.e., CRPIX1,2)
    opts.center = opts.center || JS9.globalOpts.rotationCenter;
    if( opts.center !== "file" && this.validWCS() ){
	pos = this.getPan();
	arr = JS9.pix2wcs(this.raw.wcs, pos.x, pos.y).trim().split(/\s+/);
	if( arr && arr.length > 1 ){
	    nheader.CRPIX1 = pos.x;
	    nheader.CRPIX2 = pos.y;
	    nheader.CRVAL1 = JS9.saostrtod(arr[0]);
	    if( JS9.isHMS(this.params.wcssys) ){
		nheader.CRVAL1 *= 15.0;
	    }
	    nheader.CRVAL2 = JS9.saostrtod(arr[1]);
	}
    }
    // normalized values from wcslib
    if( raw.wcsinfo ){
	ocdelt1 = raw.wcsinfo.cdelt1 || 0;
	ocdelt2 = raw.wcsinfo.cdelt2 || 0;
    }
    // string directives instead of a numeric angle
    if( typeof angle === "string" ){
	switch(angle.toLowerCase()){
	case "northisup":
	case "northup":
	    angle = 0;
	    if( ocdelt1 > 0 ){ ocdelt1 = -ocdelt1; }
	    if( ocdelt2 < 0 ){ ocdelt2 = -ocdelt2; }
	    break;
	default:
	    angle = parseInt(angle, 10);
	    break;
	}
    }
    // new header same as old, but with a changed angle
    // make up new WCS keywords
    // use CD matrix if possible, else set CROTA2
    if( JS9.notNull(oheader.CD1_1)  ){
	arad = -(angle * Math.PI / 180.0);
	sinrot = Math.sin(arad);
	cosrot = Math.cos(arad);
	nheader.CD1_1 =  oheader.CD1_1 * cosrot  + oheader.CD1_2 * sinrot;
	nheader.CD1_2 =  oheader.CD1_1 * -sinrot + oheader.CD1_2 * cosrot;
	nheader.CD2_1 =  oheader.CD2_1 * cosrot  + oheader.CD2_2 * sinrot;
	nheader.CD2_2 =  oheader.CD2_1 * -sinrot + oheader.CD2_2 * cosrot;
    } else {
	nheader.CROTA2 = angle;
	nheader.CDELT1 = ocdelt1;
	nheader.CDELT2 = ocdelt2;
    }
    // flag that we will use CROTA2 to modify LTM matrix
    // needed because Montage does not know about LTM
    opts.lcsUseRota2 = true;
    // save ptype if possible
    if( raw.wcsinfo ){
	nheader.ptype = raw.wcsinfo.ptype;
    }
    // save this routine so it can be reconstituted in a restored session
    this.xeqStashSave("rotateData", args.slice(), opts.rawid);
    // rotate by reprojecting the data
    return this.reprojectData(nheader, opts);
};

// low-level reprojection: creates reprojected file, but does not display it
// instead, it returns the name of the reprojected FITS file (runtime vfile)
// this is the basis for reprojectData, but can be used in other routines which
// require a reprojection
JS9.Image.prototype.reproject = function(wcsim, opts){
    let awvfile, awvfile2, wvfile, owvfile;
    let wcsheader, wcsstr, oheader, nheader, theader;
    let arr, ivfile, ovfile, rstr, key;
    let tab, tx1, tx2, ty1, ty2, s;
    let n, raw, avfile, earr, cmdswitches;
    let i, tid, traw, maxx, maxy, maxpix;
    let rcomplete = false;
    const twcs = {};
    const wcsexp = /SIMPLE|BITPIX|NAXIS|NAXIS[1-4]|AMDX|AMDY|CD[1-2]_[1-2]|CDELT[1-4]|CNPIX[1-4]|CO1_[1-9][0-9]|CO2_[1-9][0-9]|CROTA[1-4]|CRPIX[1-4]|CRVAL[1-4]|CTYPE[1-4]|CUNIT[1-4]|DATE|DATE_OBS|DC-FLAG|DEC|DETSEC|DETSIZE|EPOCH|EQUINOX|EQUINOX[a-z]|IMAGEH|IMAGEW|LATPOLE|LONGPOLE|MJD-OBS|PC00[1-4]00[1-4]|PC[1-4]_[1-4]|PIXSCALE|PIXSCAL[1-2]|PLTDECH|PLTDECM|PLTDECS|PLTDECSN|PLTRAH|PLTRAM|PLTRAS|PPO|PROJP[1-9]|PROJR0|PV[1-3]_[1-3]|PV[1-4]_[1-4]|RA|RADECSYS|SECPIX|SECPIX|SECPIX[1-2]|UT|UTMID|VELOCITY|VSOURCE|WCSAXES|WCSDEP|WCSDIM|WCSNAME|XPIXSIZE|YPIXSIZE|ZSOURCE|LTM|LTV/;
    const ptypeexp = /TAN|SIN|ZEA|STG|ARC/;
    const addwcsinfo = (header, wcsinfo) => {
	let theader;
	if( !wcsinfo ){ return header; }
	theader = JS9.extend(true, {}, header);
	if( JS9.isNull(theader.CRVAL1) && !JS9.isNull(wcsinfo.crval1) ){
	    theader.CRVAL1 = wcsinfo.crval1;
	}
	if( JS9.isNull(theader.CRVAL2) && !JS9.isNull(wcsinfo.crval2) ){
	    theader.CRVAL2 = wcsinfo.crval2;
	}
	if( JS9.isNull(theader.CRPIX1) && !JS9.isNull(wcsinfo.crpix1) ){
	    theader.CRPIX1 = wcsinfo.crpix1;
	}
	if( JS9.isNull(theader.CRPIX2) && !JS9.isNull(wcsinfo.crpix2) ){
	    theader.CRPIX2 = wcsinfo.crpix2;
	}
	if( JS9.isNull(theader.CDELT1) && !JS9.isNull(wcsinfo.cdelt1) ){
	    theader.CDELT1 = wcsinfo.cdelt1;
	}
	if( JS9.isNull(theader.CDELT2) && !JS9.isNull(wcsinfo.cdelt2) ){
	    theader.CDELT2 = wcsinfo.cdelt2;
	}
	if( JS9.isNull(theader.CROTA2) && !JS9.isNull(wcsinfo.crot) ){
	    theader.CROTA2 = wcsinfo.crot;
	}
	return theader;
    };
    // sanity checks
    if( !wcsim || this === wcsim ){ return; }
    if( !(JS9.fits && JS9.fits.capabilities &&
	  JS9.fits.capabilities.reprojection) ||
	typeof JS9.reproject !== "function" ){
	JS9.error("reproject is not supported by the active FITS adapter");
    }
    if( typeof JS9.vfile !== "function" ||
	typeof JS9.vunlink !== "function" ){
	JS9.error("reproject requires virtual-file support in the active FITS adapter");
    }
    if( !this.raws || !this.raws[0] ){
	JS9.error("no raw data for reprojection");
    }
    // go back to original data for reprojection
    raw = this.raws[0];
    if( !raw.header || !raw.wcsinfo ){
	JS9.error("no WCS info available for reprojection");
    }
    // opts is optional
    opts = opts || {};
    // make copy of input header, removing wcs keywords
    oheader = JS9.extend(true, {}, raw.header);
    for( key of Object.keys(oheader) ){
	if( wcsexp.test(key) ){
	    delete oheader[key];
	}
    }
    if( typeof wcsim === "object" ){
	// get wcs keywords from new header
	if( wcsim.raw && wcsim.raw.header ){
	    nheader = wcsim.raw.header;
	} else if( wcsim.BITPIX && wcsim.NAXIS1 && wcsim.NAXIS2 ){
	    // assume its a WCS header
	    nheader = wcsim;
	} else {
	    JS9.error("invalid wcs object input to reproject()");
	}
	for( key of Object.keys(nheader) ){
	    if( wcsexp.test(key) ){
		twcs[key] = nheader[key];
	    }
	}
	// combine new wcs keywords + old header keywords
	wcsheader = JS9.extend(true, {}, twcs, oheader);
	// sanity check on result
	if( !wcsheader.NAXIS || !wcsheader.NAXIS1 || !wcsheader.NAXIS2 ){
	    // JS9.error("invalid FITS image header");
	    return;
	}
	// restrict size of reprojection
	wcsheader.NAXIS1 = Math.min(wcsheader.NAXIS1,
				    JS9.globalOpts.image.xdim);
	wcsheader.NAXIS2 = Math.min(wcsheader.NAXIS2,
				    JS9.globalOpts.image.ydim);
	// convert reprojection header to a string
	wcsstr = JS9.raw2FITS(wcsheader, {addcr: true});
	// create vfile text file containing reprojection WCS
	wvfile = `wcs_${JS9.uniqueID()}.txt`;
	JS9.vfile(wvfile, wcsstr);
	// check limits on reprojection, if necessary
	if( JS9.globalOpts.reprojectLimits ){
	    // reprojection limits
	    maxx = JS9.globalOpts.image.xdim;
	    maxy = JS9.globalOpts.image.ydim;
	    // check max image dimension
	    maxpix = JS9.globalOpts.image.xdim * JS9.globalOpts.image.ydim;
	    // keep within the limits of current memory constraints, or die
	    if( (raw.header.NAXIS1 * raw.header.NAXIS2) > maxpix ){
		JS9.error(`the max reproject size is ${maxx} * ${maxy}. You can use the Bin/Filter/Section plugin to extract a section, then save it as FITS and reproject the smaller image.`);
	    }
	}
    } else {
	wvfile = wcsim;
    }
    // check input and reproj WCS to make sure we can run fast mProjectPP
    // if not, try to make an alternate WCS header amenable to mProjectPP
    try{
	// try to change input WCS to a sys usable by mProjectPP
	if( !ptypeexp.test(raw.wcsinfo.ptype) ){
	    theader = addwcsinfo(raw.header, raw.wcsinfo);
	    owvfile = `owcs_${JS9.uniqueID()}.txt`;
	    JS9.vfile(owvfile, JS9.raw2FITS(theader, {addcr: true}));
	    awvfile = `awcs_${JS9.uniqueID()}.txt`;
	    rstr = JS9.tanhdr(owvfile, awvfile, "");
	    if( JS9.DEBUG > 1 ){
		JS9.log("tanhdr (input): %s %s -> %s",
			owvfile, awvfile, rstr);
	    }
	    JS9.vunlink(owvfile);
	    if( rstr.search(/\[struct stat="OK"/) >= 0 ){
		// add command switch to use this alternate wcs
		opts.cmdswitches = opts.cmdswitches || "";
		opts.cmdswitches += ` -i ${awvfile}`;
	    }
	}
	// try to change reproject WCS to a sys usable by mProjectPP
	if( (wcsim.raw && !ptypeexp.test(wcsim.raw.wcsinfo.ptype)) ||
	    (wcsim.ptype && !ptypeexp.test(wcsim.ptype))           ){
	    theader = addwcsinfo(nheader, wcsim.raw.wcsinfo);
	    owvfile = `owcs_${JS9.uniqueID()}.txt`;
	    JS9.vfile(owvfile, JS9.raw2FITS(theader, {addcr: true}));
	    awvfile2 = `awcs_${JS9.uniqueID()}.txt`;
	    rstr = JS9.tanhdr(owvfile, awvfile2, "");
	    if( JS9.DEBUG > 1 ){
		JS9.log("tanhdr (reproj): %s %s -> %s",
			owvfile, awvfile2, rstr);
	    }
	    JS9.vunlink(owvfile);
	    if( rstr.search(/\[struct stat="OK"/) >= 0 ){
		// delete old wcs file and use this alternate wcsfile
		JS9.vunlink(wvfile);
		wvfile = awvfile2;
	    }
	}
    }
    catch(ignore){ /* empty */ }
    // get reference to existing raw data file (or create one)
    if( raw.hdu && raw.hdu.fits.vfile ){
	// input file name
	ivfile = raw.hdu.fits.vfile;
	// add extension name or number
	if( raw.hdu.fits.extname ){
	    ivfile += `[${raw.hdu.fits.extname}]`;
	} else if( raw.hdu.fits.extnum &&
		   (raw.hdu.fits.extnum > 0) ){
	    ivfile += `[${raw.hdu.fits.extnum}]`;
	}
    } else {
	// input file name
	arr = this.toArray();
	ivfile = this.id.replace(/\.png$/, "_png" +  ".fits");
	JS9.vfile(ivfile, arr);
    }
    // output file name
    s = this.id
	.replace(/\[.*\]/, "")
	.replace(/\.png$/i, ".fits")
	.replace(/\.fz$/i, "")
	.replace(/\.gz$/i, "");
    ovfile = `reproj_${JS9.uniqueID()}_${s}`;
    // remove previous vfile for this reprojection layer, if possible
    tid = opts.rawid || "reproject";
    for(i=0; i<this.raws.length; i++){
	traw = this.raws[i];
	if( traw.id === tid ){
	    if( JS9.cleanupFITSFile(traw, true) ){
		break;
	    }
	}
    }
    // for tables, we probably have to bin it by adding a bin specification
    // also need to pass the HDU name. For now, "EVENTS" is all we know ...
    if( raw.hdu && raw.hdu.imtab === "table" && raw.hdu.table ){
	if( !ivfile.match(/\[bin /) ){
	    if( !ivfile.match(/\[EVENTS\]/) ){
		ivfile += "[EVENTS]";
	    }
	    tab = raw.hdu.table;
	    tx1 = Math.floor(tab.xcen - (tab.xdim/2) + 1);
	    tx2 = Math.floor(tab.xcen + (tab.xdim/2));
	    ty1 = Math.floor(tab.ycen - (tab.ydim/2) + 1);
	    ty2 = Math.floor(tab.ycen + (tab.ydim/2));
	    ivfile += `[bin X=${tx1}:${tx2},Y=${ty1}:${ty2}]`;
	}
    }
    // call the reproject routine
    try{
	// name of (unneeded) area file
	n = ovfile.lastIndexOf(".");
	if( n >= 0 ){
	    avfile = `${ovfile.substring(0, n)}_area${ovfile.substring(n)}`;
	}
	// optional command line args
	cmdswitches = opts.cmdswitches || "";
	// no area file, but add global switches for reproject processing
	cmdswitches += ` -a 0 ${JS9.globalOpts.reprojSwitches}`;
	// call reproject
	rstr = JS9.reproject(ivfile, ovfile, wvfile, cmdswitches);
	if( JS9.DEBUG > 1 ){
	    JS9.log("reproject: %s %s %s [%s] -> %s",
		    ivfile, ovfile, wvfile, cmdswitches, rstr);
	}
	// delete unneeded files ...
	JS9.vunlink(avfile);
	JS9.vunlink(wvfile);
	if( awvfile ){
	    JS9.vunlink(awvfile);
	}
	if( arr ){
	    JS9.vunlink(ivfile);
	}
	// ... then error check
	if( rstr.search(/\[struct stat="OK"/) < 0 ){
	    // signal this we completed the reproject attempt
	    rcomplete = true;
	    earr = rstr.match(/msg="(.*)"/);
	    if( earr && earr[1] ){
		JS9.error(`${earr[1]} (from mProjectPP)`);
	    } else {
		JS9.error(rstr);
	    }
	}
    }
    catch(e){
	// avoid double error reporting
	if( !rcomplete ){
	    // delete unneeded files ...
	    JS9.vunlink(avfile);
	    JS9.vunlink(wvfile);
	    // call error handler
	    if( rstr ){
		JS9.error(rstr);
	    } else {
		JS9.error("WCS reproject failed", e);
	    }
	} else {
	    return;
	}
    }
    // return output file name
    return ovfile;
};

// high-level routine to reproject image using WCS info
// creates a new raw data layer ("reproject")
JS9.Image.prototype.reprojectData = function(...args){
    let i, im, ovfile;
    let [wcsim, opts] = args;
    // sanity check
    if( !wcsim ){ return; }
    if( !(JS9.fits && JS9.fits.capabilities &&
	  JS9.fits.capabilities.reprojection) ||
	typeof JS9.reproject !== "function" ){
	JS9.error("reprojectData is not supported by the active FITS adapter");
    }
    // is this a string containing an image name or WCS values?
    if( typeof wcsim === "string" ){
	if( wcsim === "all" ){
	    for(i=0; i<JS9.images.length; i++){
		im = JS9.images[i];
		if( this.display.id === im.display.id ){
		    im.reprojectData(this);
		}
	    }
	    return;
	}
	im = JS9.getImage(wcsim);
	if( im ){
	    // it was an image name, so change wcsim to the image handle
	    wcsim = im;
	} else {
	    JS9.error(`unknown WCS for reproject: ${wcsim}`);
	}
    }
    // don't reproject myself (useful in supermenu support, "all" reprojections)
    if( this === wcsim ){
	return;
    }
    // opts is optional
    opts = opts || {};
    // opts can be an object or json
    if( typeof opts === "string" ){
	try{ opts = JSON.parse(opts); }
	catch(e){ JS9.error(`can't parse reproject opts: ${opts}`, e); }
    }
    // save this routine so it can be reconstituted in a restored session
    // (unless another xxxData routine is calling us)
    if( !opts.rawid ){
	this.xeqStashSave("reprojectData", args.slice(), "reproject");
    }
    // save stash name
    if( !opts.stash ){
	opts.stash = "reprojectData";
    }
    // could take a while ...
    JS9.waiting(true, this.display);
    // set status
    this.setStatus("reprojectData", "processing");
    // ... start a timeout to allow the wait spinner to get started
    window.setTimeout(() => {
	let topts, reprojHandler;
	const defaultReprojHandler = (hdu) => {
	    // plugin callbacks
	    this.xeqPlugins("image", "onreprojectdata");
	    topts = topts || {};
	    topts.refreshRegions = true;
	    // reset section, unless specified otherwise
	    if( opts.resetSection !== false ){
		topts.resetSection = true;
	    }
	    // pass on the lcs flag
	    if( opts.lcsUseRota2 ){
		topts.lcsUseRota2 = true;
	    }
	    // refresh the image
	    this.refreshImage(hdu, topts);
	    // set status
	    this.setStatus("reprojectData", "complete");
	    // might have to re-execute calls in the stash
	    this.xeqStashCall(this.xeqstash, [opts.stash, "reprojectData"]);
	    // execute onreproject function
	    if( typeof opts.onreproject === "function" ){
		try{ JS9.xeqByName(opts.onreproject, window, this); }
		catch(e){ JS9.error("in onreproject callback", e, false); }
	    }
	};
	// opts is optional
	opts = opts || {};
	// handler
	reprojHandler = opts.reprojHandler || defaultReprojHandler;
	// call the low-level reproject routine, returning reprojected file
	ovfile = this.reproject(wcsim, opts);
	if( ovfile ){
	    // refresh image using the reprojected file ...
	    topts = JS9.extend(true, {}, JS9.fits.options, opts);
	    // ... in a new raw data layer
	    topts.rawid = topts.rawid || "reproject";
	    // save pointer to original wcs image
	    if( wcsim.raw && wcsim.raw.header ){
		topts.wcsim = wcsim;
	    }
	    // process the FITS file
	    try{ JS9.handleFITSFile(ovfile, topts, reprojHandler); }
	    catch(e){ JS9.error("can't process reprojected FITS file", e); }
	}
    }, JS9.SPINOUT);
    // allow chaining
    return this;
};

// apply image processing filters to the current RGB image
JS9.Image.prototype.filterRGBImage = function(...args){
    let [filter] = args;
    // no arg: return list of filters
    if( !filter ){
	return Object.keys(JS9.ImageFilters);
    }
    // pre-processing and special processing
    switch(filter){
    case "reset":
	// special case: reset to original RGB data, contrast/bias
	this.setColormap("reset");
	return this;
    case "median":
	// alias used in filters plugin
	filter = "medianFilter";
	break;
    case "edge":
	// alias used in filters plugin
	filter = "edgeDetect";
	break;
    default:
	break;
    }
    // sanity check
    if( !JS9.ImageFilters[filter] ){
	JS9.error(`JS9 image filter '${filter}' not available`);
    }
    // save this routine so it can be reconstituted in a restored session
    this.xeqStashSave("filterRGBImage", args.slice());
    // remove filter name arg
    args.shift();
    // add display context and RGB img arg
    args.unshift(this.display.context, this.rgb.img);
    // try to run the filter to generate a new RGB image
    try{ JS9.ImageFilters[filter](...args); }
    catch(e){ JS9.error(`JS9 image filter '${filter}' failed`, e); }
    // display new RGB image
    this.displayImage("display");
    // extended plugins
    if( JS9.globalOpts.extendedPlugins ){
	this.xeqPlugins("image", "onfilterrgbimage");
    }
    // allow chaining
    return this;
};

// move image to a different display
// maybe this should be refactored using more useful routines ...
// ... and should (some of) this code be in the Fabric section??
JS9.Image.prototype.moveToDisplay = function(dname){
    let i, im, key, layer, dlayer;
    let got = 0;
    const odisplay = this.display;
    const ndisplay = JS9.lookupDisplay(dname);
    // sanity check
    if( !dname || !ndisplay ){
	JS9.error(`could not find display: ${dname}`);
    }
    // clear old display first
    this.display.clearMessage();
    this.display.context.clear();
    // plugin callbacks
    this.xeqPlugins("image", "onimageclear");
    // make sure the main layers in the old display are in the new display
    for( key of Object.keys(odisplay.layers) ){
	if( (odisplay.layers[key].dtype === "main") &&
	    !ndisplay.layers[key] ){
	    ndisplay.newShapeLayer(key, odisplay.layers[key].opts);
	}
    }
    // turn off display of layers in new display
    // don't want them showing on the new image ...
    if( ndisplay.image ){
	for( key of Object.keys(ndisplay.layers) ){
	    if( ndisplay.layers[key].dtype === "main" ){
		ndisplay.image.showShapeLayer(key, false, {local: true});
	    }
	}
    }
    // re-assign each "main" layer from old display to new by:
    // saving the graphics, reassigning the canvas, restoring the graphics
    for( key of Object.keys(this.layers) ){
	layer = this.layers[key];
	dlayer = ndisplay.layers[key];
	if( dlayer ){
	    this.showShapeLayer(key, false, {local: true});
            layer.dlayer = dlayer;
            layer.divjq = dlayer.divjq;
            layer.canvasjq = dlayer.canvasjq;
            layer.canvas = dlayer.canvas;
	} else {
	    delete this.layers[key];
	}
    }
    // move "main" display from old to new
    this.display = ndisplay;
    // avoid erroneous save of previous layers
    this.display.image = this;
    // reset section to ensure proper display size
    this.mkSection();
    // and redisplay
    this.displayImage("all");
    // show shape layers in new display
    for( key of Object.keys(this.layers) ){
	this.showShapeLayer(key, true, {local: true});
    }
    // move rgb contribution, if necessary
    if( odisplay.rgb.rim === this ){
	odisplay.rgb.rim = null;
	ndisplay.rgb.rim = this;
    }
    if( odisplay.rgb.gim === this ){
	odisplay.rgb.gim = null;
	ndisplay.rgb.gim = this;
    }
    if( odisplay.rgb.bim === this ){
	odisplay.rgb.bim = null;
	ndisplay.rgb.bim = this;
    }
    // old display has no image
    odisplay.image = null;
    // ensure proper positions for graphics
    this.refreshLayers();
    // display a different image in old display, if possible
    for(i=0; i<JS9.images.length; i++){
	im = JS9.images[i];
	if( odisplay === im.display ){
	    // avoid erroneous save of previous layers
	    im.display.image = null;
	    im.displayImage("all");
	    // ensure proper positions for graphics
	    im.refreshLayers();
	    // flag we found an image
	    got++;
	    break;
	}
    }
    // if display is in a lightwin and there are no other images, close it
    if( !got && odisplay.winid && odisplay.winid.close ){
	i = JS9.inArray(odisplay, JS9.displays);
	if( i >= 0 ){
	    JS9.displays.splice(i, 1);
	}
	odisplay.winid.close();
    }
    // allow chaining
    return this;
};

// save session to a json file
// NB: save is an image method, load is a display method
JS9.Image.prototype.saveSession = function(file, opts){
    let i, obj, str, blob, layer, dlayer, tobj, key, im, lpos, ipos;
    const saveim = (im) => {
	// object holding session keys
	const obj = {};
	// filename
	obj.file = im.file;
	// display size info
	obj.dwidth = im.display.width;
	obj.dheight = im.display.height;
	// image params
	obj.params = JS9.extend(true, {}, im.params);
	// temp values: explicitly save some of them
	obj.tmp = {};
	if( im.tmp.gridStatus === "active" ){
	    obj.tmp.gridStatus = "active";
	}
	// get center of displayed image in physical coords
	lpos = im.imageToLogicalPos({x:im.rgb.sect.xcen,
				       y:im.rgb.sect.ycen});
	ipos = im.maybePhysicalToImage(lpos);
	if( ipos ){
	    lpos = ipos;
	}
	// save section info
	obj.sect = {};
	obj.sect.xcen = lpos.x;
	obj.sect.ycen = lpos.y;
	obj.sect.xdim = im.raw.width;
	obj.sect.ydim = im.raw.height;
	obj.sect.zoom = im.rgb.sect.zoom;
	// layers
	obj.layers = [];
	for( key of Object.keys(im.layers) ){
	    // save each main layer so it can be reconstituted
	    layer = im.layers[key];
	    dlayer = layer.dlayer;
	    // only save layers on main display
	    // don't save crosshair or grid
	    if( dlayer.dtype === "main" &&
		key !== "crosshair"     &&
		key !== "grid"          ){
		tobj = {};
		tobj.name = key;
		tobj.json = dlayer.canvas.toJSON(dlayer.el);
		tobj.dopts = JS9.extend(true, {}, dlayer.opts);
		if( layer.catalog ){
		    tobj.catalog = layer.catalog;
		}
		if( layer.starbase ){
		    tobj.starbase = JSON.stringify(layer.starbase);
		}
		obj.layers.push(tobj);
	    }
	    dlayer.canvas.forEachObject((obj) => {
		// look for winid's: they cause circular json errors
		if( obj.params && obj.params.winid ){
		    if( JS9.isVisibleNode(obj.params.winid) ){
			JS9.error("please close your region dialog box(es) to avoid a JSON circular reference error when saving this session");
		    } else {
			obj.params.winid = null;
		    }
		}
	    });
	}
	// save blend state
	obj.blend = im.blend;
	// save routines which must be executed when restoring session
	obj.xeqstash = im.xeqstash;
	// save wcsim reference, if necessary
	if( im.wcsim && im.wcsim.id ){
	    obj.wcsim = im.wcsim.id;
	}
	// remove old display info
	delete obj.params.display;
	// remove rot90 and flip, as we will recreate them
	obj.params.rot90 = 0;
	obj.params.flip = "none";
	// we didn't save the crosshair
	obj.params.crosshair = false;
	return obj;
    };
    if( !typeof saveAs === "function" ){
	JS9.error("no saveAs() available to save session");
    }
    // filename for saving
    file = file || "js9.ses";
    // make sure we have the right extension
    if( !file.match(/\.ses$/) ){
	file += ".ses";
    }
    // opts is optional
    opts = opts || {};
    // opts can be an object or json
    if( typeof opts === "string" ){
	try{ opts = JSON.parse(opts); }
	catch(e){ JS9.error(`can't parse session opts: ${opts}`, e); }
    }
    // change the cursor to show the waiting status
    JS9.waiting(true, this.display);
    // object we will save
    obj = {};
    // list of images to save
    obj.images = [];
    // which images to save?
    if( opts.mode === "display" ){
	// save all images in this display
	for(i=0; i<JS9.images.length; i++){
	    im = JS9.images[i];
	    if( im.display.id === this.display.id ){
		obj.images.push(saveim(im));
	    }
	}
    } else {
	// save current image
	obj.images.push(saveim(this));
    }
    // save display parameters
    obj.display = {blendMode: this.display.blendMode};
    // save global params
    obj.globals = JS9.extend(true, {}, JS9.globalOpts);
    // but delete properties which cause circular errors
    delete obj.globals.rgb;
    // save user-defined colormaps
    obj.cmaps = [];
    for(i=0; i<JS9.colormaps.length; i++){
	if( JS9.colormaps[i].source === "user" ){
	    obj.cmaps.push(JS9.colormaps[i]);
	}
    }
    // make a blob from the stringified session object
    try{ str = JSON.stringify(obj, null, 4); }
    catch(e){ JS9.error("can't create json file for save session", e); }
    blob = new Blob([str], {type: "application/json"});
    // save it
    JS9.saveAs(blob, file);
    // done waiting
    JS9.waiting(false);
    // return file name
    return file;
};

// stash a routine name and args
// the routine will be re-executed when the session is loaded
JS9.Image.prototype.xeqStashSave = function(func, args, id, context){
    let i, stash, len;
    // default context is image
    context = context || "image";
    // stash routine name and args
    this.xeqstash = this.xeqstash || [];
    // change display or image object to id
    for(i=0; i<args.length; i++){
	if( typeof args[i] === "object" ){
	    if( args[i] instanceof JS9.Image ){
		args[i] = args[i].id;
	    } else if( args[i] instanceof JS9.Display ){
		args[i] = args[i].id;
	    }
	}
    }
    // for most funcs: overwrite previous stash having the same func
    switch(func){
    case "setRot90":
	// two rots in the opposite direction cancel one another
	len = this.xeqstash.length;
	if( len >= 1                                  &&
	    this.xeqstash[len-1]                      &&
	    this.xeqstash[len-1].args[0] === -args[0] ){
	    this.xeqstash.pop();
	    return this;
	}
	break;
    case "setFlip":
	// two flips in the same direction cancel one another
	len = this.xeqstash.length;
	if( len >= 1                                 &&
	    this.xeqstash[len-1]                     &&
	    this.xeqstash[len-1].args[0] === args[0] ){
	    this.xeqstash.pop();
	    return this;
	}
	break;
    default:
	for(i=0; i<this.xeqstash.length; i++){
	    stash = this.xeqstash[i];
	    if( stash &&
		stash.func === func &&
		stash.context === context ){
		stash.args = args;
		return this;
	    }
	}
	break;
    }
    // add new func to stash
    this.xeqstash.push({func, args, id, context});
    // allow chaining
    return this;
};

// call a stashed routine name and args
JS9.Image.prototype.xeqStashCall = function(xeqstash, exclArr){
    let i, key, xeq;
    const doxeq = (func, xeq) => {
	let context = xeq.context || "image";
	try{
	    switch(context){
	    case "image":
		this[func](...xeq.args);
		break;
	    case "display":
		this.display[func](...xeq.args);
		break;
	    default:
		this[func](...xeq.args);
		break;
	    }
	}
	catch(e){
	    JS9.error(`error executing stash: ${func}`, e, false);
	}
    };
    xeqstash = xeqstash || this.xeqstash;
    if( JS9.isArray(xeqstash) ){
	for(i=0; i<xeqstash.length; i++){
	    xeq = xeqstash[i];
	    key = xeq.func;
	    if( JS9.inArray(key, exclArr) >= 0 ){
		continue;
	    }
	    doxeq(key, xeq);
	}
    } else {
	// backward compatibility: pre 3.1 used an object, not an array
	for( key of Object.keys(xeqstash) ){
	    if( JS9.inArray(key, exclArr) >= 0 ){
		continue;
	    }
	    xeq = xeqstash[key];
	    doxeq(key, xeq);
	}
    }
};

// remove a stash routine
JS9.Image.prototype.xeqStashDiscard = function(xid){
    let i, key;
    // sanity check
    if( !this.xeqstash ){ return; }
    if( JS9.isArray(this.xeqstash) ){
	for(i=this.xeqstash.length-1; i>=0; i--){
	    if( xid === this.xeqstash[i].func || xid === this.xeqstash[i].id ){
		this.xeqstash.splice(i,1);
	    }
	}
    } else {
	// pre 3.1 used an object
	for( key of Object.keys(this.xeqstash) ){
	    if( xid === key || xid === this.xeqstash[key].id ){
		delete this.xeqstash[key];
	    }
	}
    }
};

// execute plugins of various types (using type-specific values)
JS9.Image.prototype.xeqPlugins = function(xtype, xname, xval){
    let pname, pinst, popts, parr, evt;
    const xtrig = (name, obj) => {
        const s = `JS9:${name}`;
        JS9.triggerDocumentEvent(s, obj);
    };
    // sanity check
    if( !xtype || !xname || !JS9.globalOpts.xeqPlugins ){ return; }
    // array of plugin instances
    parr = this.display.pluginInstances || {};
    // look for plugin callbacks to execute
    for( pname of Object.keys(parr) ){
	pinst = parr[pname];
	popts = pinst.plugin.opts;
	if( pinst.isActive(xname) && typeof popts[xname] === "function" ){
	    this.callingPlugin = xname;
	    switch(xtype){
	    case "image":
		// used for: onimage[load,close,refresh,display]
		try{
		    popts[xname].call(pinst, this);
		    xtrig(xname, {im: this});
                }
		catch(e){ pinst.errLog(xname, e); }
		break;
	    case "region":
	    case "shape":
		// used for: on[layer]change
		// xval: pub
		try{
		    popts[xname].call(pinst, this, xval);
		    xtrig(xname, {im: this, xreg: xval});
                }
		catch(e){ pinst.errLog(xname, e); }
		break;
	    case "keydown":
	    case "keypress":
		// used for: onkeydown, onkeypress (deprecated)
		// xval: evt
		evt = xval.originalEvent || xval;
		try{
		    popts[xname].call(pinst, this, this.ipos, evt);
		    xtrig(xname, {im: this, ipos: this.ipos, evt: evt});
                }
		catch(e){ pinst.errLog(xname, e); }
		break;
	    case "mouse":
		// used for: onmouse[down,move,over,out]
		// xval: evt
		if( !this.clickInRegion || popts[`${xname}_inRegion`] ){
		    evt = xval.originalEvent || xval;
		    try{
			popts[xname].call(pinst, this, this.ipos, evt);
			xtrig(xname, {im: this, ipos: this.ipos, evt: evt});
                    }
		    catch(e){ pinst.errLog(xname, e); }
		}
		break;
	    }
	    delete this.callingPlugin;
	}
    }
    // allow chaining
    return this;
};

// upload virtual file to proxy server
JS9.Image.prototype.uploadFITSFile = function(){
    let vfile, vdata;
    const upcb = (r) => {
	delete JS9.worker.uploadActive;
	window.setTimeout(() => { JS9.progress(false); }, 1000);
	if( r.stderr ){
	    JS9.error(r.stderr);
	} else if( r.stdout ){
	    // set FITS filename and proxy filename
	    this.fitsFile = r.stdout.trim();
	    this.proxyFile = this.fitsFile;
	    if( JS9.globalOpts.prependJS9Dir         &&
		!this.fitsFile.match(/^\${JS9_DIR}/) &&
		this.fitsFile.charAt(0) !== "/"      ){
		this.fitsFile = `\${JS9_DIR}/${this.fitsFile}`;
	    }
	    // re-query for analysis
	    this.queryHelper("all");
	}
    };
    // sanity check
    if( !JS9.worker ){ return; }
    // only supported when using socket.io ...
    if( JS9.helper.type !== "nodejs" && JS9.helper.type !== "socket.io" ){
	return;
    }
    // ... and only when we have a virtual file to upload
    if( !this.raw.hdu || !this.raw.hdu.fits || !this.raw.hdu.fits.vfile ){
	return;
    }
    // only one upload at a time
    if( JS9.worker.uploadActive ){
	JS9.error("only one upload allowed at a time");
    }
    // this is the file to upload
    vfile = this.raw.hdu.fits.vfile;
    // ask the remote server if we can upload
    JS9.helper.send("quotacheck", null, (robj) => {
	// check quota, only errors matter
	if( robj.stderr || robj.errcode ){
	    JS9.error(robj.stderr || `from quotacheck: ${robj.errcode}`);
	}
	vdata = JS9.vread(vfile, "binary");
	JS9.worker.socketio(() => {
	    JS9.worker.uploadActive = true;
	    JS9.progress(true, this.display);
	    JS9.worker.send("uploadFITS", [vfile, vdata], upcb, [vdata.buffer]);
	});
    });
    return this;
};

// remove proxy file from a remote server
JS9.Image.prototype.removeProxyFile = function(s){
    let t, reset, file, regexp;
    const func = (r) => {
	if( reset ){
	    if( r && r.stdout.trim() === "OK" ){
		this.proxyFile = null;
		this.proxyParent = null;
		this.fitsFile = null;
		this.analysisPackages = null;
		this.queryHelper("all");
	    }
	}
    };
    // arg can be a boolean, which means remove proxyFile and reset
    if( typeof s === "boolean" ){
	reset = s;
    } else if( typeof s === "string" ){
	// specify file to remove in the working directory
	// check for attempt to break out of the working dir using abs path
	if( s.match(/^\//) ){
	    return;
	}
	// remove possible install dir prefix and then ...
	// check attempt to break out of the working dir using ".."
	regexp = new RegExp(`^${JS9.INSTALLDIR}`);
	t = s.replace(regexp, "");
	if( t.match(/\.\./) ){
	    return;
	}
	file = s;
    } else {
	// default is to remove the proxy file
	if( !this.proxyFile ){
	    return;
	}
	file = this.proxyFile;
	// also remove the proxyParent file, if necessary
	if( this.proxyParent ){
	    file = `${file} ${this.proxyParent}`;
	}
    }
    // sanity check
    if( !file ){ return; }
    // ask to remove proxy file, and process result
    JS9.Send('removeproxy', {'cmd': `js9Xeq removeproxy ${file}`}, func);
};

// convert table to a shape array for the given image
JS9.Image.prototype.starbaseToShapes = function(starbase, opts){
    let i, j, k, shape, pos, siz, reg, data, header, delims, sizefunc;
    let xcol, ycol, ra, dec, owcssys, wcssys, tcol, tregexp;
    const global = JS9.globalOpts.catalogs;
    const xcols = JS9.globalOpts.catalogs.ras;
    const ycols = JS9.globalOpts.catalogs.decs;
    const regs = [];
    const getpos = (ra, dec) => {
	let arr;
	arr = JS9.wcs2pix(this.raw.wcs, ra, dec).trim().split(/ +/);
	if( arr && arr.length ){
	    return {x: parseFloat(arr[0]), y: parseFloat(arr[1])};
	}
	return null;
    };
    const getcol = (starbase, header, cols, defcol) => {
	let i, j, col;
	if( defcol !== undefined ){
	    col = defcol;
	} else {
	    // look for an exact match
	    col = -1;
	    for(j=0; j<cols.length; j++){
		for(i=0; i<header.length; i++){
		    if( cols[j].toLowerCase() === header[i].toLowerCase() ){
			col = starbase[header[i]];
			break;
		    }
		}
		if( col >= 0 ){
		    break;
		}
	    }
	    // no exact match, look for an approx match
	    if( col < 0 ){
		tcol = cols[0];
		tregexp = new RegExp(`^${tcol}`, "i");
		for(i=0; i<header.length; i++){
		    if( header[i].match(tregexp) ){
			col = starbase[header[i]];
			break;
		    }
		}
	    }
	    // no approx match, look for a less restrictive approx match
	    if( col < 0 ){
		tcol = cols[0];
		tregexp = new RegExp(`.*${tcol}.*`, "i");
		for(i=0; i<header.length; i++){
		    if( header[i].match(tregexp) ){
			col = starbase[header[i]];
			break;
		    }
		}
	    }
	}
	return col;
    };
    // sanity check
    if( !starbase || !starbase.data || !starbase.headline ){ return; }
    data = starbase.data;
    header = starbase.headline;
    delims = starbase.delims;
    // opts is optional
    opts = opts || {};
    xcol = getcol(starbase, header, xcols, opts.xcol);
    if( xcol < 0 ){
	JS9.error("can't find an RA column (see Preferences:catalogs)");
    }
    ycol = getcol(starbase, header, ycols, opts.ycol);
    if( ycol < 0 ){
	JS9.error("can't find a Dec column (see Preferences:catalogs)");
    }
    // process shape
    shape = opts.shape || global.shape || "circle";
    switch(shape){
    case "box":
	// eslint-disable-next-line no-unused-vars
	sizefunc = () => {
	    return { width: opts.width   || global.width  || 7,
		     height: opts.height || global.height || 7 };
	};
	break;
    case "circle":
	// eslint-disable-next-line no-unused-vars
	sizefunc = () => {
	    return { radius: opts.radius || global.radius || 3.5};
	};
	break;
    case "ellipse":
	// eslint-disable-next-line no-unused-vars
	sizefunc = () => {
	    return { r1: opts.r1  || global.r1  || 3.5,
		     r2: opts.r2  || global.r2  || 3.5 };
	};
	break;
    default:
	// eslint-disable-next-line no-unused-vars
	sizefunc = () => {
	    return { width: opts.width || 7, height: opts.height || 7 };
	};
	break;
    }
    // save original wcs system
    owcssys = this.getWCSSys();
    // set wcs system for catalogs
    if( opts.wcssys ){
	wcssys = opts.wcssys;
    } else if( global.wcssys ){
	wcssys = global.wcssys;
    } else {
	// umm ...
	wcssys = "ICRS";
    }
    // set wcssys for this catalog
    this.setWCSSys(wcssys, false);
    // convert each catalog object in the table into a JS9 shape
    for(i=0, j=0; i<data.length; i++){
	ra = data[i][xcol];
	dec = data[i][ycol];
	// various ways we might specify hms
	if( (delims[xcol] !== "\0")  && (":h ".includes(delims[xcol])) &&
	    (wcssys !== "galactic")  && (wcssys !== "ecliptic")        ){
	    ra *= 15.0;
	}
	pos = getpos(ra, dec);
	if( pos ){
	    siz = sizefunc();
	    reg = {id: i.toString(), shape: shape,
		   x: pos.x, y: pos.y,
		   width: siz.width, height: siz.height,
		   radius: siz.radius,
		   r1: siz.r1, r2: siz.r2,
		   angle: 0,
		   data: {ra, dec}};
	    // save catalog columns for this row
	    if( (opts.save !== false) &&
		(JS9.globalOpts.catalogs.save !== false) ){
		for(k=0; k<=header.length; k++){
		    if( header[k] ){
			reg.data[header[k]] = data[i][k];
		    }
		}
	    }
	    if( opts.color ){
		reg.color = opts.color;
	    }
	    regs[j++] = reg;
	}
    }
    // restore original wcs
    this.setWCSSys(owcssys, false);
    return regs;
};

// read a tab-delimited, #-commented table (starbase table), create a catalog
JS9.Image.prototype.loadCatalog = function(...args){
    let [layer, catalog, opts] = args;
    let shapes, topts, starbase;
    const lopts = JS9.extend(true, {}, JS9.Catalogs.opts);
    const global = JS9.globalOpts.catalogs;
    const defconv = (s) => {
	const delims = " \t-.:hdmsr'\"";
	const obj = {};
	obj.val = JS9.saostrtod(s);
	obj.delim = String.fromCharCode(JS9.saodtype());
	if( (obj.delim !== "\0") && (delims.includes(obj.delim)) ){
	    // valid delim means we converted to a float
	    return obj;
	} else if( JS9.isNumber(s) ){
	    // no delim, but its a number, so must be an int
	    return obj;
	}
	// everything else is a string
	obj.val = s;
	return obj;
    };
    // special case: 1 non-string arg is the catalog, not the layer
    if( args.length === 1 && typeof layer !== "string" ){
	catalog = layer;
	layer = null;
    }
    // special case: 2 non-string args: file and obj, not the layer
    if( args.length === 2 && typeof layer !== "string" ){
	opts = catalog;
	catalog = layer;
	layer = null;
    }
    // sanity check
    if( !catalog ){ return; }
    if( global.tooltip ){
	lopts.tooltip = global.tooltip;
    }
    // opts is optional
    opts = opts || {};
    // opts can be an object or json
    if( typeof opts === "string" ){
	try{ opts = JSON.parse(opts); }
	catch(e){ JS9.error(`can't parse catalog opts: ${opts}`, e); }
    }
    // default color, if none specified
    opts.color = opts.color || global.color || "#00FF00";
    // wcs system
    opts.wcssys = opts.wcssys || global.wcssys;
    // update the WCS strings when adding a catalog shape
    opts.updateWCS = true;
    // starbase opts
    topts = {convFuncs:  {def: defconv},
	     units: opts.units || global.units,
	     skip:  opts.skip  || global.skip};
    // generate starbase table
    try{ starbase = new JS9.Starbase(catalog, topts); }
    catch(e){ JS9.error("could not parse catalog. Is it in tab-separated column format?"); }
    // sanity check
    if( !starbase || !starbase.data || !starbase.data.length ){
	JS9.error("no objects found in catalog");
    }
    // generate new catalog shapes
    shapes = this.starbaseToShapes(starbase, opts);
    if( shapes.length ){
	// layer name
	layer = layer || `catalog_${JS9.uniqueID()}` ;
	// create a new layer, if necessary
	this.display.newShapeLayer(layer, lopts);
	// delete any old shapes
	this.removeShapes(layer);
	// save the original catalog before adding shapes
	this.layers[layer].catalog = catalog;
	this.layers[layer].starbase = starbase;
	// add them to the catalog layer
	this.addShapes(layer, shapes, opts);
    } else {
	JS9.error("no catalog objects found");
    }
    // allow chaining
    return this;
};

// save catalog as a file
JS9.Image.prototype.saveCatalog = function(fname, which){
    let layer, cat, blob;
    layer = which || this.activeShapeLayer();
    if( !this.layers[layer] || !this.layers[layer].catalog ){
	if( layer && layer !== "undefined" ){
	    JS9.error(`no catalog available: ${layer}`);
	} else {
	    JS9.error("no active catalog available");
	}
    }
    cat = this.layers[layer].catalog;
    blob = new Blob([cat], {type: "text/plain;charset=utf-8"});
    fname = fname || `${layer}.cat`;
    if( !fname.match(/\.cat$/) ){
	fname += ".cat";
    }
    if( typeof saveAs === "function" ){
	JS9.saveAs(blob, fname);
    } else {
	JS9.error("no saveAs() available to save catalog");
    }
    return fname;
};

// convert ra, dec from one wcs to another
JS9.Image.prototype.wcs2wcs = function(from, to, ra, dec){
    let owcssys, ounits, nwcs, arr, x, y, s, v0;
    // save current wcs and units
    owcssys = this.getWCSSys();
    ounits = this.getWCSUnits();
    // to, from default to current wcs
    from = from || owcssys;
    to = to || owcssys;
    //  convert ra, dec from string input to float degrees, if necessary
    if( typeof ra === "string" ){
	v0 = JS9.strtoscaled(ra);
	if( JS9.isHMS(from, v0.dtype) ){
	    v0.dval *= 15.0;
	}
	ra = v0.dval;
    }
    if( typeof dec === "string" ){
	v0 = JS9.strtoscaled(dec);
	dec = v0.dval;
    }
    // temporarily set the wcs to what we are converting from
    nwcs = this.setWCSSys(from, false).getWCSSys();
    // make sure change was successful
    if( from !== "native" ){
	if( nwcs !== from ){
	    JS9.error(`unknown or invalid wcs: ${from}`);
	}
    }
    // convert input ra, dec into image pixels in this wcs
    arr = JS9.wcs2pix(this.raw.wcs, ra, dec).trim().split(/ +/);
    x = parseFloat(arr[0]);
    y = parseFloat(arr[1]);
    // set wcs back to the target wcs
    this.setWCSSys(to, false);
    // convert image pixels from input ra, dec into target wcs
    this.setWCSUnits("degrees", false);
    s = JS9.pix2wcs(this.raw.wcs, x, y).trim();
    // reset wcs to original
    this.setWCSUnits(ounits, false);
    if( owcssys !== to ){
	this.setWCSSys(owcssys, false);
    }
    // return result
    return s;
};

// convert wcs, physical or image image length to image length,
// using current wcs and string delimiters to determine what input type
JS9.Image.prototype.wcs2imlen = function(s){
    let v, wcsinfo, iscale;
    let dpp = 1;
    // sanity check
    if( !s ){ return; }
    v = JS9.strtoscaled(s);
    wcsinfo = this.raw.wcsinfo || {cdelt1: 1, cdelt2: 1};
    // oh dear, this is cheating ...
    if( wcsinfo.cdelt1 !== undefined ){
	dpp = wcsinfo.cdelt1;
    } else if( wcsinfo.cdelt2 !== undefined ){
	dpp = wcsinfo.cdelt2;
    }
    switch(this.params.wcssys){
    case "image":
	break;
    case "physical":
	// use LTM1_1 or LTM1_2 value stored for logical to image transforms
	if( this.lcs && this.lcs.physical ){
	    iscale = Math.sqrt(Math.pow(this.lcs.physical.forward[0][0],2) +
		               Math.pow(this.lcs.physical.forward[0][1],2));
	    v.dval = Math.abs(v.dval * iscale);
	}
	break;
    default:
	// cheap conversion of wcs len to image len
	if( v.dtype && (v.dtype !== ".") && (v.dtype !== "\0")  ){
	    v.dval = Math.abs(v.dval / dpp);
	}
	break;
    }
    return v.dval;
};

} // end JS9InstallImageData

if (typeof globalThis !== "undefined") {
    globalThis.JS9InstallImageData = JS9InstallImageData;
}
