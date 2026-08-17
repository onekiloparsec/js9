// @ts-nocheck
/* JS9 browser viewer core. Attribution is centralized in README.md. */
export {};
import { sprintf, vsprintf } from './core/sprintf';
import { gaussBlur } from './core/gaussBlur';
import { JS9MathUtils } from './core/mathUtils';
import { JS9InstallColormaps } from './core/colormaps';
import { saveAs, ResizeSensor, Spinner, ddtabcontent, dhtmlwindow } from './core/browserCompat';

/*global JS9Prefs, JS9Inline, CoreBasicUtils, JS9InstallFITSRuntime, JS9InstallViewerUtils, JS9InstallViewerEvents, JS9InstallViewerPlugins, JS9InstallFITSBootstrap, JS9InstallCommands, JS9InstallHelperRuntime, JS9InstallShapeEngine, JS9InstallNativeShapeEngine, JS9InstallInitAnalysis, JS9InstallPublicApi, JS9InstallViewerInit, io, Jupyter, ImageFilters, Plotly, tinycolor, regSelect */

"use strict";

// generate and expose JS9 module
// (use var to add to global scope for backward compatibility with previous ES5)
var JS9 = (function(){

// module header
const JS9 = {};
JS9.NAME = "JS9";		// The name of this namespace
JS9.VERSION = "3.9";		// The version of this namespace
JS9.COPYRIGHT = "Copyright (c) 2012-2024 Smithsonian Institution";
JS9.ABOUT = `JS9 ${JS9.VERSION}: astronomical image display everywhere\nEric Mandel, Alexey Vikhlinin\n${JS9.COPYRIGHT}`;

// internal defaults (not usually changed by users)
JS9.DEFID = "JS9";		// default JS9 display id
JS9.WIDTH = 512;	        // width of js9 canvas
JS9.HEIGHT = 512;		// height of js9 canvas
JS9.ANON = "Anonymous";		// name to use for images with no name
JS9.PREFSFILE = "prefs.json";    // prefs file to load
JS9.WORKERFILE = "worker.js";    // js9 web worker file to load
JS9.ZINDEX = 0;			// z-index of image canvas: on bottom of js9
JS9.SHAPEZINDEX = 4;		// base z-index of shape layers layers
JS9.MESSZINDEX = 80;		// z-index of messages: above graphics
JS9.BTNZINDEX =  90;		// z-index of buttons on top of plugin canvases
JS9.MENUZINDEX = 1000;		// z-index of menus: always on top!
JS9.COLORSIZE = 1024;		// size of contrast/biased color array
JS9.SCALESIZE = 16384;		// size of scaled color array
JS9.INVSIZE = 1024;		// size of inverse array
JS9.HISTSIZE = 16384;		// size of histogram equalization array
JS9.INSTALLDIR="";		// prefix to get to js9 install directory
JS9.TOROOT="";			// prefix to get to data file from install
JS9.PLUGINS="";			// regexp list of plugins
JS9.LIGHTWIN = "dhtml";		// light window type: choice of dhtml
JS9.ANTIALIAS = false;		// use anti-aliasing?
JS9.SCALEIREG = true;		// scale interactive regions by zoom factor?
JS9.NOMOVE = 3;			// number of pixels before we recognize movement
JS9.DBLCLICK0 = 5;		// < millisec => same event
JS9.DBLCLICK = 300;		// < millisec => double-click
JS9.TIMEOUT = 250;              // millisec before assuming light window is up
JS9.SPINOUT = 250;		// millisec before assuming spinner is up
JS9.WORKEROUT = 2000;           // millisec before restarting worker socket
JS9.SUPERMENU = /^SUPERMENU_/;  // base of supermenu id
JS9.RESIZEDIST = 20;		// size of rectangle defining resize handle
JS9.RESIZEFUDGE = 5;            // fudge for webkit resize problems
JS9.RAWID0 = "raw0";		// default raw id
JS9.RAWIDX = "alt";		// default "alternate" raw id
JS9.IDFMT = "  (%s)";           // format for light window id
JS9.MINZOOM = 0.125;		// min zoom using scroll wheel
JS9.MAXZOOM = 32.0;		// max zoom using scroll wheel
JS9.ADDZOOM = 0.1;		// add/subtract amount per mouse wheel click
JS9.MODZOOM = 2;		// skip factor with wheel to avoid pileup
JS9.DIRZOOM = 1;		// sign (+/-) determines zoom direction
JS9.CHROMEFILEWARNING = true;	// whether to alert chrome users about file URI
JS9.CLIPBOARDERROR = "the local clipboard (which only holds data copied from within JS9) does not contain any content. Were you trying to paste something copied outside JS9?";
JS9.CLIPBOARDERROR2 = "the local clipboard (which only holds data copied from within JS9) does not contain any regions";
JS9.URLEXP = /^(https?|ftp):\/\//; // url to determine a web page
JS9.WCSEXP = /^(fk4|fk5|icrs|galactic|ecliptic|image|physical|linear)$/;
JS9.REGSIZE = 0;		// 0 -> cdelt, 1 -> ang sep (regions use #0)

JS9.useStatusbarDictionary = false;
// flag that is used to indicate that expandMacro should further use 
// the statusbar dictionary to expand its output

    
// https://hacks.mozilla.org/2013/04/detecting-touch-its-the-why-not-the-how/
JS9.TOUCHSUPPORTED = ({}.hasOwnProperty.call(window, "ontouchstart") || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0));
// modified from:
// http://stackoverflow.com/questions/2400935/browser-detection-in-javascript
// https://stackoverflow.com/questions/58019463/how-to-detect-device-name-in-safari-on-ios-13-while-it-doesnt-show-the-correct
JS9.BROWSER = (function(){
    const P = navigator.platform;
    const N = navigator.appName;
    const ua = navigator.userAgent;
    const tem = ua.match(/version\/([.\d]+)/i);
    let M = ua.match(/(opera|chrome|safari|firefox)\/?\s*(\.?\d+(\.\d+)*)/i);
    if( M && tem !== null ){ M[2] = tem[1]; }
    M = M? [M[1], M[2], P]: [N, navigator.appVersion,"-?", P];
    M.push(/Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(ua) ||
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
    return M;
}());
// convenience to allow plugins to deal with HiDPI ratio blurring
// http://stackoverflow.com/questions/15661339/how-do-i-fix-blurry-text-in-my-html5-canvas
JS9.PIXEL_RATIO = (function(){
    const ctx = document.createElement("canvas").getContext("2d"),
          dpr = window.devicePixelRatio || 1,
          bsr = ctx.webkitBackingStorePixelRatio ||
                ctx.mozBackingStorePixelRatio ||
                ctx.msBackingStorePixelRatio ||
                ctx.oBackingStorePixelRatio ||
                ctx.backingStorePixelRatio || 1;

    return dpr / bsr;
}());

// global options
JS9.globalOpts = {
    helperType: "none",		// one of: sock.io, get, post, none
    helperPort: 2718,		// default port for node.js helper
    requireHelper: false,       // throw error if helper is not available?
    allinoneHelper: false,      // allow allinone to use helper?
    processQueryParams: true,   // process query parameters from url?
    quietReturn: false,         // should API return empty string or "OK"?
    useWasm: true,		// use WebAssembly if available?
    transforms: ["flip", "rot90", "rotate"], // order for processing transforms
    rotateRelative: false,	// is setRotate() relative or absolute?
    clickToFocus: false,	// how to change focus on the display
    winType: "light",		// plugin window: "light" or "new"
    sortPreloads: true,         // sort preloads into original order after load?
    defcolor: "#00FF00",	// graphics color when all else fails
    fits2fits: "never",		// convert to repfile? always|never|size>x Mb
    requireFits2Fits: false,    // throw error if fits2fits can't be run?
    localAccess: true,		// access files locally, when available?
    prependJS9Dir: true,        // prepend $JS9_DIR to relative fitsFile paths?
    dataDir: null,              // path to FITS data (def: use incoming path)
    alerts: true,		// set to false to turn off alerts
    valposTarget: null,         // target element for valpos updates
    valposWidth: "medium",      // small, medium, large
    valposDCoords: false,	// show display coords in valpos?
    internalValPos: true,	// a fancy info plugin can turns this off
    internalContrastBias: true,	// a fancy colorbar plugin can turns this off
    containContrastBias: false, // contrast/bias only when mouse is in display?
    arrowIncrement: 1,          // how much to move a region using arrow keys
    wcsCrosshair: false,	// enable wcs crosshair matching?
    localLoadFormat: "image",	// current format when loading local files
    remoteLoadMethod: "proxy",	// proxy or cors when loading remote file
    csvIncludeWCS: true,	// does Get/SaveRegions(csv) include wcs info?
    regWhichDefault: "auto",	// "auto" => selected or all, "all" is all
    regIncludeJSON: true,	// does SaveRegions(reg) include the json info?
    regIncludeComments: true,	// does SaveRegions(reg) include the comments?
    regListDCoords: false,	// ListRegions(reg) list preserved disp coords?
    regSaveDCoords: false,	// SaveRegions(reg) save preserved disp coords?
    regExpandDCoords: false,	// ExpandMacro(reg) use preserved disp coords?
    regCopyDCoords: true,	// CopyRegions(reg) copy preserved disp coords?
    regArrowCrosshair: true,	// does move with arrow keys display crosshair?
    regSaveWCS: "",		// def wcs for saving regions
    regSaveFormat: "reg",	// def format for saving regions (reg,cvs,svg)
    regSaveWhich1: "all",	// def 'which' for saving regions (all,selected)
    regSaveWhich2: "selected",	// def 'which' for saving in configure dialog
    regMenuCreate: true,	// menu select a region creates it immediately
    regMenuSelection: "circle",	// region selected during last menu select
    regToClipboard: false,	// copy all region changes to pseudo-clipboard?
    regGroupConflict: "skip",	// group conflicts: error or skip
    regConfigAddParens: true,	// does the reg configure gui try to add parens?
    regSyncTextColor: true,	// sync region text color with main color?
    regDisplay: "lightwin",	// "lightwin" or "display"
    reConfigSize: "medium",	// "small", "medium"
    htimeout:  10000,		// connection timeout for the helper connect
    lhtimeout: 10000,		// connection timeout for local helper connect
    ehtimeout: 500,		// connection timeout when waiting for helper
    ehretries: 20,		// connection retries when waiting for helper
    xtimeout: 600000,		// connection timeout for fetch data requests
    extlist: "EVENTS STDEVT",	// list of binary table extensions
    imopts: "IMOPTS",           // basename of FITS param containing json opts
    imcmap: "IMCMAP",           // basename of FITS param containing cmaps
    fixiURL: "node_modules/@onekiloparsec/fixi-js/dist/fixi.js", // extracted FITS/XISF adapter runtime
    fixiWasmURL: "node_modules/@onekiloparsec/fixi-js/dist/fixi_core.wasm", // Rust/WASM FITS core
    fitsAdapter: "fixi",        // FITS backend id to activate (e.g. fixi or registered custom adapter)
    fitsCompliance: "strict",   // fixi compliance mode: strict|compat
    shapeEngine: "native",      // active shape engine id
    table: {xdim: 4096, ydim: 4096, bin: 1, bitpix: 32},// image section size to extract from table
    image: {xdim: 4096, ydim: 4096, bin: 1},// image section size (unlimited=0)
    binMode: "s",               // "s" (sum) or "a" (avg) pixels when binning
    reprojSwitches: "",         // Montage reproject switches
    reprojectLimits: false,     // internal: check for reprojection limits?
    rotationCenter: "file",     // "current" display center or "file" (CRPIX1,2)
    runOnCR: true,              // Run forms such as binning when <cr> pressed?
    clearImageMemory: "heap",   // rm vfile: always|never|auto|noExt|noCube|size>x Mb heap=>free heap
    helperProtocol: location.protocol, // http: or https:
    reloadRefresh: false,       // reload an image will refresh (or redisplay)?
    reloadRefreshReg: true,     // reloading regions file removes previous?
    nextImageMask: false,	// does nextImage() show active image masks?
    panMouseThreshold: 1,	// pixels mouse must move before we pan
    panzoomRefreshLimit: 500,	// # of shapes before avoiding refresh
    panWithinDisplay: false,	// keep panned image within the display?
    pannerDirections: true,	// display direction vectors in panner?
    magnifierRegions: true,	// display regions in magnifier?
    editRegions: true,		// double-click to edit regions?
    svgBorder: true,		// border around the display when saving to svg?
    unremoveReg: 100,           // how many removed regions to save
    resetEmptyShapeId: false,	// reset nshape counter if all shapes removed?
    maxMemory: 2000000000,	// max heap memory to allocate for a fits image
    loadURL: "params/load.html",// location of param html file
    corsURL: "params/loadcors.html",       // location of param html file
    proxyURL: "params/loadproxy.html",     // location of param html file
    loadProxy: false,           // do we allow proxy load requests to server?
    imsectionURL: "params/imsection.html", // location of param html file
    postMessage: false,         // allow communication through iframes?
    localStorage: true,         // use localStorage for session params?
    waitType: "spinner",        // "spinner" or "mouse"
    spinColor: "#FF0000",       // color of spinner
    spinOpacity: 0.35,          // opacity of spinner
    resize: true,		// allow resize of display?
    resizeHandle: true,		// add resize handle to display?
    resizeRedisplay: true,	// redisplay image while resizing?
    logoDisplay: false,         // show JS9 logo on each display?
    logo: "images/js9logo.png", // show JS9 logo on each display?
    lightWinPos: "center=1",	// "left=n,top=m" offset from left,top of window
    lightWinClose: "ask",	// ask, close, move images when closing lightwin
    fallbackDisplay: true,	// displayMessage fallback to display window?
    refreshDragDrop: true,	// refresh on drag/drag and open file?
    reduceMosaic: "js9",        // "js9" or "shrink" ("js9" seems to be faster)
    internalRegcnts: true,      // make internal regcnts analysis available?
    reduceRegcnts: true,        // reduce image when doing counts in regions?
    plot3d: {cube:"*:*:all", mode:"avg", areaunits:"pixels", color: "green"}, // plot3d options: avg/sum, pixels/arcsecs
    imexamLineHeight: 1,        // "height" of line region section
    copyWcsPosFormat: "$ra $dec $sys", // format for copy wcs pos to clipboard
    floatPrecision: 6,          // precision for floatToString()
    mouseActions: ["display value/position", "change contrast/bias", "pan the image"],// 0,1,2 mousepress
    touchActions: ["display value/position", "change contrast/bias", "pan the image"],// 1,2,3 fingers
    keyboardActions: {
	a: "add last region selected in regions menu",
	b: "toggle selected region: source/background",
	c: "toggle crosshair",
	d: "send selected region to back",
	e: "toggle selected region: include/exclude",
	"M-e": "edit selected region(s)",
	i: "refresh image",
	I: "display full image",
	"M-i": "display selected cutouts",
	"M-k": "toggle keyboard actions plugin",
	l: "toggle active shape layers",
	"M-l": "new JS9 light window",
        m: "pan to mouse position",
	"M-m": "toggle mouse/touch plugin",
	"M-o": "open local file",
        P: "paste regions from local clipboard",
        p: "paste regions to current position",
	"M-,": "toggle preferences plugin",
	"M-p": "toggle preferences plugin",
	r: "copy region(s) to clipboard",
	s: "select region",
	S: "select all regions",
	"M-s": "toggle shape layers plugin",
	u: "undo remove of region(s)",
	U: "unselect all regions",
	x: "flip image around x axis",
	y: "flip image around y axis",
        "9": "rotate image by 90 degrees",
        "/": "copy wcs position to clipboard",
        "?": "copy value and position to clipboard",
	"0": "reset zoom",
	"=": "zoom in",
	"+": "zoom in",
	"-": "zoom out",
	"^": "raise region layer to top",
	">": "display next image",
	"<": "display previous image",
	"delete": "remove selected region",
	"leftArrow": "move region/position left",
	"upArrow": "move region/position up",
	"rightArrow": "move region/position right",
	"downArrow": "move region/position down"
    }, // keyboard actions
    mousetouchZoom: true,	// use mouse wheel, pinch to zoom?
    mousetouchZoomToCursor: true, // wheel zoom about the mouse, not the center?
    mousetouchLimit: true,	// limit zoom-out to size of image?
    metaClickPan: true,         // metaKey + click pans to mouse position?
    // statusBar: "$mag; $scale($scaleclipping); $img(images/voyager/color_$colormap.png) $colormap; $wcssys; $image",  // status display
    statusBar: "$colorbar; $colormap; $mag; $scale ($scalemin,$scalemax); $wcssys; $image0",  // status display
    statusBarDictionary: {},
    toolbarTooltips: false,     // display tooltips on toolbar?
    updateTitlebar: true,	// update titlebar when image changes?
    centerDivs: ["JS9Menubar"], // divs which take part in JS9.Display.center()
    resizeDivs: ["JS9Menubar", "JS9Colorbar", "JS9Toolbar", "JS9Statusbar"], // divs which take part in JS9.Display.resize()
    pinchWait: 8,		// number of events to wait before testing pinch
    pinchThresh: 6,		// threshold for pinch test
    xeqPlugins: true,		// execute plugin callbacks?
    extendedPlugins: true,	// enable extended plugin support?
    intensivePlugins: false,	// enable intensive plugin support?
    dynamicSelect: "click",     // dynamic plugins: "click", "move", or false
    dynamicHighlight: true,     // highlight dynamic selection
    corsProxy:  "https://js9.si.edu/cgi-bin/CORS-proxy.cgi",   // CORS proxy
    simbadProxy:"https://js9.si.edu/cgi-bin/simbad-proxy.cgi", // simbad proxy
    cgiProxy:   "https://js9.si.edu/cgi-bin/FITS-proxy.cgi",   // CGI proxy
    catalogs:   {ras: ["RA", "_RAJ2000", "RAJ2000"],  // cols to search for ..
		 decs: ["Dec", "_DEJ2000", "DEJ2000"],// when loading catalogs
		 shape: "circle",                     // object shape
		 color: "yellow",                     // object color
		 width: 7,                            // box object width
		 height: 7,                           // box object height
		 radius: 3.5,                         // circle object radius
		 r1: 5.0,                             // ellipse object r1
		 r2: 3.5,                             // ellipse object r2
		 wcssys: "ICRS",                      // wcs system
		 skip: "#\n",                         // skip # and blank lines
		 save: true,                          // save cat cols in shapes
		 tooltip: "$data.ra $data.dec"}, // tooltip format
    topColormaps: ["grey", "heat", "cool", "turbo", "viridis", "magma", "sls", "red", "green", "blue"], // toplevel colormaps
    infoBox: ["file", "object", "wcsfov", "wcscen", "wcspos", "impos", "physpos", "value", "regions", "progress"],
    infoBoxResize: true,                              // is size based on wcs?
    menuBar: ["file", "edit", "view", "zoom", "scale", "color", "region", "wcs", "analysis", "help"],
    menubarStyle: "classic",                          // mac or classic
    menuPosition: "right-5 bottom-5",                 // where menus pop up
    menuClickEvent: "mouseup",                        // "click" or "mouseup"
    menuSelected: "check",                            // selected option icon
    menuImages: true,                                 // show pngs in menu?
    userMenus: false,                                 // add user menus?
    userMenuDivider: "&nbsp;&nbsp;&nbsp;",            // divide before user menu
    imagesFileSubmenu: 5,        // how many images trigger a submenu?
    toolBar: ["annulus", "box", "circle", "ellipse", "line", "polygon", "text", "zoom+", "zoom-", "zoom1", "zoomtofit"],
    syncOps: ["alignment","colormap","contrastbias","flip","pan","regions","rotate", "rot90","scale","wcs","zoom"],                                         // which ops are sync'ed?
    syncReciprocate: true,       // default value for reciprocal sync'ing
    syncWCS: true,               // default value for using WCS to sync
    hiddenPluginDivs: [],        // which static plugin divs start hidden
    separate: {layout: "auto", leftMargin: 10, topMargin: 10}, // separate a display
    imageTemplates: ".fits,.fts,.xisf,.png,.jpg,.jpeg,.fz,.ftz,.gz", // templates for local images
    wcsUnits: {FK4:"sexagesimal", FK5:"sexagesimal", ICRS:"sexagesimal",
	       galactic:"degrees", ecliptic:"degrees", linear:"degrees",
	       physical:"pixels", image:"pixels"}, // def units for wcs sys
    wcsSetUpdatesDef: true,          // does setWCSUnits() update the default?
    wcsHlength: 256000,		     // hlength passed to adapter initwcs()
    regTemplates: ".reg",	     // templates for local region file input
    sessionTemplates: ".ses,.js9ses",// templates for local session file input
    colormapTemplates: ".cmap",      // templates for local colormap file input
    catalogTemplates: ".cat,.tab",   // templates for local catalog file input
    localTemplates: ".fits,.fts,.xisf",    // templates for local file access
    controlsMatchRegion: false,      // true, false, "corner" or "border"
    internalColorPicker: true,       // use HTML5 color picker, if available?
    newWindowWidth:  530,	     // width of LoadWindow("new")
    newWindowHeight: 625,	     // height of LoadWindow("new")
    debug: 0		             // debug level
};

// favorites are used in dialog boxes and control boxes
JS9.favorites = {
    scales: ["linear", "log", "histeq"],
    colormaps: ["cool", "heat", "viridis", "magma"],
    regions: ["annulus", "box", "circle", "ellipse"],
    wcs: ["FK5", "ICRS", "galactic:Galactic", "physical", "image"]
//  you can specify a display string using a colon-separated string or array:
//  wcs: ["FK5:fk5", ["ICRS","icrs"], "galactic", "physical", "image"]
};

// image param defaults
JS9.imageOpts = {
    inherit: false,			// inherit props from previous image?
    contrast: 1.0,			// default color contrast
    bias: 0.5,				// default color bias
    invert: false,			// default colormap invert
    exp: 1000,				// default exp value for scaling
    colormap: "grey",			// default color map
    overlay: true,			// display png/jpeg overlay?
    scale: "linear",			// default scale algorithm
    scaleclipping: "dataminmax",	// "dataminmax", "zscale", or "user" (when scalemin, scalemax is supplied)
    scalemin: Number.NaN,               // default scale min is undefined
    scalemax: Number.NaN,               // default scale max is undefined
    flip: "none",                       // default flip state
    rot90: 0,	                        // default 90 deg rotation state
    rotate: 0,	                        // default rotation state
    zscalecontrast: 0.25,		// default from ds9
    zscalesamples: 600,			// default from ds9
    zscaleline: 120,			// default from ds9
    wcssys: "native",			// default WCS sys
    lcs: "physical",			// default logical coordinate system
    valpos: true,			// whether to display value/position
    sigma: "none",			// gauss blur sigma or none
    opacity: 1.0,			// opacity between 0 and 1
    alpha:  255,                        // alpha for image (but use opacity!)
    nancolor: "#000000",		// 6-digit #hex color for NaN values
    nocolor: {red:0,green:0,blue:0,alpha:0} , // static color map no color
    // xcen: 0,                         // default x center pos to pan to
    // ycen: 0,                         // default y center pos to pan to
    zoom: 1,				// default zoom factor
    zooms: 6,				// how many zooms in each direction?
    topZooms: 2,			// how many zooms are at top level?
    wcsalign: true,			// align image using wcs after reproj?
    rotationMode: "relative",		// default: relative or absolute?
    crosshair: false,			// enable crosshair?
    disable: [],			// list of disabled core services
    ltvbug:  false,			// add 0.5/ltm to image LTV values?
    listonchange: false,		// whether to list after a reg change
    whichonchange: "selected"		// which to list ("all" or "selected")
};

// allows regions opts (in Regions.opts) to be overridden via js9prefs.js
JS9.regionOpts = {};
// allows catalog opts (in Catalogs.opts) to be overridden via js9prefs.js
JS9.catalogOpts = {};
// allows crosshair opts (in Crosshair.opts) to be overridden via js9prefs.js
JS9.crosshairOpts = {};
// allows grid opts (in Grid.opts) to be overridden via js9prefs.js
JS9.gridOpts = {};
// allows fabric opts (in Fabric.opts) to be overridden via js9prefs.js
JS9.fabricOpts = {};
// socket.io options
JS9.socketioOpts = {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax : 10000,
    reconnectionAttempts: 100,
    timeout: JS9.globalOpts.htimeout
};
// defaults for blending
JS9.blendOpts = {
    active: true,
    mode: "screen",
    opacity: 1.0
};

// defaults for masking
JS9.maskOpts = {
    active: false,
    mode: "overlay",  // "overlay", "mask", "opacity"
    opacity: 1,       // overlay opacity
    vopacity: 0,      // mask opacity
    value: 0,         // mask value
    syncops: ["flip", "pan", "rot90", "zoom"],
    invert: false
};

// defaults for analysis (macro expansion)
JS9.analOpts = {
    // if this pattern is matched in stderr, throw a real error
    epattern: /^(ERROR:[^\n]*)\n/,
    // location of datapath's param html file
    dpathURL: "params/datapath.html",
    // location of filepath's param html file
    fpathURL: "params/filepath.html"
};

// light window opts
JS9.lightOpts = {
    nclick: 0,
    dhtml: {
	topid:    "#dhtmlwindowholder",
	top:      ".dhtmlwindow",
	drag:     ".drag-contentarea",
	dragBar:  ".drag-handle",
	format:   "width=%spx,height=%spx,resize=%s,scrolling=0",
	textWin:  "width=830px,height=400px,resize=1,scrolling=1",
	// NB: dimensions are tied to .JS9Plot CSS params
	plotWin:  "width=830px,height=420px,resize=1,scrolling=1",
	dpathWin: "width=830px,height=175px,resize=1,scrolling=1",
	lcloseWin:"width=512px,height=190px,resize=1,scrolling=1",
	paramWin: "width=830px,height=235px,resize=1,scrolling=1",
	regWin0:  "width=640px,height=130px,resize=1,scrolling=1",
	regWin1:  "width=640px,height=200px,resize=1,scrolling=1",
	regWin:   "width=640px,height=470px,resize=1,scrolling=1",
	imageWin: "width=512px,height=598px,resize=1,scrolling=1",
	lineWin:  "width=400px,height=60px,resize=1,scrolling=1"
    },
    lcloseURL: "params/lightclose.html"
};

// colors for text messages
JS9.textColorOpts = {
    regions: "#00FF00",
    info:    "#00FF00",
    inimage: "#000000"
};

// help pages
JS9.helpOpts = {
    user: {
	heading: "JS9Help",
	type: "help", url:"user.html",
	title: "User Manual"
    },
    install: {
	heading: "JS9Help",
	type: "help", url:"install.html",
	title: "Installing JS9"
    },
    webpage: {
	heading: "JS9Help",
	type: "help", url:"webpage.html",
	title: "Adding JS9 to a Web Page"
    },
    yourdata: {
	heading: "JS9Help",
	type: "help", url:"yourdata.html",
	title: "Adding Data to a Web Page"
    },
    localtasks: {
	heading: "JS9Help",
	type: "help", url:"localtasks.html",
	title: "Adding Local Analysis Tasks and Plugins"
    },
    helper: {
	heading: "JS9Help",
	type: "help", url:"helper.html",
	title: "Adding Server-side Analysis Tasks"
    },
    serverside: {
	heading: "JS9Help",
	type: "help", url:"serverside.html",
	title: "Server-side Analysis with JS9"
    },
    publicapi: {
	heading: "JS9Help",
	type: "help", url:"publicapi.html",
	title: "The JS9 Public API"
    },
    extmsg: {
	heading: "JS9Help",
	type: "help", url:"extmsg.html",
	title: "External Messaging"
    },
    archives: {
	heading: "JS9Help",
	type: "help", url:"archives.html",
	title: "Accessing Data Archives"
    },
    preferences: {
	heading: "JS9Help",
	type: "help", url:"preferences.html",
	title: "Setting Site Preferences"
    },
    regions: {
	heading: "JS9Help",
	type: "help", url:"regions.html",
	title: "Regions Format"
    },
    changelog: {
	heading: "JS9Help",
	type: "help", url:"changelog.html",
	title: "ChangeLog"
    },
    repfile: {
	heading: "JS9Help",
	type: "help", url:"repfile.html",
	title: "Dealing with Large Files"
    },
    memory: {
	heading: "JS9Help",
	type: "help", url:"memory.html",
	title: "Dealing with Memory Limitations"
    },
    issues: {
	heading: "JS9Help",
	type: "help", url:"knownissues.html",
	title: "Known Issues"
    },
    security: {
	heading: "JS9Help",
	type: "help", url:"securityissues.html",
	title: "Security Issues"
    }
};

// containers for groups of JS9 objects
JS9.images = [];		// array of current images
JS9.displays = [];		// array of current display canvases
JS9.colormaps = [];		// array of current colormaps
JS9.commands = [];		// array of commands
JS9.plugins = [];		// array of defined plugins
JS9.preloads = [];		// array of images to preload
JS9.auxFiles = [];		// array of auxiliary files
JS9.supermenus = [];		// array containing supermenu instances
JS9.preloadwaiting = [];	// array of images currently being preloaded
JS9.publics = {};		// object containing defined public API calls
JS9.helper = {};		// only one helper per page, please
JS9.fits = {};			// object holding FITS access routines
JS9.userOpts = {};		// object to hold localStorage opts
JS9.tmp = {};			// global temp area
// misc params
// list of scales in mkScaledCells
JS9.scales = ["linear", "log", "histeq", "power", "sqrt", "squared", "asinh", "sinh"];

// list of known wcs systems
JS9.wcssyss = ["FK4", "FK5", "ICRS", "galactic", "ecliptic",
	       "physical", "image", "native"];

// list of known wcs units
JS9.wcsunitss = ["degrees", "sexagesimal", "pixels"];

// list of known regions
JS9.regions = ["annulus", "box", "circle", "cross", "ellipse", "line", "point",
	       "polygon", "text"];

// known bugs and work-arounds
JS9.bugs = {};
// sometimes hiding the menu does not refresh the image properly
// JS9.bugs.hide_menu = true;
// turned off: 6/30/16
JS9.bugs.hide_menu = false;
// firefox does not repaint as needed (last checked FF 24.0 on 10/20/13)
if( (JS9.BROWSER[0] === "Firefox") && JS9.BROWSER[2].search(/Linux/) >=0 ){
    JS9.bugs.firefox_linux = true;
}
// webkit resize is not quite up to par
// if( (JS9.BROWSER[0] === "Chrome") || (JS9.BROWSER[0] === "Safari") ){
// only safari seems to need the extra border (4/18/20)
if( (JS9.BROWSER[0] === "Safari") ){
    JS9.bugs.webkit_resize = true;
}

// wasm broken in ios 11.2.2, 11.2.5 and on, fixed in 11.3beta1 (1/22/2018)
// see historical wasm-toolchain issue affecting iOS 11.2.x
if( /iPad|iPhone|iPod/.test(navigator.platform) &&
    /11_2_(?:[2-9])/.test(navigator.userAgent)  ){
    JS9.globalOpts.useWasm = false;
}
// iOS and presumably android has severe memory limits (05/2017)
// also force user to turn on crosshair, since it works with one finger
// also, iOS requires wider region dialog boxes to fit the buttons
if( JS9.BROWSER[3] ){
    JS9.globalOpts.maxMemory = Math.min(JS9.globalOpts.maxMemory, 350000000);
    JS9.globalOpts.table.xdim = 2048;
    JS9.globalOpts.table.ydim = 2048;
    JS9.globalOpts.image.xdim = 2048;
    JS9.globalOpts.image.ydim = 2048;
    JS9.imageOpts.crosshair = false;
    JS9.globalOpts.reproj = {xdim: 2048, ydim: 2048};
    JS9.lightOpts.dhtml.regWin0="width=660px,height=130px,resize=1,scrolling=1";
    JS9.lightOpts.dhtml.regWin1="width=660px,height=200px,resize=1,scrolling=1";
    JS9.lightOpts.dhtml.regWin="width=660px,height=470px,resize=1,scrolling=1";
}
// Jupyter doesn't seem to be able to load wasm (7/4/2018)
if( {}.hasOwnProperty.call(window, "Jupyter") ){
    JS9.globalOpts.useWasm = false;
}
// ---------------------------------------------------------------------
// JS9 Image object to manage images
// ---------------------------------------------------------------------

JS9.Image = function(file, params, func){
    let i, card, pars, nzoom, display, txeq, tval;
    let localOpts = null;
    let nhist = 0;
    let ncomm = 0;
    // called with current image context
    const mkscale = (opts) => {
	// do zscale, if necessary
	opts = opts || {};
	if( JS9.isNull(opts.scaleclipping) ){
	    if( this.params.scaleclipping === "zscale" ){
		this.zscale(true);
	    } else if( this.params.scaleclipping === "zmax" ){
		this.zscale("zmax");
	    }
	} else {
	    if( opts.scaleclipping === "zscale" ){
		this.zscale(true);
	    } else if( opts.scaleclipping === "zmax" ){
		this.zscale("zmax");
	    }
	}
	if( JS9.notNull(opts.scalemin) ){
	    this.params.scalemin = opts.scalemin;
	}
	if( JS9.notNull(opts.scalemax) ){
	    this.params.scalemax = opts.scalemax;
	}
    };
    // called with current image context
    const finishUp = (func) => {
	let i, s, topts, tkey, id, pre, waiting, plen, im;
	const imopts = JS9.globalOpts.imopts;
	const imcmap = JS9.globalOpts.imcmap;
	const oalerts = JS9.globalOpts.alerts;
	const rregexp = /(annulus|box|circle|ellipse|line|polygon|point|text) *\(/;
	// add to list of images
	JS9.images.push(this);
	// clear previous messages
	this.display.clearMessage();
	// if flip, rotate, rot90 opts were supplied, set transform
	if( localOpts ){
	    if( JS9.notNull(localOpts.flip)   ||
		JS9.notNull(localOpts.rotate) ||
		JS9.notNull(localOpts.rot90)  ){
		this.setTransform();
	    }
	}
	// display image, 2D graphics, etc.
	this.displayImage("all", localOpts);
	// notify the helper
	this.notifyHelper();
	// show regions layer
	this.showShapeLayer("regions", true, {local: true});
	if( localOpts ){
	    // pan, if necessary
	    if( (JS9.notNull(localOpts.x)  && JS9.notNull(localOpts.y))   ||
		(JS9.notNull(localOpts.px) && JS9.notNull(localOpts.py))  ||
		(JS9.notNull(localOpts.ra) && JS9.notNull(localOpts.dec)) ||
		(JS9.notNull(localOpts.wcs))                              ){
		this.setPan(localOpts);
	    }
	    // add regions, if necessary
	    if( localOpts.regions ){
		if( localOpts.regions.match(rregexp) ){
		    this.addShapes("regions", localOpts.regions);
		} else {
		    JS9.LoadRegions(localOpts.regions, {display:this.display});
		}
	    }
	}
	// no alerts while processing imopts or cmaps
	JS9.globalOpts.alerts = false;
	// looks for imcmap (json-formatted colormap object) in FITS header
	if( this.raw && this.raw.header && this.raw.header[imcmap] ){
	    // try to convert to object and set as image params
	    try{ topts = JSON.parse(this.raw.header[imcmap]); }
	    catch(e){ topts = null; }
	    if( topts ){
		try{ JS9.AddColormap(topts); }
		catch(e){ /* empty */ }
	    }
	}
	// look for multi-line colormap (imcmap1, imcmap2, ...) in FITS header
	tkey = `${imcmap}1`;
	if( this.raw && this.raw.header && this.raw.header[tkey] ){
	    // gather up the json string
	    for(i=1, s=""; i<100; i++){
		tkey = imcmap + String(i);
		if( this.raw.header[tkey] ){
		    s += this.raw.header[tkey];
		} else {
		    break;
		}
	    }
	    // try to convert to object and set as image params
	    if( s ){
		try{ topts = JSON.parse(s); }
		catch(e){ topts = null; }
		if( topts ){
		    try{ JS9.AddColormap(topts); }
		    catch(e){ /* empty */ }
		}
	    }
	}
	// looks for imopts (json-formatted image param object) in FITS header
	if( this.raw && this.raw.header && this.raw.header[imopts] ){
	    // try to convert to object and set as image params
	    try{ topts = JSON.parse(this.raw.header[imopts]); }
	    catch(e){ topts = null; }
	    if( topts ){
		try{ this.setParam("all", topts); }
		catch(e){ /* empty */ }
	    }
	}
	// look for multi-line imopts (imopts1, imopts2, ...) in FITS header
	tkey = `${imopts}1`;
	if( this.raw && this.raw.header && this.raw.header[tkey] ){
	    // gather up the json string
	    for(i=1, s=""; i<100; i++){
		tkey = imopts + String(i);
		if( this.raw.header[tkey] ){
		    s += this.raw.header[tkey];
		} else {
		    break;
		}
	    }
	    // try to convert to object and set as image params
	    if( s ){
		try{ topts = JSON.parse(s); }
		catch(e){ topts = null; }
		if( topts ){
		    try{ this.setParam("all", topts); }
		    catch(e){ /* empty */ }
		}
	    }
	}
	// restore alerts
	JS9.globalOpts.alerts = oalerts;
	// plugin callbacks
	this.xeqPlugins("image", "onimageload");
	// load is complete
	this.setStatus("load","complete");
	// done loading, reset wait cursor
	JS9.waiting(false);
	// everything else is done so call onload func, if necessary
	if( func ){
	    try{ JS9.xeqByName(func, window, this); }
	    catch(e){ JS9.error("in image onload callback", e, false); }
	}
	// might need to finish processing of preloads
	if( JS9.preloadwaiting && JS9.preloadwaiting.length ){
	    plen = JS9.preloadwaiting.length;
	    id = this.proxyURL || this.file;
	    // flag that this preload is loaded
	    for(i=0, waiting=0; i<plen; i++){
		pre = JS9.preloadwaiting[i];
		if( id.match(pre.id) || pre.id.match(id) ){
		    pre.loaded = true;
		    pre.im = this;
		} else {
		    // are we done preloading
		    if( pre.loaded === false ){
			waiting++;
		    }
		}
	    }
	    // are all preloads loaded?
	    if( !waiting ){
		// resort preloads into original order
		if( JS9.globalOpts.sortPreloads ){
		    JS9.images.sort((a, b) => {
			let ai = 0, bi = 0;
			for(i=0; i<plen; i++){
			    pre = JS9.preloadwaiting[i];
			    if( a.id === pre.im.id ){
				ai = i;
			    }
			    if( b.id === pre.im.id ){
				bi = i;
			    }
			}
			return ai - bi;
		    });
		    // display last image in the load list
		    im = JS9.preloadwaiting[plen-1].im || this;
		    im.displayImage();
		} else {
		    // not sorting preloads
		    im = this;
		}
		// execute preload callback
		if( JS9.notNull(JS9.globalOpts.onpreload) ){
		    try{
			JS9.xeqByName(JS9.globalOpts.onpreload, window, im);
		    }
		    catch(e){
			JS9.error("in onpreload callback", e, false);
		    }
		    finally{
			delete JS9.globalOpts.onpreload;
		    }
		}
		// done with this set of preloads, so re-init
		JS9.preloadwaiting = [];
	    }
	}
	// also load all of the image extensions?
	if( localOpts && localOpts.allext &&
	    this.hdus && this.hdus.length > 0 ){
	    this.displayExtension("all");
	}
    };
    // params can be an object containing local params, or the display string
    if( params ){
	if( typeof params === "object" ){
	    localOpts = params;
	    if( localOpts.display ){
		display = localOpts.display;
	    }
	} else {
	    display = params;
	}
    }
    // make sure we have a valid display
    if( !display ){
	if( JS9.displays.length > 0 ){
	    display = JS9.displays[0].id;
	} else {
	    display = JS9.DEFID;
	}
    }
    // save url, if available
    // it's an image
    this.type = "image";
    // set the display
    this.display = JS9.lookupDisplay(display);
    // initialize image params
    this.params = {};
    // region stack for saving removed regions
    this.regstack = [];
    // image-specific scratch space
    this.tmp = {};
    // current groups for each layer
    this.groups = {};
    // xeq callback for region changes?
    this.params.xeqonchange = true;
    // copy image parameters
    this.params = JS9.extend(true, this.params, JS9.imageOpts, localOpts);
    // inherit properties, if necessary
    if( this.display.image ){
	this.params.inherit = this.display.image.params.inherit;
	if( this.params.inherit ){
	    this.params = JS9.extend(true,
				   this.params, this.display.image.params);
	}
    }
    // (turn off plugin call, since we are not fully loaded)
    txeq = JS9.globalOpts.xeqPlugins;
    // save overlay (setting colormap turns it off)
    tval = this.params.overlay;
    JS9.globalOpts.xeqPlugins = false;
    this.setColormap(this.params.colormap);
    this.params.overlay = tval;
    JS9.globalOpts.xeqPlugins = txeq;
    // do we display?
    this.displayMode = true;
    // initialize click state
    this.clickState = 0;
    // initialize click in region
    this.clickInRegion = false;
    this.clickInLayer = null;
    // no helper queried yet
    this.queried = false;
    // is this a proxy image?
    if( localOpts && localOpts.proxyFile ){
	this.proxyFile = localOpts.proxyFile;
    }
    // is there a proxy parent?
    if( localOpts && localOpts.proxyParent ){
	this.proxyParent = localOpts.proxyParent;
    }
    if( localOpts && localOpts.proxyURL ){
	this.proxyURL = localOpts.proxyURL;
    }
    // was a "parent" FITS file specified?
    if( localOpts && localOpts.parentFile ){
	this.parentFile = localOpts.parentFile;
    }
    // was "parent" info specified?
    if( localOpts && localOpts.parent ){
	this.parent = localOpts.parent;
	// convert card string to header
	if( this.parent.cardstr && this.parent.ncard ){
	    this.parent.raw = {header: {}, history:[], comments: []};
	    for(i=0; i<this.parent.ncard; i++){
		card = this.parent.cardstr.slice(i*80, (i+1)*80);
		pars = JS9.cardpars(card);
		if( pars !== undefined ){
		    if( pars[0] === "HISTORY" ){
			this.parent.raw.header[`${pars[0]}__${nhist++}`] = pars[1];
		    } else if( pars[0] === "COMMENT" ){
			this.parent.raw.header[`${pars[0]}__${ncomm++}`] = pars[1];
		    } else {
			this.parent.raw.header[pars[0]] = pars[1];
		    }
		}
	    }
	    // initialize LCS for this parent header
	    this.parent.lcs = {};
	    // call is used because this.parent is not an image object
	    JS9.Image.prototype.initLCS.call(this.parent,
					     this.parent.raw.header);
	}
    }
    // was an id specified?
    if( localOpts && localOpts.id ){
	this.id = localOpts.id;
    }
    // offsets into canvas to display
    this.ix = 0;
    this.iy = 0;
    // init status object
    this.status = {};
    // RGB image
    this.rgb = {};
    // section parameters
    this.rgb.sect = {zoom: 1, ozoom: 1};
    // graphical layers
    this.layers = {};
    // current zindex for main layers
    this.zlayer = JS9.SHAPEZINDEX;
    // no logical coordinate systems
    this.lcs = {};
    // array of aux file pointers
    this.aux = {};
    // binning parameters
    this.binning = {bin: 1, obin: 1};
    // array to hold raw data as we create it (original raw data at index 0)
    this.raws = [];
    // initial blend mode
    this.blend = JS9.extend(true, {}, JS9.blendOpts);
    // initial mask mode
    this.mask = JS9.extend(true, {}, JS9.maskOpts);
    // request for an empty image object ends here
    if( !file ){
	return;
    }
    // change the cursor to show the waiting status
    JS9.waiting(true, this.display);
    // file arg can be an object containing raw data
    switch( typeof file ){
    case "object":
	// save source
	if( localOpts && localOpts.source ){
	    this.source = localOpts.source;
	} else {
	    this.source = "fits";
	}
	// generate the raw data array from the hdu
	// (11/2021: leave check on 'filename' for backward compatibility)
	this.mkRawDataFromHDU(file,
			      JS9.extend({},
				       {file: file.file||file.filename},
				       localOpts));
	// set scaling params from opts
	mkscale(localOpts);
	// set up initial zoom
	if( this.params.zoom ){
	    nzoom = this.parseZoom(this.params.zoom);
	    this.rgb.sect.zoom = nzoom;
	    this.rgb.sect.ozoom = nzoom;
	}
	// set up initial section
	this.mkSection();
	// was a static RGB file specified?
	if( localOpts && localOpts.rgbFile ){
	    this.rgbFile = localOpts.rgbFile;
	    // create the png object with image to hold png file
	    this.png = {image: new Image()};
	    // callback to fire when static RGB image is loaded
	    this.png.image.addEventListener("load", () => {
		let ss;
		if( (this.png.image.width !== this.raw.width)   ||
		    (this.png.image.height !== this.raw.height) ){
		    ss = sprintf("rgb dims [%s,%s] don't match image [%s,%s]",
				this.png.image.width,
				this.png.image.height,
				this.raw.width,
				this.raw.height);
		    JS9.error(ss);
		}
		// store png data in an offscreen canvas
		this.mkOffScreenCanvas();
		// finish up
		finishUp(func);
	    }).on("error", () => {
		// done loading, reset wait cursor
		JS9.waiting(false);
		JS9.error(`could not load image: ${this.id}`);
	    }, {once: true});
	    // set src to download the display file
	    this.png.image.src = this.rgbFile;
	} else {
	    // finish up
	    finishUp(func);
	}
	break;
    default:
	JS9.error(`unknown specification type for Load: ${typeof file}`);
	break;
    }
};


// ---------------------------------------------------------------------
// Install all module installers (Phase 5: viewer.ts decomposition)
// ---------------------------------------------------------------------

// --- NEW: class/prototype installers ---

// defines JS9.Colormap + JS9.Display; internally calls JS9InstallHelperRuntime
if( typeof JS9InstallDisplay === "function" ){
    JS9InstallDisplay(JS9);
} else {
    throw new Error("missing JS9InstallDisplay");
}

// adds Image.prototype lifecycle methods (getImageData, closeImage, mkRawDataFromHDU, mkSection…)
if( typeof JS9InstallImageCore === "function" ){
    JS9InstallImageCore(JS9);
} else {
    throw new Error("missing JS9InstallImageCore");
}

// adds Image.prototype rendering + pan/zoom (mkColorData, displayImage, setZoom, setFlip…)
if( typeof JS9InstallImageRender === "function" ){
    JS9InstallImageRender(JS9);
} else {
    throw new Error("missing JS9InstallImageRender");
}

// adds Image.prototype WCS + coordinates + analysis (imageToLogicalPos, initWCS, runAnalysis…)
if( typeof JS9InstallImageCoords === "function" ){
    JS9InstallImageCoords(JS9);
} else {
    throw new Error("missing JS9InstallImageCoords");
}

// adds Image.prototype scaling + data ops + session (setColormap, gaussBlurData, saveSession…)
if( typeof JS9InstallImageData === "function" ){
    JS9InstallImageData(JS9);
} else {
    throw new Error("missing JS9InstallImageData");
}

// defines JS9.Regions namespace + Image.prototype region methods (addShapes, removeShapes…)
if( typeof JS9InstallRegions === "function" ){
    JS9InstallRegions(JS9);
} else {
    throw new Error("missing JS9InstallRegions");
}

// defines JS9.Plot/Catalogs/Crosshair/Grid/Dysel + FITS helpers; internally calls JS9InstallFITSRuntime
if( typeof JS9InstallOverlays === "function" ){
    JS9InstallOverlays(JS9);
} else {
    throw new Error("missing JS9InstallOverlays");
}

// --- EXISTING installer calls (reordered: ShapeEngine/NativeShapeEngine moved after Commands) ---

// install extracted viewer utilities
if( typeof JS9InstallViewerUtils === "function" ){
    JS9InstallViewerUtils(JS9);
} else {
    throw new Error("missing JS9InstallViewerUtils");
}


// install extracted viewer event handlers
if( typeof JS9InstallViewerEvents === "function" ){
    JS9InstallViewerEvents(JS9);
} else {
    throw new Error("missing JS9InstallViewerEvents");
}

// install extracted viewer plugin support
if( typeof JS9InstallViewerPlugins === "function" ){
    JS9InstallViewerPlugins(JS9);
} else {
    throw new Error("missing JS9InstallViewerPlugins");
}

// install extracted FITS/runtime bootstrap
if( typeof JS9InstallFITSBootstrap === "function" ){
    JS9InstallFITSBootstrap(JS9);
} else {
    throw new Error("missing JS9InstallFITSBootstrap");
}


// install extracted colormap initialization
if( typeof JS9InstallColormaps === "function" ){
    JS9InstallColormaps(JS9);
} else {
    throw new Error("missing JS9InstallColormaps");
}


// install extracted console command initialization
if( typeof JS9InstallCommands === "function" ){
    JS9InstallCommands(JS9);
} else {
    throw new Error("missing JS9InstallCommands");
}


// install shape engine abstraction
if( typeof JS9InstallShapeEngine === "function" ){
    JS9InstallShapeEngine(JS9);
} else {
    throw new Error("missing JS9InstallShapeEngine");
}

// install the active JS9-native shape engine
if( typeof JS9InstallNativeShapeEngine === "function" ){
    JS9InstallNativeShapeEngine(JS9);
} else {
    throw new Error("missing JS9InstallNativeShapeEngine");
}


// install extracted analysis initialization
if( typeof JS9InstallInitAnalysis === "function" ){
    JS9InstallInitAnalysis(JS9);
} else {
    throw new Error("missing JS9InstallInitAnalysis");
}

// ---------------------------------------------------------------------
//
// JS9 Public API: public interface for use in Web pages
//
// obviously, you can use any JS9 call in a web page but we will
// keep this interface stable
//
// ---------------------------------------------------------------------

// install extracted public API
if( typeof JS9InstallPublicApi === "function" ){
    JS9InstallPublicApi(JS9);
} else {
    throw new Error("missing JS9InstallPublicApi");
}


// ---------------------------------------------------------------------
// end of JS9 Public Interface
// ---------------------------------------------------------------------

// ---------------------------------------------------------------------
// the init routine to start up JS9
// ---------------------------------------------------------------------

if( typeof JS9InstallViewerInit === "function" ){
    JS9InstallViewerInit(JS9);
} else {
    throw new Error("missing JS9InstallViewerInit");
}

// return namespace
return JS9;
}());

// INIT: after document is loaded, perform JS9 initialization
document.addEventListener("DOMContentLoaded", () => {
    // when all is ready, we can preload images
    document.addEventListener("JS9:ready", () => {
	if( !JS9.readied ){
	    JS9.readied = true;
	    if( JS9.notNull(JS9.prerename) && JS9.prerename.length ){
		JS9.RenameDisplay(...JS9.prerename);
		delete JS9.prerename;
	    }
	    JS9.Preload(true);
	}
    });
    document.addEventListener("JS9:init", () => {
	if( JS9.helper.ready && JS9.fits.ready ){
	    // ... signal we are completely ready
	    JS9.triggerDocumentEvent("JS9:ready", {status: "OK"});
	}
    });
    // wait for helper
    document.addEventListener("JS9:helperReady", () => {
	if( JS9.fits.ready && JS9.inited && !JS9.readied ){
	    // ... signal we are completely ready (but only once)
	    JS9.triggerDocumentEvent("JS9:ready", {status: "OK"});
	}
    });
    // init JS9 (unless explicitly specified not to)
    if( document.querySelectorAll('div[data-js9init="false"]').length === 0 ){
	JS9.init();
    }
});

// Expose JS9 on globalThis so it remains accessible when this file is bundled
// into an IIFE (where var at module level is no longer implicitly global).
if( typeof globalThis !== "undefined" ){
    globalThis.JS9 = JS9;
}
