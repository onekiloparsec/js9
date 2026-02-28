/* JS9 browser viewer core. Attribution is centralized in README.md. */

/*global fabric, sprintf, window, document, navigator */

"use strict";

function JS9InstallFabricEngine(JS9){
const sameMembers = function(arr1, arr2){
    const list1 = JS9.isArray(arr1) ? arr1 : [];
    const list2 = JS9.isArray(arr2) ? arr2 : [];
    return list1.every((item) => JS9.inArray(item, list2) >= 0) &&
	list2.every((item) => JS9.inArray(item, list1) >= 0);
};

// Graphics support using fabric.js
//
// Fabric object defines graphical primitives
// ---------------------------------------------------------------------

// quick way to separate fabric versions
fabric.major_version = parseFloat(fabric.version.split(".")[0]);
fabric.minor_version = parseFloat(fabric.version.split(".")[1]);
fabric.patch_version = parseFloat(fabric.version.split(".")[2]);

// fabric sub-object to hold fabric routines
JS9.Fabric = {};

// extra fabric elements to save when switching between images

JS9.Fabric.elements = ["cornerSize", "cornerColor", "cornerStyle",
		       "borderColor",
		       "transparentCorners", "selectionLineWidth",
		       "centeredScaling", "hasControls", "hasRotatingPoint",
		       "lockMovementX", "lockMovementY", "lockRotation",
		       "lockScalingX", "lockScalingY", "lockUniScaling",
		       "selectable", "hasBorders", "params", "pub"];

// global options for all shapes
JS9.Fabric.opts = {
    // default fabric.js options
    originX: "center",
    originY: "center",
    strokeWidth: 2,
    selectionLineWidth: 2,
    borderColor: "#00EEFF",
    cornerColor: "#00EEFF",
    cornerSize: fabric.isTouchSupported ? 10 : 6,
    cornerStyle: "circle",
    hasControls: true,
    hasRotatingPoint: true,
    hasBorders: true,
    transparentCorners: false,
    centeredScaling: true,
    strokeUniform: true,
    selectable: true,
    // minimizes the jump when first changing the region size
    padding: 0,
    canvas: {
	selection: true
    },
    fill: "transparent",
    objectCaching: false
};

// rescale the width of shapes in the shape layers
JS9.Fabric.rescaleStrokeWidth = function(scale, sw1){
    const tscale = ((this.scaleX + this.scaleY) / 2);
    // fabric 3.6.3+ supports strokeUniform, including for groups
    if( fabric.major_version >= 4    ||
	(fabric.major_version === 3  &&
	 fabric.minor_version === 6  &&
	 fabric.patch_version >=  3) ){
	return;
    }
    // fabric 2+ supports strokeUniform, but not for groups
    // still, it fixes the different strokeWidth problem for rectangular boxes
    if( fabric.major_version >= 2 && this.params &&
	this.params.shape !== "annulus" && this.params.shape !== "cross" ){
	return;
    }
    scale = scale || 1;
    scale *= tscale;
    if( !sw1 && this.params ){
	sw1 = this.params.sw1;
    }
    if( !sw1 ){
	return;
    }
    if( this.type === "group" ){
	this.forEachObject( (obj) => {
	    obj.rescaleBorder(scale, sw1);
	});
    } else {
	this.set("strokeWidth", sw1 / scale);
    }
};

// ensure the circle scales the same in X and Y
JS9.Fabric.rescaleEvenly = function(){
    let lastscale;
    if( !this.params || (this.scaleX === this.scaleY) ){
	return;
    }
    switch(this.params.shape){
    case "annulus":
    case "circle":
	lastscale = this.params.lastscale || 1;
	if( this.scaleX !== lastscale ){
	    this.scaleY = this.scaleX;
	} else if( this.scaleY !== lastscale ){
	    this.scaleX = this.scaleY;
	}
	this.params.lastscale = this.scaleX;
	break;
    }
};

// add to fabric object prototype
fabric.Object.prototype.rescaleBorder = JS9.Fabric.rescaleStrokeWidth;
fabric.Object.prototype.rescaleEvenly = JS9.Fabric.rescaleEvenly;

// ---------------------------------------------------------------------
// Shape prototype additions to JS9 Display class
// ---------------------------------------------------------------------

// create a new shape layer in the display
// call using display context
JS9.Fabric.newShapeLayer = function(layerName, layerOpts, divjq){
    let id, dlayer;
    const display = this;
    const shupdate = (obj, s) => {
	let i, o, objs;
	let im = dlayer.display.image;
	let ao = dlayer.canvas.getActiveObject();
	let opts = {};
	// sanity check
	if( !im ){ return; }
	if( obj.params ){
	    if( ao.type === "activeSelection" ){
		opts.group = ao;
	    }
	    im._updateShape(layerName, obj, opts, s);
	} else if( (obj.type === "activeSelection")      ||
		   (obj.type === "group" && !obj.params) ){
	    objs = obj.getObjects();
	    for(i=0; i<objs.length; i++){
		o = objs[i];
		if( o.params ){
		    opts.group = obj;
		    im._updateShape(layerName, o, opts, s);
		}
	    }
	}
    };
    const seldialog = (setmode) => {
	// sanity check
	if( !display.image ){ return; }
	// update multiselect dialog box for this image, if necessary
	dlayer.display.image._updateMultiDialogs(setmode);
    }
    const seloff = (dlayer, obj) => {
	// reset currently selected
	dlayer.params.sel = null;
	// reset currently selected layer
	if( dlayer.display.image ){
	    dlayer.display.image.layer = null;
	}
	// selection cleared processing
	// remove anchors from previously selected polygon
	if( obj ){
	    switch(obj.type){
	    case "polyline":
	    case "polygon":
		JS9.Fabric.removePolygonAnchors(dlayer, obj);
		// renderAll() throws an error, might be related to:
		// http://fabricjs.com/v2-breaking-changes-2
		// dlayer.canvas.renderAll();
		break;
	    }
	    // region updates
	    shupdate(obj, "unselect");
	    // update multi-select dialog
	    seldialog(-1);
	}
    };
    // eslint-disable-next-line no-unused-vars
    const selmultioff = (dlayer, opts) => {
	let i, obj, aobjects;
	aobjects = dlayer.canvas.getActiveObjects();
	for(i=0; i<aobjects.length; i++){
	    obj = aobjects[i];
	    seloff(dlayer, obj);
	}
	// update multi-select dialog
	seldialog(-1);
    };
    const selon = (dlayer, obj) => {
	// turn off previous selection, if necessary
	if( dlayer.params.sel && obj.params && (dlayer.params.sel !== obj) ){
	    seloff(dlayer, dlayer.params.sel);
	}
	// set currently selected layer
	if( dlayer.display.image ){
	    dlayer.display.image.layer = layerName;
	}
	// new selection processing
	if( obj ){
	    // add anchors to selected polygon
	    switch(obj.type){
	    case "polyline":
	    case "polygon":
		JS9.Fabric.addPolygonAnchors(dlayer, obj);
		dlayer.canvas.renderAll();
		break;
	    }
	    // set currently selected shape
	    if( obj.polyparams ){
		dlayer.params.sel = obj.polyparams.polygon;
	    } else if( obj.params ){
		dlayer.params.sel = obj;
	    }
	    // region updates
	    shupdate(obj, "select");
	    // update multi-select dialog
	    seldialog(1);
	}
    };
    // eslint-disable-next-line no-unused-vars
    const selmultion = (dlayer, opts, activeObject) => {
	let i, j, obj, parent, child, objs;
	// turn off previous selection, if necessary
	if( dlayer.params.sel && (dlayer.params.sel !== activeObject) ){
	    seloff(dlayer, dlayer.params.sel);
	}
	// get current active object if necessary
	activeObject = activeObject || dlayer.canvas.getActiveObject();
	// and the associated objects
	objs = dlayer.canvas.getActiveObjects();
	for(i=0; i<objs.length; i++){
	    obj = objs[i];
	    // add parent, if not already added
	    if( obj.params && obj.params.parent && obj.params.parent.obj ){
		parent = obj.params.parent.obj;
		if( JS9.inArray(parent, objs) < 0 ){
		    activeObject.addWithUpdate(parent);
		}
	    }
	    // add children, if not already added
	    if( obj.params && obj.params.children ){
		for(j=0; j<obj.params.children.length; j++){
		    child = obj.params.children[j].obj;
		    if( JS9.inArray(child, objs) < 0 ){
			activeObject.addWithUpdate(child);
		    }
		}
	    }
	    switch(obj.type){
	    case "polyline":
	    case "polygon":
		if( obj.params ){
		    JS9.Fabric.removePolygonAnchors(dlayer, obj);
		}
		break;
	    }
	    shupdate(obj, "select");
	}
	// redraw everything
	dlayer.canvas.renderAll();
	// update multi-select dialog
	seldialog(1);
    };
    // sanity check
    if( !display || !layerName ){ return; }
    // only do this once
    if( display.layers[layerName] ){
	return display.layers[layerName];
    }
    // create the new display layer
    display.layers[layerName] = {};
    // convenience variable(s)
    dlayer = display.layers[layerName];
    // backlink to name
    dlayer.layerName = layerName;
    // usual place to save parameters
    dlayer.params = [];
    // no last selected yet
    dlayer.params.sel = null;
    // no last selected layer yet
    dlayer.params.sellayer = null;
    // where to attach the graphics canvas
    if( divjq ){
	dlayer.dtype = "other";
    } else {
	dlayer.dtype = "main";
	divjq = display.divjq;
    }
    // id
    id = `${divjq.attr("id")}-${layerName.replace(/\s+/,"_")}-shapeLayer`;
    // backlink
    dlayer.display = display;
    // default options for this layer (deep copy)
    dlayer.opts = JS9.extend(true, {}, layerOpts);
    // and some needed properties
    dlayer.opts.canvas = dlayer.opts.canvas || {};
    if( dlayer.opts.canvas.selection === undefined ){
	dlayer.opts.canvas.selection = true;
    }
    // additional fabric elements to save using toJSON
    dlayer.el = JS9.Fabric.elements;
    // create container div and append to target
    // start with low zindex, until we add shapes
    dlayer.divjq = JS9.wrapCollection(document.createElement("div"));
    dlayer.divjq
	.addClass("JS9Container")
	.css("z-index", 0)
	.appendTo(divjq);
    // create canvas element and append to container
    dlayer.canvasjq = JS9.wrapCollection(document.createElement("canvas"));
    dlayer.canvasjq
        .addClass("JS9Layer")
	.attr("id", id)
	.attr("width", divjq.css("width"))
	.attr("height", divjq.css("height"))
	.appendTo(dlayer.divjq);
    if( JS9.bugs.webkit_resize && dlayer.dtype === "main" ){
	dlayer.canvasjq
	    .attr("width",  display.width)
	    .attr("height", display.height);
    }
    // new fabric canvas associated with this HTML canvas
    dlayer.canvas = new fabric.Canvas(dlayer.canvasjq[0]);
    // don't render on add or remove of objects (do it manually)
    dlayer.canvas.renderOnAddRemove = false;
    // preserve stacking (required in v1.6.6 to interact with polygon points)
    dlayer.canvas.preserveObjectStacking = true;
    // movable: short-hand for allowing objects to move (not resize)
    if( dlayer.opts.movable ){
	dlayer.opts.lockMovementX = false;
	dlayer.opts.lockMovementY = false;
	dlayer.opts.selectable = true;
	dlayer.opts.evented = true;
    } else if( dlayer.opts.movable === false ){
	dlayer.opts.lockMovementX = true;
	dlayer.opts.lockMovementY = true;
	dlayer.opts.selectable = false;
	dlayer.opts.evented = false;
    }
    // deprecated
    if( (dlayer.opts.changeable === undefined) &&
	(dlayer.opts.fixinplace !== undefined) ){
	dlayer.opts.changeable = !dlayer.opts.fixinplace;
    }
    // locked: opposite alias of changeable
    if( (dlayer.opts.changeable === undefined) &&
	(dlayer.opts.locked !== undefined)     ){
	dlayer.opts.changeable = !dlayer.opts.locked;
    }
    // changeable: short-hand for allowing objects to move and resize
    if( dlayer.opts.changeable ){
	dlayer.opts.hasControls = true;
	dlayer.opts.hasRotatingPoint = true;
	dlayer.opts.hasBorders = true;
	dlayer.opts.lockMovementX = false;
	dlayer.opts.lockMovementY = false;
	dlayer.opts.lockRotation = false;
	dlayer.opts.lockScalingX = false;
	dlayer.opts.lockScalingY = false;
	dlayer.opts.lockUniScaling = false;
	dlayer.opts.selectable = true;
	dlayer.opts.evented = true;
	dlayer.opts.usekeyboard = true;
    } else if( dlayer.opts.changeable === false ){
	dlayer.opts.hasControls = false;
	dlayer.opts.hasRotatingPoint = false;
	dlayer.opts.hasBorders = false;
	dlayer.opts.lockMovementX = true;
	dlayer.opts.lockMovementY = true;
	dlayer.opts.lockRotation = true;
	dlayer.opts.lockScalingX = true;
	dlayer.opts.lockScalingY = true;
	dlayer.opts.lockUniScaling = true;
	dlayer.opts.selectable = false;
	dlayer.opts.evented = false;
	dlayer.opts.usekeyboard = false;
    }
    // short-hand for allowing group and individual selections
    if( dlayer.opts.selectable ){
	dlayer.opts.canvas.selection = true;
    }
    // are mouse callbacks defined in the opts object?
    if( dlayer.opts.onmousedown || dlayer.opts.onmouseup  ||
	dlayer.opts.onmousemove || dlayer.opts.tooltip    ||
	dlayer.opts.onmouseover || dlayer.opts.onmouseout ){
	dlayer.opts.evented = true;
	if( dlayer.opts.onmousedown ){
	    dlayer.canvas.on("mouse:down", (opts) => {
		if( dlayer.display.image && opts.target ){
		    let target = opts.target;
		    // nb: target might be a polygon anchor => no params
		    let params = target.params;
		    // set click state but ignore unchangeable regions
		    if( !params || (params && params.changeable !== false) ){
			// on main window, set region click
			if( dlayer.dtype === "main" ){
			    dlayer.display.image.clickInRegion = true;
			    dlayer.display.image.clickInLayer = layerName;
			}
			dlayer.opts.onmousedown.call(dlayer.canvas,
						     dlayer.display.image,
						     target.pub,
						     opts.e, target);
		    }
		} else {
		    // only allow fabric selection if we have special key down
		    dlayer.canvas._selection = dlayer.canvas.selection;
		    if( dlayer.canvas.selection ){
			dlayer.canvas.selection = JS9.specialKey(opts.e);
		    }
		}
	    });
	} else {
	    dlayer.canvas.on("mouse:down", (opts) => {
		// only allow fabric selection if we have special key down
		dlayer.canvas._selection = dlayer.canvas.selection;
		if( dlayer.canvas.selection ){
		    dlayer.canvas.selection = JS9.specialKey(opts.e);
		}
	    });
	}
	if( dlayer.opts.onmouseup ){
	    dlayer.canvas.on("mouse:up", (opts) => {
		if( dlayer.display.image && opts.target ){
		    dlayer.opts.onmouseup.call(dlayer.canvas,
					       dlayer.display.image,
					       opts.target.pub,
					       opts.e, opts.target);
		}
		// restore original selection state
		dlayer.canvas.selection = dlayer.canvas._selection ||
		                          dlayer.canvas.selection;
	    });
	} else {
	    dlayer.canvas.on("mouse:up", () => {
		// restore original selection state
		dlayer.canvas.selection = dlayer.canvas._selection ||
                                          dlayer.canvas.selection;
	    });
	}
	if( dlayer.opts.onmousemove ){
	    dlayer.canvas.on("mouse:move", (opts) => {
		if( dlayer.display.image && opts.target ){
		    dlayer.opts.onmousemove.call(dlayer.canvas,
						 dlayer.display.image,
						 opts.target.pub,
						 opts.e, opts.target);
		}
	    });
	}
	if( dlayer.opts.onmouseover ){
	    dlayer.canvas.on("mouse:over", (opts) => {
		if( dlayer.display.image && opts.target ){
		    dlayer.opts.onmouseover.call(dlayer.canvas,
						 dlayer.display.image,
						 opts.target.pub,
						 opts.e, opts.target);
		}
	    });
	}
	if( dlayer.opts.onmouseout ){
	    dlayer.canvas.on("mouse:out", (opts) => {
		if( dlayer.display.image && opts.target ){
		    dlayer.opts.onmouseout.call(dlayer.canvas,
						dlayer.display.image,
						opts.target.pub,
						opts.e, opts.target);
		}
	    });
	}
	if( dlayer.opts.onmousedblclick ){
	    dlayer.canvas.on("mouse:dblclick", (opts) => {
		if( dlayer.display.image && opts.target ){
		    dlayer.opts.onmousedblclick.call(dlayer.canvas,
						     dlayer.display.image,
						     opts.target.pub,
						     opts.e, opts.target);
		}
	    });
	}
	if( dlayer.opts.tooltip ){
	    dlayer.canvas.on("mouse:over", (opts) => {
		if( dlayer.display.image && opts.target ){
		    JS9.tooltip(opts.target.left+opts.target.width+2,
				opts.target.top+opts.target.height+2,
				dlayer.opts.tooltip,
				dlayer.display.image,
				opts.target.pub,
				opts.e, opts.target);
		}
	    });
	    dlayer.canvas.on("mouse:out", (opts) => {
		if( dlayer.display.image && opts.target ){
		    JS9.tooltip(opts.target.left, opts.target.top,
				null,
				dlayer.display.image,
				opts.target.pub,
				opts.e, opts.target);
		}
	    });
	}
    } else {
	dlayer.canvas.on("mouse:down", (opts) => {
	    // only allow fabric selection if we have special key down
	    dlayer.canvas._selection = dlayer.canvas.selection;
	    if( dlayer.canvas.selection ){
		dlayer.canvas.selection = JS9.specialKey(opts.e);
	    }
	});
	dlayer.canvas.on("mouse:up", () => {
	    // restore original selection state
	    dlayer.canvas.selection = dlayer.canvas._selection ||
                                      dlayer.canvas.selection;
	});
    }
    // object modified
    dlayer.canvas.on("object:modified", (opts) => {
	let o, i, olen, myWidth, myHeight;
	const objs = [];
	// sanity check
	if( !opts.target ){ return; }
	o = opts.target;
	// update deltas to connected parents
	JS9.Fabric.updateChildren(dlayer, o, "deltas");
	// might have to sort overlapping shapes by size
	if( dlayer.opts.sortOverlapping ){
	    o.setCoords();
	    // find objects which intersect with this one
	    dlayer.canvas.forEachObject( (obj) => {
		if( obj === o ){
		    return;
		}
		if( o.intersectsWithObject(obj) ){
		    myWidth = obj.getScaledWidth();
		    myHeight = obj.getScaledHeight();
		    objs.push({obj: obj, siz: myWidth * myHeight});
		}
	    });
	    // any intersecting shapes?
	    if( !objs.length ){
		return;
	    }
	    myWidth = o.getScaledWidth();
	    myHeight = o.getScaledHeight();
	    // add current shape to array
	    objs.push({obj: o, siz: myWidth * myHeight});
	    // sort in order of increasing size
	    objs.sort((a, b) => {
		// using <= instead of < preserves order for =
		if( a.siz <= b.siz ){
		    return -1;
		} else {
		    return 1;
		}
	    });
	    // re-order so smaller objects are in front
	    olen = objs.length;
	    for(i=0; i<olen; i++){
		try{ objs[i].obj.sendToBack(); }
		catch(e){ /* empty */ }
	    }
	}
    });
    // object scaled: reset stroke width
    dlayer.canvas.on("object:scaling", (opts) => {
	let o;
	// sanity check
	if( !opts.target ){ return; }
	o = opts.target;
	o.rescaleEvenly();
	o.rescaleBorder();
	JS9.Fabric.updateChildren(dlayer, o, "scaling");
	if( (o.type === "activeSelection") || (o.type === "group") ){
	    shupdate(o, "scaling");
	}
    });
    dlayer.canvas.on("object:moving", (opts) => {
	let o;
	// sanity check
	if( !opts.target ){ return; }
	o = opts.target;
	JS9.Fabric.updateChildren(dlayer, o, "moving");
	if( (o.type === "activeSelection") || (o.type === "group") ){
	    shupdate(o, "moving");
	}
    });
    dlayer.canvas.on("object:rotating", (opts) => {
	let o;
	// sanity check
	if( !opts.target ){ return; }
	o = opts.target;
	JS9.Fabric.updateChildren(dlayer, o, "rotating");
	if( (o.type === "activeSelection") || (o.type === "group") ){
	    shupdate(o, "rotating");
	}
    });
    // selection created: add anchors to polygon
    dlayer.canvas.on("selection:created", (opts) => {
	let obj;
	if( JS9.globalOpts.skipSelectionProcessing ){ return; }
	if( opts.target ){
	    // fabric v4
	    obj = opts.target;
	    if(  obj.type === "activeSelection"      ||
		 (obj.type === "group" && !obj.params) ){
		selmultion(dlayer, opts, obj);
	    } else {
		selon(dlayer, obj);
	    }
	} else if( opts.selected && opts.selected.length ){
	    // fabric v5
	    if( opts.selected.length === 1 ){
		obj = opts.selected[0];
		selon(dlayer, obj);
	    } else {
		selmultion(dlayer, opts);
	    }
	}
    });
    // selection updated (adding a region to the current selection):
    // add anchors to polygon
    dlayer.canvas.on("selection:updated", (opts) => {
	let obj;
	if( JS9.globalOpts.skipSelectionProcessing ){ return; }
	if( opts.target ){
	    // fabric v4
	    obj = opts.target;
	    if( obj.type === "activeSelection"        ||
		(obj.type === "group" && !obj.params) ){
		selmultion(dlayer, opts, obj);
	    } else {
		selon(dlayer, obj);
	    }
	} else if( opts.selected && opts.selected.length ){
	    // fabric v5
	    if( opts.selected.length === 1 ){
		obj = opts.selected[0];
		selon(dlayer, obj);
	    } else {
		selmultion(dlayer, opts);
	    }
	}
    });
    // selection cleared
    // v5: why does this work differently from the selection: events above???
    // (i.e. still utilizes obj.target instead of obj.selected)
    dlayer.canvas.on("before:selection:cleared", (opts) => {
	let obj;
	if( JS9.globalOpts.skipSelectionProcessing ){ return; }
	// sanity check
	if( !opts.target ){ return; }
	obj = opts.target;
	if(  obj.type === "activeSelection"        ||
	     (obj.type === "group" && !obj.params) ){
	    selmultioff(dlayer, opts);
	} else {
	    seloff(dlayer, obj);
	}
    });
    // if canvas moves (e.g. light window), calcOffset must be called ...
    // there is no good cross-browser way to track an element changing,
    // (advice is to set a timer!) so we just check when the mouse enters the
    // div, because this is when the user will interact with some shape
    // only do this if we are in a light window
    if( dlayer.divjq.closest(JS9.lightOpts[JS9.LIGHTWIN].drag).length ){
	if( fabric.isTouchSupported ){
	    dlayer.divjq.on("touchstart", () => {dlayer.canvas.calcOffset();});
	} else {
	    dlayer.divjq.on("mouseenter", () => {dlayer.canvas.calcOffset();});
	}
    }
    return dlayer;
};

// ---------------------------------------------------------------------------
// Shape prototype additions to JS9 Image class
// ---------------------------------------------------------------------------

// showShapeLayer: if mode is true, layer is displayed, otherwise hidden
// also an internal call which uses {local: true} to maybe hide/show layers
// call using image context
JS9.Fabric.showShapeLayer = function(layerName, mode, opts){
    let jobj, xkey, layer, dlayer, canvas, objects, olen, obj;
    let left = 0;
    layer = this.getShapeLayer(layerName);
    // sanity check
    if( !layer ){ return; }
    // opts is optional
    opts = opts || {};
    // opts can be an object or json
    if( typeof opts === "string" ){
	try{ opts = JSON.parse(opts); }
	catch(e){ JS9.error(`can't parse showShapeLayer opts: ${opts}`, e); }
    }
    canvas = layer.canvas;
    dlayer = this.display.layers[layerName];
    // no args: return show mode
    if( JS9.isNull(mode) ){
	return layer.show;
    }
    if( mode === true || mode === "true" ){
	// restore and show layer
	if( !opts.local ){
	    layer.show = true;
	    // for non-internal show/hide, exit if we are not displaying image
	    if( this !== this.display.image ){
		return;
	    }
	}
	// restore selection property
	if( layer.show ){
	    canvas.selection = layer.opts.canvas.selection;
	}
	if( layer.json && layer.show ){
	    canvas.loadFromJSON(layer.json, () => {
		let key, tdlayer, obj;
		// update objects for parents and children
		JS9.Fabric.updateChildren(layer.dlayer, null, "objects");
		// translate these shapes if we resized while hidden
		if( this.resize ){
		    canvas.getObjects().forEach( (o) => {
			o.left += this.resize.left;
			o.top  += this.resize.top;
			o.setCoords();
		    });
		    canvas.calcOffset();
		}
		layer.zindex = Math.abs(layer.zindex);
		dlayer.divjq.css("z-index", layer.zindex);
		// unselect selected objects in lower-zindex groups
		for( key of Object.keys(this.layers) ){
		    if( (layerName !== key) && this.layers[key].show ){
			tdlayer = this.display.layers[key];
			if( tdlayer.divjq.css("z-index") < layer.zindex ){
			    obj = tdlayer.canvas.getActiveObject();
			    if( obj ){
				JS9.Fabric.removePolygonAnchors(tdlayer,
								obj);
				if( tdlayer.canvas.getActiveObject() ){
				    tdlayer.canvas.discardActiveObject();
				}
			    }
			}
		    }
		}
		this.restoreSelection(layerName);
	    });
	}
	// remove resize object if we have no more hidden layers
	for( xkey of Object.keys(this.layers) ){
	    if( this.layers[xkey].json ){
		left++;
	    }
	}
	if( !left ){
	    this.resize = null;
	}
	// plugin callbacks
	this.xeqPlugins("shape", "onshapelayershow", layerName);
    } else {
	// for non-internal show/hide, exit if we are not displaying image
	if( !opts.local ){
	    if( this !== this.display.image ){
		layer.show = false;
		return;
	    }
	}
	// save and hide layer
	if( layer.show ){
	    // can't use forEachObject, which loops in ascending order,
	    // because removing anchors changes the array destructively
	    objects = canvas.getObjects();
	    olen = objects.length;
	    while( olen-- ){
		obj = objects[olen];
		if( obj.params ){
		    if( obj.params.winid ){
			obj.params.winid.close();
			obj.params.winid = null;
		    }
		    if( obj.params.anchors ){
			JS9.Fabric.removePolygonAnchors(layer.dlayer, obj);
		    }
		}
	    }
	    jobj = canvas.toJSON(layer.dlayer.el);
	    layer.json = JSON.stringify(jobj);
	    this.saveSelection(layerName);
	    canvas.selection = false;
	    // push towards the bottom of the pile
	    if( dlayer ){
		layer.zindex = -Math.abs(layer.zindex);
		dlayer.divjq.css("z-index", layer.zindex);
	    }
	    canvas.clear();
	}
	if( !opts.local ){
	    layer.show = false;
	}
	// plugin callbacks
	this.xeqPlugins("shape", "onshapelayerhide", layerName);
    }
    return this;
};

// display all layers for the current image (save previous)
// call using image context
JS9.Fabric.displayShapeLayers = function(){
    let key;
    // if prev and cur are the same, just exit
    if( this === this.display.image ){
	return;
    }
    // this.display.image still points to the previously loaded image
    // save old layers
    if( this.display.image && this.display.image.layers ){
	for( key of Object.keys(this.display.image.layers) ){
	    this.display.image.showShapeLayer(key, false, {local: true});
	}
    }
    // "this" points to the current image: display new layers
    if( this.layers ){
	for( key of Object.keys(this.layers) ){
	    this.showShapeLayer(key, true, {local: true});
	}
    }
};

// toggle display of active layers for the current image (save previous)
// call using image context
JS9.Fabric.toggleShapeLayers = function(){
    let key, layer;
    if( this.toggleLayers ){
	// toggleLayers => we are currently hidden, so display them
	for( key of Object.keys(this.layers) ){
	    layer = this.layers[key];
	    if( layer && this.toggleLayers[key] ){
		this.showShapeLayer(key, true);
	    }
	}
	delete this.toggleLayers;
    } else {
	// no toggleLayers => we are currently displayed, so hide them
	this.toggleLayers = {};
	for( key of Object.keys(this.layers) ){
	    if( key === "crosshair" ){
		continue;
	    }
	    layer = this.layers[key];
	    if( layer && layer.show && layer.dlayer.dtype === "main" ){
		this.toggleLayers[key] = true;
		this.showShapeLayer(key, false);
	    }
	}
    }
};

// retrieve (and initialize, if necessary) a shape layer
// call using image context
// eslint-disable-next-line no-unused-vars
JS9.Fabric.getShapeLayer = function(layerName, opts){
    let dlayer, layer;
    // sanity check
    if( !layerName ){ return null; }
    layer = this.layers[layerName];
    // create new layer, if necessary
    if( !layer ){
        // check for display layer, which is required
	dlayer = this.display.layers[layerName];
	if( !dlayer ){
	   return null;
	}
	// make a new image display layer
	this.layers[layerName] = {};
	// create new layer for this image
	layer = this.layers[layerName];
	// assume we show this layer
	layer.show = true;
	// no shapes yet
	layer.nshape = 0;
	// backlink to display layer
	layer.dlayer = dlayer;
	// convenient link back to opts
	layer.opts = layer.dlayer.opts;
	// convenient link back to canvas
	layer.canvas = layer.dlayer.canvas;
	// recalculate offset -- why is this necessary??
	layer.canvas.calcOffset();
    }
    // return layer
    return layer;
};

// use zindex to make specified shape layer the active layer
// call using image context
JS9.Fabric.activeShapeLayer = function(s){
    let i, j, a, key, layer, tlayer, ozindex, tzindex, rtn;
    if( !s ){
	// no args: return layer with highest zindex
	for( key of Object.keys(this.layers) ){
	    tlayer = this.layers[key];
	    if( tlayer.dlayer.dtype === "main" ){
		if( (tzindex === undefined) || (tlayer.zindex > tzindex) ){
		    tzindex = tlayer.zindex;
		    a = key;
		}
	    }
	}
	// return highest zindex layer
	rtn = a;
    } else if( JS9.isArray(s) ){
	// non-public internal call: array of layers was specified
	// set zindex for layers in decreasing order
	for(i=0, j=this.zlayer-1; i<s.length; i++){
	    layer = this.layers[s[i]];
	    if( layer.dlayer.dtype === "main" ){
		layer.zindex = j--;
		if( layer.show ){
		    // save the active layer for return value
		    if( !a ){
			a = s[i];
		    }
		} else {
		    layer.zindex = - layer.zindex;
		}
		layer.dlayer.divjq.css("z-index", layer.zindex);
	    }
	}
	// return active layer
	rtn = a;
    } else {
	// public call: highest layer was specified directly
	// set the zindex (and switch any layer with same zindex)
	layer = this.layers[s];
	if( layer && layer.show ){
	    // set highest zindex for specified layer
	    ozindex = layer.zindex;
	    layer.zindex = this.zlayer - 1;
	    layer.dlayer.divjq.css("z-index", layer.zindex);
	    for( key of Object.keys(this.layers) ){
		// if another layer has top zindex, switch with original
		// zindex of layer we are bringing to the top
		// duh ... don't reset the specified layer
		tlayer = this.layers[key];
		if( (tlayer !== layer)               &&
		    (tlayer.zindex === layer.zindex) &&
		    (tlayer.dlayer.dtype === "main") ){
		    tlayer.zindex = ozindex;
		    tlayer.dlayer.divjq.css("z-index", tlayer.zindex);
		}
	    }
	    // plugin callbacks
	    this.xeqPlugins("shape", "onshapelayeractive", s);
	}
	// public: allow chaining
	rtn = this;
    }
    // return the news
    return rtn;
};

// process options, separating into fabric opts and params
// call using image context
JS9.Fabric._parseShapeOptions = function(layerName, opts, obj){
    let i, j, tval1, tags, pos, cpos, len, zoom, owcssys, txeq, pt;
    let key, shape, radinc, nrad, radius, tf, arr, parent;
    const nopts = {}, nparams = {};
    const YFUDGE = 1;
    // get color for a given shape tag
    const tagColor = (tags, tagcolors, obj) => {
	let tkey, ctags, color;
	tagcolors = tagcolors || {};
	// look through the color keys for exact match
	for( tkey of Object.keys(tagcolors) ){
	    ctags = tkey.split("_");
	    // see if all elements match
	    if( sameMembers(tags, ctags) ){
		color = tagcolors[tkey];
		break;
	    }
	}
	// look through color keys for subset match
	if( !color ){
	    for( tkey of Object.keys(tagcolors) ){
		ctags = tkey.split("_");
		if( (JS9.isArray(tags) ? tags : []).every((item) => {
		    return JS9.inArray(item, ctags) >= 0;
		}) ){
		    color = tagcolors[tkey];
		    break;
		}
	    }
	}
	// look through color keys for superset match
	if( !color ){
	    for( tkey of Object.keys(tagcolors) ){
		ctags = tkey.split("_");
		if( (JS9.isArray(ctags) ? ctags : []).every((item) => {
		    return JS9.inArray(item, tags) >= 0;
		}) ){
		    color = tagcolors[tkey];
		    break;
		}
	    }
	}
	// final attempt: use existing object's color or a default color
	color = color || (obj && obj.get("stroke")) ||
	        tagcolors.defcolor || JS9.globalOpts.defcolor || "#000000";
	return color;
    };
    // opts is optional
    opts = opts || {};
    // remove means nothing else matters
    if( opts.remove ){
	return {remove: opts.remove};
    }
    // remove dangerous options (e.g., passed in JS9.GetRegions() object)
    parent = opts.parent || (obj && obj.params && obj.params.parent);
    delete opts.parent;
    if( !opts.restoreid ){
	delete opts.id;
    }
    delete opts.restoreid;
    // initialize tags
    nparams.tags = [];
    // pre-processing special keys
    if( opts.tags ){
	if( typeof opts.tags === "string" ){
	    tags = opts.tags.toLowerCase().split(",");
	    // modes: source, background, include, exclude, etc
	    for(i=0; i<tags.length; i++){
		nparams.tags[i] = tags[i].trim();
	    }
	} else if( JS9.isArray(opts.tags) ){
	    for(i=0; i<opts.tags.length; i++){
		nparams.tags[i] = opts.tags[i].trim();
	    }
	}
    }
    // fabric angle is in opposite direction
    if( JS9.notNull(opts.angle) ){
	// for non-children, add in file rotation as needed
	// (moved from JS9.Regions.parseRegions.getang() 9/11/2019)
	if( !parent ){
	    switch(opts.shape){
	    case "box":
	    case "cross":
	    case "ellipse":
	    case "text":
		// add file rotation
		if( this.raw.wcsinfo ){
		    // rotated file
		    if( this.raw.wcsinfo.crot ){
			opts.angle += this.raw.wcsinfo.crot;
		    }
		} else if( JS9.notNull(this.raw.header.LTM1_1) ||
			   JS9.notNull(this.raw.header.LTM1_2) ){
		    try {
			// use atan instead of atan2 to divide out scale factor
			tval1 = Math.atan((this.raw.header.LTM1_2||0) /
					  (this.raw.header.LTM1_1||0));
		    } catch(e){ tval1 = 0; }
		    if( tval1 ){
			tval1 = -tval1 * 180.0 / Math.PI;
			opts.angle += tval1;
		    }
		}
		// take transform angle into account
		if( JS9.notNull(this.params.transformAngle) ){
		    opts.angle += this.params.transformAngle;
		}
		if( JS9.notNull(this.params.transformScale) ){
		    opts.angle *= this.params.transformScale;
		}
		break;
	    default:
		break;
	    }
	}
	nopts.angle = -opts.angle;
    }
    //  dx and dy are display coords
    if( (opts.dx !== undefined) && (opts.dy !== undefined) ){
	nopts.left = opts.dx;
	nopts.top = opts.dy;
    }
    //  x and y are image coords, convert to display coords
    if( (opts.x !== undefined) && (opts.y !== undefined) ){
	pos = this.imageToDisplayPos(opts);
	nopts.left = pos.x;
	nopts.top = pos.y;
    }
    //  px and py are physical coords, convert to display coords
    if( (opts.px !== undefined) && (opts.py !== undefined) ){
	pos = this.logicalToDisplayPos({x: opts.px, y: opts.py});
	nopts.left = pos.x;
	nopts.top = pos.y;
    }
    // wcs string: ra dec [wcssys]
    if( typeof opts.wcs === "string" ){
        arr = opts.wcs.trim().split(/ +/);
        opts.ra  = arr[0];
        opts.dec = arr[1];
        if( arr.length >= 3 ){
	    opts.wcssys = arr[2];
        }
    }
    //  ra and dec are in degrees, using the current wcs
    if( this.validWCS() && JS9.notNull(opts.ra) && JS9.notNull(opts.dec) ){
	// make sure we have the right wcssys
	if( opts.wcssys ){
	    // from passed-in opts
	    owcssys = this.getWCSSys();
	    txeq = JS9.globalOpts.xeqPlugins;
	    JS9.globalOpts.xeqPlugins = false;
	    this.setWCSSys(opts.wcssys, false);
	} else if( opts._wcssys ){
	    // local override from parseRegions
	    owcssys = this.getWCSSys();
	    txeq = JS9.globalOpts.xeqPlugins;
	    JS9.globalOpts.xeqPlugins = false;
	    this.setWCSSys(opts._wcssys, false);
	    // no longer needed or wanted
	    delete opts._wcssys;
	}
	// convert wcs supplied as strings
	if( typeof opts.ra === "string" ){
	    opts.ra = JS9.saostrtod(opts.ra);
	    if( JS9.isHMS(this.params.wcssys) ){
		opts.ra *= 15.0;
	    }
	}
	if( typeof opts.dec === "string" ){
	    opts.dec = JS9.saostrtod(opts.dec);
	}
	// convert to image coords
	arr = JS9.wcs2pix(this.raw.wcs, opts.ra, opts.dec).trim().split(/ +/);
	// restore original wcssys
	if( owcssys ){
	    this.setWCSSys(owcssys, false);
	    JS9.globalOpts.xeqPlugins = txeq;
	}
	// convert to display coords
	pos = this.imageToDisplayPos({x: parseFloat(arr[0]),
				      y: parseFloat(arr[1])});
	nopts.left = pos.x;
	nopts.top = pos.y;
    }
    //  look for primitives
    if( (opts.left !== undefined) ){
	nopts.left = opts.left;
    }
    if( (opts.top !== undefined) ){
	nopts.top = opts.top;
    }
    // last gasp to get left and top (unless explicitly told not to)
    if( nopts.left === undefined && opts.noLeftTop !== true ){
	if( obj && (obj.left !== undefined) ){
	    nopts.left = obj.left;
	} else {
	    nopts.left = this.display.canvasjq.attr("width") / 2 - 1;
	}
    }
    if( nopts.top === undefined && opts.noLeftTop !== true ){
	if( obj && (obj.top !== undefined) ){
	    nopts.top = obj.top;
	} else {
	    // why is this fudge needed?
	    nopts.top =  this.display.canvasjq.attr("height") / 2 - 1 + YFUDGE;
	}
    }
    // relative movement requires opts left/top or an existing object
    if( opts.deltax ){
	nopts.left += opts.deltax;
    }
    if( opts.deltay ){
	nopts.top -= opts.deltay;
    }
    // set scaling based on zoom factor
    if( this.display.layers[layerName].dtype === "main" &&
	!opts.preservedcoords ){
	zoom = this.rgb.sect.zoom;
    } else {
	zoom = 1;
    }
    // look for reset directives (empty strings)
    if( opts.strokeDashes === "" || opts.strokeDashArray === "" ){
	opts.strokeDashArray = [];
    }
    if( opts.strokeWidth === "" ){
	opts.strokeWidth = JS9.Fabric.opts.strokeWidth;
    }
    // shape-specific processing
    switch(opts.shape){
    case "annulus":
	nparams.radii = [];
	if( opts.radii !== undefined ){
	    if( typeof opts.radii === "string" ){
		nparams.radii = opts.radii.replace(/ /g, "").split(",");
		for(i=0, j=0; i<nparams.radii.length; i++){
		    if( nparams.radii[i] !== "" ){
			if( opts.sizeScale ){
			    nparams.radii[i] *= opts.sizeScale;
			}
			nparams.radii[j++] = this.wcs2imlen(nparams.radii[i]);
		    }
		}
	    } else {
		nparams.radii = opts.radii;
		if( opts.sizeScale ){
		    for(i=0; i<nparams.radii.length; i++){
			nparams.radii[i] *= opts.sizeScale;
		    }
		}
	    }
	} else {
	    // we can scale menu-created regions to be reasonably sized
	    if( opts.ireg && JS9.SCALEIREG ){
		if( JS9.notNull(opts.iradius) ){
		    opts.iradius /= zoom;
		}
		if( JS9.notNull(opts.oradius) ){
		    opts.oradius /= zoom;
		}
	    }
	    // useful if you pass one image's region object to another, e.g.,
	    // when sync'ing between two images of different cdelt1
	    if( opts.sizeScale ){
		if( JS9.notNull(opts.iradius) ){
		    opts.iradius *= opts.sizeScale;
		}
		if( JS9.notNull(opts.oradius) ){
		    opts.oradius *= opts.sizeScale;
		}
	    }
	    radinc = (opts.oradius - opts.iradius) / opts.nannuli;
	    nrad = opts.nannuli + 1;
	    for(i=0; i<nrad; i++){
		radius = opts.iradius + (radinc * i);
		if( opts.sizeScale ){
		    radius *= opts.sizeScale;
		}
		nparams.radii.push(radius);
	    }
	}
	break;
    case "box":
    case "cross":
	// we can scale menu-created regions to be reasonably sized
	if( opts.ireg && JS9.SCALEIREG ){
	    if( JS9.notNull(opts.width) ){
		opts.width /= zoom;
	    }
	    if( JS9.notNull(opts.height) ){
		opts.height /= zoom;
	    }
	}
	// useful if you pass one image's region object to another, e.g.,
	// when sync'ing between two images of different cdelt1
	if( opts.sizeScale ){
	    if( JS9.notNull(opts.width) ){
		opts.width *= opts.sizeScale;
	    }
	    if( JS9.notNull(opts.height) ){
		opts.height *= opts.sizeScale;
	    }
	}
	break;
    case "circle":
	// we can scale menu-created regions to be reasonably sized
	if( opts.ireg && JS9.SCALEIREG ){
	    if( JS9.notNull(opts.radius) ){
		opts.radius /= zoom;
	    }
	}
	// useful if you pass one image's region object to another, e.g.,
	// when sync'ing between two images of different cdelt1
	if( opts.sizeScale ){
	    if( JS9.notNull(opts.radius) ){
		opts.radius *= opts.sizeScale;
	    }
	}
	break;
    case "ellipse":
	// we can scale menu-created regions to be reasonably sized
	if( opts.ireg && JS9.SCALEIREG ){
	    if( JS9.notNull(opts.r1) ){
		opts.r1 /= zoom;
	    }
	    if( JS9.notNull(opts.r2) ){
		opts.r2 /= zoom;
	    }
	}
	// useful if you pass one image's region object to another, e.g.,
	// when sync'ing between two images of different cdelt1
	if( opts.sizeScale ){
	    if( JS9.notNull(opts.r1) ){
		opts.r1 *= opts.sizeScale;
	    }
	    if( JS9.notNull(opts.r2) ){
		opts.r2 *= opts.sizeScale;
	    }
	}
	break;
    case "point":
	opts.strokeWidth = JS9.Regions.opts.ptStrokeWidth;
	switch(opts.ptshape){
	case "box":
	    opts.width = opts.ptsize * 2;
	    opts.height = opts.ptsize * 2;
	    break;
	case "circle":
	    opts.radius = opts.ptsize;
	    break;
	case "ellipse":
	    opts.rx = opts.ptsize;
	    opts.ry = opts.ptsize / 2;
	    break;
	case "x":
	case "+":
            opts.strokeWidth = 0;
	    opts.width = opts.ptsize;
	    opts.height = opts.width;
	    break;
	}
	opts.lockRotation = true;
	opts.lockScalingX = true;
	opts.lockScalingY = true;
	opts.lockUniScaling = true;
	opts.hasControls = false;
	opts.hasRotatingPoint = false;
	opts.hasBorders = true;
	break;
    case "line":
    case "polygon":
	//  wcspts in degrees, using the current wcs
	if( JS9.notNull(opts.wcspts) && this.validWCS() ){
            // fill pts array with better values from wcs, to be used below
	    opts.pts = [];
	    // make sure we have the right wcssys
	    if( opts.wcssys ){
		// from passed-in opts
		owcssys = this.getWCSSys();
		txeq = JS9.globalOpts.xeqPlugins;
		JS9.globalOpts.xeqPlugins = false;
		this.setWCSSys(opts.wcssys, false);
	    }
	    for(i=0; i<opts.wcspts.length; i++){
		// convert to image coords
		arr = JS9.wcs2pix(this.raw.wcs,
				opts.wcspts[i].ra, opts.wcspts[i].dec)
		    .trim().split(/ +/);
		opts.pts.push({x:parseFloat(arr[0]), y:parseFloat(arr[1])});
	    }
	    // restore original wcssys
	    if( owcssys ){
		this.setWCSSys(owcssys, false);
		JS9.globalOpts.xeqPlugins = txeq;
	    }
	}
	if( opts.pts && opts.pts.length ){
	    if( typeof opts.pts === "string" ){
		arr = opts.pts.replace(/ /g, "").split(",");
		len = arr.length;
		if( typeof arr[0] === "string" ){
		    for(i=0; i<len; i++){
			arr[i] = parseFloat(arr[i]);
		    }
		}
		opts.pts = [];
		for(i=0, j=0; i<len; i+=2, j++){
		    opts.pts[j] = {x: arr[i], y: arr[i+1]};
		}
	    }
	    // convert all points from image pos to display pos
	    len = opts.pts.length;
	    for(i=0; i<len; i++){
		pt = opts.pts[i];
		if( JS9.notNull(pt.x) && JS9.notNull(pt.y) ){
		    opts.pts[i] = this.imageToDisplayPos(opts.pts[i]);
		} else if( JS9.notNull(pt.dx) && JS9.notNull(pt.dy) ){
		    opts.pts[i].x = pt.dx;
		    delete opts.pts[i].dx;
		    opts.pts[i].y = pt.dy;
		    delete opts.pts[i].dy;
		}
	    }
	    // centroid of polygon from display points
	    if( opts.left && opts.top ){
		cpos = {x: opts.left, y: opts.top};
	    } else if( opts.dx && opts.dy ){
		cpos = {x: opts.dx, y: opts.dy};
	    } else {
		// get center point of polygon bounding box
		cpos = JS9.centerPolygon(opts.pts);
		// this is the center of the shape
		nopts.left = cpos.x;
		nopts.top = cpos.y;
	    }
	    // convert points from display pos to offsets from center pos
	    // overwrite any old points array
	    opts.points = [];
	    for(i=0; i<len; i++){
		pos = {x: (opts.pts[i].x - cpos.x) / zoom,
		       y: (opts.pts[i].y - cpos.y) / zoom};
		opts.points.push(pos);
	    }
	// NB: checking obj in the next line is not a typo ...
	// ... don't even think of changing it to opts (again)!
	} else if( !obj || !obj.points || !obj.points.length ){
	    if( opts.shape === "polygon" && opts. polypoints ){
		opts.points = opts.points || opts.polypoints;
	    } else if( opts.shape === "line" && opts. linepoints ){
		opts.points = opts.points || opts.linepoints;
	    }
	}
	// we can scale menu-created regions to be reasonably sized
	if( opts.ireg && JS9.SCALEIREG ){
	    len = opts.points.length;
	    for(i=0; i<len; i++){
		opts.points[i].x /= zoom;
		opts.points[i].y /= zoom;
	    }
	}
	break;
    case "text":
	break;
    }
    // separate opts and params
    for( key of Object.keys(opts) ){
	// eslint-disable no-fallthrough
	switch(key){
	case "tags":
	case "x":
	case "y":
	case "px":
	case "py":
	case "deltax":
	case "deltay":
	case "ra":
	case "dec":
	case "pts":
	case "left":
	case "top":
	case "angle":
	case "radii":
	case "ireg":
	    break;
	case "type":
	case "originX":
	case "originY":
	case "width":
	case "height":
	case "scaleX":
	case "scaleY":
	case "flipX":
	case "flipY":
	case "opacity":
	case "cornerSize":
	case "transparentCorners":
	case "hoverCursor":
	case "padding":
	case "borderColor":
	case "cornerColor":
	case "centeredScaling":
	case "centeredRotation":
	case "fill":
	case "fillRule":
	case "backgroundColor":
	case "stroke":
	case "strokeWidth":
	case "strokeDashArray":
	case "strokeLineCap":
	case "strokeLineJoin":
	case "strokeMiterLimit":
	case "shadow":
	case "borderOpacityWhenMoving":
	case "borderScaleFactor":
	case "borderDashArray":
	case "transformMatrix":
	case "minScaleLimit":
	case "selectable":
	case "evented":
	case "visible":
	case "hasControls":
	case "hasBorders":
	case "hasRotatingPoint":
	case "rotatingPointOffset":
	case "perPixelTargetFind":
	case "includeDefaultValues":
	case "clipTo":
	case "lockMovementX":
	case "lockMovementY":
	case "lockRotation":
	case "lockScalingX":
	case "lockScalingY":
	case "lockUniScaling":
	case "send":
	case "radius":
	case "rx":
	case "ry":
	case "points":
	case "selectionLineWidth":
	case "fontFamily":
	case "fontSize":
	case "fontStyle":
	case "fontWeight":
	case "text":
	case "textDecoration":
	case "textAlign":
	case "lineHeight":
	case "textBackgroundColor":
	case "textOpts":
	case "groupid":
	    nopts[key] = opts[key];
	    break;
	case "shape":
	    shape = opts[key];
	    break;
	default:
	    nparams[key] = opts[key];
	    break;
	}
	// eslint-enable no-fallthrough
    }
    // finalize some properties
    nopts.stroke = nparams.color || nopts.stroke ||
	           tagColor(nparams.tags, nparams.tagcolors, obj);
    nopts.selectColor = nopts.stroke;
    if( JS9.globalOpts.controlsMatchRegion === true ||
	JS9.globalOpts.controlsMatchRegion === "corner" ){
	nopts.cornerColor = nopts.stroke;
    }
    if( JS9.globalOpts.controlsMatchRegion === true ||
	JS9.globalOpts.controlsMatchRegion === "border" ){
	nopts.borderColor = nopts.stroke;
    }
    // deprecated
    if( (nparams.changeable === undefined)  &&
	(nparams.fixinplace !== undefined)  ){
	nparams.changeable = !nparams.fixinplace;
    }
    // locked: opposite alias of changeable
    if( (nparams.changeable === undefined)  &&
	(nparams.locked !== undefined)      ){
	nparams.changeable = !nparams.locked;
    }
    // changeable: short-hand for allowing objects to move and resize
    if( nparams.changeable !== undefined || nparams.editing !== undefined ){
	if( nparams.editing !== undefined ){
	    tf = nparams.editing;
	} else {
	    tf = !nparams.changeable;
	}
	nopts.lockMovementX = tf;
	nopts.lockMovementY = tf;
	nopts.lockRotation = tf;
	nopts.lockScalingX = tf;
	nopts.lockScalingY = tf;
	nopts.hasControls = !tf;
	nopts.hasRotatingPoint = !tf;
	nopts.hasBorders = !tf;
    }
    // movable means x and y movement
    if( nparams.movable !== undefined ){
	tf = !nparams.movable;
	nopts.lockMovementX = tf;
	nopts.lockMovementY = tf;
    }
    // resizable
    if( nparams.resizable !== undefined ){
	tf = nparams.resizable;
	nopts.hasControls = tf;
	nopts.hasBorders = tf;
    }
    // rotatable
    if( nparams.rotatable !== undefined ){
	tf = !nparams.rotatable;
	if( nopts.lockRotation === undefined ){
	    nopts.lockRotation = tf;
	    nopts.hasRotatingPoint = !tf;
	}
    }
    // editing affects visibility of shape
    if( nparams.editing !== undefined ){
	nopts.visible = !nparams.editing;
    }
    // return shape, opts and params
    return {shape: shape, opts: nopts, params: nparams};
};

// given an object full of keys, return an array of key names for export
// call using image context
JS9.Fabric._exportShapeOptions = function(opts){
    // sanity check
    if( typeof opts !== "object" ){ return []; }
    // array of export keys, with many stripped out
    return Object.keys(opts).filter( (item) => {
	switch(item){
	case "top":
	case "left":
	case "width":
	case "height":
	case "radii":
	case "radius":
	case "rx":
	case "ry":
	case "angle":
	case "panzoom":
	case "iradius":
	case "oradius":
	case "nannuli":
	case "aradius1":
	case "aradius2":
	case "configURL":
	case "sortOverlapping":
	case "tagcolors":
	case "pts":
	case "ptshape":
	case "ptsize":
	case "linepoints":
	case "polypoints":
	case "responseType":
	case "display":
	case "tags":
	case "r1":
	case "r2":
	case "x":
	case "y":
	case "dx":
	case "dy":
	case "px":
	case "py":
	case "ra":
	case "dec":
	case "shape":
	case "parent":
	case "rtn":
	case "_wcssys":
	case "file":
	case "savefile":
	case "savewhich":
	case "saveformat":
	case "saveselection":
	case "savewcs":
	case "sortids":
	case "send":
	case "listonchange":
	case "multitext":
	    return false;
	case "text":
	    if( opts.shape === "text" ){
		return false;
	    }
	    return true;
	case "editing":
	    return opts.editing;
	default:
	    return true;
	}
    });
};

// if shape is not text but text is specified in the opts,
// make a text shape as a child of this shape
// call using image context
JS9.Fabric._handleChildText = function(layerName, s, opts){
    let i, t, dpos, npos, topts, yoff, child;
    const textht = 12;
    // region layer only, for now
    if( layerName !== "regions" ){
	return;
    }
    // opts are optional
    opts = opts || {};
    if( (s.params.shape !== "text") && opts.text          &&
	(!s.params.children || !s.params.children.length) ){
	yoff = (s.height * s.scaleX / 2) - textht;
	// default position for text (might be overridden by textOpts)
	if( Math.abs(s.angle) < 0.000001 ){
	    dpos = {x: s.left, y: s.top - yoff};
	} else {
	    dpos = JS9.rotatePoint({x: s.left, y: s.top - yoff},
				   s.angle, {x: s.left, y: s.top});
	}
	npos = this.displayToImagePos(dpos);
	topts = {x: npos.x, y: npos.y, angle: -s.angle,
		 color: s.stroke, text: opts.text, tags: s.params.tags,
		 parent: "TBD", rtn: "object"};
	if( opts.textOpts ){
	    topts = JS9.extend(true, {}, topts, opts.textOpts);
	}
	// create the child shape
	t = this.addShapes(layerName, "text", topts);
	// parent object keeps track of relationship between parent and child
	t.params.parent = {id: s.params.id,
			   obj: s,
			   dleft: s.left - t.left,
			   dtop: s.top - t.top,
			   lastscalex: s.scaleX,
			   lastscaley: s.scaleY,
			   lastangle: s.angle,
			   textheight: textht};
	// updateShape was skipped in addShapes because parent was TBD
	// we can now updateShape with parent info ...
	this._updateShape(layerName, t, null, "child", t.params);
	// since strokeWidth changes with zoom, we need to save the opts
	// and restore it on export
	if( opts.strokeWidth !== undefined ){
	    t.params.parent.strokeWidth = opts.strokeWidth;
	}
	// text might be moved off default position already
	if( (npos.x !== topts.x) || (npos.y !== topts.y) ){
	    t.params.parent.moved = true;
	}
	// flag if text RA and Dec were passed in textOpts
	if( opts.textOpts                    &&
	    opts.textOpts.ra  !== undefined  &&
	    opts.textOpts.dec !== undefined  ){
	    t.params.hasTextOpts = true;
	}
	// parent has another child
	s.params.children.push({id: t.params.id, obj: t});
	// update the parent
	this._updateShape(layerName, s, null, "addchild", s.params);
    } else if( s.params.children && s.params.children.length > 0 &&
	       (JS9.notNull(opts.text)     ||
		JS9.notNull(opts.textOpts) ||
		JS9.notNull(opts.color))   ){
	// process parameters passed to existing text children
	for(i=0; i<s.params.children.length; i++){
	    child = s.params.children[i].obj;
	    // change text opts, if necessary
	    topts = JS9.extend(true, {}, opts.textOpts || {});
	    // change text, if necessary
	    if( JS9.notNull(opts.text) ){
		topts.text = opts.text;
	    }
	    // sync text color with parent color, if necessary
	    if( JS9.globalOpts.regSyncTextColor && !topts.color            &&
		opts.synctextcolor !== false    && JS9.notNull(opts.color) ){
		topts.color = opts.color;
	    }
	    if( Object.keys(topts).length > 0 ){
		this.changeShapes(layerName, child.params.id, topts);
	    }
	}
    }
};

// add shapes to a layer
// call using image context
JS9.Fabric.addShapes = function(layerName, shape, myopts){
    let i, sobj, sarr, carr, ns, s, bopts, opts, layer, canvas, dlayer;
    let zoom, ttop, tleft, tangle, w2, h2, key;
    let params = {};
    let rarr = [], parr = [];
    const objs = [];
    const grp = {};
    // is this core service disabled?
    if( JS9.inArray("regions", this.params.disable) >= 0 &&
	layerName === "regions" ){
	return;
    }
    // optional myopts can be an object or a string
    myopts = myopts || {};
    // opts can be an object or json
    if( typeof myopts === "string" ){
	try{ myopts = JSON.parse(myopts); }
	catch(e){ JS9.error(`can't parse shape opts: ${myopts}`, e); }
    }
    // delay adding the region, if this image is not the one being displayed
    if( this.display.image !== this ){
	this.delayedShapes = this.delayedShapes || [];
	this.delayedShapes.push({layer: layerName, shape: shape,
				 mode: "add", opts: myopts});
	return;
    }
    // remove old regions, if necessary (ie we are reloading the file)
    if( myopts.file && JS9.globalOpts.reloadRefreshReg ){
	try{ this.removeShapes("regions", myopts.file); }
	catch(e){ /* empty */ }
    }
    layer = this.getShapeLayer(layerName);
    // sanity check
    if( !layer || !layer.show ){ return; }
    canvas = layer.canvas;
    // figure out the first arg
    if( typeof shape === "string" ){
	// look for a region string
	s = this.parseRegions(shape, myopts);
	if( typeof s === "string" ){
	    // nope, normal shape string
	    sarr = [{shape: s}];
	} else {
	    // parsed array of shape objects from regions string
	    sarr = s;
	}
    } else if( JS9.isArray(shape) ){
	sarr = shape;
    } else if( typeof shape === "object" ){
	sarr = [shape];
    } else {
	return;
    }
    // once a shape has been added, we can set the zindex to process events
    if( JS9.isNull(layer.zindex) || Number.isNaN(layer.zindex)  ){
	if( this.display.layers[layerName].dtype === "main" ){
	    switch(layerName){
	    case JS9.Crosshair.LAYERNAME:
	    case JS9.Grid.LAYERNAME:
		// these should never cover any other interactive layer
		layer.zindex = 1;
		break;
	    default:
		// otherwise this layer goes to the top
		layer.zindex = this.zlayer++;
		break;
	    }
	} else {
	    // layer is not in main display
	    layer.zindex = JS9.SHAPEZINDEX;
	}
	dlayer = this.display.layers[layerName];
        dlayer.divjq.css("z-index", layer.zindex);
	// we can now call the shape layer create plugin callbacks
	this.xeqPlugins("shape", "onshapelayercreate", layerName);
    }
    // baseline opts
    bopts = JS9.extend(true, {}, JS9.Fabric.opts, layer.opts, myopts);
    // process each shape object
    for(ns=0; ns<sarr.length; ns++){
	carr = sarr[ns];
	// are we preserving display coords
	if( carr.preservedcoords === true ){
	    // sanity check
	    if( (JS9.isNull(carr.dx) || JS9.isNull(carr.dy))        &&
		(JS9.isArray(carr.pts) && JS9.isNull(carr.pts[0].dx)) ){
		JS9.error("preservedcoords requires positions in display coords");
	    }
	    // dcoord shapes are sticky
	    carr.sticky = true;
	    // save the object keys that were specified
	    carr.preservedcoords = Object.keys(carr)
	    // make 'image' the configured wcs
	    carr.wcsconfig = {wcssys: "image"};
	}
	// combine baseline opts with this shapes's opts
	opts = JS9.extend(true, {}, bopts, carr);
	// parse options and generate opts and params objects
	sobj = this._parseShapeOptions(layerName, opts);
	// remove means remove specified shapes or all shapes
	if( sobj.remove ){
	    if( sobj.remove === true || sobj.remove === "true" ){
		sobj.remove = "all";
	    }
	    if( sobj.remove !== false && sobj.remove !== "false" ){
		this.removeShapes(layerName, sobj.remove);
		continue;
	    }
	}
	// sanity check
	if( !sobj.shape ){ continue; }
	// convenience variables
	opts = sobj.opts;
	params = sobj.params;
	// id for this shape
	if( params.id === undefined ){
	    params.id = ++layer.nshape;
	}
	// wcssys for editing this shape
	if( params.wcsconfig === undefined ){
	    params.wcsconfig = {wcssys: this.getWCSSys()};
	}
	// get array of option names to export when saving regions
	params.exports = this._exportShapeOptions(myopts)
	         .concat(this._exportShapeOptions(carr));
	// no parents or children yet
	params.parent = null;
	params.children = [];
	// if stroke (color) is defined, we probably need to convert it to hex
	if( opts.stroke ){
	    opts.color = opts.stroke;
	    opts.stroke = JS9.colorToHex(opts.stroke);
	}
	// some shapes don't want centered scaling
	if( layer.opts.noCenteredScaling &&
	    JS9.inArray(sobj.shape, layer.opts.noCenteredScaling) >= 0 ){
	    opts.centeredScaling = false;
	}
	// create the shape
	switch(sobj.shape){
	case "annulus":
	    // save shape
	    params.shape = "annulus";
	    // save group position
	    ttop = opts.top;
	    tleft = opts.left;
	    // individual radii in the group are at 0,0
	    opts.top = 0;
	    opts.left = 0;
	    rarr = [];
	    if( params.radii ){
		for(i=0; i<params.radii.length; i++){
		    opts.radius = params.radii[i];
		    rarr.push(new fabric.Circle(opts));
		}
	    }
	    // an annulus is a group of circles at the specified position
	    opts.top = ttop;
	    opts.left = tleft;
	    opts.width = opts.radius * 2;
	    opts.height = opts.radius * 2;
	    s = new fabric.Group(rarr, opts);
	    break;
	case "box":
	    // save shape
	    params.shape = "box";
	    s = new fabric.Rect(opts);
	    break;
	case "circle":
	    // save shape
	    params.shape = "circle";
	    s = new fabric.Circle(opts);
	    break;
	case "cross":
	    // save shape
	    params.shape = "cross";
	    // save group position
	    ttop = opts.top;
	    tleft = opts.left;
	    tangle = opts.angle;
	    w2 = opts.width/2;
	    h2 = opts.height/2;
	    parr = [];
	    opts.left = 0;
	    opts.top = 0;
	    opts.angle = 0;
	    opts.points = [{x: -w2, y: 0}, {x:  w2, y: 0}]
	    parr.push(new fabric.Polyline(opts.points, opts));
	    opts.points = [{x: 0, y: -h2}, {x:  0, y: h2}]
	    parr.push(new fabric.Polyline(opts.points, opts));
	    // a cross is two lines at the specified position
	    opts.top = ttop;
	    opts.left = tleft;
	    opts.angle = tangle;
	    s = new fabric.Group(parr, opts);
	    break;
	case "ellipse":
	    // save shape
	    params.shape = "ellipse";
	    opts.rx = params.r1;
	    opts.ry = params.r2;
	    s = new fabric.Ellipse(opts);
	    break;
	case "point":
	    // save shape
	    params.shape = "point";
            // switch(params.ptshape){
            // case "x":
            //     tangle=45;
            //     break;
            // default:
            //     tangle=0;
            //     break;
            // }
	    switch(params.ptshape){
	    case "x":
	        params.text = '\u00D7';
	        opts.fill = opts.stroke;
                // opts.angle = tangle;
                opts.fontSize = opts.width*6;
	        s = new fabric.Text(params.text, opts);
	        break;
	    case "+":
	        params.text = "+";
                opts.fill = opts.stroke;
                // opts.angle = tangle;
                opts.fontSize = opts.width*7;
	        s = new fabric.Text(params.text, opts);
	        break;
	    case "box":
		s = new fabric.Rect(opts);
		break;
	    case "circle":
		s = new fabric.Circle(opts);
		break;
	    case "ellipse":
		s = new fabric.Ellipse(opts);
		break;
	    default:
		s = new fabric.Rect(opts);
		break;
	    }
	    break;
	case "line":
	    // save shape
	    params.shape = "line";
	    s = new fabric.Polyline(opts.points, opts);
	    break;
	case "polygon":
	    // save shape
	    params.shape = "polygon";
	    // final ("true") arg is for fabric.js v1.4.11 (skipOffset)
	    s = new fabric.Polygon(opts.points, opts, true);
	    break;
	case "text":
	    // save shape
	    params.shape = "text";
	    params.text = opts.text || "Double-click to add text here";
	    // FF svg to pdf is broken: use fill instead of stroke
	    // https://github.com/kangax/fabric.js/issues/2675
	    opts.fill = opts.stroke;
	    opts.strokeWidth = 0;
	    s = new fabric.Text(params.text, opts);
	    break;
	default:
	    JS9.error(`unknown shape: ${sobj.shape}`);
	    break;
	}
	// add new shape to canvas
	canvas.add(s);
	// backlink to layer name
	params.layerName = layerName;
	// save original strokeWidth for zooming
	params.sw1 = Math.max(1, Math.floor(s.strokeWidth + 0.5));
	// initialize
	params.listonchange = false;
	// breaks panner, magnifier
	// save custom attributes in the params object
	// s.set("params", params);
	s.params = params;
	// set scaling based on zoom factor
	if( this.display.layers[layerName].dtype === "main" &&
	    !s.params.preservedcoords ){
	    zoom = this.rgb.sect.zoom;
	} else {
	    zoom = 1;
	}
	if( layer.opts.panzoom ){
	    switch(params.shape){
	    case "point":
	    case "text":
		break;
	    default:
		s.scale(zoom);
		break;
	    }
	}
	// and then rescale the stroke width
	s.rescaleBorder();
	// non-changeable shapes go to back
	if( s.params.changeable === false ){
	    canvas.sendToBack(s);
	}
	// might need to make a text shape as a child of this shape
	this._handleChildText(layerName, s, opts);
	// update the shape info, but not TBD children (will get done later)
	if( myopts.parent !== "TBD" ){
	    this._updateShape(layerName, s, null, "add", params);
	}
	// callback if necessary
	if( myopts.onaddshapes && s.pub ){
	    try{ JS9.xeqByName(myopts.onaddshapes, this, this, s.pub); }
	    catch(e){ JS9.error("in onaddshapes callback", e, false); }
	}
	// save public object in object array, might be needed in return
	objs.push(s);
	// save grouped objects
	if( opts.groupid ){
	    grp[opts.groupid] = grp[opts.groupid] || [];
	    grp[opts.groupid].push(s);
	}
    }
    // construct groups, if necessary
    for( key of Object.keys(grp) ){
	this.groupShapes(layerName, grp[key], {groupid: key, select: false});
    }
    // redraw (unless explicitly specified otherwise)
    if( (params.redraw === undefined) || params.redraw ){
	canvas.renderAll();
    }
    // return last object (internal use for child regions), if necessary
    if( myopts.rtn === "object" ){
	return s;
    }
    // return all objects (internal use for paste regions), if necessary
    if( myopts.rtn === "objs" ){
	return objs;
    }
    // return shape id
    return params.id;
};

// call regSelect parser on a selection
// call using image context
JS9.Fabric._parseShapes = function(layerName, selection, opts){
    let canvas;
    // sanity check
    if( !this.layers || !layerName || !this.layers[layerName] ){ return null; }
    // convenience variable(s)
    canvas = this.layers[layerName].canvas;
    // opts is optional
    opts = opts || {};
    // NB: the JS9.tmp.regSelect values are used directly in the parser
    JS9.tmp.regSelect = { layer: layerName, im: this, all: [] };
    canvas.getObjects().forEach( (o) => {
	let groupid;
	// ordinary shapes
	if( o.params ){
	    // but not child shapes
	    if( !o.params.parent ){
		JS9.tmp.regSelect.all.push(o.params.id);
	    }
	} else if( o.type === "group" ){
	    // groups
	    groupid = this.lookupGroup(o);
	    if( groupid ){
		JS9.tmp.regSelect.all.push(groupid);
	    }
	}
    });
    try{
	regSelect.parse(selection);
    }
    catch(e){
	JS9.error(`parsing selection filter: ${selection}`, e);
    }
    if( opts.saveselection && selection ){
	switch(selection.trim()){
	case "all":
	case "saved":
	case "selected":
	    break;
	default:
	    this.layers[layerName].selection = selection;
	    break;
	}
    }
    selection = JS9.tmp.regSelect.ids;
    delete JS9.tmp.regSelect;
    return selection;
};

// select one of more shapes by id or tag and execute a callback
// call using image context
JS9.Fabric._selectShapes = function(layerName, selection, opts, cb){
    let i, j, objects, olen, aobjects, alen, groups;
    let id, ginfo, canvas, ocolor, tag, obj;
    const used = [];
    const xcb = (obj, ginfo) => {
	if( JS9.inArray(obj, used) < 0 ){
	    cb.call(this, obj, ginfo);
	    used.push(obj);
	}
    }
    const getshapes = (objects) => {
	let got, obj, olen;
	// sanity check
	if( !objects ){ return []; }
	// get objects, including objects inside groups, which themselves
	// can be within groups ... (hence the do/while loop)
	olen = objects.length;
	do{
	    got = 0;
	    while( olen-- ){
		obj = objects[olen];
		// replace group with objects inside the group
		if( obj.type === "group" && !obj.params ){
		    objects.splice(olen, 1, ...obj.getObjects());
		    got++;
		}
	    }
	    olen = objects.length;
	} while( got );
	return objects;
    };
    const getgroups = (canvas, objects) => {
	let i, j, obj, grp, olen, mlen, ao;
	let mygroups = [];
	let groups = [];
	olen = objects.length;
	// look for all possible groups
	for(i=0; i<olen; i++){
	    grp = objects[i];
	    if( (grp.type === "activeSelection")      ||
		(grp.type === "group" && !grp.params) ){
		mygroups.push(grp);
	    }
	}
	mlen = mygroups.length;
	// including the current active object
	ao = canvas.getActiveObject();
	if( ao ){
	    if( !((ao.type === "activeSelection")      ||
		  (ao.type === "group" && !ao.params)) ){
		ao = null;
	    }
	}
	if( mlen || ao ){
	    for(i=0; i<olen; i++){
		obj = objects[i];
		for(j=0; j<mlen; j++){
		    grp = mygroups[j];
		    if( grp.contains(obj) ){
			groups[i] = grp;
		    }
		}
		if( !groups[i] ){
		    if( ao && ao.contains(obj) ){
			groups[i] = ao;
		    }
		}
	    }
	}
	return groups;
    };
    const lookupgroup = (obj, objects) => {
	let i, tobj;
	for(i=0; i<objects.length; i++){
	    tobj = objects[i];
	    if( (tobj.type === "activeSelection")       ||
		(tobj.type === "group" && !tobj.params) ){
		if( tobj.contains(obj) ){
		    return tobj;
		}
	    } else if( tobj.params && tobj === obj ){
		return groups[i];
	    }
	}
	return null;
    };
    // sanity check
    if( !this.layers || !layerName || !this.layers[layerName] ){ return null; }
    // for all selections, we need a callback
    if( typeof cb !== "function" ){
	JS9.error("selectShapes requires a callback");
    }
    // opts is optional
    opts = opts || {};
    // convenience variable(s)
    canvas = this.layers[layerName].canvas;
    // no selection means "selected" if there are selected shapes, else all
    // (can be turned off by a global for backward compatibility)
    if( !selection ){
	if( canvas.getActiveObject()                  &&
	    JS9.globalOpts.regWhichDefault === "auto" ){
	    selection = "selected";
	} else {
	    selection = "all";
	}
    }
    // look for string represtation of array selection
    if( typeof selection === "string" && selection.startsWith("[") ){
	try{ selection = JSON.parse(selection); }
	catch(e){ JS9.error("can't parse array selection"); }
    }
    // see if we are adding to the saved selection filter
    if( typeof selection === "string" ){
	if( this.layers[layerName].selection ){
	    if( opts.saved === "and" ){
		selection = `(saved) && (${selection})`;
	    } else if( opts.saved === "or" || opts.saved === true ){
		selection = `(saved) || (${selection})`;
	    }
	    selection = selection.replace(/saved/gi,
					  this.layers[layerName].selection);
	}
	// boolean selection is passed through the regSelect parser
	// (which will change the selection into an array of region ids)
	if( selection.match(/&|\||!/) ){
	    selection = this._parseShapes(layerName, selection, opts);
	} else if( opts.saveselection && selection ){
	    switch(selection.trim()){
	    case "all":
	    case "saved":
	    case "selected":
		break;
	    default:
		this.layers[layerName].selection = selection;
		break;
	    }
	}
    }
    // selection can be a single selection or an array of selections
    if( !JS9.isArray(selection) ){
	selection = [selection];
    }
    // process all selections
    for(j=0; j<selection.length; j++){
	// convenience variables that might be reset inside this loop
	// list of objects
	// reverse the order so we can traverse in reverse order!
	objects = canvas.getObjects().reverse();
	olen = objects.length;
	// list of groups for each object
	groups = getgroups(canvas, objects);
	// this selection
	id = selection[j];
	// if id is a positive int in string format, convert it to int
	// so we can process it as a region id coming from the command line
	if( (typeof id === "string") && /^[1-9]\d*$/.test(id) ){
	    id = parseInt(id, 10);
	}
	// but an active group does not mean selected regions are inside it
	ginfo = {group: null, canvas: canvas, layer: layerName};
	// select on the id
	switch( typeof id ){
	case "object":
	    // explicit object could be a shape or a shape in a group
	    aobjects = getshapes(objects);
	    alen = aobjects.length;
	    while( alen-- ){
		obj = aobjects[alen];
		if( obj && obj.params && (obj === id) ){
		    ginfo.group = lookupgroup(obj, objects);
		    xcb(obj, ginfo);
		    break;
		}
	    }
	    break;
	case "number":
	    // explicit shape id could be a shape or a shape in a group
	    aobjects = getshapes(objects);
	    alen = aobjects.length;
	    while( alen-- ){
		obj = aobjects[alen];
		if( obj && obj.params && (obj.params.id === id) ){
		    ginfo.group = lookupgroup(obj, objects);
		    xcb(obj, ginfo);
		    break;
		}
	    }
	    break;
	case "string":
	    // string id can be a color, shape, tag, etc.
	    // look for id in various ways
            if( id === "selected" ){
		// list of active objects
		aobjects = getshapes(canvas.getActiveObjects());
		alen = aobjects.length;
		// process all active objects
		while( alen-- ){
		    obj = aobjects[alen];
		    // find the group for this object
		    ginfo.group = lookupgroup(obj, objects);
		    // don't process shapes with parents in a group
		    if( obj.params && !obj.params.parent ){
			xcb(obj, ginfo);
		    }
		}
	    } else {
		// can't use forEachObject, which loops in ascending order,
		// because a "remove" cb changes the array destructively
		while( olen-- ){
		    obj = objects[olen];
		    // groups are handled specially: they have no params obj
		    // but when matching the group itself, we execute the
		    // callback on each object within the group
		    if( obj.type === "group" && !obj.params ){
			if( id === this.lookupGroup(obj) ||
			    id.toLowerCase() === "all"   ){
			    ginfo.group = obj;
			    if( opts.transparentgroup !== false ){
				// usual case: process each object in the group
				obj.forEachObject((o) => {
				    // but no text children
				    if( o.params && !o.params.parent ){
					xcb(o, ginfo);
				    }
				});
			    } else {
				// dangerous case: pass the group object
				// you'd better know what you are doing!
				xcb(obj, ginfo);
			    }
			} else {
			    // for some types of selections, we do need to
			    // look inside the group
			    obj.forEachObject((o) => {
				if( o.params && id === o.params.file ){
				    xcb(o, ginfo);
				}
			    });
			}
			// that's the entirety of processing we do on a group
			continue;
		    }
		    // make sure its a valid region
		    if( !obj.params ){ continue; }
		    // convenience variables
		    ocolor = obj.stroke.toLowerCase();
		    // no text children unless explicity specified
		    if( obj.params.parent && id !== "child" && id !== "All" ){
			continue;
		    }
		    // children should always have a parent
		    if( id === "child" && !obj.params.parent ){
			continue;
		    }
		    // set group info
		    ginfo.group = groups[olen];
		    // try to match this id in various ways
		    if( id.toLowerCase() === "all" ){
			// all
			xcb(obj, ginfo);
		    } else if( (id.toLowerCase() === ocolor) ||
			       (JS9.colorToHex(id).toLowerCase() === ocolor) ){
			// color
			xcb(obj, ginfo);
		    } else if( id === obj.params.shape ){
			// shape
			xcb(obj, ginfo);
		    } else if( id === obj.params.file ){
			// origin filename
			xcb(obj, ginfo);
		    } else if( typeof obj.params.data === "object" &&
			       id === obj.params.data.syncid       ){
			// sync id (see sync plugin)
			xcb(obj, ginfo);
		    } else if( id === "child" && obj.params.parent ){
			// all
			xcb(obj, ginfo);
		    } else if( id === "dcoords" && obj.params.preservedcoords ){
			// all
			xcb(obj, ginfo);
		    } else if( id === "nodcoords" && !obj.params.preservedcoords ){
			// all
			xcb(obj, ginfo);
		    } else if( id === "parent"            &&
			       obj.params.children        &&
			       obj.params.children.length ){
			// all
			xcb(obj, ginfo);
		    } else if( JS9.inArray(id, JS9.wcssyss) >= 0    &&
			       obj.params.wcsconfig               &&
			       obj.params.wcsconfig.wcssys === id ){
			// original wcs
			xcb(obj, ginfo);
		    } else if( obj.params.tags ){
			// tags
			for(i=0; i<obj.params.tags.length; i++){
			    tag = obj.params.tags[i];
			    if( id.match(/^\/.*\/$/) &&
				tag.match(new RegExp(id.slice(1,-1)))){
				xcb(obj, ginfo);
			    } else if( id === tag ){
				xcb(obj, ginfo);
			    }
			}
		    }
		}
	    }
	    break;
	}
    }
    return this;
};

// create a group selection from selected shapes
// call using image context
// eslint-disable-next-line no-unused-vars
JS9.Fabric.selectShapes = function(layerName, shape, opts){
    let selection, layer, canvas;
    const arr = [];
    // get layer
    layer = this.getShapeLayer(layerName);
    // sanity check
    if( !layer ){ return; }
    // convenience variable
    canvas = layer.canvas;
    // opts is optional
    opts = opts || {};
    // opts can be an object or json
    if( typeof opts === "string" ){
	try{ opts = JSON.parse(opts); }
	catch(e){ JS9.error(`can't parse selectShapes opts: ${opts}`, e); }
    }
    // we want to be able to select entire groups, not the underlying shapes
    if( JS9.isNull(opts.transparentgroup) ){ opts.transparentgroup = false; }
    // this selection is usually saved
    if( JS9.isNull(opts.saveselection) ){ opts.saveselection = true; }
    // shape defaults to "all"
    shape = shape || "all";
    // reset => remove selection for this layer
    if( shape === "reset" ){
	// remove last selection
	delete layer.selection;
	// change selection to none?
	if( opts.activateselection !== false ){
	    // deselect current active object, if necessary
	    if( canvas.getActiveObject() ){
		canvas.discardActiveObject();
	    }
	    // re-display so we don't see the old group
	    canvas.renderAll();
	}
	return this;
    }
    // collect the specified shapes
    this._selectShapes(layerName, shape, opts, (obj) => {
	// only select once, don't select shapes in groups
	if( JS9.inArray(obj, arr) < 0 && (!obj.params || !obj.params.groupid) ){
	    arr.push(obj);
	}
    });
    if( arr.length ){
	// deselect current active object, if necessary
	if( canvas.getActiveObject() ){
	    canvas.discardActiveObject();
	}
	if( arr.length === 1 ){
	    // select 1 shape
	    selection = arr[0];
	} else {
	    // create a group selection of 2+ shapes
	    selection = new fabric.ActiveSelection(arr, {
		canvas: canvas
	    });
	}
	// make this the active selection
	canvas.setActiveObject(selection);
	// display the new group
	canvas.renderAll();
    }
    return this;
};

// remove shapes from a group selection
// call using image context
// eslint-disable-next-line no-unused-vars
JS9.Fabric.unselectShapes = function(layerName, shape, opts){
    let layer, unshape, selection;
    layer = this.getShapeLayer(layerName);
    // sanity check
    if( !layer || !this.layers[layerName] ){ return; }
    // default is to unselect everything
    if( !shape || shape === "all" || shape === "selected" ){
	return this.selectShapes(layerName, "reset");
    }
    selection = this.layers[layerName].selection || "selected";
    unshape = `${selection} && !(${shape})`;
    return this.selectShapes(layerName, unshape, opts);
};

// update public object in shapes
// call using image context
JS9.Fabric.updateShapes = function(layerName, shape, mode, opts){
    // process the specified shapes
    this._selectShapes(layerName, shape, null, (obj, ginfo) => {
	this._updateShape(layerName, obj, ginfo, mode, opts);
    });
    return this;
};

// update multi-selection dialog boxes
// call using image context
JS9.Fabric._updateMultiDialogs = function(setmode){
    // update multiselect dialog box for this image, if necessary
    document.querySelectorAll("form[class*='regionsConfigForm']").forEach((element) => {
	const wrapped = JS9.wrapCollection(element);
	const multi = wrapped.data("multi");
	const winid = wrapped.data("winid");
	const im = wrapped.data("im");
	if(  multi && winid && im === this ){
	    if( im.tmp.updateMulti !== false ){
		im.initRegionsForm(null, {winid, multi, setmode});
	    }
	}
    });
};

// primitive to update one shape
// call using image context
JS9.Fabric._updateShape = function(layerName, obj, ginfo, mode, opts){
    let i, s, scalex, scaley, px, py, tval1, tval2, angstr;
    let bin, zoom, tstr, dpos, gpos, ipos, npos, objs, olen, radius, oangle;
    let opos, dist, txeq, owcssys, imforce, agroup, apos;
    const pub = {};
    const layer = this.layers[layerName];
    const moderexp = /^(child||export|unexport|move|mouseout)$/;
    const tr  = (x) => { return x.toFixed(2); };
    const tr4 = (x) => { return x.toFixed(4); };
    const updatewcs = (wcs, layer, pub, regstr, angstr, opts, obj) => {
	let i, s, v0, v1;
	// get ra and dec of central position
	s = JS9.pix2wcs(wcs, pub.x, pub.y).trim().split(/\s+/);
	obj.rastr = s[0];
	obj.decstr = s[1];
	obj.wcssys = s[2];
	v0 = JS9.strtoscaled(s[0]);
	if( JS9.isHMS(s[2], v0.dtype) ){
	    v0.dval *= 15.0;
	}
	v1 = JS9.strtoscaled(s[1]);
	obj.ra = v0.dval;
	obj.dec = v1.dval;
	// generate WCS strings iff updateWCS is true
	if( (opts.updateWCS !== false) &&
	    (opts.updateWCS || layer.opts.updateWCS) ){
	    obj.wcsstr = JS9.reg2wcs(wcs, regstr, JS9.REGSIZE)
		            .replace(/;$/, "");
	    // add angle to line, if possible
	    if( pub.shape === "line" && angstr ){
		obj.wcsstr = obj.wcsstr.replace(/} *$/, angstr + "}");
	    }
	    // wcs size args
	    s = obj.wcsstr.replace(/.*\(/,"").replace(/\).*/,"").split(",");
	    for(i=0; i<s.length; i++){
		s[i] = s[i].trim();
	    }
	    obj.wcsposstr = [s[0], s[1]];
	    switch(pub.shape){
	    case "annulus":
		obj.wcssizestr = [s[s.length-1]];
		break;
	    case "box":
	    case "cross":
		obj.wcssizestr = [s[2], s[3]];
		break;
	    case "circle":
		obj.wcssizestr = [s[2]];
		break;
	    case "ellipse":
		obj.wcssizestr = [s[2], s[3]];
		break;
	    case "point":
		break;
	    case "line":
	    case "polygon":
		obj.wcspts = [];
		for(i=0; i<s.length; i+=2){
		    v0 = JS9.strtoscaled(s[i]);
		    if( JS9.isHMS(obj.wcssys, v0.dtype) ){
			v0.dval *= 15.0;
		    }
		    v1 = JS9.strtoscaled(s[i+1]);
		    obj.wcspts.push({ra: v0.dval, dec: v1.dval});
		}
		break;
	    case "text":
		break;
	    default:
		break;
	    }
	}
    };
    // callbacks for regions (but not child regions or some modes)
    const xplugins = () => {
	let xname;
	const xeq = (onchange) => {
	    try{
		this.params.xeqonchange = false;
		JS9.xeqByName(onchange, window, this, pub);
	    }
	    catch(e){
		JS9.log("error in onchange: %s [%s]\n%s",
			this.id, e.message, JS9.strace(e));
	    }
	    finally{
		this.params.xeqonchange = true;
	    }
	};
	if( !obj.params.parent && !mode.match(moderexp) ){
	    // when xeqonchange is set on a layer
	    if( this.params.xeqonchange && layer.show ){
		if( layer.opts.onchange ){
		    xeq(layer.opts.onchange);
		} else if( layerName === "regions" &&
			   JS9.Regions.opts.onchange ){
		    // if onchange was set after region layer was set up
		    xeq(JS9.Regions.opts.onchange);
		}
	    }
	    // plugin callbacks: these have the form on[layer]change,
	    // e.g. onregionschange
	    xname = `on${layerName}change`;
	    this.xeqPlugins("shape", xname, pub);
	}
    };
    // sanity check
    if( !obj || !obj.params ){ return; }
    // convenience variables
    ginfo = ginfo || {};
    opts = opts || {};
    mode = mode || "update";
    // set scaling based on zoom factor
    if( this.display.layers[layerName].dtype === "main" &&
	!obj.params.preservedcoords ){
	zoom = this.rgb.sect.zoom;
    } else {
	zoom = 1;
    }
    // fill in the blanks
    pub.mode = mode;
    pub.id = obj.params.id;
    pub.groupid = obj.params.groupid;
    pub.shape = obj.params.shape;
    pub.layer = layerName;
    pub.color = obj.color || obj.stroke;
    pub.tags = obj.params.tags;
    pub.sticky = obj.params.sticky;
    pub.preservedcoords = obj.params.preservedcoords;
    if( obj.params.ignore ){
	pub.ignore = true;
    }
    if( obj.params.parent ){
	pub.parent = obj.params.parent.obj.params.id;
    } else {
	pub.parent = null;
    }
    if( obj.params.children && obj.params.children.length ){
	// for now, just output the first one (cf. listRegions)
	pub.child = obj.params.children[0].id;
    } else {
	pub.child = null;
    }
    dpos = obj.getCenterPoint();
    gpos = {x: 0, y: 0};
    if( ginfo.group ){
	// in a group, the display pos is relative to group pos,
	// so we need to add them together
	gpos = ginfo.group.getCenterPoint();
	dpos = {x: gpos.x + (dpos.x * ginfo.group.scaleX),
		y: gpos.y + (dpos.y * ginfo.group.scaleY)};
	// also need to rotate the position by the group angle
	if( ginfo.group.angle ){
	    dpos = JS9.rotatePoint(dpos, ginfo.group.angle, gpos);
	}
	// is the group contained in an active selection??
	if( ginfo.group.type !== "activeSelection" ){
	    agroup = layer.canvas.getActiveObject();
	    if( agroup && agroup.type === "activeSelection" ){
		objs = agroup.getObjects();
		olen = objs.length;
		for(i=0; i<olen; i++){
		    if( objs[i] === ginfo.group ){
			apos = agroup.getCenterPoint();
			break;
		    }
		}
	    }
	    if( !apos ){ agroup = null; }
	    if( agroup ){
		dpos = {x: apos.x + (dpos.x * agroup.scaleX),
			y: apos.y + (dpos.y * agroup.scaleY)};
		if( agroup.angle ){
		    dpos = JS9.rotatePoint(dpos, agroup.angle, apos);
		}
	    }
	}
    }
    // display position
    if( pub.preservedcoords ){
	pub.dx = dpos.x;
	pub.dy = dpos.y;
    }
    // image position
    ipos = this.displayToImagePos(dpos);
    pub.x = ipos.x;
    pub.y = ipos.y;
    // logical position
    pub.lcs = this.imageToLogicalPos(ipos);
    // why is this so complicated?
    if( mode !== "export" && obj.params.wcsconfig ){
	if( obj.params.wcsconfig.wcssys === "image" ){
	    imforce = "image";
	} else 	if( obj.params.wcsconfig.wcssys === "physical" ){
	    imforce = "physical";
	}
    }
    // wcs system and some convenience variables
    if( imforce === "image"                                        ||
	(this.params.wcssys === "image" && imforce !== "physical") ){
	pub.imsys = "image";
	px = pub.x;
	py = pub.y;
	bin = 1;
    } else {
	pub.imsys = pub.lcs.sys;
	px = pub.lcs.x;
	py = pub.lcs.y;
	bin = Math.sqrt(Math.pow(this.lcs.physical.reverse[0][0],2) +
		        Math.pow(this.lcs.physical.reverse[0][1],2));
    }
    // fabric angle is in opposite direction
    pub.angle = -obj.angle;
    // remove group angle
    if( ginfo.group ){
	pub.angle -= ginfo.group.angle;
    }
    if( agroup ){
	pub.angle -= agroup.angle;
    }
    // save pure fabric angle angle
    oangle = pub.angle;
    // remove file rotation and flip
    if( !pub.parent ){
	switch(pub.shape){
	case "box":
	case "cross":
	case "ellipse":
	case "text":
	    // take transform angle into account
	    if( JS9.notNull(this.params.transformScale) ){
		pub.angle /= this.params.transformScale;
	    }
	    if( JS9.notNull(this.params.transformAngle) ){
		pub.angle -= this.params.transformAngle;
	    }
	    // remove file rotation
	    if( this.raw.wcsinfo ){
		// rotated file
		if( this.raw.wcsinfo.crot ){
		    pub.angle -= this.raw.wcsinfo.crot;
		}
	    } else if( JS9.notNull(this.raw.header.LTM1_1) ||
		       JS9.notNull(this.raw.header.LTM1_2) ){
		try {
		    // use atan instead of atan2 to divide out scale factor
		    tval1 = Math.atan((this.raw.header.LTM1_2||0) /
				      (this.raw.header.LTM1_1||0));
		} catch(e){ tval1 = 0; }
		if( tval1 ){
		    tval1 = -tval1 * 180.0 / Math.PI;
		    pub.angle -= tval1;
		}
	    }
	    break;
	default:
	    break;
	}
    }
    // normalize the angle
    while( pub.angle < 0 ){
	pub.angle += 360;
    }
    while( pub.angle >= 360 ){
	pub.angle -= 360;
    }
    // the parts of the obj.scale[XY] values related to size (not zoom, binning)
    scalex = obj.scaleX / zoom;
    scaley = obj.scaleY / zoom;
    if( ginfo.group ){
	scalex *= ginfo.group.scaleX;
	scaley *= ginfo.group.scaleY;
    }
    switch(pub.shape){
    case "annulus":
	pub.shape = "annulus";
	pub.radii = [];
	if( pub.imsys !== "image" ){
	    pub.lcs.radii = [];
	}
	pub.imstr = `annulus(${tr(px)},${tr(py)},`;
	tstr = `annulus ${pub.x} ${pub.y} `;
	objs = obj.getObjects();
	olen = objs.length;
	for(i=0; i<olen; i++){
	    radius = objs[i].radius * scalex;
	    tval1 = radius * bin;
	    pub.imstr += tr(tval1);
	    if( JS9.REGSIZE ){
		tstr += `${pub.x} ${pub.y} ${pub.x + radius} ${pub.y} `;
	    } else {
		tstr += `${radius} `;
	    }
	    if( i === (olen - 1) ){
		pub.imstr += ")";
	    } else {
		pub.imstr += ",";
	    }
	    pub.radii.push(radius);
	    if( pub.imsys !== "image" ){
		pub.lcs.radii.push(tval1);
	    }
	}
	break;
    case "box":
    case "cross":
	pub.width = obj.width * scalex;
	pub.height = obj.height * scaley;
	tval1 = pub.width * bin;
	tval2 = pub.height * bin;
	if( pub.imsys !== "image" ){
	    pub.lcs.width = tval1;
	    pub.lcs.height = tval2;
	}
	pub.imstr = `${pub.shape}(${tr(px)},${tr(py)},${tr(tval1)},${tr(tval2)},${tr4(pub.angle)})`;
	if( JS9.REGSIZE ){
	    tstr = `${pub.shape} ${pub.x} ${pub.y} ${pub.x} ${pub.y} ${pub.x + pub.width} ${pub.y} ${pub.x} ${pub.y} ${pub.x} ${pub.y + pub.height} ${pub.angle * Math.PI / 180.0}`;
	} else {
	    tstr = `${pub.shape} ${pub.x} ${pub.y} ${pub.width} ${pub.height} ${pub.angle * Math.PI / 180.0}`;
	}
	break;
    case "circle":
	pub.radius = obj.radius * scalex;
	tval1 = pub.radius * bin;
	if( pub.imsys !== "image" ){
	    pub.lcs.radius = tval1;
	}
	pub.imstr = `circle(${tr(px)},${tr(py)},${tr(tval1)})`;
	if( JS9.REGSIZE ){
	    tstr = `circle ${pub.x} ${pub.y} ${pub.x} ${pub.y} ${pub.x + pub.radius} ${pub.y}`;
	} else {
	    tstr = `circle ${pub.x} ${pub.y} ${pub.radius}`;
	}
	break;
    case "ellipse":
	pub.r1 = obj.width * scalex / 2;
	pub.r2 = obj.height * scaley / 2;
	tval1 = pub.r1 * bin;
	tval2 = pub.r2 * bin;
	if( pub.imsys !== "image" ){
	    pub.lcs.r1 = tval1;
	    pub.lcs.r2 = tval2;
	}
	pub.imstr = `ellipse(${tr(px)},${tr(py)},${tr(tval1)},${tr(tval2)},${tr4(pub.angle)})`;
	if( JS9.REGSIZE ){
	    tstr = `ellipse ${pub.x} ${pub.y} ${pub.x} ${pub.y} ${pub.x + pub.r1} ${pub.y} ${pub.x} ${pub.y} ${pub.x} ${pub.y + pub.r2} ${pub.angle * Math.PI / 180.0}`;
	} else {
	    tstr = `ellipse ${pub.x} ${pub.y} ${pub.r1} ${pub.r2} ${pub.angle * Math.PI / 180.0}`;
	}
	break;
    case "point":
	pub.width =  obj.width * scalex;
	pub.height = obj.height * scaley;
	tval1 = pub.width * bin;
	tval2 = pub.height * bin;
	if( pub.imsys !== "image" ){
	    pub.lcs.width = tval1;
	    pub.lcs.height = tval2;
	}
	pub.imstr = `point(${tr(px)},${tr(py)})`;
	tstr = `point ${pub.x} ${pub.y}`;
	break;
    case "line":
    case "polygon":
	pub.imstr = `${pub.shape}(`;
	tstr = `${pub.shape} `;
	pub.pts = [];
	if( pub.imsys !== "image" ){
	    pub.lcs.pts = [];
	}
	for(i=0; i<obj.points.length; i++){
	    if( i > 0 ){
		pub.imstr += ",";
		tstr += " ";
	    }
	    // get current point
	    npos = this.displayToImagePos(
		{x: gpos.x + obj.left + obj.points[i].x * obj.scaleX,
		 y: gpos.y + obj.top  + obj.points[i].y * obj.scaleY}
	    );
	    // add rotation
	    npos = JS9.rotatePoint(npos, oangle, {x: pub.x, y: pub.y});
	    if( pub.imsys === "image" ){
		pub.imstr += `${tr(npos.x)},${tr(npos.y)}`;
	    } else {
		const {x, y} = this.imageToLogicalPos(npos);
		pub.imstr += `${tr(x)},${tr(y)}`;
		pub.lcs.pts.push({x, y});
	    }
	    tstr += `${npos.x} ${npos.y}`;
	    pub.pts.push(npos);
	    if( pub.shape === "line" ){
		if( i === 0 ){
		    dist = 0;
		} else {
		    opos = pub.pts[i-1];
		    dist += Math.sqrt(((npos.x - opos.x) * (npos.x - opos.x)) +
				      ((npos.y - opos.y) * (npos.y - opos.y)));
		}
	    }
	}
        if( pub.shape === "line" && JS9.notNull(dist) ){
	    pub.imstr += `) {"size":${tr(dist)},"units":"pixels"`;
	    // if only two points, add angle between them
	    if( pub.pts.length === 2 ){
		tval1 = Math.atan2(pub.pts[1].y - pub.pts[0].y,
				   pub.pts[1].x - pub.pts[0].x) * 180 / Math.PI;
		while( tval1 < 0 ){ tval1 += 360; }
		angstr = `,"posang":${tr4(tval1)},"posunits":"degrees"`;
		pub.imstr += angstr;
	    }
	    pub.imstr += "}";
	} else {
	    pub.imstr += ")";
	}
	// points already have the angle incorporated into them
	pub.angle = 0;
        break;
    case "text":
	pub.imstr = `text(${tr(px)},${tr(py)},"${obj.text}",${tr4(pub.angle)})`;
	tstr = `text ${pub.x} ${pub.y} "${obj.text}"` + ` ${pub.angle * Math.PI / 180.0}`;
	pub.text = obj.text;
	break;
    default:
	break;
    }
    // wcs processing
    if( this.validWCS() ){
	updatewcs(this.raw.wcs, layer, pub, tstr, angstr, opts, pub);
	if( mode !== "export"                                   &&
	    obj.params.wcsconfig && obj.params.wcsconfig.wcssys ){
	    txeq = JS9.globalOpts.xeqPlugins;
	    JS9.globalOpts.xeqPlugins = false;
	    owcssys = this.getWCSSys();
	    if( JS9.notWCS(obj.params.wcsconfig.wcssys) ){
		pub.wcsconfig = JS9.extend(true, {}, obj.params.wcsconfig);
	    } else {
		this.setWCSSys(obj.params.wcsconfig.wcssys, false);
		updatewcs(this.raw.wcs, layer, pub, tstr, angstr, opts,
			  obj.params.wcsconfig);
		pub.wcsconfig = JS9.extend(true, {}, obj.params.wcsconfig);
	    }
	    this.setWCSSys(owcssys, false);
	    JS9.globalOpts.xeqPlugins = txeq;
	}
    }
    // generic "data" property, optionally supplied when the shape is created
    pub.data = obj.params.data;
    // save the pub object
    obj.set("pub", pub);
    // update dialog box, if necessary
    if( obj.params.winid ){
	if( JS9.wrapCollection(obj.params.winid).is(":visible") ){
	    this.initRegionsForm(obj);
	} else {
	    obj.params.winid = null;
	}
    }
    // stop here if no callbacks were requested
    if( opts.nocb ){
	return pub;
    }
    // callbacks for regions
    xplugins();
    // post processing:
    // copy to clipboard, if necessary
    if( layerName === "regions" && JS9.globalOpts.regToClipboard ){
	switch(mode){
	case "update":
	    i = pub.parent || pub.id;
	    break;
	default:
	    i = null;
	    break;
	}
	if( JS9.notNull(i) ){
	    // ignore any problems
	    try{ s = this.listRegions(i, {mode: 1, includedcoords: true}); }
	    catch(e){ s = null; }
	    if( s ){ JS9.clipboard = s; }
	}
    }
    // update multi dialog boxes, if necessary
    if( layerName === "regions" && mode === "wcs" ){
	this._updateMultiDialogs(true);
    }
    // and return it
    return pub;
};

