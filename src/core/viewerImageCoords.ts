// @ts-nocheck
/* JS9 Image.prototype coordinate conversion, WCS, and analysis methods. */
import { sprintf } from './sprintf';
import { saveAs } from './browserCompat';
"use strict";

function JS9InstallImageCoords(JS9) {

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
    if( typeof saveAs === "function" ){
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
    if( typeof saveAs === "function" ){
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

} // end JS9InstallImageCoords

if (typeof globalThis !== "undefined") {
    globalThis.JS9InstallImageCoords = JS9InstallImageCoords;
}
