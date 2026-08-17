// @ts-nocheck
/*
 * CloseUp plugin: a live, magnified view of the display centered on the
 * mouse position. Registered like the other ImExam widgets (analysis menu,
 * resizable light window), but driven by mouse movement instead of regions.
 */

/*global JS9 */

"use strict";

// create our namespace, and specify some meta-information and params
JS9.CloseUp = {};
JS9.CloseUp.CLASS = "ImExam";
JS9.CloseUp.NAME = "CloseUp";
JS9.CloseUp.BASE = JS9.CloseUp.CLASS + JS9.CloseUp.NAME;
JS9.CloseUp.WIDTH  = 250;	// width of light window
JS9.CloseUp.HEIGHT = 290;	// height of light window
JS9.CloseUp.SWIDTH  = 250;	// width of in-page div
JS9.CloseUp.SHEIGHT = 290;	// height of in-page div
JS9.CloseUp.READOUT = 40;	// height of the readout strip, in pixels

// defaults for the close-up
JS9.CloseUp.opts = {
    // display pixels per close-up pixel
    zoom: 8,
    minZoom: 1,
    maxZoom: 64,
    // color of the center-pixel marker
    markerColor: "#00FF00",
    // background behind (and outside) the image
    background: "#000000",
    // overlay the regions layer, as the magnifier does
    regions: true
};

// the plugin instantiation saves the display id in the toolbar div
const toolbarDisplayId = function(which){
    const node = JS9.resolveNode(which);
    const toolbar = node ? node.closest("div[class^=JS9PluginToolbar]") : null;
    return toolbar ? toolbar.dataset.displayid : null;
};

// the plugin instance for a display id, an image, or a display
JS9.CloseUp.getInstance = function(which){
    let display;
    if( !which ){ return null; }
    if( typeof which === "string" ){
	display = JS9.lookupDisplay(which);
    } else {
	display = which.display || which;
    }
    if( !display || !display.pluginInstances ){ return null; }
    return display.pluginInstances[JS9.CloseUp.BASE] || null;
};

// html used by the close-up plugin toolbar
JS9.CloseUp.HTML =
`<span>` +
`<button type='button' class='JS9Button' onClick='JS9.CloseUp.bcall(this, "zoomCloseUp", "x2"); return false'>&times;2</button>` +
`<button type='button' class='JS9Button' onClick='JS9.CloseUp.bcall(this, "zoomCloseUp", "/2"); return false'>&times;1/2</button>` +
`<button type='button' class='JS9Button' onClick='JS9.CloseUp.bcall(this, "zoomCloseUp", "${JS9.CloseUp.opts.zoom}"); return false'>[${JS9.CloseUp.opts.zoom}]</button>` +
`</span>`;

// call a JS9 routine from a button in the close-up plugin toolbar
JS9.CloseUp.bcall = function(which, cmd, arg1){
    const pinst = JS9.CloseUp.getInstance(toolbarDisplayId(which));
    // the window can be open with nothing loaded: nothing to do, but no error
    if( !pinst ){ return; }
    switch(cmd){
    case "zoomCloseUp":
	JS9.CloseUp.zoom(pinst, arg1);
	break;
    default:
	break;
    }
};

// change the close-up zoom ("x2", "/2", or an absolute value) and redraw
JS9.CloseUp.zoom = function(pinst, zval){
    let nzoom;
    const opts = JS9.CloseUp.opts;
    const ozoom = pinst.zoom || opts.zoom;
    switch(String(zval).charAt(0)){
    case "x":
    case "*":
	nzoom = ozoom * parseFloat(String(zval).slice(1));
	break;
    case "/":
	nzoom = ozoom / parseFloat(String(zval).slice(1));
	break;
    default:
	nzoom = parseFloat(zval);
	break;
    }
    if( !nzoom || !isFinite(nzoom) ){ nzoom = opts.zoom; }
    pinst.zoom = Math.max(opts.minZoom, Math.min(opts.maxZoom, nzoom));
    // redraw at the last known position
    JS9.CloseUp.display.call(pinst, pinst.display.image, pinst.ipos);
};

// value of the image pixel under an image position, as a display string
JS9.CloseUp.pixelValue = function(im, ipos){
    let val;
    const x = Math.floor(ipos.x - 0.5);
    const y = Math.floor(ipos.y - 0.5);
    // reuse the value the mousemove handler already formatted, if we have it
    if( im.valpos && im.valpos.val3 !== undefined ){
	return String(im.valpos.val3);
    }
    if( !im.raw || !im.raw.data ){ return ""; }
    if( x < 0 || y < 0 || x >= im.raw.width || y >= im.raw.height ){ return ""; }
    val = im.raw.data[(y * im.raw.width) + x];
    if( val === undefined ){ return ""; }
    return JS9.floatFormattedString(val, im.params.precision, 3);
};

