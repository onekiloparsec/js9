/* JS9 viewer event handlers extracted from viewer.js. */

"use strict";

function JS9InstallViewerEvents(JS9){
    // ---------------------------------------------------------------------
    // global event handlers
    // ---------------------------------------------------------------------
    
    // mousedown: assumes display obj is passed in evt.data
    JS9.mouseDownCB = function(evt){
        const display = evt.data;
        const im = display.image;
        const scroll = JS9.getDocumentScroll();
        const x = scroll.x, y = scroll.y;
        // sanity check
        if( !im ){ return; }
        // set focus, if necessary, but undo any scrolling
        if( JS9.globalOpts.clickToFocus ){
    	im.display.displayConjq.focus();
    	window.scrollTo(x, y);
        }
        // get element offset
        if( evt.target ){
            const scroll = JS9.getDocumentScroll();
            const rect = evt.target.getBoundingClientRect();
            im.posOffset = {left: rect.left + scroll.x, top: rect.top + scroll.y};
        }
        // get canvas position
        im.pos0 = JS9.eventToDisplayPos(evt, im.posOffset);
        // this also is the current canvas position
        im.pos = im.pos0;
        // get image position
        im.ipos0 = im.displayToImagePos(im.pos);
        // this also is the current image position
        im.ipos = im.ipos0;
        // in the resize area?
        display.resizing = display.inResize(im.pos);
        // normal (non-resizing) processing
        if( !display.resizing ){
    	evt.preventDefault();
    	// begin actions for mouse and touch events
    	if( {}.hasOwnProperty.call(JS9, "MouseTouch") ){
    	    JS9.MouseTouch.action(im, evt, "start");
    	}
    	// inside a region, clear region display and return;
    	if( im.clickInRegion && (im.clickInLayer === "regions") ){
    	    // clear the region layer
    	    im.display.clearMessage("regions");
    	    return;
    	}
    	// plugin callbacks
    	if( !JS9.specialKey(evt) ){
    	    im.xeqPlugins("mouse", "onmousedown", evt);
    	}
        }
        // set click state to current mouse button
        im.clickState = evt.which;
        switch(evt.which){
        case 1:
        case 2:
    	break;
        case 3:
    	// secondary mouse click
    	im.clickState = 2;
    	break;
        }
        // override click state with touch state, if possible
        if( evt.originalEvent &&
    	evt.originalEvent.touches && evt.originalEvent.touches.length ){
    	im.clickState = -evt.originalEvent.touches.length;
        }
        // add this display's callbacks on the whole document
        display.tmp = display.tmp || {};
        display.tmp.documentMouseMove = (e) => {
            e.data = display;
            return JS9.mouseMoveCB(e);
        };
        display.tmp.documentMouseUp = (e) => {
            e.data = display;
            return JS9.mouseUpCB(e);
        };
        document.addEventListener("mousemove", display.tmp.documentMouseMove);
        document.addEventListener("mouseup", display.tmp.documentMouseUp);
    };
    
    // mouseup: assumes display obj is passed in evt.data
    JS9.mouseUpCB = function(evt){
        let i, dwidth, dheight, tdisp, isclick;
        const display = evt.data;
        const im = display.image;
        // sanity check
        if( !im ){
    	// handle supermenu clicks specially (even if no image is loaded)
    	if( {}.hasOwnProperty.call(JS9, "Menubar") ){
    	    JS9.Menubar.onclick(evt.data);
    	}
    	return;
        }
        // get canvas position
        im.pos = JS9.eventToDisplayPos(evt, im.posOffset);
        // image position
        im.ipos = im.displayToImagePos(im.pos);
        isclick = 	((Math.abs(im.pos0.x-im.pos.x) < JS9.NOMOVE)  &&
    		 (Math.abs(im.pos0.y-im.pos.y) < JS9.NOMOVE));
        // prevent default unless we are close to the resize area
        if( !display.inResize(im.pos) ){
    	evt.preventDefault();
        }
        // end actions for mouse and touch events
        if( {}.hasOwnProperty.call(JS9, "MouseTouch") ){
    	JS9.MouseTouch.action(im, evt, "stop");
        }
        // in a region, update region string since we probably just modified it
        if( im.clickInRegion && im.clickInLayer ){
    	if( !isclick ){
    	    // tell plugins that this region has been updated (e.g. sync)
    	    im.updateShapes(im.clickInLayer, "selected", "update");
    	}
        }
        // plugin callbacks
        if( !JS9.specialKey(evt) ){
    	im.xeqPlugins("mouse", "onmouseup", evt);
    	if( isclick ){
    	    im.xeqPlugins("mouse", "onclick", evt);
    	    // handle supermenu clicks specially
    	    if( {}.hasOwnProperty.call(JS9, "Menubar") ){
    		JS9.Menubar.onclick(im.display);
    	    }
    	}
    	if( JS9.globalOpts.dynamicSelect === "click" ){
    	    if( JS9.Dysel.getDisplayOr(display) !== display ){
    		// mark this as the current display
    		JS9.Dysel.select(display);
    	    }
    	}
        } else {
    	// shift-click: pan to mouse position, if necessary
    	if( isclick && !im.clickInRegion && JS9.globalOpts.metaClickPan ){
    	    if( im.editAnnulus ){
    		im._regroupAnnulus("regions", evt);
    	    } else {
    		im.setPan(im.ipos.x,im.ipos.y);
    	    }
    	}
        }
        // safe to unset clickInRegion now
        im.clickInRegion = false;
        im.clickInLayer = null;
        im.clickState = 0;
        im.posOffset = null;
        // finish refresh, if necessary
        if( im.tmp.panzoomRefresh ){
    	im.refreshLayers(im.tmp.panzoomRefresh);
    	delete im.tmp.panzoomRefresh;
        }
        // finish resize, if necessary
        if( display.resizing ){
    	display.resizing = false;
    	if( JS9.bugs.webkit_resize ){
    	    dwidth = parseInt(display.divjq.css("width"), 10);
    	    dheight = parseInt(display.divjq.css("height"), 10);
    	    if( dwidth  < display.owidth ){
    		display.divjq.css("width", display.owidth + JS9.RESIZEFUDGE);
    	    }
    	    if( dheight < display.oheight ){
    		display.divjq.css("height", display.oheight + JS9.RESIZEFUDGE);
    	    }
    	}
    	// if we were not displaying the image while resizing, do it now
    	if( !JS9.globalOpts.resizeRedisplay ){
    	    im.displayImage("all");
    	    im.refreshLayers();
    	}
        }
        // remove this display's callbacks on the whole document
        if( display.tmp && display.tmp.documentMouseUp ){
            document.removeEventListener("mouseup", display.tmp.documentMouseUp);
            delete display.tmp.documentMouseUp;
        }
        if( display.tmp && display.tmp.documentMouseMove ){
            document.removeEventListener("mousemove", display.tmp.documentMouseMove);
            delete display.tmp.documentMouseMove;
        }
        // look for active mousedown from a different display and fire mouse up
        for(i=0; i<JS9.displays.length; i++){
    	tdisp = JS9.displays[i];
    	if( (tdisp !== display) && tdisp.image && tdisp.image.clickState ){
    	    tdisp.divjq.trigger("mouseup");
    	}
        }
    };
    
    // mousemove: assumes display obj is passed in evt.data
    JS9.mouseMoveCB = function(evt){
        let sel;
        const display = evt.data;
        const im = display.image;
        // evt.preventDefault();
        // sanity check
        if( !im ){ return; }
        // is mouse movement disabled with the meta key?
        if( JS9.specialKey(evt) ){
    	return;
        }
        // get canvas position
        im.pos = JS9.eventToDisplayPos(evt, im.posOffset);
        // get image position
        im.ipos = im.displayToImagePos(im.pos);
        // in case mouse down was not called
        if( !im.pos0 ){
    	im.pos0 = im.pos;
        }
        if( !im.ipos0 ){
    	im.ipos0 = im.ipos;
        }
        // don't do anything else if we are resizing
        if( display.resizing ){
    	return;
        }
        evt.preventDefault();
        // reset the valpos object
        im.valpos = null;
        // in a region, update the region info
        if( im.clickInRegion && (im.clickInLayer === "regions") ){
    	sel = im.display.layers.regions.params.sel;
    	if( sel && sel.params ){
    	    if( im.params.listonchange          ||
    		sel.params.listonchange         ||
    		JS9.globalOpts.intensivePlugins ){
    		im._updateShape("regions", sel, null, "move");
    	    }
    	    // list regions
    	    if( im.params.listonchange || sel.params.listonchange ){
    		im.listRegions("selected", {mode: 2});
    	    }
    	    // regions move callback
    	    if( JS9.globalOpts.intensivePlugins ){
    		im.xeqPlugins("region", "onregionsmove", sel.pub);
    	    }
    	}
        }
        // actions for mouse and touch events
        if( {}.hasOwnProperty.call(JS9, "MouseTouch") ){
    	JS9.MouseTouch.action(im, evt);
        }
        // actions for crosshair
        if( {}.hasOwnProperty.call(JS9, "Crosshair") ){
    	if( im.tmp.arrowCrosshairVisible && !im.params.crosshair ){
    	    JS9.Crosshair.hide(im, im.ipos, evt);
    	}
        }
        // update valpos, in case a plugin wants it, and we did not do it above
        if( !im.valpos ){
    	im.valpos = im.updateValpos(im.ipos, false);
        }
        // plugin callbacks
        if( !JS9.specialKey(evt) ){
    	im.xeqPlugins("mouse", "onmousemove", evt);
        }
    };
    
    // mouseenter: assumes display obj is passed in evt.data
    JS9.mouseEnterCB = function(evt){
        const display = evt.data;
        const im = display.image;
        evt.preventDefault();
        // sanity check
        if( !im ){ return; }
        if( !JS9.specialKey(evt) ){
    	if( JS9.globalOpts.dynamicSelect === "move" ){
    	    if( JS9.Dysel.getDisplayOr(display) !== display ){
    		// mark as the current display
    		JS9.Dysel.select(display);
    	    }
    	}
        }
    };
    
    // mouseover: assumes display obj is passed in evt.data
    JS9.mouseOverCB = function(evt){
        const display = evt.data;
        const im = display.image;
        const scroll = JS9.getDocumentScroll();
        const x = scroll.x, y = scroll.y;
        evt.preventDefault();
        // sanity check
        if( !im ){ return; }
        // set focus, if necessary, but undo any scrolling
        if( !JS9.globalOpts.clickToFocus ){
    	im.display.displayConjq.focus();
    	window.scrollTo(x, y);
        }
        // change cursor
        // document.body.style.cursor = "crosshair";
        // plugin callbacks
        if( !JS9.specialKey(evt) ){
    	// get canvas position
    	im.pos = JS9.eventToDisplayPos(evt);
    	// get image position
    	im.ipos = im.displayToImagePos(im.pos);
    	// plugin callbacks
    	if( !JS9.specialKey(evt) ){
    	    im.xeqPlugins("mouse", "onmouseover", evt);
    	}
        }
    };
    
    // mouseout: assumes display obj is passed in evt.data
    JS9.mouseOutCB = function(evt){
        const display = evt.data;
        const im = display.image;
        evt.preventDefault();
        // sanity check
        if( !im ){ return; }
        // unset focus
        if( !JS9.globalOpts.clickToFocus ){
    	im.display.displayConjq.blur();
        }
        // if processing (moving, resizing) a region, update it now
        // (in case the mouseup happens outside the display)
        if( im.clickInRegion && im.clickInLayer ){
    	im.updateShapes(im.clickInLayer, "selected", "mouseout");
        }
        // plugin callbacks
        if( !JS9.specialKey(evt) ){
    	// get canvas position
    	im.pos = JS9.eventToDisplayPos(evt);
    	// get image position
    	im.ipos = im.displayToImagePos(im.pos);
    	// plugin callbacks
    	if( !JS9.specialKey(evt) ){
    	    im.xeqPlugins("mouse", "onmouseout", evt);
    	}
        }
    };
    
    // scrollwheel: assumes display obj is passed in evt.data
    JS9.wheelCB = function(evt){
        const display = evt.data;
        const im = display.image;
        if( im && JS9.globalOpts.mousetouchZoom       &&
    	{}.hasOwnProperty.call(JS9, "MouseTouch") &&
    	JS9.MouseTouch.Actions["wheel zoom"]      ){
    	JS9.MouseTouch.Actions["wheel zoom"](im, evt);
    	// avoid page scroll if we are using the wheel for zooming
    	evt.preventDefault();
        }
    };
    
    // this does not seem to fire on a canvas ... so we use keydown instead
    // keypress: assumes display obj is passed in evt.data
    // in case you are wondering: you can't move the mouse via javascript!
    // http://stackoverflow.com/questions/4752501/move-the-mouse-pointer-to-a-specific-position
    JS9.keyPressCB = function(evt){
        const display = evt.data;
        const im = display.image;
        evt.preventDefault();
        // plugin callbacks
        if( im ){
    	im.xeqPlugins("keypress", "onkeypress", evt);
        }
    };
    
    // keydown: assumes display obj is passed in evt.data
    // in case you are wondering: you can't move the mouse via javascript!
    // http://stackoverflow.com/questions/4752501/move-the-mouse-pointer-to-a-specific-position
    JS9.keyDownCB = function(evt){
        let ipos;
        const display = evt.data;
        const im = display.image;
        evt.preventDefault();
        // actions for key press
        if( {}.hasOwnProperty.call(JS9, "Keyboard") ){
    	ipos = im ? im.ipos : {x: null, y: null};
    	JS9.Keyboard.action(im, ipos, evt);
        }
        if( im ){
    	// plugin callbacks
    	im.xeqPlugins("keydown", "onkeydown", evt);
        }
    };
    
    // keyup: assumes display obj is passed in evt.data
    JS9.keyUpCB = function(evt){
        const display = evt.data;
        const im = display.image;
        if( im ){
    	// plugin callbacks
    	im.xeqPlugins("keydown", "onkeyup", evt);
        }
    };
    
    // ---------------------------------------------------------------------
    // drag and drop event handlers
    // ---------------------------------------------------------------------
    
    JS9.dragenterCB = function(id, evt){
        evt.stopPropagation();
        evt.preventDefault();
    };
    
    JS9.dragoverCB = function(id, evt){
        evt.stopPropagation();
        evt.preventDefault();
    };
    
    JS9.dragexitCB = function(id, evt){
        evt.stopPropagation();
        evt.preventDefault();
    };
    
    JS9.dragdropCB = function(id, evt){
        let i, s, opts, files, display;
        // convert jquery event to original event, if possible
        if( evt.originalEvent ){
    	evt = evt.originalEvent;
        }
        evt.stopPropagation();
        evt.preventDefault();
        opts = JS9.extend(true, {}, JS9.fits.options);
        opts.display = opts.display || id;
        opts.extlist = opts.extlist || JS9.globalOpts.extlist;
        files = evt.target.files || evt.dataTransfer.files;
        display = JS9.lookupDisplay(opts.display);
        // first check if it's not a file
        if( !files.length ){
    	// assume text
    	s = evt.dataTransfer.getData("text");
    	// check whether its a URL and load via proxy, if possible
    	if( s.match(JS9.URLEXP) ){
    	    if( JS9.proxyAvailable() ){
    		JS9.LoadProxy(s, {display: opts.display});
    	    } else if( JS9.globalOpts.cgiProxy ){
    		JS9.Load(s, {proxy: true}, {display: opts.display});
    	    }
    	}
    	return;
        }
        // got files: wait for spinner to start ...
        window.setTimeout(() => {
    	let file, fname;
    	// ... and load each file in turn
    	for(i=0; i<files.length; i++){
    	    file = files[i];
    	    fname =  file.path || file.name || "";
    	    if( fname.match(/\.reg$/) ){
    		JS9.LoadRegions(file, {display: opts.display});
    	    } else if( fname.match(/\.cat$/) ){
    		JS9.LoadCatalog(null, file, {display: opts.display});
    	    } else if( fname.match(/\.ses$/) ){
    		JS9.LoadSession(file, {display: opts.display});
    	    } else if( fname.match(/\.js9ses$/) ){
    		JS9.LoadSession(file, {display: opts.display});
    	    } else if( fname.match(/\.cmap$/) ){
    		JS9.LoadColormap(file);
    	    } else {
    		JS9.waiting(true, display);
    		opts.refresh = JS9.globalOpts.refreshDragDrop;
    		opts.localAccess = true;
    		JS9.Load(file, opts, {display: opts.display});
    	    }
    	}
        }, JS9.SPINOUT);
    };
    
    // ---------------------------------------------------------------------
    // special event handlers
    // ---------------------------------------------------------------------
    
}

if( typeof globalThis !== "undefined" ){
    globalThis.JS9InstallViewerEvents = JS9InstallViewerEvents;
}