// lookup a group, either by name or by object
// groupObj = this.lookupGroup(groupID)
// groupID  = this.lookupGroup(groupObj)
JS9.Fabric.lookupGroup = function(group, layerName){
    let i, j, objs, obj, sobjs, sobj, layer, canvas;
    layerName = layerName||"regions";
    layer = this.getShapeLayer(layerName);
    // sanity check
    if( !layer ){ return null; }
    canvas = this.layers[layerName].canvas;
    if( typeof group === "string" ){
	objs = canvas.getObjects();
	for(i=0; i<objs.length; i++){
	    obj = objs[i];
	    if( obj.type === "group" && !obj.params ){
		sobjs = obj.getObjects();
		for(j=0; j<sobjs.length; j++){
		    sobj = sobjs[j];
		    if( sobj.params && sobj.params.groupid === group ){
			return obj;
		    }
		}
	    }
	}
    } else if( typeof group === "object" &&
	       group.type === "group"    &&
	       !group.params             ){
	objs = group.getObjects();
	if( objs && objs.length && objs[0] && objs[0].params ){
	    return objs[0].params.groupid;
	}
    }
    return null;
};

JS9.Fabric.listGroups = function(which, opts, layerName){
    let i, s, objs, obj, layer, canvas, groupid;
    let grpstr = "";
    // default is to list groups in region layer
    layerName = layerName || "regions";
    // get layer
    layer = this.getShapeLayer(layerName);
    // sanity check
    if( !layer ){ return grpstr; }
    // default to all groups
    which = which || "all";
    // opts can be an object or json
    if( typeof opts === "string" ){
	try{ opts = JSON.parse(opts); }
	catch(e){ JS9.error(`can't parse listGroups opts: ${opts}`, e); }
    }
    // opts is optional
    opts = opts || {};
    // convenience variable
    canvas = layer.canvas;
    // look for groups
    objs = canvas.getObjects();
    for(i=0; i<objs.length; i++){
	obj = objs[i];
	if( obj.type !== "group" || obj.params ){ continue; }
	groupid = obj.getObjects()[0].params.groupid;
	if( (which !== "all") && (which !== groupid ) ){ continue; }
	if( opts.includeregions === false ){
	    grpstr += `${groupid};`;
	} else {
	    s = `${this.getShapes(layerName, groupid, {format:"text", includejson:false, includecomments:true})};;`;
	    s = s.substring(s.indexOf(";")+1);
	    grpstr += `${groupid}:;${s}`;
	}
    }
    // display the group string, if necessary
    if( JS9.notNull(opts.mode) && opts.mode > 0 ){
	this.display.displayMessage("regions", grpstr);
    }
    return grpstr.replace(/;\s*/g, "\n").replace(/\n\n$/, "\n");
};

