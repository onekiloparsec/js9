// @ts-nocheck
/* JS9 command initialization extracted from viewer.js. */

/*global document */

"use strict";

function JS9InstallCommands(JS9){
    // init console commands
    JS9.initCommands = function(){
        // sanity check
        if( !{}.hasOwnProperty.call(JS9, "Command") ){ return; }
        // load commands
        JS9.checkNew(new JS9.Command({
    	name: "analysis",
    	alias: "run",
    	help: "list/run analysis for current image",
    	get() {
    	    let i, j, n, t, tasks;
    	    let result = "";
    	    const im = this.image;
    	    if( im && im.analysisPackages ){
    		for(j=0; j<im.analysisPackages.length; j++){
    		    tasks = im.analysisPackages[j];
    		    for(i=0; i<tasks.length; i++){
    			t = tasks[i];
    			if( result ){
    			    result += ", ";
    			}
    			n = t.xclass ? (`${t.xclass}:${t.name}`) : t.name;
    			result += `${t.title} (${n})`;
    		    }
    		    if( j < (im.analysisPackages.length-1) ){
    			result += "\n";
    		    }
    		}
    	    }
    	    return result;
    	},
    	set(args) {
    	    let a, did;
    	    const im = this.image;
    	    if( !im ){
    		return;
    	    }
    	    a = im.lookupAnalysis(args[0]);
    	    if( a ){
		if( a.purl ){
		    did = im.displayAnalysis("params",
					     JS9.InstallDir(a.purl),
					     {title: `${a.title}: ${im.fitsFile}`});
		    // save info for running the task
                    let node = did;
                    if( typeof node === "string" ){
                        node = node[0] === "#" ? document.querySelector(node) :
                            document.getElementById(node);
                    }
                    if( node ){
                        node.dataset.dispid = im.display.id;
                        node.dataset.aname = a.name;
                    }
		} else {
    		    // else run task directly
    		    im.runAnalysis(a.name);
    		}
    	    } else {
    		JS9.error(`unknown analysis command '${args[0]}'`);
    	    }
    	}
        }));
        JS9.checkNew(new JS9.Command({
    	name: "colormap",
    	alias: "cmap",
    	help: "set/get colormap for current image",
    	get() {
    	    let res;
    	    const im = this.image;
    	    if( im ){
    		res = im.getColormap();
    		return `${res.colormap} ${res.contrast} ${res.bias}`;
    	    }
    	},
    	set(args) {
    	    const im = this.image;
    	    if( im ){
    		im.setColormap(...args);
    	    }
    	}
        }));
        JS9.checkNew(new JS9.Command({
    	name: "colormaps",
    	alias: "cmaps",
    	help: "get list of available colormaps",
    	get() {
    	    let i;
    	    let msg = "";
    	    for(i=0; i<JS9.colormaps.length; i++){
    		if( msg ){
    		    msg += ", ";
    		}
    		msg += JS9.colormaps[i].name;
    	    }
    	    return msg;
    	}
        }));
        JS9.checkNew(new JS9.Command({
    	name: "global",
    	help: "set/get a JS9.globalOpts parameter",
    	set(args) {
    	    let val, key;
    	    if( args.length == 1 ){
    		val = JS9.globalOpts[args[0]];
    		if( JS9.notNull(val) ){
                        switch( typeof val ){
    		    case "boolean":
    			return val ? "true" : "false";
    		    case "number":
    			return String(val);
    		    case "string":
    			return val;
    		    case "object":
    			return JSON.stringify(val);
    		    default:
    			return "";
                        }
    		}
    	    } else if( args.length >= 2 ){
    		key = args[0];
    		val = args[1];
    		if( typeof key === "string" && typeof val === "string" ){
    		    switch( typeof JS9.globalOpts[key] ){
    		    case "boolean":
    			JS9.globalOpts[key] = val.match(/true/i) ? true : false;
    			break;
    		    case "number":
    			JS9.globalOpts[key] = parseFloat(val);
    			break;
    		    case "string":
    			JS9.globalOpts[key] = val;
    			break;
    		    case "object":
    			try{
    			    val = JSON.parse(val);
    			}
    			catch(e){
    			    JS9.error(`invalid JSON for global cmd: ${val}`);
    			}
    			JS9.globalOpts[key] = val;
    			break;
    		    default:
    			break;
                        }
    		}
    	    }
    	}
        }));
        JS9.checkNew(new JS9.Command({
    	name: "grid",
    	help: "set/get coordinate grid for current image",
    	get() {
    	    let msg;
    	    const im = this.image;
    	    if( im ){
    		msg = im.displayCoordGrid();
    	    }
    	    return msg ? "true" : "false";
    	},
    	set(args) {
    	    let mode;
    	    const im = this.image;
    	    if( im ){
    		if( args[0].match(/true/i) ){
    		    mode = true;
    		} else {
    		    mode = false;
    		}
    		im.displayCoordGrid(mode, args[1]);
    	    }
    	}
        }));
        JS9.checkNew(new JS9.Command({
    	name: "help",
    	help: "get list of available commands",
    	get() {
    	    let i, cmd;
    	    let s1 = "Or execute JS9 public access routines (use spaceless args, please):";
    	    let s2 = "SetColormap heat";
    	    let s3 = "GetColormap";
    	    let s4 = '{"colormap":"heat","contrast":3.75,"bias":0.736328125}';
    	    let s5 = 'AddRegions circle(23:23:27.9,+58:48:42.8,3") {"color":"cyan"}';
    	    let msg = "<table class='JS9CmdHelp'>";
    	    for(i=0; i<JS9.commands.length; i++){
    		cmd = JS9.commands[i];
    		msg += `<tr><td>${cmd.name}</td><td>${cmd.help}`;
    		if( cmd.alias ){
    		    msg += ` (${cmd.alias}`;
    		    if( cmd.alias2 ){
    		      msg += `, ${cmd.alias2}`;
    		    }
    		    msg += ")";
    		}
    		msg += "</td></tr>";
    	    }
    	    msg += `<tr><td colspan="2">&nbsp;</td></tr>`;
    	    msg += `<tr><td colspan="2">${s1}</td></tr>`;
    	    msg += `<tr><td colspan="2">&nbsp;</td></tr>`;
    	    msg += `<tr><td colspan="2">${s2}</td></tr>`;
    	    msg += `<tr><td colspan="2">${s3}</td></tr>`;
    	    msg += `<tr><td colspan="2">${s4}</td></tr>`;
    	    msg += `<tr><td colspan="2">${s5}</td></tr>`;
    	    msg += "</table>";
    	    return msg;
    	}
        }));
        JS9.checkNew(new JS9.Command({
    	name: "helper",
    	help: "set/get helper connection",
    	get() {
    	    return JS9.helper.connectinfo();
    	},
    	set(args) {
    	    JS9.helper.connect(args[0].trim());
    	}
        }));
        JS9.checkNew(new JS9.Command({
    	name: "image",
    	help: "get name of current image or display specified image",
    	get() {
    	    const im = this.image;
    	    if( im ){
    		return im.file;
    	    }
    	},
    	set(args) {
    	    let i, im;
    	    for(i=0; i<JS9.images.length; i++){
    		im = JS9.images[i];
    		if( im.file.search(args[0]) >=0 ){
    		    if( im.display === this.display ){
    			im.displayImage("display");
    			return;
    		    }
    		}
    	    }
    	}
        }));
        JS9.checkNew(new JS9.Command({
    	name: "images",
    	help: "get list of currently loaded images",
    	get() {
    	    let i, im;
    	    let msg = "";
    	    for(i=0; i<JS9.images.length; i++){
    		im = JS9.images[i];
    		if( im.display === this.display ){
    		    if( msg ){
    			msg += ", ";
    		    }
    		    msg += im.file;
    		}
    	    }
    	    return msg;
    	}
        }));
        JS9.checkNew(new JS9.Command({
    	name: "load",
    	help: "load image(s)",
    	set(args) {
    	    let i, j, obj;
    	    const alen = args.length;
    	    for(i=0; i<alen; i++){
    		obj = null;
    		j = i + 1;
    		if( (j < alen) && args[j].startsWith("{") ){
    		    try{ obj = JSON.parse(args[j]); }
    		    catch(e){ obj = null; }
    		}
    		if( obj ){
    		    JS9.Load(args[i], obj, {display: this.display.id});
    		    i++;
    		} else {
    		    JS9.Load(args[i], {display: this.display.id});
    		}
    	    }
    	}
        }));
        JS9.checkNew(new JS9.Command({
    	name: "pan",
    	help: "set/get pan location for current image",
    	get() {
    	    let res;
    	    const im = this.image;
    	    if( im ){
    		res = im.getPan();
    		return `${res.x} ${res.x}`;
    	    }
    	},
    	set(args) {
    	    const im = this.image;
    	    if( im ){
    		im.setPan(...args);
    	    }
    	}
        }));
        JS9.checkNew(new JS9.Command({
    	name: "pix2wcs",
            help: "get image pixel value for specified wcs position",
    	set(args) {
    	    let res;
    	    const im = this.image;
    	    if( im ){
    		res = JS9.Pix2WCS(parseFloat(args[0]), parseFloat(args[1]),
    				 {display: im});
    		return res.str;
    	    }
    	}
        }));
        JS9.checkNew(new JS9.Command({
    	name: "print",
    	help: "print image window",
    	get() {
    	    const im = this.image;
    	    if( im ){
    		im.print();
    	    }
    	}
        }));
        JS9.checkNew(new JS9.Command({
    	name: "refresh",
    	help: "refresh image using specified file (def: use last file)",
    	set(args) {
    	    let i, j, obj;
    	    const alen = args.length;
    	    const im = this.image;
    	    // no args: refresh current image
    	    if( alen === 0 ){
    		obj = {refresh: im};
    		JS9.Load(im.file, obj, {display: this.display.id});
    		return;
    	    }
    	    for(i=0; i<alen; i++){
    		obj = null;
    		j = i + 1;
    		if( (j < alen) && args[j].startsWith("{") ){
    		    try{ obj = JSON.parse(args[j]); }
    		    catch(e){ obj = null; }
    		}
    		if( obj ){
    		    obj.refresh = true;
    		    JS9.Load(args[i], obj, {display: this.display.id});
    		    i++;
    		} else {
    		    obj = {refresh: true};
    		    JS9.Load(args[i], obj, {display: this.display.id});
    		}
    	    }
    	}
        }));
        JS9.checkNew(new JS9.Command({
    	name: "regcnts",
    	help: "counts in regions for current image",
    	get() {
    	    const im = this.image;
    	    if( im ){
    		im.countsInRegions("$sregions", "$bregions",
    				   {lightwin: true});
    	    }
    	},
    	set(args) {
    	    const im = this.image;
    	    if( im ){
    		return im.countsInRegions(...args);
    	    }
    	}
        }));
        JS9.checkNew(new JS9.Command({
    	name:   "regions",
    	alias:  "reg",
    	alias2: "region",
    	help: "add or list region(s)",
    	get() {
    	    const im = this.image;
    	    if( im ){
    		return im.listRegions("all", {mode: 0}) || "";
    	    }
    	},
    	set(args) {
    	    let s;
    	    const im = this.image;
    	    if( im ){
    		if( args[0] === "delete" || args[0] === "remove" ){
    		    s = args.slice(1).join(" ");
    		    im.removeShapes("regions", s);
    		} else {
    		    s = args.join(" ");
    		    im.addShapes("regions", s);
    		}
    	    }
    	}
        }));
        JS9.checkNew(new JS9.Command({
    	name: "resize",
    	help: "set/get display size for current image",
    	get() {
    	    let display;
    	    const im = this.image;
    	    if( im ){
    		display = im.display;
    		return `${display.width} ${display.height}`;
    	    }
    	},
    	set(args) {
    	    let display, width, height;
    	    const im = this.image;
    	    if( im && args.length ){
    		display = im.display;
    		width = parseInt(args[0], 10);
    		if( args.length > 1 ){
    		    height = parseInt(args[1], 10);
    		} else {
    		    height = width;
    		}
    		display.resize(width, height);
    	    }
    	}
        }));
        JS9.checkNew(new JS9.Command({
    	name: "scale",
    	help: "set/get scaling for current image",
    	get() {
    	    let res;
    	    const im = this.image;
    	    if( im ){
    		res = im.getScale();
    		return `${res.scale} ${res.scalemin} ${res.scalemax}`;
    	    }
    	},
    	set(args) {
    	    const im = this.image;
    	    if( im ){
    		im.setScale(...args);
    	    }
    	}
        }));
        JS9.checkNew(new JS9.Command({
    	name: "scales",
    	help: "get list of available scales",
    	get() {
    	    return JS9.scales.join(", ");
    	}
        }));
        JS9.checkNew(new JS9.Command({
    	name: "section",
    	help: "display section of current image",
    	set(args) {
    	    let s, obj;
    	    const alen = args.length;
    	    const im = this.image;
    	    if( alen === 1 && args[0] === "full" ){
    		im.displaySection("full");
    	    } else {
    		s = args.join(" ");
    		if( s ){
    		    try{ obj = JSON.parse(s); }
    		    catch(e){ JS9.error("invalid JSON section"); }
    		    im.displaySection(obj);
    		}
    	    }
    	}
        }));
        JS9.checkNew(new JS9.Command({
    	name: "status",
    	help: "get status for specified (or current) image",
    	get(args) {
    	    let i, first, tim, im, cmd;
    	    let result = "";
    	    for(i=0; i<JS9.images.length; i++){
    		tim = JS9.images[i];
    		if( tim.file.search(args[0]) >=0 ){
    		    im = tim;
    		    break;
    		}
    	    }
    	    if( im ){
    		first = 1;
    	    } else {
    		first = 0;
    		im = this.image;
    	    }
    	    if( im ){
    		// no args -> load
    		if( first > args.length ){
    		    return im.status.load;
    		}
    		// process specific status
    		for(i=first; i<args.length; i++){
    		    cmd = args[i].toLowerCase().trim();
    		    switch(cmd){
    		    case "load":
    			if( result ){
    			    result += "\n";
    			}
    			result += im.status.load;
    			break;
    		    default:
    			break;
    		    }
    		}
    	    }
    	    return result;
    	}
        }));
        JS9.checkNew(new JS9.Command({
    	name: "url",
    	help: "display a url",
    	set(args) {
    	    JS9.DisplayHelp(args[0]);
    	}
        }));
        JS9.checkNew(new JS9.Command({
    	name: "wcssys",
    	help: "set/get wcs system for current image",
    	get() {
    	    const im = this.image;
    	    if( im ){
    		return im.getWCSSys();
    	    }
    	},
    	set(args) {
    	    const im = this.image;
    	    if( im ){
    		im.setWCSSys(args[0]);
    	    }
    	}
        }));
        JS9.checkNew(new JS9.Command({
    	name: "wcsu",
    	help: "set/get wcs units used for current image",
    	get() {
    	    const im = this.image;
    	    if( im ){
    		return im.getWCSUnits();
    	    }
    	},
    	set(args) {
    	    const im = this.image;
    	    if( im ){
    		im.setWCSUnits(args[0]);
    	    }
    	}
        }));
        JS9.checkNew(new JS9.Command({
    	name: "wcssystems",
    	help: "get list of available wcs systems",
    	get() {
    	    return JS9.wcssyss.join(", ");
    	}
        }));
        JS9.checkNew(new JS9.Command({
    	name: "wcsunits",
    	help: "get list of available wcs units",
    	get() {
    	    return JS9.wcsunitss.join(", ");
    	}
        }));
        JS9.checkNew(new JS9.Command({
    	name: "wcs2pix",
            help: "get wcs position for specified image pixel",
    	set(args) {
    	    let res;
    	    const im = this.image;
    	    if( im ){
    		res = JS9.WCS2Pix(parseFloat(args[0]), parseFloat(args[1]),
    				 {display: im});
    		return res.str;
    	    }
    	}
        }));
        JS9.checkNew(new JS9.Command({
    	name: "zoom",
    	help: "set/get zoom for current image",
    	get() {
    	    const im = this.image;
    	    if( im ){
    		return im.getZoom();
    	    }
    	},
    	set(args) {
    	    const im = this.image;
    	    if( im ){
    		im.setZoom(args[0]);
    	    }
    	}
        }));
    };
}

if( typeof globalThis !== "undefined" ){
    globalThis.JS9InstallCommands = JS9InstallCommands;
}
