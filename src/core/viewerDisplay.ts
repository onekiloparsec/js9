// @ts-nocheck
/* JS9 Colormap + Display class and Display.prototype methods. */
import { sprintf } from './sprintf';
import { ResizeSensor } from './browserCompat';
"use strict";

function JS9InstallDisplay(JS9) {

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
	typeof ResizeSensor === "function" ){
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
    // no context menus on the display: the secondary button is a JS9 action
    // (by default "pan the image"), so the browser menu must not steal it.
    // NB: returning false only cancelled the default under jQuery, so the
    // native listener has to call preventDefault() explicitly.
    this.divjq.on("contextmenu", this, (evt) => {
	evt.preventDefault();
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
    // change size of shape canvases. The native shape engine exposes width
    // and height as plain numeric properties on the canvas controller — no
    // fabric.js methods (setWidth/setHeight/calcOffset) are needed.
    for( key of Object.keys(this.layers) ){
	layer = this.layers[key];
	if( layer.dtype === "main" ){
	    layer.divjq.css("width", nwidth);
	    layer.divjq.css("height", nheight);
	    layer.canvasjq.attr("width", nwidth);
	    layer.canvasjq.attr("height", nheight);
	    if( layer.canvas ){
		layer.canvas.width = nwidth;
		layer.canvas.height = nheight;
		if( layer.canvas.element ){
		    layer.canvas.element.width = nwidth;
		    layer.canvas.element.height = nheight;
		}
	    }
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
	    JS9.ShapeEngine.updateChildren(dlayer, null, "objects");
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

} // end JS9InstallDisplay

if (typeof globalThis !== "undefined") {
    globalThis.JS9InstallDisplay = JS9InstallDisplay;
}