// create a quasi-permanent group from selected shapes
// call using image context
// eslint-disable-next-line no-unused-vars
JS9.Fabric.groupShapes = function(layerName, shape, opts){
    let  i, s, layer, dlayer, canvas, obj, id, skip, dupid;
    const objs = [];
    const pubs = [];
    const getid = (opts) => {
	let i = 1;
	let id = opts.groupid || `group_${i}`;
	while( this.lookupGroup(id) ){
	    i = i+1;
	    id = id.replace(/_[0-9][0-9]*$/, "") + `_${i}`;
	}
	return id;
    };
    // get layer
    layer = this.getShapeLayer(layerName);
    // sanity check
    if( !layer ){ return 0; }
    // dlayer
    dlayer = layer.dlayer;
    // opts is optional
    opts = opts || {};
    // opts can be an object or json
    if( typeof opts === "string" ){
	try{ opts = JSON.parse(opts); }
	catch(e){ JS9.error(`can't parse groupShapes opts: ${opts}`, e); }
    }
    // convenience variable
    canvas = layer.canvas;
    // id for this group
    id = getid(opts);
    // collect the specified shapes
    this._selectShapes(layerName, shape, opts, (obj) => {
	if( JS9.inArray(obj, objs) < 0 ){
	    // so far, so goodx
	    skip = false;
	    // look for conflicts
	    if( obj.params.groupid ){
		switch(JS9.globalOpts.regGroupConflict){
		case "skip":
		    // save id of the conflicting group
		    dupid = obj.params.groupid;
		    // flag to skip adding to new group
		    skip = true;
		    break;
		case "error":
		default:
		    s = sprintf("%s can only be a member of one group [%s,%s]",
				layerName === "regions" ? "regions" : "shapes",
				obj.params.id, obj.params.groupid);
		    JS9.error(s);
		    break;
		}
	    }
	    // save for group, if necessary
	    if( !skip ){
		obj.params.groupid = id;
		if( JS9.inArray("groupid", obj.params.exports) < 0 ){
		    obj.params.exports.push("groupid");
		}
		// save object
		objs.push(obj);
		pubs.push(obj.pub);
		// save children (i.e., text)
		// (but not pub, since don't call ongroupcreate on text)
		if( obj.params && obj.params.children.length ){
		    for(i=0; i<obj.params.children.length; i++){
			if( obj.params.children[i].obj ){
			    objs.push(obj.params.children[i].obj);
			}
		    }
		}
	    }
	}
    });
    // do we have shapes in this group?
    if( !objs.length ){
	return dupid;
    }
    // change selection?
    // deselect current active object
    if( canvas.getActiveObject() ){
	canvas.discardActiveObject();
    }
    // create selection
    obj = new fabric.ActiveSelection(objs, {
	canvas: canvas
    });
    // turn off selection processing to avoid side-effects
    JS9.globalOpts.skipSelectionProcessing = true;
    // make this the active group selection
    canvas.setActiveObject(obj);
    // create the group
    canvas.getActiveObject().toGroup();
    // remove active selection, if necessary
    if( opts.select === false ){
	if( canvas.getActiveObject() ){
	    canvas.discardActiveObject();
	}
    }
    delete JS9.globalOpts.skipSelectionProcessing;
    // display the new group
    canvas.renderAll();
    // save group id
    this.groups[layerName] = this.groups[layerName] || [];
    this.groups[layerName].push(id);
    // global callback when a group is created
    if( typeof dlayer.opts.ongroupcreate === "function" ){
	dlayer.opts.ongroupcreate.call(dlayer.canvas, id, this, pubs, objs);
    }
    // return the group id
    return id;
};