// JS9 CloseUp constructor
JS9.CloseUp.init = function(width, height){
    let w, h;
    const opts = JS9.CloseUp.opts;
    // explicit data attributes win, then the divArgs passed by the caller
    w = parseInt(this.divjq.attr("data-width"), 10)  || width  || 0;
    h = parseInt(this.divjq.attr("data-height"), 10) || height || 0;
    // in a light window the div is already sized (100% of the window), so
    // only impose a size when we were actually given one
    if( w ){ this.divjq.css("width", w); }
    if( h ){ this.divjq.css("height", h); }
    // current close-up zoom, and last position we drew
    this.zoom = opts.zoom;
    this.ipos = null;
    // container: canvas on top, readout underneath
    this.container = document.createElement("div");
    this.container.className = "JS9CloseUpContainer";
    this.container.style.cssText =
	"width: 100%; height: 100%; overflow: hidden; " +
	`background: ${opts.background};`;
    // the close-up canvas
    this.canvas = document.createElement("canvas");
    this.canvas.className = "JS9CloseUp";
    this.canvas.style.cssText = "display: block; width: 100%;";
    this.context = this.canvas.getContext("2d");
    this.context.imageSmoothingEnabled = false;
    this.container.appendChild(this.canvas);
    // the readout strip
    this.readout = document.createElement("div");
    this.readout.className = "JS9CloseUpReadout";
    this.readout.style.cssText =
	`height: ${JS9.CloseUp.READOUT}px; box-sizing: border-box; ` +
	"padding: 3px 6px; overflow: hidden; white-space: nowrap; " +
	"font-family: ui-monospace, Menlo, Consolas, monospace; " +
	"font-size: 11px; line-height: 16px; color: #d8dde6; " +
	"background: #1b1e24;";
    this.readoutPos = document.createElement("div");
    this.readoutWcs = document.createElement("div");
    this.readout.appendChild(this.readoutPos);
    this.readout.appendChild(this.readoutWcs);
    this.container.appendChild(this.readout);
    this.divjq.append(this.container);
    // change the close-up zoom with the wheel, without zooming the image
    this.canvas.addEventListener("wheel", (evt) => {
	evt.preventDefault();
	evt.stopPropagation();
	JS9.CloseUp.zoom(this, evt.deltaY < 0 ? "x2" : "/2");
    });
    // draw whatever is current
    JS9.CloseUp.display.call(this, this.display.image);
};

// size the canvas to the div, allowing for the readout strip
JS9.CloseUp.resize = function(pinst){
    const w = Math.max(1, pinst.div.clientWidth);
    const h = Math.max(1, pinst.div.clientHeight - JS9.CloseUp.READOUT);
    if( (pinst.canvas.width !== w) || (pinst.canvas.height !== h) ){
	pinst.canvas.width = w;
	pinst.canvas.height = h;
	// resizing a canvas resets its context state
	pinst.context.imageSmoothingEnabled = false;
    }
};

// update the readout strip under the close-up
JS9.CloseUp.updateReadout = function(pinst, im, ipos){
    let s;
    if( !im || !ipos ){
	pinst.readoutPos.textContent = "move the mouse over the image";
	pinst.readoutWcs.textContent = "";
	return;
    }
    s = `x ${ipos.x.toFixed(2)}  y ${ipos.y.toFixed(2)}`;
    s += `   ${JS9.CloseUp.pixelValue(im, ipos)}`;
    pinst.readoutPos.textContent = s;
    if( im.valpos && im.valpos.wcspos ){
	pinst.readoutWcs.textContent =
	    `${im.valpos.wcspos} ${im.valpos.wcssys || ""}`.trim();
    } else {
	pinst.readoutWcs.textContent = `zoom ${pinst.zoom}x`;
    }
};

