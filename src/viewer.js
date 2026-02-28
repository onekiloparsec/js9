/* JS9 browser viewer core. Attribution is centralized in README.md. */

/*global JS9Prefs, JS9Inline, CoreBasicUtils, JS9MathUtils, JS9InstallFITSRuntime, JS9InstallViewerUtils, JS9InstallViewerEvents, JS9InstallViewerPlugins, JS9InstallFITSBootstrap, JS9InstallColormaps, JS9InstallCommands, JS9InstallHelperRuntime, JS9InstallShapeEngine, JS9InstallFabricEngine, JS9InstallInitAnalysis, JS9InstallPublicApi, JS9InstallViewerInit, fabric, io, sprintf, dhtmlwindow, saveAs, Spinner, ResizeSensor, Jupyter, gaussBlur, ImageFilters, Plotly, tinycolor, regSelect */

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
    shapeEngine: "fabric",      // active shape engine id
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
    mousetouchZoom: false,	// use mouse wheel, pinch to zoom?
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
    imageTemplates: ".fits,.fts,.png,.jpg,.jpeg,.fz,.ftz,.gz", // templates for local images
    wcsUnits: {FK4:"sexagesimal", FK5:"sexagesimal", ICRS:"sexagesimal",
	       galactic:"degrees", ecliptic:"degrees", linear:"degrees",
	       physical:"pixels", image:"pixels"}, // def units for wcs sys
    wcsSetUpdatesDef: true,          // does setWCSUnits() update the default?
    wcsHlength: 256000,		     // hlength passed to adapter initwcs()
    regTemplates: ".reg",	     // templates for local region file input
    sessionTemplates: ".ses,.js9ses",// templates for local session file input
    colormapTemplates: ".cmap",      // templates for local colormap file input
    catalogTemplates: ".cat,.tab",   // templates for local catalog file input
    localTemplates: ".fits,.fts",    // templates for local file access
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

// return the image data in a relatively standard format
JS9.Image.prototype.getImageData = function(dflag){
    let data = null;
    const {xdim, ydim} = this.fileDimensions();
    const atob64 = (a) => {
	let i;
	let s = '';
	const bytes = new Uint8Array(a.buffer);
	const len = bytes.byteLength;
	for(i=0; i<len; i++){
            s += String.fromCharCode(bytes[i]);
	}
	return window.btoa(s);
    };
    // return data and auxiliary info
    if( dflag ){
	// return an array for IPC-safe transport
	if( dflag === "array" ){
	    data = Array.from(this.raw.data);
	} else if( dflag === "base64" ){
	    // NB: this seems to be the fastest method for IPC!
	    data = atob64(this.raw.data);
	} else {
	    // use this for javascript programming on the web page itself
	    data = this.raw.data;
	}
    }
    return {id: this.id,
	    file: this.file,
	    fits: this.fitsFile || "",
	    source: this.source,
	    imtab: this.imtab,
	    width: this.raw.width,
	    height: this.raw.height,
	    bitpix: this.raw.bitpix,
	    bin: this.binning.bin,
	    header: this.raw.header,
	    hdus: this.hdus,
	    dwidth: this.display.width,
	    dheight: this.display.height,
	    fwidth: xdim,
	    fheight: ydim,
	    data: data
	   };
};

// undisplay the image, release resources
JS9.Image.prototype.closeImage = function(opts){
    let i, j, tim, key, raw, carr;
    let iscurrent = false;
    const ilen= JS9.images.length;
    // this is either the dynamically selected display or the current display
    const seldisplay = JS9.Dysel.getDisplayOr(this.display);
    // opts is optional
    opts = opts || {};
    // opts can be json
    if( typeof opts === "string" ){
	try{ opts = JSON.parse(opts); }
	catch(e){ JS9.error(`can't parse closeImage opts: ${opts}`, e); }
    }
    // set close status to "closing"
    this.setStatus("close", "closing");
    // if this image is the wcs reference image for another image, clear it
    for(i=0; i<ilen; i++){
	if( JS9.images[i].wcsim === this ){
	    JS9.images[i].wcsim = null;
	}
    }
    // if this image is the image mask for another image, clear it
    for(i=0; i<ilen; i++){
	if( JS9.images[i].mask.im === this ){
	    JS9.images[i].mask.im = null;
	    JS9.images[i].mask.active = false;
	}
    }
    // look for the image in the image list, and remove it
    for(i=0; i<ilen; i++){
	if( this === JS9.images[i] ){
	    tim = JS9.images[i];
	    // is this the currently displayed image?
	    if( tim === tim.display.image ){
		iscurrent = i+1;
	    }
	    // clear display if this is the currently displayed image
	    if( iscurrent ){
		// clear unless specifically asked not to
		if( opts.clear !== false ){
		    tim.display.clearMessage();
		    tim.display.context.clear();
		}
		// clear all layers
		for( key of Object.keys(tim.layers) ){
		    // clear the shape layer if its in the main display,
		    //  and non-main layers if this image is selected
		    if( tim.layers[key].dlayer.dtype === "main" ||
			tim.display === seldisplay ){
			tim.showShapeLayer(key, false, {local: true});
		    }
		}
	    }
	    // plugin callbacks
	    tim.xeqPlugins("image", "onimageclose");
	    // after callbacks, we can unset the image from the display
	    if( iscurrent ){
		// clear image from display
		tim.display.image = null;
	    }
	    // remove from RGB mode, if necessary
	    switch(tim.cmapObj.name){
	    case "red":
		tim.display.rgb.rim = null;
		break;
	    case "green":
		tim.display.rgb.gim = null;
		break;
	    case "blue":
		tim.display.rgb.bim = null;
		break;
	    }
	    // cleanup FITS file support, if necessary
	    for(j=0; j<tim.raws.length; j++){
		raw = tim.raws[j];
		if( raw.hdu && raw.hdu.fits ){
		    carr = JS9.lookupVfile(raw.hdu.fits.vfile);
		    if( carr.length <= 1 ){
			JS9.cleanupFITSFile(raw, true);
		    }
		}
		// free wcs info
		if( raw.altwcs ){
		    this.freeWCS(raw);
		}
	    }
	    // remove proxy image from server, if necessary
	    tim.removeProxyFile();
	    // good hints to the garbage collector
	    tim.rgb = null;
	    tim.offscreen = null;
	    tim.raw = null;
	    tim.colorData = null;
	    tim.colorCells = null;
	    tim.psColors = null;
	    tim.psInverse = null;
	    tim = null;
	    // remove image from active list
	    JS9.images.splice(i,1);
	    // found and removed the specified image
	    break;
	}
    }
    // display another image, if necessary and if possible
    if( iscurrent ){
	iscurrent -= 2;
	for(i=iscurrent; i>=0; i--){
	    tim = JS9.images[i];
	    if( this.display === tim.display ){
		// display image, 2D graphics, etc.
		tim.displayImage("all");
		tim.refreshLayers();
		// signal we're done
		iscurrent = JS9.images.length;
		break;
	    }
	}
	for(i=JS9.images.length-1; i>iscurrent; i--){
	    tim = JS9.images[i];
	    if( this.display === tim.display ){
		// display image, 2D graphics, etc.
		tim.displayImage("all");
		tim.refreshLayers();
		break;
	    }
	}
    }
};

// make offscreen canvas to hold RGB data from the png file
JS9.Image.prototype.mkOffScreenCanvas = function(){
    // sanity check
    if( !this.png || !this.png.image ){ return this; }
    // offscreen object holds canvas into which we draw to get RGB values
    // no wrapper helpers needed here, we only manipulate this via the canvas API
    this.offscreen = {};
    this.offscreen.canvas = document.createElement("canvas");
    this.offscreen.canvas.setAttribute("width", this.png.image.width);
    this.offscreen.canvas.setAttribute("height", this.png.image.height);
    this.offscreen.context = this.offscreen.canvas.getContext("2d");
    // turn off anti-aliasing
    if( !JS9.ANTIALIAS ){
	this.offscreen.context.imageSmoothingEnabled = false;
    }
    // draw the png to the offscreen canvas
    this.offscreen.context.drawImage(this.png.image, 0, 0);
    // read the RGBA data from offscreen
    try{
	this.offscreen.img = this.offscreen.context.getImageData(0, 0,
			     this.png.image.width, this.png.image.height);
    } catch(e){
	if( JS9.CHROMEFILEWARNING &&
	    (JS9.BROWSER[0] === "Chrome") && (document.domain === "") ){
	    alert("When using the file:// URI, Chrome must be run with the --allow-file-access-from-files switch to permit JS9 to access data.");
	} else {
	    alert("could not read off-screen image data [same-origin policy violation?]");
	}
    }
    // allow chaining
    return this;
};

JS9.Image.prototype.useOffScreenCanvas = function(){
    return this.offscreen && (this.rgbFile || this.params.overlay);
};

// initialize keywords for various logical coordinate systems
JS9.Image.prototype.initLCS = function(iheader){
    let i, tval, rrot, frot, a, sina, cosa;
    const arr = [[0,0,0], [0,0,0], [0,0,0]];
    // header usually is raw header
    const header = iheader || this.raw.header;
    const cx = header.CRPIX1 || 1;
    const cy = header.CRPIX2 || 1;
    // seed rotation matrix and its inverse, if necessary
    if( header.LCSROTA2 && header.CROTA2 ){
	// screen rotation angle is reversed from FITS convention
	a = -header.CROTA2 * Math.PI / 180.0;
	sina = Math.sin(a);
	cosa = Math.cos(a);
	frot = [[0,0,0], [0,0,0], [0,0,0]];
	frot[0][0] = cosa;
	frot[0][1] = -sina;
	frot[0][2] = 0;
	frot[1][0] = sina;
	frot[1][1] = cosa;
	frot[1][2] = 0;
	rrot = JS9.invertMatrix3(frot);
	if( !rrot ){
	    frot = null;
	}
    }
    // physical coords
    arr[0][0] = JS9.defNull(header.LTM1_1, 1.0);
    arr[1][0] = header.LTM2_1 || 0.0;
    arr[0][1] = header.LTM1_2 || 0.0;
    arr[1][1] = JS9.defNull(header.LTM2_2, 1.0);
    arr[2][0] = header.LTV1   || 0.0;
    arr[2][1] = header.LTV2   || 0.0;
    if( this.imtab === "image" && this.params.ltvbug ){
	// There seems to be a tiny misalignment between wcs->image and
	// physical->image when ltv is involved. No idea why, but the fix is:
	// (set default to false after implementing rot90/flip 10/6/2019 ...
	//  on the fear this is doing more harm than good)
	if( JS9.notNull(header.LTV1) ){
	    for(i=0; i<2; i++){
		tval = Math.abs(arr[0][i]);
		if( tval > 0 && tval < 1 ){ arr[2][0] += tval * 0.5; }
	    }
	}
	if( JS9.notNull(header.LTV2) ){
	    for(i=0; i<2; i++){
		tval = Math.abs(arr[1][i]);
		if( tval > 0 && tval < 1 ){ arr[2][1] += tval * 0.5; }
	    }
	}
    }
    this.lcs.physical = {forward: JS9.extend(true, [], arr),
			 reverse: JS9.invertMatrix3(arr)};
    if( this.lcs.physical.reverse ){
	if( frot ){
	    this.lcs.physical.frot = JS9.extend(true, [], frot);
	    this.lcs.physical.rrot = JS9.extend(true, [], rrot);
	    // zero-index center
	    this.lcs.physical.cx = cx - arr[2][0] - 1;
	    this.lcs.physical.cy = cy - arr[2][1] - 1;
	}
    } else {
	delete this.lcs.physical;
    }
    // detector coordinates
    arr[0][0] = JS9.defNull(header.DTM1_1, 1.0);
    arr[1][0] = header.DTM2_1 || 0.0;
    arr[0][1] = header.DTM1_2 || 0.0;
    arr[1][1] = JS9.defNull(header.DTM2_2, 1.0);
    arr[2][0] = header.DTV1   || 0.0;
    arr[2][1] = header.DTV2   || 0.0;
    this.lcs.detector = {forward: JS9.extend(true, [], arr),
			reverse: JS9.invertMatrix3(arr)};
    if( this.lcs.detector.reverse ){
	if( frot ){
	    this.lcs.detector.frot = JS9.extend(true, [], frot);
	    this.lcs.detector.rrot = JS9.extend(true, [], rrot);
	    // zero-index center
	    this.lcs.detector.cx = cx - arr[2][0] - 1;
	    this.lcs.detector.cy = cy - arr[2][1] - 1;
	}
    } else {
	delete this.lcs.detector;
    }
    // amplifier coordinates
    arr[0][0] = JS9.defNull(header.ATM1_1, 1.0);
    arr[1][0] = header.ATM2_1 || 0.0;
    arr[0][1] = header.ATM1_2 || 0.0;
    arr[1][1] = JS9.defNull(header.ATM2_2, 1.0);
    arr[2][0] = header.ATV1   || 0.0;
    arr[2][1] = header.ATV2   || 0.0;
    this.lcs.amplifier = {forward: JS9.extend(true, [], arr),
			  reverse: JS9.invertMatrix3(arr)};
    if( this.lcs.amplifier.reverse ){
	if( frot ){
	    this.lcs.amplifier.frot = JS9.extend(true, [], frot);
	    this.lcs.amplifier.rrot = JS9.extend(true, [], rrot);
	    // zero-index center
	    this.lcs.amplifier.cx = cx - arr[2][0] - 1;
	    this.lcs.amplifier.cy = cy - arr[2][1] - 1;
	}
    } else {
	delete this.lcs.amplifier;
    }
    // reset lcs to image, if necessary
    if( this.params && !this.lcs[this.params.lcs] ){
	this.params.lcs = "image";
    }
    // set current, if not already done
    if( this.params && !this.params.wcssys0 ){
	this.setWCSSys("physical");
	this.params.wcssys0 = this.params.lcs;
    }
    // save original physical
    if( this.lcs.physical && !this.lcs.ophysical ){
	this.lcs.ophysical = JS9.extend(true, {}, this.lcs.physical);
    }
    // allow chaining
    return this;
};

// read input object and convert to image data
JS9.Image.prototype.mkRawDataFromHDU = function(obj, opts){
    let i, s, ui, clen, hdu, pars, card, got, rlen, rmvfile, done, frheap;
    let oraw, owidth, oheight, obitpix, owcssys, owcsunits;
    let header, x1, y1, bin;
    let nhist = 0;
    let ncomm = 0;
    opts = opts || {};
    if( JS9.isArray(obj) || JS9.isTypedArray(obj) || obj instanceof ArrayBuffer ){
	// flatten if necessary
	if( JS9.isArray(obj[0]) ){
	    obj = obj.reduce( (a, b) => { return a.concat(b); });
	}
	// javascript array or typed array
	hdu = {image: obj};
    } else if( typeof obj === "object" ){
	// fits object
	hdu = obj;
    } else {
	JS9.error("unknown or missing input for HDU creation");
    }
    // allow image to be passed in data property
    if( hdu.data && !hdu.image ){
	hdu.image = hdu.data;
    }
    // better have the image ...
    if( !hdu.image ){
	JS9.error(`data missing from JS9 FITS object: ${JSON.stringify(hdu)}`);
    }
    // quick check for 1D images (in case naxis is defined)
    if( hdu.naxis < 2 ){
	JS9.error("can't image a FITS file with less than 2 dimensions");
    }
    // save old essential values, if possible (for use as defaults)
    // free previous WCS, if possible
    if( this.raw ){
	oraw = this.raw;
	owidth = this.raw.width;
	oheight = this.raw.height;
	obitpix = this.raw.bitpix;
	owcssys = this.params.wcssys;
	owcsunits = this.params.wcsunits;
	this.freeWCS();
    }
    // initialize raws array?
    this.raws = this.raws || [];
    rlen = this.raws.length;
    if( !rlen ){
	// create object to hold raw data and add to raws array
	this.raws.push({from: "hdu"});
	// assign this object to the high-level raw data object
	this.raw = this.raws[rlen];
	// ignore rawid, this is the default raw data
	this.raw.id = JS9.RAWID0;
    } else {
	opts.rawid = opts.rawid || JS9.RAWIDX;
	// reuse raw object with the same id, after re-initializing it
	got = 0;
	for(i=0; i<rlen; i++){
	    if( opts.rawid === this.raws[i].id  ){
		s = this.raws[i].from;
		this.raws[i] = {from: s, id: opts.rawid};
		this.raw = this.raws[i];
		got++;
		break;
	    }
	}
	// otherwise, create new raw object with this id
	if( !got ){
	    // create the object to hold raw data and add to raws array
	    this.raws.push({from: "hdu", id: opts.rawid});
	    // assign this object to the high-level raw data object
	    this.raw = this.raws[rlen];
	    // the old raw object is invalid
	    oraw = null;
	}
    }
    // now save the hdu in the raw object
    this.raw.hdu = hdu;
    // fill in raw data info directly from the fits object
    if( hdu.axis ){
	this.raw.width  = hdu.axis[1];
	this.raw.height = hdu.axis[2];
    } else if( hdu.naxis1 && hdu.naxis2 ){
	this.raw.width  = hdu.naxis1;
	this.raw.height = hdu.naxis2;
    } else if( owidth && oheight ){
	this.raw.width  = owidth;
	this.raw.height = oheight;
    }
    if( hdu.bitpix ){
	this.raw.bitpix = hdu.bitpix;
    } else if( obitpix ){
	this.raw.bitpix = obitpix;
    }

    // if the data is base64-encoded, decode it now
    if( hdu.encoding === "base64" ){
	s = window.atob(hdu.image);
	// make an arraybuffer to hold the bytes from the decoded string
	hdu.image = new ArrayBuffer(s.length);
	ui = new Uint8Array(hdu.image);
	// to be turned into the right datatyped typed array, below
	for(i=0; i<s.length; i++){
	   ui[i] = s.charCodeAt(i);
	}
    }
    // make sure we have a typed array
    // flatten if necessary
    if( JS9.isArray(hdu.image[0]) ){
	hdu.image = hdu.image.reduce( (a, b) => { return a.concat(b); });
    }
    // make the raw data: note in the case of a typed array coming from
    // the runtime heap, this is a copy, so we can free the heap immediately
    // (done below iff clearImageMemory contains the "heap" directive).
    // I didn't realize new XXXArray(typedArray) makes a copy, but see:
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray
    switch(this.raw.bitpix){
    case 8:
	this.raw.data = new Uint8Array(hdu.image);
	break;
    case 16:
	this.raw.data = new Int16Array(hdu.image);
	break;
    case -16:
	this.raw.data = new Uint16Array(hdu.image);
	break;
    case 32:
	this.raw.data = new Int32Array(hdu.image);
	break;
    case -32:
	this.raw.data = new Float32Array(hdu.image);
	break;
    case -64:
	this.raw.data = new Float64Array(hdu.image);
	break;
    default:
	JS9.error(`unsupported bitpix: ${this.raw.bitpix}`);
	break;
    }
    // array of cards
    this.raw.card = hdu.card;
    // cfitsio returns these:
    this.raw.cardstr = hdu.cardstr;
    this.raw.ncard = hdu.ncard;
    // look for header
    if( hdu.head ){
	this.raw.header = hdu.head;
    } else if( this.raw.card ){
	this.raw.header = {};
	// make up header from array of raw cards
	clen = this.raw.card.length;
	for(i=0; i<clen; i++){
	    pars = JS9.cardpars(this.raw.card[i]);
	    if( pars !== undefined ){
		if( pars[0] === "HISTORY" ){
		    this.raw.header[`${pars[0]}__${nhist++}`] = pars[1];
		} else if( pars[0] === "COMMENT" ){
		    this.raw.header[`${pars[0]}__${ncomm++}`] = pars[1];
		} else {
		    this.raw.header[pars[0]] = pars[1];
		}
	    }
	}
    } else if( this.raw.cardstr ){
	this.raw.header = {};
	// make up header from string containing 80-char raw cards
	clen = this.raw.ncard;
	for(i=0; i<clen; i++){
	    card = this.raw.cardstr.slice(i*80, (i+1)*80);
	    pars = JS9.cardpars(card);
	    if( pars !== undefined ){
		if( pars[0] === "HISTORY" ){
		    this.raw.header[`${pars[0]}__${nhist++}`] = pars[1];
		} else if( pars[0] === "COMMENT" ){
		    this.raw.header[`${pars[0]}__${ncomm++}`] = pars[1];
		} else {
		    this.raw.header[pars[0]] = pars[1];
		}
	    }
	}
    } else {
	// simplest FITS header imaginable
	this.raw.header = {};
	this.raw.header.SIMPLE = true;
	this.raw.header.NAXIS = 2;
	this.raw.header.NAXIS1 = this.raw.width;
	this.raw.header.NAXIS2 = this.raw.height;
	this.raw.header.BITPIX = this.raw.bitpix;
    }
    // convenience variable
    header = this.raw.header;
    // hack for binning.js:
    // if an original file header has LTM/LTV keywords, save them now,
    // so we can go back to file coords at any time
    if( !oraw && !this.parentFile && !this.parent ){
	if( header.LTV1 !== undefined   || header.LTV2 !== undefined   ||
	    header.LTM1_1 !== undefined || header.LTM2_2 !== undefined ){
	    this.parent = {};
	    this.parent.raw = {header: JS9.extend(true, {}, header)};
	    // initialize LCS for this parent header
	    this.parent.lcs = {};
	    // call is used because this.parent is not an image object
	    JS9.Image.prototype.initLCS.call(this.parent,
					     this.parent.raw.header);
	}
    }
    // if section information is available, modify the WCS keywords
    // e.g., image sections returned by adapter getFITSImage()
    // this code should match the algorithm in jsfitsio.c/updateWCS()
    if( hdu.imtab === "image"  &&
	(hdu.x1 !== undefined  && hdu.x1 !== 1)  ||
	(hdu.y1 !== undefined  && hdu.y1 !== 1)  ||
	(hdu.bin === undefined || hdu.bin !== 1) ){
	x1 = JS9.defNull(hdu.x1, 1);
	y1 = JS9.defNull(hdu.y1, 1);
	bin = hdu.bin || 1;
	if( bin < 0 ){ bin = 1.0 / Math.abs(bin); }
	if( JS9.notNull(header.NAXIS1) ){ header.NAXIS1 /= bin;	}
	if( JS9.notNull(header.NAXIS2) ){ header.NAXIS2 /= bin;	}
	if( JS9.notNull(header.CRPIX1) ){
	    // funtools-style: see funtools/funcopy.c/_FunCopy2ImageHeader
	    header.CRPIX1 = (header.CRPIX1 + 1.0 - x1 - 0.5) / bin + 0.5;
	    // cfitsio-style: see cfitsio/histo.c
	    // header.CRPIX1 = (header.CRPIX1 - x1) / bin + 0.5;
	}
	if( JS9.notNull(header.CRPIX2) ){
	    // funtools-style: see funtools/funcopy.c/_FunCopy2ImageHeader
	    header.CRPIX2 = (header.CRPIX2 + 1.0 - y1 - 0.5) / bin + 0.5;
	    // cfitsio-style: see cfitsio/histo.c
	    // header.CRPIX2 = (header.CRPIX2 - y1) / bin + 0.5;
	}
	if( JS9.notNull(header.CDELT1) ){ header.CDELT1 *= bin; }
	if( JS9.notNull(header.CDELT2) ){ header.CDELT2 *= bin; }
	if( JS9.notNull(header.CD1_1) ){  header.CD1_1  *= bin; }
	if( JS9.notNull(header.CD1_2) ){  header.CD1_2  *= bin; }
	if( JS9.notNull(header.CD2_1) ){  header.CD2_1  *= bin; }
	if( JS9.notNull(header.CD2_2) ){  header.CD2_2  *= bin; }
	header.LTM1_1 = JS9.defNull(header.LTM1_1, 1.0);
	header.LTM1_1 = header.LTM1_1 / bin;
	header.LTM2_1 = header.LTM2_1 || 0.0;
	header.LTM2_1 = header.LTM2_1 / bin;
	header.LTM1_2 = header.LTM1_2 || 0.0;
	header.LTM1_2 = header.LTM1_2 / bin;
	header.LTM2_2 = JS9.defNull(header.LTM2_2, 1.0);
	header.LTM2_2 = header.LTM2_2 / bin;
	// cfitsio-style: see cfitsio/histo.c
	// it's a mystery why funtools-style does not work here ...
	// (sigh ...cause LTV is 0-indexed but x1 is 1-indexed?)
	header.LTV1 = header.LTV1 || 0;
	header.LTV1 = (header.LTV1 - x1) / bin + 0.5;
	header.LTV2 = header.LTV2 || 0;
	header.LTV2 = (header.LTV2 - y1) / bin + 0.5;
    }
    // add header param to tell LCS system to use CROTA2 to modify LTM
    // needed because Montage does not know about LTM
    if( opts.lcsUseRota2 ){
	header.LCSROTA2 = true;
    }
    // look for a file/url (we'll also get a new id, see below)
    if( opts.file && opts.file !== this.file ){
	this.file = opts.file;
	this.id = null;
    } else if( opts.filename && opts.filename !== this.file ){
	// (11/2021: leave check on 'filename' for backward compatibility)
	this.file = opts.filename;
	this.id = null;
    } else if( hdu.file && hdu.file !== this.file ){
	this.file = hdu.file;
	this.id = null;
    }
    this.file = JS9.cleanPath(this.file) || (JS9.ANON + JS9.uniqueID());
    // save original file in case we add an extension
    this.file0 = this.file;
    // look for an id
    if( opts.id ){
	// get a unique id for this image
	this.id0 = opts.id;
	this.id = JS9.getImageID(opts.id, this.display.id, this);
    }
    // add extname or extnum, if possible
    if( !this.id && this.file && !this.file.match(/\[.*[^a-zA-Z0-9_].*\]/) ){
	if( opts.extname || opts.extnum ){
	    if( opts.extname ){
		this.file = this.file.replace(/\[.*\]/, "");
		this.file += `[${opts.extname}]`;
	    } else if( opts.extnum && (opts.extnum > 0) ){
		this.file = this.file.replace(/\[.*\]/, "");
		this.file += `[${opts.extnum}]`;
	    }
	    if( hdu.fits ){
		if( opts.extname ){
		    hdu.fits.extname = opts.extname;
		}
		if( opts.extnum && (opts.extnum > 0) ){
		    hdu.fits.extnum = opts.extnum;
		}
	    }
	} else if( hdu.fits ){
	    if( hdu.fits.extname ){
		this.file = this.file.replace(/\[.*\]/, "");
		this.file += `[${hdu.fits.extname}]`;
	    } else if( hdu.fits.extnum && (hdu.fits.extnum > 0) ){
		this.file = this.file.replace(/\[.*\]/, "");
		this.file += `[${hdu.fits.extnum}]`;
	    }
	} else if( this.raw.header ){
	    if( this.raw.header.EXTNAME ){
		this.file = this.file.replace(/\[.*\]/, "");
		this.file += `[${this.raw.header.EXTNAME}]`;
	    }
	}
    }
    // last chance: get it from the file
    if( !this.id ){
	// save id in case we have to change it for uniqueness
	this.id0 = (this.parentFile||this.file).split("/").reverse()[0];
	// get a unique id for this image
	this.id = JS9.getImageID(this.id0, this.display.id, this);
    }
    // is this a proxy image?
    if( opts.proxyFile ){
	this.proxyFile = opts.proxyFile;
    }
    // save filter, if necessary
    this.raw.filter = opts.filter || "";
    this.raw.columns = opts.columns || "";
    // image or table?
    if( hdu.imtab ){
	this.imtab = hdu.imtab;
    } else {
	this.imtab = hdu.table ? "table" : "image";
    }
    // also associate imtab with this raw layer
    this.raw.imtab = this.imtab;
    // min and max data values
    if( hdu.dmin !== undefined && hdu.dmax !== undefined ){
	// data min and max in object
	this.dataminmax(hdu.dmin, hdu.dmax);
    } else {
	// calculate data min and max
	this.dataminmax();
    }
    // object, telescope, instrument names
    this.object = this.raw.header.OBJECT;
    this.telescope = this.raw.header.TELESCOP;
    this.instrument = this.raw.header.INSTRUME;
    // see if binning was passed to us in opts, e.g. from external imsection
    // (internally, it's ordinarily in hdu or hdu.table)
    if( opts.binstr ){
	try{ s =  opts.binstr.split(/\s+/);
	     if( s && s.length === 2 ){
		 if( (this.imtab === "table") && hdu.table ){
		     hdu.table.bin = parseFloat(s[0]);
		     hdu.table.binMode = s[1];
		 } else {
		     hdu.bin = parseFloat(s[0]);
		     hdu.binMode = s[1];
		 }
	     }
	   }
	catch(ignore){ /* empty */ }
    }
    // reset binning properties, as necessary
    if( (this.imtab === "table") && hdu.table ){
	this.binning.bin = hdu.table.bin || 1;
    } else if( hdu.bin ){
	this.binning.bin = hdu.bin > 0 ? hdu.bin : 1 / Math.abs(hdu.bin);
    } else {
	this.binning.bin = 1;
    }
    // make sure obin matches bin for previous load of data
    if( !oraw ){
	this.binning.obin = this.binning.bin;
    }
    // reset the wcssys and wcsunits to previous, if necessary
    if( owcssys ){
	this.setWCSSys(owcssys);
    }
    if( owcsunits ){
	this.setWCSUnits(owcsunits);
    }
    // init WCS, if necessary
    if( oraw && oraw.header.CTYPE1 && oraw.header.CTYPE2 &&
	this.raw.header.CTYPE1 && this.raw.header.CTYPE2 &&
	(oraw.header.CTYPE1 !== this.raw.header.CTYPE1   ||
	 oraw.header.CTYPE2 !== this.raw.header.CTYPE2)  ){
	this.initWCS();
    }
    // save offscreen data if necessary
    if( JS9.notNull(hdu.offscreen) ){
	this.png = {image: hdu.offscreen};
	this.mkOffScreenCanvas();
    }
    // re-init wcs
    this.initWCS();
    // init the logical coordinate system, if possible
    this.initLCS();
    // get hdu info, if possible
    try{
	if( opts.hdus ){
	    this.hdus = opts.hdus;
	} else if( this.parentFile &&
		   JS9.helper.connected && JS9.helper.js9helper ){
	    obj = {
		id: this.expandMacro("$id"),
		cmd: this.expandMacro("js9Xeq listhdus $filename"),
		image: this.file,
		fits: this.parentFile,
		rtype: "text"
	    };
	    JS9.helper.send("listhdus", obj, (obj) => {
		if( obj.stderr ){
		    return;
		}
		if( obj.errcode ){
		    return;
		}
		if( obj.stdout ){
		    try{ this.hdus = JSON.parse(obj.stdout); }
		    catch(e) { this.hdus = null; }
		}
	    });
	} else if( this.raw.hdu && this.raw.hdu.fits ){
	    s = JS9.listhdu(this.raw.hdu.fits.vfile);
	    if( s ){
		try{ this.hdus = JSON.parse(s); }
		catch(e) { this.hdus = null; }
	    }
	}
    }
    catch(ignore){ /* empty */ }
    // can we remove the virtual file?
    if( this.raw.hdu && this.raw.hdu.fits && this.raw.hdu.fits.vfile  ){
	s = JS9.globalOpts.clearImageMemory;
	if( s === false ){
	    s = ["never"];
	} else if( s === true ){
	    s = ["always"];
	} else {
	    s = s.toLowerCase().split(/[,>]/);
	}
	rmvfile = false;
	frheap = false;
	// all conditions must be met ...
	for(i=0, done=false; i<s.length && !done; i++){
	    switch(s[i]){
	    case "never":
		rmvfile = false;
		done = true;
		break;
	    case "always":
		rmvfile = true;
		done = true;
		break;
	    case "heap":
		frheap = true;
		break;
	    case "auto":
		if( (this.raw.header.NAXIS <= 2)  &&
		    (!this.hdus || this.hdus.length === 1) ){
		    rmvfile = true;
		} else {
		    rmvfile = false;
		    done = true;
		}
		break;
	    case "nocube":
		if( this.raw.header.NAXIS <= 2 ){
		    rmvfile = true;
		} else {
		    rmvfile = false;
		    done = true;
		}
		break;
	    case "noext":
		if( !this.hdus || this.hdus.length === 1 ){
		    rmvfile = true;
		} else {
		    rmvfile = false;
		    done = true;
		}
		break;
	    case "size":
		if( s[i+1] ){
		    if( JS9.vsize(hdu.fits.vfile) > s[i+1]*1000000 ){
			rmvfile = true;
		    } else {
			rmvfile = false;
			done = true;
		    }
		} else {
		    rmvfile = false;
		    done = true;
		}
		break;
	    default:
		break;
	    }
	}
	// remove virtual file and/or heap space
	if( rmvfile ){
	    if( JS9.DEBUG > 2 ){
		JS9.log("removing underlying FITS vfile for %s: %s",
			this.id, this.raw.hdu.fits.vfile);
	    }
	    JS9.cleanupFITSFile(this.raw, true);
	} else if( frheap ){
	    if( JS9.DEBUG > 2 ){
		JS9.log("freeing heap space for %s: %s",
			this.id, this.raw.hdu.fits.vfile);
	    }
	    JS9.cleanupFITSFile(this.raw, false);
	}
    }
    // plugin callbacks
    this.xeqPlugins("image", "onrawdata");
    // allow chaining
    return this;
};

// store section information
JS9.Image.prototype.mkSection = function(...args){
    let s, xtra;
    const sect = this.rgb.sect;
    const getWidth = (zoom) => {
	let len;
	let canvas = this.display.canvas;
	if( this.params.transformAngle ){
	    len = Math.max(canvas.width, canvas.height);
	    return Math.min(this.raw.width * zoom, len);
	} else {
	    return Math.min(this.raw.width * zoom, canvas.width);
	}
    };
    const getHeight = (zoom) => {
	let len;
	let canvas = this.display.canvas;
	if( this.params.transformAngle ){
	    len = Math.max(canvas.width, canvas.height);
	    return Math.min(this.raw.height * zoom, len);
	} else {
	    return Math.min(this.raw.height * zoom, canvas.height);
	}
    };
    // save zoom in case we are about to change it (regions have to be scaled)
    sect.ozoom  = sect.zoom;
    // process args
    switch(args.length){
    case 0:
	// no args: init to display central part of image
	sect.xcen   = Math.floor(this.raw.width/2);
	sect.ycen   = Math.floor(this.raw.height/2);
	sect.width  = getWidth(1);
	sect.height = getHeight(1);
	break;
    case 1:
	if( !JS9.isNumber(args[0]) ){
	    JS9.error(`invalid input for generating section: ${args[0]}`);
	}
	sect.zoom   = parseFloat(args[0]);
	sect.width  = getWidth(sect.zoom);
	sect.height = getHeight(sect.zoom);
	break;
    case 2:
	// two args: x, y
	if( !JS9.isNumber(args[0]) || !JS9.isNumber(args[1]) ){
	    JS9.error(`invalid input for generating section: ${args[0]} ${args[1]}`);
	}
	sect.xcen   = parseFloat(args[0]);
	sect.ycen   = parseFloat(args[1]);
	// reset width and height if there was a section offset
	if( JS9.notNull(sect.ix) ){
	    sect.width  = getWidth(sect.zoom);
	}
	if( JS9.notNull(sect.iy) ){
	    sect.height = getHeight(sect.zoom);
	}
	break;
    case 3:
	// three args: x, y, zoom
	if( !JS9.isNumber(args[0]) ||
	    !JS9.isNumber(args[1]) ||
	    !JS9.isNumber(args[2]) ){
	    JS9.error(`invalid input for generating section: ${args[0]} ${args[1]} ${args[2]}`);
	}
	sect.xcen   = parseFloat(args[0]);
	sect.ycen   = parseFloat(args[1]);
	sect.zoom   = parseFloat(args[2]);
	sect.width  = getWidth(sect.zoom);
	sect.height = getHeight(sect.zoom);
	break;
    default:
	break;
    }
    // assume no offset when displaying section
    delete sect.ix;
    delete sect.iy;
    // calculate section limits from center and dimensions
    sect.x0 = sect.xcen - (sect.width/(2*sect.zoom));
    sect.y0 = sect.ycen - (sect.height/(2*sect.zoom));
    sect.x1 = sect.xcen + (sect.width/(2*sect.zoom));
    sect.y1 = sect.ycen + (sect.height/(2*sect.zoom));
    // make sure we're within bounds while maintaining section dimensions
    if( sect.x0 < 0 ){
	if( JS9.globalOpts.panWithinDisplay ){
            sect.x1 -= sect.x0;
	} else {
	    sect.ix = sect.x0 * sect.zoom;
	}
        sect.x0 = 0;
    }
    if( sect.y0 < 0 ){
	if( JS9.globalOpts.panWithinDisplay ){
            sect.y1 -= sect.y0;
	} else {
	    sect.iy = sect.y0 * sect.zoom;
	}
        sect.y0 = 0;
    }
    if( sect.x1 > this.raw.width ){
	if( JS9.globalOpts.panWithinDisplay ){
            sect.x0 -= (sect.x1 - this.raw.width);
	} else {
	    sect.ix = (sect.x1 - this.raw.width) * sect.zoom;
	}
        sect.x1 = this.raw.width;
    }
    if( sect.y1 > this.raw.height ){
	if( JS9.globalOpts.panWithinDisplay ){
            sect.y0 -= (sect.y1 - this.raw.height);
	} else {
	    sect.iy = (sect.y1 - this.raw.height) * sect.zoom;
	}
        sect.y1 = this.raw.height;
    }
    // for offset images, maybe display more of the image
    if( sect.ix > 0 && sect.x0 > 0 ){
	xtra =  Math.min(sect.ix, sect.x0);
	sect.x0 -= xtra;
	sect.ix += xtra * sect.zoom;
    }
    if( sect.ix < 0 && sect.x1 < this.raw.width ){
	xtra =  Math.min(this.raw.width - sect.x1, Math.abs(sect.ix));
	sect.x1 += xtra;
	sect.ix -= xtra * sect.zoom;
    }
    if( sect.iy > 0 && sect.y0 > 0 ){
	xtra =  Math.min(sect.iy, sect.y0);
	sect.y0 -= xtra;
	sect.iy += xtra * sect.zoom;
    }
    if( sect.iy < 0 && sect.y1 < this.raw.height ){
	xtra =  Math.min(this.raw.height - sect.y1, Math.abs(sect.iy));
	sect.y1 += xtra;
	sect.iy -= xtra * sect.zoom;
    }
    // final check: make sure we're within bounds
    sect.x0 = Math.max(0, sect.x0);
    sect.x1 = Math.min(this.raw.width, sect.x1);
    sect.y0 = Math.max(0, sect.y0);
    sect.y1 = Math.min(this.raw.height, sect.y1);
    // final integer dimensions
    sect.x0 = Math.floor(sect.x0);
    sect.y0 = Math.floor(sect.y0);
    sect.x1 = Math.floor(sect.x1);
    sect.y1 = Math.floor(sect.y1);
    // final section limits: derive new width and height
    sect.width   = Math.ceil((sect.x1 - sect.x0) * sect.zoom);
    sect.height  = Math.ceil((sect.y1 - sect.y0) * sect.zoom);
    // sanity check
    if( sect.width <= 0 || sect.height <= 0 ){
	s = sprintf("invalid image section: %s,%s [%s,%s, %s,%s, %s]",
		    sect.width, sect.height,
		    sect.x0, sect.y0, sect.x1, sect.y1,
		    sect.zoom);
	JS9.error(s);
    }
    // put zoom back into params
    this.params.zoom = sect.zoom;
    // allow chaining
    return this;
};

// create colormap index array from data values and specified data min/max
// from: tksao1.0/frame/frametruecolor.C
JS9.Image.prototype.mkColorData = function(){
    let i, dd, idata, odata;
    const ss = JS9.SCALESIZE;
    const length = ss - 1;
    const dmin = this.params.scalemin;
    const dmax = this.params.scalemax;
    const dlen = this.raw.width * this.raw.height;
    const diff = dmax - dmin;
    const dval = length / diff;
    // skip if colormap is static
    if( this.cmapObj.type === "static" ){
	return this;
    }
    // allocate array
    if( !this.colorData || this.colorData.length < dlen ){
	this.colorData = new Int32Array(dlen);
    }
    // Important note 7/13/2020:
    // Chrome 83.0.4103.116 was taking either 4ms ... or 2+ seconds to do
    // this loop on a 2048x2048 int image (casa.fits in js9debug.html).
    // Replacing this.raw.data and this.colorData with local variables seems
    // to fix this slowdown. omg ...
    idata = this.raw.data;
    odata = this.colorData;
    // for each raw value, calculate lookup offset into scaled array
    for(i=0; i<dlen; i++){
	dd = idata[i];
	if( dd <= dmin ){
	    odata[i] = 0;
	} else if( dd >= dmax ){
	    odata[i] = ss - 1;
	} else {
	    odata[i] = Math.floor(((dd - dmin) * dval) + 0.5);
	}
    }
    // allow chaining
    return this;
};

// generate colorcells array from current colormap
// from: tksao1.0/colorbar/colorbar.C
JS9.Image.prototype.calcContrastBias = function(i){
    let r, result;
    let bias = this.params.bias;
    const cs = JS9.COLORSIZE;
    const contrast = this.params.contrast;
    // check for (close to) default
    if( ((bias - 0.5) < 0.0001) && ((contrast - 1.0) < 0.0001) ){
	return i;
    }
    // map i to range of 0 to 1.0
    // shift by bias (if invert, bias = 1 - bias)
    // multiply by contrast
    // shift to center of region
    // expand back to number of dynamic colors
    if( this.params.invert ){
	bias = 1 - bias;
    }
    r = Math.floor((((i / cs) - bias) * contrast + 0.5) * cs);
    if( r < 0 ){
	result = 0;
    } else if( r >= cs ){
	result = cs - 1;
    } else {
	result = r;
    }
    return result;
};

// generate colorcells array from current colormap
// from: tksao1.0/colorbar/colorbartruecolor.C
JS9.Image.prototype.mkColorCells = function(){
    let i, j, idx;
    const cs = JS9.COLORSIZE;
    // skip if colormap is static
    if( this.cmapObj.type === "static" ){
	return this;
    }
    // allocate array for color cells
    if( !this.colorCells ){
	this.colorCells = [];
    }
    // fill in colorcells
    for(i=0; i<cs; i++){
	j = this.params.invert ? cs - i - 1 : i;
	idx = this.calcContrastBias(j);
	this.colorCells[i] = this.cmapObj.mkColorCell(idx);
    }
    // allow chaining
    return this;
};

// create scaled colorCells from colorCells by applying scale algorithm
// from: tksao1.0/frame/colorscale.C
// inverse code from: tksao1.0/frame/inversescale.C
JS9.Image.prototype.mkScaledCells = function(){
    let aa, dd, ii, jj, ll, exp, low, vv, avg, color;
    let data, dlen, diff, bin, total, dval, dmin, dmax, pdf;
    const cs = JS9.COLORSIZE;
    const ss = JS9.SCALESIZE;
    const tt = JS9.INVSIZE;
    const hh = JS9.HISTSIZE;
    const hex2num = (hex) => {
	let i, k, int1, int2;
	const hex_alphabets = "0123456789ABCDEF";
	const value = [];
	//Remove the "#" char - if there is one.
	if(hex.charAt(0) === "#"){
	    hex = hex.slice(1);
	}
	hex = hex.toUpperCase();
	for(i=0, k=0; i<6; i+=2, k++){
	    int1 = hex_alphabets.indexOf(hex.charAt(i));
	    int2 = hex_alphabets.indexOf(hex.charAt(i+1));
	    value[k] = (int1 * 16) + int2;
	}
	return value;
    };
    // sanity check
    if( !this.colorCells ){ return this; }
    // skip if colormap is static
    if( this.cmapObj.type === "static" ){ return this; }
    // allocate array for scaled cells
    if( !this.psColors ){
	this.psColors = [];
	// value for NaN
	this.psColors[NaN] = hex2num(this.params.nancolor);
    }
    // and the inverse array for colorbar ticks
    if( !this.psInverse ){
	this.psInverse = [];
	// value for NaN
	this.psInverse[NaN] = 0;
    }
    // delta for scaling
    dd = this.params.scalemax - this.params.scalemin;
    low = this.params.scalemin;
    // apply the appropriate scale algorithm
    switch(this.params.scale){
    case "linear":
	// scaled cells
	for(ii=0; ii<ss; ii++){
	    aa = ii / ss;
	    ll = Math.floor(aa * cs);
	    this.psColors[ii] = this.colorCells[ll];
	}
	// inverse
	for(ii=0; ii<tt; ii++){
	    aa = ii / tt;
	    this.psInverse[ii] = aa * dd + low;
	}
	break;
    case "log":
	exp = this.params.exp;
	// scaled cells
	for(ii=0; ii<ss; ii++){
	    aa = Math.log(((exp*ii)/ss)+1) / Math.log(exp);
	    ll = Math.floor(aa * cs);
	    if( ll >= cs ){
		ll = cs - 1;
	    }
	    this.psColors[ii] = this.colorCells[ll];
	}
	// inverse
	for(ii=0; ii<tt; ii++){
	    aa = (Math.pow(exp,ii/tt)-1) / exp;
	    this.psInverse[ii] =  aa * dd + low;
	}
	break;
    case "power":
	exp = this.params.exp;
	// scaled cells
	for(ii=0; ii<ss; ii++){
	    aa = (Math.pow(exp, ii/ss)-1) / exp;
	    ll = Math.floor(aa * cs);
	    if( ll >= cs ){
		ll = cs - 1;
	    }
	    this.psColors[ii] = this.colorCells[ll];
	}
	// inverse
	for(ii=0; ii<tt; ii++){
	    aa = Math.log(exp*ii/tt+1) / Math.log(exp);
	    this.psInverse[ii] =  aa * dd + low;
	}
	break;
    case "sqrt":
	// scaled cells
	for(ii=0; ii<ss; ii++){
	    aa = ii / ss;
	    ll = Math.floor(Math.sqrt(aa) * cs);
	    if( ll >= cs ){
		ll = cs - 1;
	    }
	    this.psColors[ii] = this.colorCells[ll];
	}
	// inverse
	for(ii=0; ii<tt; ii++){
	    aa = ii / tt;
	    this.psInverse[ii] =  (aa * aa) * dd + low;
	}
	break;
    case "squared":
	// scaled cells
	for(ii=0; ii<ss; ii++){
	    aa = ii / ss;
	    ll = Math.floor(aa * aa * cs);
	    if( ll >= cs ){
		ll = cs - 1;
	    }
	    this.psColors[ii] = this.colorCells[ll];
	}
	// inverse
	for(ii=0; ii<tt; ii++){
	    aa = Math.sqrt(ii/tt);
	    this.psInverse[ii] =  aa * dd + low;
	}
	break;
    case "asinh":
	// scaled cells
	for(ii=0; ii<ss; ii++){
	    aa = ii / ss;
	    ll = Math.floor(Math.asinh(10.0*aa)/3.0 * cs);
	    if( ll >= cs ){
		ll = cs - 1;
	    }
	    this.psColors[ii] = this.colorCells[ll];
	}
	// inverse
	for(ii=0; ii<tt; ii++){
	    aa = ii / tt;
	    ll = Math.sinh(3.0*aa)/10.0;
	    this.psInverse[ii] =  ll * dd + low;
	}
	break;
    case "sinh":
	// scaled cells
	for(ii=0; ii<ss; ii++){
	    aa = ii / ss;
	    ll = Math.floor(Math.sinh(3.0*aa)/10.0 * cs);
	    if( ll >= cs ){
		ll = cs - 1;
	    }
	    this.psColors[ii] = this.colorCells[ll];
	}
	// inverse
	for(ii=0; ii<tt; ii++){
	    aa = ii / tt;
	    ll = Math.asinh(10.0*aa)/3.0;
	    this.psInverse[ii] =  ll * dd + low;
	}
	break;
    case "histeq":
	// taken from: saods9/tksao1.0/frame/frscale.C
	data = this.raw.data;
	dlen = this.raw.width * this.raw.height;
	diff = (this.raw.dmax - this.raw.dmin);
	dmax = this.raw.dmax;
	dmin = this.raw.dmin;
	bin = 0;
	total = 0;
	pdf = [];
	if( !this.hist || !this.hist.length ){
	    this.hist = [];
	    // start with a cleared pdf buffer
	    for(ii=0; ii<hh; ii++){
		pdf[ii] = 0;
	    }
	    // make histogram from data values
	    for(ii=0; ii<dlen; ii++){
		if( (data[ii] >= dmin) && (data[ii] <= dmax) ){
		    jj = Math.floor((data[ii] - dmin) / diff * hh + 0.5);
		    if( jj < hh ){
			pdf[jj] += 1;
		    }
		}
	    }
	    // get average
	    for(ii=0; ii<hh; ii++){
		total += pdf[ii];
	    }
	    avg = total / hh;
	    // generate histogram
	    for(color=0, ii=0; ii<hh && color<hh; ii++){
		this.hist[ii] = color / hh;
		bin += pdf[ii];
		while( (bin >= avg) && (color < hh) ){
		    bin -= avg;
		    color++;
		}
	    }
	    dval = (hh - 1) /hh;
	    while( ii < hh ){
		this.hist[ii++] = dval;
	    }
	}
	// scaled cells
	for(ii=0; ii<ss; ii++){
	    aa = this.hist[ii * hh / ss];
	    ll = Math.floor(aa * cs);
	    this.psColors[ii] = this.colorCells[ll];
	}
	// inverse
	for(ii=0; ii<tt; ii++){
	    vv = ii / tt;
	    for(jj=0; jj < (hh - 1); jj++){
		if( this.hist[jj] > vv ){
		    break;
		}
	    }
	    aa = jj / hh;
	    this.psInverse[ii] = aa * diff + dmin;
	}
	break;
    default:
	JS9.error(`unknown scale '${this.params.scale}'`);
    }
    // allow chaining
    return this;
};

// create RGB image from scaled colorCells
// sort of from: tksao1.0/frame/truecolor.c, but not really
JS9.Image.prototype.mkRGBImage = function(){
    let rgb, sect, img, xrgb, yrgb, wrgb, hrgb, rgbimg, ctx;
    let inc, zinc, xIn, yIn, xOut, yOut, xOutIdx, yOutIdx, yZoom, xZoom, cobj;
    let idx, odx, odxmax, ridx, gidx, bidx, mim, mimg;
    let yLen, zx, zy, zyLen, mopacity, cmopacity, val;
    let alpha, alpha1, alpha2, alphafloor, alphafloorvalue, curalpha;
    let domask = false;
    let doalphafloor = false;
    let rthis = null;
    let gthis = null;
    let bthis = null;
    let dorgb = false;
    let mimmask = false;
    let mimopacity = false;
    let mimoverlay = false;
    let cached = [];
    // sanity check
    if( !this.rgb ){ return this; }
    // image handles for RGB mode
    if( this.display.rgb.active &&
	((this === this.display.rgb.rim) ||
	 (this === this.display.rgb.gim) ||
	 (this === this.display.rgb.bim)) ){
	dorgb = true;
	if( this.display.rgb.rim ){
	    rthis = this.display.rgb.rim;
	}
	if( this.display.rgb.gim ){
	    gthis = this.display.rgb.gim;
	}
	if( this.display.rgb.bim ){
	    bthis = this.display.rgb.bim;
	}
    }
    ctx = this.display.context;
    rgb = this.rgb;
    sect = rgb.sect;
    // supply your own mkRGBImage call (black-magic, used by smart-x)
    if( this.MakeRGBImage && typeof this.MakeRGBImage === "function" ){
	if( this.MakeRGBImage() ){
	    return this;
	}
    }
    // backward-compatibility with v1.7
    if( this.MakePrimaryImage && typeof this.MakePrimaryImage === "function" ){
	if( this.MakePrimaryImage() ){
	    return this;
	}
    }
    // if we have an RGB file or image overlay, use offsreen RGB colors
    if( this.useOffScreenCanvas() ){
	wrgb = sect.width / sect.zoom;
	hrgb = sect.height / sect.zoom;
	xrgb = sect.x0;
	yrgb = (this.offscreen.canvas.height - 1) - (sect.y0 + hrgb);
	rgbimg = this.offscreen.context.getImageData(xrgb, yrgb, wrgb, hrgb);
	if( sect.zoom === 1 ){
	    // for unzoomed data, we can grab the RGB pixels directly
	    rgb.img = rgbimg;
	} else {
	    // for zoomed data, we have to replicate each RGB pixel
	    rgb.img = ctx.createImageData(sect.width, sect.height);
	    img = rgb.img;
	    odx = 0;
	    for(yIn=0, yOut=0; yIn<rgbimg.height; yIn++, yOut++){
		yLen = yIn * rgbimg.width;
		yOutIdx = yOut * sect.zoom;
		for(xIn=0, xOut=0; xIn<rgbimg.width; xIn++, xOut++){
		    idx = (yLen + xIn) * 4;
		    xOutIdx = xOut * sect.zoom;
		    for(yZoom=0; yZoom<sect.zoom; yZoom++){
			zy = Math.floor(yOutIdx + yZoom);
			zyLen = zy * sect.width;
			for(xZoom=0; xZoom<sect.zoom; xZoom++){
			    zx = Math.floor(xOutIdx + xZoom);
			    odx = (zyLen + zx) * 4;
			    img.data[odx]   = rgbimg.data[idx];
			    img.data[odx+1] = rgbimg.data[idx+1];
			    img.data[odx+2] = rgbimg.data[idx+2];
			    img.data[odx+3] = rgbimg.data[idx+3];
			}
		    }
		}
	    }
	    rgbimg = null;
	}
	return this;
    }
    // create an RGB image if necessary
    if( !rgb.img                         ||
	(rgb.img.width  !== sect.width)  ||
	(rgb.img.height !== sect.height) ){
	rgb.img = ctx.createImageData(sect.width, sect.height);
    }
    img = rgb.img;
    // max starting index into the data
    odxmax = img.data.length - 4;
    // converting raw data, we need psColors or a static colormap
    if( !this.psColors && !this.staticObj ){
	return this;
    }
    // opacity is preferred, but alpha is acceptable
    if( this.params.opacity !== undefined ){
	// opacity is 0.0 to 1.0
	alpha = Math.floor(this.params.opacity * 255);
    } else if( this.params.alpha !== undefined ){
	// alpha is 0 to 255
	alpha = this.params.alpha;
    } else {
	alpha = 255;
    }
    // mask: a raw array with same dimensions as the raw data array
    // whose values are used to set alpha in the raw image
    if( this.mask.active && this.mask.im ){
	mim = this.mask.im;
	if( this.mask.mode === "mask" ){
	    // mask mode: alpha = mask pixel == 0 ? alpha1 : alpha2
	    mimmask = true;
	    // opacity if image value <= mask value
	    if( JS9.notNull(this.mask.vopacity) ){
		alpha1 = this.mask.vopacity * 255;
	    } else {
		alpha1 = 0;
	    }
	    // opacity if image value > mask value
	    if( JS9.notNull(this.params.opacity) ){
		alpha2 = this.params.opacity * 255;
	    } else {
		alpha2 = 255;
	    }
	    // reverse mask alphas, if necessary
	    if( this.mask.invert ){
		alpha = alpha1;
		alpha1 = alpha2;
		alpha2 = alpha;
	    }
	} else if( this.mask.mode === "opacity" ){
	    // opacity mode: alpha = mask value 0 to 1 * 255
	    mimopacity = true;
	} else if( this.mask.mode === "overlay" ){
	    // overlay mode: non-zero mask value is blended with image value
	    mimoverlay = true;
	    mimg = mim.rgb.img;
	    if( JS9.isNull(this.mask.opacity) ){
		this.mask.opacity = 1;
	    }
	}
    } else if( JS9.notNull(this.params.flooropacity) && !dorgb && !domask ){
	// flooropacity: image pixels <= floor value use floor opacity
	// can't do this with rgb mode because we have 3 different data values
	alphafloor = this.params.flooropacity * 255;
	alphafloorvalue = this.params.floorvalue;
	doalphafloor = true;
    }
    // index into scaled data using previously calc'ed data value to get RGB
    // reverse y lines
    odx = 0;
    inc = Math.max(1, Math.floor(1/sect.zoom));
    zinc = sect.zoom * inc;
    for(yIn=Math.floor(sect.y1-1), yOut=0; yIn>=sect.y0; yIn -= inc, yOut++){
	yLen = yIn * this.raw.width;
	yOutIdx = yOut * zinc;
	for(xIn=Math.floor(sect.x0), xOut=0; xIn<sect.x1; xIn += inc, xOut++){
	    // mask mode: use alpha1 if pixel value is to be masked
	    if( mimmask ){
		if( mim.raw.data[yLen +xIn] > this.mask.value ){
		    alpha = alpha2;
		} else {
		    alpha = alpha1;
		}
	    } else if( mimopacity ){
		// opacity mode: masked value is the opacity
		alpha = mim.raw.data[yLen +xIn] * 255;
	    }
	    if( dorgb ){
		// rgb mode: up to three indexes
		ridx = rthis ? rthis.colorData[yLen + xIn] : 0;
		gidx = gthis ? gthis.colorData[yLen + xIn] : 0;
		bidx = bthis ? bthis.colorData[yLen + xIn] : 0;
		if( JS9.isNull(ridx) || JS9.isNull(gidx) || JS9.isNull(bidx) ){
		    this.display.rgb.active = false;
		    JS9.error("RGB images are incompatible. Turning off RGB mode.", "", false);
		    this.mkRGBImage();
		    return this;
		}
	    } else if( !this.staticObj ){
		// ordinary case: one index
		idx = this.colorData[yLen + xIn];
	    }
	    // current alpha to use in most cases
	    curalpha = alpha;
	    // use alpha min when data val is below threshold?
	    if( doalphafloor && this.raw.data[yLen + xIn] <= alphafloorvalue ){
		curalpha = alphafloor;
	    }
	    xOutIdx = xOut * zinc;
	    for(yZoom=0; yZoom<sect.zoom; yZoom++){
		// ceil avoids non-integer zoom cross-hair artifacts ...
		zy = Math.ceil(yOutIdx + yZoom);
		zyLen = zy * sect.width;
		for(xZoom=0; xZoom<sect.zoom; xZoom++){
		    // ceil avoids non-integer zoom cross-hair artifacts ...
		    zx = Math.ceil(xOutIdx + xZoom);
		    // final index into output buffer
		    odx = (zyLen + zx) * 4;
		    // check for odx out-of-bounds
		    if( odx <= odxmax ){
			// special case: rgb mode
			if( dorgb ){
			    if( rthis ){
				img.data[odx]   = rthis.psColors[ridx][0];
			    } else {
				img.data[odx] = 0;
			    }
			    if( gthis ){
				img.data[odx+1] = gthis.psColors[gidx][1];
			    } else {
				img.data[odx+1] = 0;
			    }
			    if( bthis ){
				img.data[odx+2] = bthis.psColors[bidx][2];
			    } else {
				img.data[odx+2] = 0;
			    }
			    img.data[odx+3] = alpha;
			} else {
			    if( this.staticObj ){
				// special case: static colormap
				val = this.raw.data[yLen+xIn];
				cobj = JS9.lookupStaticColor(this, val, cached);
				img.data[odx]   = cobj.red;
				img.data[odx+1] = cobj.green;
				img.data[odx+2] = cobj.blue;
				img.data[odx+3] = cobj.alpha;
			    } else if( this.psColors[idx] !== undefined ){
				// mask overlay: the mask color values
				// using source-atop composition
				if( mimoverlay && mimg.data[odx+3] ){
				    // average the global mask opacity with the
				    // local pixel opacity (is this OK??)
				    mopacity =  this.mask.opacity * (mimg.data[odx+3]/255);
				    cmopacity = 1 - mopacity;
				    img.data[odx]   = mimg.data[odx] * mopacity + this.psColors[idx][0] * cmopacity;
				    img.data[odx+1] = mimg.data[odx+1] * mopacity + this.psColors[idx][1] * cmopacity;
				    img.data[odx+2] = mimg.data[odx+2] * mopacity + this.psColors[idx][2] * cmopacity;
				    img.data[odx+3] = 255;
				} else {
				    // ordinary case
				    img.data[odx]   = this.psColors[idx][0];
				    img.data[odx+1] = this.psColors[idx][1];
				    img.data[odx+2] = this.psColors[idx][2];
				    img.data[odx+3] = curalpha;
				}
			    }
			}
		    }
		}
	    }
	}
    }
    // allow chaining
    return this;
};

// calling sequences:
//  blendImage()                   # return current blend params
//  blendImage(true||false)        # turn on/off blending
//  blendImage(mode, opacity)      # set blend mode and opacity
JS9.Image.prototype.blendImage = function(...args){
    let [mode, opacity, active] = args;
    // see composite and blend operations: https://www.w3.org/TR/compositing-1/
    const blendexp = /normal|multiply|screen|overlay|darken|lighten|color-dodge|color-burn|hard-light|soft-light|difference|exclusion|hue|saturation|color|luminosity|clear|copy|source-over|destination-over|source-in|destination-in|source-out|destination-out|source-atop|destination-atop|xor|lighter/i;
    if( args.length === 0 ){
	return this.blend;
    }
    // if first arg is true or false, this turns on/off blending
    if( (mode === true)   || (mode === false)   ||
	(mode === "true") || (mode === "false") ){
	if( mode === "true" ){
	    mode = true;
	} else if( mode === "false" ){
	    mode = false;
	}
	this.blend.active = mode;
	// trigger option redisplay
	this.xeqPlugins("image", "onimageblend");
	if( this.display.blendMode ){
	    this.displayImage();
	}
	return this;
    }
    if( JS9.notNull(mode) || JS9.notNull(opacity) ){
	// set blend mode, if necessary
	if( JS9.notNull(mode) ){
	    if( !blendexp.test(mode) ){
		JS9.error(`invalid composite/blend operation: ${mode}`);
	    }
	    this.blend.mode = mode;
	}
	// set opacity, if necessary
	if( JS9.notNull(opacity) ){
	    if( typeof opacity === "string" ){
		opacity = parseFloat(opacity);
	    } else if( typeof opacity !== "number" ){
		JS9.error(`invalid opacity: ${opacity}`);
	    }
	    this.blend.opacity = Math.min(Math.max(opacity, 0), 1);
	}
	// set active state, if necessary
	if( JS9.notNull(active) ){
	    if( active === "true" ){
		active = true;
	    } else if( active === "false" ){
		active = false;
	    }
	    this.blend.active = active;
	}
	// trigger option redisplay
	this.xeqPlugins("image", "onimageblend");
	// display blended result, if necessary
	if( this.display.blendMode && this.blend.active ){
	    this.displayImage();
	}
    }
    // allow chaining
    return this;
};

// apply an image mask to an image
JS9.Image.prototype.maskImage = function(...args){
    let [s, opts] = args;
    let im, key;
    // return mask info
    if( !args.length ){
	return this.mask;
    }
    // if first arg is true or false, this turns on/off masking
    if( (s === true)   || (s === false) || (s === "true") || (s === "false") ){
	if( s === "true" ){
	    s = true;
	} else if( s === "false" ){
	    s = false;
	}
	this.mask.active = s;
	// trigger option redisplay
	this.xeqPlugins("image", "onimagemask");
	this.displayImage();
	return this;
    }
    // json string
    if( typeof s === "string" && s.charAt(0) === '{' ){
	try{ s = JSON.parse(s); }
	catch(e){ JS9.error(`can't parse JSON in maskImage: ${s}`, e); }
    }
    // is this the image object or the opts object?
    if( !JS9.isImage(s) && !opts ){
	opts = s;
	s = null;
    }
    // ok, we think we have an image
    if( s ){
	// get image handle
	im = JS9.lookupImage(s);
	// sanity check
	if( !im ){
	    JS9.error(`unknown image for maskImage: ${s}`);
	}
	if( this.raw.width  !== im.raw.width  ||
	    this.raw.height !== im.raw.height ){
	    JS9.error(`maskImage: mask dims (${im.raw.width},${im.raw.height}) don't match image dims (${this.raw.width},${this.raw.height})`);
	}
	// set up the image mask and turn on masking
	this.mask.im = im;
	this.mask.active = true;
    }
    // handle opts
    if( opts ){
	if( typeof opts === "string" ){
	    try{ opts = JSON.parse(opts); }
	    catch(e){ JS9.error(`can't parse JSON in maskImage: ${opts}`, e); }
	}
	// add opts to mask object
	for( key of Object.keys(opts) ){
	    switch(key){
	    case "opacity":
		// handle opacity specially to avoid name collision
		this.mask.vopacity = opts[key];
		break;
	    default:
		this.mask[key] = opts[key];
		break;
	    }
	}
    }
    // keep images in sync, if necessary
    if( im && (!opts || opts.sync !== false)  &&
	typeof this.syncImages === "function" ){
	this.syncImages(this.mask.syncops, [im]);
    }
    // redisplay with the new mask
    if( im || opts ){
	this.displayImage();
    }
};

// calculate and set offsets into display where image is to be written
JS9.Image.prototype.calcDisplayOffsets = function(dowcs){
    let wcsim, wcssect, npos, oval;
    const sect = this.rgb.sect;
    // calculate offsets
    this.ix = (this.display.canvas.width - this.rgb.img.width) / 2;
    this.iy = (this.display.canvas.height - this.rgb.img.height) / 2;
    // adjust when section is not centered on display
    if( JS9.notNull(sect.ix) ){
	this.ix -= sect.ix / 2;
    }
    if( JS9.notNull(sect.iy) ){
	this.iy += sect.iy / 2;
    }
    // ensure integer offsets
    this.ix = Math.floor(this.ix);
    this.iy = Math.floor(this.iy);
    // do wcs alignment, if necessary
    if( dowcs && this.wcsAlign() ){
	// calc offsets so as to align with the wcs image
	wcsim = this.wcsim;
	wcssect = wcsim.rgb.sect;
	// we will pan this image to the wcsim's display section
	npos = JS9.pix2pix(wcsim, this, wcsim.getPan());
	// and use those image coords for the center of the section
	oval = JS9.globalOpts.panWithinDisplay;
	JS9.globalOpts.panWithinDisplay = true;
	this.tmp.ozoom = this.rgb.sect.ozoom;
	this.mkSection(npos.x, npos.y, wcssect.zoom);
	this.rgb.sect.ozoom = this.tmp.ozoom; delete this.tmp.ozoom;
	JS9.globalOpts.panWithinDisplay = oval;
	// offsets of these images
	this.ix -= (sect.xcen - ((sect.x0 + sect.x1)/2)) * wcssect.zoom;
	this.iy += (sect.ycen - ((sect.y0 + sect.y1)/2)) * wcssect.zoom;
    }
    // allow chaining
    return this;
};

// primitive to put image data on screen
JS9.Image.prototype.putImage = function(opts){
    let m, w2, h2;
    const rgb = this.rgb;
    const display = this.display;
    const ctx = display.context;
    // called in image context
    const img2canvas = (img) => {
	let context, canvas;
	if( !this.offscreenRGB ){
	    canvas = document.createElement("canvas");
	    context = canvas.getContext("2d");
	    // turn off anti-aliasing
	    if( !JS9.ANTIALIAS ){
		context.imageSmoothingEnabled = false;
	    }
	    this.offscreenRGB = {canvas, context};
	}
	this.offscreenRGB.canvas.width= img.width;
	this.offscreenRGB.canvas.height = img.height;
	this.offscreenRGB.context.putImageData(img, 0, 0);
	return this.offscreenRGB.canvas;
    };
    // opts is optional
    opts = opts || {};
    // reproject: if reproj wcs header exists, save it for alignment
    if( this.rawDataLayer() === "reproject" && opts.wcsim ){
	this.wcsim = opts.wcsim;
	this.wcsim.isawcsim = true;
    }
    // get display offsets
    this.calcDisplayOffsets(true);
    // save context
    ctx.save();
    // do we need to apply blend mode parameters
    if( opts.opacity !== undefined ){ ctx.globalAlpha = opts.opacity; }
    if( opts.blend !== undefined ){ ctx.globalCompositeOperation = opts.blend; }
    // do we need to apply the canvas transform?
    if( this.params.transform ){
	// this is the transform matrix
	m = this.params.transform;
	// translate origin to center of display
	w2 = this.display.width / 2;
	h2 = this.display.height / 2;
	ctx.translate(w2, h2);
	// set new transform
	ctx.transform(m[0][0], m[0][1], m[1][0], m[1][1], m[2][0], m[2][1]);
	// translate back to 0, 0
	ctx.translate(-w2, -h2);
    }
    // display image
    ctx.drawImage(img2canvas(rgb.img), this.ix, this.iy);
    // restore original context
    ctx.restore();
    // allow chaining
    return this;
};

// display image, with pre and post processing based on comma-separated string
// of options:
// colors: generate colorData
// scaled: generate colorCells and scaledCells
// rgb: generate RGB image (happens automatically for any of the above)
// display: displlay image (always done)
// plugins: execute plugin callbacks
// all: colors,scaled,rgb,display,plugins
JS9.Image.prototype.displayImage = function(imode, opts){
    let i, im, bopts, obj;
    let nblend = 0;
    const allmode = "colors,scaled,rgb,display,plugins";
    const blends = [];
    const mode = {};
    // eslint-disable-next-line no-unused-vars
    const modeFunc = (element, index, array) => {
	const el = element.trim();
	mode[el] = true;
	// each step implies the next ones
	switch(el){
	case "colors":
	    mode.scaled = true;
	    mode.rgb = true;
	    break;
	case "scaled":
	    mode.rgb = true;
	    break;
	}
    };
    // special checks for displayMode setting
    if( imode === false ){
	this.displayMode = false;
	return this;
    }
    if( imode === true ){
	this.displayMode = true;
	imode = "all";
    }
    // if displayMode is false, just return
    if( !this.displayMode ){
	return this;
    }
    // did we just pass the opts params?
    if( typeof imode === "object" ){
	opts = imode;
	imode = null;
    }
    if( !imode ){
	imode = "rgb";
    } else if( imode === "all" ){
	imode = allmode;
	mode.notify = true;
    } else if( imode === "rgbonly" ){
	imode = "rgb,nodisplay";
	mode.notify = true;
    } else if( imode === "display" ){
	mode.notify = true;
    }
    // get mode as elements in an object
    imode.split(",").forEach(modeFunc);
    // by default display the image again (unless nodisplay is set)
    mode.display = true;
    // and always call plugins
    mode.plugins = true;
    // if we have an RGB file or image overlay, skip some steps
    if( this.useOffScreenCanvas() ){
	mode.colors = false;
	mode.scaled = false;
    }
    // opts are optional
    opts = opts || {};
    // opts can be an object or json
    if( typeof opts === "string" ){
	try{ opts = JSON.parse(opts); }
	catch(e){ JS9.error(`can't parse displayImage opts: ${opts}`, e); }
    }
    // do we need to blend?
    if( this.display.blendMode && (opts.blendMode !== false) ){
	for(i=0; i<JS9.images.length; i++){
	    im = JS9.images[i];
	    if( (im.display === this.display) && im.blend.active ){
		blends.push(im);
		nblend++;
	    }
	}
    }
    // generate colordata
    if( mode.colors ){
	// populate the colorData array (offsets into scaled colorcell data)
	this.mkColorData();
    }
    // generated scaled cells
    if( mode.scaled ){
	// generate color cells from colormap
	this.mkColorCells();
	// generated scaled cells from color cells
	this.mkScaledCells();
    }
    // generate RGB image from scaled cells
    if( mode.rgb ){
	// make the RGB image
	this.mkRGBImage();
	if( nblend ){
	    for(i=blends.length-1; i>=0; i--){
		im = blends[i];
		im.mkRGBImage();
	    }
	}
    }
    // if we explicitly don't display, return here;
    if( mode.nodisplay ){
	return this;
    }
    // display image on screen
    if( mode.display ){
	// clear image
	this.display.context.clear();
	if( nblend ){
	    // pre-calculate image offsets in case of zoom changed for an image
	    // which acts as wcsim for another blended image ... in case the
	    // blended image gets loaded before the wcs image ... messy!
	    for(i=blends.length-1; i>=0; i--){
		blends[i].calcDisplayOffsets(false);
	    }
	    for(i=blends.length-1; i>=0; i--){
		im = blends[i];
		// display the image using blend characteristics
		bopts = {wcsim: opts.wcsim,
			 blend: im.blend.mode, opacity: im.blend.opacity};
		im.putImage(bopts);
		if( im === this ){
		    // display layers for this image
		    im.displayShapeLayers();
		}
	    }
	} else {
	    // display the image
	    this.putImage(opts);
	    // display layers for this image
	    this.displayShapeLayers();
	}
	// mark this image as being in this display
	this.display.image = this;
	// now this is the displayed image, we can add delayed shapes
	while( this.delayedShapes && this.delayedShapes.length ){
	    this.tmp.syncRunning = true;
	    obj = this.delayedShapes.shift();
	    switch(obj.mode){
	    case "add":
		this.addShapes(obj.layer, obj.shape, obj.opts);
		break;
	    case "change":
		this.changeShapes(obj.layer, obj.shape, obj.opts);
		break;
	    }
	    delete this.tmp.syncRunning;
	}
	delete this.delayedShapes;
    }
    // post-processing
    // plugin callbacks
    this.xeqPlugins("image", "onimagedisplay");
    // allow chaining
    return this;
};

// refresh data for an existing image
// input obj is a fits object, array, typed array, etc.
JS9.Image.prototype.refreshImage = function(obj, opts){
    let s, arr, ozoom, ora, odec, olpos, ipos, func;
    // opts is optional
    opts = opts || {};
    // opts can be an object or json
    if( typeof opts === "string" ){
	try{ opts = JSON.parse(opts); }
	catch(e){ JS9.error(`can't parse refreshImage opts: ${opts}`, e); }
    }
    // no obj or obj is a string, this is a load with refresh turned on
    if( !obj || typeof obj === "string" ){
	if( opts.onrefresh ){
	    opts.onload = opts.onrefresh;
	    delete opts.onrefresh;
	}
	opts.refresh = this;
	// for file:// uri, we can use the FITS pathname, where possible
	if( !document.domain ){
	    s = obj || this.fitsFile || this.file;
	} else {
	    // else use the url path relative to the web page
	    s = obj || this.file;
	}
	JS9.Load(s, opts, {display: this.display});
	return;
    }
    // check for refresh func
    opts.rawid = opts.rawid || JS9.RAWID0;
    // allow explicit specification of a func, for backward-compatibility
    if( typeof opts === "function" ){
	func = opts;
	opts = {onrefresh: func};
    }
    if( !opts.onrefresh && JS9.imageOpts.onrefresh ){
	// use global onrefresh, if possible
	opts.onrefresh = JS9.imageOpts.onrefresh;
    }
    // save section center if it's not to be reset
    if( !opts.resetSection ){
	// always save logical coords
	olpos = this.imageToLogicalPos({x: this.rgb.sect.xcen,
					y: this.rgb.sect.ycen});
	// save wcs pos, if available
	if( this.validWCS() ){
	    s = JS9.pix2wcs(this.raw.wcs,
			    this.rgb.sect.xcen, this.rgb.sect.ycen);
	    arr = s.trim().split(/\s+/);
	    ora = JS9.saostrtod(arr[0]);
	    if( JS9.isHMS(this.params.wcssys) ){
		ora *= 15.0;
	    }
	    odec = JS9.saostrtod(arr[1]);
	}
    }
    ozoom = this.rgb.sect.zoom;
    // save old binning
    this.binning.obin = this.binning.bin;
    // generate new data
    this.mkRawDataFromHDU(obj, opts);
    // reset or restore section?
    if( opts.resetSection ){
	// reset section
	this.mkSection();
	this.mkSection(ozoom);
    } else {
	// try to restore section using saved coords
	if( this.validWCS() && JS9.notNull(ora) && JS9.notNull(odec) ){
	    arr = JS9.wcs2pix(this.raw.wcs, ora, odec).trim().split(/ +/);
	    ipos = {x: parseFloat(arr[0]), y: parseFloat(arr[1])};
	} else {
	    ipos = this.logicalToImagePos({x: olpos.x, y: olpos.y});
	}
	// but if the image position off the new image ...
	if( ipos.x > 0 && ipos.x < this.raw.width  &&
	    ipos.y > 0 && ipos.y < this.raw.height ){
	    this.mkSection(ipos.x, ipos.y, ozoom);
	} else {
	    // ... just reset the section
	    this.mkSection();
	    this.mkSection(ozoom);
	}
    }
    // display new image data with old section
    this.displayImage("colors", opts);
    // redo flip and rot
    this.reFlipRot();
    // notify the helper
    this.notifyHelper();
    // update shape layers if necessary
    if( opts.refreshRegions                      ||
	opts.resetSection                        ||
	(this.binning.obin !== this.binning.bin) ){
	this.refreshLayers();
	// update region values
	this.updateShapes("regions", "all", "binning");
    }
    // plugin callbacks
    this.xeqPlugins("image", "onimagerefresh");
    // all done
    JS9.waiting(false);
    // everything else is done so call refresh func, if necessary
    if( opts.onrefresh ){
	try{ JS9.xeqByName(opts.onrefresh, window, this); }
	catch(e){ JS9.error("in image refresh callback", e); }
    }
    // allow chaining
    return this;
};

// fileDimensions: get dimensions of "original" file
// this is the hackiest routine in the JS9 module
// why is it so hard???
JS9.Image.prototype.fileDimensions = function(){
    let xdim, ydim;
    if( this.parent && this.parent.raw.header.XTENSION !== "BINTABLE" ){
	if( this.parent.raw.header.TABDIM1 ){
	    xdim = this.parent.raw.header.TABDIM1;
	} else {
	    xdim = this.parent.raw.header.NAXIS1;
	}
	if( this.parent.raw.header.TABDIM2 ){
	    ydim = this.parent.raw.header.TABDIM2;
	} else {
	    ydim = this.parent.raw.header.NAXIS2;
	}
    } else {
	if( this.raw.header.TABDIM1 ){
	    xdim = this.raw.header.TABDIM1;
	} else {
	    xdim = this.raw.header.NAXIS1;
	}
	if( this.raw.header.TABDIM2 ){
	    ydim = this.raw.header.TABDIM2;
	} else {
	    ydim = this.raw.header.NAXIS2;
	}
    }
    return {xdim, ydim};
};

/*
   maybePhysicalToImage: the second hackiest routine in the JS9 module!
   The physical position defined by LTM/LTV is not always the file position,
   For example, if the file foo.fits was created from another file:
       funimage somefile.fits'[*,*,2]' foo.fits
   its LTM/LTV keywords will referring to the parent, instead of itself.
   In such a case, we want to convert physical position to the image position
   of the physical file.
   This situation is signalled by the presence of a parent lcs object.
   This routine is used to display sections and the binning.js plugin.
*/
JS9.Image.prototype.maybePhysicalToImage = function(pos){
    let lpos, ipos, npos;
    if( this.imtab === "image" &&
	this.parent && this.parent.lcs && pos.x && pos.y ){
	lpos = {x: pos.x, y: pos.y};
	// call is used because this.parent is not an image object
	ipos = JS9.Image.prototype.logicalToImagePos.call(this.parent, lpos,
                                                          "ophysical");
	npos = {x: Math.floor(ipos.x+0.5), y: Math.floor(ipos.y+0.5)};
    }
    return npos;
};

// extract and display a section of an image, with table filtering
JS9.Image.prototype.displaySection = function(opts, func){
    let s, oproxy, hdu, from, obj, oreg, nim, topts;
    let ipos, lpos, npos, tbin, arr, sect;
    const getval3 = (val1, val2, val3) => {
	let res;
	if( !JS9.isNull(val1) ){
	    res = val1;
	} else if( !JS9.isNull(val2) ){
	    res = val2;
	}
	return res || val3;
    };
    // convert region to section (cen and dim)
    const reg2sect = (xreg) => {
	let i, xdim, ydim, xcen, ycen, npos;
	let xx = 0;
	let yy = 0;
	let minx = 1000000;
	let maxx = 0;
	let miny = 1000000;
	let maxy = 0;
	const shape = xreg.shape;
	// use physical coords object, if possible
	if( !this.parentFile && xreg.lcs ){
	    xreg = xreg.lcs
	    xcen = xreg.x;
	    ycen = xreg.y;
	    // beware of problems with physical coords not tied to the file
	    npos = this.maybePhysicalToImage({x: xcen, y: ycen});
	    if( npos ){
		xcen = npos.x;
		ycen = npos.y;
	    }
	} else {
	    xcen = xreg.x;
	    ycen = xreg.y;
	}
	switch( shape ){
	case "annulus":
            xdim  = xreg.radii[xreg.radii.length-1]*2;
            ydim = xreg.radii[xreg.radii.length-1]*2;
	    break;
	case "box":
            xdim  = xreg.width;
            ydim = xreg.height;
	    break;
	case "circle":
            xdim  = xreg.radius*2;
            ydim = xreg.radius*2;
            break;
	case "cross":
            xdim  = xreg.width;
            ydim = xreg.height;
	    break;
	case "ellipse":
            xdim  = xreg.r1*2;
            ydim = xreg.r2*2;
            break;
	case "polygon":
        case "line":
	    for ( i=0; i < xreg.pts.length; i++ ) {
		xx += xreg.pts[i].x;
		yy += xreg.pts[i].y;
		if ( xreg.pts[i].x > maxx ) { maxx = xreg.pts[i].x; }
		if ( xreg.pts[i].x < minx ) { minx = xreg.pts[i].x; }
		if ( xreg.pts[i].y > maxy ) { maxy = xreg.pts[i].y; }
		if ( xreg.pts[i].y < miny ) { miny = xreg.pts[i].y; }
	    }
	    xreg.x = xx/xreg.pts.length;
	    xreg.y = yy/xreg.pts.length;
	    if( xreg.shape === "line" && xreg.pts.length === 2 ){
                xdim = Math.sqrt(((xreg.pts[0].x - xreg.pts[1].x)  *
                                  (xreg.pts[0].x - xreg.pts[1].x)) +
                                 ((xreg.pts[0].y - xreg.pts[1].y)  *
                                  (xreg.pts[0].y - xreg.pts[1].y)));
                ydim = 1;
	    } else {
	        xdim  = maxx - minx;
		ydim = maxy - miny;
	    }
	    break;
	case "text":
	    xdim = 10;
	    ydim = 10;
	    break;
	default:
	    break;
	}
	return({xcen: xcen, ycen: ycen, xdim: xdim, ydim: ydim});
    };
    // main display routine
    const disp = (hdu, opts) => {
	let tim, did, arr;
	let ss = "";
	// make a copy of opts so we can change it
	topts = JS9.extend(true, {}, opts || {});
	if( JS9.isNull(topts.refreshRegions) ){
	    topts.refreshRegions = true;
	}
	if( JS9.isNull(topts.resetSection) ){
	    topts.resetSection = true;
	}
	// start the waiting!
	if( topts.waiting !== false ){
	    JS9.waiting(true, this.display);
	}
	// the id might have changed if we changed extensions
	if( hdu.fits.extname ){
	    ss = `[${hdu.fits.extname}]`;
	} else if( hdu.fits.extnum && hdu.fits.extnum > 0 ){
	    ss = `[${hdu.fits.extnum}]`;
	} else if( this.parent ){
	    if( this.parent.extname ){
		ss = `[${this.parent.extname}]`;
	    } else if( this.parent.extnum && this.parent.extnum > 0 ){
		ss = `[${this.parent.extnum}]`;
	    }
	}
	// change id and file if extension changed
	if( ss ){
	    if( !topts.id ){
		topts.id = this.id.replace(/\[.*\]/,"") + ss;
	    }
	    // NB: this was removed in v2.3 ... why? ... added back in v2.5
	    if( !topts.file ){
		topts.file = this.file.replace(/\[.*\]/,"") + ss;
	    }
	}
	if( topts.separate ){
	    // display section as a separate image in the specified display
	    delete topts.xcen;
	    delete topts.ycen;
	    if( typeof topts.separate === "string" ){
		arr = topts.separate.split(":");
		switch(arr.length){
		case 1:
		    did = arr[0];
		    break;
		default:
		    did = arr[0];
		    topts.id = arr[1];
		    break;
		}
		// make sure we can find the display
		topts.display = JS9.lookupDisplay(did);
	    } else {
		topts.display = this.display;
	    }
	    // lame attempt to get to original parentFile
	    if( from === "parentFile" && this.fitsFile ){
		tim = JS9.lookupImage(this.fitsFile);
		if( tim && tim.parentFile ){
		    topts.parentFile = tim.parentFile;
		} else {
		    topts.parentFile = this.fitsFile;
		}
	    }
	    // save current regions (before displaying new image)
	    oreg = this.listRegions("all", {mode: 1,
					    includedcoords: true,
					    ignoreignore: true,
					    saveediting: true,
					    savewcsconfig: true,
					    sortids: false,
					    saveid: true});
	    // func to perform when image is loaded
	    func = topts.ondisplaysection || topts.onrefresh || func;
	    // set up new and display new image
	    nim = new JS9.Image(hdu, topts, func);
	    // reset obin to be bin, since new images have no previous bin
	    nim.binning.obin = nim.binning.bin;
	    // add regions to new image
	    if( oreg && topts.refreshRegions !== false ){
		nim.addShapes("regions", oreg, {restoreid: true});
	    }
	    // redo flip and rot
	    this.reFlipRot();
	    // set status of new image
	    nim.setStatus("displaySection", "complete");
	} else if( typeof topts.refresh === "string" ){
	    // refresh the image in the specified display
	    delete topts.xcen;
	    delete topts.ycen;
	    arr = topts.refresh.split(":");
	    switch(arr.length){
	    case 1:
		did = arr[0];
		break;
	    default:
		did = arr[0];
		topts.id = arr[1];
		break;
	    }
	    // make sure we can find the display
	    topts.display = JS9.lookupDisplay(did);
	    if( topts.display.image ){
		topts.rawid = this.raw.id;
		// func to perform when image is refreshed
		topts.onrefresh = topts.ondisplaysection ||
		                  topts.onrefresh || func;
		// refresh the image with the new hdu
		topts.display.image.refreshImage(hdu, topts);
	    } else {
		// no image in the specified display, so make a new one
		// lame attempt to get to original parentFile
		if( from === "parentFile" && this.fitsFile ){
		    tim = JS9.lookupImage(this.fitsFile);
		    if( tim && tim.parentFile ){
			topts.parentFile = tim.parentFile;
		    } else {
			topts.parentFile = this.fitsFile;
		    }
		}
		// save current regions (before displaying new image)
		oreg = this.listRegions("all", {mode: 1,
						includedcoords: true,
						ignoreignore: true,
						saveediting: true,
						savewcsconfig: true,
						sortids: false,
						saveid: true});
		// func to perform when image is loaded
		func = topts.ondisplaysection || topts.onrefresh || func;
		// set up new and display new image
		nim = new JS9.Image(hdu, topts, func);
		// reset obin to be bin, since new images have no previous bin
		nim.binning.obin = nim.binning.bin;
		// add regions to new image
		if( oreg ){
		    nim.addShapes("regions", oreg, {restoreid: true});
		}
		// redo flip and rot
		this.reFlipRot();
	    }
	} else {
	    // this is the default behavior for displaySection:
	    // refresh the image in the current display
	    topts.rawid = this.raw.id;
	    // func to perform when image is refreshed
	    topts.onrefresh = topts.ondisplaysection || topts.onrefresh || func;
	    // refresh the current image with the new hdu
	    this.refreshImage(hdu, topts);
	}
	// set status of old image
	this.setStatus("displaySection", "complete");
	// done waiting
	JS9.waiting(false);
    };
    // sanity check
    if( !this.raw || !this.raw.hdu || !this.raw.hdu.fits ){
	JS9.error("invalid image for displaySection");
    }
    // opts is optional
    opts = opts || {};
    // special case: if opts is "full", display full image
    if( opts === "full" ){
	const {xdim, ydim} = this.fileDimensions();
	opts = {xdim: xdim, ydim: ydim, xcen: 0, ycen: 0};
    } else if( opts === "selected" ){
	this._selectShapes("regions", "selected", null, (obj) => {
	    topts = reg2sect(obj.pub);
	    topts.from = "virtualFile";
	    topts.separate = true;
	    topts.refreshRegions = false;
	    topts.resetSection = true;
	    this.displaySection(topts, func);
	});
	return;
    } else if( typeof opts === "string" ){
	try{ opts = JSON.parse(opts); }
	catch(e){ JS9.error(`can't parse displaySection opts: ${opts}`, e); }
    }
    // cube column
    opts.cubecol = opts.cubecol || "";
    if( opts.cubecol ){
	// string containing filename and indication that this is a cube
	s = this.file
	    .split("/")
	    .reverse()[0]
	    .replace(/\[.*\]/,"")
	    .replace(".fits", `_cube_${opts.cubecol}.fits`)
	    .replace(/\.ftz$/, `_cube_${opts.cubecol}.fits`)
	    .replace(/\.gz$/, "")
	    .replace(/\.bz2$/, "")
	    .replace(/:/g, "_");
	// name of virtual file we will create
	if( !opts.file ){
	    opts.file = s;
	}
	// and its id
	if( !opts.id ){
	    opts.id = s;
	}
	// unless explicitly set to false, separate is set to true
	if( opts.separate !== false ){
	    opts.separate = true;
	}
    }
    if( opts.separate ){
	// if we are generating a separate image, copy the hdu
	hdu = JS9.extend(true, {}, this.raw.hdu);
    } else {
	// if we are replacing the current image, use the hdu directly
	hdu = this.raw.hdu;
    }
    // from where do we extract the section?
    from = opts.from;
    if( !from ){
	if( this.parentFile && JS9.helper.connected && JS9.helper.js9helper ){
	    // we will be processing a parent file to get the section
	    from = "parentFile";
	} else {
	    // we will be processing a virtual file to get the section
	    from = "virtualFile";
	}
    }
    // get previous values to use as defaults
    if( this.imtab === "table" && hdu.table ){
	// tables are easy: all the previous values should be present
	sect = hdu.table;
    } else {
	sect = {};
	// start with bin from hdu
	sect.bin = hdu.bin || 1;
	// images are a bit more difficult
	// hack: if a parent file was used to make this image,
	// calculate binning from its LTM/TLV parameters
	if( from === "parentFile" &&
	    this.raw.header && JS9.notNull(this.raw.header.LTM1_1) ){
	    sect.bin  = 1 / Math.abs(this.raw.header.LTM1_1);
	}
	// get image center from raw data
	ipos = {x: this.raw.width / 2, y: this.raw.height / 2};
	// convert to physical (file) coords
	lpos = this.imageToLogicalPos(ipos);
	// sect.xcen = Math.floor(lpos.x + 0.5);
	// sect.ycen = Math.floor(lpos.y + 0.5);
	sect.xcen = Math.floor(lpos.x + 0.5*(sect.bin-1));
	sect.ycen = Math.floor(lpos.y + 0.5*(sect.bin-1));
	npos = this.maybePhysicalToImage({x: sect.xcen, y: sect.ycen});
	if( npos ){
	    sect.xcen = npos.x;
	    sect.ycen = npos.y;
	}
	sect.xdim = Math.floor(hdu.naxis1 * sect.bin);
	sect.ydim = Math.floor(hdu.naxis2 * sect.bin);
	sect.filter = this.raw.filter || "";
	sect.columns = this.raw.columns || "";
    }
    // allow binning relative to current, e.g., *2, /4, +1, -3
    if( typeof opts.bin === "string" ){
	// save and remove mode flag
	if( opts.bin.match(/[as]$/) ){
	    opts.binMode = opts.bin.slice(-1);
	    opts.bin = opts.bin.slice(0, -1);
	}
	// temp binning value
	tbin = sect.bin || this.binning.bin;
	switch( opts.bin.charAt(0) ){
	case "*":
	case "x":
	case "X":
	    opts.bin = tbin * parseFloat(opts.bin.slice(1));
	    break;
	case "/":
	    opts.bin = tbin / parseFloat(opts.bin.slice(1));
	    break;
	case "i":
	case "I":
	    opts.bin = tbin * 2;
	    break;
	case "o":
	case "O":
	    opts.bin = tbin / 2;
	    break;
	default:
	    if( JS9.isNumber(opts.bin) ){
		opts.bin = parseFloat(opts.bin);
	    } else {
		JS9.error(`invalid bin for displaySection: ${opts.bin}`);
	    }
	    break;
	}
    }
    // now we can make sure opts has sensible defaults
    opts.xcen = getval3(opts.xcen, sect.xcen, 0);
    opts.ycen = getval3(opts.ycen, sect.ycen, 0);
    switch(this.imtab){
    case "table":
	opts.xdim = getval3(opts.xdim, sect.xdim, JS9.fits.options.table.xdim);
	opts.ydim = getval3(opts.ydim, sect.ydim, JS9.fits.options.table.ydim);
	opts.bin  = getval3(opts.bin,  sect.bin,  JS9.fits.options.table.bin);
	break;
    default:
	opts.xdim = getval3(opts.xdim, sect.xdim, JS9.fits.options.image.xdim);
	opts.ydim = getval3(opts.ydim, sect.ydim, JS9.fits.options.image.ydim);
	opts.bin  = getval3(opts.bin,  sect.bin,  JS9.fits.options.image.bin);
	break;
    }
    opts.binMode  = getval3(opts.binMode, sect.binMode, JS9.globalOpts.binMode);
    // final checks on binning
    // handle string bin, possibly containing explicit binMode
    if( typeof opts.bin === "string" ){
	if( opts.bin.match(/[as]$/) ){
	    opts.binMode = opts.bin.slice(-1);
	}
	opts.bin = parseFloat(opts.bin);
    }
    // sanity check: we need a bin
    if( !opts.bin ){
	opts.bin = 1;
    }
    // sanity check: fractional bin must be 1/n for images
    if( this.imtab === "image" && opts.bin > 0 && opts.bin < 1 ){
	opts.bin = 1.0 / Math.floor((1.0 / opts.bin) + 0.5);
    }
    // filter
    opts.filter = getval3(opts.filter, sect.filter, "");
    // save the filter, if necessary
    this.raw.filter = opts.filter || "";
    // columns
    opts.columns = getval3(opts.columns, sect.columns, "");
    // save the columns, if necessary
    this.raw.columns = opts.columns || "";
    // start the waiting!
    if( opts.waiting !== false ){
	JS9.waiting(true, this.display);
    }
    // set status
    this.setStatus("displaySection", "processing");
    // ... start a timeout to allow the wait spinner to get started
    window.setTimeout(() => {
	// get image section
	switch(from){
	case "parentFile":
	    oproxy = this.proxyFile;
	    // parentFile: image sect. from external parent file of cur file
	    // arr is for runAnalysis, remove opts for later processing
	    arr = [];
	    arr.push({name: "xcen", value: opts.xcen});
	    delete opts.xcen;
	    arr.push({name: "ycen", value: opts.ycen});
	    delete opts.ycen;
	    arr.push({name: "xdim", value: opts.xdim});
	    arr.push({name: "ydim", value: opts.ydim});
	    // load entire image section
	    if( opts.xdim !== undefined ){ opts.xdim = 0; }
	    if( opts.ydim !== undefined ){ opts.ydim = 0; }
	    // recombine bin and binMode, if necessary
	    if( opts.binMode ){
		opts.bin = `${opts.bin}${opts.binMode}`;
		delete opts.binMode;
	    }
	    arr.push({name: "bin", value: opts.bin});
	    delete opts.bin;
	    s = `${opts.filter||""}@@${opts.cols||""}`;
	    arr.push({name: "filter", value: s});
	    // hack: pass filter and columns along to reach binning plugin
	    // delete opts.filter;
	    // get image section from external file
	    arr.push({name: "slice", value: opts.slice||""});
	    delete opts.slice;
	    obj = {id: this.expandMacro("$id"),
		   image: this.file,
		   fits: this.parentFile,
		   rtype: "text"};
	    obj.cmd = `js9Xeq imsection ${this.parentFile}`;
	    // if we are changing the extension, replace the old extension
	    // with the new one
	    if( opts.extension ){
		obj.cmd = obj.cmd.replace(/\[.*\]/,"");
		obj.cmd += `[${opts.extension}]`;
		delete opts.extension;
	    }
	    obj.cmd += this.expandMacro(" $xdim@$xcen,$ydim@$ycen,$bin $filter $slice", arr);
	    JS9.helper.send("imsection", obj, (r) => {
		let obj, jobj, rarr, f, pf;
		if( typeof r === "object" ){
		    // with socketio, we get an object
		    obj = r;
		} else {
		    // with cgi, we just get a text string
		    if( r.search(JS9.analOpts.epattern) >=0 ){
			obj = {stderr: r};
		    } else {
			obj = {stdout: r};
		    }
		}
		if( obj.stderr ){
		    JS9.error(obj.stderr);
		    return;
		}
		if( obj.errcode ){
		    JS9.error(`in displaySection: ${obj.errcode}`);
		    return;
		}
		// output is file and possibly parentFile
		rarr = obj.stdout.split(/\n/);
		// file
		f = JS9.cleanPath(rarr[0]);
		// relative path: add install dir prefix
		if( f.charAt(0) !== "/" ){
		    f = JS9.InstallDir(f);
		}
		// this is the proxy file (meaning: delete it on close)
		opts.proxyFile = f;
		// remove oproxy file if not the same as the current file
		if( oproxy && (oproxy !== opts.proxyFile) ){
		    this.removeProxyFile(oproxy);
		}
		// json fits info
		if( rarr[1] ){
		    try{
			jobj = JSON.parse(rarr[1]);
		    }
		    catch(ignore){
			JS9.log("couldn't parse imsection as JSON: %s", f);
			jobj = null;
		    }
		    if( jobj ){
			opts.extname = jobj.extname;
			opts.extnum = jobj.extnum;
			opts.hdus = jobj.hdus;
			opts.binstr = jobj.binstr;
			opts.parent = jobj;
		    }
		}
		// look for parentFile (path relative to helper, not install)
		if( rarr[2] ){
		    pf = JS9.cleanPath(rarr[2]);
		    opts.parentFile = pf;
		}
		// retrieve and display newly created image section file
		JS9.fetchURL(f, f, opts, (result) => {
		    // cleanup previous FITS file support, if necessary
		    // do this before we handle the new FITS file, or else
		    // we end up with a memory leak in the runtime heap!
		    JS9.cleanupFITSFile(this.raw, true);
		    // start the waiting!
		    if( opts.waiting !== false ){
			JS9.waiting(true, this.display);
		    }
		    // process the newly retrieved data as FITS
		    JS9.fits.handleFITSFile(result, opts, disp);
		});
	    });
	    break;
	case "virtualFile":
	    // cleanup previous FITS file support, if necessary
	    // do this before we handle the new FITS file, or else
	    // we end up with a memory leak in the runtime heap!
	    JS9.cleanupFITSFile(this.raw, false);
	    // extract image section from current virtual file
	    JS9.getFITSImage(hdu.fits, hdu, opts, (hdu) => {
		disp(hdu, opts);
	    });
	    break;
	default:
	    JS9.error("image section cannot be extracted from this data file");
	    break;
	}
    }, JS9.SPINOUT);
};

// display the specified extension of a multi-extension FITS file
JS9.Image.prototype.displayExtension = function(extid, opts, func){
    let i, s, got, extname, im, id;
    const dispnext = (i) => {
	let hdu;
	const topts = JS9.extend(true, {}, opts);
	// hdus are loaded as separate images
	topts.separate = true;
	// all done, call the supplied func, if any
	if( i === this.hdus.length ){
	    if( func ){
		try{ JS9.xeqByName(func, window, this); }
		catch(e){ JS9.error("in displayExtension callback", e, false); }
	    }
	    return;
	}
	// next hdu
	hdu = this.hdus[i];
	if( hdu.type === "image" && hdu.naxis >= 2 ){
	    // load next hdu and recurse when done
	    this.displayExtension(hdu.hdu, topts, () => { dispnext(i+1); });
	} else {
	    dispnext(i+1);
	}
    };
    // opts is optional
    opts = opts || {};
    // opts can be an object or json
    if( typeof opts === "string" ){
	try{ opts = JSON.parse(opts); }
	catch(e){ JS9.error(`can't parse displayExtension opts: ${opts}`, e); }
    }
    opts.waiting = false;
    // only makes sense if we have hdus
    if( !this.hdus ){
	JS9.error("no FITS HDUs found for displayExtension()");
    }
    // sanity check
    if( JS9.isNull(extid) ){
	JS9.error("missing extname/extnum for displayExtension()");
    }
    // display all extensions?
    if( extid === "all" ){
	// load all image extensions, in order, as separate images
	// we start with the first and let the call recurse
	dispnext(0);
	return;
    }
    // extname specified?
    if( typeof extid === "string" ){
	opts.extension = extid;
	extname = extid.toLowerCase();
	for(i=0, got=0; i<this.hdus.length; i++){
	    if( this.hdus[i].name &&
		this.hdus[i].name.toLowerCase() === extname ){
		got++;
		break;
	    }
	}
	if( !got ){
	    JS9.error(`no FITS HDU ${extid} for displayExtension()`);
	}
	// extnum specified?
    } else if( typeof extid === "number" ){
	opts.extension = extid;
	if( this.hdus[extid] ){
	    extname = this.hdus[extid].name || extid.toString();
	} else {
	    JS9.error(`no FITS HDU ${extid} for displayExtension()`);
	}
    }
    // if we are creating a separate file, see if we already have it
    if( opts.separate ){
	s = `[${extname}]`;
	id = this.id.replace(/\[.*\]/,"") + s;
	for(i=0, got=0; i<JS9.images.length; i++){
	    im = JS9.images[i];
	    if( id === im.id ){
		if( JS9.resolveNode(im.display.id) ){
		    if( this.display.id === im.display.id ){
			got++;
			break;
		    }
		}
	    }
	}
	if( got ){
	    im.displayImage("display", opts);
	    im.display.clearMessage();
	    if( func ){
		try{ JS9.xeqByName(func, window, this); }
		catch(e){ JS9.error("in displayExtension callback", e, false); }
	    }
	    return;
	}
    }
    // cleanup previous FITS file support, if necessary
    // do this before we handle the new FITS file, or else
    // we end up with a memory leak in the runtime heap!
    if( !opts.separate ){
	JS9.cleanupFITSFile(this.raw, false);
    }
    // process the FITS file by going to the extname/extnum
    this.displaySection(opts, func);
    // allow chaining
    return this;
};

// display the specified slice of a 3D or 4d FITS cube
JS9.Image.prototype.displaySlice = function(slice, opts, func){
    let i, topts, tim;
    // opts is optional
    opts = opts || {};
    // opts can be an object or json
    if( typeof opts === "string" ){
	try{ opts = JSON.parse(opts); }
	catch(e){ JS9.error(`can't parse displaySlice opts: ${opts}`, e); }
    }
    opts.waiting = false;
    // sanity check
    if( JS9.isNull(slice) ){
	JS9.error("missing slice for displaySlice()");
    }
    if( this.raw.header.NAXIS !== 3 ){
	JS9.error("3D image required for displaySlice()");
    }
    if( slice === "all" ){
	// load and display the slices separately
	// ignore the fact that we already are displaying a slice of the image,
	// since we don't actually know which slice is being displayed ...
	for(i=1; i<=this.raw.header.NAXIS3; i++){
	    topts = JS9.extend(true, {}, opts, {separate: true});
	    this.displaySlice(i, topts, func);
	}
    } else {
	// slicename or slicenum specified?
	if( JS9.isNumber(slice) ){
	    opts.slice = `*:*:${slice}`;
	} else {
	    opts.slice = slice;
	}
	// processing for separate images
	if( opts.separate ){
	    // make new id based on slice
	    opts.id = sprintf("%s_%s",
			      this.id
			      .replace(/_?([0-9])+:x:x/, "")
			      .replace(/_?x:([0-9])+:x/, "")
			      .replace(/_?x:x:([0-9])+/, ""),
			      opts.slice.replace(/\*/g, "x"));
	    // look for existing id and just redisplay, if possible
	    for(i=0; i<JS9.images.length; i++){
		tim = JS9.images[i];
		if( opts.id === tim.id ){
		    if( JS9.resolveNode(tim.display.id) ){
			tim.displayImage("display", {display: tim});
			return this;
		    }
		}
	    }
	}
	// cleanup previous FITS file heap before handling the new FITS file,
	// or we end up with a memory leak in the runtime heap
	JS9.cleanupFITSFile(this.raw, false);
	// process the FITS file by going to the slice
	this.displaySection(opts, func);
    }
    // allow chaining
    return this;
};

// convert current image to array
JS9.Image.prototype.toArray = function(opts){
    let i, j, k, bpe, idx, le, header, npad, arr, buf, _dbuf;
    let dbuf, sect, xlen, blen, datalen, darr;
    // opts is optional
    opts = opts || {};
    // always perform the header keyword fix
    opts.simple = true;
    // make a copy of the header, in case we have to change it
    header = JS9.extend(true, {}, this.raw.header);
    // are we processing a section of the image?
    if( JS9.notNull(opts.sect) ){
	// image section
	sect = opts.sect;
	// header parameters that need to change
	header.NAXIS1 = sect.x1 - sect.x0;
	header.NAXIS2 = sect.y1 - sect.y0;
	if( JS9.notNull(header.CRPIX1) ){
	    header.CRPIX1 = header.CRPIX1 - sect.x0;
	}
	if( JS9.notNull(header.CRPIX2) ){
	    header.CRPIX2 = header.CRPIX2 - sect.y0;
	}
	if( JS9.notNull(header.LTV1) ){
	    header.LTV1 = header.LTV1 - sect.x0;
	}
	if( JS9.notNull(header.LTV2) ){
	    header.LTV2 = header.LTV2 - sect.y0;
	}
	// extract image section
	// length of a date element
	blen = Math.abs(this.raw.bitpix/8);
	// length of a row of data
	xlen = (sect.x1 - sect.x0) * blen;
	// total data length of the section
	datalen = xlen * (sect.y1 - sect.y0);
	// make an array of the required length
	darr = new ArrayBuffer(datalen);
	// make a vew that we can work with
	dbuf = new Uint8Array(darr);
	// copy the section into the new array, one row at a time
	for(i=sect.y0, j=0; i<sect.y1; i++, j++){
	    JS9.memcpy(dbuf.buffer, (j * xlen),
		       this.raw.data.buffer, (i*this.raw.width+sect.x0) * blen,
		       xlen);
	}
    } else {
	// save entire data buffer
	dbuf = this.raw.data.buffer;
    }
    // get header as a string
    header = JS9.raw2FITS({header: header}, opts);
    // append padding to header now
    npad = 2880 - (header.length % 2880);
    if( npad === 2880 ){ npad = 0; }
    for(i=0; i<npad; i++){ header += " "; }
    // calculate padding for data for later
    npad = 2880 - (dbuf.byteLength % 2880);
    if( npad === 2880 ){ npad = 0; }
    // make an array buffer to hold the whole FITS file
    arr = new ArrayBuffer(header.length + dbuf.byteLength + npad);
    // and a view of the array to manipulate
    buf = new Uint8Array(arr);
    // copy the header
    for(i=0; i<header.length; i++){ buf[i] = header.charCodeAt(i); }
    // copy data
    // if necessary, swap data bytes to get FITS big-endian
    le = new Int8Array(new Int16Array([1]).buffer)[0] > 0;
    if( le ){
	idx = header.length;
	bpe = Math.abs(this.raw.bitpix)/8;
	_dbuf = new Uint8Array(dbuf);
	// swap bytes to big-endian
	for(i=0; i<_dbuf.byteLength; i+= bpe){
	    for(j=i+bpe-1, k=0; k<bpe; j--, k++){
		buf[idx++] = _dbuf[j];
	    }
	}
    } else {
	// already big-endian, just copy the data
	buf.set(new Uint8Array(dbuf), header.length);
    }
    // now we can add data padding
    idx = header.length + dbuf.byteLength;
    for(i=0; i<npad; i++){ buf[idx++] = 0; }
    return buf;
};

// convenience routine: should we align by WCS?
JS9.Image.prototype.wcsAlign = function(){
    return this.wcsim                          &&
	   this.params.wcsalign                &&
	   (this.display === this.wcsim.display);
};

// get pan location
JS9.Image.prototype.getPan = function(){
    const sect = this.rgb.sect;
    let x = (sect.x0 + sect.x1) / 2;
    let y = (sect.y0 + sect.y1) / 2;
    if( JS9.notNull(sect.ix) ){
	x += sect.ix / (2 * sect.zoom);
    }
    if( JS9.notNull(sect.iy) ){
	y += sect.iy / (2 * sect.zoom);
    }
    return {x: x, y: y, ox: sect.xcen, oy: sect.ycen,
	    x0: sect.x0, y0: sect.y0, x1: sect.x1, y1: sect.y1,
	    ix: sect.ix||0, iy: sect.iy||0};
};

// set pan location of RGB image (using image coordinates)
JS9.Image.prototype.setPan = function(...args){
    let i, obj, im, pos, owcssys, txeq, arr, oval, npan;
    let [panx, pany] = args;
    // is this core service disabled?
    if( JS9.inArray("pan", this.params.disable) >= 0 ){
	return;
    }
    // default is to pan to center
    if( args.length === 0 ){
	panx = this.raw.width / 2;
	pany = this.raw.height / 2;
    }
    // one string arg is a json specification
    // (two string args is panx, pany in string format)
    if( args.length === 1 && typeof panx === "string" ){
	if( panx === "mouse" && this.ipos ){
	    panx = this.ipos.x;
	    pany = this.ipos.y;
	} else {
	    try{ panx = JSON.parse(panx); }
	    catch(e){ JS9.error(`can't parse setPan JSON: ${panx}`, e); }
	}
    }
    if( typeof panx === "object" ){
	obj = panx;
	// passing an object supports image, physical, wcs coordinates
	if( JS9.notNull(obj.x) && JS9.notNull(obj.y) ){
	    // image coords
	    panx = obj.x;
	    pany = obj.y;
	}
	if( JS9.notNull(obj.px) && JS9.notNull(obj.py) ){
	    // physical coords
	    pos = this.logicalToImagePos({x: obj.px, y: obj.py});
	    panx = pos.x;
	    pany = pos.y;
	}
	if( typeof obj.wcs === "string" ){
	    // wcs string: ra dec [wcssys]
            arr = obj.wcs.trim().split(/ +/);
            obj.ra  = arr[0];
            obj.dec = arr[1];
            if( arr.length >= 3 ){
		obj.wcssys = arr[2];
            }
	}
	if( this.validWCS() && JS9.notNull(obj.ra) && JS9.notNull(obj.dec) ){
	    // wcs coords
	    // use supplied wcs, if necessary
	    if( obj.wcssys ){
		owcssys = this.getWCSSys();
		txeq = JS9.globalOpts.xeqPlugins;
		JS9.globalOpts.xeqPlugins = false;
		this.setWCSSys(obj.wcssys, false);
	    }
	    // convert wcs supplied as strings
	    if( typeof obj.ra === "string" ){
		obj.ra = JS9.saostrtod(obj.ra);
		if( JS9.isHMS(this.params.wcssys) ){
		    obj.ra *= 15.0;
		}
	    }
	    if( typeof obj.dec === "string" ){
		obj.dec = JS9.saostrtod(obj.dec);
	    }
	    // convert to image coords
	    arr = JS9.wcs2pix(this.raw.wcs, obj.ra, obj.dec)
		.trim().split(/ +/);
	    panx = parseFloat(arr[0]);
	    pany = parseFloat(arr[1]);
	    // restore original wcssys
	    if( owcssys ){
		this.setWCSSys(owcssys, false);
		JS9.globalOpts.xeqPlugins = txeq;
	    }
	}
    }
    // generate section from new image coords
    if( !JS9.isNumber(panx) || !JS9.isNumber(pany) ){
	JS9.error(`invalid input for setPan: ${panx} ${pany}`);
    }
    if( this.wcsAlign() || this.isawcsim ){
	oval = JS9.globalOpts.panWithinDisplay;
	JS9.globalOpts.panWithinDisplay = true;
    }
    this.mkSection(panx, pany);
    // set pan for aligned images, if necessary
    if( this.wcsAlign() || this.isawcsim ){
	for(i=0; i<JS9.images.length; i++){
	    im = JS9.images[i];
	    if( (im !== this)                                &&
		(im.display === this.display)                &&
		(im.wcsim  === this ||
                 this.wcsim === im  ||
                 (im.wcsim && (im.wcsim === this.wcsim)))    &&
		(im.params.wcsalign || this.params.wcsalign) ){
		npan = JS9.pix2pix(this, im, {x: panx, y: pany});
		im.mkSection(npan.x, npan.y);
	    }
	}
	JS9.globalOpts.panWithinDisplay = oval;
    }
    this.displayImage("rgb");
    // pan/zoom the shape layers
    this.refreshLayers();
    // extended plugins
    if( JS9.globalOpts.extendedPlugins ){
	this.xeqPlugins("image", "onsetpan");
    }
    // allow chaining
    return this;
};

// return current zoom
JS9.Image.prototype.getZoom = function(){
    return this.rgb.sect.zoom;
};

// return zoom from zoom string
JS9.Image.prototype.parseZoom = function(zval){
    let i, ozoom, nzoom, w, h, pt, angle, x0, x1, y0, y1;
    const pts = [];
    // get old zoom
    ozoom = this.rgb.sect.zoom;
    // determine new zoom
    switch(typeof zval){
    case "string":
	switch(zval.charAt(0)){
	case "*":
	case "x":
	case "X":
	    nzoom = ozoom * parseFloat(zval.slice(1));
	    break;
	case "/":
	    nzoom = ozoom / parseFloat(zval.slice(1));
	    break;
	case "I":
	case "i":
	    nzoom = ozoom * 2;
	    break;
	case "O":
	case "o":
	    nzoom = ozoom / 2;
	    break;
	case "T":
	case "t":
	    if(  this.params.transformAngle ){
		angle = -this.params.transformAngle;
		pt = {x: -this.raw.width / 2, y: this.raw.height / 2};
		pts[0] = JS9.rotatePoint(pt, angle);
		pt = {x: this.raw.width / 2, y: this.raw.height / 2};
		pts[1] = JS9.rotatePoint(pt, angle);
		pt = {x: -this.raw.width / 2, y: -this.raw.height / 2};
		pts[2] = JS9.rotatePoint(pt, angle);
		pt = {x: this.raw.width / 2, y: -this.raw.height / 2};
		pts[3] = JS9.rotatePoint(pt, angle);
		for(i=0; i<pts.length; i++){
		    if( JS9.isNull(x0) || pts[i].x < x0 ){ x0 = pts[i].x; }
		    if( JS9.isNull(x1) || pts[i].x > x1 ){ x1 = pts[i].x; }
		    if( JS9.isNull(y0) || pts[i].y < y0 ){ y0 = pts[i].y; }
		    if( JS9.isNull(y1) || pts[i].y > y1 ){ y1 = pts[i].y; }
		}
		w = x1 - x0;
		h = y1 - y0;
	    } else {
		w = this.raw.width;
		h = this.raw.height;
	    }
	    nzoom = Math.min(this.display.width/w, this.display.height/h);
	    // a little rounding makes the zoom nicer
	    nzoom = Math.round((nzoom + 0.0000001) * 1000000) / 1000000;
	    break;
	default:
	    nzoom = parseFloat(zval);
	    break;
	}
	break;
    case "number":
	nzoom = zval;
	break;
    default:
	return;
    }
    return nzoom;
};

// set zoom of RGB image
JS9.Image.prototype.setZoom = function(zval){
    let i, nzoom, im, ipos, oval;
    // is this core service disabled?
    if( JS9.inArray("zoom", this.params.disable) >= 0 ){
	return;
    }
    nzoom = this.parseZoom(zval);
    if( !nzoom ){
	JS9.error(`invalid input for setZoom: ${zval}`);
    }
    if( this.wcsAlign() || this.isawcsim ){
	oval = JS9.globalOpts.panWithinDisplay;
	JS9.globalOpts.panWithinDisplay = true;
    }
    // remake section
    this.mkSection(nzoom);
    // set zoom for aligned images, if necessary
    if( this.wcsAlign() || this.isawcsim ){
	for(i=0; i<JS9.images.length; i++){
	    im = JS9.images[i];
	    if( (im !== this)                                &&
		(im.display === this.display)                &&
		(im.wcsim  === this ||
                 this.wcsim === im  ||
                 (im.wcsim && (im.wcsim === this.wcsim)))    &&
		(im.params.wcsalign || this.params.wcsalign) ){
		ipos = JS9.pix2pix(this, im, this.getPan());
		im.mkSection(ipos.x, ipos.y, nzoom);
	    }
	}
	JS9.globalOpts.panWithinDisplay = oval;
    }
    // redisplay the image
    this.displayImage("rgb");
    // pan/zoom the shape layers
    this.refreshLayers();
    // extended plugins
    if( JS9.globalOpts.extendedPlugins ){
	this.xeqPlugins("image", "onsetzoom");
    }
    // allow chaining
    return this;
};

// align an image to a target image in terms of pan and zoom values,
// also taking into account relative cdelt1 pixel sizes
// not taken into account: flips and rotations
// eslint-disable-next-line no-unused-vars
JS9.Image.prototype.alignPanZoom = function(im, opts){
    let tim, icen, iwcsinfo, izoom, wcsinfo, syncwcs;
    // sanity check
    if( !im ){ return; }
    // is im a string containing an image name?
    if( typeof im === "string" ){
	tim = JS9.getImage(im);
	if( tim ){
	    // it was an image name, so change im to the image handle
	    im = tim;
	} else {
	    JS9.error(`unknown image for alignPanZoom: ${im}`);
	}
    }
    // opts is optional (not used ... yet)
    opts = opts || {};
    // get center of target image
    icen = im.getPan();
    // get zoom of target image
    izoom = im.rgb.sect.zoom || 1;
    // use wcs to align?
    if( JS9.notNull(opts.syncwcs) ){
	syncwcs = opts.syncwcs;
    } else {
	syncwcs = JS9.globalOpts.syncWCS;
    }
    // do wcs or non-wcs alignment
    if( syncwcs ){
	wcsinfo  = this.raw.wcsinfo || {cdelt1: 1, crot: 0};
	iwcsinfo = im.raw.wcsinfo   || {cdelt1: 1, crot: 0};
	// pan this image to center of target
	this.setPan(JS9.pix2pix(im, this, {x: icen.ox, y: icen.oy}));
	// adjust zoom of this image, taking account of pixel size, target zoom
	this.setZoom(izoom * wcsinfo.cdelt1 / iwcsinfo.cdelt1);
	// adjust rotation of this image
	this.setRotate(iwcsinfo.crot - wcsinfo.crot);

    } else {
	// pan this image to center of target
	this.setPan({x: icen.ox, y: icen.oy});
	// adjust zoom of this image to target zoom
	this.setZoom(izoom);
    }
    // allow chaining
    return this;
};


// get paramerters for north is up, for given wcssys
JS9.Image.prototype.getNorthIsUp = function(wcssys){
    let txeq, cx, cy, arr, ra, dec, wcsinfo;
    let nobj = {};
    // ra, dec coords (degrees) of north poles for galactic, ecliptic
    let pole = {
	// galactic north pole in degrees
	// https://astronomy.swin.edu.au/cosmos/N/North+Galactic+Pole
	galactic: {
	    ra: JS9.saostrtod("12h51m26.00s") * 15,
	    dec: JS9.saostrtod("27d7m42.0s"),
	    wcssys: "FK5"
	},
	// ecliptic north pole in degrees
	// https://en.wikipedia.org/wiki/Orbital_pole
	ecliptic: {
	    ra: JS9.saostrtod("18h0m0.0s") * 15,
	    dec: JS9.saostrtod("66d33m38.55s"),
	    wcssys: "ICRS"
	}
    };
    // wcsinfo
    wcsinfo = this.raw.wcsinfo || {cdelt1: 1, cdelt2: 1, crot: 0};
    // default is current wcssys
    if( !wcssys ){
	wcssys = this.getWCSSys();
    }
    // init angle requirements
    nobj.angle = 0;
    // set flip requirements
    if( wcsinfo.cdelt1 > 0 ){ nobj.flip = "x"; }
    if( wcsinfo.cdelt2 < 0 ){ nobj.flip = (nobj.flip|| "") + "y"; }
    // only galactic and ecliptic use the algorithm below, others are trivial
    switch(wcssys){
    case "galactic":
    case "ecliptic":
	break;
    default:
	if( wcsinfo.crot ){
	    nobj.angle = -wcsinfo.crot;
	}
	return nobj;
    }
    // algorithm for galactic and ecliptic ... from AV (via trello)
    // turn off plugin callbacks
    txeq = JS9.globalOpts.xeqPlugins;
    JS9.globalOpts.xeqPlugins = false;
    // set wcssys to be the same wcssys the north pole coords are in
    this.setWCSSys(pole[wcssys].wcssys, false);
    // get center of image in that coord system
    cx = this.raw.width/2;
    cy = this.raw.height/2;
    arr = JS9.pix2wcs(this.raw.wcs, cx, cy).trim().split(/\s+/);
    // convert strings to float (degrees)
    ra = JS9.saostrtod(arr[0]);
    // ra hours to degrees, if necessary
    if( JS9.isHMS() ){ ra *= 15.0; }
    dec = JS9.saostrtod(arr[1]);
    // angular distance between north pole and image center
    nobj.angle = JS9.angdist(ra, dec, pole[wcssys].ra, pole[wcssys].dec);
    // remove any header-based rotation
    if( JS9.notNull(this.raw.wcsinfo.crot) ){
	nobj.angle -= this.raw.wcsinfo.crot;
    }
    // reset to the current coord system
    this.setWCSSys(wcssys, false);
    // restore plugin callbacks
    JS9.globalOpts.xeqPlugins = txeq;
    // return info
    return nobj;
};

// get transform
JS9.Image.prototype.getTransform = function(){
    return this.params.transform;
};

// set transform (basis for setFlip, setRot90, setRotate)
JS9.Image.prototype.setTransform = function(...args){
    let a, i, sina, cosa, m3, transform;
    let angle = 0;
    let scale = 1;
    let [arg1] = args;
    if( !this || !this.raw || !this.raw.header ){
	JS9.error("invalid image for setTransform");
    }
    // reset -> we're done
    if( arg1 === "reset" ){
	delete this.params.transform;
	delete this.params.transformInverse;
	delete this.params.transformAngle;
	delete this.params.transformScale;
	return;
    }
    // start with the identity matrix
    transform = [[1,0,0], [0,1,0], [0,0,1]];
    // for each transform ...
    for(i=0; i<JS9.globalOpts.transforms.length; i++){
	// ... add this transform to the transformation matrix, if necessary
	switch(JS9.globalOpts.transforms[i]){
	case "flip":
	    // flip
	    switch(this.params.flip){
	    case "x":
		m3 = [[-1, 0, 0], [0, 1, 0], [0, 0, 1]];
		transform = JS9.matrixMultiply(transform, m3);
		scale = -1;
		break;
	    case "y":
		m3 = [[1, 0, 0], [0, -1, 0], [0, 0, 1]];
		transform = JS9.matrixMultiply(transform, m3);
		scale = -1;
		break;
	    case "xy":
		m3 = [[-1, 0, 0], [0, -1, 0], [0, 0, 1]];
		transform = JS9.matrixMultiply(transform, m3);
		break;
	    default:
		break;
	    }
	    break;
	case "rot90":
	    // rot90 rotation
	    if( JS9.notNull(this.params.rot90) ){
		a = this.params.rot90 * Math.PI / 180.0;
		cosa = Math.cos(a);
		sina = Math.sin(a);
		m3 = [[cosa, -sina, 0], [sina, cosa, 0], [0, 0, 1]];
		transform = JS9.matrixMultiply(transform, m3);
		angle += this.params.rot90;
	    }
	    break;
	case "rotate":
	    // arbitrary rotation
	    if( JS9.notNull(this.params.rotate) ){
		a = this.params.rotate * Math.PI / 180.0;
		cosa = Math.cos(a);
		sina = Math.sin(a);
		m3 = [[cosa, -sina, 0], [sina, cosa, 0], [0, 0, 1]];
		transform = JS9.matrixMultiply(transform, m3);
		angle += this.params.rotate;
	    }
	    break;
	}
    }
    // new transform
    this.params.transform = transform;
    this.params.transformInverse = JS9.invertMatrix3(transform);
    // these get applied to each region angle
    this.params.transformAngle = scale * angle;
    this.params.transformScale = scale;
    // allow chaining
    return this;
}

// get flip state
JS9.Image.prototype.getFlip = function(){
    return this.params.flip;
};

// flip image along an axis using canvas transform
JS9.Image.prototype.setFlip = function(...args){
    let [flip, opts] = args;
    const calcFlip = (flip) => {
	let i, arr;
	let nx = 0;
	let ny = 0;
	let nflip = "";
	arr = (flip + (this.params.flip||"")).split("");
	for(i=0; i<arr.length; i++){
	    switch(arr[i]){
	    case "x":
		nx++;
		break;
	    case "y":
		ny++;
		break;
	    }
	}
	if( nx % 2 === 1 ){ nflip += "x"; }
	if( ny % 2 === 1 ){ nflip += "y"; }
	return nflip || "none";
    }
    // sanity checks
    if( JS9.isNull(flip) ){ return this; }
    // reset
    if( flip === "reset" ){
	this.params.flip = "none";
	return this.setFlip(0);
    }
    // opts is optional
    opts = opts || {};
    // opts can be an object or json
    if( typeof opts === "string" ){
	try{ opts = JSON.parse(opts); }
	catch(e){ JS9.error(`can't parse setFlip opts: ${opts}`, e); }
    }
    // save this routine so it can be reconstituted in a restored session
    this.xeqStashSave("setFlip", [flip]);
    // save normalized value
    this.params.flip = calcFlip(flip);
    // update the transform
    this.setTransform();
    // redisplay using these data
    this.displayImage("all", opts);
    // refresh shape layers
    this.refreshLayers();
    // extended plugins
    if( JS9.globalOpts.extendedPlugins ){
	this.xeqPlugins("image", "onsetflip");
    }
    // allow chaining
    return this;
};

// get rotatation state
JS9.Image.prototype.getRotate = function(){
    return this.params.rotate;
};

// rotate image by specified angle
JS9.Image.prototype.setRotate = function(...args){
    let nobj;
    let [rot, opts] = args;
    const normRot = (rot) => {
	if( JS9.globalOpts.rotateRelative ){
	    rot += this.params.rotate||0;
	}
	while( rot < 0 ){ rot += 360; }
	while( rot >= 360 ){ rot -= 360; }
	return rot;
    }
    // sanity checks
    if( JS9.isNull(rot) ){ return this; }
    // reset
    if( rot === "reset" ){
	this.params.rotate = 0;
	return this.setRotate(0);
    }
    // north is up in current wcs system: calculate rotation angle
    if( typeof rot === "string" && rot.match(/north/i) ){
	nobj = this.getNorthIsUp();
	rot = nobj.angle;
	if( JS9.notNull(nobj.flip) ){ this.setParam("flip", nobj.flip); }
    }
    if( typeof rot === "string" ){
	rot = parseFloat(rot);
    }
    if( !JS9.isNumber(rot) ){
	JS9.error(`invalid rotation for setRotate: ${rot}`);
    }
    if( !this || !this.raw || !this.raw.header ){
	JS9.error("invalid image for setRotate");
    }
    // opts is optional
    opts = opts || {};
    // opts can be an object or json
    if( typeof opts === "string" ){
	try{ opts = JSON.parse(opts); }
	catch(e){ JS9.error(`can't parse setRotate opts: ${opts}`, e); }
    }
    // save this routine so it can be reconstituted in a restored session
    this.xeqStashSave("setRotate", [rot]);
    // save normalized value
    this.params.rotate = normRot(rot);
    // update the transform
    this.setTransform();
    // non-rectangular canvas: redo section to ensure coverage of display
    if( this.params.transformAngle                               &&
	this.display.canvas.width !== this.display.canvas.height ){
	this.mkSection(this.getZoom());
    }
    // redisplay using these data
    this.displayImage("all", opts);
    // refresh shape layers
    this.refreshLayers();
    // extended plugins
    if( JS9.globalOpts.extendedPlugins ){
	this.xeqPlugins("image", "onsetrotate");
    }
    // allow chaining
    return this;
};

// get 90-degree rotatation state
JS9.Image.prototype.getRot90 = function(){
    return this.params.rot90;
};

// rotate image by multiples of 90 degrees using canvas transform
JS9.Image.prototype.setRot90 = function(...args){
    let [rot, opts] = args;
    const normRot = (rot) => {
	rot += this.params.rot90||0;
	while( rot < 0 ){ rot += 360; }
	while( rot >= 360 ){ rot -= 360; }
	if( rot === 270 ){
	    rot = -90;
	}
	return rot;
    }
    // sanity checks
    if( JS9.isNull(rot) ){ return this; }
    // reset
    if( rot === "reset" ){
	this.params.rot90 = 0;
	return this.setRot90(0);
    }
    if( typeof rot === "string" ){
	rot = parseFloat(rot);
    }
    if( !this || !this.raw || !this.raw.header ){
	JS9.error("invalid image for setRot90");
    }
    // opts is optional
    opts = opts || {};
    // opts can be an object or json
    if( typeof opts === "string" ){
	try{ opts = JSON.parse(opts); }
	catch(e){ JS9.error(`can't parse setRot90 opts: ${opts}`, e); }
    }
    // only 90 degree rotations
    switch(rot){
    case 0:
	rot = 0;
	break;
    case 1:
	rot = 90;
	break;
    case -1:
	rot = -90;
	break;
    case 90:
	break;
    case -90:
	break;
    default:
	JS9.error(`invalid setRot90 rotation value: ${rot} (use: +/1, +/90)`);
	break;
    }
    // save this routine so it can be reconstituted in a restored session
    this.xeqStashSave("setRot90", [rot]);
    // save normalized value
    this.params.rot90 = normRot(rot);
    // update the transform
    this.setTransform();
    // non-rectangular canvas: redo section to ensure coverage of display
    if( this.params.transformAngle                               &&
	this.display.canvas.width !== this.display.canvas.height ){
	this.mkSection(this.getZoom());
    }
    // redisplay using these data
    this.displayImage("all", opts);
    // refresh shape layers
    this.refreshLayers();
    // extended plugins
    if( JS9.globalOpts.extendedPlugins ){
	this.xeqPlugins("image", "onsetrot90");
    }
    // allow chaining
    return this;
};

// redo the current flip and rot90 in cases where the underyling data changed
// (e.g. displaySection, refreshImage)
JS9.Image.prototype.reFlipRot = function(){
    let i, flips, nrot;
    let flip = this.params.flip;
    let rot90 = this.params.rot90;
    let rot = this.params.rotate;
    if( flip !== "none" ){
	this.params.flip = "none";
	flips = flip.split("");
	for(i=0; i<flips.length; i++){
	    if( flips[i] === "x" || flips[i] === "y" ){
		this.setFlip(flips[i]);
	    }
	}
    }
    if( rot90 ){
	this.params.rot90 = 0;
	nrot = Math.floor(Math.abs(rot90) / 90);
	rot = Math.sign(rot90);
	for(i=0; i<nrot; i++){
	    this.setRot90(rot);
	}
    }
    if( rot ){
	this.setRotate(rot);
    }
    // allow chaining
    return this;
};

// refresh all layers
JS9.Image.prototype.refreshLayers = function(panzoomrefresh){
    let key;
    for( key of Object.keys(this.layers) ){
	if( this.layers[key].show &&
	    this.layers[key].opts.panzoom ){
	    if( panzoomrefresh && panzoomrefresh[key] ){
		panzoomrefresh[key].refresh = true;
	    }
	    this.refreshShapes(key);
	}
    }
    // re-select selected regions
    this.selectShapes("regions", "selected");
};

// return current file-related position for specified image position
JS9.Image.prototype.imageToLogicalPos = function(ipos, lcs){
    let arr, rot, tx, ty, cx, cy, dval;
    let osys = "image";
    const opos = {x: ipos.x, y: ipos.y};
    lcs = lcs || this.params.lcs || "image";
    switch(lcs){
    case "image":
	break;
    case "physical":
	if( this.lcs.physical ){
	    osys = lcs;
	    arr = this.lcs.physical.reverse;
	    rot = this.lcs.physical.rrot;
	    cx = this.lcs.physical.cx;
	    cy = this.lcs.physical.cy;
	}
	break;
    case "detector":
	if( this.lcs.detector ){
	    osys = lcs;
	    arr = this.lcs.detector.reverse;
	    rot = this.lcs.detector.rrot;
	    cx = this.lcs.detector.cx;
	    cy = this.lcs.detector.cy;
	}
	break;
    case "amplifier":
	if( this.lcs.amplifier ){
	    osys = lcs;
	    arr = this.lcs.amplifier.reverse;
	    rot = this.lcs.amplifier.rrot;
	    cx = this.lcs.amplifier.cx;
	    cy = this.lcs.amplifier.cy;
	}
	break;
    }
    if( arr ){
	opos.x = ipos.x * arr[0][0] + ipos.y * arr[1][0] + arr[2][0];
	opos.y = ipos.x * arr[0][1] + ipos.y * arr[1][1] + arr[2][1];
	if( rot ){
	    tx = cx + (opos.x - cx) * rot[0][0] + (opos.y - cy) * rot[1][0] +
		rot[2][0];
	    ty = cy + (opos.x - cx) * rot[0][1] + (opos.y - cy) * rot[1][1] +
		rot[2][1];
	    opos.x = tx;
	    opos.y = ty;
	}
	// for tables, incorporate tlmin into physical coords
	// the tlmin value is saved by jsfitio as tabmin
	if( this.imtab === "table" ){
	    dval = this.raw.bitpix < 0 ? 0.5 : 1;
	    if( this.raw.header.TABMIN1 !== undefined ){
		opos.x = opos.x - dval + this.raw.header.TABMIN1;
	    }
	    if( this.raw.header.TABMIN2 !== undefined ){
		opos.y = opos.y - dval + this.raw.header.TABMIN2;
	    }
	}
    }
    return {x: opos.x, y: opos.y, sys: osys};
};

// return current image position from file-related position
JS9.Image.prototype.logicalToImagePos = function(lpos, lcs){
    let arr, rot, tx, ty, cx, cy, dval;
    const opos = {x: lpos.x, y: lpos.y};
    cx = this.raw.header.CRPIX1 || 1;
    cy = this.raw.header.CRPIX2 || 1;
    lcs = lcs || this.params.lcs || "image";
    switch(lcs){
    case "image":
	break;
    case "ophysical":
	if( this.lcs.ophysical ){
	    arr = this.lcs.ophysical.forward;
	    rot = this.lcs.ophysical.frot;
	} else if( this.lcs.physical ){
	    arr = this.lcs.physical.forward;
	    rot = this.lcs.physical.frot;
	}
	break;
    case "physical":
	if( this.lcs.physical ){
	    arr = this.lcs.physical.forward;
	    rot = this.lcs.physical.frot;
	}
	break;
    case "detector":
	if( this.lcs.detector ){
	    arr = this.lcs.detector.forward;
	    rot = this.lcs.detector.frot;
	}
	break;
    case "amplifier":
	if( this.lcs.amplifier ){
	    arr = this.lcs.amplifier.forward;
	    rot = this.lcs.amplifier.frot;
	}
	break;
    }
    if( arr ){
	// for tables, incorporate tlmin into physical coords
	// the tlmin value is saved by jsfitio as tabmin
	if( this.imtab === "table" ){
	    dval = this.raw.bitpix < 0 ? 0.5 : 1;
	    if( this.raw.header.TABMIN1 !== undefined ){
		lpos.x = lpos.x - this.raw.header.TABMIN1 + dval;
	    }
	    if( this.raw.header.TABMIN2 !== undefined ){
		lpos.y = lpos.y - this.raw.header.TABMIN2 + dval;
	    }
	}
	opos.x = lpos.x * arr[0][0] + lpos.y * arr[1][0] + arr[2][0];
	opos.y = lpos.x * arr[0][1] + lpos.y * arr[1][1] + arr[2][1];
	if( rot ){
	    tx = cx + (opos.x - cx) * rot[0][0] + (opos.y - cy) * rot[1][0] +
		rot[2][0];
	    ty = cy + (opos.x - cx) * rot[0][1] + (opos.y - cy) * rot[1][1] +
		rot[2][1];
	    opos.x = tx;
	    opos.y = ty;
	}
    }
    return opos;
};

// return 1-indexed image coords for specified 0-indexed display position
JS9.Image.prototype.displayToImagePos = function(dpos){
    let x, y, t, ox, oy, dx, dy;
    const sect = this.rgb.sect;
    const hh = this.rgb.img.height;
    const w2 = this.display.width / 2;
    const h2 = this.display.height / 2;
    if( this.params.transformInverse ){
	t = this.params.transformInverse;
	ox = dpos.x - w2;
	oy = dpos.y - h2;
	dx = ox * t[0][0] + oy * t[1][0] + w2;
	dy = ox * t[0][1] + oy * t[1][1] + h2;
    } else {
	dx = dpos.x;
	dy = dpos.y;
    }
    // see funtools/funcopy.c/_FunCopy2ImageHeader
    x = (dx - this.ix + 0.5) / sect.zoom + sect.x0 + 0.5;
    y = (hh - (dy - this.iy + 0.5)) / sect.zoom + sect.y0 + 0.5;
    return {x, y};
};

// return 0-indexed display coords for specified 1-indexed image position
JS9.Image.prototype.imageToDisplayPos = function(ipos){
    let x, y, t, ox, oy;
    const sect = this.rgb.sect;
    const hh = this.rgb.img.height;
    const w2 = this.display.width / 2;
    const h2 = this.display.height / 2;
    // see funtools/funcopy.c/_FunCopy2ImageHeader
    x = (((ipos.x - 0.5) - sect.x0) * sect.zoom) + this.ix - 0.5;
    y = (sect.y0 - (ipos.y - 0.5)) * sect.zoom + hh + this.iy - 0.5;
    if( this.params.transform ){
	t = this.params.transform;
	ox = x - w2;
	oy = y - h2;
	x = ox * t[0][0] + oy * t[1][0] + w2;
	y = ox * t[0][1] + oy * t[1][1] + h2;
    }
    return {x, y};
};

// return 0-indexed display pos from 1-indexed logical pos
JS9.Image.prototype.logicalToDisplayPos = function(lpos, lcs, mode){
    return this.imageToDisplayPos(this.logicalToImagePos(lpos, lcs, mode));
};

// return 1-indexed logical pos from 0-indexed display pos
JS9.Image.prototype.displayToLogicalPos = function(dpos){
    return this.imageToLogicalPos(this.displayToImagePos(dpos));
};

JS9.Image.prototype.getWCSSys = function(){
    if( this.params.wcssys ){
	return this.params.wcssys;
    }
};

// set the WCS sys for this image
JS9.Image.prototype.setWCSSys = function(wcssys, updatedef){
    let s, u;
    // is this core service disabled?
    if( JS9.inArray("wcs", this.params.disable) >= 0 ){
	return;
    }
    // do we update the default?
    if( JS9.isNull(updatedef) ){
	updatedef = JS9.globalOpts.wcsSetUpdatesDef;
    }
    if( wcssys === "image" ){
	this.params.wcssys = "image";
	this.params.wcsunits = "pixels";
	JS9.wcsunits.image = "pixels";
    } else if( wcssys === "physical" ){
	this.params.wcssys = "physical";
	this.params.wcsunits = "pixels";
	if( updatedef ){
	    JS9.globalOpts.wcsUnits.physical = "pixels";
	}
    } else if( this.validWCS() ){
	// native: original wcs from file
	if( wcssys === "native" ){
	    wcssys = this.params.wcssys0;
	}
	// set wcs system
	s = JS9.wcssys(this.raw.wcs, wcssys);
	if( s ){
	    // store new wcs system param
	    this.params.wcssys = s.trim();
	    // get units associated with this wcs system
	    u = JS9.globalOpts.wcsUnits[this.params.wcssys] || "sexagesimal";
	    // set the units
	    this.setWCSUnits(u, updatedef);
	}
    }
    // extended plugins
    if( JS9.globalOpts.extendedPlugins ){
	this.xeqPlugins("image", "onsetwcssys");
    }
    // allow chaining
    return this;
};

// init wcs
JS9.Image.prototype.initWCS = function(header){
    let alt, key, varr, s, bufsize, buf, wcsInitMode;
    const hlen = JS9.globalOpts.wcsHlength;
    const awcs = /(WCSNAME|WCSAXES|CRVAL[0-9]|CRPIX[0-9]|PC[0-9]_[0-9]|CDELT[0-9]|CD[0-9]_[0-9]|CTYPE[0-9]|CUNIT[0-9]|CRVAL[0-9]|PV[0-9]_[0-9]|PS[0-9]_[0-9]|RADESYS|LONPOLE|LATPOLE)([A-Z])/;
    if( !this.raw.header ){
	return this;
    }
    // usually it's the raw header
    header = header || this.raw.header;
    // clean up old wcs
    this.freeWCS();
    // init object to hold alt wcs objects
    this.raw.altwcs = {};
    // modern adapters accept full header strings directly,
    // while legacy pointer-mode adapters expect a runtime heap pointer.
    wcsInitMode = ((JS9.fits && JS9.fits.wcsInitMode) || JS9.wcsInitMode || "pointer")
	.toString().trim().toLowerCase();
    if( wcsInitMode !== "header" ){
	wcsInitMode = "pointer";
    }
    // set up the default wcs, using the original header params
    alt = "default";
    this.raw.altwcs[alt] = {};
    this.raw.altwcs[alt].header = header;
    // look for wcs alternates
    // see: http://www.atnf.csiro.au/people/mcalabre/WCS/wcs.pdf
    for( key of Object.keys(header) ){
	// is it an alt wcs keyword?
	varr = key.match(awcs);
	if( varr && varr.length ){
	    // this is the A-Z version
	    alt = varr[2];
	    // init the alt wcs object, if necessary
	    if( !this.raw.altwcs[alt] ){
		this.raw.altwcs[alt] = {};
		// start with original header
		this.raw.altwcs[alt].header = JS9.extend({}, header);
	    }
	    // wcslib seems to want "RADECSYS", not "RADESYS"
	    if( varr[1] === "RADESYS" ){
		varr[1] = "RADECSYS";
	    }
	    // overwrite standard keyword in header with the alt value
	    this.raw.altwcs[alt].header[varr[1]] = header[varr[0]];
	}
    }
    // init all of the wcs's we found
    for( key of Object.keys(this.raw.altwcs) ){
	// loop through alt wcs objects
	s = JS9.raw2FITS(this.raw.altwcs[key].header);
	if( wcsInitMode === "header" ){
	    // modern adapter path: pass FITS header directly.
	    try{
		this.raw.altwcs[key].wcs = JS9.initwcs(s, hlen);
	    }
	    catch(e){
		this.raw.altwcs[key].wcs = 0;
		JS9.error("can't initialize WCS from header string", e);
	    }
	} else {
	    // legacy pointer-mode path: pass pointer to runtime heap memory.
	    // too large headers blow runtime stack space
	    // this.raw.altwcs[key].wcs = JS9.initwcs(s, hlen);
	    // so we have to copy the header to the heap:
	    // allocate space for the string in the runtime heap
	    bufsize = s.length + 1;
	    try{ buf = JS9.vmalloc(bufsize); }
	    catch(e){ JS9.error(`can't malloc for wcsinit: ${bufsize}`, e); }
	    // copy the string to the heap
	    try{ JS9.vstrcpy(s, buf); }
	    catch(e){ JS9.error(`can't copy for wcsinit: ${bufsize}`, e); }
	    // call the wcsinit routine, passing the heap pointer
	    this.raw.altwcs[key].wcs = JS9.initwcs(buf, hlen);
	    // free heap space
	    JS9.vfree(buf);
	}
	// get info about the wcs
	if( this.raw.altwcs[key].wcs > 0 ){
	    try{ this.raw.altwcs[key].wcsinfo =
		 JSON.parse(JS9.wcsinfo(this.raw.altwcs[key].wcs)); }
	    catch(ignore){ /* empty */ }
	}
    }
    // set current wcs to the default
    this.setWCS("default");
    // allow chaining
    return this;
};

// close and free wcs resources
JS9.Image.prototype.freeWCS = function(raw){
    let key;
    // raw defaults to ... default raw
    raw = raw || this.raw;
    if( raw.altwcs ){
	// free all wcs structures
	for( key of Object.keys(raw.altwcs) ){
	    // loop through alt wcs objects
	    if( raw.altwcs[key].wcs > 0 ){
		JS9.freewcs(raw.altwcs[key].wcs);
		raw.altwcs[key].wcs = null;
	    }
	}
    }
};

// get name of current wcs (from among the alternates)
JS9.Image.prototype.getWCS = function(){
    let key, obj;
    // loop through wcs objects, looking for a match
    for( key of Object.keys(this.raw.altwcs) ){
	if( this.raw.wcs === this.raw.altwcs[key].wcs ){
	    obj = JS9.extend(true, {}, this.raw.altwcs[key].wcsinfo);
	    obj.version = key;
	    obj.wcsname = this.raw.altwcs[key].header.WCSNAME;
	    return obj;
	}
    }
    return null;
};

// set wcs to default or one of the alternative versions
JS9.Image.prototype.setWCS = function(version){
    let key, wcsname, wcssys;
    version = version || "default";
    // sanity check
    if( !this.raw || !this.raw.altwcs ){ return this; }
    // loop through wcs objects, looking for a match
    for( key of Object.keys(this.raw.altwcs) ){
	wcsname = this.raw.altwcs[key].header.WCSNAME;
	if( (version === key) || (version === wcsname) ){
	    // make sure its a valid wcs
	    if( this.raw.altwcs[key].wcs <= 0 ){
		JS9.error("invalid WCS for version: %s", version);
	    }
	    // set this wcs up as the current one
	    this.raw.wcs = this.raw.altwcs[key].wcs;
	    // get info about the wcs
	    this.raw.wcsinfo = this.raw.altwcs[key].wcsinfo;
	    // look for a good wcssys
	    if( this.raw.wcsinfo && this.raw.wcsinfo.radecsys ){
		wcssys = this.raw.wcsinfo.radecsys;
	    } else {
		if( this.params.wcssys !== "native" ){
		    wcssys = this.params.wcssys.trim();
		} else {
		    wcssys = this.params.lcs;
		}
	    }
	    // set the wcs system
	    this.setWCSSys(wcssys);
	    // this is also the default
	    if( !this.params.wcssys0 ){
		this.params.wcssys0 = wcssys;
	    }
	    // set the wcs units
	    this.setWCSUnits(this.params.wcsunits);
	    // all done
	    return this;
	}
    }
    // didn't find it
    JS9.error(`could not find WCS version: ${version}`);
};

// is a valid WCS open and active
JS9.Image.prototype.validWCS = function(){
    return this.raw && this.raw.wcs && this.raw.wcs > 0;
};

// get the WCS units for this image
JS9.Image.prototype.getWCSUnits = function(){
    if( this.params.wcsunits ){
	return this.params.wcsunits;
    }
    return "pixels";
};

// set the WCS units for this image
JS9.Image.prototype.setWCSUnits = function(wcsunits, updatedef){
    let s, ws;
    // is this core service disabled?
    if( JS9.inArray("wcs", this.params.disable) >= 0 ){
	return;
    }
    // do we update the default?
    if( JS9.isNull(updatedef) ){
	updatedef = JS9.globalOpts.wcsSetUpdatesDef;
    }
    if( wcsunits === "pixels" ){
	if( JS9.isWCSSys(this.params.wcssys) ){
	    this.params.wcssys = "physical";
	}
	this.params.wcsunits = "pixels";
	if( updatedef ){
	    JS9.globalOpts.wcsUnits[this.params.wcssys] = "pixels";
	}
    } else if( this.validWCS() ){
	if( JS9.notWCS(this.params.wcssys) ){
	    ws = JS9.imageOpts.wcssys;
	    this.setWCSSys(ws);
	}
	s = JS9.wcsunits(this.raw.wcs, wcsunits);
	if( s ){
	    this.params.wcsunits = s.trim();
	    if( updatedef ){
		JS9.globalOpts.wcsUnits[this.params.wcssys] =
		    this.params.wcsunits;
	    }
	}
    }
    // extended plugins
    if( JS9.globalOpts.extendedPlugins ){
	this.xeqPlugins("image", "onsetwcsunits");
    }
    // allow chaining
    return this;
};

// notify the helper a new image was displayed
JS9.Image.prototype.notifyHelper = function(){
    let basedir, image1, image2;
    const imexp = new RegExp(`^${JS9.ANON}[0-9]*`);
    const installexp = JS9.INSTALLDIR ? new RegExp(`^${JS9.INSTALLDIR}`) : null;
    // notify the helper
    if( JS9.helper.connected && !this.file.match(imexp) ){
	switch(JS9.helper.type){
	case "get":
	case "post":
	    // get pageid from CGI helper (socket.io does this when connecting)
	    if( !JS9.helper.pageid ){
		JS9.helper.send("pageid", null, (s) => {
		    if( s && s.trim().match(/^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/) ){
			JS9.helper.pageid = s;
			JS9.helper.js9helper = "js9helper";
		    }
		});
		break;
	    }
	}
	// get helper info about this image
	// but also try removing part of path which gets to install dir
	image1 = this.file;
	if( image1.charAt(0) !== "/" && installexp ){
	    image2 = this.file.replace(installexp, "");
	}
	JS9.helper.send("image", {"image": image1, "image2": image2}, (res) => {
	    let rstr, r, s, cc, regexp;
	    if( typeof res === "object" ){
		// from node.js, we get an object with stdout and stderr
		rstr = res.stdout;
		// log stderr but keep going
		if( res.stderr && JS9.DEBUG > 1 ){
		    JS9.log(res.stderr);
		}
	    } else {
		// with cgi, we just get stdout
		rstr = res;
	    }
	    // unless we have no stdout
	    if( !rstr ){
		return;
	    }
	    // returns: [file, path, wcs]
	    // split args, dealing with spaces inside brackets
	    r = rstr.trim().match(/(?:[^\s[]+|\[[^\]]*\])+/g);
	    s = r[1];
	    if( s !== "?" ){
		if( !JS9.globalOpts.dataDir ){
		    this.fitsFile = s;
		    // prepend base of png path if fits file has no path
		    // is this a bad "feature" in tpos?? probably ...
		    if( !this.fitsFile.includes("/") ){
			basedir = this.file.match( /.*\// );
			// but don't add installdir as part of prefix
			// (fitsFile path is relative to the js9 directory)
			if( basedir && basedir.length ){
			    regexp = new RegExp(`^${JS9.INSTALLDIR}`);
			    basedir = basedir[0].replace(regexp, "");
			    this.fitsFile =  basedir + this.fitsFile;
			}
		    }
		    // prepend JS9_DIR on files if fits is not absolute
		    if( JS9.globalOpts.prependJS9Dir ){
			if( this.fitsFile &&
			    !this.fitsFile.match(/^\${JS9_DIR}/) &&
			    this.fitsFile.charAt(0) !== "/" ){
			    this.fitsFile = `\${JS9_DIR}/${this.fitsFile}`;
			}
			if( this.parentFile &&
			    !this.parentFile.match(/^\${JS9_DIR}/) &&
			    this.parentFile.charAt(0) !== "/" ){
			    this.parentFile = `\${JS9_DIR}/${this.parentFile}`;
			}
		    }
		} else {
		    cc = s.lastIndexOf("/") + 1;
		    this.fitsFile = `${JS9.globalOpts.dataDir}/${s.slice(cc)}`;
		}
		if( JS9.DEBUG > 1 ){
		    JS9.log("JS9 fitsFile: %s %s", this.file, this.fitsFile);
		}
	    }
	    if( this.fitsFile ){
		this.fitsFile = JS9.cleanPath(this.fitsFile);
	    }
	    if( this.parentFile ){
		this.parentFile = JS9.cleanPath(this.parentFile);
	    }
	    // first time through, query the helper for info
	    if( !this.queried ){
		this.queryHelper("all");
		this.queried = true;
	    }
	});
    }
    // allow chaining
    return this;
};

// ask helper for various types of information
JS9.Image.prototype.queryHelper = function(which){
    const what = which || "all";
    // query the helper
    if( JS9.helper.connected ){
	if( (what === "all") || (what === "getAnalysis") ){
	    // only retrieve analysis tasks once per image
	    if( !this.analysisPackages ){
		JS9.helper.send("getAnalysis", {"fits": this.fitsFile}, (s) => {
		    if( s ){
			try{ this.analysisPackages = JSON.parse(s); }
			catch(e){ JS9.log("can't get analysis", e); }
		    }
		});
	    }
	}
    }
    // allow chaining
    return this;
};

// expand macros for this image
JS9.Image.prototype.expandMacro = function(s, opts){
    let cmd, olen;
    // sanity check
    if( !s ){ return; }
    // process each $ token
    // eslint-disable-next-line no-unused-vars
    cmd = s.replace(/\${?([a-zA-Z][a-zA-Z0-9_()]+)}?/g, (m, t, o) => {
	let i, r, owcssys, pos;
	// called in image context
	const savewcs = (wcssys) => {
	    const owcs = this.params.wcssys;
	    if( wcssys ){
		switch(wcssys){
		case "wcs":
		    if( JS9.notWCS(owcs) ){
			this.params.wcssys = this.params.wcssys0;
		    }
		    break;
		case "physical":
		case "image":
		    this.params.wcssys = wcssys;
		    break;
		default:
		    break;
		}
	    }
	    return owcs;
	};
	const restorewcs = (wcssys) => {
	    if( wcssys ){
		this.params.wcssys = wcssys;
	    }
	};
	const withext = (r) => {
	    let e;
	    // for tables, we might need to add the binning filter
	    if( this.imtab === "table" ){
		if( this.raw.hdu && this.raw.hdu.table.filter &&
		    !r.match(this.raw.hdu.table.filter)       ){
		    if( r.match(/\]\[/) ){
			r = `${r.slice(0,-1)}&&${this.raw.hdu.table.filter}]`;
		    } else {
			r += `[${this.raw.hdu.table.filter}]`;
		    }
		}
	    } else if( this.imtab === "image" ){
		// for images, we might need to add/replace extension info
		e = this.file.match(/\[.*\]/);
		if( e ){
		    if( r.match(/\[.*\]/) ){
			r = r.replace(/\[.*\]/, e);
		    } else {
			r += e;
		    }
		} else if( this.raw && this.raw.hdu &&
			   this.raw.hdu.slice       ){
		    // current slice of 3D cube
		    e = this.raw.hdu.slice
			.replace(/:/g, ",").replace(/([0-9][0-9]*)/, "$1:$1");
		    r += `[${e}]`;
		} else if( this.raw && this.raw.header &&
			   this.raw.header.NAXIS > 2   ){
		    // first slice of 3D cube
		    r += `[*,*,1:1]`;
		}
	    }
	    return r;
	};
	const u = t.split("(");
	if( u[1] ){
	    u[1] = u[1].replace(/\)$/, "");
	}
	switch(u[0]){
	case "id":
	    r = this.display.divjq.attr("id");
	    break;
	case "image0":
	    r = this.id.replace(/\[EVENTS\]/i, "");
	    break;
	case "image":
	    r = this.id;
	    break;
	case "filename":
	    // for cubes, process all slices if (all) is specified
	    if( u[1] == "all" && this.fitsFile &&
		this.raw && this.raw.header && this.raw.header.NAXIS === 3 ){
		r = this.fitsFile;
	    } else if( this.parentFile && (u[1] !== "this") ){
		// if a filter is defined, add it
		if( this.raw && this.raw.filter ){
		    r = this.parentFile;
		    // assume parent is a table with EVENTS
		    if( !r.match(/\[.*\]/) ){ r += '[EVENTS]'; }
		    r += `[${this.raw.filter}]`;
		} else {
		    r = withext(this.parentFile);
		}
	    } else if( this.fitsFile ){
		r = withext(this.fitsFile);
	    } else {
		JS9.error(`no FITS file for ${this.id}`);
	    }
	    break;
	case "fits":
	    if( !this.fitsFile ){
		JS9.error(`no FITS file for ${this.id}`);
	    }
	    r = withext(this.fitsFile);
	    break;
	case "parent":
	    if( !this.parentFile ){
		JS9.error(`no parent FITS file for ${this.id}`);
	    }
	    r = this.parentFile;
	    break;
	case "ext":
	    if( this.fitsFile ){
		r = this.fitsFile.match(/\[.*\]/);
		if( r === null ){
		    r = "";
		}
	    } else {
		JS9.error(`no FITS file for ${this.id}`);
	    }
	    break;
	case "imcenter":
	    pos = this.displayToLogicalPos({x: this.display.width/2,
					    y: this.display.height/2});
	    r = `${pos.x},${pos.y}`;
	    break;
	case "wcscenter":
	    pos = this.displayToImagePos({x: this.display.width/2,
					  y: this.display.height/2});
	    r = JS9.pix2wcs(this.raw.wcs, pos.x, pos.y).replace(/\s+/g, ",");
	    break;
	case "sregions":
	    owcssys = savewcs(u[1]);
	    r = this.listRegions("source",
		{mode:0, includedcoords:JS9.globalOpts.regExpandDCoords})
		.replace(/\s+/g,"");
	    restorewcs(owcssys);
	    break;
	case "bregions":
	    owcssys = savewcs(u[1]);
	    r = this.listRegions("background",
		{mode:0, includedcoords:JS9.globalOpts.regExpandDCoords})
		.replace(/\s+/g,"");
	    restorewcs(owcssys);
	    break;
	case "regions":
	    owcssys = savewcs(u[1]);
	    r = this.listRegions("all",
		{mode:0, includedcoords:JS9.globalOpts.regExpandDCoords})
		.replace(/\s+/g,"");
	    restorewcs(owcssys);
	    break;
	case "mag":
	    // hack for statusbar
	    if( this.params.zoom ){
		r = sprintf("%s%", 100 * this.params.zoom);
	    } else {
		r = "?";
	    }
	    break;
	case "bin":
	    // binning factor for image/event file
	    if( this.binning.bin ){
		r = this.binning.bin;
	    } else {
		r = "?";
	    }
	    break;
	case "flip":
	    // flip info
	    if( this.params.flip ){
                r = this.params.flip;
	    } else {
		r = "?";
	    }
	    break;
	case "flipx":
	    // flipx
	    if( this.params.flip ){
                if (this.params.flip.match('x')) {
                    r = "x";
                } else {
                    r = "x-none";
                }
	    } else {
		r = "?";
	    }
	    break;
	case "flipy":
	    // flipy
	    if( this.params.flip ){
                if (this.params.flip.match('y')) {
                    r = "y";
                } else {
                    r = "y-none";
                }
	    } else {
		r = "?";
	    }
	    break;
	default:
	    // look for keyword in the serialized opts array
	    if( opts ){
		olen = opts.length;
		for(i=0; i<olen; i++){
		    if( opts[i].name === t ){
			r = opts[i].value;
			break;
		    }
		}
	    }
            // look for params in the image object
            if( r === undefined && this && this.params[t] !== undefined ){
		// shorten some of the results
		switch(t){
		case "wcsunits":
                    switch(this.params[t]){
                    case "sexagesimal":
			r = "hms";
			break;
                    case "degrees":
			r = "deg";
			break;
                    default:
			r = this.params[t];
			break;
                    }
                    break;
		case "scaleclipping":
                    switch(this.params[t]){
                    case "dataminmax":
			r = "data";
			break;
                    default:
			r = this.params[t];
			break;
                    }
                    break;
		case "colormap":
		    if( this.useOffScreenCanvas() ){
			r = "overlay";
		    } else {
			r = this.params[t];
		    }
		    break;
		default:
                    if( typeof this.params[t] === "number"            &&
			this.params[t] !== Math.floor(this.params[t]) ){
			r = this.params[t].toFixed(2);
                    } else {
			r = this.params[t];
                    }
                    break;
		}
            }
	    // if all else fails, return original macro unexpanded
	    if( r === undefined ){
		r = m;
	    }
	    break;
	}
        if (JS9.useStatusbarDictionary) {
            if (JS9.globalOpts.statusBarDictionary[r]) {
                r = JS9.globalOpts.statusBarDictionary[r];
            }
        }
	return r;
    });
    return cmd;
};

// lookup an analysis command by name
JS9.Image.prototype.lookupAnalysis = function(name){
    let i, j, tasks;
    let a = null;
    // look for the named analysis task
    if( this.analysisPackages ){
	// look for xclass:name
	for(j=0; j<this.analysisPackages.length && !a; j++){
	    tasks = this.analysisPackages[j];
	    for(i=0; i<tasks.length; i++){
		// the analysis command we are using
		a = tasks[i];
		if( a.xclass && ((`${a.xclass}:${a.name}`) === name) ){
		    break;
		}
		a = null;
	    }
	}
	if( a ){
	    return a;
	}
	// look for name
	for(j=0; j<this.analysisPackages.length && !a; j++){
	    tasks = this.analysisPackages[j];
	    for(i=0; i<tasks.length; i++){
		// the analysis command we are using
		a = tasks[i];
		if( a.name === name ){
		    break;
		}
		a = null;
	    }
	}
    }
    return a;
};

// validate a task against rules contained in the files parameter
JS9.Image.prototype.validateAnalysis = function(atask){
    let s, parr;
    const imexp = /imVar\((.*),(.*)\)/;
    const js9exp = /js9Var\((.*),(.*)\)/;
    const parexp = /fitsHeader\(([A-Za-z0-9_]+),(.*)\)/;
    const winexp = /winVar\((.*),(.*)\)/;
    const seq = (s1, s2) => {
	if( !s1 || !s2 ){
	    return false;
	}
	return String(s1).toUpperCase() === String(s2).toUpperCase();
    };
    // sanity check
    if( !atask.title || !atask.name ){ return false; }
    // is this task hidden?
    if( atask.hidden ){
	return false;
    }
    // file validators
    if( atask.files ){
	if( atask.files.match(/^fits$/) &&
	    !this.fitsFile ){
	    return false;
	}
	if( atask.files.match(/^table$/) ){
	    if( this.imtab !== "table" ){
		return false;
	    }
	}
	if( atask.files.match(/^image$/) ){
	    if( this.imtab !== "image" ){
		return false;
	    }
	}
	// header params: fitsHeader(pname,pvalue)
	parr = atask.files.match(parexp);
	if( parr ){
	    s = this.raw.header[parr[1].toUpperCase()];
	    if( !seq(s, parr[2]) ){
		return false;
	    }
	}
	// win vars: winVar(name,value)
	parr = atask.files.match(winexp);
	if( parr ){
	    s = JS9.varByName(parr[1], window);
	    if( !seq(s, parr[2]) ){
		return false;
	    }
	}
	// js9 vars: js9Var(name,value)
	parr = atask.files.match(js9exp);
	if( parr ){
	    s = JS9.varByName(parr[1], JS9);
	    if( !seq(s, parr[2]) ){
		return false;
	    }
	}
	// im vars: imVar(name,value)
	parr = atask.files.match(imexp);
	if( parr ){
	    s = JS9.varByName(parr[1], this);
	    if( !seq(s, parr[2]) ){
		return false;
	    }
	}
    } // end of file validators
    return true;
};

// return object containing analysis task definitions
JS9.Image.prototype.getAnalysis = function(){
    let i, j, t, tasks;
    const obj = [];
    // sanity check
    if( !this.analysisPackages ){ return obj; }
    // return validated tasks
    for(j=0; j<this.analysisPackages.length; j++){
	tasks = this.analysisPackages[j];
	for(i=0; i<tasks.length; i++){
	    t = tasks[i];
	    if( this.validateAnalysis(t) ){
		obj.push(t);
	    }
	}
    }
    return obj;
};

// execute analysis task
JS9.Image.prototype.runAnalysis = function(name, opts, func){
    let i, a, m, ropts;
    let obj = {};
    const analError = (s, t) => {
	// shouldn't happen
	if( !JS9.helper ){
	    JS9.error(s, t);
	}
	switch(JS9.helper.type){
	case 'nodejs':
	case 'socket.io':
	    // when socket.io is long-polling, throwing an error prevent the
	    // polling from completing, leading to a timeout error and disaster.
	    // to allow the polling to complete, throw the error after a delay
	    if( JS9.helper.socket &&
		JS9.helper.socket.io.engine.transport.name === "polling"){
		window.setTimeout(() => {
		    JS9.error(s, t);
		}, 0);
	    } else {
		JS9.error(s, t);
	    }
	    break;
	default:
	    JS9.error(s, t);
	    break;
	}
    };
    // opts is optional
    opts = opts || {};
    // opts can be an object or json
    if( typeof opts === "string" ){
	try{ opts = JSON.parse(opts); }
	catch(e){ JS9.error(`can't parse runAnalysis opts: ${opts}`, e); }
    }
    // func can be passed, or it can be global
    func = func || JS9.globalOpts.analysisFunc;
    // sanity check
    if( !JS9.helper.connected || !this.analysisPackages ){ return; }
    // get analysis task
    a = this.lookupAnalysis(name);
    if( !a ){
	JS9.error(`could not find analysis task: ${name}`);
	return;
    }
    // get command line using macro expansion
    if( a.action ){
	obj.cmd = this.expandMacro(a.action, opts);
    }
    // macro expand the strings in the keys array
    if( a.keys ){
	obj.keys = {};
	for(i=0; i<a.keys.length; i++){
	    obj.keys[a.keys[i]] = this.expandMacro(`$${a.keys[i]}`, opts);
	}
    }
    // add some needed parameters
    obj.id = this.expandMacro("$id");
    obj.image = this.file;
    obj.fits = this.fitsFile;
    obj.rtype = a.rtype;
    // For socket.io communication, we have flattened the message space so
    // each analysis tool utilizes its own message. This allows easier addition
    // of non-exec'ed, in-line analysis. The cgi support utilizes the
    // 'runAnalysis' message to exec a task (there are no in-line additions)
    switch(JS9.helper.type){
    case 'nodejs':
    case 'socket.io':
	m = a.xclass ? (`${a.xclass}:${a.name}`) : a.name;
	break;
    default:
	m = "runAnalysis";
	break;
    }
    // ask the helper to run the command
    // change the cursor to show the waiting status
    JS9.waiting(true, this.display);
    // set status
    this.setStatus("runAnalysis", "processing");
    JS9.helper.send(m, obj, (r) => {
	let s, robj, f, pf, xobj, files;
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
	// if a processing func was supplied, call it and don't display
	if( func ){
	    func.call(this, robj.stdout, robj.stderr, robj.errcode, a);
	} else {
	    // handle errors before we start
	    if( robj.stderr ){
		s = robj.stderr;
		// if its only a warning, log it
		if( (s.search(/WARNING:/i) >= 0) && (s.search(/ERROR:/i) < 0) ){
		    JS9.log(s);
		} else {
		    // otherwise, throw an error
		    analError(s, JS9.analOpts.epattern);
		    return;
		}
	    } else if( robj.errcode ){
		s = `ERROR: running ${a.name} [${robj.errcode}]`;
		// not sure what this means, so just log it if stdout exists
		if( robj.stdout ){
		    JS9.log(s);
		} else {
		    // otherwise, throw an error
		    analError(s, JS9.analOpts.epattern);
		    return;
		}
	    }
	    // display according to type
	    switch(a.rtype){
	    case "text":
	    case undefined:
		this.displayAnalysis("text", robj.stdout,
				     {divid: JS9.globalOpts.analysisDiv});
		break;
	    case "plot":
		this.displayAnalysis("plot", robj.stdout,
				     {divid: JS9.globalOpts.analysisDiv});
		break;
	    case "alert":
		if( robj.stdout ){
		    alert(robj.stdout);
		}
		break;
	    case "fits":
		// output is file and possibly parentFile
		files = robj.stdout.split(/\s+/);
		if( files && files[0] ){
		    // file
		    f = JS9.cleanPath(files[0]);
		    // relative path: add install dir prefix
		    if( f.charAt(0) !== "/" ){
			f = JS9.InstallDir(f);
		    }
		    // which is a proxy file (meaning: delete it on close)
		    xobj = {proxyFile: f};
		    // look for parentFile (relative to helper, not install)
		    if( files[1] ){
			pf = JS9.cleanPath(files[1]);
			xobj.parentFile = pf;
			xobj.proxyParent = pf;
		    }
		    // don't convert this FITS file into another FITS file!
		    xobj.fits2fits = false;
			    // preserve proxy path as-is
			    xobj.fixpath = false;
		    // load new file
	            JS9.Load(f, xobj, {display: this.display});
		}
		break;
	    case "regions":
		// output is region file (or region string), optional opts
		files = robj.stdout.split(/\s+/);
		if( files && files[0] ){
		    // see if a json opts was returned
		    if( files.length > 1 ){
			try{ ropts = JSON.parse(files[1]); }
			catch(e){ ropts = null; }
		    }
		    ropts = ropts || {};
		    if( typeof ropts.remove === "boolean" ){
			ropts.remove = "all";
		    }
		    if( ropts.type === "string" ){
			// region string was passed directly
			if( ropts.remove ){
			    this.removeShapes("regions", ropts.remove);
			}
			this.addShapes("regions", files[0], opts);
		    } else {
			// region file was passed, we have to fetch it
			f = JS9.cleanPath(files[0]);
			// relative path: add install dir prefix
			if( f.charAt(0) !== "/" ){
			    f = JS9.InstallDir(f);
			}
			// load new region file
			obj = {responseType: "text"};
			JS9.fetchURL(null, f, obj, (regions, opts) => {
			    if( ropts.remove ){
				this.removeShapes("regions", ropts.remove);
			    }
			    this.addShapes("regions", regions, opts);
			});
		    }
		}
		break;
	    case "catalog":
		// output is catalog file
		files = robj.stdout.split(/\s+/);
		if( files && files[0] ){
		    f = JS9.cleanPath(files[0]);
		    // load new catalog file
		    obj = {responseType: "text"};
		    JS9.fetchURL(null, f, obj, (catalog, opts) => {
			this.loadCatalog(null, catalog, opts);
		    });
		}
		break;
	    case "none":
		break;
	    default:
		JS9.error(`unknown analysis result type: ${a.rtype}`);
		break;
	    }
	}
	// set status
	this.setStatus("runAnalysis", "complete");
	// done waiting
	JS9.waiting(false);
    });
    // allow chaining
    return this;
};

// display analysis results (text or plot)
JS9.Image.prototype.displayAnalysis = function(type, s, opts){
    let i, r, id, did, hstr, pobj, divjq, title, titlefile, winFormat;
    let divid, plot, pdata, popts, gim, gdiv, nscale;
    const a = JS9.lightOpts[JS9.LIGHTWIN];
    const flotConfig = () => {
	let s;
	let winformat = "width=368px,height=110px,resize=1,scrolling=1";
	const title = JS9.Plot.opts.title;
	// sanity check
	if( !divjq || !plot ){ return; }
	// call this once window is loaded
	JS9.onElementAvailable(JS9.lightOpts[JS9.LIGHTWIN].topid,
			       "#plotConfigForm", () => {
	    JS9.Plot.initConfigForm.call(this, plot, pobj);
	});
	if( JS9.allinone ){
	    s = JS9.allinone.plotConfigHTML;
	    plot.winid = this.displayAnalysis("params", s, {title, winformat});
	} else {
	    s = JS9.InstallDir(JS9.Plot.opts.configURL);
	    plot.winid = this.displayAnalysis("params", s, {title, winformat});
	}
    };
    // opts is optional
    opts = opts || {};
    // opts can be an object or json
    if( typeof opts === "string" ){
	try{ opts = JSON.parse(opts); }
	catch(e){ JS9.error(`can't parse displayAnalysis opts: ${opts}`, e); }
    }
    // window format ...
    winFormat = opts.winformat;
    // ... or target div
    if( opts.divid && JS9.resolveNode(opts.divid) ){
	divid = JS9.resolveNode(opts.divid);
    }
    // make up title, if necessary
    title = opts.title || "";
    if( this && !title ){
	titlefile = (this.fitsFile || this.id || "");
	titlefile = titlefile.split("/").reverse()[0];
	title = `AnalysisResults: ${titlefile}`;
	// add display to title
	title += sprintf(JS9.IDFMT, this.display.id);
    }
    // unique id for light window
    id = `Analysis_${JS9.uniqueID()}`;
    // process the type of analysis results
    switch(type){
    case "text":
	s = s || "";
	hstr = "<div class='JS9Analysis'></div>";
	hstr += `<pre class='JS9AnalysisText'>${s}</pre>`;
	hstr += "</div>";
	// populate div or create the light window to hold the text
        if( divid ){
	    // existing div
	    divid.innerHTML = hstr;
	} else {
	    // display light window
	    winFormat = winFormat || a.textWin;
	    did = JS9.lightWin(id, "inline", hstr, title, winFormat);
	}
	break;
    case "plot":
	// convert results to js object
	if( s && typeof s === "string" ){
	    try{ pobj = JSON.parse(s); }
	    catch(e){ JS9.error(`can't plot return data: ${s}`, e);	}
	} else if( typeof s === "object" ){
	    pobj = s;
	}
	// sanity check
	if( !pobj ){ return; }
	// initialize scale
	pobj.curscale = {x: "linear", y: "linear"};
	// create an outer div and an inner plot for the light window open call
	hstr = `<div id='${id}' class='JS9Analysis'><div id='${id}Plot' class='JS9Plot' ></div></div>`;
	// populate div or create the light window to hold the plot
        if( divid ){
	    divid.innerHTML = hstr;
	} else {
	    winFormat = winFormat || a.plotWin;
	    did = JS9.lightWin(id, "inline", hstr, title, winFormat);
	}
	// find the inner plot div which now is inside the light window
	divjq = document.querySelector(`#${id} #${id}Plot`);
	// when using a div (instead of a lightwin), set the div size
        if( divid ){
	    divjq.style.width = `${String(divid.getBoundingClientRect().width || divid.offsetWidth)}px`;
	    divjq.style.height = `${String(divid.getBoundingClientRect().height || divid.offsetHeight)}px`;
	    divjq.style.margin = "0";
	}
	// flot data
	if( pobj.data ){
	    switch( JS9.globalOpts.plotLibrary ){
	    case "plotly":
		popts = JS9.extend(true, {}, JS9.Plot.opts, pobj.opts);
		if( pobj.label ){
		    popts.title = pobj.label;
		}
		pdata = {x: [], y: [], type: "scatter"};
		// flot data format: [[x1,y1], [x2,y2], ..]
		//               or: [[x1,y1,yerr1], [x2,y2,yerr2], ..]
		if( pobj.data[0].length >= 3 ){
		    // look for flot yerr properties
		    pdata.error_y = {type: 'data', array: [], visible: true};
		    if( pobj.points && pobj.points.yerr ){
			if( pobj.points.yerr.color ){
			    pdata.error_y.color = pobj.points.yerr.color;
			}
		    }
		}
		for(i=0; i<pobj.data.length; i++){
		    pdata.x.push(pobj.data[i][0]);
		    pdata.y.push(pobj.data[i][1]);
		    if( pdata.error_y && pdata.error_y.array ){
			pdata.error_y.array.push(pobj.data[i][2]);
		    }
		}
		if( JS9.Plot.opts.annotate && pobj.annotations ){
		    popts.annotations = JS9.Plot.annotate(pobj);
		}
		if( popts.xscale === "log" ){
		    popts.xaxis = popts.xaxis || {};
		    popts.xaxis.type = "log";
		    popts.xaxis.autorange = true;
		    pobj.curscale.x = "log";
		}
		if( popts.yscale === "log" ){
		    popts.yaxis = popts.yaxis || {};
		    popts.yaxis.type = "log";
		    popts.yaxis.autorange = true;
		    pobj.curscale.y = "log";
		}
		try{  Plotly.newPlot(divjq.id, [pdata], popts); }
		catch(e){ JS9.error("can't plot data (plotly)", e); }
		break;
	    case "flot":
	    default:
		popts = JS9.extend(true, {}, JS9.Plot.opts, pobj.opts);
		// add re-annotate callback, if necessary
		if( JS9.Plot.opts.annotate && pobj.annotations ){
		    // eslint-disable-next-line no-unused-vars
		    popts.zoomStack.func = (plt, r) => {
			JS9.Plot.annotate(divjq, plt, pobj);
		    };
		}
		pobj.color = pobj.color || popts.color;
		// log scale?
		if( pobj.xscale === "log" ){
		    popts.xaxis = popts.xaxis || {};
		    popts.xaxis.transform = JS9.Plot.logfunc;
		    popts.xaxis.inverseTransform = JS9.Plot.expfunc;
		    pobj.curscale.x = "log";
		}
		if( pobj.yscale === "log" ){
		    popts.yaxis = popts.yaxis || {};
		    popts.yaxis.transform = JS9.Plot.logfunc;
		    popts.yaxis.inverseTransform = JS9.Plot.expfunc;
		    pobj.curscale.y = "log";
		}
		try{
		    plot = JS9.plotAdapter(JS9.wrapCollection(divjq),
					    [pobj],
					    popts);
		}
		catch(e){ JS9.error("can't plot data (flot)", e); }
		// annotate, if necessary
		if( JS9.Plot.opts.annotate && pobj.annotations ){
		    JS9.Plot.annotate(divjq, plot, pobj);
		}
		break;
	    }
	    // add key handlers
	    divjq.style.outline = "none";
	    divjq.tabIndex = 0;
	    divjq.addEventListener("keydown", (evt) => {
		const c = JS9.eventToCharStr(evt);
		switch(c){
		case "c":
		    flotConfig();
		    break;
		case "x":
		case "y":
		    nscale = pobj.curscale[c] !== "linear" ? "linear" : "log";
		    JS9.Plot.rescale(divjq, plot, pobj, c, nscale);
		    break;
		default:
		    break;
		}
	    });
	    // add the plot config gear
	    gim = document.createElement("img");
	    gim.src = JS9.InstallDir("images/gears.png");
	    gim.addEventListener("click", flotConfig);
	    gdiv = document.createElement("div");
	    gdiv.className = "JS9PlotGear";
	    gdiv.appendChild(gim);
	    divjq.appendChild(gdiv);
	}
	break;
    case "params":
    case "regions":
    case "textline":
        if( divid ){
	    if( JS9.allinone ){
		divid.innerHTML = s;
	    } else {
		JS9.ajax({
		    url: s,
		    cache: false,  // required for v3 socket.io
		    dataType: "text",
		    success: (data) => { divid.innerHTML = data; }
		});
	    }
	} else {
	    if( type === "params" ){
		winFormat = winFormat || a.paramWin;
	    } else if( type === "regions" ){
		if( JS9.globalOpts.regConfigSize === "small" ){
		    winFormat = winFormat || a.regWin0;
		} else {
		    winFormat = winFormat || a.regWin;
		}
	    } else {
		winFormat = winFormat || a.dpathWin;
	    }
	    r = JS9.allinone?"inline":"ajax";
	    did = JS9.lightWin(id, r, s, title, winFormat);
	}
	break;
    default:
	break;
    }
    return did;
};

// save image as a FITS file
JS9.Image.prototype.saveFITS = function(fname, opts){
    let arr, blob, s, sect;
    if( {}.hasOwnProperty.call(window, "saveAs") ){
	if( fname ){
	    fname = fname
		.replace(/\s+/g, "_")
		.replace(/(png|jpg|jpeg|fz)$/i, "fits");
	    if( !fname.match(/.fits$/) ){
		fname += ".fits";
	    }
	} else {
	    fname = "js9.fits";
	}
	opts = opts || {};
	if( typeof opts === "string" ){
	    try{ s = JSON.parse(opts); }
	    catch(e){ s = null; }
	    if( s ){ opts = s; }
	}
	// what do we save?
	if( opts === "display" || opts.source === "display" ){
	    // save currently displayed section
	    sect = this.rgb.sect;
	    arr = this.toArray({notab: true, twoaxes: true, sect: sect});
	} else if( opts === "virtual" || opts.source === "virtual" ){
	    if( this.raw.hdu && this.raw.hdu.fits && this.raw.hdu.fits.vfile ){
		arr = JS9.vread(this.raw.hdu.fits.vfile, "binary");
	    } else {
		JS9.error("no virtual file available to save");
	    }
	} else {
	    // save entire image: first convert to array (with two axes)
	    arr = this.toArray({notab: true, twoaxes: true});
	}
	// convert array to blob
	blob = new Blob([arr], {type: "application/octet-binary"});
	// save to disk
	JS9.saveAs(blob, fname);
    } else {
	JS9.error("no saveAs() available to save FITS file");
    }
    return fname;
};

// save image as an img file of specified type (e.g., image/png, image/jpeg)
JS9.Image.prototype.saveIMG = function(fname, type, opts){
    let key, img, ctx, canvas, width, height, quality;
    if( {}.hasOwnProperty.call(window, "saveAs") ){
	// opts can be opts object or json string or quality value
	if( typeof opts === "number" ){
	    quality = opts;
	    opts = null;
	} else if( typeof opts === "string" ){
	    if( JS9.isNumber(opts) ){
		quality = parseFloat(opts);
		opts = null;
	    } else {
		try{ opts = JSON.parse(opts); }
		catch(e){ opts = null; }
	    }
	    if( opts ){
		quality = opts.quality;
	    }
	}
	// opts is optional
	opts = opts || {};
	// filename is optional
	fname = fname || "js9.png";
	// save as specified type
	type = type || "image/png";
	// convenience params
	width = this.display.width;
	height = this.display.height;
	// create off-screen canvas, into which we write all canvases
	img = document.createElement("canvas");
	img.setAttribute("width", width);
	img.setAttribute("height", height);
	ctx = img.getContext("2d");
	// source can be image or display
	if( opts.source === "image" ){
	    // image: save RGB image for this image, which will be different
	    // from the display, e.g., when blend mode is turned on
	    ctx.putImageData(this.rgb.img, 0, 0);
	} else {
	    // display: save RGB image as seen on the display,
	    // e.g. a composite blended image
	    ctx.drawImage(this.display.canvas, 0, 0);
	}
	// add graphics layers, unless explicitly specified not to
	if( opts.layers !== false ){
	    for( key of Object.keys(this.layers) ){
		// each layer canvas
		if( this.layers[key].dlayer.dtype === "main" &&
		    this.layers[key].show ){
		    canvas = this.layers[key].dlayer.canvasjq[0];
		    ctx.drawImage(canvas, 0, 0, width, height);
		}
	    }
	}
	// sanity check on quality
	if( JS9.notNull(quality) ){
	    if( quality < 0 || quality > 1 ){
		quality = 0.95;
	    }
	}
	img.toBlob( (blob) => {
	    JS9.saveAs(blob, fname);
	}, type, quality);
    } else {
	JS9.error("no saveAs() available for saving image");
    }
    return fname;
};

// save image as a PNG file
JS9.Image.prototype.savePNG = function(fname, opts){
    fname = fname || "js9.png";
    if( !fname.match(/\.png$/) ){
	fname += ".png";
    }
    return this.saveIMG(fname, "image/png", opts);
};

// save image as a JPEG file
JS9.Image.prototype.saveJPEG = function(fname, opts){
    fname = fname || "js9.jpg";
    if( !fname.match(/\.jpg$/) && !fname.match(/\.jpeg$/)  ){
	fname += ".jpg";
    }
    return this.saveIMG(fname, "image/jpeg", opts);
};

// update (and display) pixel and wcs values (connected to info plugin)
JS9.Image.prototype.updateValpos = function(ipos, disp){
    let val, vstr, vstr1, vstr2, vstr3, val3, i, c, d, p, s;
    let cd1, cd2, v1, v2, units, sect;
    let obj = null;
    const sep1 = "\t ";
    const sep2 = "\t\t ";
    const sp = "&nbsp;&nbsp;&nbsp;&nbsp;";
    const tf = (fval) => {
	return JS9.floatFormattedString(fval, this.params.precision, 3);
    };
    const tr = (fval, length) => {
	length = length || 3;
	return fval.toFixed(length);
    };
    const ti = (ival, length) => {
        let r = "";
	let prefix = "";
	length = length || 3;
	if( ival < 0 ){
	    ival = Math.abs(ival);
	    prefix = "-";
	}
	r = r + ival;
	while (r.length < length) {
            r = `0${r}`;
	}
	return prefix + r;
    };
    // only do processing if valpos is turned on
    if( this.params.valpos ){
	// default is to display
	if( disp === undefined ){
	    disp = true;
	}
	// if a cached valpos object exists, use it
	// this is unset and reset in the mousemove callback
	if( this.valpos ){
	    if( disp ){
		this.display.displayMessage("info", this.valpos,
					   JS9.globalOpts.valposTarget);
	    }
	    return this.valpos;
	}
	// get image coordinates
	i = {x: ipos.x, y: ipos.y, sys: "image"};
	// get logical coordinates
	p = this.imageToLogicalPos(ipos);
	// get display coordinates
	d = this.imageToDisplayPos(ipos);
	d.sys = "display";
	// get pixel coordinates in current logical coordinate system;
	if( this.params.wcssys === "image" ){
	    c = i;
	} else {
	    c = p;
	}
	// get image value: here we need 0-indexed display positions,
	// so subtract the 0.5 of the image pixel
	val = this.raw.data[Math.floor(ipos.y - 0.5) * this.raw.width +
			    Math.floor(ipos.x - 0.5)];
	// fix the significant digits in the value
	switch(this.raw.bitpix){
	case 8:
	case 16:
	case -16:
	case 32:
	    val3 = ti(val);
	    break;
	case -32:
	case -64:
	    val3 = tf(val);
	    break;
	default:
	    val3 = ti(val);
	    break;
	}
	// create the valpos string
	vstr1 = val3;
	vstr2 =  `${tr(c.x, 3)} ${tr(c.y, 3)} (${c.sys})`;
	if( JS9.globalOpts.valposDCoords && c.sys === "image" ){
	    vstr2 += `${sp}${tr(d.x, 3)} ${tr(d.y, 3)} (${d.sys})`;
	}
	vstr = vstr1 + sp + vstr2;
	// object containing all information
	obj = {ix: i.x, iy: i.y, ipos: tr(i.x, 2) + sep2 + tr(i.y, 2),
	       isys: "image",
	       px: p.x, py: p.y, ppos: tr(p.x, 2) + sep2 + tr(p.y, 2),
	       psys: "physical",
	       dx: d.x, dy: d.y, dpos: tr(d.x, 2) + sep2 + tr(d.y, 2),
	       dsys: "display",
	       cx: c.x, cy: c.y, cpos: tr(c.x, 2) + sep2 + tr(c.y, 2),
	       csys: c.sys,
	       ra: "", dec: "", wcspos: "", wcssys: "",
	       racen: "", deccen: "",
	       wcsfov: "", wcspix: "",
	       val: val, val3: val3,
	       id: this.id, file: this.file, object: this.object||""};
	if( this.telescope || this.instrument ){
	    if( obj.object ){ obj.object += "  "; }
	    obj.object += "(";
	    if( this.telescope ){
		obj.object += this.telescope;
		if( this.instrument ){
		    obj.object += ", ";
		}
	    }
	    if( this.instrument ){
		obj.object += this.instrument;
	    }
	    obj.object += ")";
	}
        // Define FOV and center in terms of pixels; will be redefined
        // to WCS if WCS is available
        sect = this.rgb.sect;
	v1 = (sect.x1 - sect.x0).toFixed(0);
	v2 = (sect.y1 - sect.y0).toFixed(0);
	obj.wcsfovpix = `${v1} × ${v2} pix`;
        obj.racen = (sect.x1 + sect.x0)/2;
        obj.deccen = (sect.y1 + sect.y0)/2;
	obj.wcscen = obj.racen + sep1 + obj.deccen;

	// add wcs, if necessary
	if( this.validWCS() && JS9.isWCSSys(this.params.wcssys) ){
	    s = JS9.pix2wcs(this.raw.wcs, ipos.x, ipos.y).trim().split(/\s+/);
	    vstr3 =  `${s[0]} ${s[1]} (${s[2]||"wcs"})`;
	    vstr = vstr1 + sp + vstr3 + sp + vstr2;
	    // update object with wcs
	    obj.ra = s[0];
	    obj.dec = s[1];
	    obj.wcspos = s[0] + sep1 + s[1];
	    obj.wcssys = s[2];
	    if( this.raw.wcsinfo ){
		cd1 = Math.abs(this.raw.wcsinfo.cdelt1);
		cd2 = Math.abs(this.raw.wcsinfo.cdelt2);
		v1 = 1/60;
		if( this.raw.header.CUNIT1 ){
		    units = this.raw.header.CUNIT1;
		}
		if( !units || units.match(/^deg/i) ){
		    if( (cd1 >= 1) || (cd2 >= 1) ){
			units = "deg";
		    } else if( (cd1 >= v1) || (cd2 >= v1) ){
			units = "'";
			cd1 *= 60;
			cd2 *= 60;
		    } else {
			units = '"';
			cd1 *= 3600;
			cd2 *= 3600;
		    }
		}
		sect = this.rgb.sect;
		v1 = ((sect.x1 - sect.x0) * cd1).toFixed(0);
		v2 = ((sect.y1 - sect.y0) * cd2).toFixed(0);
		obj.wcsfov = `${v1}${units} × ${v2}${units}`;
		v1 = tr(cd1 / sect.zoom, 3);
		obj.wcspix = `${v1}${units}/pix`;
		obj.wcsfovpix = `${obj.wcsfov}  (${obj.wcspix})`;
		s = JS9.pix2wcs(this.raw.wcs,
				(sect.x1 + sect.x0)/2, (sect.y1 + sect.y0)/2)
		    .trim().split(/\s+/);
		obj.racen = s[0];
		obj.deccen = s[1];
		obj.wcscen = s[0] + sep1 + s[1];
	    }
	}
	obj.vstrsmall = vstr1 + sp + vstr2;
	obj.vstr = vstr;
	obj.vstrmedium = vstr;
	obj.vstrlarge = vstr + sp + this.file;
	if( disp ){
	    this.display.displayMessage("info", obj,
					JS9.globalOpts.valposTarget);
	}
    }
    return obj;
};

// toggle display of value/position
JS9.Image.prototype.toggleValpos = function(){
    this.params.valpos = !this.params.valpos;
    if( !this.params.valpos ){
	this.display.clearMessage();
    }
};

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
    if( !{}.hasOwnProperty.call(window, "saveAs") ){
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
    if( {}.hasOwnProperty.call(window, "saveAs") ){
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

// ---------------------------------------------------------------------
// JS9 Colormap support
// ---------------------------------------------------------------------

JS9.Colormap = function(...args){
    let [name, a1, a2, a3] = args;
    let i, got;
    // sanity check
    if( !name ){ return; }
    // type of colormap is based on number and type of args
    this.name = name;
    switch(args.length){
    case 2:
	if( JS9.isArray(a1[0]) && typeof a1[0][0] === "number" ){
	    // array of rgb values
	    // JS9.Colormap("sls", [[0, 0, 0], [0.043442, 0, 0.052883], ...]);
	    this.type = "lut";
	    this.colors = a1;
	} else {
	    // array of static colors and min, max values
	    // JS9.Colormap("s1", [["red",1,1], ["cyan",2,3], ["blue",4,99]]);
	    this.type = "static";
	    this.colors = JS9.parseStaticColors(a1);
	}
	break;
    case 4:
	// three arrays of vertices
	// JS9.Colormap("grey", [[0,0],[1,1]], [[0,0],[1,1]], [[0,0],[1,1]]));
	this.type = "sao";
	this.vertices = [a1, a2, a3];
	break;
    default:
	JS9.error("colormap requires a colormap name and 1 or 3 array args");
	break;
    }
    // flag whether this was a core or user-defined colormap
    if( !JS9.inited ){
	this.source = "core";
    } else {
	this.source = "user";
    }
    // replace or append
    for(i=0; i<JS9.colormaps.length; i++){
	if( JS9.colormaps[i].name === this.name ){
	    JS9.colormaps[i] = this;
	    got = true;
	    break;
	}
    }
    if( !got ){
	JS9.colormaps.push(this);
    }
    // debugging
    if( JS9.DEBUG > 1 ){
	JS9.log("JS9 colormap:  %s", this.name);
    }
};

JS9.Colormap.prototype.mkColorCell = function(ii){
    let m, x, i, j, val, vertex, len, size, index;
    const count = JS9.COLORSIZE;
    const umax = 255;
    const rgb = [0, 0, 0];
    switch(this.type){
    // from: tksao1.0/colormap/sao.C
    case "sao":
	x = ii / count;
	// for each of red, green, blue ...
	for(j=0; j<3; j++){
	    // look for the first vertex with x value larger than our x value
	    vertex = this.vertices[j];
	    len = vertex.length;
	    for(i=0; i<len; i++){
		if( vertex[i][0] > x ){
		    break;
		}
	    }
	    // if first vertex x value is greater than ours, use it
	    if( i === 0 ){
		val = vertex[0][1];
	    // if last vertex xvalue is less than ours, use it
	    } else if( i === len ){
		val = vertex[len-1][1];
	    // interpolate between two vertices
	    } else {
		m = (vertex[i][1] - vertex[i-1][1]) /
		    (vertex[i][0] - vertex[i-1][0]);
		if( m ){
		    // point slope form
		    val = m * (x - vertex[i-1][0]) + vertex[i-1][1];
		} else {
		    val = vertex[i][1];
		}
	    }
	    // assign value to the correct color in the result array
	    rgb[j] = val * umax;
	}
	break;
    // from: tksao1.0/colormap/lut.C
    case "lut":
	size = this.colors.length;
	// index into the evenly spaced RGB values
	index = Math.floor(ii*size/count);
	if( index < 0 ){
	    rgb[0] = this.colors[0][0] * umax;
	    rgb[1] = this.colors[0][1] * umax;
	    rgb[2] = this.colors[0][2] * umax;
	} else if( index < size ){
	    rgb[0] = this.colors[index][0] * umax;
	    rgb[1] = this.colors[index][1] * umax;
	    rgb[2] = this.colors[index][2] * umax;
	} else {
	    rgb[0] = this.colors[size-1][0] * umax;
	    rgb[1] = this.colors[size-1][1] * umax;
	    rgb[2] = this.colors[size-1][2] * umax;
	}
	break;
    case "static":
	break;
    default:
	JS9.error("unknown colormap type");
	break;
    }
    // return the news
    return rgb;
};

// ---------------------------------------------------------------------
// JS9 display object for the screen display
// ---------------------------------------------------------------------

JS9.Display = function(el){
    // pass a wrapped element, DOM element, or id
    if( JS9.isWrappedCollection(el) ){
	this.divjq = el;
    } else if( typeof el === "object" ){
	this.divjq = JS9.wrapCollection(el);
    } else {
	this.divjq = JS9.wrapCollection(`#${el}`);
    }
    // make sure div has some id
    if( !this.divjq.attr("id") ){
	this.divjq.attr("id", JS9.DEFID);
    }
    // save id
    this.id = this.divjq.attr("id");
    // display-specific scratch space
    this.tmp = {};
    // display RGB mode
    this.rgb = {
	active: false,
	rim: null,
	gim: null,
	bim: null
    };
    // add class
    this.divjq.addClass("JS9");
    // set width and height on div
    this.width = this.divjq.attr("data-width");
    if( !this.width  ){
	this.width  = JS9.WIDTH;
    }
    this.divjq.css("width", this.width);
    this.width = parseInt(this.divjq.css("width"), 10);
    this.height = this.divjq.attr("data-height");
    if( !this.height ){
	this.height = JS9.HEIGHT;
    }
    this.divjq.css("height", this.height);
    this.height = parseInt(this.divjq.css("height"), 10);
    // save original width and height
    this.width0 = this.width;
    this.height0 = this.height;
    // set tabindex so we can sense keyboard events
    // (this invocation senses keydown when no is image loaded)
    this.divjq.attr("tabindex", 0);
    // create DOM canvas element
    this.canvas = document.createElement("canvas");
    // wrapped canvas node for event handling and DOM updates
    this.canvasjq = JS9.wrapCollection(this.canvas)
	.addClass("JS9Image")
	.attr("id", `${this.id}Image`)
	.attr("width", this.width)
	.attr("height", this.height)
	.css("z-index", JS9.ZINDEX);
    // add container to the high-level div
    this.displayCon = document.createElement("div");
    this.displayCon.className = "JS9Container";
    this.displayCon.id = `${this.id}DisplayConjq`;
    this.displayCon.style.zIndex = String(JS9.ZINDEX);
    // set tabindex so we can sense keyboard events
    // (this invocation senses keydown after image is loaded)
    this.displayCon.setAttribute("tabindex", "0");
    this.displayCon.appendChild(this.canvas);
    this.divjq.append(this.displayCon);
    this.displayConjq = JS9.wrapCollection(this.displayCon);
    if( !JS9.allinone ){
	this.icon = document.createElement("div");
	this.icon.className = "JS9Logo";
	this.icon.style.display = "none";
	this.icon.style.zIndex = String(JS9.ZINDEX+1);
	this.divjq.append(this.icon);
	this.iconjq = JS9.wrapCollection(this.icon);
	this.iconimg = document.createElement("img");
	this.iconimg.className = "JS9Logo";
	this.iconimg.src = JS9.InstallDir(JS9.globalOpts.logo);
	this.iconimg.alt = "js9";
	this.iconimg.title = "js9";
	this.icon.appendChild(this.iconimg);
	this.iconimgjs = JS9.wrapCollection(this.iconimg);
	if( JS9.globalOpts.logoDisplay ){
	    this.icon.style.display = "block";
	}
    }
    // add resize capability, if necessary
    if( JS9.globalOpts.resizeHandle                    &&
	{}.hasOwnProperty.call(window, "ResizeSensor") ){
	this.divjq
	    .css("resize", "both")
	    .css("overflow", "hidden");
	if( JS9.bugs.webkit_resize ){
	    this.owidth = parseInt(this.divjq.css("width"), 10);
	    this.oheight = parseInt(this.divjq.css("height"), 10);
	    this.divjq
		.css("width",  this.width + JS9.RESIZEFUDGE)
		.css("height", this.height + JS9.RESIZEFUDGE);
	}
	this.resizeSensor = new ResizeSensor(this.divjq, () => {
	    let nwidth = this.divjq.width();
	    let nheight = this.divjq.height();
	    if( JS9.bugs.webkit_resize ){
		nwidth  -= JS9.RESIZEFUDGE;
		nheight -= JS9.RESIZEFUDGE;
	    }
	    this.resize(nwidth, nheight);
	});
    }
    // drawing context
    this.context = this.canvas.getContext("2d");
    // turn off anti-aliasing
    if( !JS9.ANTIALIAS ){
	this.context.imageSmoothingEnabled = false;
    }
    // add the display tooltip
    this.tooltipEl = document.createElement("div");
    this.tooltipEl.id = `tooltip_${this.id}`;
    this.tooltipEl.className = "JS9Tooltip";
    this.divjq.append(this.tooltipEl);
    this.tooltip = JS9.wrapCollection(this.tooltipEl);
    // no image loaded into this canvas
    this.image = null;
    // no plugin instances yet
    this.pluginInstances = {};
    // no layers yet
    this.layers = {};
    // init message layer
    this.initMessages();
    // blend mode is false to start
    this.blendMode = false;
    // display-based mouse/touch actions initially from global
    this.mouseActions = JS9.globalOpts.mouseActions.slice(0);
    this.touchActions = JS9.globalOpts.touchActions.slice(0);
    // add event handlers
    this.divjq.on("mouseenter", this, (evt) => {
	return JS9.mouseEnterCB(evt);
    });
    this.divjq.on("mouseover", this, (evt) => {
	return JS9.mouseOverCB(evt);
    });
    this.divjq.on("mousedown touchstart", this, (evt) => {
	return JS9.mouseDownCB(evt);
    });
    this.divjq.on("mousemove touchmove", this, (evt) => {
	return JS9.mouseMoveCB(evt);
    });
    this.divjq.on("mouseup touchend", this, (evt) => {
	return JS9.mouseUpCB(evt);
    });
    this.divjq.on("mouseout", this, (evt) => {
	return JS9.mouseOutCB(evt);
    });
    this.divjq.on("keypress", this, (evt) => {
	return JS9.keyPressCB(evt);
    });
    this.divjq.on("keydown", this, (evt) => {
	return JS9.keyDownCB(evt);
    });
    this.divjq.on("keyup", this, (evt) => {
	return JS9.keyUpCB(evt);
    });
    this.divjq.on("wheel", this, (evt) => {
	return JS9.wheelCB(evt);
    });
    // set up drag and drop, if available
    this.divjq.on("dragenter", this, (evt) => {
	return JS9.dragenterCB(this.id, evt);
    });
    this.divjq.on("dragover", this, (evt) => {
	return JS9.dragoverCB(this.id, evt);
    });
    this.divjq.on("dragexit", this, (evt) => {
	return JS9.dragexitCB(this.id, evt);
    });
    this.divjq.on("drop", this, (evt) => {
	return JS9.dragdropCB(this.id, evt);
    });
    // no context menus on the display
    this.divjq.on("contextmenu", this, () => {
	return false;
    });
    // add local file open support
    this.addFileDialog("Load", JS9.globalOpts.imageTemplates);
    this.addFileDialog("RefreshImage", JS9.globalOpts.imageTemplates);
    this.addFileDialog("LoadRegions", JS9.globalOpts.regTemplates);
    this.addFileDialog("LoadSession", JS9.globalOpts.sessionTemplates);
    this.addFileDialog("LoadColormap", JS9.globalOpts.colormapTemplates);
    this.addFileDialog("LoadCatalog", JS9.globalOpts.catalogTemplates);
    // add to list of displays
    JS9.displays.push(this);
    // set focus
    this.displayConjq.focus();
    // debugging
    if( JS9.DEBUG ){
	JS9.log("JS9 display:  %s", this.id);
    }
};

// add support for file dialog box which executes JS9 routine on file blobs
JS9.Display.prototype.addFileDialog = function(funcName, template){
    let div, input, id;
    // sanity check
    if( !funcName || !JS9.publics[funcName] ){ return; }
    id = `openLocal${funcName}-${this.id}`;
    // outer div
    // https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/file
    // recommends opacity over visibility, but it breaks the menubar in ios
    div = document.createElement("div");
    div.className = "JS9Hidden";
    this.divjq.append(div);
    // inner file input element
    input = document.createElement("input");
    input.type = "file";
    input.id = id;
    input.multiple = true;
    div.appendChild(input);
    // add accept template, if possible
    if( template ){
	input.setAttribute("accept", template);
    }
    // add callback for when input changes
    input.addEventListener("change", (e) => {
	let i, opts;
	const el = e.currentTarget;
	if( el.files.length ){
	    switch(funcName){
	    case "Load":
	    case "RefreshImage":
		opts = {localAccess: true};
		JS9.waiting(true, this);
		break;
	    default:
		break;
	    }
	}
	for(i=0; i<el.files.length; i++){
	    // execute a JS9 public access routine
	    JS9.publics[funcName](el.files[i], opts, {display: this.id});
	}
	el.value = null;
	return false;
    });
};

// initialize message layers
JS9.Display.prototype.initMessages = function(){
    const messageContainer = document.createElement("div");
    const infoArea = document.createElement("div");
    const regionsArea = document.createElement("div");
    const progressArea = document.createElement("div");
    const progressBar = document.createElement("progress");
    messageContainer.className = "JS9Container";
    messageContainer.style.zIndex = String(JS9.MESSZINDEX);
    this.divjq.append(messageContainer);
    infoArea.className = "JS9Message";
    messageContainer.appendChild(infoArea);
    regionsArea.className = "JS9Message";
    messageContainer.appendChild(regionsArea);
    progressArea.className = "JS9Progress JS9Message";
    messageContainer.appendChild(progressArea);
    progressBar.className = "JS9ProgressBar";
    progressBar.value = 0;
    progressBar.max = 100;
    progressBar.name = "progress";
    progressArea.appendChild(progressBar);
    this.messageContainer = JS9.wrapCollection(messageContainer);
    this.infoArea = JS9.wrapCollection(infoArea);
    this.regionsArea = JS9.wrapCollection(regionsArea);
    this.progressArea = JS9.wrapCollection(progressArea);
    this.progressBar = JS9.wrapCollection(progressBar);
    // make it draggable, if possible
    JS9.makeDraggable(messageContainer, {
	start: () => {
	    this.oicb = JS9.globalOpts.internalContrastBias;
	    JS9.globalOpts.internalContrastBias = false;
	},
	stop: () => {
	    JS9.globalOpts.internalContrastBias = this.oicb;
	}
    });
    // allow chaining
    return this;
};

//  display a plugin in a light window or a new window
JS9.Display.prototype.displayPlugin = function(plugin){
    let i, a, w, h, p, r, s, title, name, did, oid, iid, odiv, pdiv, pinst, win;
    if( typeof plugin === "string" ){
	for(i=0; i<JS9.plugins.length; i++){
	    p = JS9.plugins[i];
	    if( p.name === plugin ){
		plugin = p;
		break;
	    }
	}
    }
    if( typeof plugin !== "object" || !plugin.name ){
	JS9.error("unknown plugin type for displayPlugin");
    }
    pinst = this.pluginInstances[plugin.name];
    // some day we want to support light windows and new (external) windows
    switch(JS9.globalOpts.winType){
    case "light":
	a = JS9.lightOpts[JS9.LIGHTWIN];
	if( !pinst || !pinst.status ){
	    // no spaces in an id
	    name = plugin.name.replace(/\s/g, "_");
	    // convenience ids
	    did = `${this.id}_${name}_lightDiv`;
	    oid = `${this.id}_${name}_outerDiv`;
	    iid = `${this.id}_${name}_innerDiv`;
	    // set up a new light instance, if necessary
	    if( !pinst ){
		odiv = document.createElement("div");
		odiv.id = oid;
		odiv.style.display = "none";
		this.divjq.append(odiv);
		pdiv = document.createElement("div");
		pdiv.className = plugin.name;
		pdiv.id = iid;
		pdiv.dataset.js9id = this.divjq.attr("id");
		pdiv.style.height = "100%";
		pdiv.style.width = "100%";
		odiv.appendChild(pdiv);
	    }
	    // window not created: create and show it
	    // create the window
	    w = plugin.opts.winDims[0] || JS9.WIDTH;
	    h = plugin.opts.winDims[1] || JS9.HEIGHT;
	    if( plugin.opts.winResize ){
		r = "1";
	    } else {
		r = "0";
	    }
	    // light window param string
	    s = sprintf(a.format, w, h, r);
	    // add the title, if explicitly called for and if not already added
	    if( plugin.opts.toolbarHTML &&
		plugin.opts.toolbarHTML.search(/\$title/) >= 0 ){
		title = "";
	    } else {
		title = plugin.opts.winTitle || "";
	    }
	    // add display to title
	    title += sprintf(JS9.IDFMT, this.id);
	    // create the light window
	    win = JS9.lightWin(did, "div", oid, title, s);
	    // find inner div in the light window
	    pdiv = document.querySelector(`#${did} #${iid}`);
	    // create the plugin inside the inner div
	    pinst = JS9.instantiatePlugin(pdiv, plugin, win);
	    pinst.winHandle.onclose = () => {
		// just hide the window
		pinst.winHandle.hide();
		pinst.status = "inactive";
		if( plugin.opts.onpluginclose ){
		    try{
			plugin.opts.onpluginclose.call(pinst, this.image);
		    }
		    catch(e){
			JS9.log("onplugincloseCB: %s [%s]\n%s",
				plugin.name, e.message, JS9.strace(e));
		    }
		}
		return false;
	    };
	    pinst.status = "active";
	    if( plugin.opts.onplugindisplay ){
		try{
		    plugin.opts.onplugindisplay.call(pinst, this.image);
		}
		catch(e){
		    JS9.log("onplugindisplayCB: %s [%s]\n%s",
			    plugin.name, e.message, JS9.strace(e));
		}
	    }
	} else if( pinst.status === "inactive" ){
	    // window created but hidden: show it
	    if( pinst.winHandle ){
		pinst.winHandle.show();
		pinst.status = "active";
		if( plugin.opts.onplugindisplay ){
		    try{
			plugin.opts.onplugindisplay.call(pinst, this.image);
		    }
		    catch(e){
			JS9.log("onplugindisplayCB: %s [%s]\n%s",
				plugin.name, e.message, JS9.strace(e));
		    }
		}
	    }
	} else if( pinst.status === "active" ){
	    // window created and showing: hide it
	    if( pinst.winHandle ){
		pinst.winHandle.hide();
		pinst.status = "inactive";
		if( plugin.opts.onpluginclose ){
		    try{
			plugin.opts.onpluginclose.call(pinst, this.image);
		    }
		    catch(e){
			JS9.log("onplugincloseCB: %s [%s]\n%s",
				plugin.name, e.message, JS9.strace(e));
		    }
		}
	    }
	}
	break;
    case "new":
	JS9.error("external window support for plugins not yet implemented");
	break;
    }
};

//  display the general file-loading form for this display
JS9.Display.prototype.displayLoadForm = function(opts){
    let html, did, method;
    const format = JS9.globalOpts.localLoadFormat;
    if( JS9.globalOpts.remoteLoadMethod === "proxy" && !JS9.proxyAvailable() ){
	JS9.globalOpts.remoteLoadMethod = "cgiproxy";
    }
    method = JS9.globalOpts.remoteLoadMethod;
    // opts is optional, defaults to displaying local and remote
    opts = opts || {local:true, remote:true};
    // options for creating window
    if( JS9.isNull(opts.title) ){
	opts.title = "";
	if( opts.local ){
	    opts.title = "Open ";
	}
	if( opts.remote ){
	    if( opts.title ){
		opts.title += "or ";
	    }
	    opts.title += "Retrieve ";
	}
	opts.title += "an Image ";
	if( opts.local ){
	    opts.title += "or Auxiliary File";
	}
    }
    opts.winformat = opts.winformat ||
	             "width=640px,height=300px,resize=1,scrolling=1";
    // from where do we get the html?
    if( JS9.allinone ){
	html = JS9.allinone.loadHTML;
    } else {
	html = JS9.InstallDir(JS9.globalOpts.loadURL);
    }
    // call this once window is loaded to init form values
    JS9.onElementAvailable(JS9.lightOpts[JS9.LIGHTWIN].topid,
			   ".loadForm", (el) => {
	let input;
	const win = JS9.resolveNode(did);
	const findInputByValue = (value) => {
	    return Array.from(win.querySelectorAll("input")).find((node) => {
		return node.value === value;
	    });
	};
	const show = (selector) => {
	    win.querySelectorAll(selector).forEach((node) => {
		node.classList.remove("nodisplay");
	    });
	};
	const localfile  = el.dataset.localfile  || this.tmp.localfile;
	const remotefile = el.dataset.remotefile || this.tmp.remotefile;
	if( !win ){
	    return;
	}
	if( opts.local ){
	    show(".localfile");
	    show(".localdoc");
	    if( localfile ){
		input = win.querySelector("input[name='localfile']");
		if( input ){
		    input.value = localfile;
		}
	    }
	    input = findInputByValue(format);
	    if( input ){
		input.click();
	    }
	}
	if( opts.remote ){
	    show(".remotefile");
	    show(".remotedoc");
	    if( remotefile ){
		input = win.querySelector("input[name='remotefile']");
		if( input ){
		    input.value = remotefile;
		}
	    }
	    if( !JS9.proxyAvailable() ){
		input = findInputByValue("proxy");
		if( input ){
		    input.disabled = true;
		}
	    }
	    input = findInputByValue(method);
	    if( input ){
		input.click();
	    }
	}
    });
    // create the window
    did = JS9.Image.prototype.displayAnalysis.call(null, "params", html, opts);
    // save display id
    if( JS9.resolveNode(did) ){
	JS9.resolveNode(did).dataset.dispid = this.id;
    }
};

//  resize a display
JS9.Display.prototype.resize = function(width, height, opts){
    let i, div, im, key, layer, nwidth, nheight, nleft, ntop, pinst, owidth;
    const repos = (o) => {
	o.left += nleft;
	o.top  += ntop;
	o.setCoords();
    };
    // sanity check
    if( !JS9.globalOpts.resize ){
	JS9.error("display resize not enabled");
    }
    // no args => return current size
    if( !width && !height ){
	return {width: this.width, height: this.height};
    }
    // 'full' or 'reset' or 'image'
    if( width === "full" ){
	opts = height;
	if( window.innerWidth ){
	    width = window.innerWidth;
	}
	if( window.innerHeight ){
	    // including menubar, if available
	    height = window.innerHeight;
	    // divs we take into account when centering
	    for(i=0; i<JS9.globalOpts.centerDivs.length; i++){
		div = JS9.globalOpts.centerDivs[i];
		if( this.pluginInstances[div] ){
		    height -= this.pluginInstances[div].divjq.height();
		}
	    }
	}
    } else if( width === "image" ){
	if( !this.image ){
	    JS9.error("can't resize display to 'image' without an image");
	}
	opts = height;
	width = this.image.raw.width;
	height = this.image.raw.height;
    } else if( width === "reset" ){
	opts = height;
	width = this.width0 || width;
	height = this.height0 || height;
    }
    // get width and height params
    width = Math.floor(width);
    if( height ){
	height = Math.floor(height);
    } else {
	height = width;
    }
    // sanity check
    if( (width < 10) || (height < 10) ){
	JS9.error("invalid dimension(s) passed to display resize");
    }
    // nothing to do if we are not changing size
    if( (width === this.width) && (height === this.height) ){
	return this;
    }
    opts = opts || {};
    // opts can be an object or json
    if( typeof opts === "string" ){
	try{ opts = JSON.parse(opts); }
	catch(e){ JS9.error(`can't parse resize opts: ${opts}`, e); }
    }
    // get resize parameters relative to current display
    nwidth = width;
    nheight = height;
    nleft = (nwidth - this.width) / 2;
    ntop = (nheight - this.height) / 2;
    // save old width for statusbar calculation
    owidth = this.width;
    // change display parameters
    this.width = nwidth;
    this.height = nheight;
    this.divjq.css("width", nwidth);
    this.divjq.css("height", nheight);
    this.canvasjq.attr("width", nwidth);
    this.canvasjq.attr("height", nheight);
    if( JS9.bugs.webkit_resize ){
	if( !this.resizing ){
	    this.owidth = Math.min(this.owidth, nwidth);
	    this.oheight = Math.min(this.oheight, nheight);
	}
    }
    // change the menubar width, unless explicitly told not to
    if( JS9.inArray("JS9Menubar", JS9.globalOpts.resizeDivs) >= 0 &&
	(JS9.isNull(opts.resizeMenubar) || opts.resizeMenubar) ){
	pinst = this.pluginInstances.JS9Menubar;
	if( pinst ){
	    el = JS9.resolveNode(`${this.id}Menubar`);
	    if( el ){
		el.style.width = `${String(nwidth)}px`;
	    }
	}
    }
    // change the toolbar width, unless explicitly told not to
    if( JS9.inArray("JS9Toolbar", JS9.globalOpts.resizeDivs) >= 0 &&
	(JS9.isNull(opts.resizeToolbar) || opts.resizeToolbar) ){
	pinst = this.pluginInstances.JS9Toolbar;
	if( pinst ){
	    // set new value for width
	    pinst.divjq.attr("data-width", `${String(nwidth)}px`);
	    // re-init toolbar for this size
	    JS9.Toolbar.init.call(pinst);
	}
    }
    // change the colorbar width, unless explicitly told not to
    if( JS9.inArray("JS9Colorbar", JS9.globalOpts.resizeDivs) >= 0 &&
	(JS9.isNull(opts.resizeColorbar) || opts.resizeColorbar) ){
	pinst = this.pluginInstances.JS9Colorbar;
	if( pinst ){
	    // set new value for width
	    pinst.divjq.attr("data-width", `${String(nwidth)}px`);
	    // re-init colorbar for this size
	    JS9.Colorbar.init.call(pinst);
	}
    }
    // change the statusbar width, unless explicitly told not to
    if( JS9.inArray("JS9Statusbar", JS9.globalOpts.resizeDivs) >= 0 &&
	(JS9.isNull(opts.resizeStatusbar) || opts.resizeStatusbar) ){
	pinst = this.pluginInstances.JS9Statusbar;
	if( pinst ){
	    el = JS9.resolveNode(`${this.id}Statusbar`);
	    if( el ){
		el.style.width = `${String(nwidth)}px`;
	    }
	    // resize colorbar, if necessary
	    if( pinst.statusBar &&
		pinst.statusBar.match(/\$colorbar/) &&
		opts.resizeStatusbarColorbar !== false ){
		pinst.colorwidth = Math.max(pinst.colorwidth + width - owidth,
					    JS9.Statusbar.COLORWIDTH);
		JS9.Statusbar.display.call(pinst, this.image, {reinit: true});
	    }
	}
    }
    // change size of shape canvases
    for( key of Object.keys(this.layers) ){
	layer = this.layers[key];
	if( layer.dtype === "main" ){
	    layer.divjq.css("width", nwidth);
	    layer.divjq.css("height", nheight);
	    layer.canvasjq.attr("width", nwidth);
	    layer.canvasjq.attr("height", nheight);
	    layer.canvas.setWidth(nwidth);
	    layer.canvas.setHeight(nheight);
	    layer.canvas.calcOffset();
	}
    }
    // change position of shapes on currently displayed layers
    // save resize parameters for undisplayed layers
    for(i=0; i<JS9.images.length; i++){
	im = JS9.images[i];
	im.mkSection();
	if( im.display && (this === im.display) ){
	    // save or update resize object
	    if( im.resize ){
		im.resize.left += nleft;
		im.resize.top  += ntop;
	    } else {
		im.resize = {left: nleft, top: ntop};
	    }
	    // current image: change object positions in displayed layers
	    if( im === im.display.image ){
		for( key of Object.keys(im.layers) ){
		    layer = im.layers[key];
		    if( layer.dlayer.type === "main" && !layer.json ){
			layer.canvas.getObjects().forEach(repos);
			layer.canvas.renderAll();
		    }
		}
	    }
	}
    }
    if( JS9.bugs.webkit_resize ){
	this.divjq
	    .css("width",  this.width  + JS9.RESIZEFUDGE)
	    .css("height", this.height + JS9.RESIZEFUDGE);
    }
    // redisplay current image, if necessary
    if( this.image && (JS9.globalOpts.resizeRedisplay || !this.resizing) ){
	this.image.displayImage("all", opts);
	this.image.refreshLayers();
    }
    // center, if necessary
    if( opts.center ){
	this.center();
    }
    return this;
};

// are we in the resize handle area of this display?
JS9.Display.prototype.inResize = function(pos){
    if( JS9.globalOpts.resizeHandle ){
	if( (pos.x + JS9.RESIZEDIST >= this.divjq.width())  &&
	    (pos.y + JS9.RESIZEDIST >= this.divjq.height()) ){
	    return true;
	}
    }
    return false;
};

// scroll the display to the center of the viewport
// scroll the display to the center of the viewport
JS9.Display.prototype.center = function(){
    const el = JS9.resolveNode(this.divjq);
    let i, div, tel, telNode, voffset, hoffset;
    let elOffset, elVOffset, elHeight, elHOffset, elWidth;
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;
    const speed = 250;
    if( !el ){
	return this;
    }
    elOffset = JS9.getNodeOffset(el);
    elVOffset = elOffset.top;
    elHeight = el.getBoundingClientRect().height || el.offsetHeight || 0;
    elHOffset = elOffset.left;
    elWidth = el.getBoundingClientRect().width || el.offsetWidth || 0;
    // divs we take into account when getting total height
    for(i=0; i<JS9.globalOpts.centerDivs.length; i++){
	div = JS9.globalOpts.centerDivs[i];
	if( this.pluginInstances[div] ){
	    tel = this.pluginInstances[div].divjq;
	    telNode = JS9.resolveNode(tel);
	    if( telNode ){
		elHeight += telNode.getBoundingClientRect().height ||
		    telNode.offsetHeight || 0;
		elVOffset = Math.min(JS9.getNodeOffset(telNode).top, elVOffset);
	    }
	}
    }
    if (elHeight < windowHeight) {
	voffset = elVOffset - ((windowHeight / 2) - (elHeight / 2));
    }
    else {
	voffset = elVOffset;
    }
    if (elWidth < windowWidth) {
	hoffset = elHOffset - ((windowWidth / 2) - (elWidth / 2));
    }
    else {
	hoffset = elHOffset;
    }
    if( speed && typeof window.scrollTo === "function" ){
	try{
	    window.scrollTo({top: voffset, left: hoffset, behavior: "smooth"});
	}
	catch(ignore){
	    window.scrollTo(hoffset, voffset);
	}
    }
    // allow chaining
    return this;
};

// gather images from other displays into this display
JS9.Display.prototype.gather = function(opts){
    let i, j, arr, uim, odisp, el;
    // opts are optional
    opts = opts || {};
    // opts can be an object or json
    if( typeof opts === "string" ){
	try{ opts = JSON.parse(opts); }
	catch(e){ JS9.error(`can't parse gather opts: ${opts}`, e); }
    }
    // array of images to use or all of them
    arr = opts.images || JS9.images;
    for(i=0; i<arr.length; i++){
	if( typeof arr[i] === "number" ){
	    uim = JS9.images[arr[i]];
	} else {
	    uim = arr[i];
	}
	if( uim && uim.display !== this ){
	    // save possible grid item ...
	    odisp = uim.display;
	    el = odisp.divjq.closest(".JS9GridItem");
	    // move to this display
	    uim.moveToDisplay(this);
	    // remove grid item
	    if( el.length > 0 ){
		j = JS9.inArray(odisp, JS9.displays);
		if( j >= 0 ){
		    JS9.displays.splice(j, 1);
		}
		el.remove();
	    }
	}
    }
    // extended plugins
    if( JS9.globalOpts.extendedPlugins ){
	if( this.image ){
	    this.image.xeqPlugins("image", "ongatherdisplay");
	}
    }
};

// separate images in this display into new displays
JS9.Display.prototype.separate = function(opts){
    let arr, d0, d1, el;
    let nsep = 0;
    let row = 0;
    let col = 0;
    let myid = 1;
    const sep = {};
    const saveims = {};
    const rexp = /_sep[0-9][0-9]*/;
    const sepopts = JS9.globalOpts.separate;
    const menuStr = "<div class='JS9Menubar' id='%sMenubar' data-width=%s></div>";
    const toolStr = "<div class='JS9Toolbar' id='%sToolbar' data-width=%s></div>";
    const js9Str = "<div class='JS9' id='%s' data-width=%s data-height=%s></div>";
    const colorStr = "<div style='margin-top: 2px;'><div class='JS9Colorbar' id='%sColorbar' data-width=%s></div></div>";
    const statusStr = "<div style='margin-top: 2px;'><div class='JS9Statusbar' id='%sStatusbar' data-width=%s></div></div>";
    const winoptsStr = "width=%s,height=%s,top=%s,left=%s,resize=1,scolling=1";
    const LIT_FUDGE = 5;
    const COLORBAR_FUDGE = 7;
    const DHTML_HEIGHT = 30 + 13; // height of dhtml lightwin extras;
    const initopts = (display, fromID, opts) => {
	const getNodeHeight = (node) => {
	    if( !node ){
		return 0;
	    }
	    return node.getBoundingClientRect().height || node.offsetHeight || 0;
	};
	const isPluginActive = (node) => {
	    const container = node ? node.closest(".JS9PluginContainer") : null;
	    return JS9.isVisibleNode(container);
	};
	// sanity check
	if( !fromID ){
	    JS9.error("can't init separation ops: no 'from' id");
	}
	sep.layout = opts.layout || JS9.globalOpts.separate.layout || "auto";
	sep.leftMargin = opts.leftMargin || sepopts.leftMargin || 0;
	sep.topMargin  = opts.topMargin  || sepopts.topMargin  || 0;
	// check if we want to do a grid ... and if we can
	if( sep.layout === "auto"                                  &&
	    display.divjq.closest(".JS9GridContainer").length > 0  ){
	    sep.layout = "grid";
	}
	if( sep.layout === "grid" ){
	    if( CSS.supports("display", "grid") ){
		el = display.divjq.closest(".JS9GridContainer");
		if( el.length > 0 ){
		    sep.container = el;
		}
	    } else {
		sep.layout = "auto";
	    }
	}
	switch(sep.layout){
	case "auto":
	    col = 1;
	    row = 0;
	    break;
	case "horizontal":
	    col = 1;
	    row = 0;
	    break;
	case "vertical":
	    col = 0;
	    row = 1;
	    break;
	default:
	    col = 1;
	    row = 0;
	    break;
	}
	sep.topExtra = DHTML_HEIGHT;
	sep.leftExtra = 0;
	sep.js9 = JS9.resolveNode(fromID);
	sep.menubar = JS9.resolveNode(`${fromID}Menubar`);
	sep.toolbar = JS9.resolveNode(`${fromID}Toolbar`);
	sep.statusbar = JS9.resolveNode(`${fromID}Statusbar`);
	sep.colorbar = JS9.resolveNode(`${fromID}Colorbar`);
	sep.menubarActive = isPluginActive(sep.menubar);
	sep.toolbarActive = isPluginActive(sep.toolbar);
	sep.statusbarActive = isPluginActive(sep.statusbar);
	sep.colorbarActive = !sep.statusbar && isPluginActive(sep.colorbar);
	if( sep.js9 ){
	    // hack: height of the dhtml drag handle and status area
	    sep.width = sep.js9.getBoundingClientRect().width || sep.js9.offsetWidth;
	    sep.height = sep.js9.getBoundingClientRect().height || sep.js9.offsetHeight;
	    sep.top = sep.js9.getBoundingClientRect().top - LIT_FUDGE;
	    sep.left = sep.js9.getBoundingClientRect().left;
	    if( sep.menubarActive ){
		sep.height += getNodeHeight(sep.menubar);
		sep.top -= getNodeHeight(sep.menubar);
	    }
	    if( sep.toolbarActive ){
		sep.height += getNodeHeight(sep.toolbar);
		sep.top -= getNodeHeight(sep.toolbar);
	    }
	    if( sep.statusbarActive ){
		sep.height += getNodeHeight(sep.statusbar);
		sep.top -= getNodeHeight(sep.statusbar);
	    } else if( sep.colorbarActive ){
		sep.height += getNodeHeight(sep.colorbar);
		sep.top -= getNodeHeight(sep.colorbar);
		sep.top += COLORBAR_FUDGE;
	    }
	}
    };
    const getopts = (fromID, toID) => {
	let html, winopts;
	if( fromID ){
	    if( sep.js9 ){
		html = "";
		if( sep.menubarActive ){
		    html += sprintf(menuStr, toID, sep.width);
		}
		if( sep.toolbarActive ){
		    html += sprintf(toolStr, toID, sep.width);
		}
		html += sprintf(js9Str, toID, sep.width, sep.height);
		if( sep.statusbarActive ){
		    html += sprintf(statusStr, toID, sep.width);
		} else if( sep.colorbarActive ){
		    html += sprintf(colorStr, toID, sep.width);
		}
	    }
	    if( sep.layout === "auto" ){
		if( (sep.left + (sep.width * (col+0.5))) > window.innerWidth ){
		    row++;
		    col = 0;
		}
	    }
	    winopts = sprintf(winoptsStr,
	      sep.width,
	      sep.height,
	      sep.top  + ((sep.height + sep.topMargin  + sep.topExtra) * row),
              sep.left + ((sep.width  + sep.leftMargin + sep.leftExtra) * col));
	    // move to next column
	    if( sep.layout === "auto" || sep.layout === "horizontal" ){
		col++;
	    } else if( sep.layout === "vertical" ){
		row++;
	    }
	}
	// return info for this  column;
	return {id: toID, html: html, winopts: winopts};
    };
    const separateim = (arr) => {
	let im, xopts, id;
	const n = nsep++;
	if( arr.length > n ){
	    if( typeof arr[n] === "number" ){
		im = JS9.images[arr[n]];
	    } else {
		im = arr[n];
	    }
	    // look for images in this display
	    if( im && im.display === this ){
		// display this image so it's the current one we move
		im.displayImage("all");
		// init params
		if( d0 === undefined ){
		    d0 = im.display.id;
		    initopts(im.display, d0, opts);
		    // if leave first image in place is false, decrement
		    // nsep so it gets separated on the next iteration
		    if( opts.firstinplace === false ){
			nsep--;
		    }
		    separateim(arr);
		} else {
		    // create a new window for this image
		    if( typeof opts.idbase === "string" ){
			id = opts.idbase + myid++;
			d1 = id;
		    } else {
			d1 = `${d0.replace(rexp, "")}_sep${JS9.uniqueID()}`;
		    }
		    saveims[d1] = im;
		    xopts = getopts(d0, d1);
		    // replace id, if idbase was supplied in opts
		    if( id ){
			xopts.id = id;
		    }
		    if( sep.layout === "grid" ){
			// a div hold the html for this separated display,
			// and is appended to grid container
			const gridItem = document.createElement("div");
			gridItem.id = xopts.id + "GridItem";
			gridItem.className = "JS9GridItem";
			gridItem.innerHTML = xopts.html;
			sep.container.append(gridItem);
			// create the new JS9 display, with associated plugins
			JS9.AddDivs(xopts.id);
			// move this image
			saveims[xopts.id].moveToDisplay(xopts.id);
			// process next image
			separateim(arr);
		    } else {
	            // create a light wndow
		    // code to run when new window exists
		    JS9.onElementAvailable(JS9.lightOpts[JS9.LIGHTWIN].topid,
					  `#${d1}`, (el) => {
			id = el.id;
			// FF (at least) needs this 0ms delay
			window.setTimeout(() => {
			    // move this image
			    saveims[id].moveToDisplay(id);
			    // process next image
			    separateim(arr);
			}, 0);
		    });
		    // load new window, code above gets run when window exists
		    JS9.LoadWindow(null, {id: xopts.id}, "light",
				   xopts.html, xopts.winopts);
		    }
		}
	    } else {
		// this image is in a different display, so process next image
		separateim(arr);
	    }
	} else {
	    // extended plugins
	    if( JS9.globalOpts.extendedPlugins ){
		if( this.image ){
		    this.image.xeqPlugins("image", "onseparatedisplay");
		}
	    }
	}
    };
    // opts are optional
    opts = opts || {};
    // opts can be an object or json
    if( typeof opts === "string" ){
	try{ opts = JSON.parse(opts); }
	catch(e){ JS9.error(`can't parse separate opts: ${opts}`, e); }
    }
    // array of images to use
    arr = opts.images || JS9.images;
    //  start separating the images
    separateim(arr);
};

// display the next image from the JS9 images list which is in this display
JS9.Display.prototype.nextImage = function(inc){
    let i, idx, nidx, im, dpos, npos;
    let ims = [];
    let masks = [];
    inc = inc || 1;
    if( !this.image ){
	return this;
    }
    dpos = this.image.pos;
    // make list of image masks for this display
    if( !JS9.globalOpts.nextImageMask ){
	for(i=0; i<JS9.images.length; i++){
	    im = JS9.images[i];
	    if( im.display === this && im.mask.active && im.mask.im ){
		masks.push(im.mask.im);
	    }
	}
    }
    // make a list of the images in this display
    // skipping masks, if necessary
    for(i=0; i<JS9.images.length; i++){
	im = JS9.images[i];
	// only images in this display
	if( im.display !== this ){
	    continue;
	}
	// only images that are not masks, if necessary
	if( !JS9.globalOpts.nextImageMask && JS9.inArray(im, masks) >= 0 ){
	    continue;
	}
	// candidate image
	ims.push(im);
    }
    // if there is only one image, we're done
    if( ims.length <= 1 ){
	return this;
    }
    // get index into images array for the currently displayed image
    for(idx=0; idx<ims.length; idx++){
	if( this.image === ims[idx] ){
	    break;
	}
    }
    // get index of next image
    nidx = idx + inc;
    // wrap if necessary
    while( nidx >= ims.length ){
	nidx -= ims.length;
    }
    // wrap if necessary
    while( nidx < 0 ){
	nidx += ims.length;
    }
    // display if we are not back to where we started
    if( idx !== nidx ){
	// display image, 2D graphics, etc.
	im = ims[nidx];
	im.displayImage("all");
// already done in displayImage()
//	im.refreshLayers();
	im.display.clearMessage();
	if( dpos ){
	    npos = im.displayToImagePos(dpos);
	    im.valpos = null;
	    im.valpos = im.updateValpos(npos, true);
	}
    }
    // allow chaining
    return this;
};

// load session from a json file
// NB: save is an image method, load is a display method
JS9.Display.prototype.loadSession = function(file, opts){
    let obj, left;
    const objs = {};
    const finish = (im) => {
	let i, dlayer, layer, lname, obj;
	const dorender = () => {
	    // update layer's shape counter
	    const objs = dlayer.canvas.getObjects();
	    if( objs && typeof objs.length !== "undefined" ){
		im.layers[dlayer.layerName].nshape = objs.length + 1;
	    }
	    // update objects for parents and children
	    JS9.Fabric.updateChildren(dlayer, null, "objects");
	    // change shape positions if the displays sizes differ
	    im.refreshLayers();
	};
	// see: http://fabricjs.com/v5-breaking-changes
	const reviver = (data, instance) => {
	    // detect that version is less than 5
	    // change radians to degrees (for circles)
	    if (parseInt(data.version.slice(0, 1), 10) < 5) {
		if( instance.startAngle ) instance.startAngle *= 180 / Math.PI;
		if( instance.endAngle )   instance.endAngle *= 180 / Math.PI;
	    }
	};
	obj = objs[im.file] || {};
	// reconstitute blend state
	if( obj.blend ){
	    im.blend = JS9.extend(true, {}, obj.blend);
	}
	// reconstitute tmp values
	if( obj.tmp ){
	    im.tmp = JS9.extend(true, {}, obj.tmp);
	}
	// reconstitute wcsim state
	if( obj.wcsim ){
	    im.wcsim = JS9.lookupImage(obj.wcsim);
	}
	// reconstitute layers
	if( obj.layers && obj.layers.length ){
	    for(i=0; i<obj.layers.length; i++){
		layer = obj.layers[i];
		lname = layer.name;
		// are regions disabled?
		if( JS9.inArray("regions", im.params.disable) >= 0 &&
		    lname === "regions" ){
		    continue;
		}
		// skip crosshair and grid
		if( lname === "crosshair" || lname === "grid" ){
		    continue;
		}
		// make sure layer exists in the display
		dlayer = this.newShapeLayer(lname, layer.dopts);
		// add a layer instance to this image (no objects yet)
		im.addShapes(lname, []);
		// load the session objects into the layer and render
		dlayer.canvas.loadFromJSON(layer.json, dorender, reviver);
		// restore catalog and starbase, if necessary
		if( layer.catalog ){
		    im.layers[lname].catalog = layer.catalog;
		}
		if( layer.starbase ){
		    try{im.layers[lname].starbase = JSON.parse(layer.starbase);}
		    catch(ignore){ /* empty */ }
		}
	    }
	}
	// if coordinate grid was active, display it
	if( im.tmp && im.tmp.gridStatus === "active" ){
	    im.displayCoordGrid(true);
	}
	// if all images are loaded, sort them to the original load order
	if( JS9.notNull(left) ){
	    left = left - 1;
	    if( left === 0 ){
		JS9.images.sort((a, b) => {
		    let ai = 0, bi = 0;
		    if( objs[a.file] ){ ai = objs[a.file].i; }
		    if( objs[b.file] ){ bi = objs[b.file].i; }
		    return ai - bi;
		});
	    }
	}
	// re-execute from the xeq stash
	if( obj.xeqstash ){
	    im.xeqStashCall(obj.xeqstash);
	}
	// plugin callbacks
	if( JS9.globalOpts.extendedPlugins ){
	    im.xeqPlugins("image", "onsessionload");
	}
	// execute onsessionload callback, if necessary
	if( typeof opts.onsessionload === "function" ){
	    try{ JS9.xeqByName(opts.onsessionload, window, im); }
	    catch(e){ JS9.error("in onsessionload callback", e, false); }
	}
    };
    const loadit = (imobj) => {
	let pname;
	// sanity check
	if( !imobj.file ){
	    JS9.error("session does not contain a filename");
	}
	// save copy of object so we can edit it
	obj = JS9.extend(true, {}, imobj);
	// some param info needs to be deleted
	delete obj.params.display;
	// unset crosshair (we don't save it or load it)
	obj.params.crosshair = false;
	// include an onload callback to load the layers
	obj.params.onload = finish;
	// get pathname of image file
	pname = obj.file;
	// add section info
	if( obj.sect ){
	    obj.params.xcen = obj.sect.xcen;
	    obj.params.ycen = obj.sect.ycen;
	    obj.params.xdim = obj.sect.xdim;
	    obj.params.ydim = obj.sect.ydim;
	    obj.params.zoom = obj.sect.zoom;
	    delete obj.sect;
	}
	// save for finish
	objs[pname] = obj;
	// load the image
	JS9.Load(pname, obj.params, {display: this.id});
    };
    const loadem = (jobj) => {
	let i, key, cmap, xobj;
	// restore (and remove) globals
	if( jobj.globalOpts ){
	    JS9.extend(true, JS9.globalOpts, jobj.globalOpts);
	    delete jobj.globalOpts;
	}
	// load colormaps
	if( jobj.cmaps ){
	    for(i=0; i<jobj.cmaps.length; i++){
		cmap = jobj.cmaps[i];
		if( !cmap.name ){ continue; }
		if( JS9.inArray(cmap.name, JS9.globalOpts.topColormaps) >= 0 ){
		    xobj = {toplevel: true};
		} else {
		    xobj = {toplevel: false};
		}
		JS9.AddColormap(cmap, xobj);
	    }
	}
	// load images
	if( jobj.images ){
	    left = jobj.images.length;
	    for(i=0; i<jobj.images.length; i++){
		// save the order in which we load images
		jobj.images[i].i = i;
		// load the next image (async load)
		loadit(jobj.images[i]);
	    }
	} else {
	    loadit(jobj);
	}
	// reconstitute display parameters
	if( jobj.display ){
	    for( key of Object.keys(jobj.display) ){
		switch(key){
		case "blendMode":
		    JS9.BlendDisplay(jobj.display[key], {display: this});
		    break;
		default:
		    this[key] = jobj.display[key];
		    break;
		}
	    }
	}
    };
    // opts is optional
    opts = opts || {};
    // opts can be an object or json
    if( typeof opts === "string" ){
	try{ opts = JSON.parse(opts); }
	catch(e){ JS9.error(`can't parse loadSession opts: ${opts}`, e); }
    }
    // change the cursor to show the waiting status
    JS9.waiting(true, this);
    if( typeof file === "object" ){
	loadem(file);
    } else {
	JS9.ajax({
	    url: file,
	    cache: false,
	    dataType: "json",
	    mimeType: "application/json",
	    async: false,
	    success: (jobj) => {
		loadem(jobj);
	    },
	    error: (jqXHR, textStatus, errorThrown) => {
		JS9.error(`could not load session: ${file}`, errorThrown);
	    }
	});
    }
    // allow chaining
    return this;
};

// dummy routines to display/clear message, overwritten in info plugin
// eslint-disable-next-line no-unused-vars
JS9.Display.prototype.displayMessage = function(type, message, target){
    return;
};
// eslint-disable-next-line no-unused-vars
JS9.Display.prototype.clearMessage = function(which){
    return;
};

// create a mosaic from a multi-extension FITS file or a number of images
JS9.Display.prototype.createMosaic = function(ims, opts){
    let i, im, bin, carr;
    const im0 = this.image;
    const line1 = "|                                                    fname|";
    const line2 = "|                                                     char|";
    // remove temp files
    const cleanup = () => {
	let i;
	for(i=0; i<carr.length; i++){
	    JS9.vunlink(carr[i]);
	}
    };
    // check for Montage error and cleanup as needed
    const chkerr = (prog, rstr) => {
	let earr;
	// check for Montage error
	if( rstr.search(/\[struct stat="OK"/) < 0 ){
	    // no longer waiting
	    JS9.waiting(false);
	    // first remove temp files
	    cleanup();
	    // signal this we completed the reproject attempt
	    earr = rstr.match(/msg="(.*)"/);
	    if( earr && earr[1] ){
		JS9.error(`${earr[1]} (from ${prog})`);
	    } else {
		JS9.error(rstr || `unknown ${prog} failure`);
	    }
	}
    };
    // display mosaic as a new image
    const disp = (hdu, opts) => {
	let topts, nim;
	opts = opts || {};
	topts = JS9.extend(true, {}, opts);
	// start the waiting!
	if( opts.waiting !== false ){
	    JS9.waiting(true, this);
	}
	// make sure we use the current display
	topts.display = this.id;
	// set up new and display new image
	nim = new JS9.Image(hdu, topts);
	// set status of both old and new image
	im0.setStatus("createMosaic", "complete");
	nim.setStatus("createMosaic", "complete");
	// done waiting
	JS9.waiting(false);
	// everything else is done so call onmosaic func, if necessary
	if( opts.onmosaic ){
	    try{ JS9.xeqByName(opts.onmosaic, window, nim); }
	    catch(e){ JS9.error("in create mosaic callback", e, false); }
	}
    };
    // write comforting messages to the console while we wait and wait
    const log = (...args) => {
	let s;
	if( opts.verbose || JS9.DEBUG > 1 ){
	    s = sprintf(...args);
	    // eslint-disable-next-line no-console
	    JS9.log(s);
	}
    };
    // opts is optional
    opts = opts || {};
    // opts can be an object or json
    if( typeof opts === "string" ){
	try{ opts = JSON.parse(opts); }
	catch(e){ JS9.error(`can't parse createMosaic opts: ${opts}`, e); }
    }
    if( !(JS9.fits && JS9.fits.capabilities &&
	  JS9.fits.capabilities.reprojection) ||
	typeof JS9.reproject !== "function" ||
	typeof JS9.madd !== "function" ||
	typeof JS9.imgtbl !== "function" ||
	typeof JS9.makehdr !== "function" ||
	typeof JS9.shrinkhdr !== "function" ||
	typeof JS9.imsection !== "function" ||
	typeof JS9.vfile !== "function" ||
	typeof JS9.vread !== "function" ||
	typeof JS9.vsize !== "function" ||
	typeof JS9.vunlink !== "function" ){
	JS9.error("createMosaic is not supported by the active FITS adapter");
    }
    // reduce can be taken from the global value
    opts.reduce = opts.reduce || JS9.globalOpts.reduceMosaic;
    // same for reduction dims
    opts.dim = opts.dim ||
	Math.max(JS9.globalOpts.image.xdim, JS9.globalOpts.image.ydim);
    // ims can be: array of ims or a single im or null (use displayed image)
    // each im can itself be an im object or the image string id
    if( !ims ){
	// use currently display image, if possible
	if( this.image ){
	    ims = [this.image];
	} else {
	    ims = [];
	}
    } else if( typeof ims === "string" ){
	if( ims === "current" ){
	    // use the currently loaded image
	    if( this.image ){
		ims = [this.image];
	    } else {
		ims = [];
	    }
	} else if( ims === "all" ){
	    // use all images in this display
	    ims = [];
	    for(i=0; i<JS9.images.length; i++){
		if( JS9.images[i].display.id === this.id ){
		    ims.push(JS9.images[i]);
		}
	    }
	} else {
	    // hopefully, it's the id of an image
	    ims = [ims];
	}
    } else if( !JS9.isArray(ims) ){
	JS9.error("unknown input type for createMosaic()");
    }
    // sanity check
    if( !ims.length ){
	JS9.error("no images specified for createMosaic()");
    }
    // convert all string id ims to im objects
    for(i=0; i<ims.length; i++){
	if( typeof ims[i] === "string" ){
	    im = JS9.lookupImage(ims[i]);
	    if( im ){
		ims[i] = im;
	    } else {
		JS9.error(`unknown image for mosaic: ${ims[i]}`);
	    }
	}
	im = ims[i];
	// sanity check: they all require a virtual file
	if( !im.raw.hdu || !im.raw.hdu.fits || !im.raw.hdu.fits.vfile ){
	    JS9.error(`no virtual file available for mosaic: ${im.id}`);
	}
    }
    // could take a while ...
    JS9.waiting(true, this);
    // set status
    im0.setStatus("createMosaic", "processing");
    window.setTimeout(() => {
	let s, t, v, sw, naxis, rstr, inbuf, ext;
	let vfile, ivfile, ovfile, bvfile, sect, topts;
	let inlst, intbl, inhdr, inarr, binlst, bintbl;
	let outlst, outtbl, outhdr, areafile, outfile;
	const id = JS9.uniqueID();
	const imsw = "-C"; // skip naxis[3,4]: they write garbage into the table
	const mktmp = (suffix) => {
	    return `mosaic_${id}_${suffix}`;
	};
	// temps files get unique names
	inlst = mktmp("in.lst");
	intbl = mktmp("in.tbl");
	inhdr = mktmp("in.hdr");
	binlst = mktmp("bin.lst");
	bintbl = mktmp("bin.tbl");
	outlst = mktmp("out.lst");
	outtbl = mktmp("out.tbl");
	outhdr = mktmp("out.hdr");
	// output file name comes from the first image name
	outfile = ims[0].id
	    .replace(/\[.*\]/, "")
	    .replace(/\.fz$/i, "")
	    .replace(/\.gz$/i, "")
	    .replace(/\.fits$/i, "_mosaic.fits");
	// Montage temp areafile comes from the output file name
	areafile = outfile.replace(/\.fits$/, "_area.fits");
	// init cleanup array to make sure temp files get deleted
	carr = [inlst, intbl, inhdr, binlst, bintbl,
		outlst, outtbl, outhdr, areafile];
	// generate input list from array of ims
	s = `${line1}\n${line2}\n`;
	for(i=0; i<ims.length; i++){
	    s += `${ims[i].raw.hdu.fits.vfile}\n`;
	}
	// save in list file
	JS9.vfile(inlst, s);
	// call the Mosaic/mImgtbl routine to make meta table
	rstr = JS9.imgtbl(inlst, ".", intbl, imsw);
	// check for errors
	chkerr("mImgtbl", rstr);
	// make sure input table actually has FITS files
	if( !JS9.vsize(intbl) ){
	    JS9.error("no image data found with which to construct a mosaic");
	}
	// make initial input header from input images
	rstr = JS9.makehdr(intbl, inhdr, "");
	// check for errors
	chkerr("mMakeHdr", rstr);
	// if we are using the js9helper, calculate a bin factor
	if( opts.reduce === "js9" ){
	    // calculate bin factor:
	    // get input header as an array of cr-delimited lines
	    s = JS9.vread(inhdr). split("\n");
	    naxis = 0;
	    // looks for dimensions of the image in this header
	    for(i=0; i<s.length; i++){
		t = s[i].split("=");
		switch(t[0].trim()){
		    case "NAXIS1":
		    naxis = Math.max(naxis, parseFloat(t[1].trim()));
		    break;
		    case "NAXIS2":
		    naxis = Math.max(naxis, parseFloat(t[1].trim()));
		    break;
		}
	    }
	    // bin based on image dims and desired mosaic dim
	    bin = Math.max(1, Math.floor((naxis / opts.dim) + 0.5));
	    // generate binned files, which become the input for reprojection
	    s = `${line1}\n${line2}\n`;
	    // get array of input images
	    inbuf = JS9.vread(intbl);
	    // ignore the first 3 header lines
	    inarr = inbuf.trim().split("\n");
	    inarr.splice(0,3);
	    // bin each image
	    for(i=0; i<inarr.length; i++){
		t = inarr[i].trim().split(/\s+/);
		ext  = t[t.length-2];
		vfile = t[t.length-1];
		if( ext && vfile ){
		    // section input file + extension
		    ivfile = `${vfile}[${ext}]`;
		    v = vfile.split("/").reverse()[0].replace(/\.(g|f)z$/, "");
		    // binned file name
		    bvfile = `bin_${ext}_${v}`;
		    // make sure binned file eventually gets deleted
		    carr.push(bvfile);
		    // section specification consists of bin factor
		    sect = `0@0,0@0,${bin}`;
		    log("bin %s [%s]", ivfile, bin);
		    // extract a section at the specified bin factor
		    JS9.imsection(ivfile, bvfile, sect, "");
		    // add file to new input list
		    s += `${bvfile}\n`;
		}
	    }
	    // save in new image list file
	    JS9.vfile(binlst, s);
	    // call the Mosaic/mImgtbl routine
	    rstr = JS9.imgtbl(binlst, ".", bintbl, imsw);
	    // check for errors
	    chkerr("mImgtbl", rstr);
	    // make sure input table actually has FITS files
	    if( !JS9.vsize(bintbl) ){
		JS9.error("no image data found to construct a mosaic");
	    }
	    // make output header from binned images
	    rstr = JS9.makehdr(bintbl, outhdr, "");
	    // check for errors
	    chkerr("mMakeHdr", rstr);
	    // array of input images
	    inbuf = JS9.vread(bintbl);
	} else {
	    // shrink inhdr to make outhdr
	    rstr = JS9.shrinkhdr(opts.dim, inhdr, outhdr);
	    // check for errors
	    chkerr("mShrinkHdr", rstr);
	    // array of input images
	    inbuf = JS9.vread(intbl);
	}
	// ignore the first 3 header lines
	inarr = inbuf.trim().split("\n");
	inarr.splice(0,3);
	// reproject and generate output list from reprojected files
	s = `${line1}\n${line2}\n`;
	for(i=0; i<inarr.length; i++){
	    t = inarr[i].trim().split(/\s+/);
	    ext  = t[t.length-2];
	    vfile = t[t.length-1];
	    if( ext && vfile ){
		// we need the area file
		sw = "-a 1";
		if( opts.reduce === "shrink" ){
		    // pass extension number in switches
		    sw += ` -h ${ext}`;
		}
		// add global switches for reproject processing
		sw += ` ${JS9.globalOpts.reprojSwitches}`;
		// output filename
		v = vfile.split("/").reverse()[0].replace(/\.(g|f)z$/, "");
		ovfile = `reproj_${ext}_${v}`;
		// add to the output file list
		s += `${ovfile}\n`;
		// make sure it eventually gets deleted
		carr.push(ovfile);
		// make sure associated area file eventually gets deleted
		carr.push(ovfile.replace(/\.fits$/i, "_area.fits"));
		// call Montage/reproject
		log("reproject: %s [%s] -> %s", vfile, ext, ovfile);
		rstr = JS9.reproject(vfile, ovfile, outhdr, sw);
		// check for errors
		chkerr("mProjectPP", rstr);
	    }
	}
	// save output list in file
	JS9.vfile(outlst, s);
	// call the Mosaic/mImgtbl routine
	rstr = JS9.imgtbl(outlst, ".", outtbl, "");
	// check for errors
	chkerr("mImgtbl", rstr);
	// make sure input table has FITS files
	if( !JS9.vsize(outtbl) ){
	    JS9.error("no FITS files were added to output table for mosaic");
	}
	// make the mosaic
	log("create mosaic: %s", outfile);
	rstr = JS9.madd(outtbl, outhdr, outfile, "");
	// check for errors
	chkerr("mAdd", rstr);
	// cleanup temp files
	cleanup();
	// construct options
	topts = JS9.extend(true, {}, JS9.fits.options, opts);
	// we want the full image
	topts.image = {xdim: 0, ydim: 0};
	topts.file = outfile;
	// process the newly retrieved data as FITS
	JS9.fits.handleFITSFile(outfile, topts, disp);
    }, JS9.SPINOUT);
    // allow chaining
    return this;
};

// swap images in the images stack for this display
// used by the sortable routine to switch images in a stack
// for moving an element of an array:
// https://stackoverflow.com/questions/5306680/move-an-array-element-from-one-array-position-to-another
JS9.Display.prototype.moveImageInStack = function(from, to){
    let i, j, nfrom, nto;
    for(i=0, j=0; i<JS9.images.length; i++){
	if( JS9.images[i].display.id === this.id ){
	    if( from === j ){
		nfrom = i;
	    }
	    if( to === j ){
		nto = i;
	    }
	    j++;
	}
	if( JS9.notNull(nfrom) && JS9.notNull(nto) ){
	    JS9.images.splice(nto, 0, JS9.images.splice(nfrom, 1)[0]);
	    return;
	}
    }
};

// install extracted command/helper/webworker runtime
if( typeof JS9InstallHelperRuntime === "function" ){
    JS9InstallHelperRuntime(JS9);
} else {
    throw new Error("missing JS9InstallHelperRuntime");
}


// install shape engine abstraction
if( typeof JS9InstallShapeEngine === "function" ){
    JS9InstallShapeEngine(JS9);
} else {
    throw new Error("missing JS9InstallShapeEngine");
}

// install fabric-backed shape engine
if( typeof JS9InstallFabricEngine === "function" ){
    JS9InstallFabricEngine(JS9);
} else {
    throw new Error("missing JS9InstallFabricEngine");
}

/*
 * mouse/touch module (May 19, 2016)
 */

// create our namespace, and specify some meta-information and params
JS9.MouseTouch = {};
JS9.MouseTouch.CLASS = "JS9";       // class of plugin
JS9.MouseTouch.NAME = "MouseTouch"; // name of this plugin
JS9.MouseTouch.WIDTH =  512;	    // width of light window
JS9.MouseTouch.HEIGHT = 220;	    // height of light window
JS9.MouseTouch.BASE = JS9.MouseTouch.CLASS + JS9.MouseTouch.NAME;

JS9.MouseTouch.mouseText = [];
JS9.MouseTouch.mouseText[0] = "Move mouse, no buttons pressed:";
JS9.MouseTouch.mouseText[1] = "Move mouse, primary button pressed:";
JS9.MouseTouch.mouseText[2] = "Move mouse, secondary button pressed:";

JS9.MouseTouch.touchText = [];
JS9.MouseTouch.touchText[0] = "Touch move, with one finger:";
JS9.MouseTouch.touchText[1] = "Touch move, with two fingers:";
JS9.MouseTouch.touchText[2] = "Touch move, with three fingers:";

JS9.MouseTouch.textHTML="<div style='float: left'>%s</div>";

JS9.MouseTouch.actionHTML="<div style='float: left'><b>%s</b></div>";

// get an id based on the action
JS9.MouseTouch.actionid = function(cname, aname){
    return (`${cname}_${aname}`).replace(/[^A-Za-z0-9_]/g, "_");
};

// add to the text descriptions
JS9.MouseTouch.addText = function(container, text){
    let s, div, target;
    // create the html for this action
    s = sprintf(JS9.MouseTouch.textHTML, text);
    target = JS9.isWrappedCollection(container) ? container[0] : container;
    // add text html to the text container
    div = document.createElement("div");
    div.className = `${JS9.MouseTouch.BASE}Text`;
    div.innerHTML = s;
    target.appendChild(div);
    return JS9.wrapCollection(div);
};

// add to the sortable action list
JS9.MouseTouch.addAction = function(container, cname, aname){
    let s, id, div, target;
    id = JS9.MouseTouch.actionid(cname, aname);
    // create the html for this action
    s = sprintf(JS9.MouseTouch.actionHTML, aname);
    target = JS9.isWrappedCollection(container) ? container[0] : container;
    // add action html to the action container
    div = document.createElement("div");
    div.className = `${JS9.MouseTouch.BASE}Action`;
    div.id = id;
    div.innerHTML = s;
    target.appendChild(div);
    return JS9.wrapCollection(div);
};

// display value/position
// eslint-disable-next-line no-unused-vars
JS9.MouseTouch.isPinch = function(im, evt){
    let i, display, dist, pinc, pdec;
    const npinch = JS9.globalOpts.pinchWait;
    const pthresh = JS9.globalOpts.pinchThresh;
    // sanity check
    if( !im ){ return -1; }
    display = im.display;
    if( !JS9.globalOpts.mousetouchZoom || (im.pos.touches.length !== 2) ){
	return -1;
    }
    switch(display.ispinch ){
    case -1:
    case 1:
	return display.ispinch;
    }
    dist = Math.sqrt(((im.pos.touches[0].x - im.pos.touches[1].x)  *
		      (im.pos.touches[0].x - im.pos.touches[1].x))  +
		     ((im.pos.touches[0].y - im.pos.touches[1].y)  *
		      (im.pos.touches[0].y - im.pos.touches[1].y)));
    if( !display.dist0 ){
	 display.dist0 = dist;
    }
    display.deltas.push(Math.floor(dist - display.dist0));
    if( display.deltas.length >= npinch ){
	for(i=1, pinc=0, pdec=0; i<npinch; i++){
	    if(  display.deltas[i] > display.deltas[i-1] ){
		pinc++;
	    } else if(  display.deltas[i] < display.deltas[i-1] ){
		pdec++;
	    }
	}
	if( (pinc >= pthresh) || (pdec >= pthresh) ){
	    display.ispinch = 1;
	} else {
	    display.ispinch = -1;
	}
	display.lastzoom = 0;
	return display.ispinch;
    }
    // not sure yet
    return 0;
};

// ---------------------------------------------------------------------
//
// MouseTouch.Actions: callbacks when on mouse or touch movement
//
// for mouse: no click, primary click, secondary click
// for touch: 1, 2, or 3 fingers down
//
// the mouseActions and touchActions arrays in JS9.globalOpts determine
// the initial mapping of mouse/touch configuration to callback, e.g.:
//
//  JS9.globalOpts.mouseActions = ["display value/position", "change contrast/bias", "pan the image"];
//
// You can add your own to the Actions object, with titles in mouseText ...
// They are transferred to the display object.
//
// ---------------------------------------------------------------------
JS9.MouseTouch.Actions = {};

// display value/position
// eslint-disable-next-line no-unused-vars
JS9.MouseTouch.Actions["display value/position"] = function(im, ipos, evt){
    // special key: do nothing
    if( JS9.specialKey(evt) ){
	return;
    }
    // display pixel and wcs values
    if( JS9.globalOpts.internalValPos && im && ipos ){
	if( (ipos.x > 0) && (ipos.y > 0) &&
	    (ipos.x <= im.raw.width) && (ipos.y <= im.raw.height) ){
	    im.valpos = im.updateValpos(ipos, true);
	}
    }
};

// change contrast/bias
JS9.MouseTouch.Actions["change contrast/bias"] = function(im, ipos, evt){
    let x, y, pos, display;
    // skip contrast/bias change?
    if( !JS9.globalOpts.internalContrastBias || !im || !ipos ){
	return;
    }
    // skip if colormap is static
    if( im.cmapObj.type === "static" ){
	return;
    }
    // convenience variables
    display = im.display;
    // make sure we moved the mouse a bit
    if( im.pos0 && im.pos ){
	if( ((Math.abs(im.pos0.x-im.pos.x) < JS9.NOMOVE)  &&
	     (Math.abs(im.pos0.y-im.pos.y) < JS9.NOMOVE)) ){
	    return;
	}
    }
    // inside a region or with special key: no contrast/bias
    if( im.clickInRegion || JS9.specialKey(evt) ){
	return;
    }
    // if we have an RGB file or image overlay, no contrast/bias
    if( im.useOffScreenCanvas() ){
	return;
    }
    // get canvas position
    pos = JS9.eventToDisplayPos(evt, im.posOffset);
    // contrast/bias change
    x = Math.floor(pos.x + 0.5);
    y = Math.floor(pos.y + 0.5);
    // values only from within display window?
    if( JS9.globalOpts.containContrastBias ){
	if( (x < 0) || (y < 0) ||
	    (x >= display.canvas.width) || (y >= display.canvas.height) ){
	    return;
	}
    }
    im.params.bias = x / display.canvas.width;
    im.params.contrast = y / display.canvas.height * 10.0;
    // work-around for FF bug, not fixed as of 8/8/2012
    // https://bugzilla.mozilla.org/show_bug.cgi?id=732621
    if( JS9.bugs.firefox_linux ){
	window.setTimeout(() => {
	    im.displayImage("scaled", {blendMode: false});
	}, 0);
    } else {
	im.displayImage("scaled", {blendMode: false});
    }
    // hack: delete filterRGBImage from stash to avoid restore during reproject
    im.xeqStashDiscard("filterRGBImage");
    // extended plugins
    if( JS9.globalOpts.extendedPlugins ){
	im.xeqPlugins("image", "onchangecontrastbias");
    }
};

// stop action for contrast/bias: redisplay image
// eslint-disable-next-line no-unused-vars
JS9.MouseTouch.Actions["change contrast/bias"].stop = function(im, ipos, evt){
    // if blendMode is on, we have to redisplay
    if( im.display.blendMode ){
	im.displayImage("rgb");
    }
};

// zoom the image
JS9.MouseTouch.Actions["wheel zoom"] = function(im, evt){
    let ozoom, nzoom, maxzoom, key;
    let floor = JS9.globalOpts.panzoomRefreshLimit;
    let got = 0;
    const delta = evt.originalEvent.deltaY * Math.sign(JS9.DIRZOOM);
    // sanity check
    if( !im ){ return; }
    // is scroll to zoom turned on?
    if( !JS9.globalOpts.mousetouchZoom ){
	return;
    }
    // prevent pileup
    im.tmp.wheelzooms = im.tmp.wheelzooms || 0;
    if( im.tmp.wheelzooms++ % JS9.MODZOOM !== 0 ){
	return;
    }
    // current zoom
    ozoom = im.getZoom();
    // scroll by the delta
    if( delta < 0 ){
	nzoom = Math.min(JS9.MAXZOOM, ozoom + JS9.ADDZOOM);
    } else {
	nzoom = Math.max(JS9.MINZOOM, ozoom - JS9.ADDZOOM);
    }
    // stop zooming once full image is in the screen?
    if( JS9.globalOpts.mousetouchLimit ){
	maxzoom = Math.min(im.display.width/im.raw.width,
			   im.display.height/im.raw.height);
	if( maxzoom > nzoom && ozoom > nzoom ){
	    return;
	}
    }
    // a little rounding makes the zoom nicer
    nzoom = Math.round((nzoom + 0.00001) * 100) / 100;
    // see if any layers have many regions, thus requiring optimization
    for( key of Object.keys(im.layers) ){
	if( im.layers[key].show && im.layers[key].opts.panzoom ){
	    if( im.layers[key].canvas.size() > floor ){
		im.tmp.panzoomRefresh = im.tmp.panzoomRefresh || {};
		im.tmp.panzoomRefresh[key] = {};
		got++;
	    }
	}
    }
    // timeout to refresh layers
    if( im.tmp.panzoomTimeout ){
	clearTimeout(im.tmp.panzoomTimeout);
	delete im.tmp.panzoomTimeout;
    }
    if( got || im.tmp.panzoomRefresh ){
	im.tmp.panzoomTimeout = setTimeout(() => {
	    im.refreshLayers(im.tmp.panzoomRefresh);
	    delete im.tmp.panzoomRefresh;
	}, JS9.TIMEOUT);
    }
    // zoom the image
    im.setZoom(nzoom);
};

// pan the image
// eslint-disable-next-line no-unused-vars
JS9.MouseTouch.Actions["pan the image"] = function(im, ipos, evt){
    let dx, dy, temp, sect, pos, key;
    let thresh = JS9.globalOpts.panMouseThreshold;
    let floor = JS9.globalOpts.panzoomRefreshLimit;
    // sanity check
    if( !im ){ return; }
    sect = im.rgb.sect;
    // how much would we pan by?
    dx = ((im.pos0.x - im.pos.x) / sect.zoom);
    dy = ((im.pos0.y - im.pos.y) / sect.zoom);
    // pan the image (but avoid a redisplay, if we haven't moved much)
    if( Math.abs(dx) >= thresh || Math.abs(dy) >= thresh ){
	// flips will change the pan direction
	if( im.params.flip === "x" ){
	    dx = -dx;
	} else if( im.params.flip === "y" ){
	    dy = -dy;
	} else if( im.params.flip === "xy" ){
	    dx = -dx;
	    dy = -dy;
	}
	// rotations will change the pan direction
	if( im.params.rot90 === 90 ){
	    temp = dx;
	    dx = -dy;
	    dy = temp;
	} else if( im.params.rot90 === 180 ){
	    dx = -dx;
	    dy = -dy;
	} else if( im.params.rot90 === -90 ){
	    temp = dx;
	    dx = dy;
	    dy = -temp;
	}
	pos = {x: sect.xcen + dx, y: sect.ycen - dy};
	// rotations will change the pan position
	if( im.params.rotate ){
	    pos = JS9.rotatePoint(pos,
				  -im.params.rotate,
				  {x: sect.xcen, y: sect.ycen});
	}
	// see if any layers have many regions, thus requiring optimization
	for( key of Object.keys(im.layers) ){
	    if( im.layers[key].show && im.layers[key].opts.panzoom ){
		if( im.layers[key].canvas.size() > floor ){
		    im.tmp.panzoomRefresh = im.tmp.panzoomRefresh || {};
		    im.tmp.panzoomRefresh[key] = {};
		}
	    }
	}
	im.setPan(pos);
	// reset initial position
	im.pos0 = im.pos;
    }
};

// pinch zoom
// eslint-disable-next-line no-unused-vars
JS9.MouseTouch.Actions.pinch = function(im, ipos, evt){
    let display, dist, nzoom;
    // sanity check
    if( !im ){ return; }
    // is scroll to zoom turned on?
    display = im.display;
    // get current distance
    dist = Math.sqrt(((im.pos.touches[0].x - im.pos.touches[1].x)  *
		      (im.pos.touches[0].x - im.pos.touches[1].x)) +
		      ((im.pos.touches[0].y - im.pos.touches[1].y)  *
		       (im.pos.touches[0].y - im.pos.touches[1].y)));
    nzoom = display.zoom0 * dist / display.dist0;
    // a little rounding makes the zoom nicer
    nzoom = Math.max(JS9.MINZOOM, Math.min(JS9.MAXZOOM, Math.round((nzoom + 0.00001) * 100) / 100));
    // zoom the image
    if( nzoom !== display.lastzoom ){
	im.setZoom(nzoom);
    }
    display.lastzoom = nzoom;
};

// start of mouse/touch action processing
JS9.MouseTouch.Actions.start = function(im, ipos, evt){
    let display, action;
    if( im ){
	display = im.display;
	display.ispinch = 0;
	display.dist0 = 0;
	display.zoom0 = im.rgb.sect.zoom;
	display.deltas = [];
    }
    action = JS9.MouseTouch.getAction(im, evt);
    // call the start mouse/touch action, if necessary
    if( JS9.MouseTouch.Actions[action] &&
	JS9.MouseTouch.Actions[action].start ){
	JS9.MouseTouch.Actions[action].start(im, im.ipos, evt);
    }
};

// end of mouse/touch action processing
JS9.MouseTouch.Actions.stop = function(im, ipos, evt){
    const action = JS9.MouseTouch.getAction(im, evt);
    // call the stop mouse/touch action, if necessary
    if( JS9.MouseTouch.Actions[action] &&
	JS9.MouseTouch.Actions[action].stop ){
	JS9.MouseTouch.Actions[action].stop(im, im.ipos, evt);
    }
    return;
};

// get action associated with the current clickState
JS9.MouseTouch.getAction = function(im, evt){
    let action, display;
    // sanity check
    if( !im ){ return action; }
    display = im.display;
    switch(im.clickState){
	// mouse move actions
    case 0:
	action = display.mouseActions[0];
	break;
    case 1:
	action = display.mouseActions[1];
	break;
    case 2:
	action = display.mouseActions[2];
	break;
	// touch event actions
    case -1:
	action = display.touchActions[0];
	break;
    case -2:
	switch( JS9.MouseTouch.isPinch(im, evt) ){
	case -1:
	    action = display.touchActions[1];
	    break;
	case 0:
	    // do nothing, no idea if its a pinch yet
	    break;
	case 1:
	    action = "pinch";
	    break;
	}
	break;
    case -3:
	action = display.touchActions[2];
	break;
    default:
	break;
    }
    return action;
};

// execute the mouse/touch action routine
JS9.MouseTouch.action = function(im, evt, action){
    action = action || JS9.MouseTouch.getAction(im, evt);
    // call the mouse/touch action
    if( action && JS9.MouseTouch.Actions[action] ){
	JS9.MouseTouch.Actions[action](im, im.ipos, evt);
    }
};

// change zoom mode for this display
JS9.MouseTouch.mousetouchzoom = function(id, target){
    const display = JS9.lookupDisplay(id);
    const mode = target.checked;
    // change global blink mode
    if( display ){
	JS9.globalOpts.mousetouchZoom = mode;
    }
};

// constructor: add HTML elements to the plugin
JS9.MouseTouch.init = function(){
    let i, s;
    const makeNode = (tag, opts={}) => {
	const node = document.createElement(tag);
	if( opts.className ){
	    node.className = opts.className;
	}
	if( opts.id ){
	    node.id = opts.id;
	}
	if( opts.html !== undefined ){
	    node.innerHTML = opts.html;
	}
	if( opts.style ){
	    Object.keys(opts.style).forEach((key) => {
		node.style[key] = opts.style[key];
	    });
	}
	if( opts.parent ){
	    opts.parent.appendChild(node);
	}
	return node;
    };
    // on entry, these elements have already been defined:
    // this.div:      the DOM element representing the div for this plugin
    // this.divjq:    the wrapped div representing this plugin
    // this.id:       the id of the div (or the plugin name as a default)
    // this.display:  the display object associated with this plugin
    // this.dispMode: display mode (for internal use)
    //
    // create container to hold action container and header
    // clean main container
    this.divjq.html("");
    // allow scrolling on the plugin
    this.divjq.addClass("JS9PluginScrolling");
    // main container
    this.mousetouchContainer = JS9.wrapCollection(makeNode("div", {
	className: `${JS9.MouseTouch.BASE}Container`,
	id: `${this.id}MouseTouchContainer`,
	parent: this.div
    }));
    s = sprintf("<div class='%s'><span><b>Drag an action to reconfigure JS9 mouse/touch events:</b></span><p>", `${JS9.MouseTouch.BASE}Header`);
    this.mousetouchHeadContainer = JS9.wrapCollection(makeNode("span", {
	className: `${JS9.MouseTouch.BASE}Container`,
	id: `${this.id}MouseTouchHeadContainer`,
	html: s,
	style: {float: "left"},
	parent: this.mousetouchContainer[0]
    }));
    this.mousetouchTextContainer = JS9.wrapCollection(makeNode("span", {
	className: `${JS9.MouseTouch.BASE}Container`,
	id: `${this.id}MouseTouchTextContainer`,
	style: {float: "left"},
	parent: this.mousetouchContainer[0]
    }));
    this.mousetouchActionContainer = JS9.wrapCollection(makeNode("span", {
	className: `${JS9.MouseTouch.BASE}Container`,
	id: `${this.id}MouseTouchActionContainer`,
	style: {float: "left"},
	parent: this.mousetouchContainer[0]
    }));
    if( JS9.TOUCHSUPPORTED ){
	// container to hold text descriptions
	this.mousetouchTouchTextContainer = JS9.wrapCollection(makeNode("div", {
	    className: `${JS9.MouseTouch.BASE}TextContainer`,
	    id: `${this.id}TouchTextContainer`,
	    html: "",
	    parent: this.mousetouchTextContainer[0]
	}));
	for(i=0; i<JS9.MouseTouch.touchText.length; i++){
            JS9.MouseTouch.addText.call(this,
					this.mousetouchTouchTextContainer,
					JS9.MouseTouch.touchText[i]);
	}
	for(i=JS9.MouseTouch.touchText.length;
	    i<this.display.touchActions.length ; i++){
            JS9.MouseTouch.addText.call(this,
					this.mousetouchTouchTextContainer,
					"&nbsp;");
	}
	// container to hold touch actions
	this.mousetouchTouchContainer = JS9.wrapCollection(makeNode("div", {
	    className: `${JS9.MouseTouch.BASE}ActionContainer`,
	    id: `${this.id}TouchContainer`,
	    html: "",
	    parent: this.mousetouchActionContainer[0]
	}));
	// add touch actions, if necessary
	for(i=0; i<this.display.touchActions.length; i++){
	    s = this.display.touchActions[i];
            JS9.MouseTouch.addAction.call(this, this.mousetouchTouchContainer,
					  "touch", s);
	}
	// the actions within the action container will be sortable
	JS9.enableDragSort(this.mousetouchTouchContainer, {
	    start: ({oldIndex}) => {
		this.oidx = oldIndex;
	    },
	    stop: ({newIndex}) => {
		const oarr = this.display.touchActions.splice(this.oidx, 1)[0];
		// JS9 action list reflects the sort
		this.display.touchActions.splice(newIndex, 0, oarr);
		delete this.oidx;
	    }
	});
    }
    if(  !/iPad|iPhone|iPod/.test(navigator.platform) ){
	// container to hold text descriptions
	this.mousetouchMouseTextContainer = JS9.wrapCollection(makeNode("div", {
	    className: `${JS9.MouseTouch.BASE}TextContainer`,
	    id: `${this.id}MouseTextContainer`,
	    parent: this.mousetouchTextContainer[0]
	}));
	for(i=0; i< 3; i++){
            JS9.MouseTouch.addText.call(this,
					this.mousetouchMouseTextContainer,
					JS9.MouseTouch.mouseText[i]);
	}
	for(i=3; i<this.display.mouseActions.length ; i++){
            JS9.MouseTouch.addText.call(this,
					this.mousetouchMouseTextContainer,
					"&nbsp;");
	}
	// container to hold mouse actions
	this.mousetouchMouseContainer = JS9.wrapCollection(makeNode("div", {
	    className: `${JS9.MouseTouch.BASE}ActionContainer`,
	    id: `${this.id}MouseContainer`,
	    html: "",
	    parent: this.mousetouchActionContainer[0]
	}));
	// add mouse actions, if necessary
	for(i=0; i<this.display.mouseActions.length; i++){
	    s = this.display.mouseActions[i];
            JS9.MouseTouch.addAction.call(this, this.mousetouchMouseContainer,
					  "mouse", s);
	}
	// the actions within the action container will be sortable
	JS9.enableDragSort(this.mousetouchMouseContainer, {
	    start: ({oldIndex}) => {
		this.oidx = oldIndex;
	    },
	    stop: ({newIndex}) => {
		const oarr = this.display.mouseActions.splice(this.oidx, 1)[0];
		// JS9 action list reflects the sort
		this.display.mouseActions.splice(newIndex, 0, oarr);
		delete this.oidx;
	    }
	});
    }
    // add the footer, containing buttons
    s = sprintf("<p><div class='%s'>Use mouse wheel or pinch to zoom:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<input type='checkbox' value='1' onclick='javascript:JS9.MouseTouch.mousetouchzoom(\"%s\", this);'></div>", `${JS9.MouseTouch.BASE}Footer`, this.display.id);
    this.mousetouchFootContainer = JS9.wrapCollection(makeNode("span", {
	className: `${JS9.MouseTouch.BASE}Container`,
	id: `${this.id}MouseTouchFootContainer`,
	html: s,
	style: {float: "left"},
	parent: this.mousetouchContainer[0]
    }));
    // set initial value of scroll
    if( JS9.globalOpts.mousetouchZoom ){
	const checkbox = this.mousetouchContainer[0].querySelector("input");
	if( checkbox ){
	    checkbox.checked = true;
	}
    }
};


// ---------------------------------------------------------------------
// Regions object defines high level calls for Regions plugin
// ---------------------------------------------------------------------

JS9.Regions = {};
JS9.Regions.CLASS = "JS9";
JS9.Regions.NAME = "Regions";

// defaults for new regions
JS9.Regions.opts = {
    // update WCS strings
    updateWCS: true,
    // pan and zoom enabled
    panzoom: true,
    tags: "source,include",
    strokeWidth: 2,
    ptStrokeWidth: 1,
    // annuli: inner and outer radius, number of annuli
    iradius: 15,
    oradius: 30,
    nannuli: 1,
    // box
    width: 60,
    height: 60,
    // circle
    radius: 30,
    // ellipse:
    // use r1, r2 to avoid confusion with rad1, rad2 for rounding in boxes!
    r1: 30,
    r2: 20,
    // point
    ptshape: "box",
    ptsize: 2,
    // line
    linepoints: [{x: -30, y: 30}, {x:30, y:-30}],
    // polygon in display coords
    // points: [{x: -30, y: 30}, {x:30, y:30}, {x:30, y:-30}, {x:-30, y: -30}],
    polypoints: [{x: -30, y: 30}, {x:30, y:30}, {x:0, y:-30}],
    // text
    // fontFamily: "Helvetica, sans-serif",
    fontFamily: "Helvetica",
    fontSize: 14,
    fontStyle: "normal",
    fontWeight: 300,
    textAlign: "left",
    // angles (box, ellipse)
    angle: 0,
    // anchor radii
    aradius1: 4,
    aradius2: 8,
    // region configuration url
    configURL: "./params/regionsconfig.html",
    // region save url
    saveURL: "./params/regionssave.html",
    // should overlapping shapes be sorted (smallest on top)?
    sortOverlapping: true,
    // title for region config dialog box
    title: "Edit region",
    // no centered scaling for these regions
    noCenteredScaling: ["box", "line"],
    // colors for tags
    // these should be ordered from more specific to less specific
    tagcolors: {
	include_source:     "#00FF00",
	exclude_source:     "#FF0000",
	include_background: "#FFD700",
	exclude_background: "#FF8C00",
	source:             "#00FF00",
	background:         "#FFD700",
	defcolor:           "#00FF00"
    },
    // mouse double-click processing
    onmousedblclick(im, xreg, evt, target){
	let params = target.params;
	if( (params && !params.winid && !params.ignore )             ||
	    (!params && target.type === "activeSelection")           ||
	    (!params && target.type === "group")                     ){
	    if( JS9.globalOpts.editRegions ){
		im.displayRegionsForm(target);
	    }
	}
	return;
    },
    // mouse down processing
    onmousedown(im, xreg, evt, target){
	let poly;
	// nb: target might be a polygon anchor => no params
	let params = target.params;
	if( JS9.specialKey(evt) ){
	    if( params ){
		im._regroupAnnulus(params.layerName, evt);
	    }
	    if( target.type === "polygon" || target.type === "polyline" ){
		// add polygon point
		im._addPolygonPoint(params.layerName, target, evt);
		im._updateShape(params.layerName, target, null, "update");
	    } else if( target.polyparams && target.polyparams.polygon  ){
		// remove polygon point
		poly = target.polyparams.polygon;
		im._removePolygonPoint(poly.params.layerName, target);
		im._updateShape(poly.params.layerName, poly, null, "update");
	    } else if( params && params.shape === "annulus" ){
		im._ungroupAnnulus(params.layerName, target);
	    }
	}
    },
    // mouse up processing
    onmouseup(){
	let i;
	let objs = [];
	// one active object
	if( this.getActiveObject() ){
	    objs.push(this.getActiveObject());
	}
	objs.push(this.getActiveObjects());
	// re-select polygon which was just processed
	for(i=0; i<objs.length; i++){
	    if( objs[i].polyparams ){
		this.setActiveObject(objs[i].polyparams.polygon);
	    }
	}
    },
    // global onchange callback
    onchange: null
};

// plugin init: load our regions methods
JS9.Regions.init = function(layerName){
    let dlayer;
    // get layer name
    layerName = layerName || "regions";
    // add to image prototypes
    JS9.Image.prototype.parseRegions = JS9.Regions.parseRegions;
    JS9.Image.prototype.saveRegions = JS9.Regions.saveRegions;
    JS9.Image.prototype.listRegions = JS9.Regions.listRegions;
    JS9.Image.prototype.copyRegions = JS9.Regions.copyRegions;
    JS9.Image.prototype.changeRegionTags = JS9.Regions.changeRegionTags;
    JS9.Image.prototype.toggleRegionTags = JS9.Regions.toggleRegionTags;
    JS9.Image.prototype.unremoveRegions = JS9.Regions.unremoveRegions;
    JS9.Image.prototype.initRegionsForm = JS9.Regions.initConfigForm;
    JS9.Image.prototype.displayRegionsForm = JS9.Regions.displayConfigForm;
    JS9.Image.prototype.processRegionsForm = JS9.Regions.processConfigForm;
    // init the display shape layer
    dlayer = this.display.newShapeLayer(layerName, JS9.Regions.opts);
    // mouse up: list regions, if necessary
    dlayer.canvas.on("mouse:up", () => {
	let i, tim;
	let objs = [];
	if( dlayer.display.image ){
	    tim = dlayer.display.image;
	    // one active object
	    // group of active objects
	    objs.push(dlayer.canvas.getActiveObjects());
	    // process all active objects
	    for(i=0; i<objs.length; i++){
		if( objs[i].params ){
		    if( tim.params.listonchange ){
			if( tim.params.whichonchange === "all" ){
			    tim.listRegions("all", {mode: 2});
			} else {
			    tim.listRegions("selected", {mode: 2});
			}
		    } else if( objs[i].params.listonchange ){
			tim.listRegions("selected", {mode: 2});
		    }
		    break;
		}
	    }
	}
    });
    return this;
};

// display the region config form
// call using image context
JS9.Regions.displayConfigForm = function(shape, opts){
    let s, winformat;
    let got = 0;
    let title = JS9.Regions.opts.title;
    let multiNode;
    let winidNode;
    let imageNode;
    // sanity check
    if( !this ){ return; }
    // opts is optional
    opts = opts || {};
    // if there are no regions involved, make this a multi-select edit
    if( !shape ){
	// need at least one shape to edit
	if( !this.getShapes("regions").length ){
	    return;
	}
    }
    // which type of dialog box?
    opts.type = opts.type || "config";
    switch(opts.type){
    case "save":
	if( JS9.allinone ){
	    s = JS9.allinone.regionsSaveHTML;
	} else {
	    s = JS9.InstallDir(JS9.Regions.opts.saveURL);
	}
	// adjust title
	title = "Save regions";
	// adjust size of window
	winformat = JS9.lightOpts[JS9.LIGHTWIN].regWin1;
	break;
    case "config":
    default:
	if( JS9.allinone ){
	    s = JS9.allinone.regionsConfigHTML;
	} else {
	    s = JS9.InstallDir(JS9.Regions.opts.configURL);
	}
	if( !shape                                              ||
	    (!shape.params && shape.type === "activeSelection") ||
	    (!shape.params && shape.type === "group")           ){
	    opts.multi = true;
	}
	break;
    }
    // if a multi select form already exists, just update it
    if( opts.multi ){
	document.querySelectorAll("form.regionsConfigForm").forEach((element) => {
	    multiNode = element._js9Multi;
	    winidNode = element._js9Winid;
	    imageNode = element._js9Image;
	    if( multiNode === undefined ){
		multiNode = JS9.wrapCollection(element).data("multi");
	    }
	    if( !winidNode ){
		winidNode = JS9.wrapCollection(element).data("winid");
	    }
	    if( imageNode === undefined ){
		imageNode = JS9.wrapCollection(element).data("im");
	    }
	    if( multiNode && winidNode && imageNode === this ){
		opts.winid = winidNode;
		imageNode.initRegionsForm(null, opts);
		got++;
	    }
	});
	// change title to reflect multi-select, if necessary
	title = title.replace(/regions?/, "selected regions");
	// all done if we reinit'ed an existing window
	if( got ){ return; }
    }
    // call this once window is loaded
    JS9.onElementAvailable(JS9.lightOpts[JS9.LIGHTWIN].topid,
			   ".regionsConfigForm", () => {
	opts.firsttime = true;
	if( shape && shape.params ){
	    this.updateShapes("regions", shape, "wcsconfig");
	}
	this.initRegionsForm(shape, opts);
    });
    // bring up display window
    opts.winid = this.displayAnalysis("regions", s, {title, winformat});
    // save winid, if possible
    if( shape && shape.params ){
	shape.params.winid = opts.winid;
    }
};

JS9.Regions.saveWCSRadio = function(target, value){
    const form = target && target.closest ? target.closest("form") : null;
    const input = form ? form.querySelector("[name='savewcs']") : null;
    if( input ){
	input.value = value;
	JS9.wrapCollection(input).trigger("change");
    }
};

// initialize the region config form
// call using image context
JS9.Regions.initConfigForm = function(obj, opts){
    let i, key, val, el, el2, wcssys, twcssys, mover, mout, p1, p2, cmode;
    let s, s2, s3, s4, winid, wid, form, otitle, fav, arr, ao, grp, o, objs;
    let multi = false;
    let formNode, winNode;
    const wcsinfo = this.raw.wcsinfo || {cdelt1: 1, cdelt2: 1};
    const defobj = {
	type: "multi",
	pub: {shape: "multi", wcsconfig: {}},
	params: {}
    };
    const fmt= (val) => {
	if( val === undefined ){
	    return undefined;
	}
	if( (typeof val === "number") && (val % 1 !== 0) ){
	    val = Math.round((val + 0.00001) * 10000) / 10000;
	}
	return(String(val));
    };
    const replaceNewline = (s) => {
	const nl = String.fromCharCode(13, 10);
	if( typeof s === "string" ){
	    return s.replace(/\\n/g, nl);
	}
	return s;
    };
    const getMeta = (key, fallback) => {
	if( formNode && formNode[key] !== undefined ){
	    return formNode[key];
	}
	return fallback;
    };
    const formjq = () => JS9.wrapCollection(formNode);
    const formItems = (selector) => JS9.wrapCollection(`${form}${selector}`);
    const wrapItem = (value) => JS9.wrapCollection(value);
    // which wcssys do we use? edit version, if available
    if( obj && obj.pub ){
	if( obj.pub.wcsconfig && obj.pub.wcsconfig.wcssys  ){
	    wcssys = obj.pub.wcsconfig.wcssys;
	} else {
	    wcssys = this.params.wcssys;
	}
    } else {
	wcssys = this.params.wcssys;
	// fake obj: makes the checks easier, avoid if( obj ... ) everywhere
	obj = defobj;
    }
    cmode = obj.params.changeable === false;
    // opts is optional
    opts = opts || {};
    // where to we get winid?
    if( obj.params.winid ){
	winid = obj.params.winid;
    } else if( opts.winid ){
	winid = opts.winid;
    }
    // window id is required
    if( !winid ){
	return;
    }
    // find the form, based on winid
    winNode = JS9.resolveNode(winid);
    wid = winNode && winNode.id;
    formNode = winNode && winNode.querySelector(".regionsConfigForm");
    // leave trailing space!
    form = `#${wid} .regionsConfigForm `;
    // valid form is required
    if( !wid || !formNode ){
	return;
    }
    // if the form is already a multi-select form, keep it that way
    if( formNode._js9Multi ){
	multi = true;
    } else {
	multi = opts.multi;
    }
    // remove the nodisplay class from shape's div
    formItems(`.${obj.pub.shape}`).each((index, element) => {
	wrapItem(element).removeClass("nodisplay");
    });
    // fill in form values based on current values in the shape object
    formItems(".val").each((index, element) => {
	val = "";
	key = wrapItem(element).attr("name");
	// key-specific pre-processing
	switch(key){
	case "x":
	case "y":
	    if( obj.pub.lcs && obj.pub.lcs[key] !== undefined ){
		val = fmt(obj.pub.lcs[key]);
	    } else if( obj.pub[key] !== undefined ){
		val = fmt(obj.pub[key]);
	    }
	    break;
	case "radii":
	    if( obj.pub.radii ){
		if( JS9.notWCS(wcssys)        ||
		    !obj.pub.wcsconfig        ||
		    !obj.pub.wcsconfig.wcsstr ){
		    val = obj.pub.imstr
			.replace(/^annulus\(/,"").replace(/\)$/,"")
			.split(",").slice(2).join(",");
		} else {
		    val = obj.pub.wcsconfig.wcsstr
			.replace(/^annulus\(/,"").replace(/\)$/,"")
			.split(",").slice(2).join(",");
		}
	    }
	    break;
	case "pts":
	    if( obj.pub.pts ){
		obj.pub.pts.forEach( (p) => {
		    if( val ){
			val += ", ";
		    }
		    val += `${p.x.toFixed(2)}, ${p.y.toFixed(2)}`;
		});
	    } else if( obj.pub.imstr ){
		// use the flat points list instead of the pts object array
		val = obj.pub.imstr.replace(/^.*\(/, "").replace(/\)$/, "");
	    }
	    break;
	case "linelength":
	    if( obj.pub.pts && obj.pub.pts.length === 2 ){
		p1 = obj.pub.pts[0];
		p2 = obj.pub.pts[1];
		val = fmt(Math.sqrt((p2.x - p1.x) * (p2.x - p1.x) +
				    (p2.y - p1.y) * (p2.y - p1.y)));
		switch(wcssys){
		case "image":
		case "physical":
		    break;
		default:
		    val *= Math.abs(wcsinfo.cdelt1);
		    val *= Math.abs(wcsinfo.cdelt2);
		    break;
		}
		val = fmt(val);
		this.tmp.linelength = val;
	    }
	    break;
	case "lineangle":
	    if( obj.pub.pts && obj.pub.pts.length === 2 ){
		p1 = obj.pub.pts[0];
		p2 = obj.pub.pts[1];
		val = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
		while( val < 0 ){ val += 360; }
		val = fmt(val);
		this.tmp.lineangle = val;
	    }
	    break;
	case "fontFamily":
	    if( obj.getFontFamily ){
		val = obj.getFontFamily();
	    }
	    break;
	case "fontSize":
	    if( obj.getFontSize ){
		val = obj.getFontSize();
	    }
	    break;
	case "fontStyle":
	    if( obj.getFontStyle ){
		val = obj.getFontStyle();
	    }
	    break;
	case "fontWeight":
	    if( obj.getFontWeight ){
		val = obj.getFontWeight();
	    }
	    break;
	case "colorPicker":
	    if( obj.pub.color !== undefined ){
		val = JS9.colorToHex(obj.pub.color);
	    } else {
		val = getMeta("_js9Colorpicker", undefined) ||
		    JS9.globalOpts.defcolor;
	    }
	    break;
	case "color":
	    // multi: don't set color to avoid applying it to new selections
	    if( !multi ){
		if( obj.pub.color !== undefined ){
		    val = fmt(obj.pub.color);
		} else if( getMeta("_js9Colorpicker", undefined) ){
		    val = formNode._js9Colorpicker;
		}
	    }
	    break;
	case "strokeWidth":
	    if( obj.params.sw1 ){
		val = obj.params.sw1;
	    } else {
		val = getMeta("_js9Strokewidth", "") || "";
	    }
	    break;
	case "strokeDashes":
	    if( obj.strokeDashArray ){
		val = obj.strokeDashArray.join(" ");
		if( val.match(/NaN/) ){
		    val = "";
		}
	    } else {
		val = getMeta("_js9Strokedashes", "") || "";
	    }
	    break;
	case "regstr":
	    if( JS9.notWCS(wcssys)        ||
		!obj.pub.wcsconfig        ||
		!obj.pub.wcsconfig.wcsstr ){
		val = `${obj.pub.imsys};${obj.pub.imstr}`;
	    } else {
		val = `${obj.pub.wcsconfig.wcssys};${obj.pub.wcsconfig.wcsstr}`;
	    }
	    break;
	case "xpos":
	    switch(wcssys){
	    case "image":
		if( obj.pub.preservedcoords && obj.pub.dx !== undefined ){
		    val = sprintf("d%.1f", obj.pub.dx);
		} else if( obj.pub.x !== undefined ){
		    val = sprintf("%.1f", obj.pub.x);
		}
		break;
	    case "physical":
		if( obj.pub.lcs ){
		    val = sprintf("%.1f", obj.pub.lcs.x);
		} else if( obj.pub.x !== undefined ){
		    val = sprintf("%.1f", obj.pub.x);
		}
		break;
	    default:
		if( obj.pub.wcsconfig && JS9.notNull(obj.pub.wcsconfig.ra) ){
		    val = sprintf("%.6f", obj.pub.wcsconfig.ra);
		} else if( obj.pub.x !== undefined ){
		    val = sprintf("%.1f", obj.pub.x);
		}
		break;
	    }
	    formItems(`[name='${key}']`).prop("readonly", cmode);
	    break;
	case "ypos":
	    switch(wcssys){
	    case "image":
		if( obj.pub.preservedcoords && obj.pub.dy !== undefined ){
		    val = sprintf("d%.1f", obj.pub.dy);
		} else if( obj.pub.y !== undefined ){
		    val = sprintf("%.1f", obj.pub.y);
		}
		break;
	    case "physical":
		if( obj.pub.lcs ){
		    val = sprintf("%.1f", obj.pub.lcs.y);
		} else if( obj.pub.y !== undefined ){
		    val = sprintf("%.1f", obj.pub.y);
		}
		break;
	    default:
		if( obj.pub.wcsconfig && JS9.notNull(obj.pub.wcsconfig.dec) ){
		    val = sprintf("%.6f", obj.pub.wcsconfig.dec);
		} else if( obj.pub.y !== undefined ){
		    val = sprintf("%.1f", obj.pub.y);
		}
		break;
	    }
	    formItems(`[name='${key}']`).prop("readonly", cmode);
	    break;
	case "radius":
	case "oradius":
	case "length":
	case "width":
	case "r1":
	    switch(wcssys){
	    case "image":
		if( obj.pub[key] !== undefined ){
		    val = fmt(obj.pub[key]);
		}
		break;
	    case "physical":
		if( obj.pub.lcs && obj.pub.lcs[key] !== undefined ){
		    val = fmt(obj.pub.lcs[key]);
		}
		break;
	    default:
		if( obj.pub.wcsconfig                         &&
		    JS9.notNull(obj.pub.wcsconfig.wcssizestr) ){
		    val = fmt(obj.pub.wcsconfig.wcssizestr[0]);
		} else if( obj.pub[key] !== undefined ){
		    val = fmt(obj.pub[key]);
		}
		break;
	    }
	    formItems(`[name='${key}']`).prop("readonly", cmode);
	    break;
	case "height":
	case "r2":
	    switch(wcssys){
	    case "image":
		if( obj.pub[key] !== undefined ){
		    val = fmt(obj.pub[key]);
		}
		break;
	    case "physical":
		if( obj.pub.lcs && obj.pub.lcs[key] !== undefined ){
		    val = fmt(obj.pub.lcs[key]);
		}
		break;
	    default:
		if( obj.pub.wcsconfig                         &&
		    JS9.notNull(obj.pub.wcsconfig.wcssizestr) ){
		    val = fmt(obj.pub.wcsconfig.wcssizestr[1]);
		} else if( obj.pub[key] !== undefined ){
		    val = fmt(obj.pub[key]);
		}
		break;
	    }
	    formItems(`[name='${key}']`).prop("readonly", cmode);
	    break;
	case "wcssys":
	case "savewcs":
	    // add all wcs sys options
	    el = formjq().find(`[name='${key}']`);
	    if( !el.find("option").length ){
		for(i=0; i<JS9.wcssyss.length; i++){
		    el.append(`<option>${JS9.wcssyss[i]}</option>`);
		}
	    }
	    if( key === "savewcs" ){
		twcssys = JS9.globalOpts.regSaveWCS || wcssys;
	    } else {
		twcssys = wcssys;
	    }
	    el.find("option").each((index, element) => {
		if( twcssys === element.value ){
		    val = element.value;
		}
	    });
	    break;
	case "wcsunits":
	    if( obj.pub.wcsunits ){
		val = obj.pub.wcsunits;
	    }
	    break;
	case "childtext":
	    if( obj.params.children && obj.params.children.length > 0 ){
		val = replaceNewline(obj.params.children[0].obj.text);
	    }
	    break;
	case "text":
	    if( obj.pub[key] !== undefined ){
		val = replaceNewline(fmt(obj.pub[key]));
	    }
	    break;
	case "id":
	    if( multi ){
		val = "selected";
	    } else if( obj.pub.id !== undefined ){
		val = String(obj.pub.id);
		// set width of text input to be width of string
		wrapItem(element).css("width", `${val.length}ch`);
	    }
	    break;
	case "tags":
	    if( obj.pub[key] !== undefined ){
		val = fmt(obj.pub[key]);
	    }
	    break;
	case "savefile":
	    val = getMeta("_js9Savefile", undefined) ||
		  this.tmp.saveregionsFile   ||
		  "js9.reg";
	    break;
	case "selectfilter":
	    val = getMeta("_js9Selectfilter", undefined);
	    break;
	case "selectshape":
	case "selectcolor":
	case "selecttag":
	case "selectwcs":
	case "selectgroup":
	    JS9.Regions.regionsConfigSetSelectMenu(this, formjq(), key);
	    break;
	default:
	    if( obj.pub[key] !== undefined ){
		val = fmt(obj.pub[key]);
	    }
	    break;
	}
	wrapItem(element).val(val);
    });
    // display or hide options
    if( multi || !this.raw.wcs || this.raw.wcs < 0 ){
	formjq().find("[name='wcssys']").hide();
    }
    // edit-able parameters
    // child text display for shapes, editable if no existing children yet
    if( obj.type !== "text" && obj.params.children ){
	formItems(".childtext").removeClass("nodisplay");
    }
    // init options, if necessary
    if( opts.firsttime ){
	// multi "cur" works off selected, not current, regions
	if( multi ){
	    formjq().find("label[for='savecur']")
		.text("sel");
	    formjq().find("input[id='savecur']")
		.data("tooltip", "save selected regions");
	    formjq().find("[id='selectreg']")
		.prop("checked", true);
	} else {
	    formjq().find(".checkboxes").removeClass("nodisplay");
	}
	// add wcs button options
	if( JS9.favorites.wcs && JS9.favorites.wcs.length ){
	    // display wcs buttons
	    el = formjq().find(".rwcsbuttons").removeClass("nodisplay");
	    // add buttons to button container, if necessary
	    el2 = el.find(".rwcsbuttoncontainer");
	    if( el2.length && !el2.find(".rwcsbutton").length ){
		// add radio buttons for each favorite wcs
		for(i=0; i<JS9.favorites.wcs.length; i++){
		    fav = JS9.favorites.wcs[i];
		    if( typeof fav === "string" ){
			// format: "wcs:displayedname"
			arr = fav.split(":");
		    } else {
			// format: ["wcs", "displayedname"]
			arr = fav;
		    }
		    s =  arr[0];
		    s2 = arr[1] || s;
		    if( opts.type === "save" ){
			s3 = `rsavecol_R${i+2}`;
			s4 = "rsaveradio";
		    } else {
			s3 = `rconfigcol_R${i+2}`;
			s4 = "rconfigradio";
		    }
		    el2.append(`<span class='rconfigcol_R rwcsbutton ${s3}'>
                                <input type='radio'
                                       id='rwcsbutton_${s}'
                                       name='rwcsbutton'
                                       class='rwcsradio ${s4}}'
                                       value='${s}'
                                       data-tooltip='save using ${s} wcs'
                                       onclick='JS9.Regions.saveWCSRadio(this, "${s}")'>
                                <label for='rwcsbutton_${s}'>${s2}</label>
                                </span>`);
		}
		// init the radio buttons
		formjq().find('.rwcsbuttons').find(`[value='${wcssys}']`)
		    .prop('checked', true);
	    }
	}
	// alternate colorpicker
	if( !JS9.globalOpts.internalColorPicker ||
	    !JS9.supportsInputType("color") ){
	    el = formNode.querySelector(`input[name='colorPicker']`);
	    JS9.setupColorInputs(el, {
		onMove: ({color}) => {
		    const value = color.toHexString();
		    formjq().find("input[name='color']").val(value);
		    formNode._js9Colorpicker = value;
		}
	    });
         }
    }
    // checkboxes
    if( obj.params.listonchange === undefined ){
	obj.params.listonchange = false;
    }
    if( obj.params.listonchange ){
	formItems(`[name='listonchange']`).prop("checked", true);
    } else {
	formItems(`[name='listonchange']`).prop("checked", false);
    }
    if( obj.params.changeable !== false ){
	formItems(`[name='locked']`).prop("checked", false);
    } else {
	formItems(`[name='locked']`).prop("checked", true);
    }
    if( obj.params.sticky ){
	formItems(`[name='sticky']`).prop("checked", true);
    } else {
	formItems(`[name='sticky']`).prop("checked", false);
    }
    // save regions processing
    formItems(`[id='includejson']`)
	.prop("checked", JS9.globalOpts.regIncludeJSON);
    formItems(`[id='includecomments']`)
	.prop("checked", JS9.globalOpts.regIncludeComments);
    formItems(`[id='savedcoords']`)
	.prop("checked", JS9.globalOpts.regSaveDCoords);
    formItems(`[id='includewcs']`)
	.prop("checked", JS9.globalOpts.csvIncludeWCS);
    // unset all save format radio buttons
    formjq().find(`input[name='saveformat']`)
	.prop("checked", false);
    // set save format based on global value
    formjq().find(`input[value='${JS9.globalOpts.regSaveFormat}']`)
	.prop("checked", true);
    // unset all save wcs radio buttons
    formjq().find(`input[name='rwcsbutton']`)
	.prop("checked", false);
    // set save wcs based on global value
    formjq().find(`input[value='${JS9.globalOpts.regSaveWCS||wcssys}']`)
	.prop("checked", true);
    // set which regions get saved
    if( opts.type === "save" ){
	s = `save${JS9.globalOpts.regSaveWhich1}`;
    } else {
	s = `save${JS9.globalOpts.regSaveWhich2}`;
    }
    formItems(`[id='${s}']`).prop("checked", true);
    // triggering the savefile will cause format to be updated
    // and focus to be set
    if( opts.type === "save" ){
	formjq().find(`input[name='savefile']`).trigger("change");
    }
    // style menus
    formjq().find(`input[name='strokeMenu']`).prop("selectedIndex", 0);
    formjq().find(`input[name='dashesMenu']`).prop("selectedIndex", 0);
    // shape specific processing
    if( multi ){
	formjq().find(".regid").hide();
	formjq().find(".edit").hide();
	formjq().find(".childtext").hide();
	formjq().find(".multi").removeClass("nodisplay");
	if( opts.setmode <= 0 ){
	    formjq().find(`[name='multitext']`).val("");
	    formjq().find(`input[name="color"]`).val("");
	    formjq().find(`input[name="strokeWidth"]`).val("");
	    formjq().find(`input[name="strokeDashes"]`).val("");
	    formNode._js9Strokewidth = "";
	    formNode._js9Strokedashes = "";
	    if( opts.setmode < 0 ){
		formjq().find(`[name='selectfilter']`).val("");
		formNode._js9Selectfilter = "";
	    }
	} else {
	    ao = this.layers.regions.canvas.getActiveObject();
	    if( ao && ao.type === "group" && !ao.params ){
		objs = ao.getObjects();
		if( objs && objs.length && objs[0] && objs[0].params ){
		    grp = objs[0].params.groupid;
		}
		if( grp ){
		    formjq().find(`[name='selectfilter']`).val(grp);
		    formNode._js9Selectfilter = grp;
		    s = this.listGroups(grp);
		    s2 = s.substring(s.indexOf("\n")+1);
		    formjq().find(`[name='multitext']`).val(s2);
		} else {
		    formjq().find(`[name='multitext']`).val("");
		}
	    } else if( ao ){
		ao = this.layers.regions.canvas.getActiveObjects();
		for(i=0, s=[], s2=""; i<ao.length; i++){
		    o = ao[i];
		    if( o.type === "group" && !o.params ){
			s2 += `${this.lookupGroup(o)}\n`;
		    } else {
			s.push(o);
		    }
		}
		s3 = this.listRegions(s, {mode: 1,
					  includejson: false,
					  includecomments: false})
		    .replace(/ *; */g, "\n");
		s2 = s2 + s3.substring(s3.indexOf("\n")+1);
		if( s2 ){
		    s4 = "selected";
		    formjq().find(`[name='selectfilter']`).val(s4);
		    formNode._js9Selectfilter = s4;
		    formjq().find(`[name='multitext']`).val(s2);
		}
	    } else {
		s =  formjq().find(`[name='selectfilter']`).val() || "selected";
		s2 = this.listRegions(s, {mode: 1,
					 includejson: false,
					 includecomments: false})
		    .replace(/ *; */g, "\n");
		if( s2 ){
		    formjq().find(`[name='selectfilter']`).val(s);
		    formNode._js9Selectfilter = s;
		    formjq().find(`[name='multitext']`).val(s2);
		}
	    }
	}
    } else {
	// grey-out read-only text input
	formjq().find("input:text[readonly]")
	    .css("border-color", "#A5A5A5")
	    .css("background", "#E9E9E9");
	// regular text input
	formjq().find("input:text:not([readonly])")
	    .css("border-color", "#E9E9E9")
	    .css("background", "white");
	switch(obj.pub.shape){
	case "box":
	case "cross":
	case "ellipse":
	    formItems(".angle").removeClass("nodisplay");
	    break;
	case "text":
	    formItems(".textangle").removeClass("nodisplay");
	    break;
	case "line":
	    if( obj.pub.pts && obj.pub.pts.length === 2 ){
		formItems(".linelength").removeClass("nodisplay");
		formItems(".lineangle").removeClass("nodisplay");
	    } else {
		formItems(".linelength").addClass("nodisplay");
		formItems(".lineangle").addClass("nodisplay");
	    }
	    break;
	default:
	    break;
	}
    }
    // save options
    formItems(".xtrareg").addClass("nodisplay");
    formItems(".xtracsv").addClass("nodisplay");
    formItems(".xtrasvg").addClass("nodisplay");
    formItems(`.xtra${JS9.globalOpts.regSaveFormat}`).removeClass("nodisplay");
    // save image for later processing
    formNode._js9Image = this;
    formjq().data("im", this);
    // save shape object for later processing
    formNode._js9Shape = obj;
    formjq().data("shape", obj);
    // save the window id for later processing
    formNode._js9Winid = winid;
    // save multi state for later processing
    formNode._js9Multi = multi;
    // even triggers
    if( JS9.BROWSER[3] ){
	mover = "touchstart";
	mout = "touchend";
    } else {
	mover = "mouseover";
	mout = "mouseout";
    }
    // for save form, focus on filename
    if( opts.type === "save" ){
	formjq().on(mover, () => {
	    formjq().find(`input[name='savefile']`).focus();
	});
    }
    // add tooltip callbacks (not mobile: ios buttons stop working!)
    if( !formNode._js9TooltipInit ){
	formNode._js9TooltipInit = true;
	formjq().data("tooltipInit", true);
	JS9.wrapCollection(".rconfigcol_R, .rsavecol_R").on(mover, (e) => {
	    const target = e.currentTarget;
	    const tooltip = wrapItem(target)
		  .find("input, textarea, span")
		  .data("tooltip");
	    const el = wrapItem(target)
		  .closest(JS9.lightOpts[JS9.LIGHTWIN].top)
		  .find(JS9.lightOpts[JS9.LIGHTWIN].dragBar);
	    if( tooltip && el.length ){
		// change title: see dhtmlwindow.js load() @line 130
		otitle = el[0].childNodes[0].nodeValue.replace(/:.*/,"");
		el[0].childNodes[0].nodeValue = `${otitle}: ${tooltip}`;
	    }
	});
	JS9.wrapCollection(".rconfigcol_R, .rsavecol_R").on(mout, (e) => {
	    const target = e.currentTarget;
	    const el = wrapItem(target)
		  .closest(JS9.lightOpts[JS9.LIGHTWIN].top)
		  .find(JS9.lightOpts[JS9.LIGHTWIN].dragBar);
	    if( el.length ){
		otitle = el[0].childNodes[0].nodeValue.replace(/:.*/,"");
		el[0].childNodes[0].nodeValue = otitle;
	    }
	});
    }
};

// process the config form to change the specified shape
// call using image context
JS9.Regions.processConfigForm = function(form, obj, arr){
    let i, key, nkey, val, nval, nopts, multi, layer, wcssys;
    let cpos, p1, p2, d, x, y, ang, sel;
    let bin = 1;
    const defobj = {
	type: "multi",
	pub: {shape: "multi"},
	params: {}
    };
    const alen = arr.length;
    const opts = {};
    const formNode = JS9.resolveNode(form);
    const wcsinfo = this.raw.wcsinfo || {cdelt1: 1, cdelt2: 1};
    const fmt= (val) => {
	if( val === undefined ){
	    return undefined;
	}
	if( (typeof val === "number") && (val % 1 !== 0) ){
	    val = Math.round((val + 0.00001) * 10000) / 10000;
	}
	return(String(val));
    };
    const fmtcheck = (val1, val2) => {
	if( multi ){
	    return true;
	}
	if( val1 === undefined ){
	    return false;
	}
	return fmt(val1) !== fmt(val2);
    };
    const newval = (obj, key, val) => {
	// let v1, v2;
	// special keys having no public or param equivalents
	if( key === "remove" ){
	    return val === "selected";
	}
	if( key === "childtext" ){
	    if( obj.params.children && obj.params.children.length > 0 ){
		if( obj.params.children[0].obj        &&
		    obj.params.children[0].obj.params ){
		    return val !== obj.params.children[0].obj.params.text;
		}
		return false;
	    }
	    return val !== obj.params.text;
	}
	if( key === "strokeWidth" ){
	    if( obj.params && obj.params.sw1 ){
		return val !== obj.params.sw1;
	    } else {
		return true;
	    }
	}
	if( key === "strokeDashes" ){
	    if( obj.strokeDashArray){
		return JSON.stringify(obj.strokeDashArray) !==
		       JSON.stringify(val);
	    }
	    if( JS9.isArray(val) ){
		switch(val.length){
		case 0:
		    return false;
		case 1:
		    return val[0] !== "";
		case 2:
		default:
		    return val[0] !== "" && val[1] !== "";
		}
	    } else {
		return val !== "";
	    }
	}
	if( key !== "tags" && val === "" ){
	    return false;
	}
	if( key === "misc" && val !== "" ){
	    return true;
	}
	if( key === "radii" && obj.params.radii ){
	    // v1 = val.split(",").map((item) => {return parseFloat(item)});
	    // v2 = obj.params.radii;
	    // legacy set-difference check kept here for reference only
	    // always return true or else annuli won't change other properties
	    return true;
	}
	if( key === "angle" ){
	    return obj.angle !== -parseFloat(val);
	}
	if( key === "ix" ){
	    if( obj.pub.preservedcoords             &&
		val.charAt(0).toLowerCase() === "d" ){
		return fmtcheck(obj.pub.dx, JS9.saostrtod(val.substring(1)));
	    } else {
		return fmtcheck(obj.pub.x, JS9.saostrtod(val));
	    }
	}
	if( key === "iy" ){
	    if( obj.pub.preservedcoords             &&
		val.charAt(0).toLowerCase() === "d" ){
		return fmtcheck(obj.pub.dy, JS9.saostrtod(val.substring(1)));
	    } else {
		return fmtcheck(obj.pub.y, JS9.saostrtod(val));
	    }
	}
	if( key === "px" && obj.pub.lcs ){
	    return fmtcheck(obj.pub.lcs.x.toFixed(1), val);
	}
	if( key === "py" && obj.pub.lcs ){
	    return fmtcheck(obj.pub.lcs.y.toFixed(1), val);
	}
	if( key === "ra" ){
	    if( obj.pub.wcsconfig && obj.pub.wcsconfig.wcsposstr ){
		return fmtcheck(JS9.saostrtod(obj.pub.wcsconfig.wcsposstr[0]),
				JS9.saostrtod(val));
	    } else if( obj.pub.wcsposstr ){
		return fmtcheck(JS9.saostrtod(obj.pub.wcsposstr[0]),
				JS9.saostrtod(val));
	    }
	    return false;
	}
	if( key === "dec" ){
	    if( obj.pub.wcsconfig && obj.pub.wcsconfig.wcsposstr ){
		return fmtcheck(JS9.saostrtod(obj.pub.wcsconfig.wcsposstr[1]),
				JS9.saostrtod(val));
	    } else if( obj.pub.wcsposstr ){
		return fmtcheck(JS9.saostrtod(obj.pub.wcsposstr[1]),
				JS9.saostrtod(val));
	    }
	}
	if( key === "sticky" ){
	    if( multi ){
		return false;
	    } else {
		return fmtcheck(obj.pub.sticky||false, val);
	    }
	}
	if( key === "locked" ){
	    if( multi ){
		return false;
	    } else {
		if( obj.params.changeable !== false ){
		    return val === false;
		} else {
		    return val === true;
		}
	    }
	}
	if( key === "listonchange" ){
	    if( multi ){
		return false;
	    }
	}
	if( obj.pub.lcs && obj.pub.lcs[key] !== undefined ){
	    if( fmtcheck(obj.pub.lcs[key], val) ){
		return true;
	    }
	    // don't look further or we end up checking image x, y
	    return false;
	}
	if( fmtcheck(obj.pub[key], val) ){
	    return true;
	}
	if( fmtcheck(obj.params[key], val) ){
	    return true;
	}
	if( fmtcheck(obj[key], val) ){
	    return true;
	}
	return false;
    };
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
    const replaceNewline = (s) => {
	const nl = String.fromCharCode(13, 10);
	if( typeof s === "string" ){
	    return s.replace(/\\n/g, nl);
	}
	return s;
    };
    // set physical to image conversion, if possible
    if( this.lcs && this.lcs.physical ){
	bin = Math.sqrt(Math.pow(this.lcs.physical.forward[0][0],2) +
		        Math.pow(this.lcs.physical.forward[0][1],2));
    }
    // which wcssys do we use? edit version, if available
    if( obj && obj.pub ){
	if( obj.pub.wcsconfig && obj.pub.wcsconfig.wcssys  ){
	    wcssys = obj.pub.wcsconfig.wcssys;
	} else {
	    wcssys = this.params.wcssys;
	}
    } else {
	wcssys = this.params.wcssys;
	// fake obj: makes the checks easier, avoid if( obj ... ) everywhere
	obj = defobj;
    }
    // multi selection or single region
    multi = formNode && formNode._js9Multi !== undefined ?
	formNode._js9Multi :
	JS9.wrapCollection(form).data("multi");
    // layer or regions
    layer = obj.pub.layer || "regions";
    // process array of keyword/values
    for(i=0; i<alen; i++){
	key = arr[i].name;
	val = arr[i].value;
	// pos keys: convert to correct type of position before switch statment
	if( key === "xpos" || key === "ypos" ){
	    switch(wcssys){
	    case "image":
		key = `i${key.charAt(0)}`;
		break;
	    case "physical":
		key = `p${key.charAt(0)}`;
		break;
	    default:
		if( this.validWCS() ){
		    if( key === "xpos" ){
			key = "ra";
		    } else {
			key = "dec";
		    }
		} else {
		    if( key === "xpos" ){
			key = "ix";
		    } else {
			key = "iy";
		    }
		}
		break;
	    }
	}
	switch(key){
	// these are never passed on
	case "multitext":
	case "colorPicker":
	case "savefile":
	case "rwcsbutton":
	case "savewcs":
	case "saveformat":
	case "includejson":
	case "includecomments":
	case "savewhich":
	case "savedcoords":
	    break;
	case "text":
	    if( obj.type === "text" ){
		if( newval(obj, key, val) ){
		    opts[key] = replaceNewline(val);
		}
	    }
	    break;
	case "selectfilter":
	    if( formNode && val && val !== formNode._js9Selectfilter ){
		// save current filter
		formNode._js9Selectfilter = val;
		// make selection
		if( this.lookupGroup(val) ){
		    this.groupShapes(layer, val);
		} else {
		    this.selectShapes(layer, val);
		}
		// don't do anything else when making a new filter selection
		return;
	    }
	    break;
	case "strokeDashes":
	    if( val === "" ){
		opts.strokeDashArray = [];
	    } else {
		nval = val.trim().split(/\s+/);
		if( (multi && val) || newval(obj, key, nval) ){
		    if( nval.length === 0 ){
			opts.strokeDashArray = [];
		    } else {
			opts.strokeDashArray = nval.map( s => parseInt(s, 10) );
		    }
		}
	    }
	    break;
	case "strokeWidth":
	    if( val === "" ){
		opts[key] = "";
	    } else {
		if( JS9.isNumber(val) ){
		    nval = parseInt(val, 10);
		    if( nval <= 0 ){
			opts[key] = "";
		    } else if( (multi && val)                     ||
			       (!multi && newval(obj, key, nval)) ){
			opts[key] = getval(nval);
		    }
		}
	    }
	    break;
	case "color":
	    if( val === "" ){
		opts[key] = "";
	    } else if( newval(obj, key, val) ){
		opts[key] = getval(val);
	    }
	    break;
	case "tags":
	    if( multi ){
		if( val ){
		    if( val === '""' || val === "''" ){
			opts[key] = "";
		    } else {
			opts[key] = getval(val);
		    }
		}
	    } else if( newval(obj, key, val) ){
		opts[key] = getval(val);
	    }

	    break;
	case "childtext":
	    if( obj.type !== "text" ){
		if( newval(obj, key, val) ){
		    opts.text = replaceNewline(val);
		}
	    }
	    break;
	case "ix":
	    if( newval(obj, key, val) ){
		if( obj.pub.preservedcoords             &&
		    val.charAt(0).toLowerCase() === "d" ){
		    opts.dx = getval(val.substring(1));
		    if( opts.dy === undefined && obj.pub.dy !== undefined ){
			opts.dy = obj.pub.dy;
		    }
		} else {
		    opts.x = getval(val);
		    if( opts.y === undefined && obj.pub.y !== undefined ){
			opts.y = obj.pub.y;
		    }
		}
	    }
	    break;
	case "iy":
	    if( newval(obj, key, val) ){
		if( obj.pub.preservedcoords             &&
		    val.charAt(0).toLowerCase() === "d" ){
		    opts.dy = getval(val.substring(1));
		    if( opts.dx === undefined && obj.pub.dx !== undefined ){
			opts.dx = obj.pub.dx;
		    }
		} else {
		    opts.y = getval(val);
		    if( opts.x === undefined && obj.pub.x !== undefined ){
			opts.x = obj.pub.x;
		    }
		}
	    }
	    break;
	case "px":
	    if( newval(obj, key, val) ){
		opts.px = getval(val);
		if( opts.py === undefined && obj.pub.lcs ){
		    opts.py = obj.pub.lcs.y;
		}
	    }
	    break;
	case "py":
	    if( newval(obj, key, val) ){
		opts.py = getval(val);
		if( opts.px === undefined && obj.pub.lcs ){
		    opts.px = obj.pub.lcs.x;
		}
	    }
	    break;
	case "ra":
	    if( newval(obj, key, val) ){
		opts.ra = val;
		if( opts.dec === undefined ){
		    if( obj.pub.wcsconfig && obj.pub.wcsconfig.wcsposstr ){
			opts.dec = obj.pub.wcsconfig.wcsposstr[1];
		    } else if( obj.pub.wcsposstr ){
			opts.dec = obj.pub.wcsposstr[1];
		    }
		}
	    }
	    break;
	case "dec":
	    if( newval(obj, key, val) ){
		opts.dec = val;
		if( opts.ra === undefined ){
		    if( obj.pub.wcsconfig && obj.pub.wcsconfig.wcsposstr ){
			opts.ra = obj.pub.wcsconfig.wcsposstr[0];
		    } else if( obj.pub.wcsposstr ){
			opts.ra = obj.pub.wcsposstr[0];
		    }
		}
		if( opts.wcssys === undefined ){
		    opts.wcssys = wcssys;
		}
	    }
	    break;
	case "wcssys":
	    break;
	case "radius":
	case "length":
	case "width":
	case "r1":
	    switch(wcssys){
	    case "image":
		if( newval(obj, key, val) ){
		    opts[key] = getval(val);
		}
		break;
	    case "physical":
		if( newval(obj, key, val) ){
		    opts[key] = getval(val) * bin;
		}
		break;
	    default:
		nval = JS9.strtoscaled(val);
		val = Math.abs(nval.dval / wcsinfo.cdelt1);
		nkey = key.replace("wcs", "");
		if( newval(obj, nkey, val) ){
		    opts[nkey] = getval(val);
		}
		break;
	    }
	    break;
	case "height":
	case "r2":
	    switch(wcssys){
	    case "image":
		if( newval(obj, key, val) ){
		    opts[key] = getval(val);
		}
		break;
	    case "physical":
		if( newval(obj, key, val) ){
		    opts[key] = getval(val) * bin;
		}
		break;
	    default:
		nval = JS9.strtoscaled(val);
		val = Math.abs(nval.dval / wcsinfo.cdelt2);
		nkey = key.replace("wcs", "");
		if( newval(obj, nkey, val) ){
		    opts[nkey] = getval(val);
		}
		break;
	    }
	    break;
	case "radii":
	    if( newval(obj, key, val) ){
		opts[key] = val;
	    }
	    break;
	case "linelength":
	    if( obj.pub.pts && obj.pub.pts.length === 2 ){
		if( JS9.isNumber(val) && val !== this.tmp.linelength ){
		    val = parseFloat(val);
		    switch(wcssys){
		    case "image":
		    case "physical":
			break;
		    default:
			if( wcsinfo.cdelt1 !== undefined ){
			    val /= Math.abs(wcsinfo.cdelt1);
			} else if( wcsinfo.cdelt2 !== undefined ){
			    val /= Math.abs(wcsinfo.cdelt2);
			}
			break;
		    }
		    if( opts.pts ){
			p1 = opts.pts[0];
			p2 = opts.pts[1];
		    } else {
			p1 = obj.pub.pts[0];
			p2 = obj.pub.pts[1];
		    }
		    if( JS9.inArray("line",
				  JS9.Regions.opts.noCenteredScaling) >= 0 ){
			// leave p1 fixed
			// https://math.stackexchange.com/questions/175896/finding-a-point-along-a-line-a-certain-distance-away-from-another-point
			d = Math.sqrt((p1.x - p2.x) * (p1.x - p2.x) +
				      (p1.y - p2.y) * (p1.y - p2.y) );
			x = p1.x - (val * (p1.x - p2.x))/d;
			y = p1.y - (val * (p1.y - p2.y))/d;
			opts.pts = [p1, {x, y}];
		    } else {
			// leave center fixed
			cpos = {x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
			ang = parseFloat(this.tmp.lineangle)||0;
			p1.x = cpos.x - val/2;
			p1.y = cpos.y;
			p2.x = cpos.x + val/2;
			p2.y = cpos.y;
			opts.pts = [JS9.rotatePoint(p1, ang, cpos),
				    JS9.rotatePoint(p2, ang, cpos)];
		    }
		}
	    }
	    break;
	case "lineangle":
	    if( obj.pub.pts && obj.pub.pts.length === 2 ){
		if( JS9.isNumber(val) && val !== this.tmp.lineangle ){
		    ang = parseFloat(val) - parseFloat(this.tmp.lineangle)||0;
		    if( opts.pts ){
			p1 = opts.pts[0];
			p2 = opts.pts[1];
		    } else {
			p1 = obj.pub.pts[0];
			p2 = obj.pub.pts[1];
		    }
		    if( JS9.inArray("line",
				  JS9.Regions.opts.noCenteredScaling) >= 0 ){
			// leave p1 fixed
			opts.pts = [p1, JS9.rotatePoint(p2, ang, p1)];
		    } else {
			// leave center fixed
			cpos = {x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
			opts.pts = [JS9.rotatePoint(p1, ang, cpos),
				    JS9.rotatePoint(p2, ang, cpos)];
		    }
		}
	    }
	    break;
	case "remove":
	    if( newval(obj, key, val) ){
		if( multi ){
		    opts[key] = "selected";
		} else if( obj.pub.id !== undefined ){
		    opts[key] = obj.pub.id;
		}
	    }
	    break;
	case "locked":
	    if( newval(obj, key, !getval(val)) ){
		opts.changeable = !getval(val);
	    }
	    break;
	case "misc":
	    if( val.trim() ){
		try{ nopts = JSON.parse(val); JS9.extend(opts, nopts); }
		catch(e){ JS9.error(`invalid json: ${val}`);}
	    }
	    break;
	default:
	    if( newval(obj, key, val) ){
		opts[key] = getval(val);
	    }
	    break;
	}
    }
    // change the shape(s), if necessary
    if( Object.keys(opts).length > 0 ){
	if( multi ){
	    sel = ((formNode && formNode.querySelector(`[name='selectfilter']`)) || {}).value ||
		"selected";
	    this.changeShapes(layer, sel, opts);
	} else {
	    sel = ((formNode && formNode.querySelector(`[name='id']`)) || {}).value || obj;
	    this.changeShapes(layer, sel, opts);
	}
	this.initRegionsForm(obj, {multi});
    }
};

// convenience routine used in regionsConfig.html
JS9.Regions.regionsConfigSetSelectFilter = function(el, def) {
    let i, s, curval, lastval, nval, nfilter;
    let arr = [];
    let defarr = [];
    let grparr = [];
    const form = el.closest('form');
    const filter = form.find(`[name='selectfilter']`);
    const im = form.data('im');
    const withparens = (s) => {
	let t;
	if( !s ){ return ""; }
	t = s.trim();
	if( t.charAt(0) === "(" && t.charAt(t.length-1) === ")" ){
	    return t;
	} else {
	    return `(${t})`;
	}
    };
    // sanity check
    if( !im ){ return; }
    // groups
    grparr = im.listGroups("all", {includeregions:false}).split("\n");
    // new value from menu
    nval =  el.val().trim();
    // cur value from filter select
    curval = filter.val().trim();
    // handle "saved" specially
    if( def === "other" && nval === "saved" ){
	// compose and set the new filter selection
	s = im.layers.regions.selection || "";
	if( s ){
	    if( curval ){
		s = `${withparens(s)} && ${withparens(curval)}`;
	    }
	}
	filter.val(`${s}`);
	// reset the menu
	el.prop('selectedIndex', 0);
	return;
    }
    if( curval ){
	arr = curval.split(/\s+/);
    }
    if( arr.length ){
	lastval = arr[arr.length-1];
	if( !nval.match(/[&|]/) && !lastval.match(/[&|!]/) ){
	    // get array of possible values
	    switch(def){
	    case "regions":
		defarr = JS9.regions;
		break;
	    case "colors":
		break;
	    case "tags":
		break;
	    case "wcssys":
		defarr = JS9.wcssyss;
		break;
	    case "groups":
		defarr = grparr;
		break;
	    case "ops":
		defarr = ["!", "&&", "||"];
		break;
	    }
	    if( JS9.inArray(lastval, defarr) >= 0 ){
		// if new and last val is of the same type, use || for union
		// (intersection of same types, but non-identical, is null)
		nval = `|| ${nval}`;
	    } else if( JS9.inArray(lastval, grparr) >= 0 ||
		       JS9.inArray(nval, grparr) >= 0    ){
		// if either is a group, use || for union
		// (intersection of non-identical groups is null)
		nval = `|| ${nval}`;
	    } else {
		// use && for intersection, e.g., color && shape
		nval = `&& ${nval}`;
	    }
	}
    }
    // this is the new filter
    nfilter = `${curval} ${nval}`;
    // futz w/parens: split by ||, add parens around segments containing &&
    // if you used the menus to choose these:
    //   circle blue || box red
    // then instead of this:
    //   circle && blue || box && red
    // we should end up with this:
    //   (circle && blue) || (box && red)
    if( JS9.globalOpts.regConfigAddParens ){
	arr = nfilter.split("||");
	if( arr.length >= 2 ){
	    for(i=0; i<arr.length; i++){
		s = arr[i].trim();
		if( s.indexOf("&&") > 0 ){
		    arr[i] = withparens(s);
		} else {
		    arr[i] = s;
		}
	    }
	}
	nfilter = arr.join(' || ').replace(/  */g, " ");
    }
    // compose and set the new filter selection
    filter.val(nfilter);
    // reset the menu
    el.prop('selectedIndex', 0);
};

// convenience routine used in regionsConfig.html
JS9.Regions.regionsConfigSetSelectMenu = function(im, form, key) {
    let i, j, s, el, objs, gots, arr;
    const initmenu = (el) => {
	let i;
	// remove all but the header (0th option)
	for(i=el.options.length-1; i>=1; i--) {
	    el.remove(i);
	}
    };
    if( !key.match(/^select/) ){
	key = `select${key}`;
    }
    el = form.find(`[name='${key}']`);
    // reinit: clear menu
    initmenu(el[0]);
    // current objects
    objs = im.getShapes("regions", "all");
    // add items
    switch(key){
    case "selectshape":
	for(i=0, gots=[]; i<objs.length; i++){
	    s = objs[i].shape;
	    if( JS9.inArray(s, gots) < 0 ){
		el.append(`<option>${s}</option>`);
		gots.push(s);
	    }
	}
	break;
    case "selectcolor":
	for(i=0, gots=[]; i<objs.length; i++){
	    s = objs[i].color;
	    if( JS9.inArray(s, gots) < 0 ){
		el.append(`<option>${s}</option>`);
		gots.push(s);
	    }
	}
	break;
    case "selecttag":
	for(i=0, gots=[]; i<objs.length; i++){
	    s = objs[i].tags;
	    for(j=0; j<s.length; j++){
		if( JS9.inArray(s[j], gots) < 0 ){
		    el.append(`<option>${s[j]}</option>`);
		    gots.push(s[j]);
		}
	    }
	}
	break;
    case "selectwcs":
	for(i=0, gots=[]; i<objs.length; i++){
	    if( objs[i].wcsconfig ){
		s = objs[i].wcsconfig.wcssys;
		if( JS9.inArray(s, gots) < 0 ){
		    el.append(`<option>${s}</option>`);
		    gots.push(s);
		}
	    }
	}
	break;
    case "selectgroup":
	s = im.listGroups("all", {includeregions:false});
	if( s ){
	    arr = s.split("\n");
	    for(i=0; i<arr.length; i++){
		el.append(`<option>${arr[i]}</option>`);
	    }
	}
	break;
    }
};

// convenience routine used in regionsConfig.html
JS9.Regions.regionsConfigSetSelectOrGroup = function(im, form, key, update){
    let obj, group, canvas;
    let el1 = form.find(`[name="selectfilter"]`);
    let el2 = form.find(`[name="multitext"]`);
    let selection = el1.val().trim();
    // sanity check
    if( !im ){ return; }
    // convenience variables
    canvas = im.layers.regions.canvas;
    // default is to allow update of multi-selection dialog
    // sometimes we definitely don't want that to happen, so ...
    if( update === false ){ im.tmp.updateMulti = false; }
    // default is to select
    if( !selection ){
	el1.val("");
	el2.val("");
	form.data("selectfilter", "");
	if( canvas.getActiveObject() ){
	    canvas.discardActiveObject();
	}
	canvas.renderAll()
	key = "clear";
    }
    if( !key ){
	key = im.lookupGroup(selection) ? "group" : "select";
    }
    switch(key){
    case "select":
	form.data("selectfilter", selection);
	im.selectShapes("regions", selection, {transparentgroup: false});
	break;
    case "group":
	form.data("selectfilter", selection);
	group = im.groupShapes("regions", selection);
	el1.val(group);
	el2.val(im.listGroups(group))
	obj = im.lookupGroup(group);
	if( obj ){
	    canvas.setActiveObject(obj);
	    canvas.renderAll();
	    JS9.Regions.regionsConfigSetSelectMenu(im, form, "selectgroup");
	}
	break;
    case "ungroup":
	im.ungroupShapes("regions", selection);
	el1.val("");
	el2.val("");
	form.data("selectfilter", "");
	if( canvas.getActiveObject() ){
	    canvas.discardActiveObject();
	}
	JS9.Regions.regionsConfigSetSelectMenu(im, form, "selectgroup");
	break;
    case "clear":
	form.find(`input[name="color"]`).val("");
	form.find(`input[name="strokeWidth"]`).val("");
	form.find(`input[name="strokeDashes"]`).val("");
	form.data("strokewidth", "");
	form.data("strokedashes", "");
	break;
    default:
	break;
    }
    delete im.tmp.updateMulti;
};

// paste a region from clipboard
// call using image context
JS9.Regions.pasteFromClipboard = function(curpos){
    let i, s, nobj, xpos, ypos, oval;
    let objs = [];
    let xcen = 0, ycen = 0;
    const rregexp = /(annulus|box|circle|cross|ellipse|line|polygon|point|text) *\(/;
    // sanity check
    if( !this ){ return; }
    // get string from clipboard
    s = JS9.CopyFromClipboard().trim();
    // see if we have anything at all
    if( !s ){
	JS9.error(JS9.CLIPBOARDERROR);
    }
    // see if we have region(s)
    if( s.match(rregexp) ){
	// we don't update the clipboard for these operations
	oval = JS9.globalOpts.regToClipboard;
	JS9.globalOpts.regToClipboard = false;
	// add regions (don't update clipboard)
	objs = this.addShapes("regions", s, {rtn: "objs"});
	// place regions in the position specified by the mouse, if necessary
	if( curpos ){
	    // number of regions
	    nobj = objs.length;
	    // get centroid
	    for(i=0; i<nobj; i++){
		xcen += objs[i].pub.x;
		ycen += objs[i].pub.y;
	    }
	    xcen /= nobj;
	    ycen /= nobj;
	    // move to current position specified by mouse
	    for(i=0; i<nobj; i++){
		xpos = objs[i].pub.x - xcen + this.ipos.x;
		ypos = objs[i].pub.y - ycen + this.ipos.y;
		this.changeShapes("regions", objs[i].pub.id, {x: xpos, y:ypos});
	    }
	}
	JS9.globalOpts.regToClipboard = oval;
    } else {
	JS9.error(JS9.CLIPBOARDERROR2);
    }
    return s;
};

// ---------------------------------------------------------------------------
// Regions prototype additions to JS9 Image class
// ---------------------------------------------------------------------------

// list one or more regions
JS9.Regions.listRegions = function(which, opts, layerName){
    let i, j, region, rlen, key, obj, tagjoin, tagstr, iestr, mode, val, got;
    let txeq, owcsunits, owcssys, wcssys, layer;
    let regstr="";
    let lasttype="none";
    let dotags = false;
    let pubs = [];
    let exports = {};
    let preservedcoords = [];
    const sepstr="; ";
    const tagcolors = [];
    const topts = {includeObj: true};
    const getExports = (obj, region) => {
	let i, s, key, child, ra, dec;
	const nexports = {};
	const params = obj.params;
	const children = params.children;
	const exports = params.exports;
	for(i=0; i<exports.length; i++){
	    // property name
	    key = exports[i];
	    // skip text keys (except text regions), get them from the children
	    if( (key === "text" && obj.type !== "text") ||
		(key === "textOpts") ){
		continue;
	    }
	    // ignore empty stroke dash array
	    if( key === "strokeDashArray" && obj.strokeDashArray ){
		s = obj.strokeDashArray.join("");
		if( (s === "") || s.match(/NaN/) ){
		    continue;
		}
	    }
	    // skip id when saving to a file
	    if( key === "id" && opts.file ){
		continue;
	    }
	    // skip wcsconfig when saving to a file
	    if( key === "wcsconfig" && opts.file ){
		continue;
	    }
	    // sometimes skip data when saving to a file
	    if( key === "data" && typeof params.data === "object" &&
		params.data.doexport === false && opts.file ){
		continue;
	    }
	    // strokeWidth can be changed as part of zooming,
	    // so use the original value if needed
	    if( (key === "strokeWidth") && params.sw1 ){
		nexports[key] = params.sw1;
		continue;
	    }
	    // looks for its value
	    if( obj[key] !== undefined ){
		nexports[key] = obj[key];
	    } else if( params[key] !== undefined ){
		nexports[key] = params[key];
	    } else if( region && region[key] !== undefined ){
		nexports[key] = region[key];
	    }
	}
	// handle text child properties specially
	// for now, just output the first one (cf. updateShape)
	if( (children.length > 0) && (children[0].obj.text) ){
	    child = children[0].obj;
	    // create a text child
	    nexports.text = child.text;
	    // get options for text child but ...
	    nexports.textOpts = getExports(child);
	    // try to minimize exported properties
	    if( obj.angle !== child.angle ){
		// child has an explicit angle different from parent
		nexports.textOpts.angle = -child.angle;
		if( (obj.params.shape === "circle")  ||
		    (obj.params.shape === "annulus") ){
		    child.params.hasTextOpts = true;
		}
	    } else if( child.angle !== 0 ){
		// parent is circle/annulus and child has an angle
		if( (obj.params.shape === "circle")  ||
		    (obj.params.shape === "annulus") ){
		    nexports.textOpts.angle = -child.angle;
		    child.params.hasTextOpts = true;
		}
	    }
	    if( child.params.parent.moved || child.params.hasTextOpts ){
		// wcs, then physical coords are preferred ...
		if( child.pub.ra && child.pub.dec ){
		    // convert child ra, dec to target wcs, if necessary
		    if( owcssys && wcssys && owcssys !== wcssys ){
			s = this.wcs2wcs(owcssys, wcssys,
					 child.pub.ra, child.pub.dec);
			s = s.trim().split(/\s+/);
			ra = JS9.saostrtod(s[0]);
			if( JS9.isHMS(wcssys) ){
			    ra *= 15.0;
			}
			dec = JS9.saostrtod(s[1]);
		    } else {
			ra = child.pub.ra;
			dec = child.pub.dec;
		    }
		    nexports.textOpts.ra  = ra;
		    nexports.textOpts.dec = dec;
		} else if( child.pub.lcs ){
		    nexports.textOpts.px = child.pub.lcs.x;
		    nexports.textOpts.py = child.pub.lcs.y;
		} else {
		    // ... image coords will are only good for this image
		    nexports.textOpts.x = child.pub.x;
		    nexports.textOpts.y = child.pub.y;
		}
	    }
	    if( nexports.textOpts.color === obj.stroke ){
		delete nexports.textOpts.color;
	    }
	    if( nexports.textOpts.text ){
		delete nexports.textOpts.text;
	    }
	    if( !Object.keys(nexports.textOpts).length ){
		delete nexports.textOpts;
	    }
	}
	return nexports;
    };
    // opts is optional
    opts = opts || {};
    // opts can be an object or json
    if( typeof opts === "string" ){
	try{ opts = JSON.parse(opts); }
	catch(e){ JS9.error(`can't parse listRegions opts: ${opts}`, e); }
    }
    // pass sortids from opts to topts (used by getShapes)
    if( JS9.notNull(opts.sortids) ) topts.sortids = opts.sortids;
    // default is to display, including non-source tags
    mode = opts.mode;
    if( JS9.isNull(mode) ){
	mode = 3;
    }
    // default is to list the regions layer
    layerName = layerName || "regions";
    layer = this.getShapeLayer(layerName);
    // sanity check
    if( !layer ){ return; }
    // set user-specified wcs, if necessary
    if( opts.wcssys || opts.wcsunits ){
	txeq = JS9.globalOpts.xeqPlugins;
	JS9.globalOpts.xeqPlugins = false;
	if( opts.wcssys ){
	    owcssys = this.getWCSSys();
	    this.setWCSSys(opts.wcssys, false);
	    wcssys = this.getWCSSys();
	}
	if( opts.wcsunits ){
	    owcsunits = this.getWCSUnits();
	    this.setWCSUnits(opts.wcsunits, false);
	}
	// update wcs values
	this.updateShapes(layerName, which, "export");
    }
    // include dcoord shapes?
    if( JS9.isNull(opts.includedcoords) ){
	opts.includedcoords = JS9.globalOpts.regListDCoords;
    }
    // get specified regions into an array
    pubs = this.getShapes(layerName, which, topts);
    // loop through shapes
    rlen = pubs.length;
    // display tags if at least one is not standard "source,include"
    if( mode ){
	for(i=0; i<rlen; i++){
	    region = pubs[i];
	    tagjoin = region.tags.join(",");
	    if( tagjoin                        &&
		(tagjoin !== "source,include") &&
		(tagjoin !== "include,source") ){
		dotags = true;
		break;
	    }
	}
    }
    // get array of colors associated with tags
    for( key of Object.keys(JS9.Regions.opts.tagcolors) ){
	tagcolors.push(JS9.Regions.opts.tagcolors[key]);
    }
    // process all regions
    for(i=0; i<rlen; i++){
	region = pubs[i];
	obj = region.obj;
	preservedcoords = [];
	// don't list sticky regions, if specified
	// used by refresh to avoid changing sticky regions
	if( region.sticky && opts.sticky === false ){
	    continue;
	}
	// don't list regions where we are preserving dcoords, if specified
	if( region.preservedcoords && !opts.includedcoords ){
	    continue;
	}
	// don't list regions to a display if ignore is set
	if( region.ignore && !opts.ignoreignore ){
	    continue;
	}
	// preserving dcoords get handled specially
	if( JS9.isArray(obj.params.preservedcoords) ){
	    // make array of raw values to output
	    for(j=0; j<obj.params.preservedcoords.length; j++){
		key = obj.params.preservedcoords[j];
		switch(key){
		case "pts":
		    if( JS9.inArray("dx", preservedcoords) < 0 ){
			preservedcoords.push("dx");
		    }
		    if( JS9.inArray("dy", preservedcoords) < 0 ){
			preservedcoords.push("dy");
		    }
		    if( JS9.inArray("points", preservedcoords) < 0 ){
			preservedcoords.push("points");
		    }
		    break;
		default:
		    preservedcoords.push(key);
		    break;
		}
	    }
	    if( lasttype !== "none" ){
		regstr += sepstr;
	    }
	    if( lasttype !== "image" ){
		regstr += "image";
		regstr += sepstr;
	    }
	    regstr += `${region.shape}({`;
	    // return values originally passed when creating regions
	    for(j=0, got=0; j<preservedcoords.length; j++){
		key = preservedcoords[j];
		// skip keys added during processing
		if( key === "shape" ){ continue; }
		if( key === "sticky" ){ continue; }
		if( key === "wcsconfig" ){ continue; }
		// convert pts to points, along with dx, dy
		if( key === "pts" ){
		    key = "dx";
		    obj.params.preservedcoords.push("dy");
		    obj.params.preservedcoords.push("points");
		}
		// convert raw array to original boolean
		if( key === "preservedcoords" ){
		    val = true;
		} else if( JS9.notNull(region[key]) ){
		    val = region[key];
		} else if( JS9.notNull(obj[key]) ){
		    val = obj[key];
		} else {
		    switch(key){
		    case "dx":
			val = obj.left;
			break;
		    case "dy":
			val = obj.top;
			break;
		    case "color":
			val = obj.stroke;
			break;
		    default:
			val = null;
			break;
		    }
		}
		// format the value
		if( val ){
		    if( got++ > 0 ){ regstr += ","; }
		    regstr += `"${key}":`;
		    switch(typeof val){
		    case "string":
			regstr += `"${val}"`;
			break;
		    case "object":
			try{ regstr += JSON.stringify(val); }
			catch(e){ JS9.error(`can't parse: ${val}`, e); }
			break;
		    default:
			regstr += `${val}`;
			break;
		    }
		}
	    }
	    regstr += `})`;
	    lasttype = "image";
	    continue;
	}
	// init tags
	tagjoin = region.tags.join(",");
	if( tagjoin.includes("exclude") ){
	    iestr = "-";
	} else {
	    iestr = "";
	}
	// add exported properties
	exports = getExports(obj, region);
	// add id, if necessary
	if( opts.saveid ){
	    exports.id = region.id;
	} else {
	    delete exports.id;
	}
	// save wcsconfig, if necessary
	if( opts.savewcsconfig && region.wcsconfig   &&
	    Object.keys(region.wcsconfig).length > 0 ){
	    exports.wcsconfig = JS9.extend(true, {}, region.wcsconfig);
	} else {
	    delete exports.wcsconfig;
	}
	// add color, if necessary
	if( region.color && !tagcolors.includes(region.color) ){
	    exports.color = region.color;
	}
	// display tags?
	if( dotags ){
	    tagstr = ` # ${tagjoin}`;
	}
	// save editing?
	if( !opts.saveediting ){
	    delete exports.editing;
	}
	// use wcs string, if available
	if( region.wcsstr && JS9.isWCSSys(this.params.wcssys) ){
	    if( lasttype !== "wcs" ){
		if( lasttype !== "none" ){
		    regstr += sepstr;
		}
		// use region wcs sys, if possible
		// (current wcssys might be different!)
		if( region.wcssys ){
		    regstr += region.wcssys;
		} else {
		    regstr += this.params.wcssys;
		}
		lasttype = "wcs";
	    }
	    regstr += (sepstr + iestr + region.wcsstr);
	} else if( region.imstr ){
	    // else use image string, if available
	    if( lasttype !== region.imsys ){
		if( lasttype !== "none" ){
		    regstr += sepstr;
		}
		regstr += region.imsys;
		lasttype = region.imsys;
	    }
	    regstr += (sepstr + iestr + region.imstr);
	}
	// odd modes output the exports
	if( opts.includejson !== false        &&
	    ((mode % 2) === 1)                &&
	    (Object.keys(exports).length > 0) ){
	    // line region: remove size/distance info
	    if( region.shape === "line" ){
		regstr = regstr.replace(/ *{[^{}]*}$/,"");
	    }
	    regstr += ` ${JSON.stringify(exports)}`;
	}
	if( tagstr ){
	    regstr += tagstr;
	}
    }
    // remove comments, if necessary
    if( opts.includecomments === false ){
	regstr = regstr.replace(/ *#[^;]*/g, "");
    }
    // restore original wcs, if necessary
    if( owcssys || owcsunits ){
	if( owcssys ){
	    this.setWCSSys(owcssys, false);
	}
	if( owcsunits ){
	    this.setWCSUnits(owcsunits, false);
	}
	// restore wcs values
	this.updateShapes(layerName, which, "export");
	JS9.globalOpts.xeqPlugins = txeq;
    }
    // display the region string, if necessary
    if( mode > 1 ){
	this.display.displayMessage("regions", regstr);
    }
    // always return the region string
    return regstr;
};

// copy one or more regions to another image
// call using image context
JS9.Regions.copyRegions = function(to, which){
    return this.copyShapes("regions", to, which);
};

// parse a string containing a subset of DS9/Funtools regions
// call using image context
JS9.Regions.parseRegions = function(s, opts){
    let i, j, k, lines, obj, robj, txeq;
    let owcssys, owcsunits, wcssys, iswcs, liswcs, pos, alen;
    const regions = [];
    const regrexp = /^-?(annulus|box|circle|cross|ellipse|line|polygon|point|text)$/;
    const wcsrexp = /^(fk4|fk5|icrs|galactic|ecliptic|image|physical|linear)$/;
    const imrexp = /^(image|physical)$/;
    const unrexp = /[dr:]/;
    const parrexp = /\(\s*([^)]+?)\s*\)/;
    const seprexp = /\n|;/;
    const optsrexp = /(\{.*\})/;
    const argsrexp = /\s*,\s*/;
    const charrexp = /(\(|\{|#|;|\n)/;
    const comrexp  = /#(?![a-zA-Z0-9]{6}['"])/;
    // convert "0" to false and "1" to true
    const tf = (s) => {
	if( s === "0" || s.toLowerCase() === "false" ){return false;}
	return true;
    };
    // ds9 compatibility: get properties from comment string
    const ds9properties = (s) => {
	let xarr, key, key2, val, nobj;
	const xobj = {};
	const rexp = /([a-zA-Z][a-zA-Z0-9_]*)\s*=\s*(\d+(\s*\d+)*|[^ '"{]+|['"{][^'"}]*['"}])/g;
	const ds9opts = {
	    color(v) {return {color: v};},
	    dash(v) {if(v){return {strokeDashArray: [3,1]};}},
	    dashlist(v) {
		let i, arr;
		if( v ){
		    arr = v.split(" ");
		    for(i=0; i<arr.length; i++){
			arr[i] = parseFloat(arr[i]);
		    }
		    return {strokeDashArray: arr};
		}
	    },
	    delete(v) {return {removable: tf(v)};},
	    edit(v) {return {selectable: tf(v)};},
	    fixed(v) {return {zoomable: !tf(v)};},
	    font(v) {
		const obj = {};
		const arr = v.split(" ");
		const len = arr.length;
		if( len >= 1 ){ obj.fontFamily = arr[0]; }
		if( len >= 2 ){ obj.fontSize = parseFloat(arr[1]); }
		if( len >= 3 ){ obj.fontStyle  = arr[2]; }
		if( len >= 4 ){ obj.fontWeight = arr[3]; }
		return obj;
	    },
	    highlite(v) {return {hasControls: tf(v), hasBorders: tf(v), hasRotatingPoint: tf(v)};},
	    move(v) {return {movable: tf(v)};},
	    rotate(v) {return {rotatable: tf(v)};},
	    resize(v) {return {resizable: tf(v)};},
	    changeable(v) {return {changeable: tf(v)};},
	    select(v) {return {selectable: tf(v)};},
	    text(v) {return {text: v};},
	    tag(v) {return {tags: v};},
	    width(v) {return {strokeWidth: parseFloat(v)};}
	};
	// opts is optional
	opts = opts || {};
	// loop through DS9 region properties, converting to js9 props
	while( (xarr = rexp.exec(s)) !== null ){
	    key = xarr[1].toLowerCase();
	    val = xarr[2].replace(/^['"{]|['"}]$/g, "");
	    if( {}.hasOwnProperty.call(ds9opts, key) &&
		typeof ds9opts[key] === "function"   ){
		nobj = ds9opts[key](val) || {};
		for( key2 of Object.keys(nobj) ){
		    if( key2 === "tags" && {}.hasOwnProperty.call(xobj, key2) ){
			xobj[key2] += `,${nobj[key2]}`;
		    } else {
			xobj[key2] = nobj[key2];
		    }
		}
	    } else {
		xobj[key] = val;
	    }
	}
	// save the remaining comment
	s = s.replace(rexp, "");
	if( s ){
	    xobj._comment = s.trim();
	}
	return xobj;
    };
    // parse region line into cmd (shape or wcs), args, opts, comment
    const regparse1 = (s) => {
	let t, tarr, ds9props;
	const tobj = {};
	// initialize the return object
	tobj.opts = {};
	tobj.args = [];
	tobj.isregion = 0;
	// look for a command
	if( s.includes("(") ){
	    tobj.cmd = s.split("(")[0].trim().toLowerCase();
	} else if( s.includes("{") ){
	    tobj.cmd = s.split("{")[0].trim().toLowerCase();
	} else if( s.includes("#") ){
	    tobj.cmd = s.split("#")[0].trim().toLowerCase();
	} else {
	    tobj.cmd = s.trim().toLowerCase();
	}
	// got regions?
	if( tobj.cmd ){
	    tobj.isregion = (tobj.cmd.search(regrexp) >=0);
	}
	// split on comment (ignore color specifications starting with "#")
	t = s.trim().split(comrexp);
	// look for json opts after the arg list
	tarr = optsrexp.exec(t[0]);
	if( tarr && tarr[0] ){
	    // convert to object
	    try{ tobj.opts = JSON.parse(tarr[0].trim()); }
	    catch(e){ JS9.error(`can't parse opts: ${tarr[0]}`, e); }
	}
	// look for comments
	tobj.comment = t[1];
	if( tobj.comment ){
	    ds9props = ds9properties(tobj.comment.trim());
	    if( ds9props._comment !== undefined ){
		tobj.comment = ds9props._comment;
		delete ds9props._comment;
	    }
	}
	// merge with ds9 opts
	if( ds9props ){
	    tobj.opts = JS9.extend({}, ds9props, tobj.opts);
	}
	// separate the region args into an array
	tarr = parrexp.exec(s);
	if( tarr && tarr[0].match(optsrexp) ){
	    // no region args, all properties passed in json
	    tobj.args = [];
	} else if( tarr && tarr[1] ){
	    // region args, without json opts
	    tobj.args = tarr[1].split(argsrexp);
	}
	// look for - sign signifying an exclude region
	if( tobj.isregion && tobj.cmd.startsWith("-") ){
	    tobj.cmd = tobj.cmd.slice(1);
	    if( tobj.comment ){
		if( !tobj.comment.match(/exclude/) ){
		    tobj.comment += ",exclude";
		}
	    } else {
		tobj.comment = "exclude";
	    }
	}
	return tobj;
    };
    const getipos = (ix, iy) => {
	let vt, sarr, v1, v2;
	let obj = {};
	// special handling for display coords
	if( ix.charAt(0).toLowerCase() === "d" &&
	    iy.charAt(0).toLowerCase() === "d" ){
	    obj.dx = parseFloat(ix.substring(1));
	    obj.dy = parseFloat(iy.substring(1));
	    return obj;
	}
	// convert strings to numbers, along with unit delimiters
	v1 = JS9.strtoscaled(ix);
	v2 = JS9.strtoscaled(iy);
	// local override of wcs if:
	// a. we used sexagesimal units or appended d,r
	// b. we are not currently using wcs
	if( ((v1.dtype.match(unrexp)) || (v2.dtype.match(unrexp))) &&
	    !iswcs && !owcssys.match(imrexp) ){
	    liswcs = true;
	    wcssys = owcssys;
	}
	if( iswcs || liswcs ){
	    // arg1 coords are hms, but ecliptic, galactic are deg
	    if( JS9.isHMS(wcssys, v1.dtype) ){
		v1.dval *= 15.0;
	    }
	    // convert to degrees, if necessary
	    if( v1.dtype === "r" ){ v1.dval = v1.dval * 180 / Math.PI; }
	    if( v2.dtype === "r" ){ v2.dval = v2.dval * 180 / Math.PI; }
	    // get image coordinates
	    sarr = JS9.wcs2pix(this.raw.wcs, v1.dval, v2.dval).split(/ +/);
	    obj.x = parseFloat(sarr[0]);
	    obj.y = parseFloat(sarr[1]);
	    return obj;
	} else if( wcssys === "physical" ){
	    vt = this.logicalToImagePos({x: v1.dval, y: v2.dval});
	    obj.x = vt.x;
	    obj.y = vt.y;
	    return obj;
	}
	// image coords
	obj.x = v1.dval;
	obj.y = v2.dval;
	return obj;
    };
    // get image length
    const getilen = (len, which) => {
	let cstr, iscale;
	const v = JS9.strtoscaled(len);
	const wcsinfo = this.raw.wcsinfo || {cdelt1: 1, cdelt2: 1};
	// local override of wcs if:
	// a. we are not currently using wcs
	// b. we used sexagesimal units or appended d,r
	if( v.dtype.match(unrexp) && !iswcs && !owcssys.match(imrexp) ){
	    liswcs = true;
	    wcssys = owcssys;
	}
	if( iswcs || liswcs ){
	    // convert to degrees, if necessary
	    if( v.dtype === "r" ){ v.dval = v.dval * 180 / Math.PI; }
	    // angular separation is not implemented
	    // region wcs size is always based on cdelt
	    if( JS9.REGSIZE !== 0 ){
		JS9.error("region size based on ang sep is not implemented");
	    }
	    // wcs-based size
	    cstr = `cdelt${which}`;
	    v.dval = Math.abs(v.dval / wcsinfo[cstr]);
	} else if( wcssys === "physical" ){
	    // use the LTM1_1 value stored for logical to image transforms
	    if( this.lcs && this.lcs.physical ){
		iscale = Math.sqrt(Math.pow(this.lcs.physical.forward[0][0],2)+
				   Math.pow(this.lcs.physical.forward[0][1],2));
		v.dval = Math.abs(v.dval * iscale);
	    }
	}
	return v.dval;
    };
    // get image angle
    const getang = (a) => {
	const v = JS9.strtoscaled(a);
	return v.dval;
    };
    // get cleaned-up string
    const getstr = (s) => {
	const t = s.replace(/^['"]/, "").replace(/["']$/, "");
	return t;
    };
    // sanity check
    s = s.trim();
    if( !s.match(charrexp) ){
	return s;
    }
    // save original wcs
    owcssys = this.getWCSSys();
    owcsunits = this.getWCSUnits();
    // this is the default wcs for regions
    wcssys = "physical";
    // do we have a real wcs?
    iswcs = JS9.isWCSSys(wcssys);
    // get individual "lines" (new-line or semi-colon separated)
    lines = s.split(seprexp);
    // for each region or cmd
    for(i=0; i<lines.length; i++){
	// ignore comments
	if( lines[i].trim().substr(0,1) !== "#" ){
	    // reset temp wcs
	    liswcs = false;
	    // parse the line
	    robj = regparse1(lines[i]);
	    alen = robj.args.length;
	    // if this is a region ...
	    if( robj.isregion ){
		// start afresh or with opts from the region string
		obj = JS9.extend(true, {}, robj.opts);
		// save the shape
		obj.shape = robj.cmd;
		// save the current wcssys for editing
		obj.wcsconfig = obj.wcsconfig || {wcssys};
		// args are not required!
		if( alen >= 2               &&
		    obj.shape !== "line"    &&
		    obj.shape !== "polygon" ){
		    // get image position
		    JS9.extend(obj, getipos(robj.args[0], robj.args[1]));
		}
		// if textOpts has ra, dec, save the wcssys, it may be
		// different by the time textOpts gets processed
		if( obj.textOpts                    &&
		    obj.textOpts.ra  !== undefined  &&
		    obj.textOpts.dec !== undefined  ){
		    obj.textOpts._wcssys = wcssys;
		}
		// region args are optional
		switch(robj.cmd){
		case "annulus":
		    if( alen > 0 ){
			obj.radii = [];
			for(j=2; j<alen; j++){
			    obj.radii.push(getilen(robj.args[j], 1));
			}
		    }
		    break;
		case "box":
		case "cross":
		    if( alen >= 3 ){
			obj.width = getilen(robj.args[2], 1);
		    }
		    if( alen >= 4 ){
			obj.height = getilen(robj.args[3], 2);
		    }
		    if( alen >= 5 ){
			obj.angle = getang(robj.args[4]);
		    }
		    break;
		case "circle":
		    if( alen >= 3 ){
			obj.radius = getilen(robj.args[2], 1);
		    }
		    break;
		case "ellipse":
		    if( alen >= 3 ){
			obj.r1 = getilen(robj.args[2], 1);
		    }
		    if( alen >= 4 ){
			obj.r2 = getilen(robj.args[3], 2);
		    }
		    if( alen >= 5 ){
			obj.angle = getang(robj.args[4]);
		    }
		    break;
		case "line":
		case "polygon":
		    if( alen > 0 ){
			obj.pts = [];
			for(j=0, k=0; j<alen; j+=2, k++){
			    pos = getipos(robj.args[j], robj.args[j+1]);
			    if( JS9.notNull(pos.dx) && JS9.notNull(pos.dy) ){
				obj.pts[k] = {dx: pos.dx, dy: pos.dy};
			    } else {
				obj.pts[k] = {x: pos.x, y: pos.y};
			    }
			}
		    }
		    break;
		case "point":
		    break;
		case "text":
		    if( alen >= 3 ){
			obj.text = getstr(robj.args[2]);
		    }
		    if( alen >= 4 ){
			obj.angle = getang(robj.args[3]);
		    }
		    break;
		default:
		    break;
		}
		// comment contains the tags
		if( robj.comment ){
		    obj.tags = robj.comment;
		}
		// save this region
		regions.push(obj);
	    } else {
		// if its a wcs command
		if( robj.cmd.match(wcsrexp) ){
		    // reset the wcs system
		    txeq = JS9.globalOpts.xeqPlugins;
		    JS9.globalOpts.xeqPlugins = false;
		    this.setWCSSys(robj.cmd, false);
		    JS9.globalOpts.xeqPlugins = txeq;
		    // get new wcssys
		    wcssys = this.getWCSSys();
		    // is this a real wcs?
		    iswcs = JS9.isWCSSys(wcssys);
		} else if( robj.cmd === "remove" || robj.cmd === "delete" ){
		    regions.push({remove: true});
		}
	    }
	}
    }
    // restore original wcs
    txeq = JS9.globalOpts.xeqPlugins;
    JS9.globalOpts.xeqPlugins = false;
    this.setWCSSys(owcssys, false);
    this.setWCSUnits(owcsunits);
    JS9.globalOpts.xeqPlugins = txeq;
    // return the generated object
    return regions;
};

// save regions to a file
JS9.Regions.saveRegions = function(fname, which, layer){
    let i, s, t, header, regstr, format, blob, opts, arr, rid;
    // see if default type is implicit in the output file
    if( fname ){
	arr = fname.match(/\.([^.]*)$/);
	if( arr && arr[1] && arr[1].match(/^(reg|svg|csv)$/) ){
	    format = arr[1];
	}
    }
    // layer can be a layer name or an object describing layer, output type
    if( typeof layer === "object" ){
	opts = layer;
	layer = null;
    } else if( layer && typeof layer === "string" ){
	try{ opts = JSON.parse(layer); }
	catch(e){ opts = null; }
	if( opts ){ layer = null; }
    }
    // see if parameters are in the opts object
    if( opts ){
	// layer name
	if( JS9.notNull(opts.layer) ){
	    layer = opts.layer;
	}
	// old style 'type' property is now ...
	if( JS9.notNull(opts.type) ){
	    format = opts.type ;
	}
	// ... format
	if( JS9.notNull(opts.format) ){
	    format = opts.format ;
	}
    }
    // make sure we have an opts
    opts = opts || {};
    // last chance ... use defaults
    layer = layer || "regions";
    format =  format  || "reg";
    // and make a sanity check
    if( !this.layers[layer] ){
	JS9.error(`can't find layer for saveRegions: ${layer}`);
    }
    // construct final output file name, if necessary
    if( !fname ){
	if( layer !== "regions" ){
	    fname = `js9_${layer}.${format}`;
	} else {
	    fname = `js9.${format}`;
	}
    }
    // generate the specified output
    switch(format){
    case "svg":
	// convert layer to svg
	try{
	    // add border box, if necessary
	    if( JS9.globalOpts.svgBorder ){
		rid = this.addShapes(layer, "box",
				     {left:   this.rgb.img.width/2,
				      top:    this.rgb.img.height/2,
				      width:  this.rgb.img.width,
				      height: this.rgb.img.height,
				      color: "black",
				      strokeWidth: 1,
				      tags: "SVGBorder"
				     });
	    }
	    // convert canvas to SVG
	    s = this.layers[layer].dlayer.canvas.toSVG();
	    // remove border box, if necessary
	    if( JS9.globalOpts.svgBorder ){
		this.removeShapes(layer, rid);
	    }
	}
	catch(e){ JS9.error(`can't convert layer to SVG: ${layer}`);}
	break;
    case  "csv":
	// convert layer to region string
	try{
	    opts.mode = 1;
	    opts.file = fname;
	    // when saving csv, we might want to include the wcs info
	    if( JS9.isNull(opts.includewcs) ){
		opts.includewcs = JS9.globalOpts.csvIncludeWCS;
	    }
	    // when saving reg, we might want to exclude the dcoord shapes
	    if( JS9.isNull(opts.savedcoords) ){
		opts.includedcoords = JS9.globalOpts.regSaveDCoords;
	    }
	    // list of regions
	    regstr = this.listRegions(which, opts, layer);
	    // convert to csv
	    arr = regstr.split(";");
	    for(i=0, s=""; i<arr.length; i++){
		if( !arr[i] ){ continue; }
		if( arr[i].toLowerCase().match(JS9.WCSEXP) ){
		    if( opts.includewcs ){
			s += `${arr[i].trim()}\n`;
		    }
		} else {
		    t = arr[i].replace(/\(/, ",").replace(/\).*/, "").trim();
		    s += `${t}\n`;
		}
	    }
	}
	catch(e){ JS9.error(`can't convert layer to region: ${layer}`);	}
	break;
    case "reg":
    default:
	// convert layer to region string
	try{
	    header = "# Region file format: JS9 version 1.0";
	    opts.mode = 1;
	    opts.file = fname;
	    // when saving reg, we might want to exclude the json object
	    if( JS9.isNull(opts.includejson) ){
		opts.includejson = JS9.globalOpts.regIncludeJSON;
	    }
	    // when saving reg, we might want to exclude the comments
	    if( JS9.isNull(opts.includecomments) ){
		opts.includecomments = JS9.globalOpts.regIncludeComments;
	    }
	    // when saving reg, we might want to exclude the dcoord shapes
	    if( JS9.notNull(opts.savedcoords) ){
		opts.includedcoords = opts.savedcoords;
	    } else {
		opts.includedcoords = JS9.globalOpts.regSaveDCoords;
	    }
	    // list of regions
	    regstr = this.listRegions(which, opts, layer).replace(/; */g, "\n");
	    // add header, if necessary
	    if( opts.includecomments !== false ){
		s = `${header}\n${regstr}\n`;
	    } else {
		s = `${regstr}\n`;
	    }
	}
	catch(e){ JS9.error(`can't convert layer to region: ${layer}`);	}
	break;
    }
    // create the blob
    blob = new Blob([s], {type: "text/plain;charset=utf-8"});
    // save blob
    if( {}.hasOwnProperty.call(window, "saveAs") ){
	JS9.saveAs(blob, fname);
    } else {
	JS9.error("no saveAs() available to save region file");
    }
    // save file name
    this.tmp.saveregionsFile = fname;
    // return the filename
    return fname;
};

// unremove previously removed regions
JS9.Regions.unremoveRegions = function(){
    const s = this.regstack.pop();
    if( s ){
	return this.addShapes("regions", s);
    }
    return null;
};

// change region tags, e.g. set source, delete background
// e.g. im.changeRegionTags("selected", "source", "background");
// call using image context
JS9.Regions.changeRegionTags = function(which, addtags, remtags){
    let i, j, s, ctags, tags;
    which = which || "all";
    addtags = addtags || [];
    remtags = remtags || [];
    if( !JS9.isArray(addtags) ){
	addtags = addtags.split(",").map(i=>i.trim());
    }
    if( !JS9.isArray(remtags) ){
	remtags = remtags.split(",").map(i=>i.trim());
    }
    s = this.getShapes("regions", which);
    // for each shape ...
    for(i=0; i<s.length; i++){
	// current tags for this shape
	ctags = s[i].tags;
	// new tags for this shape
	tags = [];
	// add new tags, unless they already exist
	for(j=0; j<addtags.length; j++){
	    if( JS9.inArray(addtags[j], ctags) < 0 ){
		tags.push(addtags[j]);
	    }
	}
	// copy current tags, except the one we want to remove
	for(j=0; j<ctags.length; j++){
	    if( JS9.inArray(ctags[j], remtags) < 0 ){
		tags.push(ctags[j]);
	    }
	}
	this.changeShapes("regions", s[i].id, {tags});
    }
};

// toggle region tags, e.g. source <-> background, include <-> exclude
// e.g. im.toggleRegionTags("selected", "source", "background");
// call using image context
JS9.Regions.toggleRegionTags = function(which, x1, x2){
    let i, j, s, tags, xnew;
    which = which || "all";
    s = this.getShapes("regions", which);
    for(i=0; i<s.length; i++){
	tags = s[i].tags;
	xnew = "";
	for(j=0; j<tags.length; j++){
	    // switch tags
	    if( tags[j] === x1 ){
		tags[j] = x2;
		xnew = x2;
		break;
	    } else if( tags[j] === x2 ){
		tags[j] = x1;
		xnew = x1;
		break;
	    }
	}
	if( xnew ){
	    this.changeShapes("regions", s[i].id, {tags});
	}
    }
};

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
	if( {}.hasOwnProperty.call(window, "Spinner") &&
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
	if( {}.hasOwnProperty.call(window, "Spinner") &&
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