// remove shapes from a group
// call using image context
// eslint-disable-next-line no-unused-vars
JS9.Fabric.ungroupShapes = function(layerName, groupid, opts){
    let i, j, idx, got, layer, canvas, objs, obj, shapes, shape;
    layer = this.getShapeLayer(layerName);
    // sanity check
    if( !layer || !this.layers[layerName] ){ return this; }
    if( JS9.isNull(groupid) ){
	JS9.error("ungroup requires a group id or selection");
    }
    // opts is optional
    opts = opts || {};
    // convenience variable
    canvas = layer.canvas;
    // look for groups
    objs = canvas.getObjects();
    for(i=0; i<objs.length; i++){
	obj = objs[i];
	if( obj.type === "group" && !obj.params ){
	    shapes = obj.getObjects();
	    for(j=0, got=0; j<shapes.length; j++){
		shape = shapes[j];
		if( !shape.params ){ continue; }
		if( (groupid === "all") || (groupid === shape.params.groupid) ){
		    if( !got ){
			// deselect current active object
			if( canvas.getActiveObject() ){
			    canvas.discardActiveObject();
			}
			// make this the active group selection
			// turn off selection processing to avoid side-effects
			JS9.globalOpts.skipSelectionProcessing = true;
			canvas.setActiveObject(obj);
			canvas.getActiveObject().toActiveSelection();
			// remove active selection, if necessary
			if( !opts.select ){
			    canvas.discardActiveObject();
			}
			canvas.requestRenderAll();
			delete JS9.globalOpts.skipSelectionProcessing;
			got++;
		    }
		    // remove groupid from shape
		    delete shape.params.groupid;
		    idx = JS9.inArray("groupid", shape.params.exports);
		    if( idx >= 0 ){
			shape.params.exports.splice(idx, 1);
		    }
		}
	    }
	}
    }
    // remove id from groups
    if( this.groups[layerName] ){
	idx = JS9.inArray(groupid, this.groups[layerName]);
	if( idx >= 0 ){
	    this.groups[layerName].splice(idx, 1);
	}
    }

    return this;
};

