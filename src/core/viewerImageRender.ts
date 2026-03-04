// @ts-nocheck
/* JS9 Image.prototype rendering pipeline, pan/zoom, and section display methods. */
import { sprintf } from './sprintf';
"use strict";

function JS9InstallImageRender(JS9) {

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

} // end JS9InstallImageRender

if (typeof globalThis !== "undefined") {
    globalThis.JS9InstallImageRender = JS9InstallImageRender;
}
