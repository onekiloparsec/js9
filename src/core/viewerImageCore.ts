// @ts-nocheck
/* JS9 Image.prototype lifecycle methods (getImageData, closeImage, mkRawDataFromHDU, mkSection, etc.). */
import { sprintf } from './sprintf';
"use strict";

function JS9InstallImageCore(JS9) {

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

} // end JS9InstallImageCore

if (typeof globalThis !== "undefined") {
    globalThis.JS9InstallImageCore = JS9InstallImageCore;
}
