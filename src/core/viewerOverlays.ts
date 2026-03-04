// @ts-nocheck
/* JS9 Plot, Catalogs, Crosshair, Grid, Dysel namespaces, FITS helpers, and utility functions. */
import { sprintf } from './sprintf';
import { JS9MathUtils } from './mathUtils';
import { saveAs, Spinner, dhtmlwindow } from './browserCompat';
"use strict";

function JS9InstallOverlays(JS9) {

// ---------------------------------------------------------------------
// plotting utilities
// ---------------------------------------------------------------------

JS9.Plot = {};

JS9.Plot.CLASS = "JS9";
JS9.Plot.NAME = "Plot";

// defaults for plot creation
JS9.Plot.opts = {
    // generic options
    annotate: false,
    annotateColor: "#FF0000",
    color: "blue",
    // flot options
    zoomStack: {
	enabled: true
    },
    selection: {
	mode: "xy"
    },
    series: {
	clickable: true,
	hoverable: true,
        lines: { show: true },
        points: { show: false }
    },
    legend: {
	backgroundColor: null,
	backgroundOpacity: 0
    },
    // plotly options
    xaxis: {
	autorange: true
    },
    yaxis: {
	autorange: true
    },
    // title for plot config dialog box
    title: "Plot Configuration",
    // plot configuration url
    configURL: "./params/plotconfig.html"
};

// log function. exponential function for plot
JS9.Plot.logfunc = function(v) { return v === 0 ? 0 : Math.log(v); };
JS9.Plot.expfunc = function(v) { return v === 0 ? 0 : Math.exp(v); };

// rescale a plot
JS9.Plot.rescale = function (divjq, plot, pobj, axis, scale, smin, smax){
    let opts, curaxis;
    const plotNode = JS9.resolveNode(divjq);
    // change the scale
    switch( JS9.globalOpts.plotLibrary ){
    case "flot":
	switch(axis){
	case "x":
	    curaxis = plot.getAxes().xaxis;
	    break;
	case "y":
	    curaxis = plot.getAxes().yaxis;
	    break;
	}
	switch(scale){
	case "linear":
	    curaxis.options.transform = null;
	    curaxis.options.inverseTransform = null;
	    pobj.curscale[axis] = scale;
	    break;
	case "log":
	    curaxis.options.transform = JS9.Plot.logfunc;
	    curaxis.options.inverseTransform = JS9.Plot.expfunc;
	    pobj.curscale[axis] = scale;
	    break;
	}
	if( JS9.isNumber(smin) ){
	    curaxis.options.min = Number.parseFloat(smin);
	} else if( smin == "" ){
	    curaxis.options.min = null;
	}
	if( JS9.isNumber(smax) ){
	    curaxis.options.max = Number.parseFloat(smax);
	} else if( smax == "" ){
	    curaxis.options.max = null;
	}
	plot.setupGrid();
	plot.draw();
	break;
    case "plotly":
	switch(axis){
	case "x":
	    opts = {xaxis: {type: scale, autorange: true}};
	    pobj.curscale[axis] = scale;
	    break;
	case "y":
	    opts = {yaxis: {type: scale, autorange: true}};
	    pobj.curscale[axis] = scale;
	    break;
	}
	if( plotNode ){
	    Plotly.restyle(plotNode.id, opts);
	}
	break;
    default:
	break;
    }
};

// anotate a plot
JS9.Plot.annotate = function (divjq, plot, pobj){
    let i, ann, ao, aobj, pos, ahtml, yTextOffset;
    const annotations = [];
    const data = pobj.data;
    const ac = pobj.annotations.color || JS9.Plot.opts.annotateColor;
    const plotNode = JS9.resolveNode(divjq);
    const getPos = (ann, data) => {
	let i, x, y;
	if( !ann.text ){
	    return null;
	}
	x = ann.x || 0;
	if( ann.y.toUpperCase() === "%Y" ){
	    for(i=1; i<data.length-1; i++){
		if( data[i][0] > x ){
		    y = Math.max(data[i-1][1], data[i][1], data[i+1][1]);
		    break;
		}
	    }
	} else {
	    y = ann.y;
	}
	return {x, y};
    };
    switch( JS9.globalOpts.plotLibrary ){
    case "flot":
	yTextOffset = -25;
	if( !plotNode ){
	    return;
	}
	plotNode.querySelectorAll(".plotAnnotation").forEach((node) => {
	    node.remove();
	});
	for(i=0; i<pobj.annotations.data.length; i++){
	    ann = pobj.annotations.data[i];
	    pos = getPos(ann, data);
	    ao = plot.pointOffset({ x: pos.x, y: pos.y });
	    if( (ao.left < 0) ||
		(ao.left > (plotNode.getBoundingClientRect().width || plotNode.offsetWidth)) ){
		continue;
	    }
	    ahtml = sprintf("<div class='plotAnnotation' style='position: absolute; left: %spx; top:%spx; color: %s; font-size: small'>%s</div>",
			    ao.left, ao.top+yTextOffset,
			    ac, `&darr;${ann.text}`);
	    plotNode.insertAdjacentHTML("beforeend", ahtml);
	}
	break;
    case "plotly":
	yTextOffset = -30;
	for(i=0; i<pobj.annotations.data.length; i++){
	    ann = pobj.annotations.data[i];
	    pos = getPos(ann, data);
	    if( !pos ){
		continue;
	    }
	    aobj = {x: pos.x, y: pos.y, xref: "x", yref: "y",
		    text: ann.text, arrowcolor: ac, font: {color: ac},
		    showarrow: true, arrowhead: 2, ax: 0, ay: yTextOffset};
	    annotations.push(aobj);
	}
	return annotations;
    }
};

// init the plot config form: called with the image context
// eslint-disable-next-line no-unused-vars
JS9.Plot.initConfigForm = function(plot, pobj){
    let val, key, mover, mout, winid, wid, formNode, winNode;
    let titleNode;
    const fmt= (val) => {
	if( val === undefined ){
	    return undefined;
	}
	if( (typeof val === "number") && (val % 1 !== 0) ){
	    val = Math.round((val + 0.001) * 100) / 100;
	}
	return(String(val));
    };
    // sanity check
    if( !plot || !pobj ){ return; }
    // convenience variables
    winid = plot.winid;
    winNode = JS9.resolveNode(winid);
    wid = winNode && winNode.id;
    formNode = winNode && winNode.querySelector("#plotConfigForm");
    // flot support only for now ...
    if( JS9.globalOpts.plotLibrary !== "flot" || !wid || !formNode ){ return; }
    // fill in the values from the plot
    formNode.querySelectorAll(".val").forEach((element) => {
	val = "";
	key = element.name;
	// key-specific pre-processing
	switch(key){
	case "xscale":
	    if( JS9.notNull(pobj.curscale.x) ){
		val = fmt(pobj.curscale.x);
	    }
	    break;
	case "xmin":
	    if( JS9.notNull(plot.getAxes().xaxis.options.min) ){
		val = fmt(plot.getAxes().xaxis.options.min);
	    }
	    break;
	case "xmax":
	    if( JS9.notNull(plot.getAxes().xaxis.options.max) ){
		val = fmt(plot.getAxes().xaxis.options.max);
	    }
	    break;
	case "yscale":
	    if( JS9.notNull(pobj.curscale.y) ){
		val = fmt(pobj.curscale.y);
	    }
	    break;
	case "ymin":
	    if( JS9.notNull(plot.getAxes().yaxis.options.min) ){
		val = fmt(plot.getAxes().yaxis.options.min);
	    }
	    break;
	case "ymax":
	    if( JS9.notNull(plot.getAxes().yaxis.options.max) ){
		val = fmt(plot.getAxes().yaxis.options.max);
	    }
	    break;
	default:
	    break;
	}
	element.value = val;
    });
    // save the image for later processing
    formNode._js9Image = this;
    formNode._js9Plot = plot;
    formNode._js9Pobj = pobj;
    formNode._js9Winid = winid;
    // add tooltip callbacks (not mobile: ios buttons stop working!)
    if( !formNode._js9TooltipInit ){
	formNode._js9TooltipInit = true;
	if( JS9.BROWSER[3] ){
	    mover = "touchstart";
	    mout = "touchend";
	} else {
	    mover = "mouseover";
	    mout = "mouseout";
	}
	titleNode = winNode.querySelector(JS9.lightOpts[JS9.LIGHTWIN].dragBar);
	formNode.querySelectorAll(".plotcol_P").forEach((target) => {
	    target.addEventListener(mover, (e) => {
		let title;
		const input = e.currentTarget.querySelector("input");
		const tooltip = input ? input.dataset.tooltip : "";
		if( tooltip && titleNode && titleNode.childNodes[0] ){
		    // change title: see dhtmlwindow.js load() @line 130
		    title = `${JS9.Plot.opts.title}: ${tooltip}`;
		    titleNode.childNodes[0].nodeValue = title;
		}
	    });
	    target.addEventListener(mout, () => {
		if( titleNode && titleNode.childNodes[0] ){
		    titleNode.childNodes[0].nodeValue = JS9.Plot.opts.title;
		}
	    });
	});
    }
};

// process the plot config form: called with the image context
// eslint-disable-next-line no-unused-vars
JS9.Plot.processConfigForm = function(form, plot, pobj, arr){
    let i, key, val;
    const alen = arr.length;
    // sanity check
    switch( JS9.globalOpts.plotLibrary ){
    case "flot":
	break;
    case "plotly":
	return;
    }
    // process array of keyword/values
    for(i=0; i<alen; i++){
	key = arr[i].name;
	val = arr[i].value;
	// key-specific processing
	switch(key){
	case "xscale":
	    if( val === "" ){ val = "linear"; }
	    JS9.Plot.rescale(null, plot, pobj, "x", val);
	    break;
	case "xmin":
	    JS9.Plot.rescale(null, plot, pobj, "x", null, val, null);
	    break;
	case "xmax":
	    JS9.Plot.rescale(null, plot, pobj, "x", null, null, val);
	    break;
	case "yscale":
	    if( val === "" ){ val = "linear"; }
	    JS9.Plot.rescale(null, plot, pobj, "y", val);
	    break;
	case "ymin":
	    JS9.Plot.rescale(null, plot, pobj, "y", null, val, null);
	    break;
	case "ymax":
	    JS9.Plot.rescale(null, plot, pobj, "y", null, null, val);
	    break;
	default:
	    break;
	}
    }
    JS9.Plot.initConfigForm.call(this, plot, pobj);
};

// backward compatibility pre-2.6 (and needed for assigning preferences)
JS9.plotOpts = JS9.Plot.opts;

// ---------------------------------------------------------------------
// Catalogs object defines high level calls for catalog plugin
// Mostly replaced by a call to newShapeLayer() and addShapes(),
// leaving on the options
// ---------------------------------------------------------------------

JS9.Catalogs = {};
JS9.Catalogs.CLASS = "JS9";
JS9.Catalogs.NAME = "Catalogs";

// defaults for new catalogs
JS9.Catalogs.opts = {
    // override fabric defaults
    hasControls: false,
    hasRotatingPoint: false,
    hasBorders: false,
    // evented: false,
    // catalog objects are locked in place by default
    // set "changeable" to true to unlock all, or unlock individually
    lockMovementX: true,
    lockMovementY: true,
    lockRotation: true,
    lockScalingX: true,
    lockScalingY: true,
    lockUniScaling: true,
    selectable: false,
    // canvas options
    canvas: {
	selection: false
    },
    // don't update WCS strings
    updateWCS: false,
    // pan and zoom enabled
    panzoom: true,
    // default shape
    shape: "circle",
    // general
    strokeWidth: 2,
    // box
    width: 10,
    height: 10,
    // circle
    radius: 5,
    // ellipse:
    eradius: {x: 5, y: 3},
    // angles (box, ellipse)
    angle: 0,
    // these should be ordered from more specific to less specific
    tagcolors: {
	defcolor:            "#00FF00"
    },
    // should overlapping shapes be sorted (smallest on top)?
    sortOverlapping: false
};

// ---------------------------------------------------------------------
// Crosshair object displays a wcs-aligned crosshair on other displays
// ---------------------------------------------------------------------

JS9.Crosshair = {};
JS9.Crosshair.CLASS = "JS9";
JS9.Crosshair.NAME = "Crosshair";
JS9.Crosshair.LAYERNAME = "crosshair";

// defaults for crosshair layer
JS9.Crosshair.opts = {
    // override fabric defaults
    hasControls: false,
    hasRotatingPoint: false,
    hasBorders: false,
    // evented: false,
    // user does not move the crosshair
    lockMovementX: true,
    lockMovementY: true,
    lockRotation: true,
    lockScalingX: true,
    lockScalingY: true,
    lockUniScaling: true,
    selectable: false,
    // canvas options
    canvas: {
	selection: false
    },
    // don't update WCS strings
    updateWCS: false,
    // pan and zoom enabled
    panzoom: false,
    // width and height when displaying arrow-key crosshair
    arrowSize: 14,
    // general
    strokeWidth: 1,
    // stroke color
    color: "#00FF00",
    // should overlapping shapes be sorted (smallest on top)?
    sortOverlapping: false,
    // where the crosshair is placed in order to hide it
    hiddenPts: {pts: [{x: -9999, y: -9999}, {x: -9999, y: -9900}]}
};

// display: display crosshair as the mouse moves
// eslint-disable-next-line no-unused-vars
JS9.Crosshair.display = function(im, ipos, evt){
    let i, s, arr, cim, ra, dec, w, h, x, y, hopts, vopts, shift, size;
    const layername = JS9.Crosshair.LAYERNAME;
    // sanity check
    if( !im ){ return; }
    // for computers, shift key must be down
    // for ipad, assume always true
    if( /iPad|iPhone|iPod/.test(navigator.platform) ){
	shift = true;
    } else {
	shift = evt.shiftKey;
    }
    // always do arrow crosshair, otherwise:
    // exit if crosshair is not enabled for this image
    // exit if we are not actively tracking the crosshair via shift
    if( !im.tmp.arrowCrosshair &&
	(!shift || im.tmp.shiftKey || !im.crosshair || !im.params.crosshair) ){
	return;
    }
    if( im.tmp.arrowCrosshair && !im.params.crosshair ){
	// special crosshair used with arrow keys
	size = JS9.Crosshair.opts.arrowSize / im.rgb.sect.zoom;
	x = ipos.x - size;
	w = ipos.x + size;
	y = ipos.y - size;
	h = ipos.y + size;
    } else {
	// default crosshair
	x = 0;
	w = im.raw.width;
	y = 0;
	h = im.raw.height;
    }
    // draw the crosshair, centered on the image pos
    hopts = {pts: [{x: x, y: ipos.y}, {x: w, y: ipos.y}], redraw: false};
    im.changeShapes(layername, im.crosshair.h, hopts);
    vopts = {pts: [{x: ipos.x, y: y}, {x: ipos.x, y: h}], redraw: true};
    im.changeShapes(layername, im.crosshair.v, vopts);
    im.crosshair.visible = true;
    // if crosshair mode is on and this image has wcs ...
    if( JS9.globalOpts.wcsCrosshair && im.validWCS() ){
	// get wcs coords of current mouse position
	arr = JS9.pix2wcs(im.raw.wcs, ipos.x, ipos.y).trim().split(/\s+/);
	ra = JS9.saostrtod(arr[0]);
	if( JS9.isHMS(im.params.wcssys) ){
	    ra *= 15.0;
	}
	dec = JS9.saostrtod(arr[1]);
	// for each displayed image ...
	for(i=0; i<JS9.displays.length; i++){
	    cim = JS9.displays[i].image;
	    if( cim && cim !== im                     &&
		cim.crosshair && cim.params.crosshair &&
		cim.validWCS()                        ){
		// if the ra, dec pos is on this image, display crosshair
		w = cim.raw.width;
		h = cim.raw.height;
		// convert wcs pos to image pos for this image
		// trap uncaught errors => we were way off scale
		try{ s = JS9.wcs2pix(cim.raw.wcs, ra, dec); }
		catch(e){ s = null; }
		if( s ){
		    arr = s.trim().split(/\s+/);
		    x = parseFloat(arr[0]);
		    y = parseFloat(arr[1]);
		    // if image pos is within the image boundaries ...
		    if( x > 0 && x < w && y > 0 && y < h ){
			// draw the crosshair, centered on the image pos
			hopts = {pts: [{x: 0, y: y}, {x: w, y: y}],
				 redraw:false};
			cim.changeShapes(layername, cim.crosshair.h, hopts);
			vopts = {pts: [{x: x, y: 0}, {x: x, y: h}],
				redraw: true};
			cim.changeShapes(layername, cim.crosshair.v, vopts);
			cim.crosshair.visible = true;
		    }
		}
	    }
	}
    }
};

// hide: move the crosshair out of the display
// eslint-disable-next-line no-unused-vars
JS9.Crosshair.hide = function(im, ipos, evt){
    const layername = JS9.Crosshair.LAYERNAME;
    const opts = JS9.Crosshair.opts.hiddenPts;
    // sanity check
    if( !im ){ return; }
    // if the crosshair is visible ...
    if( (im.crosshair && im.crosshair.visible) ||
	im.tmp.arrowCrosshairVisible           ){
	// move it off the display
	im.changeShapes(layername, im.crosshair.h, opts);
	im.changeShapes(layername, im.crosshair.v, opts);
	im.crosshair.visible = false;
	delete im.tmp.arrowCrosshairVisible;
    }
};

// image load: create the cross hair for this image
JS9.Crosshair.create = function(im){
    const opts = JS9.Crosshair.opts.hiddenPts;
    const layername = JS9.Crosshair.LAYERNAME;
    // sanity check
    if( !im ){ return; }
    if( !im.crosshair ){
	// create the crosshair object for this image
	im.crosshair = {};
	// create the crosshair, but don't display it yet
	im.crosshair.h = im.addShapes(layername, "line", opts);
	im.crosshair.v = im.addShapes(layername, "line", opts);
	im.crosshair.visible = false;
    }
};

// mark key actions which use the shift key
JS9.Crosshair.keyaction = function(im, ipos, evt){
    if( im && evt && evt.shiftKey ){
	im.tmp.shiftKey = true;
    }
};

// unmark key action-based shift key use
JS9.Crosshair.keyup = function(im, ipos, evt){
    // remove shiftKey marker, if necessary
    if( im && im.tmp.shiftKey && evt && !evt.shiftKey ){
	delete im.tmp.shiftKey;
    }
};

// init: create the shape layer for this display
JS9.Crosshair.init = function(){
    let i;
    const layername = JS9.Crosshair.LAYERNAME;
    // init the crosshair shape layer, but only once per display
    for(i=0; i<JS9.displays.length; i++){
	if( !JS9.displays[i].layers.crosshair ){
	    JS9.displays[i].newShapeLayer(layername, JS9.Crosshair.opts);
	}
    }
    return this;
};

// toggle display of crosshair
JS9.Image.prototype.toggleCrosshair = function(){
    this.params.crosshair = !this.params.crosshair;
    if( !this.params.crosshair ){
        JS9.Crosshair.hide(this);
    }
};

// toggle display of wcs crosshair
JS9.Image.prototype.toggleWCSCrosshair = function(){
    JS9.globalOpts.wcsCrosshair = !JS9.globalOpts.wcsCrosshair;
};

// ---------------------------------------------------------------------
// Grid object displays a wcs coordinate grid
// ---------------------------------------------------------------------

JS9.Grid = {};
JS9.Grid.CLASS = "JS9";
JS9.Grid.NAME = "Grid";
JS9.Grid.LAYERNAME = "grid";

// defaults for grids
JS9.Grid.opts = {
    // evented: false,
    movable: false,
    cover: "display",
    reduceDims: true,
    strokeWidth: 1,
    margin:   0,
    labelMargin: 10,
    stride:  32,
    raLines:  8,
    raSkip:  0,
    raAngle:  0,
    decLines: 8,
    decSkip: 0,
    decAngle:  90,
    sexaPrec: 1,
    degPrec: 3,
    lineColor: "#00FFFF",
    labelColor: "#00FFFF",
    labelFontFamily: "Helvetica, sans-serif",
    labelFontSize: 11,
    labelFontStyle: "normal",
    labelFontWeight: 300,
    labelRAOffx: 3,
    labelRAOffy: -1,
    labelDecOffx: -14,
    labelDecOffy: 6
};

// this is the problem routine: hard to get a heuristic which will:
// 1. pick a "natural" number of lines (depends on size of image)
// 2. put the lines on "natural" wcs boundaries (.1 degree or every 10 arcsec)
JS9.Grid.limits = function(opts, in0, in1, n){
    let trange, tscale, out0, out1, outinc;
    trange = in1 - in0;
    if( trange > 1 ){
	tscale = 10;
    } else if( trange > 0.1 ){
	tscale = 100;
    } else if( trange > 0.01 ){
	tscale = 1000;
    } else if( trange > 0.001 ){
	tscale = 10000;
    } else if( trange > 0.0001 ){
	tscale = 100000;
    } else {
	tscale = 1000000;
    }
    out0 = Math.floor(in0 * tscale) / tscale;
    out1 = Math.ceil(in1 * tscale) / tscale;
    outinc = Math.ceil(((out1 - out0) / n) * tscale) / tscale;
    return {lo: out0, hi: out1, inc: outinc};
};

// generate label value
JS9.Grid.getLabel = function(opts, v, which){
    let i, t, idx, arr;
    let doall = false;
    switch(opts.wcsunits){
    case "sexagesimal":
	if( (which === "ra") &&
	    ((opts.wcssys !== "galactic") && (opts.wcssys !== "ecliptic")) ){
	    v /= 15.0;
	}
	t = JS9.saodtostr(v, ":", opts.sexaPrec);
	arr = t.split(":");
	if( opts.last[which] ){
	    t = "";
	    for(i=0; i<arr.length; i++){
		if( t ){ t += ":"; }
		if( doall || arr[i] !== opts.last[which][i] ){
		    t += arr[i];
		    doall = true;
		}
	    }
	}
	opts.last[which] = JS9.extend({}, arr);
	break;
    default:
	t = v.toFixed(opts.degPrec);
	break;
    }
    t = t.replace(/0+$/, "");
    idx = t.indexOf(".");
    if( idx < 0 ){
	t += ".0";
    } else if( idx === t.length -1 ){
	t += "0";
    }
    t = t.replace(/:\.0/, ":0.0");
    return t;
};

// generate and display a coordinate grid of Line shapes
// call with image context
JS9.Grid.display = function(mode, myopts){
    let i, n, s, t, x, y, lineloc, arr, inc, got;
    let ra, dec, ra0, ra1, dec0, dec1, rainc, decinc;
    let raoffx, raoffy, decoffx, decoffy, raskip, decskip, lastra, lastdec;
    let xrainc0, xrainc, xralim, xdecinc0, xdecinc, xdeclim, ipos, dpos;
    let ratios, corners, opts;
    let out = {};
    const display = this.display;
    const raw = this.raw;
    const lims = [{ra:0, dec:0}, {ra:0, dec:0}, {ra:0, dec:0}, {ra:0, dec:0}];
    // no arg: return current grid display status
    if( JS9.isNull(mode) ){
	// toggle display
	switch(this.tmp.gridStatus){
	case "inactive":
	case undefined:
	    return false;
	case "active":
	case "processing":
	    return true;
	default:
	    return true;
	}
    }
    // delete previous grid
    this.removeShapes(JS9.Grid.LAYERNAME);
    // if false or no wcs, set inactive status and return
    if( mode === false || !this.raw.wcs || this.raw.wcs <= 0 ){
	this.tmp.gridStatus = "inactive";
	return;
    }
    // local opts are optional
    myopts = myopts || {};
    // myopts can be an object or json
    if( typeof myopts === "string" ){
	try{ myopts = JSON.parse(myopts); }
	catch(e){ JS9.error("can't parse displayCoordGrid JSON", e); }
    }
    // we are actively creating a grid
    this.tmp.gridStatus = "processing";
    // get opts
    opts = JS9.extend(true, {}, JS9.Grid.opts, myopts);
    // labels will follow current wcs units
    opts.wcsunits = this.getWCSUnits();
    opts.wcssys = this.getWCSSys();
    // keep track of labels as we go along
    opts.last = {};
    // wcslib wants degrees
    JS9.wcsunits(this.raw.wcs, "degrees");
    // if we will cover the whole image, change the ratio and corner values
    if( opts.cover === "image" ){
	ratios = [Math.max(1, Math.floor(raw.width  / display.width)),
		  Math.max(1, Math.floor(raw.height / display.height))];
	corners = [{x: 0, y: 0}, {x: raw.width-1, y: raw.height-1}];
    } else {
	if( opts.reduceDims ){
	    if( raw.width < raw.height ){
		ratios = [raw.width / raw.height, 1];
	    } else if( raw.height < raw.width ){
		ratios = [1, raw.height / raw.width];
	    } else {
		ratios = [1,1];
	    }
	} else {
	    ratios = [1,1];
	}
	corners = [];
	dpos = {x: this.ix + opts.margin,
		y: this.iy - opts.margin};
	ipos = this.displayToImagePos(dpos);
	corners[0] = {x: ipos.x, y: ipos.y};
	dpos = {x: display.width - 1 - this.ix - opts.margin,
		y: display.height - 1 - this.iy - opts.margin};
	ipos = this.displayToImagePos(dpos);
	corners[1] = {x: ipos.x, y: ipos.y};
    }
    // wcs coords at corners of display
    s = JS9.pix2wcs(raw.wcs, corners[0].x, corners[0].y).trim().split(/\s+/);
    lims[0].ra = JS9.saostrtod(s[0]);
    lims[0].dec = JS9.saostrtod(s[1]);
    s = JS9.pix2wcs(raw.wcs, corners[0].x, corners[1].y).trim().split(/\s+/);
    lims[1].ra = JS9.saostrtod(s[0]);
    lims[1].dec = JS9.saostrtod(s[1]);
    s = JS9.pix2wcs(raw.wcs, corners[1].x, corners[0].y).trim().split(/\s+/);
    lims[2].ra = JS9.saostrtod(s[0]);
    lims[2].dec = JS9.saostrtod(s[1]);
    s = JS9.pix2wcs(raw.wcs, corners[1].x, corners[1].y).trim().split(/\s+/);
    lims[3].ra = JS9.saostrtod(s[0]);
    lims[3].dec = JS9.saostrtod(s[1]);
    ra0 = lims[0].ra;
    dec0 = lims[0].dec;
    ra1 = lims[0].ra;
    dec1 = lims[0].dec;
    // initial ra,dec limits in ascending order
    for(i=1; i<4; i++){
	ra0 = Math.min(ra0, lims[i].ra);
	dec0 = Math.min(dec0, lims[i].dec);
	ra1 = Math.max(ra1, lims[i].ra);
	dec1 = Math.max(dec1, lims[i].dec);
    }
    // calculate normalized ra limits
    out = JS9.Grid.limits.call(this, opts, ra0, ra1, opts.raLines*ratios[0]);
    ra0 = out.lo;
    ra1 = out.hi;
    rainc = out.inc;
    // find best line for RA labels
    // calculate normalized dec limits
    out = JS9.Grid.limits.call(this, opts, dec0, dec1, opts.decLines*ratios[1]);
    dec0 = out.lo;
    dec1 = out.hi;
    decinc = out.inc;
    // restore original values
    JS9.wcsunits(this.raw.wcs, opts.wcsunits);
    // loop limits
    xrainc0 = Math.abs(this.raw.wcsinfo.cdelt1);
    xrainc = xrainc0 * JS9.Grid.opts.stride;
    xralim = ra1 - xrainc;
    xdecinc0 = Math.abs(this.raw.wcsinfo.cdelt2);
    xdecinc = xdecinc0 * JS9.Grid.opts.stride;
    xdeclim = dec1 - xdecinc;
    // start grid regions
    s = "image;";
    // lines of constant RA
    for(ra=ra0; ra<=ra1; ra=ra+rainc){
	t = "line(";
	inc = xdecinc0;
	lineloc = 0;
	n = 0;
        for(dec=dec0; dec<=dec1; dec=dec+inc){
	    arr = JS9.wcs2pix(raw.wcs, ra, dec).trim().split(/ +/);
	    if( arr && arr.length ){
		x = parseFloat(arr[0]);
		y = parseFloat(arr[1]);
		if( x >= -opts.margin && x <= raw.width + opts.margin  &&
		    y >= -opts.margin && y <= raw.height + opts.margin ){
		    t += String(`${x + 1},${y}${1}, `);
		    n++;
		    if( lineloc === 0 ){
			lineloc = 1;
			if( dec < xdeclim ){
			    inc = xdecinc;
			}
		    } else if( lineloc === 1 ){
			if( dec > xdeclim ){
			    lineloc = 2;
			    inc = xdecinc0;
			}
		    }
		} else {
		    if( lineloc === 1 ){
			lineloc = 2;
			dec = dec - inc;
			inc = xdecinc0;
		    }
		}
	    }
	}
	if( n > 1 ){
	    s += t.replace(/,\s+$/, ") ");
	    s += ` {"color": "${opts.lineColor}"};`;
	}
    }
    // lines of constant Dec
    for(dec=dec0; dec<=dec1; dec=dec+decinc){
	t = "line(";
	inc = xrainc0;
	lineloc = 0;
	n = 0;
        for(ra=ra0; ra<=ra1; ra=ra+inc){
	    arr = JS9.wcs2pix(raw.wcs, ra, dec).trim().split(/ +/);
	    if( arr && arr.length ){
		x = parseFloat(arr[0]);
		y = parseFloat(arr[1]);
		if( x >= -opts.margin && x <= raw.width + opts.margin  &&
		    y >= -opts.margin && y <= raw.height + opts.margin ){
		    t += String(`${x + 1},${y}${1}, `);
		    n++;
		    if( lineloc === 0 ){
			lineloc = 1;
			if( ra < xralim ){
			    inc = xrainc;
			}
		    } else if( lineloc === 1 ){
			if( ra > xralim ){
			    lineloc = 2;
			    inc = xrainc0;
			}
		    }
		} else {
		    if( lineloc === 1 ){
			lineloc = 2;
			ra = ra - inc;
			inc = xrainc0;
		    }
		}
	    }
	}
	if( n > 1 ){
	    s += t.replace(/,\s+$/, ") ");
	    s += ` {"color": "${opts.lineColor}"};`;
	}
    }
    // dec labels along constant ra line
    decoffx = opts.labelDecOffx / this.rgb.sect.zoom;
    decoffy = opts.labelDecOffy / this.rgb.sect.zoom;
    decskip = 0;
    lastra = ra0;
    for(ra=ra0, got=0; ra<=ra1; ra=ra+rainc){
	for(dec=dec0; dec<=dec1; dec=dec+decinc){
	    arr = JS9.wcs2pix(raw.wcs, ra, dec).trim().split(/ +/);
	    if( arr && arr.length ){
		x = parseFloat(arr[0]);
		y = parseFloat(arr[1]);
		dpos = this.imageToDisplayPos({x, y});
		if( dpos.x > (this.ix+opts.labelMargin) && dpos.x < (this.rgb.img.width+this.ix-opts.labelMargin) &&
		    dpos.y > (this.iy+opts.labelMargin) && dpos.y < (this.rgb.img.height+this.iy-opts.labelMargin)){
		    if( decskip >= opts.decSkip ){
			s += sprintf('text(%s,%s,%s,%s) {"color":"%s", "fontFamily":"%s", "fontSize":%s, "fontStyle":"%s", "fontWeight":"%s", "originX":"left", "originY":"top"};',
				 x + decoffx, y + decoffy,
				 JS9.Grid.getLabel.call(this, opts, dec, "dec"),
				 opts.decAngle,
				 opts.labelColor,
				 opts.labelFontFamily,
				 opts.labelFontSize,
				 opts.labelFontStyle,
				 opts.labelFontWeight);
			got++;
		    } else {
			if( ra !== lastra ){
			    decskip++;
			}
			lastra = ra;
		    }
		}
	    }
	}
	if( got ){
	    break;
	}
    }
    // ra labels along constant dec line
    raoffx = opts.labelRAOffx / this.rgb.sect.zoom;
    raoffy = opts.labelRAOffy / this.rgb.sect.zoom;
    raskip = 0;
    lastdec = dec0;
    for(dec=dec0, got=0; dec<=dec1; dec=dec+decinc){
	for(ra=ra0; ra<=ra1; ra=ra+rainc){
	    arr = JS9.wcs2pix(raw.wcs, ra, dec).trim().split(/ +/);
	    if( arr && arr.length ){
		x = parseFloat(arr[0]);
		y = parseFloat(arr[1]);
		dpos = this.imageToDisplayPos({x, y});
		if( dpos.x > (this.ix+opts.labelMargin) && dpos.x < (this.rgb.img.width+this.ix-opts.labelMargin) &&
		    dpos.y > (this.iy+opts.labelMargin) && dpos.y < (this.rgb.img.height+this.iy-opts.labelMargin)){
		    if( raskip >= opts.raSkip ){
			s += sprintf('text(%s,%s,%s,%s) {"color":"%s", "fontFamily":"%s", "fontSize":%s, "fontStyle":"%s", "fontWeight":"%s", "originX":"left", "originY":"top"};',
				 x + raoffx, y + raoffy,
				 JS9.Grid.getLabel.call(this, opts, ra, "ra"),
				 opts.raAngle,
				 opts.labelColor,
				 opts.labelFontFamily,
				 opts.labelFontSize,
				 opts.labelFontStyle,
				 opts.labelFontWeight);
			got++;
		    } else {
			if( dec !== lastdec ){
			    raskip++;
			}
			lastdec = dec;
		    }
		}
	    }
	}
	if( got ){
	    break;
	}
    }
    // add the grid shapes
    this.addShapes(JS9.Grid.LAYERNAME, s, opts);
    // grid is complete and active
    this.tmp.gridStatus = "active";
};

// toggle grid on/off
JS9.Grid.toggle = function(im){
    // sanity check
    if( !im ){ return; }
    // toggle display
    switch(im.tmp.gridStatus){
    case undefined:
    case null:
    case "inactive":
	// start afresh
	im.displayCoordGrid(true);
	break;
    case "active":
	// clear the grid
	im.displayCoordGrid(false);
	break;
    case "processing":
    default:
	break;
    }
};

// display grid, as needed
JS9.Grid.regrid = function(im){
    if( im ){
	// ignore if grid is not active or the image is not loaded
	if( im.tmp.gridStatus !== "active" || im.status.load !== "complete" ){
	    return;
	}
	// redraw the grid
	im.displayCoordGrid(true);
    }
};

// plugin init: load our grid methods
// eslint-disable-next-line no-unused-vars
JS9.Grid.init = function(opts){
    let dlayer;
    opts = JS9.extend(true, {}, JS9.Catalogs.opts, JS9.Grid.opts, opts);
    // init the display shape layer
    dlayer = this.display.newShapeLayer(JS9.Grid.LAYERNAME, opts);
    // mouse up: no-op
    dlayer.canvas.on("mouse:up", () => {
	    return false;
    });
};

// add to image prototypes
JS9.Image.prototype.displayCoordGrid = JS9.Grid.display;

// check if an object is an image handle
JS9.isImage = function(s){
    if( typeof s === "object"   &&
	JS9.notNull(s.id)       &&
	JS9.notNull(s.raw)      &&
	JS9.notNull(s.rgb)      &&
	JS9.notNull(s.params)   &&
	JS9.notNull(s.display)  ){
	return true;
    } if( typeof s === "string" && JS9.lookupImage(s) ){
	return true;
    }
    return false;
};

// ---------------------------------------------------------------------
// Dysel: callbacks when a display is selected dynamically
// ---------------------------------------------------------------------

JS9.Dysel = {};
JS9.Dysel.CLASS = "JS9";
JS9.Dysel.NAME = "Dysel";

JS9.Dysel.display = null;
JS9.Dysel.plugins = [];

// plugin init: no op
// eslint-disable-next-line no-unused-vars
JS9.Dysel.init = function(opts){
    return;
};

// unhighlight current selection
JS9.Dysel.unhighlightSelection = function(){
    let nodes;
    if( JS9.bugs.webkit_resize ){
	nodes = document.querySelectorAll(".JS9 .JS9Image");
    } else {
	nodes = document.querySelectorAll(".JS9");
    }
    nodes.forEach((node) => {
	node.classList.remove("JS9Highlight");
    });
};

// highlight display when dynamic selection is made
JS9.Dysel.highlightSelection = function(im){
    let disp;
    let node;
    // sanity check
    if( !im || !JS9.Dysel.retrievePlugins().length ){ return; }
    // optimization: no processing if we only have one display
    if( JS9.displays.length === 1 ){ return; }
    // unhighlight all
    JS9.Dysel.unhighlightSelection();
    // the display to highlight
    disp = im.display;
    // highlight selected
    if( JS9.bugs.webkit_resize ){
	node = JS9.resolveNode(disp.divjq);
	if( node ){
	    node.querySelectorAll(".JS9Image").forEach((imageNode) => {
		imageNode.classList.add("JS9Highlight");
	    });
	}
    } else {
	node = JS9.resolveNode(disp.divjq);
	if( node ){
	    node.classList.add("JS9Highlight");
	}
    }
};

// add to dynamic selection array
JS9.Dysel.addPlugins = function(plugin){
    JS9.Dysel.plugins.push(plugin);
};

// get dynamic selection array
JS9.Dysel.retrievePlugins = function(){
    return JS9.Dysel.plugins;
};

// return current dynamically selected display
JS9.Dysel.getDisplay = function(which){
    if( !JS9.Dysel.retrievePlugins().length ){
	return null;
    }
    if( which === "previous" ){
	return JS9.Dysel.odisplay;
    }
    return JS9.Dysel.display;
};

// return the display object associated with the current dynamic selection
// or else a default value
JS9.Dysel.getDisplayOr = function(def){
    if( def === "previous" ){
	return JS9.Dysel.getDisplay(def);
    }
    return JS9.Dysel.getDisplay() || def;
};

// set current dynamically selected display
JS9.Dysel.select = function(display){
    // sanity check
    if( !display || !JS9.Dysel.retrievePlugins().length ){ return; }
    // save old display
    JS9.Dysel.odisplay = JS9.Dysel.display;
    // set new display
    JS9.Dysel.display = display;
    if( display.image ){
	JS9.Dysel.highlightSelection(display.image);
	// plugin callbacks for selected display
	display.image.xeqPlugins("image", "ondynamicselect", null);
    }
};

// imageload: select the display
JS9.Dysel.imageload = function(im){
    if( im ){
	JS9.Dysel.select(im.display);
    }
};

// imageclose: select another display, if necessary
JS9.Dysel.imageclose = function(im){
    let i, got, disp;
    if( im ){
	disp = JS9.Dysel.getDisplay();
	if( !disp || disp.image !== im ){
	    return;
	}
	// if this the last image in this display?
	for(i=0, got=0; i<JS9.images.length; i++){
	    if( im.display === JS9.images[i].display ){
		got++;
	    }
	}
	// if so, select another image in another display
	if( got <= 1 ){
	    for(i=0; i<JS9.displays.length; i++){
		disp = JS9.displays[i];
		if( im.display !== disp && disp.image ){
		    JS9.Dysel.select(JS9.displays[i]);
		    return;
		}
	    }
	}
    }
};

// public alias for plugin developers
JS9.getDynamicDisplayOr = JS9.Dysel.getDisplayOr;

// ---------------------------------------------------------------------
// Titlebar: titlebar updates
// ---------------------------------------------------------------------

JS9.Titlebar = {};
JS9.Titlebar.CLASS = "JS9";
JS9.Titlebar.NAME = "Titlebar";

// plugin init: save initial title
// eslint-disable-next-line no-unused-vars
JS9.Titlebar.init = function(opts){
    if( !JS9.Titlebar.title ){
	JS9.Titlebar.title = document.title;
    }
};

// change titlebar when image is loaded
JS9.Titlebar.imageload = function(im){
    if( im && JS9.globalOpts.updateTitlebar ){
	JS9.Titlebar.imid = im.id;
	document.title = `${JS9.Titlebar.title}: ${JS9.Titlebar.imid}`;
    }
};

// change titlebar when image is displayed
JS9.Titlebar.imagedisplay = function(im){
    if( im && im.id !== JS9.Titlebar.imid && JS9.globalOpts.updateTitlebar ){
	JS9.Titlebar.imid = im.id;
	document.title = `${JS9.Titlebar.title}: ${JS9.Titlebar.imid}`;
    }
};

// change titlebar when image is closed
JS9.Titlebar.imageclose = function(){
    if( JS9.globalOpts.updateTitlebar ){
	document.title = JS9.Titlebar.title;
    }
};

// ---------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------

// sigh ... why do we need this polyfill??? (chrome pre-38)
Math.log10 = Math.log10 || function(x){
  return Math.log(x) / Math.LN10;
};

// javascript: the good parts p. 22
if( typeof Object.create !== "function" ){
    Object.create = function(o){
	const F = function(){return;};
	F.prototype = o;
	return new F();
    };
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/asinh
Math.asinh = Math.asinh || function(x){
  if (x === -Infinity){
    return x;
  }
  return Math.log(x + Math.sqrt(x * x + 1));
};

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/sinh
Math.sinh = Math.sinh || function(x){
  return (Math.exp(x) - Math.exp(-x)) / 2;
};

// polyfill for ES2017 Array.prototype.includes from:
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/includes
// From https://github.com/kevlatus/polyfill-array-includes/blob/master/array-includes.js
if (!Array.prototype.includes){
  Object.defineProperty(Array.prototype, "includes", {
    value: function (searchElement, fromIndex) {

      // 1. Let O be ? ToObject(this value).
      if (this == null) {
        throw new TypeError('"this" is null or not defined');
      }

      var o = Object(this);

      // 2. Let len be ? ToLength(? Get(O, "length")).
      var len = o.length >>> 0;

      // 3. If len is 0, return false.
      if (len === 0) {
        return false;
      }

      // 4. Let n be ? ToInteger(fromIndex).
      //    (If fromIndex is undefined, this step produces the value 0.)
      var n = fromIndex | 0;

      // 5. If n ≥ 0, then
      //  a. Let k be n.
      // 6. Else n < 0,
      //  a. Let k be len + n.
      //  b. If k < 0, let k be 0.
      var k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);

      function sameValueZero(x, y) {
        return x === y || (typeof x === "number" && typeof y === "number" && isNaN(x) && isNaN(y));
      }

      // 7. Repeat, while k < len
      while (k < len) {
        // a. Let elementK be the result of ? Get(O, ! ToString(k)).
        // b. If SameValueZero(searchElement, elementK) is true, return true.
        // c. Increase k by 1.
        if (sameValueZero(o[k], searchElement)) {
          return true;
        }
        k++;
      }

      // 8. Return false
      return false;
    }
  });
}

// make a copy of the raw data
// used by setFlip and setRot90
JS9.getRawCopy = function(oraw, bitpix){
    // make copy
    let nraw = JS9.extend(true, {}, oraw);
    nraw.bitpix = bitpix || oraw.bitpix;
    switch(nraw.bitpix){
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
	JS9.error(`unsupported bitpix: ${nraw.bitpix}`);
	break;
    }
    return nraw;
};

// extract line from raw data
// used by setFlip and setRot90
JS9.getRawLine = function(oraw, ooff, nraw, noff){
    let obuf, nbuf;
    switch(oraw.bitpix){
    case 8:
	obuf = new Uint8Array(oraw.data.buffer, ooff, oraw.width);
	nbuf = new Uint8Array(nraw.data.buffer, noff, oraw.width);
	break;
    case 16:
    case -16:
	obuf = new Uint16Array(oraw.data.buffer, ooff, oraw.width);
	nbuf = new Uint16Array(nraw.data.buffer, noff, oraw.width);
	break;
    case 32:
	obuf = new Uint32Array(oraw.data.buffer, ooff, oraw.width);
	nbuf = new Uint32Array(nraw.data.buffer, noff, oraw.width);
	break;
    case -32:
	obuf = new Float32Array(oraw.data.buffer, ooff, oraw.width);
	nbuf = new Float32Array(nraw.data.buffer, noff, oraw.width);
	break;
    case -64:
	obuf = new Float64Array(oraw.data.buffer, ooff, oraw.width);
	nbuf = new Float64Array(nraw.data.buffer, noff, oraw.width);
	break;
    default:
	JS9.error(`unsupported bitpix: ${oraw.bitpix}`);
	break;
    }
    return [obuf, nbuf];
};

// https://www.html5rocks.com/en/tutorials/webgl/typed_arrays/
JS9.memcpy = function(dst, dstOffset, src, srcOffset, length){
  var dstU8 = new Uint8Array(dst, dstOffset, length);
  var srcU8 = new Uint8Array(src, srcOffset, length);
  dstU8.set(srcU8);
};

// set explicit focus for IPython/Jupyter support
JS9.jupyterFocus = function(el, el2){
    let root;
    if( {}.hasOwnProperty.call(window, "Jupyter") ){
	root = JS9.resolveNode(el);
	el2 = el2 || "input, textarea";
	if( root ){
	    root.querySelectorAll(el2).forEach((element) => {
		Jupyter.keyboard_manager.register_events(element);
	    });
	}
    }
};

// return a unique value for a given image id by appending <n> to the id
JS9.getImageID = function(imid, dispid, myim){
    let i, im, s;
    let ids = 0;
    let idmax = 1;
    const imlen = JS9.images.length;
    const rexp = /.*<([0-9][0-9]*)>$/;
    const rexp2 = /<[0-9][0-9]*>/;
    imid = JS9.cleanPath(imid.replace(rexp2, ""), "id");
    for(i=0; i<imlen; i++){
	im = JS9.images[i];
	if( im.display.id === dispid ){
	    if( (im !== myim) && (imid === im.id0.replace(rexp2, "")) ){
		if( im.id && im.id.search(rexp) >= 0 ){
		    s = im.id.replace(rexp, "$1");
		    idmax = Math.max(idmax, parseInt(s, 10));
		}
		ids++;
	    }
	}
    }
    if( ids ){
	return `${imid}<${String(idmax+1)}>`;
    }
    return imid;
};

// return a unique value for ids
JS9.uniqueID = (function(){
    let id = 1; // initial value
    return function(){
        return id++;
    };
}());

// change cursor to waiting/not waiting
JS9.waiting = function(mode, display){
    let el, opts, tdisp;
    const body = document.body;
    switch(mode){
    case true:
	if( typeof Spinner === "function" &&
	    (JS9.globalOpts.waitType === "spinner")   ){
	    if( display ){
		if( typeof display === "object" ){
		    el = JS9.resolveNode(display.divjq);
		} else if( typeof display === "string" ){
		    tdisp = JS9.lookupDisplay(display);
		    if( tdisp ){
			el = JS9.resolveNode(tdisp.divjq);
		    }
		}
	    }
	    if( !el ){
		el = body;
	    }
	    if( !JS9.spinner ){
		JS9.spinner = {};
		opts = {color:   JS9.globalOpts.spinColor,
			opacity: JS9.globalOpts.spinOpacity};
		JS9.spinner.spinner = new Spinner(opts);
	    }
	    JS9.spinner.spinner.spin(el);
	} else {
	    if( body ){
		body.classList.add("waiting");
	    }
	}
	break;
    case false:
	if( typeof Spinner === "function" &&
	    (JS9.globalOpts.waitType === "spinner")   ){
	    if( JS9.spinner ){
		JS9.spinner.spinner.stop();
	    }
	} else {
	    if( body ){
		body.classList.remove("waiting");
	    }
	}
	break;
    }
};

// display a progress bar
JS9.progress = function(arg1, arg2){
    if( (typeof arg1 === "boolean") || (typeof arg1 === "string") ){
	switch(arg1){
	case true:
	case "indeterminate":
	    if( arg2 ){
		JS9.progress.display = arg2;
		JS9.progress.display.displayMessage("progress", arg1);
	    }
	    break;
	case false:
	case "":
	    if( JS9.progress.display ){
		JS9.progress.display.clearMessage("progress");
		delete JS9.progress.display;
	    }
	    break;
	}
    } else if( typeof arg1 === "number" ){
	if( JS9.progress.display ){
	    JS9.progress.display.displayMessage("progress", [arg1, arg2]);
	}
    }
};

// msg coming from socket.io or postMessage
JS9.msgHandler = function(msg, cb){
    let i, s, obj, tdisp, res, dobj;
    let args = [];
    const cmd = msg.cmd;
    const id = msg.id;
    const oalerts = JS9.globalOpts.alerts;
    const rstr = JS9.globalOpts.quietReturn ? "" : "OK";
    const getDisplayObject = (id, args) => {
	if( id ){
	    // bash sends a string, not an object
	    if( args.length > 0 ){
		s = args[args.length-1];
		if( typeof s === "string" ){
		    try{ obj = JSON.parse(s); }
		    catch(e){ obj = null; }
		} else if( typeof s === "object" ){
		    obj = s;
		}
		// is this the display object? see JS9.parsePublicArgs
		if( obj                                    &&
		    (typeof obj === "object")              &&
		    {}.hasOwnProperty.call(obj, "display") &&
		    (Object.keys(obj).length === 1)        ){
		    // remove the current display object
		    args.pop();
		    // return the new one
		    return obj;
		} else {
		    return {display: id};
		}
	    } else {
		return {display: id};
	    }
	}
	return null;
    };
    // turn off alerts
    if( cb ){
	JS9.globalOpts.alerts = false;
    }
    // look for a public API call
    if( JS9.publics[cmd] ){
	// check for non-array first arg
	if( !JS9.isArray(msg.args) ){
	    msg.args = [msg.args];
	}
	// change empty quoted strings to empty strings
	for(i=0; i<msg.args.length; i++){
	    if( msg.args[i] === "''" || msg.args[i] === '""' ){
		msg.args[i] = "";
	    }
	}
	// deep copy of arg array
	args = JS9.extend(true, [], msg.args);
	// get display object (temporarily remove it, if necessary)
	dobj = getDisplayObject(id, args);
	// pre-processing
	switch(cmd){
	case "RunAnalysis":
	    // if RunAnalysis has a callback, call it when the helper returns
	    if( cb ){
		// add opts arg if not already present
		if( args.length === 1 ){
		    args.push(null);
		}
		// add callback arg
		args.push(cb);
	    }
	    break;
	default:
	    break;
	}
	// add (back) the display object
	if( dobj ){
	    args.push(dobj);
	}
	// call public API
	try{ res = JS9.publics[cmd](...args); }
	catch(e){ res = `ERROR: ${e.message}`; }
	if( cb ){
	    JS9.globalOpts.alerts = oalerts;
	    // last ditch effort to avoid passing back image or display objects
	    if( res instanceof JS9.Display || res instanceof JS9.Image ){
		res = res.id;
	    }
	    // post-processing
	    switch(cmd){
	    case "NewShapeLayer":
		if( res && res.layerName ){
		    res = res.layerName;
		}
		break;
	    case "RunAnalysis":
		// only callback on error, runAnalysis did non-error case
		if( !res.match(/^ERROR:/) ){
		    cb = null;
		}
		break;
	    default:
		break;
	    }
	    if( cb ){
		cb(res);
	    }
	}
	return res;
    }
    // skip blank lines and comments
    if( !cmd || (cmd === "#") ){
	if( cb ){
	    cb("");
	}
	if( cb ){
	    JS9.globalOpts.alerts = oalerts;
	}
	return;
    }
    // get command and display
    obj = JS9.lookupCommand(cmd);
    tdisp = JS9.lookupDisplay(id, false);
    if( obj && tdisp ){
	obj.getDisplayInfo(tdisp);
	if( msg.args ){
	    // deep copy of arg array
	    args = JS9.extend(true, [], msg.args);
	} else if( msg.paramlist ){
	    args = msg.paramlist.split(/ +/);
	}
	switch(obj.getWhich(args)){
	case "get":
	    // execute get call
	    try{ res = obj.get(args) || ""; }
	    catch(e){ res = `ERROR: ${e.message}`;}
	    break;
	case "set":
	    // execute set call
	    try{ res = obj.set(args) || rstr; }
	    catch(e){ res = `ERROR: ${e.message}`;}
	    break;
	default:
	    res = `ERROR: unknown cmd type for '${cmd}'`;
	    break;
	}
    } else {
	if( !obj ){
	    res = `ERROR: unknown cmd '${cmd}'`;
	}
	if( !tdisp ){
	    res = `ERROR: unknown display (${id})`;
	}
    }
    // turn on alerts, do message callback, if necessary
    if( cb ){
	JS9.globalOpts.alerts = oalerts;
	// last ditch effort to avoid passing back image or display objects
	if( res instanceof JS9.Display || res instanceof JS9.Image ){
	    res = res.id;
	}
	cb(res);
    }
    return res;
};

// create a light window
// someday we might want other options ...
JS9.lightWin = function(id, type, s, title, winformat){
    let rval;
    let node;
    let dragBars;
    const qsel = `#${id} `;
    // winformat is optional
    winformat = winformat || "";
    // create the light window
    switch(JS9.LIGHTWIN){
    case "dhtml":
	// if no positioning, add the default
	if( !winformat.match(/(left|top|center)=/) ){
	    if( winformat ){ winformat = winformat + ","; }
	    winformat = winformat + `${JS9.globalOpts.lightWinPos}`;
	}
	rval = dhtmlwindow.open(id, type, s, title, winformat);
	// override dhtml to add ios scroll capability
	if(  /iPad|iPhone|iPod/.test(navigator.platform) ){
	    node = document.querySelector(qsel + JS9.lightOpts[JS9.LIGHTWIN].drag);
	    if( node ){
		node.style.webkitOverflowScrolling = "touch";
		node.style.overflowY = "scroll";
	    }
	}
	// allow double-click or double-tap to close ...
	// ... the close button is unresponsive on the ipad/iphone
	dragBars = document.querySelectorAll(qsel + JS9.lightOpts[JS9.LIGHTWIN].dragBar);
	dragBars.forEach((dragBar) => {
	    dragBar.addEventListener("dblclick", () => {
		rval.close();
	    });
	    dragBar.addEventListener("touchend", (e) => {
		const curtime = (new Date()).getTime();
		const lasttime = parseInt(e.currentTarget.dataset.lasttime || "", 10);
		if( lasttime                             &&
		    (curtime - lasttime) > JS9.DBLCLICK0 &&
		    (curtime - lasttime) < JS9.DBLCLICK  ){
		    rval.close();
		}
		e.currentTarget.dataset.lasttime = String(curtime);
	    });
	});
	// if ios user failed to close the window via the close button,
	// give a hint (once per session only!)
	dragBars.forEach((dragBar) => {
	    dragBar.addEventListener("touchend", () => {
		// skip check if we are dragging
		if( !dhtmlwindow.distancex  && !dhtmlwindow.distancey ){
		    if( JS9.lightOpts.nclick >= 2 ){
			alert("trouble closing this window? double-tap the window handle");
			JS9.lightOpts.nclick = -1;
		    } else {
			if( JS9.lightOpts.nclick >= 0 ){
			    JS9.lightOpts.nclick++;
			}
		    }
		} else {
		    if( JS9.lightOpts.nclick > 0 ){
			JS9.lightOpts.nclick = 0;
		    }
		}
	    });
	});
        break;
    default:
        break;
    }
    return rval;
};

// wrapper for new func to avoid jslint errors
JS9.checkNew = function(obj){
    if( !obj ){
	JS9.error("internal failure in a JS9 constructor");
    }
};

JS9.resolveNode = function(value){
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

JS9.getNodeOffset = function(value){
    const node = JS9.resolveNode(value);
    let rect;
    if( !node || !node.getBoundingClientRect ){
	return {left: 0, top: 0};
    }
    rect = node.getBoundingClientRect();
    return {
	left: rect.left + window.pageXOffset,
	top: rect.top + window.pageYOffset
    };
};

JS9.isVisibleNode = function(value){
    const node = JS9.resolveNode(value);
    let style;
    if( !node ){
	return false;
    }
    style = window.getComputedStyle(node);
    return style.display !== "none" &&
	style.visibility !== "hidden" &&
	node.getClientRects().length > 0;
};

JS9.onElementAvailable = function(rootSelector, selector, callback){
    let target;
    const root = JS9.resolveNode(rootSelector);
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

// desperate attempt to regularize the control/meta key
JS9.specialKey = function(e){
    return (e.metaKey || e.ctrlKey);
};

// desperate attempt to regularize the stracktrace message
JS9.strace = function(e){
    let s = "";
    if( JS9.DEBUG > 1 ){
	s = e.stack || e.stacktrace || "";
    }
    return s;
};

JS9.floatToString = function(fval){
    return JS9MathUtils.floatToString(fval, JS9.globalOpts.floatPrecision);
};

JS9.floatPrecision = function(fval1, fval2){
    return JS9MathUtils.floatPrecision(fval1, fval2);
};

JS9.floatFormattedString = function(fval, prec, jj){
    return JS9MathUtils.floatFormattedString(fval, prec, jj);
};

JS9.centerPolygon = function(points){
    return JS9MathUtils.centerPolygon(points);
};

JS9.centroidPolygon = function(points, doaverage){
    return JS9MathUtils.centroidPolygon(points, doaverage);
};

// return the image object for the specified image object, name, or filename
JS9.lookupImage = function(id, display){
    let i, im, did;
    const ilen= JS9.images.length;
    // sanity check
    if( !id ){ return null; }
    for(i=0; i<ilen; i++){
	im = JS9.images[i];
	if( (id === im )      || (id === im.id)                          ||
	    (id === im.file)  || (id === im.file.replace(/\[.*\]$/, "")) ||
	    (id === im.file0) || (id === (JS9.TOROOT + im.file))         ||
	    (im.fitsFile      && (id === im.fitsFile)) ){
	    // make sure the display still exists (light windows disappear)
	    if( JS9.resolveNode(im.display.id) ){
		did = im.display.id;
		if( !display                                            ||
		    (typeof display === "string" && display === did)    ||
		    (typeof display === "object" && display.id === did) ){
		    return im;
		}
	    }
	}
    }
    return null;
};

// return the display for the specified id
// id can be a display object or an id from a display object
JS9.lookupDisplay = function(id, mustExist){
    let i;
    const regexp = new RegExp(`[-_]?(${JS9.PLUGINS})$`);
    // default is the id must exist
    if( mustExist === undefined ){
	mustExist = true;
    }
    // lookup id
    if( id && (id.toString().search(JS9.SUPERMENU) < 0) ){
	// look for whole id
	for(i=0; i<JS9.displays.length; i++){
	    if( (id === JS9.displays[i])     ||
		(id === JS9.displays[i].id)  ||
		(id === JS9.displays[i].oid) ){
		return JS9.displays[i];
	    }
	}
	// try removing id suffix to get base id
	if( typeof id === "string" ){
	    id = id.replace(regexp,"");
	    for(i=0; i<JS9.displays.length; i++){
		if( (id === JS9.displays[i])     ||
		    (id === JS9.displays[i].id)  ||
		    (id === JS9.displays[i].oid) ){
		    return JS9.displays[i];
		}
	    }
	}
        // an id was specified but not found
        if( mustExist ){
	    JS9.error(`can't find JS9 display with id: ${id}`);
        }
        else {
            return null;
        }
    }
    // no id: return whatever we have
    return JS9.displays[0];
};

// return the image object for the specified image id or display id
JS9.getImage = function(id){
    let im = null;
    let display = null;
    // first look for an image file
    im = JS9.lookupImage(id);
    // then look for a display id
    if( !im ){
	display = JS9.lookupDisplay(id, false);
	// return associated image, if possible
	if( display ){
	    im = display.image;
	}
    }
    return im;
};

// look for specified vfile among raw0 hdus
// used to determine if its safe to delete a vfile
JS9.lookupVfile = function(vfile){
    let i, j, im, raw;
    const arr = [];
    // sanity check
    if( !vfile ){ return arr; }
    // check raw0 hdu for specified vfile
    for(i=0; i<JS9.images.length; i++){
	im = JS9.images[i];
	for(j=0; j<im.raws.length; j++){
	    raw = im.raws[j];
	    if( raw.hdu && raw.hdu.fits && (vfile === raw.hdu.fits.vfile) ){
		arr.push({im: im, raw: raw, idx: j});
	    }
	}
    }
    return arr;
};

// load javascript dynamically
// https://stackoverflow.com/questions/21294/dynamically-load-a-javascript-file
JS9.loadScript = function(url, func, error){
    // adding the script tag to the head as suggested before
    const head = document.getElementsByTagName("head")[0];
    const script = document.createElement("script");
    script.type = "text/javascript";
    // callback
    if( func ){
	script.onload = func;
    }
    // error
    if( error ){
	script.onerror = error;
    }
    script.src = url;
    // fire the loading
    head.appendChild(script);
};

// fetch a file URL (as a blob) and process it
// (as of 2/2015: can't use JS9.ajax to retrieve a blob: use low-level xhr)
JS9.fetchURL = function(name, url, opts, handler){
    let nurl;
    const xhr = new XMLHttpRequest();
    // opts is optional
    opts = opts || {};
    // sanity check
    if( !name && !url ){
	JS9.error("invalid url specification for fetchURL");
    }
    // either url or name can be blank
    if( !url ){
	url = name;
	name = /([^\\/]+)$/.exec(url)[1];
    }
    if( !name ){
	name = /([^\\/]+)$/.exec(url)[1];
    }
    // use fits proxy, if necessary
    if( opts.proxy && JS9.globalOpts.cgiProxy              &&
	url.match(/\.(fits|ftz|fz|fits\.gz|fits\.bz2)(\?.*)?$/) ){
	url = `${JS9.globalOpts.cgiProxy}?fits=${url}`;
    }
    // avoid the cache (Safari is especially aggressive) for FITS files
    if( !opts.allowCache && !url.match(/\?/) ){
	nurl = `${url}?r=${Math.random()}`;
    } else {
	nurl = url;
    }
    // change $JS9_DIR back to install dir
    nurl = nurl.replace(/^\${JS9_DIR}\//,JS9.INSTALLDIR);
    // set up connection
    xhr.open("GET", nurl, true);
    // and parameters
    if( opts.responseType ){
	xhr.responseType = opts.responseType;
    } else {
	xhr.responseType = "blob";
    }
    if( JS9.globalOpts.xtimeout ){
	xhr.timeout = JS9.globalOpts.xtimeout;
    }
    xhr.onload = () => {
	let blob;
        if( xhr.readyState === 4 ){
	    if( xhr.status === 200 || xhr.status === 0 ){
		// delete fetch status so JS9.error() does not process it
		delete JS9.fetchURL.status;
		if( xhr.responseType === "blob" ){
	            blob = new Blob([xhr.response]);
		    // discard path (or scheme) up to slashes
		    // remove trailing ? params
		    if( name.match("://") ){
			blob.name = name.split("/").reverse()[0]
			    .replace(/\?.*$/, "");
		    } else {
			blob.name = name;
		    }
		    // hack for Google Drive's lack of a filename
		    if( blob.name === "uc" ){
			blob.name = `google_${JS9.uniqueID()}.fits`;
		    }
		    if( handler ){
			handler(blob, opts);
		    } else {
			JS9.Load(blob, opts);
		    }
		} else {
		    if( opts.display ){
			handler(xhr.response, opts, {display: opts.display});
		    } else {
			handler(xhr.response, opts);
		    }
		}
	    } else if( xhr.status === 404 ){
		JS9.error(`could not find ${url}`);
	    } else {
		JS9.error(`can't load: ${url} ${xhr.statusText} ${xhr.status}`);
	    }
	}
    };
    xhr.onerror = () => {
	JS9.error(`cannot load: ${url} ... please check the url/pathname`);
    };
    xhr.ontimeout = () => {
	JS9.error(`timeout awaiting response from server: ${url}`);
    };
    // hack: set fetch status for JS9.error() to sense and pass on
    // this will be picked up by getStatus("load")
    JS9.fetchURL.status = "processing";
    // fetch the data!
    try{ xhr.send(); }
    catch(e){ JS9.error(`request to load ${url} failed`, e); }
};

// JS9 wrapper around saveAs:
JS9.saveAs = function(blob, pathname){
    try{ saveAs(blob, pathname); }
    catch(e){ JS9.error("could not saveAs", e); }
};

// FITS runtime adapter and binding functions are installed from core module
if( typeof JS9InstallFITSRuntime === "function" ){
    JS9InstallFITSRuntime(JS9);
} else {
    throw new Error("missing JS9InstallFITSRuntime");
}
// check for 'real' FITS handling routine and call it. This routine can:
// read a blob as a FITS file
// open an existing virtual FITS file (e.g. created by Montage reprojection)
JS9.handleFITSFile = function(file, opts, handler){
    if( JS9.fits.handleFITSFile ){
	JS9.fits.handleFITSFile(file, opts, handler);
    } else {
	JS9.error("no FITS module available to process FITS file");
    }
};

// cleanup FITS file by deleting vfile, etc
JS9.cleanupFITSFile = function(raw, mode){
    let rexp;
    if( JS9.hostFS ){
	rexp = new RegExp(`^${JS9.hostFS}`);
    }
    if( JS9.fits.cleanupFITSFile && raw && raw.hdu && raw.hdu.fits ){
	// don't delete real local file
	if( rexp && raw.hdu.fits.vfile && raw.hdu.fits.vfile.match(rexp) ){
	    mode = false;
	}
	JS9.fits.cleanupFITSFile(raw.hdu.fits, mode);
	return true;
    }
    // just return if no available cleanup routine or no raw data file
    return false;
};

// load an image (jpeg, png, etc)
JS9.handleImageFile = function(file, options, handler){
    const reader = new FileReader();
    options = JS9.extend(true, {}, JS9.fits.options, options);
    handler = handler || JS9.Load;
    reader.onload = (ev) => {
	let data, grey, hdu;
	const img = new Image();
	img.onload = () => {
	    let x, y, v, header;
	    let i = 0;
	    const canvas = document.createElement("canvas");
	    const ctx    = canvas.getContext("2d");
	    const h      = img.height;
	    const w      = img.width;
	    canvas.width  = w;
	    canvas.height = h;
	    ctx.drawImage(img, 0, 0);
	    data   = ctx.getImageData(0, 0, w, h).data;
	    grey   = new Float32Array(h*w);
	    for ( y = 0; y < h; y++ ) {
		for ( x = 0; x < w; x++ ) {
		    // NTSC
		    v = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
		    grey[(h - y) * w + x] = v;
		    i += 4;
		}
	    }
	    header = {SIMPLE: true,
		      BITPIX: -32,
		      NAXIS: 2,
		      NAXIS1: w,
		      NAXIS2: h};
	    hdu = {filename: file.name,
		   naxis: 2, axis: [0, w, h], bitpix: -32, bin: 1,
		   head: header, data: grey, offscreen: img};
	    hdu.dmin = Number.MAX_VALUE;
	    hdu.dmax = Number.MIN_VALUE;
	    for(i=0; i< h*w; i++){
		if( !Number.isNaN(hdu.data[i])   &&
		    Number.isFinite(hdu.data[i]) ){
		    hdu.dmin = Math.min(hdu.dmin, hdu.data[i]);
		    hdu.dmax = Math.max(hdu.dmax, hdu.data[i]);
		}
	    }
	    options.source = "img";
	    handler(hdu, options);
	};
	img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
};

// check for 'real' FITS handling routine and call it
JS9.getFITSImage = function(fits, hdu, options, handler){
    if( JS9.fits.getFITSImage ){
	JS9.fits.getFITSImage(fits, hdu, options, handler);
    } else {
	JS9.error("no FITS module available to process FITS image");
    }
};

// run fits2fits converter, if necessary
JS9.fits2fits = function(display, file, opts, func){
    let i, s, xdim, ydim, bin, bmode, obj, xcond;
    const xopts = {};
    opts = opts || {};
    if( JS9.notNull(opts.fits2fits) ){
	xcond = opts.fits2fits;
    } else {
	xcond = JS9.globalOpts.fits2fits;
    }
    if( xcond === true ){
	xcond = "always";
    } else if(  xcond === false ){
	xcond = "never";
    }
    // if never, we are done
    if( xcond.match(/never/i) ){
	return false;
    }
    // make sure we are set up to run the converter
    // requires a connected helper via a socket.io connection
    if( !JS9.helper.connected ||
	(JS9.helper.type !== "nodejs" && JS9.helper.type !== "socket.io") ){
	if(  xcond === "always" && JS9.globalOpts.requireFits2Fits ){
	    JS9.error("can't run fits2fits without connected JS9 helper");
	}
	return false;
    }
    // if the helper program does not exist, we might want to throw an error
    if( !JS9.helper.js9helper ){
	if( JS9.globalOpts.requireFits2Fits ){
	    JS9.error("js9helper not found for fits2fits processing");
	} else {
	    return false;
	}
    }
    // requires a tmp workdir
    if( !JS9.globalOpts.workDir ){
	if( JS9.globalOpts.requireFits2Fits ){
	    JS9.error("can't run fits2fits without a workdir");
	}
	return false;
    }
    xdim =
	opts.xdim ||
	JS9.fits.options.image.xdim ||
	JS9.fits.options.table.xdim;
    ydim =
	opts.ydim ||
	JS9.fits.options.image.ydim ||
	JS9.fits.options.table.ydim;
    bin =
	opts.bin ||
	JS9.fits.options.image.bin ||
	JS9.fits.options.table.bin;
    bmode = opts.binMode || JS9.globalOpts.binMode;
    bmode = bmode === "a" ? "a" : "";
    // handle string bin, possibly containing explicit binMode
    if( typeof bin === "string" ){
	if( bin.match(/[as]$/) ){
	    bmode = bin.slice(-1);
	}
	bin = parseInt(bin, 10);
    }
    bin = Math.max(1, bin || 1);
    if( JS9.notNull(opts.xcen) && JS9.notNull(opts.ycen) ){
	xopts.sect = `${xdim}@${opts.xcen},${ydim}@${opts.ycen},${bin}${bmode}`;
    } else {
	xopts.sect = `${xdim},${ydim},${bin}${bmode}`;
    }
    s = xcond.toLowerCase().split(/[>,]/);
    for(i=0; i<s.length; i++){
	switch(s[i]){
	case "size":
	    if( s[i+1] ){
		if( JS9.isNumber(s[i+1]) ){
		    xopts.maxsize = parseFloat(s[i+1])*1000000;
		}
		i++;
	    }
	    break;
	}
    }
    xopts.fits = JS9.cleanPath(file);
    xopts.parent = true;
    // start the waiting!
    JS9.waiting(true, display);
    // send message to helper to do conversion
    JS9.helper.send("fits2fits", xopts, (r) => {
	let robj, rarr, f, pf, nopts;
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
	if( robj.stderr ){
	    JS9.error(robj.stderr, JS9.analOpts.epattern);
	}
	if( robj.stdout ){
	    // look for error condition, which we might throw or swallow
	    if( robj.stdout.match(/^ERROR:/) ){
		if( JS9.globalOpts.requireFits2Fits ){
		    JS9.error(robj.stdout);
		} else {
		    robj.stdout = xopts.fits;
		}
	    }
	    // output is file and possibly parentFile
	    rarr = robj.stdout.split(/\n/);
	    // file
	    f = JS9.cleanPath(rarr[0]);
	    if( f === xopts.fits ){
		// same file (imsection not run)
		nopts = JS9.extend(true, {}, opts);
	    } else {
		// new file using imsection
		// relative path: add install dir prefix
		if( f.charAt(0) !== "/" ){
		    f = JS9.InstallDir(f);
		}
		nopts = JS9.extend(true, {}, opts);
		// but remove already-used section properties from opts
		delete nopts.xcen;
		delete nopts.ycen;
		delete nopts.bin;
		// but load entire image section
		if( nopts.xdim !== undefined ){ nopts.xdim = 0; }
		if( nopts.ydim !== undefined ){ nopts.ydim = 0; }
		// save source
		nopts.source = "fits2fits";
		// it's a proxy file (i.e., delete it on close)
		nopts.proxyFile = f;
		// json fits info
		if( rarr[1] ){
		    try{ obj = JSON.parse(rarr[1]); }
		    catch(ignore){ /* empty */ }
		    if( obj ){
			nopts.extname = obj.extname;
			nopts.extnum = obj.extnum;
			nopts.hdus = obj.hdus;
			nopts.parent = obj;
		    }
		}
		// look for parentFile (relative to helper, not install)
		if( rarr[2] ){
		    pf = JS9.cleanPath(rarr[2]);
		    nopts.parentFile = pf;
		    // now add extension info, if possible
		    if( nopts.extname ){
			nopts.parentFile = nopts.parentFile
			    .replace(/\[.*\]/, "");
			nopts.parentFile += `[${nopts.extname}]`;
		    } else if( nopts.extnum && (nopts.extnum > 0) ){
			nopts.parentFile = nopts.parentFile
			    .replace(/\[.*\]/, "");
			nopts.parentFile.file += `[${nopts.extnum}]`;
		    }
		}
		// add onload, if necessary
		if( func ){
		    nopts.onload = func;
		}
	    }
	    // no recursion!
	    nopts.fits2fits = false;
	    // load new file
	    JS9.Load(f, nopts, {display});
	}
    });
    return true;
};

// return the specified colormap object (or default)
JS9.lookupColormap = function(name, mustExist){
    let i;
    // default is the id must exist
    if( mustExist === undefined ){
	mustExist = true;
    }
    if( !name ){
	name = JS9.imageOpts.colormap;
    }
    if( name ){
	for(i=0; i<JS9.colormaps.length; i++){
	    if( JS9.colormaps[i].name === name ){
		return JS9.colormaps[i];
	    }
	}
    }
    if( mustExist ){
        JS9.error(`unknown colormap '${name}'`);
    } else {
	return null;
    }
};

// lookup command
JS9.lookupCommand = function(name){
    let cmd, i, n;
    if( name ){
	n = name.toLowerCase();
	for(i=0; i<JS9.commands.length; i++){
	    cmd = JS9.commands[i];
	    if( (cmd.name  === n) || (cmd.alias === n) || (cmd.alias2 === n) ){
		return cmd;
	    }
	}
    }
    return null;
};

// error message handler
JS9.error = function(...args){
    let [emsg, epattern, dothrow] = args;
    let e, earr, i, s, im, cur;
    let emessage = "";
    let stack = "";
    let doerr = true;
    // reset wait cursor
    JS9.waiting(false);
    // set fetch error status, if coming from a fetch
    if( JS9.fetchURL.status === "processing" ){
	JS9.fetchURL.status = "error";
    }
    // set current error status, if we find it
    for(i=0; i<JS9.images.length; i++){
	im = JS9.images[i];
	cur = im.status.cur;
	if( cur && im.status[cur] ){
	    im.setStatus(cur, "error");
	}
    }
    // second args can be error pattern to look for, or else an error object
    if( typeof epattern === "string" ){
	earr = emsg.match(epattern);
	if( earr ){
	    if( earr[1] ){
		emsg = earr[1];
	    } else if( earr[0] ){
		emsg = earr[0];
	    }
	} else {
	    doerr = false;
	}
    } else if( typeof epattern === "object" ){
	e = epattern;
    }
    // default is to throw the error
    if( args.length < 3 ){
	dothrow = true;
    }
    // maybe throw error and send message to user
    if( doerr ){
	// add error object message to emsg, if possible
	if( e && e.message ){
	    emsg += ` (${e.message})`;
	} else if( emsg ){
	    e = new Error(emsg);
	}
	// try to add stacktrace
	s = JS9.strace(e);
	if( s ){
	    stack = `\n\nStacktrace:\n${s}`;
	}
	// can be set "outside" to prevent the alert message
	// (for example, in the console window)
	if( JS9.globalOpts.alerts ){
	    if( emsg && typeof emsg === "string" && emsg.search(/ERROR/) < 0 ){
		emessage = "JS9 ERROR: ";
	    }
	    emessage += emsg + stack;
	    alert(emessage);
	}
	// throw error, if necessary
	if( dothrow ){
	    throw e;
	}
    }
};

// log to console
JS9.log = function(...args){
    if( (window.console !== undefined) && (window.console.log !== undefined) ){
	// eslint-disable-next-line no-console
        console.log(...args);
    }
};

// we use keydown instead of keypress, so we need ...
// ... for conversion of keydown into char string
JS9.eventToCharStr = function(evt){
    let c, s;
    const _specialKeys = {
	"37": "leftArrow",
	"38": "upArrow",
	"39": "rightArrow",
	"40": "downArrow",
	 "8": "delete"
    };
    const _to_ascii = {
        "188": "44",
        "109": "45",
        "190": "46",
        "191": "47",
        "192": "96",
        "220": "92",
        "222": "39",
        "221": "93",
        "219": "91",
        "173": "45",
        "187": "61", //IE Key codes
        "186": "59", //IE Key codes
        "189": "45"  //IE Key codes
    };
    const _shiftUps = {
        "96": "~",
        "49": "!",
        "50": "@",
        "51": "#",
        "52": "$",
        "53": "%",
        "54": "^",
        "55": "&",
        "56": "*",
        "57": "(",
        "48": ")",
        "45": "_",
        "61": "+",
        "91": "{",
        "93": "}",
        "92": "|",
        "59": ":",
        "39": "\"",
        "44": "<",
        "46": ">",
        "47": "?"
    };
    // allow direct specification of keycode as a number
    if( typeof evt === "number" ){
	c = evt;
    } else {
	// otherwise its the event
	c = evt.which || evt.keyCode;
    }
    s = String(c);
    // normalize keyCode
    if( {}.hasOwnProperty.call(_to_ascii, s) ){
        c = _to_ascii[s];
    }
    if( !evt.shiftKey && (c >= 65 && c <= 90) ){
        c = String.fromCharCode(c + 32);
    } else if( !evt.shiftKey && {}.hasOwnProperty.call(_specialKeys, c) ){
        c = _specialKeys[c];
    } else if( evt.shiftKey  && {}.hasOwnProperty.call(_shiftUps, c) ){
        //get shifted keyCode value
        c = _shiftUps[c];
    } else {
        c = String.fromCharCode(c);
    }
    // check for special key
    if( JS9.specialKey(evt) ){
	c = `M-${c}`;
    }
    return c;
};

// get position of mouse in a canvas
// http://stackoverflow.com/questions/1114465/getting-mouse-location-in-canvas
JS9.eventToDisplayPos = function(evt, offset){
    // from http://www.quirksmode.org/js/events_properties.html
    let i, targ, pageX, pageY, leftOff, upOff, touches, pos;
    const XFUDGE = 1;
    const YFUDGE = 1;
    if( !evt ){
	evt = window.event;
    }
    if( evt.target ){
        targ = evt.target;
    } else if( evt.srcElement ){
        targ = evt.srcElement;
    }
    if( targ.nodeType === 3 ){ // defeat Safari bug
        targ = targ.parentNode;
    }
    // offset() returns the position of the element relative to the document
    offset = offset || JS9.getNodeOffset(targ);
    // pageX, pageY: mouse positions relative to the document
    // changed touch events: take position from first finger
    if( evt.originalEvent ){
	if( evt.originalEvent.touches &&
	    evt.originalEvent.touches.length ){
	    touches = evt.originalEvent.touches;
	    pageX = touches[0].pageX;
	    pageY = touches[0].pageY;
	} else if( evt.originalEvent.changedTouches &&
		   evt.originalEvent.changedTouches.length ){
	    touches = evt.originalEvent.changedTouches;
	    pageX = touches[0].pageX;
	    pageY = touches[0].pageY;
	} else {
	    pageX = evt.pageX;
	    pageY = evt.pageY;
	}
    } else {
	// mouse events
	pageX = evt.pageX;
	pageY = evt.pageY;
    }
    // position is (evt pos relative to page - pos of element relative to page)
    // FUDGE added after visual inspection of line512 at zoom 32
    // I tried to place the mouse, and have the magnifier be in the right place
    // Linux, FF & Chrome: x=1, y=1 (5/28/14)
    leftOff = offset.left + XFUDGE;
    upOff = offset.top  + YFUDGE;
    // display position
    pos = {x: Math.floor(pageX - leftOff), y: Math.floor(pageY - upOff)};
    // touch positions, if necessary
    if( touches && touches.length ){
	pos.touches = [{x: pos.x, y: pos.y}];
	for(i=1; i<touches.length; i++){
	    pos.touches[i] = {x: Math.floor(touches[i].pageX - leftOff),
			      y: Math.floor(touches[i].pageY - upOff)};
	}
    }
    return pos;
};

// convert image pixels in one image to image pixels in another image
// NB: assumes both images have wcs available
JS9.pix2pix = function(im1, im2, obj){
    let s, ra, dec, x, y, nx, ny;
    const epsilon = 0.5;
    // sanity check
    if( !im1 || !im2 || im1.raw.wcs <= 0 || im2.raw.wcs <= 0 ){ return obj; }
    // convenience variables
    x = obj.x;
    y = obj.y;
    // convert image pixels to ra, dec in source image
    s = JS9.pix2wcs(im1.raw.wcs, x, y).trim().split(/\s+/);
    ra = JS9.saostrtod(s[0]);
    if( JS9.isHMS(im1.params.wcssys) ){
	ra *= 15.0;
    }
    dec = JS9.saostrtod(s[1]);
    // convert ra, dec to image coords in dest image
    s = JS9.wcs2pix(im2.raw.wcs, ra, dec).trim().split(/\s+/);
    nx = parseFloat(s[0]);
    ny = parseFloat(s[1]);
    // lord, save us from wcs transformation jitter
    if( Math.abs(nx - x) < epsilon ){ nx = x; }
    if( Math.abs(ny - y) < epsilon ){ ny = y; }
    // return image pixels
    return {x: nx, y: ny};
};

// calculate angular distance, based on P.T. Wallaces's slalib routines,
// which were acquired from him via email 6/29/2020, converted to javascript
// could also use newer routines from www.iausofa.org, but ...
// input values are in degrees
JS9.angdist = function(ra1, dec1, ra2, dec2){
    let a, b, dist;
    const slaDcs2c = (a, b) => {
	let v = [];
	let cosb = Math.cos ( b );
	v[0] = Math.cos ( a ) * cosb;
	v[1] = Math.sin ( a ) * cosb;
	v[2] = Math.sin ( b );
	return v;
    };
    // modified from P.T. Wallace (acquired via email 6/29/2020)
    const slaDpav = (v1, v2) => {
	let x0, y0, z0, w, x1, y1, z1, s, c;
	/* Unit vector to point 1. */
	x0 = v1 [ 0 ];
	y0 = v1 [ 1 ];
	z0 = v1 [ 2 ];
	w = Math.sqrt ( x0 * x0 + y0 * y0 + z0 * z0 );
	if( w != 0.0 ) { x0 /= w; y0 /= w; z0 /= w; }
	/* Vector to point 2. */
	x1 = v2 [ 0 ];
	y1 = v2 [ 1 ];
	z1 = v2 [ 2 ];
	/* Position angle. */
	s = y1 * x0 - x1 * y0;
	c = z1 * ( x0 * x0 + y0 * y0 ) - z0 * ( x1 * x0 + y1 * y0 );
	return ( s != 0.0 || c != 0.0 ) ? Math.atan2 ( s, c ) : 0.0;
    };
    const d2r = (x) => { return x * Math.PI / 180; };
    const r2d = (x) => { return x * 180 / Math.PI; };
    a = slaDcs2c(d2r(ra1), d2r(dec1));
    b = slaDcs2c(d2r(ra2), d2r(dec2));
    dist = slaDpav(a, b);
    // negation required to be in line with our conventions
    dist = -dist;
    return r2d(dist);
};

// http://stackoverflow.com/questions/13695317/rotate-a-point-around-another-point
// angle is input in degrees
JS9.rotatePoint = function(point, angle, cen)
{
    let cosA, sinA;
    cen = cen || {x: 0.0, y: 0.0};
    angle = Math.PI * angle / 180.0;
    cosA = Math.cos(angle);
    sinA = Math.sin(angle);
    return {
        x: (cosA * (point.x - cen.x) - sinA * (point.y - cen.y) + cen.x),
	y: (sinA * (point.x - cen.x) + cosA * (point.y - cen.y) + cen.y)
    };
};

// multiply two matrices
// https://stackoverflow.com/questions/27205018/multiply-2-matrices-in-javascript
JS9.matrixMultiply = function(a, b){
    let r, c, i, m;
    const aNumRows = a.length, aNumCols = a[0].length;
    // eslint-disable-next-line no-unused-vars
    const bNumRows = b.length, bNumCols = b[0].length;
    m = new Array(aNumRows);  // initialize array of rows
    for(r = 0; r < aNumRows; ++r){
	m[r] = new Array(bNumCols); // initialize the current row
	for(c = 0; c < bNumCols; ++c){
	    m[r][c] = 0;             // initialize the current cell
	    for(i = 0; i < aNumCols; ++i){
		m[r][c] += a[r][i] * b[i][c];
	    }
	}
    }
    return m;
};

// invert a 3x3 matrix
JS9.invertMatrix3 = function(xin){
    let i, j, det_1;
    let pos = 0.0;
    let neg = 0.0;
    let temp =  xin[0][0] * xin[1][1];
    const prec = 1.0e-15;
    const xout = [[0,0,0], [0,0,0], [0,0,0]];
    const accum = () => {
	if( temp >= 0.0 ){
	    pos += temp;
	} else {
	    neg += temp;
	}
    };
    // sanity check for NaN
    for(i=0; i<3; i++){
	for(j=0; j<2; j++){
	    if( (xin[i][j] === undefined) || Number.isNaN(xin[i][j]) ){
		return null;
	    }
	}
    }
    accum();
    temp = -xin[0][1] * xin[1][0];
    accum();
    det_1 = pos + neg;
    // Is the submatrix A singular?
    if( (det_1 === 0.0) || (Math.abs(det_1 / (pos - neg)) < prec) ){
	// Matrix M has no inverse
	return null;
    }
    // Calculate inverse(A) = adj(A) / det(A)
    det_1 = 1.0 / det_1;
    xout[0][0] =   xin[1][1] * det_1;
    xout[1][0] = - xin[1][0] * det_1;
    xout[0][1] = - xin[0][1] * det_1;
    xout[1][1] =   xin[0][0] * det_1;
    // Calculate -C * inverse(A)
    xout[2][0] = - (xin[2][0] * xout[0][0] + xin[2][1] * xout[1][0]);
    xout[2][1] = - (xin[2][0] * xout[0][1] + xin[2][1] * xout[1][1]);
    return xout;
};

// install extracted basic utils, or fall back to local definitions
if( typeof CoreBasicUtils === "function" ){
    CoreBasicUtils(JS9);
} else {
    // is this a string representation of a number?
    // https://stackoverflow.com/questions/175739/built-in-way-in-javascript-to-check-if-a-string-is-a-valid-number
    // NB: don't use Number.XXX routines, they don't work .. "2016-5" returns true
    JS9.isNumber = function(s){
	return !isNaN(parseFloat(s)) && isFinite(s);
    };

    // check if a variable is neither undefined nor null
    JS9.notNull = function(s){
	return s !== undefined && s !== null;
    };

    // check if a variable is either undefined or null
    JS9.isNull = function(s){
	return s === undefined || s === null;
    };

    // use a default if a variable is either undefined or null
    JS9.defNull = function(s, def){
	return JS9.notNull(s) ? s : def;
    };

    // check if a wcs system is a world coordinate system (fk5, etc)
    JS9.isWCSSys = function(s){
	return s !== "image" && s !== "physical";
    };

    // check if a wcs system is not a world coordinate system (fk5, etc)
    JS9.notWCS = function(s){
	return s === "image" || s === "physical";
    };
}

} // end JS9InstallOverlays

if (typeof globalThis !== "undefined") {
    globalThis.JS9InstallOverlays = JS9InstallOverlays;
}