// remove the active shape
// eslint-disable-next-line no-unused-vars
JS9.Fabric.removeShapes = function(layerName, shape, opts){
    let i, layer, canvas, ao;
    let undoao = false;
    const lopts = {mode: 1, includedcoords: true, sortids: false};
    const arr = [];
    const grp = [];
    layer = this.getShapeLayer(layerName);
    // sanity check
    if( !layer ){ return; }
    canvas = layer.canvas;
    // opts is optional
    opts = opts || {};
    // list active objects
    if( canvas.getActiveObject() ){
	ao = canvas.getActiveObjects();
    }
    // save regions for unremove?
    if( layerName === "regions" && JS9.globalOpts.unremoveReg ){
	this.regstack.push(this.listRegions(shape, lopts, layerName));
	if( this.regstack.length > JS9.globalOpts.unremoveReg ){
	    this.regstack = this.regstack.slice(0,JS9.globalOpts.unremoveReg);
	}
    }
    // process the specified shapes
    this._selectShapes(layerName, shape, opts, (obj, ginfo) => {
	let i, child, parent;
	if( (obj.params.removable !== false || opts.overrideRemovable) &&
	    (!obj.params.sticky || opts.sticky !== false)  	       ){
	    if( layer.dlayer.dtype === "main" ){
		this._updateShape(layerName, obj, ginfo, "remove");
	    }
	    // clear any dialog box
	    if( obj.params.winid ){
		obj.params.winid.close();
		obj.params.winid = null;
	    }
	    // unlink parent
	    if( obj.params.parent ){
		parent = obj.params.parent.obj;
		for(i=parent.params.children.length-1; i>=0; i--){
		    if( obj === parent.params.children[i].obj ){
			parent.params.children.splice(i,1);
			break;
		    }
		}
	    }
	    // mark children for removal
	    for(i=0; i<obj.params.children.length; i++){
		child = obj.params.children[i].obj;
		// mark for removal
		arr.push(child);
	    }
	    // mark group for removal
	    if( obj.params.groupid ){
		if( JS9.inArray(obj.params.groupid, grp) < 0 ){
		    grp.push(obj.params.groupid);
		}
	    }
	    // possibly mark active object for removal
	    if( ao && !undoao && JS9.inArray(obj, ao) >= 0 ){
		undoao = true;
	    }
	    // mark for removal
	    arr.push(obj);
	}
    });
    // discard active object if we are deleting one of its shapes
    // do before delete, as per: http://fabricjs.com/v2-breaking-changes-2
    if( undoao ){
	canvas.discardActiveObject();
    }
    // remove groups
    for(i=0; i<grp.length; i++){
	this.ungroupShapes(layerName, grp[i]);
    }
    // remove marked objects
    for(i=0; i<arr.length; i++){
	canvas.remove(arr[i]);
    }
    canvas.renderAll();
    // reset the counter if all shapes were removed?
    if( !canvas.size() && JS9.globalOpts.resetEmptyShapeId ){
	layer.nshape = 0;
    }
    return this;
};