// draw the close-up: "this" is the plugin instance
JS9.CloseUp.display = function(im, ipos){
    let pos, dispW, dispH, sw, sh, sx0, sy0, ox, oy, bx, by, ratio, rcanvas;
    const pinst = this;
    const opts = JS9.CloseUp.opts;
    const ctx = pinst.context;
    // sanity check
    if( !ctx ){ return; }
    JS9.CloseUp.resize(pinst);
    const cw = pinst.canvas.width;
    const ch = pinst.canvas.height;
    // start from a clean background: it also fills the area outside the image
    ctx.clear();
    ctx.fillStyle = opts.background;
    ctx.fillRect(0, 0, cw, ch);
    // remember the position so toolbar/wheel zoom changes can redraw
    if( ipos ){ pinst.ipos = ipos; }
    ipos = ipos || pinst.ipos;
    if( !im || !im.display || !im.display.canvas || !ipos ){
	JS9.CloseUp.updateReadout(pinst, null, null);
	return;
    }
    dispW = im.display.canvas.width;
    dispH = im.display.canvas.height;
    // source rectangle, in whole display pixels, centered on the cursor
    sw = Math.max(1, Math.round(cw / pinst.zoom));
    sh = Math.max(1, Math.round(ch / pinst.zoom));
    pos = im.imageToDisplayPos(ipos);
    sx0 = Math.floor(pos.x) - Math.floor(sw / 2);
    sy0 = Math.floor(pos.y) - Math.floor(sh / 2);
    // center the magnified rectangle in the canvas
    ox = Math.floor((cw - (sw * pinst.zoom)) / 2);
    oy = Math.floor((ch - (sh * pinst.zoom)) / 2);
    // blit the part of a display-sized canvas that falls inside the source
    // rectangle, clipped to the canvas bounds so the edges stay aligned
    const blit = (canvas, scale) => {
	const rx0 = Math.max(0, sx0);
	const ry0 = Math.max(0, sy0);
	const rx1 = Math.min(dispW, sx0 + sw);
	const ry1 = Math.min(dispH, sy0 + sh);
	if( (rx1 <= rx0) || (ry1 <= ry0) ){ return; }
	ctx.drawImage(canvas,
		      rx0 * scale, ry0 * scale,
		      (rx1 - rx0) * scale, (ry1 - ry0) * scale,
		      ox + ((rx0 - sx0) * pinst.zoom),
		      oy + ((ry0 - sy0) * pinst.zoom),
		      (rx1 - rx0) * pinst.zoom, (ry1 - ry0) * pinst.zoom);
    };
    blit(im.display.canvas, 1);
    // overlay the regions layer. Depending on the shape engine, its canvas
    // is either display-sized or backed by a larger hi-dpi store, so take
    // the scale from the canvas itself rather than assuming a pixel ratio.
    if( opts.regions && im.display.layers && im.display.layers.regions ){
	rcanvas = im.display.layers.regions.canvas.getElement();
	ratio = rcanvas.width / dispW;
	if( ratio > 0 ){ blit(rcanvas, ratio); }
    }
    // mark the pixel under the cursor
    bx = ox + (Math.floor(sw / 2) * pinst.zoom);
    by = oy + (Math.floor(sh / 2) * pinst.zoom);
    ctx.save();
    ctx.strokeStyle = opts.markerColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5,
		   Math.max(1, pinst.zoom - 1), Math.max(1, pinst.zoom - 1));
    // ticks pointing at the marker, so it stays findable at any zoom
    ctx.beginPath();
    ctx.moveTo(bx + (pinst.zoom / 2), 0);
    ctx.lineTo(bx + (pinst.zoom / 2), Math.max(0, by - 4));
    ctx.moveTo(bx + (pinst.zoom / 2), by + pinst.zoom + 4);
    ctx.lineTo(bx + (pinst.zoom / 2), ch);
    ctx.moveTo(0, by + (pinst.zoom / 2));
    ctx.lineTo(Math.max(0, bx - 4), by + (pinst.zoom / 2));
    ctx.moveTo(bx + pinst.zoom + 4, by + (pinst.zoom / 2));
    ctx.lineTo(cw, by + (pinst.zoom / 2));
    ctx.globalAlpha = 0.4;
    ctx.stroke();
    ctx.restore();
    JS9.CloseUp.updateReadout(pinst, im, ipos);
};

// redraw at the last known position, once the display has settled.
// NB: region callbacks pass the region object as their second argument, so
// this must not forward it as a position.
JS9.CloseUp.refresh = function(im){
    const pinst = this;
    window.setTimeout(() => {
	JS9.CloseUp.display.call(pinst, im, null);
    }, 0);
};

// clear the close-up when the image goes away
JS9.CloseUp.clear = function(im){
    const pinst = this;
    if( !pinst.context ){ return; }
    // ignore images that are not the one currently on display
    if( im && im.display.image && (im !== im.display.image) ){ return; }
    pinst.ipos = null;
    JS9.CloseUp.display.call(pinst, null, null);
};

// add plugin to JS9
JS9.RegisterPlugin(JS9.CloseUp.CLASS, JS9.CloseUp.NAME, JS9.CloseUp.init,
		   {menu: "analysis",
		    menuItem: "Close-up",
		    winTitle: "Close-up",
		    help: "help/closeup.html",
		    dynamicSelect: true,
		    toolbarSeparate: true,
		    toolbarHTML: JS9.CloseUp.HTML,
		    winResize: true,
		    onmousemove: JS9.CloseUp.display,
		    // keep tracking the cursor while a region is being dragged
		    onmousemove_inRegion: true,
		    onplugindisplay: JS9.CloseUp.refresh,
		    onimagedisplay: JS9.CloseUp.refresh,
		    onregionsmove: JS9.CloseUp.refresh,
		    onregionschange: JS9.CloseUp.refresh,
		    onimageclose: JS9.CloseUp.clear,
		    onimageclear: JS9.CloseUp.clear,
		    winDims: [JS9.CloseUp.WIDTH, JS9.CloseUp.HEIGHT],
		    divArgs: [JS9.CloseUp.SWIDTH, JS9.CloseUp.SHEIGHT]});