// return one or more regions
// call using image context
JS9.Fabric.getShapes = function(layerName, shape, opts){
    let i, s, t, arr;
    let myshape = {};
    const shapes = [];
    // opts is optional
    opts = opts || {};
    // opts can be an object or json
    if( typeof opts === "string" ){
	try{ opts = JSON.parse(opts); }
	catch(e){ JS9.error(`can't parse getShapes opts: ${opts}`, e); }
    }
    // return regions in text format, if necessary
    if( layerName === "regions"     &&
	(opts.format === "text"     ||
	 opts.format === "csv"      ||
	 opts.format === "regions") ){
	opts.mode = opts.mode || 1;
	s = this.listRegions(shape, opts);
	if( opts.format === "csv" ){
	    arr = s.split(";");
	    for(i=0, s=""; i<arr.length; i++){
		if( !arr[i] ){ continue; }
		if( arr[i].toLowerCase().match(JS9.WCSEXP) ){
		    // when getting csv, only include wcs info if asked
		    if( opts.includewcs ){
			s += `${arr[i].trim()}\n`;
		    }
		} else {
		    t = arr[i].replace(/\(/, ",").replace(/\).*/, "").trim();
		    s += `${t}\n`;
		}
	    }
	} else if( opts.format === "regions" ){
	    s = s.replace(/ *; */g, "\n");
	}
	return s;
    }
    // process the specified shapes
    this._selectShapes(layerName, shape, opts, (obj) => {
	// public part of the shape
	myshape = obj.pub || {};
	// might need shape object itself
	if( opts.includeObj ){
	    myshape.obj = obj;
	}
	shapes.push(myshape);
    });
    // sort shapes by id to maintain original order of creation
    if( opts.sortids !== false ){
	shapes.sort((a, b) => { return (a.id||0) - (b.id||0); });
    }
    return shapes;
};

// change the specified shape(s)
// call using image context
JS9.Fabric.changeShapes = function(layerName, shape, opts){
    let i, s, sobj, bopts, layer, canvas, ao, aos, rlen, maxr, zoom, exports;
    let topts, xopts;
    const orad = [], cpts = [];
    layer = this.getShapeLayer(layerName);
    // sanity check
    if( !layer || !opts ){ return; }
    // opts can be an object or json
    if( typeof opts === "string" ){
	try{ opts = JSON.parse(opts); }
	catch(e){ JS9.error(`can't parse shape opts: ${opts}`, e); }
    }
    // delay changing the region, if this image is not the one being displayed
    if( this.display.image !== this ){
	this.delayedShapes = this.delayedShapes || [];
	this.delayedShapes.push({layer: layerName, shape: shape,
				 mode: "change", opts: opts});
	return;
    }
    canvas = layer.canvas;
    // active object
    ao = canvas.getActiveObject();
    if( ao && ao.type === "activeSelection" ){
	// save and temporarily remove a selected group
	// fabric.js doesn't deal with this very well
	aos = canvas.getActiveObjects()
	canvas.discardActiveObject();
	canvas.renderAll();
	ao = null;
    }
    // this selection is usually saved
    if( JS9.isNull(opts.saveselection) ){ opts.saveselection = true; }
    // process the specified shapes
    this._selectShapes(layerName, shape, opts, (obj, ginfo) => {
	// set scaling based on zoom factor
	if( this.display.layers[layerName].dtype === "main" &&
	    !obj.params.preservedcoords                     ){
	    zoom = this.rgb.sect.zoom;
	} else {
	    zoom = 1;
	}
	// combine the objects parameters with the new options
	// clearing some of the old ones first to avoid conflicts
	if( opts.radii ){
	    obj.params.radii = [];
	}
	if( opts.tags ){
	    obj.params.tags = [];
	}
	if( opts.locked !== undefined ){
	    delete obj.params.changeable;
	}
	// combine new opts with old opts
	bopts = JS9.extend(true, {}, obj.params, opts);
	// parse options and generate new obj and params
	sobj = this._parseShapeOptions(layerName, bopts, obj);
	// remove means remove specified shapes or all shapes
	if( sobj.remove ){
	    if( sobj.remove === true || sobj.remove === "true" ){
		sobj.remove = "all";
	    }
	    if( sobj.remove !== false && sobj.remove !== "false" ){
		this.removeShapes(layerName, sobj.remove || "all");
		return;
	    }
	}
	// get new option names to export when saving regions
	exports = this._exportShapeOptions(opts).filter( (item) => {
	    return !{}.hasOwnProperty.call(obj.params.exports, item);
	});
	sobj.params.exports = obj.params.exports.concat(exports);
	// if stroke (color) is defined, we probably need to convert it to hex
	if( sobj.opts.stroke ){
	    sobj.opts.color = sobj.opts.stroke;
	    sobj.opts.stroke = JS9.colorToHex(sobj.opts.stroke);
	}
	// shape-specific pre-processing
	switch(obj.params.shape){
	case "text":
	    // can't use stroke, use fill instead
	    if( sobj.opts.stroke ){
		sobj.opts.fill = sobj.opts.stroke;
	    }
	    sobj.opts.strokeWidth = 0;
	    break;
	case "line":
	case "polygon":
	    // if we are changing the points, reset the fabric angle
	    // otherwise, it's applied to points which know nothing about it
	    if( sobj.opts.points && sobj.opts.points.length ){
		obj.angle = 0;
	    }
	    break;
	}
	// change the shape
	obj.set(sobj.opts);
	// reestablish params object
	obj.params = JS9.extend(false, {}, obj.params, sobj.params);
	// if strokeWidth is specified, we change params.sw1,
	// which will be used by the rescaleBorder routine below
	if( sobj.opts.strokeWidth ){
	    obj.params.sw1 = sobj.opts.strokeWidth;
	}
	// shape-specific post-processing
	// mainly: change of size => remove size-based scaling factor
	switch(obj.params.shape){
	case "annulus":
	    if( opts.radii && opts.radii.length ){
		// remove existing annuli
		// can't remove inside the forEachObject loop
		obj.forEachObject( (tobj) => { orad.push(tobj); });
		// so do it outside the loop
		rlen = orad.length;
		for(i=0; i<rlen; i++){
		    obj.remove(orad[i]);
		    canvas.remove(orad[i]);
		}
		// generate new annuli, applying changes
		rlen = obj.params.radii.length;
		maxr = 0;
		topts = JS9.extend(true, {}, opts);
		topts.stroke = topts.stroke || obj.get("stroke");
		topts.strokeWidth = topts.strokeWidth || obj.get("strokeWidth");
		topts.strokeDashArray = topts.strokeDashArray || obj.get("strokeDashArray");
		for(i=0; i<rlen; i++){
		    topts.radius = obj.params.radii[i];
		    s = new fabric.Circle(topts);
		    maxr = Math.max(maxr, obj.params.radii[i]);
		    obj.add(s);
		}
		obj.scaleX = zoom;
		obj.scaleY = zoom;
		// reset size of group
		obj.width = maxr * 2;
		obj.height = maxr * 2;
		if( ao === obj ){
		    canvas.setActiveObject(obj);
		}
	    }
	    break;
	case "box":
	    if( opts.width ){
		obj.scaleX = zoom;
	    }
	    if( opts.height ){
		obj.scaleY = zoom;
	    }
	    break;
	case "circle":
	    if( opts.radius ){
		obj.scaleX = zoom;
		obj.scaleY = zoom;
	    }
	    break;
	case "cross":
	    topts = JS9.extend(true, {}, opts);
	    topts.stroke = topts.stroke || obj.get("stroke");
	    // change width to two points making up the first line
	    if( topts.width ){
		obj.scaleX = zoom;
		cpts[0] = [{x: -topts.width/2, y: 0},
			   {x:  topts.width/2, y: 0}];
		delete topts.width;
	    }
	    // change height to two points making up the second line
	    if( topts.height ){
		obj.scaleY = zoom;
		cpts[1] = [{x: 0, y: -topts.height/2},
			   {x: 0, y: topts.height/2}];
		delete topts.height;
	    }
	    // angle gets incorporated into the group
	    if( topts.angle ){
		delete topts.angle;
	    }
	    // apply changes to each line of the cross
	    obj.forEachObject((tobj, idx) => {
		xopts = JS9.extend(true, {}, topts);
		if( cpts[idx] ){ xopts.points = cpts[idx]; }
		tobj.set(xopts);
	    });
	    break;
	case "ellipse":
	    if( opts.r1 ){
		obj.rx = obj.params.r1;
		obj.scaleX = zoom;
		// this sets the width of the control box
		// why is it not done automatically???
		obj.width = obj.rx * 2;
	    }
	    if( opts.r2 ){
		obj.ry = obj.params.r2;
		obj.scaleY = zoom;
		// this sets the height of the control box
		// why is it not done automatically???
		obj.height = obj.ry * 2;
	    }
	    break;
	case "line":
	case "polygon":
	    if( (opts.points && opts.points.length) ||
		(opts.pts && opts.pts.length)       ){
		obj.scaleX = zoom;
		obj.scaleY = zoom;
	    }
	    if( ao === obj ){
		JS9.Fabric.removePolygonAnchors(layer.dlayer, obj);
		JS9.Fabric.addPolygonAnchors(layer.dlayer, obj);
	    }
	    // reset the center point
	    JS9.resetPolygonCenter(obj);
	    break;
	case "text":
	    if( opts.text ){
		obj.params.text = opts.text;
	    }
	    break;
	}
	// make sure border width is correct
	obj.rescaleBorder();
	// non-changeable shapes go to back
	if( obj.params.changeable === false ){
	    canvas.sendToBack(obj);
	}
	// send region to front or back of set of overlapping regions
	switch(sobj.opts.send){
	case "front":
	    canvas.bringToFront(obj);
	    if( ao === obj ){
		canvas.discardActiveObject();
	    }
	    break;
	case "back":
	    canvas.sendToBack(obj);
	    if( ao === obj ){
		canvas.discardActiveObject();
	    }
	    break;
	default:
	    break;
	}
	// update children
	JS9.Fabric.updateChildren(layer.dlayer, obj, "moving");
	JS9.Fabric.updateChildren(layer.dlayer, obj, "scaling");
	JS9.Fabric.updateChildren(layer.dlayer, obj, "rotating");
	// update child's parent deltas
	JS9.Fabric.updateChildren(layer.dlayer, obj, "deltas");
	// and reset coords
	obj.setCoords();
	// might need to make a text shape as a child of this shape
	this._handleChildText(layerName, obj, opts);
	// update the shape info and make callbacks
	this._updateShape(layerName, obj, ginfo, "update");
	// callback if necessary
	if( opts.onchangeshapes && obj.pub ){
	    try{ JS9.xeqByName(opts.onchangeshapes, this, this, obj.pub); }
	    catch(e){ JS9.error("in onchangeshapes callback", e, false); }
	}
    });
    // reconstitute the selected group, if necessary
    if( aos ){
	this.selectShapes(layerName, aos);
    }
    // redraw (unless explicitly specified otherwise)
    if( (opts.redraw === undefined) || opts.redraw ){
	canvas.renderAll();
    }
    return this;
};

// update shape layer after a change in panning, zooming, binning
// uses ListRegions to recreate regions, very stable but slow for many shapes
// call using image context
JS9.Fabric.refreshShapes = function(layerName){
    let regstr, owcssys, txeq, opts;
    // sanity check
    if( !layerName ){ return; }
    // convenience variables
    opts = {
	mode:1,
	sticky:false,
	ignoreignore:true,
	saveediting:true,
	savewcsconfig:true,
	sortids: false,
	saveid:true
    };
    // temporarily turn off plugin execution to avoid firing regions callbacks
    txeq = JS9.globalOpts.xeqPlugins;
    JS9.globalOpts.xeqPlugins = false;
    // temporarily change wcs system to be independent of image coords
    // (in case we copied regions from one image to another)
    owcssys = this.getWCSSys();
    if( owcssys === "image" ){
	// get a wcs sys independent of image coords
	if( this.validWCS() ){
	    this.setWCSSys("native", false);
	} else {
	    this.setWCSSys("physical", false);
	}
    }
    // special optimization when panning an image with the mouse,
    // to deal with slow panning a large number of regions
    if( this.tmp.panzoomRefresh && this.tmp.panzoomRefresh[layerName] ){
	if( !this.tmp.panzoomRefresh[layerName].regstr ){
	    // save current regions
	    regstr = this.listRegions("all", opts, layerName);
	    this.tmp.panzoomRefresh[layerName] = {regstr:regstr, refresh:false};
	    // remove current regions (including unremovable ones)
	    this.removeShapes(layerName, "all", {overrideRemovable: true,
						 sticky: false});
	} else {
	    if( this.tmp.panzoomRefresh[layerName].refresh ){
		regstr = this.tmp.panzoomRefresh[layerName].regstr;
		// add back regions in current configuration
		this.addShapes(layerName, regstr, {restoreid: true});
	    }
	}
    } else {
	// get current regions (i.e., before update to current configuration)
	regstr = this.listRegions("all", opts, layerName);
	if( regstr ){
	    // save selection (remove shapes destroys it)
	    this.saveSelection(layerName);
	    // remove current regions (including unremovable ones)
	    this.removeShapes(layerName, "all", {overrideRemovable: true,
						 sticky: false});
	    // add back regions in current configuration
	    this.addShapes(layerName, regstr, {restoreid: true,
					       sortids: false});
	    // restore selection
	    this.restoreSelection(layerName);
	}
    }
    // restore wcs system, if necessary
    if( owcssys === "image" ){
	this.setWCSSys(owcssys, false);
	// update shapes to use the original coord system
	this.updateShapes(layerName, "all", "refresh");
    }
    // restore plugin execution
    JS9.globalOpts.xeqPlugins = txeq;
    return this;
};

// copy one or more shapes to another image
// call using image context
JS9.Fabric.copyShapes = function(layerName, to, which){
    let i, im, s, opts, layer;
    const ims = [];
    layer = this.getShapeLayer(layerName);
    // sanity check
    if( !layer ){ return; }
    if( typeof to === "object" ){
	ims.push(to);
    } else if( to === "all" ){
	for(i=0; i<JS9.images.length; i++){
	    if( this !== JS9.images[i] ){
		ims.push(JS9.images[i]);
	    }
	}
    } else {
	im = JS9.lookupImage(to);
	if( im ){
	    ims.push(im);
	}
    }
    if( !ims.length ){
	return;
    }
    // list shapes
    opts = {
	mode: 1,
	includedcoords: JS9.globalOpts.regCopyDCoords,
	sortids: false
    };
    s = this.listRegions(which, opts, layerName);
    for(i=0; i<ims.length; i++){
	// use this layer's opts, if possible
	if( this.display.layers[layerName] ){
	    opts = this.display.layers[layerName].opts;
	} else {
	    // else use reasonable default
	    opts = JS9.Regions.opts;
	}
	// make sure layer exists
	ims[i].display.newShapeLayer(layerName, opts);
	// add shapes to layer
	ims[i].addShapes(layerName, s);
    }
    return this;
};

// add (or remove) a point to a polygon, adapted from:
// http://stackoverflow.com/questions/14014861/constrain-image-to-a-path-in-kineticjs
// call using image context
JS9.Fabric._addPolygonPoint = function(layerName, obj, evt){
    let i, points, p1, p2, minX, minY, maxX, maxY, dir, m, dot, d, angle, layer;
    let mpos = {};
    let pVec = {};
    let p = {};
    let diff  =  Number.MAX_VALUE;   // a bloated diff, for minimum comparison
    const canv = {}, local = {};
    const newpt = {}, pos = {};
    // sanity check
    if( !obj || !obj.points){ return; }
    // get mouse position
    mpos = JS9.eventToDisplayPos(evt);
    // convert the drag position from absolute to local to the group
    canv.x = obj.getCenterPoint().x;
    canv.y = obj.getCenterPoint().y;
    local.x = (mpos.x - canv.x) / obj.get("scaleX");
    local.y = (mpos.y - canv.y) / obj.get("scaleY");
    // rotation angle
    angle = -obj.get("angle") * Math.PI / 180.0;
    while( angle > (Math.PI * 2) ){
	angle -= Math.PI * 2;
    }
    pos.x = Math.cos(angle) * local.x - Math.sin(angle) * local.y;
    pos.y = Math.sin(angle) * local.x + Math.cos(angle) * local.y;
    //Get the list of points from the polygon
    points = obj.points;
    //The algorithm is simple, iterate through the list of points
    //and select a pair which forms a side of the polygon.
    //For this side, pick a main point. Find the direction vector
    //with respect to this main point, and find the position vector
    //from this main point to the drag position.
    //Dot product of position vector and direction vector give us
    //the projection of the point on the current side.
    //A simple bounds checking to ensure the projection is on
    //the side, then a distance calculation.
    //If the distance found is less than the current minimum difference
    //update diff, newX and newY.
    for(i=0; i<points.length; i++){
        //Get point pair.
        p1 = points[i];
        p2 = points[(i+1)%points.length];
        //Find the bounds for checking projection bounds later on
        minX = (p1.x < p2.x ? p1.x : p2.x);
        minY = (p1.y < p2.y ? p1.y : p2.y);
        maxX = (p1.x > p2.x ? p1.x : p2.x);
        maxY = (p1.y > p2.y ? p1.y : p2.y);
        //Select p2 as the main point.
        //Find the direction vector and normalize it.
        dir = {x: p1.x - p2.x, y: p1.y - p2.y};
        m = Math.sqrt(dir.x*dir.x + dir.y*dir.y);
        if( m !== 0 ){
            dir.x = dir.x/m;
            dir.y = dir.y/m;
        }
        //Find the position vector
        pVec = {x: pos.x - p2.x, y: pos.y - p2.y};
        //Dot product
        dot = pVec.x * dir.x + pVec.y * dir.y;
        //Find the projection along the current side
        p = {x: p2.x + dir.x * dot, y: p2.y + dir.y * dot};
        //Bounds checking to ensure projection remains
        //between the point pair.
        if( p.x < minX ){
            p.x = minX;
	} else if( p.x > maxX ){
            p.x = maxX;
	}
        if( p.y < minY ){
            p.y = minY;
	} else if( p.y > maxY ){
            p.y = maxY;
	}
        //Distance calculation.
        d = (p.x-pos.x) * (p.x-pos.x) + (p.y-pos.y) * (p.y-pos.y);
        //Minimum comparison.
        if( d < diff ){
            diff = d;
	    newpt.x = p.x;
	    newpt.y = p.y;
	    if( i === points.length ){
		newpt.i = 0;
	    } else {
		newpt.i = i;
	    }
        }
    }
    // get canvas
    layer = this.getShapeLayer(layerName);
    // remove anchors
    JS9.Fabric.removePolygonAnchors(layer.dlayer, obj);
    // add the new point into the points array
    points.splice(newpt.i+1, 0, {x: newpt.x, y: newpt.y});

    // making this the active object will recreate the anchors
    switch(obj.type){
    case "polyline":
    case "polygon":
	JS9.Fabric.addPolygonAnchors(layer.dlayer, obj);
	layer.dlayer.canvas.renderAll();
	break;
    }
    // set currently selected shape
    if( obj.polyparams ){
	layer.dlayer.params.sel = obj.polyparams.polygon;
    } else if( obj.params ){
	layer.dlayer.params.sel = obj;
    }
};

// remove the specified point
// call using image context
JS9.Fabric._removePolygonPoint = function(layerName, obj){
    let layer, polygon, points, pt;
    // sanity check
    if( !obj || !obj.polyparams ){ return; }
    // get info on this point
    polygon = obj.polyparams.polygon;
    points = polygon.points;
    // maintain minimum number of points
    if( (polygon.type === "polygon") && (points.length <= 3) ){
	return;
    } else if( (polygon.type === "polyline") && (points.length <= 2) ){
	return;
    }
    pt = obj.polyparams.point;
    // delete to stop an executing movePoint callback
    delete obj.polyparams.point;
    // get layer
    layer = this.getShapeLayer(layerName);
    // remove anchors
    JS9.Fabric.removePolygonAnchors(layer.dlayer, polygon);
    // add the new point into the points array
    points.splice(pt, 1);
    // reset the center point
    JS9.resetPolygonCenter(polygon);
    // making this the active object will recreate the anchors
    layer.canvas.setActiveObject(polygon);
};

// add anchors to a polygon
// don't need to call using image context
JS9.Fabric.addPolygonAnchors = function(dlayer, obj){
    let i, a;
    let pos = {};
    const canvas = dlayer.canvas;
    const movePoint = (obj) => {
	let anchor, poly, pt, points, im;
	// anchor changed location to obj.transform.target in v4.5.1
	if( obj.target && obj.target.polyparams ){
	    anchor = obj.target;
	} else if( obj.transform                                           &&
		   obj.transform.target && obj.transform.target.polyparams ){
	    anchor = obj.transform.target;
	}
	// sanity check
	if( !anchor ){ return; }
	// this is the polygon associated with this anchor
	poly = anchor.polyparams.polygon;
	// if the polygon is not changeable, just return
	if( poly.params.changeable === false ){
	    return;
	}
	// these are the points in the polygon
	points = poly.get("points");
	// this is the point id associated with this anchor
	pt = anchor.polyparams.point;
	// if pt is not valid, just return
	if( pt === undefined  || points[pt] === undefined ){
	    return;
	}
	// new point for this anchor relative to center
	// NB: anchor was rotated onto the vertex
	if( poly.angle ){
	    pos = JS9.rotatePoint({x: anchor.left, y: anchor.top}, -poly.angle,
				{x: poly.left, y: poly.top});
	} else {
	    pos.x = anchor.left;
	    pos.y = anchor.top;
	}
	// move the polygon point to the anchor (in unscaled coords)
	points[pt].x = (pos.x - poly.left) / poly.scaleX;
	points[pt].y = (pos.y - poly.top) / poly.scaleY;
	// reset the center point
	JS9.resetPolygonCenter(poly);
	// update the shape info
	if( dlayer.display.image ){
	    im = dlayer.display.image;
	    im._updateShape(poly.params.layerName, poly, null, "update");
	    if( im.params.listonchange || poly.params.listonchange ){
		im.listRegions(poly, {mode: 2});
	    }
	}
	// redraw
	canvas.renderAll();
    };
    const moveAnchors = (obj) => {
	let ii;
	let tpos = {};
	// change anchor positions
	for(ii=0; ii<obj.params.anchors.length; ii++){
	    tpos.x = obj.left + obj.points[ii].x * obj.scaleX;
	    tpos.y = obj.top  + obj.points[ii].y * obj.scaleY;
	    if( obj.angle ){
		// anchor is rotated onto the vertex
		// (easier than taking rotation out of each vertex)
		tpos = JS9.rotatePoint(tpos, obj.angle,
				       {x: obj.left, y: obj.top});
	    }
	    obj.params.anchors[ii].set({left: tpos.x,
					top: tpos.y,
					angle: obj.angle});
	    obj.params.anchors[ii].setCoords();
	}
	// new bounding box dimensions (don't change points)
	obj._calcDimensions(true);
	// redraw
	canvas.renderAll();
    };
    // sanity check: don't add anchors twice
    if( obj.params.anchors ){ return; }
    // sanity check: don't add if polygon is not changeable
    if( obj.params.changeable === false ){ return; }
    obj.params.anchors = [];
    // make a rectangle at each anchor point
    for(i=0; i<obj.points.length; i++){
	pos.x = obj.left + obj.points[i].x * obj.scaleX;
	pos.y = obj.top + obj.points[i].y * obj.scaleY;
	if( obj.angle ){
	    pos = JS9.rotatePoint(pos, obj.angle, obj.getCenterPoint());
	}
	a = new fabric.Rect({
	    left: pos.x,
	    top: pos.y,
	    hasControls: false,
	    hasRotatingPoint: false,
	    hasBorders: false,
	    selectable: true,
	    fill: obj.get("stroke"),
	    hoverCursor: "pointer",
	    width: JS9.Fabric.opts.cornerSize + 2,
	    height: JS9.Fabric.opts.cornerSize + 2,
	    padding: 2
	});
	// add resize func on move
	a.on("moving", movePoint);
	// save point in the polygon for move
	a.polyparams = {};
	a.polyparams.polygon = obj;
	a.polyparams.point = i;
	// backlink to polygon for removal
	obj.params.anchors[i] = a;
	// add it to canvas
	canvas.add(a);
    }
    // reposition anchors on move
    obj.on("moving", () => {
	moveAnchors(obj);
    });
    obj.on("rotating", () => {
	moveAnchors(obj);
    });
    obj.on("scaling", () => {
	moveAnchors(obj);
    });
    obj.setCoords();
};

// remove anchors from a polygon
// don't need to call using image context
JS9.Fabric.removePolygonAnchors = function(dlayer, shape){
    let i;
    const canvas = dlayer.canvas;
    if( shape && shape.params && shape.params.anchors ){
	// need to be able to remove anchors when locking a polygon
	// if( shape.params.changeable === false ){
	//    return;
	// }
	// remove all anchors
	for(i=0; i<shape.params.anchors.length; i++){
	    canvas.remove(shape.params.anchors[i]);
	}
	delete shape.params.anchors;
    }
};

// ungroup annulus so that individual circles can be adjusted
// call using image context
JS9.Fabric._ungroupAnnulus = function(layerName, shape){
    let i, id, layer, objs, opts;
    const epsilon = 0.000001;
    layer = this.getShapeLayer(layerName);
    // sanity check
    if( !layer ){ return; }
    // construct edit parameter object
    this.editAnnulus = { annulus: shape.params.id, ids: [] };
    // properties of circles in the edit object
    opts = {
	top: shape.top,
	left: shape.left,
	lockMovementX: true,
	lockMovementY: true,
	stroke: shape.stroke,
	strokeDashArray: [3,1]
    };
    // add circles so that smallest is on top
    objs = shape.getObjects();
    // largest to smallest so smallest ends up on top of the shape stack
    objs.sort((a, b) => { return b.radius - a.radius; });
    // add circle for edit
    for(i=0; i<objs.length; i++){
	opts.radius = objs[i].radius;
	// can't edit radius of 0 ...
	// so make it tiny, and undo as needed on the other end
	if( opts.radius === 0 ){
	    opts.radius = epsilon;
	}
	opts.ignore = true;
	id = this.addShapes(layerName, "circle", opts);
	this.editAnnulus.ids.push(id);
    }
    // make the original annulus not visible
    opts = {editing: true};
    this.changeShapes(layerName, shape, opts);
    // deactivate selection and send to the back of the shape stack
    if( layer.canvas.getActiveObject() === shape ){
	layer.canvas.discardActiveObject();
    }
    layer.canvas.sendToBack(shape);
    layer.canvas.renderAll();
};

// regroup annulus after adjusting individual circles
// call using image context
JS9.Fabric._regroupAnnulus = function(layerName, e){
    let i, j, id, ids, cid, layer, opts, discard;
    const epsilon = 0.000001;
    const circles = [];
    // sanity check
    if( !this.editAnnulus ){ return; }
    layer = this.getShapeLayer(layerName);
    // sanity check
    if( !layer ){ return; }
    // if shift key is pressed, we discard the edits
    if( typeof e === "boolean" ){
	discard = e;
    } else if( typeof e === "object" ){
	discard = e.shiftKey;
    }
    // make the annulus visible and changeable again
    opts = {editing: false};
    // also change the radii unless we are discarding
    if( !discard ){
	// get list of circles
	layer.canvas.getObjects().forEach( (o) => {
	    if( o.params && o.params.shape === "circle" ){
		circles.push(o);
	    }
	});
	// will hold new radii
	opts.radii = [];
	// ids of circles
	ids = [...this.editAnnulus.ids];
	// for each id, find the circle object and get its radius
	// (what we're looking for is likely at the end of the stack)
	for(j=circles.length-1; j>=0; j--){
	    cid = circles[j].params.id;
	    for(i=ids.length-1; i>=0; i--){
		id = ids[i];
		if( cid === id ){
		    // if pub.radius is epsilon, change back to 0
		    if( circles[j].pub.radius === epsilon ){
			circles[j].pub.radius = 0;
		    }
		    opts.radii.push(circles[j].pub.radius);
		    ids.splice(i, 1);
		    break;
		}
	    }
	    if( !ids.length ){
		break;
	    }
	}
	opts.radii.sort((a, b) => { return a - b; });
    }
    // change the annulus
    this.changeShapes(layerName, this.editAnnulus.annulus, opts);
    // remove the edit circles
    this.removeShapes(layerName, this.editAnnulus.ids);
    // remove current edit parameters
    delete this.editAnnulus;
};

// update child regions
// don't need to call using image context
JS9.Fabric.updateChildren = function(dlayer, shape, type){
    let i, o, p, child, nangle, npos, pangle, objects, olen, got;
    let tdleft, tdtop;
    let x = {};
    // region layer only, for now
    if( dlayer.layerName !== "regions" ){
	return;
    }
    // re-init objects within for parents and children
    if( type === "objects" ){
	// get list of top-level objects, replacing groups with their objects
	objects = dlayer.canvas.getObjects().reverse();
	olen = objects.length;
	do{
	    got = 0;
	    while( olen-- ){
		o = objects[olen];
		// replace group with objects inside the group
		if( o.type === "group" && !o.params ){
		    objects.splice(olen, 1, ...o.getObjects());
		    got++;
		}
	    }
	    olen = objects.length;
	} while( got );
	// first get a list of parents and children
	objects.forEach( (o) => {
	    if( o.params ){
		if( o.params.parent || o.params.children.length ){
		    x[o.params.id] = o;
		}
	    }
	});
	// then re-assign obj pointers to parents and children
	objects.forEach( (o) => {
	    if( o.params ){
		if( o.params.parent ){
		    o.params.parent.obj = x[o.params.parent.id];
		}
		for(i=0; i<o.params.children.length; i++){
		    o.params.children[i].obj = x[o.params.children[i].id];
		}
	    }
	});
	return;
    }
    // for the rest, we need top-level shapes (e.g., not polygon anchors)
    if( !shape || !shape.params ){
	return;
    }
    // handle update to parent deltas when a child shape changes
    if( type === "deltas" ){
	if( shape.params.parent ){
	    p = shape.params.parent;
	    tdleft = p.obj.left - shape.left;
	    tdtop = p.obj.top - shape.top;
	    if( tdleft !== p.dleft || tdtop !== p.dtop ){
		p.dleft = tdleft;
		p.dtop = tdtop;
		p.moved = true;
	    } else {
		delete p.moved;
	    }
	}
	return;
    }
    // update children after a parent region is modified
    for(i=0; i<shape.params.children.length; i++){
	child = shape.params.children[i].obj;
	p = child.params.parent;
	switch(type){
	case "moving":
	    child.left  = shape.left - p.dleft;
	    child.top   = shape.top - p.dtop;
	    break;
	case "rotating":
	    pangle = shape.angle;
	    while( pangle < 0 ){
		pangle += 360;
	    }
	    while( pangle >= 360 ){
		pangle -= 360;
	    }
	    nangle = pangle - p.lastangle;
	    npos = JS9.rotatePoint({x: child.left,y: child.top},
				   nangle,
				   {x: shape.left, y: shape.top});
	    child.left = npos.x;
	    child.top = npos.y;
	    p.dleft = shape.left - child.left;
	    p.dtop = shape.top - child.top;
	    child.angle = child.angle + nangle;
	    while( child.angle < 0 ){
		child.angle += 360;
	    }
	    while( child.angle >= 360 ){
		child.angle -= 360;
	    }
	    p.lastangle = pangle;
	    break;
	case "scaling":
	    p.dleft = p.dleft * (shape.scaleX / p.lastscalex);
	    p.dtop = (p.dtop - p.textheight) *
		(shape.scaleY / p.lastscaley) + p.textheight;
	    p.lastscalex = shape.scaleX;
	    p.lastscaley = shape.scaleY;
	    p.moved = true;
	    child.left  = shape.left - p.dleft;
	    child.top   = shape.top - p.dtop;
	    break;
	}
	child.setCoords();
	if( dlayer.display.image ){
	    dlayer.display.image.updateShapes(dlayer.layerName, child,
					      "updatechild");
	}
    }
};

// reset center of a polygon
// don't need to call using image context
JS9.resetPolygonCenter = function(poly){
    let i, ndx, ndy, dobj, calcDim, dx, dy;
    let tpos = {};
    // deltas to center
    dobj = poly._calcDimensions();
    dx = (dobj.left + (dobj.width  / 2)) * poly.scaleX;
    dy = (dobj.top  + (dobj.height / 2)) * poly.scaleY;
    // new center
    if( poly.angle ){
	tpos = JS9.rotatePoint(
	    {x: poly.left + dx, y: poly.top  + dy},
	    poly.angle,
	    {x: poly.left, y: poly.top}
	);
    } else {
	tpos.x = poly.left + dx;
	tpos.y = poly.top + dy;
    }

    // move points relative to new center
    // required by polygon changes starting in fabric 1.5.x
    ndx = dx / poly.scaleX;
    ndy = dy / poly.scaleY;
    for(i=0; i<poly.points.length; i++){
	poly.points[i].x -= ndx;
	poly.points[i].y -= ndy;
    }
    // set new center
    poly.left = tpos.x;
    poly.top = tpos.y;
    // reset control box
    // https://stackoverflow.com/questions/55025481/fabric-js-adjusting-the-size-of-the-controls-of-a-modified-polygon-v1-7-22-vs
    calcDim = poly._calcDimensions();
    poly.width = calcDim.width;
    poly.height = calcDim.height;
    poly.pathOffset = {
        x: calcDim.left + poly.width / 2,
        y: calcDim.top + poly.height / 2
    };
    // new coordinates
    poly.setCoords();
};

// save selection for later restore
// call using image context
JS9.Fabric.saveSelection = function(layerName){
    let s, layer, canvas, obj, objs, olen;
    layer = this.getShapeLayer(layerName);
    if( !layer ){ return; }
    canvas = layer.canvas;
    objs = canvas.getActiveObjects();
    olen = objs.length;
    // only save selections for one region or group
    if( olen !== 1 ){ return; }
    obj = objs[0];
    if( obj.params ){
	if( obj.params.changeable !== false ){
	    layer.savesel = obj.params.id;
	}
    } else if( obj.type === "group" ){
	s = this.lookupGroup(obj);
	if( s ){
	    layer.savesel = s;
	}
    }
};

// restore previously saved selection
// call using image context
JS9.Fabric.restoreSelection = function(layerName){
    let i, o, id, layer, savesel, canvas, objs, olen;
    layer = this.getShapeLayer(layerName);
    if( !layer || !layer.savesel ){ return; }
    canvas = layer.canvas;
    savesel = layer.savesel;
    objs = canvas.getObjects();
    olen = objs.length;
    for(i=0; i<olen; i++){
	o = objs[i];
	if( o.params && o.params.id === savesel ){
	    id = o.params.id;
	    break;
	} else if( o.type === "group" && this.lookupGroup(o) === savesel ){
	    id = savesel;
	    break;
	}
    }
    if( id ){
	// turn off selection processing to avoid side-effects
	JS9.globalOpts.skipSelectionProcessing = true;
	this.selectShapes(layerName, id, {saveselection: false});
	delete JS9.globalOpts.skipSelectionProcessing;
	this.updateShapes(layerName, id, "restore");
    }
    delete layer.savesel;
};

// Print support
// call using image context
JS9.Fabric.print = function(opts){
    let html, key, win, dataURL, divstr, pinst, layer;
    let winurl = "";
    let yoff = 0;
    let xoff = 0;
    const divtmpl = "<div style='position:absolute; left:%spx; top:%spx'>";
    const winopts = sprintf("width=%s,height=%s,menubar=1,toolbar=1,status=0,scrollbars=1,resizable=1", this.display.canvasjq.attr("width"), this.display.canvasjq.attr("height"));
    // opts is optional
    opts = opts || {};
    // opts can be an object or json
    if( typeof opts === "string" ){
	try{ opts = JSON.parse(opts); }
	catch(e){ JS9.error(`can't parse print opts: ${opts}`, e); }
    }
    // get the main image as a dataURL
    dataURL = this.display.canvas.toDataURL("image/png");
    // start the web page string
    html = "<html><body style='padding: 0px; margin: 0px' onload='window.print(); return false'>";
    // initial div to hold image
    divstr = sprintf(divtmpl, xoff, yoff);
    // add the image
    html += `${divstr}<img src='${dataURL}'></div>`;
    // add layers
    for( key of Object.keys(this.layers) ){
	layer = this.layers[key];
	// output (showing) layers attached to the main display
	if( layer.dlayer.dtype === "main" && layer.show ){
	    html += `${divstr}${layer.dlayer.canvas.toSVG()}</div>`;
	}
    }
    // add colorbar, if necessary
    if( (opts.colorbar === undefined) || opts.colorbar ){
	pinst = this.display.pluginInstances.JS9Colorbar;
	if( pinst && pinst.isActive() ){
	    // separate from main display
	    yoff += 2;
	    // colorbar canvas
	    dataURL = pinst.colorbarjq[0].toDataURL("image/png");
	    yoff += this.display.height;
	    divstr = sprintf(divtmpl, xoff, yoff);
	    html += `${divstr}<img src='${dataURL}'></div>`;
	    if( pinst.textjq && pinst.textjq[0] ){
		// colorbar text/tickmarks canvas
		dataURL = pinst.textjq[0].toDataURL("image/png");
		yoff += pinst.colorbarjq.height() + 1;
		divstr = sprintf(divtmpl, xoff, yoff);
		// need to rescale the text ... argh!!!
		html += `${divstr}<img style='width:${this.display.width}px;'src='${dataURL}'></div>`;
	    }
	}
    }
    // finish up
    html += "</body></html>";
    // make a new window containing a blank URL
    win = window.open(winurl, this.id, winopts);
    if( !win ){
	JS9.error("could not create print window (check your pop-up blockers)");
	return;
    }
    // open DOM for writing
    if( win.document ){
        // open it (not strictly necessary but ...)
	win.document.open();
        // overwrite the doc with our html
	win.document.write(html);
        // must close!
	win.document.close();
     } else {
	JS9.error("no method available for drawing image into print window");
    }
};

// incorporate these graphics routines into JS9
JS9.Fabric.initGraphics = function(){
    // display methods
    JS9.Display.prototype.newShapeLayer = JS9.Fabric.newShapeLayer;
    // image shape methods
    JS9.Image.prototype._selectShapes = JS9.Fabric._selectShapes;
    JS9.Image.prototype._updateShape = JS9.Fabric._updateShape;
    JS9.Image.prototype._parseShapes = JS9.Fabric._parseShapes;
    JS9.Image.prototype._parseShapeOptions = JS9.Fabric._parseShapeOptions;
    JS9.Image.prototype._exportShapeOptions = JS9.Fabric._exportShapeOptions;
    JS9.Image.prototype._handleChildText = JS9.Fabric._handleChildText;
    JS9.Image.prototype._addPolygonPoint = JS9.Fabric._addPolygonPoint;
    JS9.Image.prototype._removePolygonPoint = JS9.Fabric._removePolygonPoint;
    JS9.Image.prototype._ungroupAnnulus = JS9.Fabric._ungroupAnnulus;
    JS9.Image.prototype._regroupAnnulus = JS9.Fabric._regroupAnnulus;
    JS9.Image.prototype._updateMultiDialogs = JS9.Fabric._updateMultiDialogs;
    JS9.Image.prototype.addShapes = JS9.Fabric.addShapes;
    JS9.Image.prototype.updateShapes = JS9.Fabric.updateShapes;
    JS9.Image.prototype.getShapes = JS9.Fabric.getShapes;
    JS9.Image.prototype.changeShapes = JS9.Fabric.changeShapes;
    JS9.Image.prototype.removeShapes = JS9.Fabric.removeShapes;
    JS9.Image.prototype.refreshShapes = JS9.Fabric.refreshShapes;
    JS9.Image.prototype.copyShapes = JS9.Fabric.copyShapes;
    JS9.Image.prototype.selectShapes = JS9.Fabric.selectShapes;
    JS9.Image.prototype.unselectShapes = JS9.Fabric.unselectShapes;
    JS9.Image.prototype.groupShapes = JS9.Fabric.groupShapes;
    JS9.Image.prototype.ungroupShapes = JS9.Fabric.ungroupShapes;
    JS9.Image.prototype.listGroups = JS9.Fabric.listGroups;
    JS9.Image.prototype.lookupGroup = JS9.Fabric.lookupGroup;
    JS9.Image.prototype.saveSelection = JS9.Fabric.saveSelection;
    JS9.Image.prototype.restoreSelection = JS9.Fabric.restoreSelection;
    // shape layer methods
    JS9.Image.prototype.getShapeLayer = JS9.Fabric.getShapeLayer;
    JS9.Image.prototype.showShapeLayer = JS9.Fabric.showShapeLayer;
    JS9.Image.prototype.activeShapeLayer = JS9.Fabric.activeShapeLayer;
    JS9.Image.prototype.displayShapeLayers = JS9.Fabric.displayShapeLayers;
    JS9.Image.prototype.toggleShapeLayers = JS9.Fabric.toggleShapeLayers;
    // print method which know about shapes
    JS9.Image.prototype.print = JS9.Fabric.print;
};

// register Fabric as a pluggable shape engine and activate selected engine
if( JS9.ShapeEngine &&
    typeof JS9.ShapeEngine.register === "function" &&
    typeof JS9.ShapeEngine.use === "function"       ){
    JS9.ShapeEngine.register("fabric", {
	init: () => {
	    JS9.Fabric.initGraphics();
	}
    });
    if( !JS9.ShapeEngine.use(JS9.globalOpts.shapeEngine || "fabric") ){
	JS9.ShapeEngine.use("fabric");
    }
} else {
    // fallback for older runtimes missing the abstraction
    JS9.Fabric.initGraphics();
}
}

if( typeof globalThis !== "undefined" ){
    globalThis.JS9InstallFabricEngine = JS9InstallFabricEngine;
}
