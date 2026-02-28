/* JS9 viewer utilities extracted from viewer.js. */

/*global sprintf, tinycolor, CanvasRenderingContext2D */

"use strict";

function JS9InstallViewerUtils(JS9){
    const resolveViewerElement = (value) => {
        if( !value ){
            return null;
        }
        if( value.nodeType ){
            return value;
        }
        if( JS9.isWrappedCollection(value) || Array.isArray(value) ){
            return value[0] || null;
        }
        if( typeof value.get === "function" ){
            return value.get(0) || null;
        }
        if( value[0] && value[0].nodeType ){
            return value[0];
        }
        return null;
    };
    const setDisplayState = (el, display) => {
        if( el ){
            el.style.display = display;
        }
    };
    const toggleButtonState = (button, enabled) => {
        if( !button ){
            return;
        }
        button.classList.toggle("JS9SearchButton-true", !!enabled);
        button.classList.toggle("JS9SearchButton-false", !enabled);
    };
    const runMarkAction = (text, action, value, opts) => {
        const textel = resolveViewerElement(text);
        const done = opts && opts.done;
        const args = [];
        if( value !== undefined ){
            args.push(value);
        }
        if( opts !== undefined ){
            args.push(opts);
        }
        if( text && typeof text[action] === "function" ){
            return text[action](...args);
        }
        if( textel && typeof textel[action] === "function" ){
            return textel[action](...args);
        }
        if( textel || text ){
            const wrapped = JS9.wrapCollection(textel || text);
            if( wrapped && typeof wrapped[action] === "function" ){
                return wrapped[action](...args);
            }
        }
        if( typeof done === "function" ){
            done();
        }
        return undefined;
    };
    const setTooltipHtml = (target, html) => {
        const el = resolveViewerElement(target);
        if( el ){
            el.innerHTML = html;
        }
        return el;
    };
    const getTooltipSize = (target) => {
        const el = resolveViewerElement(target);
        if( !el ){
            return {width: 0, height: 0};
        }
        const rect = typeof el.getBoundingClientRect === "function" ?
            el.getBoundingClientRect() :
            {width: el.offsetWidth || 0, height: el.offsetHeight || 0};
        return {
            width: rect.width || el.offsetWidth || 0,
            height: rect.height || el.offsetHeight || 0
        };
    };
    const setTooltipStyles = (target, styles) => {
        const el = resolveViewerElement(target);
        if( !el ){
            return null;
        }
        Object.keys(styles).forEach((key) => {
            const value = styles[key];
            el.style[key] = typeof value === "number" && key !== "zIndex" ?
                `${value}px` :
                String(value);
        });
        return el;
    };

    // was last parsed string in units of hours/min/sec (using specified wcssys)?
    JS9.isHMS = function(wcssys, dtype){
        dtype = dtype || String.fromCharCode(JS9.saodtype());
        return (dtype === ":" || dtype === "h") &&
    	    wcssys !== "galactic"           &&
    	    wcssys !== "ecliptic";
    };
    
    // is this a HEALPix image?
    JS9.ishealpix = function(im){
        return im                                                      &&
    	im.imtab === "table"                                       &&
    	im.raw && im.raw.header                                    &&
    	im.raw.header.CTYPE1 &&	im.raw.header.CTYPE1.match(/--HPX/i);
    };
    
    // is the proxy server available for LoadProxy() call?
    JS9.proxyAvailable = function(){
        return JS9.globalOpts.loadProxy          &&
            !JS9.allinone                        &&
            JS9.globalOpts.helperType !== "none" &&
            JS9.globalOpts.workDir;
    }
    
    // parse a FITS card and return name and value
    JS9.cardpars = function(card){
        let value;
        let name = card.slice(0, 8).trim();
        if( name === "HISTORY" ){ return [name, card.slice(9).trim()]; }
        if( name === "COMMENT" ){ return [name, card.slice(9).trim()]; }
        if( card[8] !== "=" ){ return undefined; }
        value = card.slice(10).replace(/'/g, " ").replace(/ \/.*/, "").trim();
        if( value === "T" ){
    	value = true;
        } else if( value === "F" ){
    	value = false;
        } else if( JS9.isNumber(value) ){
    	value = parseFloat(value);
        }
        return [name, value];
    };
    
    // convert obj to FITS-style string
    JS9.raw2FITS = function(raw, opts){
        let i, s, obj, key, val, card, ncard, header, left;
        let hasend = false;
        let t = "";
        const gots = {};
        const rexp = /^(NAXIS|CRPIX|CRVAL|CTYPE|CUNIT|CDELT)[34567]/;
        const fixparam = (card, name, val, comm) => {
    	let s, oval, regexp;
    	let ncard = card;
    	if( name === "XTENSION" && !val ){
    	    ncard = sprintf("%s  = %20s / %-47s",
    			    "SIMPLE",
    			    "T",
    			    "file does conform to FITS standard");
    
    	} else {
    	    // eslint-disable-next-line no-useless-escape
    	    regexp = new RegExp(`${name} *= *(-?[-+]?[0-9]*\.?[0-9]*([eE][-+]?[0-9]+)?) *`);
    	    if( card ){
    		s = card.replace(regexp, "$1");
    		oval = parseFloat(s);
    	    } else {
    		oval = undefined;
    	    }
    	    if( oval !== val ){
    		ncard = sprintf("%-8s= %20s / %-47s", name, val, comm||"");
    	    }
    	}
    	gots[name] = true;
    	return ncard;
        };
        // sanity check
        if( !raw ){ return t; }
        // opts is optional
        opts = opts || {};
        // backward compatibility: orig. version used boolean to specify addcr
        if( typeof opts === "boolean" ){
    	opts = {addcr: opts};
        }
        // raw.card and raw.cardstr contain comments: use them if possible
        if( raw.card || raw.cardstr ){
    	header = raw.header || {};
    	if( raw.card ){
    	    ncard = raw.card.length;
    	} else {
    	    ncard = raw.ncard;
    	}
    	for(i=0; i<ncard; i++){
    	    if( raw.card ){
    		card = raw.card[i].slice(0, 80);
    	    } else {
    		card = raw.cardstr.slice(i*80, (i+1)*80);
    	    }
    	    if( opts.notab && card.match(/^TAB(TYP|MIN|MAX|DIM)[1,2]/) ){
    		continue;
    	    }
    	    // change values which get set in mkRawDataFromHDU()
    	    if( card.match(/^XTENSION/) && i === 0 && opts.simple ){
    		t += fixparam(card, "XTENSION");
    	    } else if( card.match(/^BITPIX /) && raw.bitpix ){
    		t += fixparam(card, "BITPIX", raw.bitpix, "bits/pixel");
    	    } else if( card.match(/^NAXIS1 /) && raw.width ){
    		t += fixparam(card, "NAXIS1", raw.width, "x image dim");
    	    } else if( card.match(/^NAXIS2 /) && raw.height ){
    		t += fixparam(card, "NAXIS2", raw.height, "y image dim");
    	    } else if( card.match(/^CRPIX1 /) && JS9.notNull(header.CRPIX1) ){
    		t += fixparam(card, "CRPIX1", header.CRPIX1, "ref point");
    	    } else if( card.match(/^CRPIX2 /) && JS9.notNull(header.CRPIX2) ){
    		t += fixparam(card, "CRPIX2", header.CRPIX2, "ref point");
    	    } else if( card.match(/^CDELT1 /) && JS9.notNull(header.CDELT1) ){
    		t += fixparam(card, "CDELT1", header.CDELT1, "deg/pixel");
    	    } else if( card.match(/^CDELT2 /) && JS9.notNull(header.CDELT2) ){
    		t += fixparam(card, "CDELT2", header.CDELT2, "deg/pixel");
    	    } else if( card.match(/^CD1_1 /) && JS9.notNull(header.CD1_1) ){
    		t += fixparam(card, "CD1_1", header.CD1_1, "WCS matrix value");
    	    } else if( card.match(/^CD1_2 /) && JS9.notNull(header.CD1_2) ){
    		t += fixparam(card, "CD1_2", header.CD1_2, "WCS matrix value");
    	    } else if( card.match(/^CD2_1 /) && JS9.notNull(header.CD2_1) ){
    		t += fixparam(card, "CD2_1", header.CD2_1, "WCS matrix value");
    	    } else if( card.match(/^CD2_2 /) && JS9.notNull(header.CD2_2) ){
    		t += fixparam(card, "CD2_2", header.CD2_2, "WCS matrix value");
    	    } else if( card.match(/^LTV1 /) && JS9.notNull(header.LTV1) ){
    		t += fixparam(card, "LTV1", header.LTV1, "IRAF ref. point");
    	    } else if( card.match(/^LTV2 /) && JS9.notNull(header.LTV2) ){
    		t += fixparam(card, "LTV2", header.LTV2, "IRAF ref. point");
    	    } else if( card.match(/^LTM1_1 /) && JS9.notNull(header.LTM1_1) ){
    		t += fixparam(card, "LTM1_1", header.LTM1_1, "IRAF matrix value");
    	    } else if( card.match(/^LTM1_2 /) && JS9.notNull(header.LTM1_2) ){
    		t += fixparam(card, "LTM1_2", header.LTM1_2, "IRAF matrix value");
    	    } else if( card.match(/^LTM2_1 /) && JS9.notNull(header.LTM2_1) ){
    		t += fixparam(card, "LTM2_1", header.LTM2_1, "IRAF matrix value");
    	    } else if( card.match(/^LTM2_2 /) && JS9.notNull(header.LTM2_2) ){
    		t += fixparam(card, "LTM2_2", header.LTM2_2, "IRAF matrix value");
    	    } else if( opts.twoaxes && card.match(/^NAXIS /) ){
    		t += fixparam(card, "NAXIS", 2, "number of data axes");
    	    } else if( opts.twoaxes && card.match(/^(NAXIS|CRPIX|CRVAL|CTYPE|CUNIT|CDELT)[34567]/) ){
    		continue;
    	    } else if( opts.twoaxes && card.match(/^(DATASUM|CHECKSUM)/) ){
    		continue;
    	    } else if( card.substring(0,4) === "END " ){
    		// try to add LTM/LTV if they were not present originally
    		if( JS9.notNull(header.LTV1) && !gots.LTV1 ){
    		    t += fixparam(null, "LTV1", header.LTV1, "IRAF ref. point");
    		    if( opts.addcr ){ t += "\n"; }
    		}
    		if( JS9.notNull(header.LTV2) && !gots.LTV2 ){
    		    t += fixparam(null, "LTV2", header.LTV2, "IRAF ref. point");
    		    if( opts.addcr ){ t += "\n"; }
    		}
    		if( JS9.notNull(header.LTM1_1) && !gots.LTM1_1 ){
    		    t += fixparam(null, "LTM1_1", header.LTM1_1, "IRAF matrix value");
    		    if( opts.addcr ){ t += "\n"; }
    		}
    		if( JS9.notNull(header.LTM1_2) && !gots.LTM1_2 ){
    		    t += fixparam(null, "LTM1_2", header.LTM1_2, "IRAF matrix value");
    		    if( opts.addcr ){ t += "\n"; }
    		}
    		if( JS9.notNull(header.LTM2_1) && !gots.LTM2_1 ){
    		    t += fixparam(null, "LTM2_1", header.LTM2_1, "IRAF matrix value");
    		    if( opts.addcr ){ t += "\n"; }
    		}
    		if( JS9.notNull(header.LTM2_2) && !gots.LTM2_2 ){
    		    t += fixparam(null, "LTM2_2", header.LTM2_2, "IRAF matrix value");
    		    if( opts.addcr ){ t += "\n"; }
    		}
    		// add the end card
    		t += card;
    		// mark we did so
    		hasend = true;
    	    } else {
    		t += card;
    	    }
    	    if( opts.addcr ){
    		t += "\n";
    	    }
    	}
        } else if( raw.header || raw.BITPIX ){
    	if( raw.header ){
    	    // minimal header without comments
    	    obj = raw.header;
    	} else {
    	    // directly specified object containing header without comments
    	    obj = raw;
    	}
    	// cfitsio requires simple and bitpix to be first and second params
    	if( obj.SIMPLE !== undefined || obj.simple !== undefined ){
    	    if( obj.SIMPLE !== undefined ){
    		val = obj.SIMPLE;
    	    } else {
    		val = obj.simple;
    	    }
    	    if( val === true ){
    		val = "T";
    	    } else if( val === false ){
    		val = "F";
    	    }
    	    t += sprintf("%-8s= %20s / %-47s", "SIMPLE", val, "conforms to FITS standard");
    	    if( opts.addcr ){ t += "\n"; }
    	}
    	if( obj.BITPIX !== undefined || obj.bitpix !== undefined ){
    	    if( obj.BITPIX !== undefined ){
    		val = obj.BITPIX;
    	    } else {
    		val = obj.bitpix;
    	    }
    	    t += sprintf("%-8s= %20s / %-47s", "BITPIX", val, "bits/pixel");
    	    if( opts.addcr ){ t += "\n"; }
    	}
    	for( key of Object.keys(obj) ){
    	    if( key === "js9Protocol" || key === "js9Endian" ){
    		continue;
    	    }
    	    if( key === "SIMPLE" || key === "simple" ){
    		continue;
    	    }
    	    if( key === "BITPIX" || key === "bitpix" ){
    		continue;
    	    }
    	    if( key === "END" ){
    		hasend = true;
    	    }
    	    if( opts.twoaxes && key === "NAXIS" ){
    		obj[key] = 2;
    	    }
    	    if( opts.twoaxes && key.match(rexp) ){
    		continue;
    	    }
    	    if( key.match(/HISTORY__[0-9]+/) ){
    		t += sprintf("HISTORY %-72s", obj[key]);
    	    } else if( key.match(/COMMENT__[0-9]+/) ){
    		t += sprintf("COMMENT %-72s", obj[key]);
    	    } else {
    		val = obj[key];
    		if( val === true ){
    		    val = "T";
    		} else if( val === false ){
    		    val = "F";
    		} else if( val === "" ){
    		    val = "' '";
    		} else if( Number.isNaN(val) ){
    		    val = "NaN";
    		} else if( !JS9.isNumber(val) && val.charAt(0) !== "'" ){
    		    val = `'${val}'`;
    		}
    		s = sprintf("%-8s= %20s", key, val);
    		left = 80 - s.length;
    		if( left > 0 ){
    		    for(i=0; i<left; i++){
    			s += " ";
    		    }
    		}
    		t += s;
    	    }
    	    if( opts.addcr ){
    		t += "\n";
    	    }
    	}
        }
        // add end card, if necessary
        if( !hasend ){
    	t += sprintf("%-8s%-72s", "END", " ");
    	if( opts.addcr ){
    	    t += "\n";
    	}
        }
        return t;
    };
    
    // convert an array of hdu objects into a nice string
    JS9.hdus2Str = function(hdus){
        let i, j, s, obj;
        let t = "";
        // sanity check
        if( !hdus ){ return t; }
        for(i=0; i<hdus.length; i++){
    	obj = hdus[i];
    	if( obj.name ){
    	    s = obj.name;
    	} else if( i === 0 ){
    	    s = "Primary";
    	} else {
    	    s = "N/A";
    	}
    	t += sprintf("<b>#%d</b>:&#09;<b>name</b>: %s&#09;<b>type</b>: %s",
    		     obj.hdu, s, obj.type);
    	switch(obj.type){
    	case "image":
    	    t += sprintf("&#09;<b>bitpix</b>: %d&#09;<b>naxis</b>: %d", obj.bitpix, obj.naxis);
    	    if( obj.naxes.length ){
    		t += "&#09;<b>axes</b>: [";
    		for(j=0; j<obj.naxes.length; j++){
    		    t += sprintf("%d", obj.naxes[j]);
    		    if( j !== obj.naxes.length-1 ){
    			t += ", ";
    		    }
    		}
    		t += "]";
    	    }
    	    break;
    	case "table":
    	case "ascii":
    	    s = "&#09;";
    	    if( obj.rows <= 9 ){
    		s += "&#09;";
    	    }
    	    t += sprintf("&#09;<b>rows</b>: %d%s<b>cols</b>: [", obj.rows, s);
    	    for(j=0; j<obj.cols.length; j++){
    		t += `${obj.cols[j].name}`;
    		if( JS9.notNull(obj.cols[j].min) &&
    		    JS9.notNull(obj.cols[j].max) ){
    		    t += `:${obj.cols[j].min}:${obj.cols[j].max}`;
    		}
    		if( j !== obj.cols.length-1 ){
    		    t += ", ";
    		}
    	    }
    	    t += "]";
    	    break;
    	}
    	t += "\n\n";
        }
        return t;
    };
    
    // clear canvas
    // http://stackoverflow.com/questions/2142535/how-to-clear-the-canvas-for-redrawing
    CanvasRenderingContext2D.prototype.clear =
      CanvasRenderingContext2D.prototype.clear || function (preserveTransform){
        if (preserveTransform){
          this.save();
          this.setTransform(1, 0, 0, 1, 0, 0);
        }
        this.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (preserveTransform){
          this.restore();
        }
    };
    
    // create a searchbar on a div using: https://markjs.io/
    // routine adapted from: https://jsfiddle.net/julmot/973gdh8g/
    JS9.searchbar = function(el, textid){
        let div, text, bar;
        let srch, next, prev, close;
        let matchcase, matchdiacritics, matchwords, matchwildcards;
        const root = resolveViewerElement(el);
        const currentClass = "current";
        const offsetTop = 50;
        const getMarks = () => Array.from(text.querySelectorAll("mark"));
        const search = (value) => {
    	let searchVal = value;
    	runMarkAction(text, "unmark", undefined, {
    	    done: () => {
    		runMarkAction(text, "mark", searchVal, {
    		    caseSensitive: bar.opts.matchcase,
    		    diacritics: bar.opts.diacritics,
    		    accuracy: bar.opts.matchwords ? "exactly" : "partially",
    		    wildcards: bar.opts.matchwildcards ? "enabled" : "disabled",
    		    done: () => {
    			bar.results = getMarks();
    			bar.currentIndex = 0;
    			jumpTo();
    		    }
    		});
    	    }
    	});
        };
        const btnColor = (which) => {
    	const s = which.dataset.btn;
    	toggleButtonState(which, bar.opts[s]);
        };
        const jumpTo = () => {
    	let cur, pos;
    	if( bar.results.length ){
    	    cur = bar.results[bar.currentIndex];
    	    bar.results.forEach((mark) => {
    		mark.classList.remove(currentClass);
    	    });
    	    if( cur ){
    		pos = cur.getBoundingClientRect().top -
    		    div.getBoundingClientRect().top;
    		cur.classList.add(currentClass);
    		if( pos < 0 || pos > div.clientHeight ){
    		    div.scrollTop = pos + div.scrollTop - offsetTop;
    		}
    	    }
    	}
        };
        textid = textid || ".JS9AnalysisText";
        if( !root ){
    	return;
        }
        // make sure we have text
        if( root.matches && root.matches(textid) ){
    	text = root;
        } else {
    	text = root.querySelector(textid);
    	if( !text ){
    	    return;
    	}
        }
        // light window or div?
        div = root.querySelector(JS9.lightOpts[JS9.LIGHTWIN].drag);
        if( !div ){
    	// just a div
    	div = root;
        }
        // does the searchbar already exist?
        bar = div.querySelector(".JS9Searchbar");
        if( bar ){
    	// make it visiable and return
    	setDisplayState(bar, "block");
    	return;
        }
        // make a new searchbar
        bar = document.createElement("div");
        bar.className = "JS9Searchbar";
        div.appendChild(bar);
        // add options
        bar.opts = {
    	matchcase: false,
    	matchdiacritics: false,
    	matchwords: false,
    	matchwildcards: false,
        };
        bar.results = [];
        bar.currentIndex = 0;
        // search text box
        srch = document.createElement("input");
        srch.type = "search";
        srch.className = "JS9SearchInput";
        bar.appendChild(srch);
        // event fires with each keystroke
        srch.addEventListener("input", () => {
    	search(srch.value);
        });
        // placeholder hints
        if( bar.opts.matchwildcards ){
    	srch.placeholder = "sea*rch template?";
        } else {
    	srch.placeholder = "search term(s)";
        }
        // find next occurence
        next = document.createElement("button");
        next.className = "JS9SearchButton";
        next.dataset.btn = "next";
        next.innerHTML = "&darr;";
        bar.appendChild(next);
        // find previous occurence
        prev = document.createElement("button");
        prev.className = "JS9SearchButton";
        prev.dataset.btn = "prev";
        prev.innerHTML = "&uarr;";
        bar.appendChild(prev);
        // event callback for next and prev
        [next, prev].forEach((button) => {
    	button.addEventListener("click", (e) => {
    	if( bar.results && bar.results.length) {
    	    bar.currentIndex += e.currentTarget === prev ? -1 : 1;
    	    if( bar.currentIndex < 0 ){
    		bar.currentIndex = bar.results.length - 1;
    	    }
    	    if( bar.currentIndex > bar.results.length - 1 ){
    		bar.currentIndex = 0;
    	    }
    	    jumpTo();
    	}
    	});
        });
        matchcase = document.createElement("button");
        matchcase.className =
    	`JS9SearchButton JS9SearchButton-${bar.opts.matchcase}`;
        matchcase.dataset.btn = "matchcase";
        matchcase.innerHTML = "Match Case";
        bar.appendChild(matchcase);
        matchcase.addEventListener("click", () => {
    	bar.opts.matchcase = !bar.opts.matchcase;
    	btnColor(matchcase);
    	search(srch.value);
        });
        btnColor(matchcase);
        matchdiacritics = document.createElement("button");
        matchdiacritics.className =
    	`JS9SearchButton JS9SearchButton-${bar.opts.matchdiacritics}`;
        matchdiacritics.dataset.btn = "matchdiacritics";
        matchdiacritics.innerHTML = "Match Diacritics";
        bar.appendChild(matchdiacritics);
        matchdiacritics.addEventListener("click", () => {
    	bar.opts.matchdiacritics = !bar.opts.matchdiacritics;
    	btnColor(matchdiacritics);
    	search(srch.value);
        });
        btnColor(matchdiacritics);
        matchwords = document.createElement("button");
        matchwords.className =
    	`JS9SearchButton JS9SearchButton-${bar.opts.matchwords}`;
        matchwords.dataset.btn = "matchwords";
        matchwords.innerHTML = "Whole Words";
        bar.appendChild(matchwords);
        matchwords.addEventListener("click", () => {
    	bar.opts.matchwords = !bar.opts.matchwords;
    	btnColor(matchwords);
    	search(srch.value);
        });
        btnColor(matchwords);
        matchwildcards = document.createElement("button");
        matchwildcards.className =
    	`JS9SearchButton JS9SearchButton-${bar.opts.matchwildcards}`;
        matchwildcards.dataset.btn = "matchwildcards";
        matchwildcards.innerHTML = "Wildcards";
        bar.appendChild(matchwildcards);
        matchwildcards.addEventListener("click", () => {
    	bar.opts.matchwildcards = !bar.opts.matchwildcards;
    	if( bar.opts.matchwildcards ){
    	    srch.placeholder = "sea*rch template?";
    	} else {
    	    srch.placeholder = "search term(s)";
    	}
    	btnColor(matchwildcards);
    	search(srch.value);
        });
        btnColor(matchwildcards);
        // close the searchbar
        close = document.createElement("button");
        close.className = "JS9SearchButton";
        close.dataset.btn = "close";
        close.innerHTML = "Close";
        bar.appendChild(close);
        close.addEventListener("click", () => {
    	runMarkAction(text, "unmark");
    	srch.value = "";
    	setDisplayState(bar, "none");
        });
        // no outline on focus
        div.style.outline = "none";
        // set tabindex so we can sense keyboard events
        div.setAttribute("tabindex", "0");
        // meta-k will bring up the searchbar
        div.addEventListener("keydown", (evt) => {
    	const code = evt.which || evt.keyCode;
    	const c = String.fromCharCode(code);
    	if( JS9.specialKey(evt) && c === "F" ){
    	    if( window.getComputedStyle(bar).display === "none" ){
    		setDisplayState(bar, "block");
    		srch.focus();
    	    } else {
    		runMarkAction(text, "unmark");
    		srch.value = "";
    		setDisplayState(bar, "none");
    	    }
    	}
        });
    };
    
    // create a tooltip, with the tip formatted from a string containing
    // variables in the current context, e.g. "$im.id\n$xreg.imstr\n$xreg.data.tag"
    JS9.tooltip = function(x, y, fmt, im, xreg, evt){
        let tipstr, tx, ty, w, h;
        const fmt2str = (str) => {
    	// eslint-disable-next-line no-unused-vars
    	const cmd = str.replace(/\$([a-zA-Z0-9_./]+)/g, (m, t, o) => {
                let i, v, val;
    	    const arr = t.split(".");
    	    switch(arr[0]){
    	    case "im":
    		val = im;
    		break;
    	    case "xreg":
    		val = xreg;
    		break;
    	    case "evt":
    		val = evt;
    		break;
    	    case "data":
    		val = xreg.data;
    		break;
    	    default:
    		return m;
    	    }
    	    for(i=1; i<arr.length; i++){
    		v = val[arr[i]];
    		if( JS9.isNumber(v) ){
    		    val = v.toFixed(6);
    		} else {
    		    val = v;
    		}
    	    }
    	    if( val === undefined ){
    		val = "";
    	    }
    	    return val;
    	});
    	return cmd;
        };
        if( fmt ){
    	tipstr = fmt2str(fmt);
    	setTooltipHtml(im.display.tooltip, tipstr);
    	// get size of div ...
    	({width: w, height: h} = getTooltipSize(im.display.tooltip));
    	// ... so we can place the tooltip properly
    	tx = Math.max(2, Math.min(x, im.display.width - (w + 10)));
    	ty = Math.max(2, Math.min(y, im.display.height - (h + 10)));
    	setTooltipStyles(im.display.tooltip, {
    	    left: tx,
    	    top: ty,
    	    display: "inline-block"
    	});
        } else {
    	setTooltipHtml(im.display.tooltip, "");
    	setTooltipStyles(im.display.tooltip, {left: -9999, display: "none"});
        }
    };
    
    // http://stackoverflow.com/questions/359788/how-to-execute-a-javascript-function-when-i-have-its-name-as-a-string
    // our modification will execute a real func or a funcName
    // for argument parsing:
    // https://stackoverflow.com/questions/13952870/regular-expression-to-get-parameter-list-from-function-definition
    JS9.xeqByName = function(...args){
        let i, namespaces, func, targs;
        let [funcName, context] = args;
        let xargs = args.slice(2);
        let type = typeof funcName;
        switch( type ){
        case "function":
    	return funcName.apply(context, xargs);
        case "string":
    	// see if args are attached, i.e. ...func(arg1,arg2,...)
    	targs = /\(\s*([^)]+?)\s*\)/.exec(funcName);
    	if( targs && targs[1] ){
    	    funcName = funcName.slice(0,targs.index);
    	    xargs = targs[1].split(/\s*,\s*/);
    	}
    	namespaces = funcName.split(".");
    	func = namespaces.pop();
    	for(i = 0; i < namespaces.length; i++){
                context = context[namespaces[i]];
    	}
    	// see if a JS9 public function was implicitly specified
    	if( typeof context[func] === "undefined" ){
    	    if( typeof JS9.publics[func] === "function" ){
    		context = JS9.publics;
    	    }
    	}
    	return context[func](...xargs);
        default:
    	JS9.error(`unknown func type: ${type}`);
    	break;
        }
    };
    
    // return value of a variable passed as a string (based on above)
    JS9.varByName = function(funcName, context){
        let i, namespaces, vname;
        context = context || JS9;
        namespaces = funcName.split(".");
        vname = namespaces.pop();
        for(i=0; i<namespaces.length; i++){
    	context = context[namespaces[i]];
    	if( !context ){
    	    return null;
    	}
        }
        return context[vname];
    };
    
    // merge preferences into global JS9 object
    JS9.mergePrefs = function(obj){
        let otype, jtype, name;
        let domerge = false;
        // merge preferences with js9 objects and data
        obj = obj || {};
        for( name of Object.keys(obj) ){
    	// handle config specially
    	if( name === "config" ){
    	    if( obj[name].objects === "merge" ){
    		domerge = true;
    	    }
    	} else {
    	    if( {}.hasOwnProperty.call(JS9, name) ){
    		jtype = typeof JS9[name];
    		otype = typeof obj[name];
    		if( (jtype === otype) || (otype === "string") ){
    		    switch(jtype){
    		    case "object":
    			if( JS9.isArray(obj[name]) ){
    			    // arrays get replaced completely
    			    JS9[name] = obj[name];
    			} else {
    			    // objects get replaced or recursively extended
    			    if( domerge ){
    				JS9.extend(true, JS9[name], obj[name]);
    			    } else {
    				JS9.extend(JS9[name], obj[name]);
    			    }
    			}
    			break;
    		    case "number":
    		    case "string":
    			JS9[name] = obj[name];
    			break;
    		    default:
    			break;
    		    }
    		}
    	    }
    	}
        }
    };
    
    // load a prefs file and merge preferences into global JS9 object
    JS9.loadPrefs = function(url, doerr){
        // load site/user preferences synchronously
        JS9.ajax({
    	url: url,
    	cache: false,
    	dataType: "json",
    	mimeType: "application/json",
    	async: false,
    	success: (obj) => {
    	    JS9.mergePrefs(obj);
    	},
    	// eslint-disable-next-line no-unused-vars
    	error: (jqXHR, textStatus, errorThrown) => {
    	    if( doerr ){
    		JS9.log("JS9 prefs file not available: %s", url);
    	    }
    	}
        });
    };
    
    // is this object a typed array?
    JS9.isTypedArray = function(obj){
        let type;
        const types = {
            "[object Int8Array]": true,
            "[object Uint8Array]": true,
            "[object Uint8ClampedArray]": true,
            "[object Int16Array]": true,
            "[object Uint16Array]": true,
            "[object Int32Array]": true,
            "[object Uint32Array]": true,
            "[object Float32Array]": true,
            "[object Float64Array]": true
        };
        type = Object.prototype.toString.call(obj);
        return {}.hasOwnProperty.call(types, type);
    };
    
    // starbase table support
    // tab-delimited ascii tables, # in first line is a comment
    JS9.Starbase = function(s, opts){
        let i, j, skips, dashes, data, cobj;
        let line = 0;
        const checkDashline = (dash) => {
    	let i;
    	for(i=0; i<dash.length; i++){
    	    if( dash[i].match(/^-+$/) === null ){
    		return 0;
    	    }
    	}
    	return i;
        };
        const I = (x) => { return x; };
        // init returned object
        this.head = {};
        this.convFuncs = [];
        this.data = [];
        this.delims = [];
        // sanity check
        if( !s ){ return; }
        // opts is optional
        opts = opts || {};
        // get array of data lines
        data = s.replace(/\s+$/,"").split("\n");
        // skip comments
        if( opts.skip ){
    	skips = opts.skip.split("");
    	if( skips && skips.length ){
    	    for(; line < data.length; line++){
    		if( (skips[0] !== data[line][0])             &&
    		    (skips[1] !== "\n" || data[line] !== "") ){
    		    break;
    		}
    	    }
    	}
        }
        // make sure we have a header to process
        if(  (data[line] === undefined) || (data[line+1] === undefined)  ){
    	return;
        }
        // look for header and dashes, in various guises
        this.headline = data[line++].trim().split(/ *\t */);
        if( opts.units ){
    	this.unitline = data[line++].trim().split(/ *\t */);
        }
        this.dashline = data[line++].trim().split(/ *\t */);
        dashes = checkDashline(this.dashline);
        // read lines until the dashline is found
        while ( dashes === 0 || dashes !== this.headline.length ){
    	if( !opts.units ){
    	    this.headline = this.dashline;
    	} else {
    	    this.headline = this.unitline;
    	    this.unitline = this.dashline;
    	}
    	this.dashline = data[line++].trim().split(/ *\t */);
    	dashes = checkDashline(this.dashline);
        }
        // process header:
        // replace "." with "_" in header names
        // create a vector of type converter funcs
        for(i=0; i<this.headline.length; i++ ){
    	this.headline[i] = this.headline[i].replace(/\./g, "_");
    	if( opts.convFuncs && opts.convFuncs[this.headline[i]] ){
    	    this.convFuncs[i] = opts.convFuncs[this.headline[i]];
    	} else {
    	    if( opts.convFuncs && opts.convFuncs.def ){
    		this.convFuncs[i] = opts.convFuncs.def;
    	    } else {
    		this.convFuncs[i] = I;
    	    }
    	}
        }
        // read each line of the data in and convert to type
        for(j = 0; line < data.length; line++, j++){
    	// skip means end of data
    	if( skips && skips.length ){
    	    if( (skips[0] === data[line][0])             ||
    		(skips[1] === "\n" && data[line] === "") ){
    		break;
    	    }
    	}
    	this.data[j] = data[line].split("\t");
    	for(i=0; i<this.data[j].length; i++){
    	    cobj = this.convFuncs[i](this.data[j][i]);
    	    this.data[j][i] = cobj.val;
    	    this.delims[i] = cobj.delim || null;
    	}
        }
        // convenience indexes
        for(i = 0; i < this.headline.length; i++){
    	this[this.headline[i]] = i;
        }
    };
    
    // http://stackoverflow.com/questions/1573053/javascript-function-to-convert-color-names-to-hex-codes
    // NB: colors are augmented by /opt/X11//share/X11/rgb.txt
    JS9.colorToHex = function(color){
        let arr;
        const colors = {
    "aliceblue":"#f0f8ff","antiquewhite":"#faebd7","aqua":"#00ffff","aquamarine":"#7fffd4","azure":"#f0ffff","beige":"#f5f5dc","bisque":"#ffe4c4","black":"#000000","blanchedalmond":"#ffebcd","blue":"#0000ff","blueviolet":"#8a2be2","brown":"#a52a2a","burlywood":"#deb887","cadetblue":"#5f9ea0","chartreuse":"#7fff00","chocolate":"#d2691e","coral":"#ff7f50","cornflowerblue":"#6495ed","cornsilk":"#fff8dc","crimson":"#dc143c","cyan":"#00ffff","darkblue":"#00008b","darkcyan":"#008b8b","darkgoldenrod":"#b8860b","darkgray":"#a9a9a9","darkgreen":"#006400","darkkhaki":"#bdb76b","darkmagenta":"#8b008b","darkolivegreen":"#556b2f","darkorange":"#ff8c00","darkorchid":"#9932cc","darkred":"#8b0000","darksalmon":"#e9967a","darkseagreen":"#8fbc8f","darkslateblue":"#483d8b","darkslategray":"#2f4f4f","darkturquoise":"#00ced1","darkviolet":"#9400d3","deeppink":"#ff1493","deepskyblue":"#00bfff","dimgray":"#696969","dodgerblue":"#1e90ff","firebrick":"#b22222","floralwhite":"#fffaf0","forestgreen":"#228b22","fuchsia":"#ff00ff","gainsboro":"#dcdcdc","ghostwhite":"#f8f8ff","gold":"#ffd700","goldenrod":"#daa520","gray":"#808080","green":"#008000","greenyellow":"#adff2f","honeydew":"#f0fff0","hotpink":"#ff69b4","indianred ":"#cd5c5c","indigo":"#4b0082","ivory":"#fffff0","khaki":"#f0e68c","lavender":"#e6e6fa","lavenderblush":"#fff0f5","lawngreen":"#7cfc00","lemonchiffon":"#fffacd","lightblue":"#add8e6","lightcoral":"#f08080","lightcyan":"#e0ffff","lightgoldenrodyellow":"#fafad2","lightgrey":"#d3d3d3","lightgreen":"#90ee90","lightpink":"#ffb6c1","lightsalmon":"#ffa07a","lightseagreen":"#20b2aa","lightskyblue":"#87cefa","lightslategray":"#778899","lightsteelblue":"#b0c4de","lightyellow":"#ffffe0","lime":"#00ff00","limegreen":"#32cd32","linen":"#faf0e6","magenta":"#ff00ff","maroon":"#800000","mediumaquamarine":"#66cdaa","mediumblue":"#0000cd","mediumorchid":"#ba55d3","mediumpurple":"#9370d8","mediumseagreen":"#3cb371","mediumslateblue":"#7b68ee","mediumspringgreen":"#00fa9a","mediumturquoise":"#48d1cc","mediumvioletred":"#c71585","midnightblue":"#191970","mintcream":"#f5fffa","mistyrose":"#ffe4e1","moccasin":"#ffe4b5","navajowhite":"#ffdead","navy":"#000080","oldlace":"#fdf5e6","olive":"#808000","olivedrab":"#6b8e23","orange":"#ffa500","orangered":"#ff4500","orchid":"#da70d6","palegoldenrod":"#eee8aa","palegreen":"#98fb98","paleturquoise":"#afeeee","palevioletred":"#d87093","papayawhip":"#ffefd5","peachpuff":"#ffdab9","peru":"#cd853f","pink":"#ffc0cb","plum":"#dda0dd","powderblue":"#b0e0e6","purple":"#800080","rebeccapurple":"#663399","red":"#ff0000","rosybrown":"#bc8f8f","royalblue":"#4169e1","saddlebrown":"#8b4513","salmon":"#fa8072","sandybrown":"#f4a460","seagreen":"#2e8b57","seashell":"#fff5ee","sienna":"#a0522d","silver":"#c0c0c0","skyblue":"#87ceeb","slateblue":"#6a5acd","slategray":"#708090","snow":"#fffafa","springgreen":"#00ff7f","steelblue":"#4682b4","tan":"#d2b48c","teal":"#008080","thistle":"#d8bfd8","tomato":"#ff6347","turquoise":"#40e0d0","violet":"#ee82ee","wheat":"#f5deb3","white":"#ffffff","whitesmoke":"#f5f5f5","yellow":"#ffff00","yellowgreen":"#9acd3","antiquewhite1":"#ffefdb","antiquewhite2":"#eedfcc","antiquewhite3":"#cdc0b0","antiquewhite4":"#8b8378","cadetblue1":"#98f5ff","cadetblue2":"#8ee5ee","cadetblue3":"#7ac5cd","cadetblue4":"#53868b","darkgoldenrod1":"#ffb90f","darkgoldenrod2":"#eead0e","darkgoldenrod3":"#cd950c","darkgoldenrod4":"#8b6508","darkgrey":"#a9a9a9","darkolivegreen1":"#caff70","darkolivegreen2":"#bcee68","darkolivegreen3":"#a2cd5a","darkolivegreen4":"#6e8b3d","darkorange1":"#ff7f00","darkorange2":"#ee7600","darkorange3":"#cd6600","darkorange4":"#8b4500","darkorchid1":"#bf3eff","darkorchid2":"#b23aee","darkorchid3":"#9a32cd","darkorchid4":"#68228b","darkseagreen1":"#c1ffc1","darkseagreen2":"#b4eeb4","darkseagreen3":"#9bcd9b","darkseagreen4":"#698b69","darkslategray1":"#97ffff","darkslategray2":"#8deeee","darkslategray3":"#79cdcd","darkslategray4":"#528b8b","darkslategrey":"#2f4f4f","deeppink1":"#ff1493","deeppink2":"#ee1289","deeppink3":"#cd1076","deeppink4":"#8b0a50","deepskyblue1":"#00bfff","deepskyblue2":"#00b2ee","deepskyblue3":"#009acd","deepskyblue4":"#00688b","dimgrey":"#696969","dodgerblue1":"#1e90ff","dodgerblue2":"#1c86ee","dodgerblue3":"#1874cd","dodgerblue4":"#104e8b","hotpink1":"#ff6eb4","hotpink2":"#ee6aa7","hotpink3":"#cd6090","hotpink4":"#8b3a62","indianred":"#cd5c5c","indianred1":"#ff6a6a","indianred2":"#ee6363","indianred3":"#cd5555","indianred4":"#8b3a3a","lavenderblush1":"#fff0f5","lavenderblush2":"#eee0e5","lavenderblush3":"#cdc1c5","lavenderblush4":"#8b8386","lemonchiffon1":"#fffacd","lemonchiffon2":"#eee9bf","lemonchiffon3":"#cdc9a5","lemonchiffon4":"#8b8970","lightblue1":"#bfefff","lightblue2":"#b2dfee","lightblue3":"#9ac0cd","lightblue4":"#68838b","lightcyan1":"#e0ffff","lightcyan2":"#d1eeee","lightcyan3":"#b4cdcd","lightcyan4":"#7a8b8b","lightgoldenrod":"#eedd82","lightgoldenrod1":"#ffec8b","lightgoldenrod2":"#eedc82","lightgoldenrod3":"#cdbe70","lightgoldenrod4":"#8b814c","lightgray":"#d3d3d3","lightpink1":"#ffaeb9","lightpink2":"#eea2ad","lightpink3":"#cd8c95","lightpink4":"#8b5f65","lightsalmon1":"#ffa07a","lightsalmon2":"#ee9572","lightsalmon3":"#cd8162","lightsalmon4":"#8b5742","lightskyblue1":"#b0e2ff","lightskyblue2":"#a4d3ee","lightskyblue3":"#8db6cd","lightskyblue4":"#607b8b","lightslateblue":"#8470ff","lightslategrey":"#778899","lightsteelblue1":"#cae1ff","lightsteelblue2":"#bcd2ee","lightsteelblue3":"#a2b5cd","lightsteelblue4":"#6e7b8b","lightyellow1":"#ffffe0","lightyellow2":"#eeeed1","lightyellow3":"#cdcdb4","lightyellow4":"#8b8b7a","mediumorchid1":"#e066ff","mediumorchid2":"#d15fee","mediumorchid3":"#b452cd","mediumorchid4":"#7a378b","mediumpurple1":"#ab82ff","mediumpurple2":"#9f79ee","mediumpurple3":"#8968cd","mediumpurple4":"#5d478b","mistyrose1":"#ffe4e1","mistyrose2":"#eed5d2","mistyrose3":"#cdb7b5","mistyrose4":"#8b7d7b","navajowhite1":"#ffdead","navajowhite2":"#eecfa1","navajowhite3":"#cdb38b","navajowhite4":"#8b795e","navyblue":"#000080","olivedrab1":"#c0ff3e","olivedrab2":"#b3ee3a","olivedrab3":"#9acd32","olivedrab4":"#698b22","orangered1":"#ff4500","orangered2":"#ee4000","orangered3":"#cd3700","orangered4":"#8b2500","palegreen1":"#9aff9a","palegreen2":"#90ee90","palegreen3":"#7ccd7c","palegreen4":"#548b54","paleturquoise1":"#bbffff","paleturquoise2":"#aeeeee","paleturquoise3":"#96cdcd","paleturquoise4":"#668b8b","palevioletred1":"#ff82ab","palevioletred2":"#ee799f","palevioletred3":"#cd6889","palevioletred4":"#8b475d","peachpuff1":"#ffdab9","peachpuff2":"#eecbad","peachpuff3":"#cdaf95","peachpuff4":"#8b7765","rosybrown1":"#ffc1c1","rosybrown2":"#eeb4b4","rosybrown3":"#cd9b9b","rosybrown4":"#8b6969","royalblue1":"#4876ff","royalblue2":"#436eee","royalblue3":"#3a5fcd","royalblue4":"#27408b","seagreen1":"#54ff9f","seagreen2":"#4eee94","seagreen3":"#43cd80","seagreen4":"#2e8b57","skyblue1":"#87ceff","skyblue2":"#7ec0ee","skyblue3":"#6ca6cd","skyblue4":"#4a708b","slateblue1":"#836fff","slateblue2":"#7a67ee","slateblue3":"#6959cd","slateblue4":"#473c8b","slategray1":"#c6e2ff","slategray2":"#b9d3ee","slategray3":"#9fb6cd","slategray4":"#6c7b8b","slategrey":"#708090","springgreen1":"#00ff7f","springgreen2":"#00ee76","springgreen3":"#00cd66","springgreen4":"#008b45","steelblue1":"#63b8ff","steelblue2":"#5cacee","steelblue3":"#4f94cd","steelblue4":"#36648b","violetred":"#d02090","violetred1":"#ff3e96","violetred2":"#ee3a8c","violetred3":"#cd3278","violetred4":"#8b2252","webgray":"#808080","webgreen":"#008000","webgrey":"#808080","webmaroon":"#800000","webpurple":"#800080","x11gray":"#bebebe","x11green":"#00ff00","x11grey":"#bebebe","x11maroon":"#b03060","x11purple":"#a020f0","aquamarine1":"#7fffd4","aquamarine2":"#76eec6","aquamarine3":"#66cdaa","aquamarine4":"#458b74","azure1":"#f0ffff","azure2":"#e0eeee","azure3":"#c1cdcd","azure4":"#838b8b","bisque1":"#ffe4c4","bisque2":"#eed5b7","bisque3":"#cdb79e","bisque4":"#8b7d6b","blue1":"#0000ff","blue2":"#0000ee","blue3":"#0000cd","blue4":"#00008b","brown1":"#ff4040","brown2":"#ee3b3b","brown3":"#cd3333","brown4":"#8b2323","burlywood1":"#ffd39b","burlywood2":"#eec591","burlywood3":"#cdaa7d","burlywood4":"#8b7355","chartreuse1":"#7fff00","chartreuse2":"#76ee00","chartreuse3":"#66cd00","chartreuse4":"#458b00","chocolate1":"#ff7f24","chocolate2":"#ee7621","chocolate3":"#cd661d","chocolate4":"#8b4513","coral1":"#ff7256","coral2":"#ee6a50","coral3":"#cd5b45","coral4":"#8b3e2f","cornsilk1":"#fff8dc","cornsilk2":"#eee8cd","cornsilk3":"#cdc8b1","cornsilk4":"#8b8878","cyan1":"#00ffff","cyan2":"#00eeee","cyan3":"#00cdcd","cyan4":"#008b8b","firebrick1":"#ff3030","firebrick2":"#ee2c2c","firebrick3":"#cd2626","firebrick4":"#8b1a1a","gold1":"#ffd700","gold2":"#eec900","gold3":"#cdad00","gold4":"#8b7500","goldenrod1":"#ffc125","goldenrod2":"#eeb422","goldenrod3":"#cd9b1d","goldenrod4":"#8b6914","gray0":"#000000","gray1":"#030303","gray10":"#1a1a1a","gray100":"#ffffff","gray11":"#1c1c1c","gray12":"#1f1f1f","gray13":"#212121","gray14":"#242424","gray15":"#262626","gray16":"#292929","gray17":"#2b2b2b","gray18":"#2e2e2e","gray19":"#303030","gray2":"#050505","gray20":"#333333","gray21":"#363636","gray22":"#383838","gray23":"#3b3b3b","gray24":"#3d3d3d","gray25":"#404040","gray26":"#424242","gray27":"#454545","gray28":"#474747","gray29":"#4a4a4a","gray3":"#080808","gray30":"#4d4d4d","gray31":"#4f4f4f","gray32":"#525252","gray33":"#545454","gray34":"#575757","gray35":"#595959","gray36":"#5c5c5c","gray37":"#5e5e5e","gray38":"#616161","gray39":"#636363","gray4":"#0a0a0a","gray40":"#666666","gray41":"#696969","gray42":"#6b6b6b","gray43":"#6e6e6e","gray44":"#707070","gray45":"#737373","gray46":"#757575","gray47":"#787878","gray48":"#7a7a7a","gray49":"#7d7d7d","gray5":"#0d0d0d","gray50":"#7f7f7f","gray51":"#828282","gray52":"#858585","gray53":"#878787","gray54":"#8a8a8a","gray55":"#8c8c8c","gray56":"#8f8f8f","gray57":"#919191","gray58":"#949494","gray59":"#969696","gray6":"#0f0f0f","gray60":"#999999","gray61":"#9c9c9c","gray62":"#9e9e9e","gray63":"#a1a1a1","gray64":"#a3a3a3","gray65":"#a6a6a6","gray66":"#a8a8a8","gray67":"#ababab","gray68":"#adadad","gray69":"#b0b0b0","gray7":"#121212","gray70":"#b3b3b3","gray71":"#b5b5b5","gray72":"#b8b8b8","gray73":"#bababa","gray74":"#bdbdbd","gray75":"#bfbfbf","gray76":"#c2c2c2","gray77":"#c4c4c4","gray78":"#c7c7c7","gray79":"#c9c9c9","gray8":"#141414","gray80":"#cccccc","gray81":"#cfcfcf","gray82":"#d1d1d1","gray83":"#d4d4d4","gray84":"#d6d6d6","gray85":"#d9d9d9","gray86":"#dbdbdb","gray87":"#dedede","gray88":"#e0e0e0","gray89":"#e3e3e3","gray9":"#171717","gray90":"#e5e5e5","gray91":"#e8e8e8","gray92":"#ebebeb","gray93":"#ededed","gray94":"#f0f0f0","gray95":"#f2f2f2","gray96":"#f5f5f5","gray97":"#f7f7f7","gray98":"#fafafa","gray99":"#fcfcfc","green1":"#00ff00","green2":"#00ee00","green3":"#00cd00","green4":"#008b00","grey":"#bebebe","grey0":"#000000","grey1":"#030303","grey10":"#1a1a1a","grey100":"#ffffff","grey11":"#1c1c1c","grey12":"#1f1f1f","grey13":"#212121","grey14":"#242424","grey15":"#262626","grey16":"#292929","grey17":"#2b2b2b","grey18":"#2e2e2e","grey19":"#303030","grey2":"#050505","grey20":"#333333","grey21":"#363636","grey22":"#383838","grey23":"#3b3b3b","grey24":"#3d3d3d","grey25":"#404040","grey26":"#424242","grey27":"#454545","grey28":"#474747","grey29":"#4a4a4a","grey3":"#080808","grey30":"#4d4d4d","grey31":"#4f4f4f","grey32":"#525252","grey33":"#545454","grey34":"#575757","grey35":"#595959","grey36":"#5c5c5c","grey37":"#5e5e5e","grey38":"#616161","grey39":"#636363","grey4":"#0a0a0a","grey40":"#666666","grey41":"#696969","grey42":"#6b6b6b","grey43":"#6e6e6e","grey44":"#707070","grey45":"#737373","grey46":"#757575","grey47":"#787878","grey48":"#7a7a7a","grey49":"#7d7d7d","grey5":"#0d0d0d","grey50":"#7f7f7f","grey51":"#828282","grey52":"#858585","grey53":"#878787","grey54":"#8a8a8a","grey55":"#8c8c8c","grey56":"#8f8f8f","grey57":"#919191","grey58":"#949494","grey59":"#969696","grey6":"#0f0f0f","grey60":"#999999","grey61":"#9c9c9c","grey62":"#9e9e9e","grey63":"#a1a1a1","grey64":"#a3a3a3","grey65":"#a6a6a6","grey66":"#a8a8a8","grey67":"#ababab","grey68":"#adadad","grey69":"#b0b0b0","grey7":"#121212","grey70":"#b3b3b3","grey71":"#b5b5b5","grey72":"#b8b8b8","grey73":"#bababa","grey74":"#bdbdbd","grey75":"#bfbfbf","grey76":"#c2c2c2","grey77":"#c4c4c4","grey78":"#c7c7c7","grey79":"#c9c9c9","grey8":"#141414","grey80":"#cccccc","grey81":"#cfcfcf","grey82":"#d1d1d1","grey83":"#d4d4d4","grey84":"#d6d6d6","grey85":"#d9d9d9","grey86":"#dbdbdb","grey87":"#dedede","grey88":"#e0e0e0","grey89":"#e3e3e3","grey9":"#171717","grey90":"#e5e5e5","grey91":"#e8e8e8","grey92":"#ebebeb","grey93":"#ededed","grey94":"#f0f0f0","grey95":"#f2f2f2","grey96":"#f5f5f5","grey97":"#f7f7f7","grey98":"#fafafa","grey99":"#fcfcfc","honeydew1":"#f0fff0","honeydew2":"#e0eee0","honeydew3":"#c1cdc1","honeydew4":"#838b83","ivory1":"#fffff0","ivory2":"#eeeee0","ivory3":"#cdcdc1","ivory4":"#8b8b83","khaki1":"#fff68f","khaki2":"#eee685","khaki3":"#cdc673","khaki4":"#8b864e","magenta1":"#ff00ff","magenta2":"#ee00ee","magenta3":"#cd00cd","magenta4":"#8b008b","maroon1":"#ff34b3","maroon2":"#ee30a7","maroon3":"#cd2990","maroon4":"#8b1c62","orange1":"#ffa500","orange2":"#ee9a00","orange3":"#cd8500","orange4":"#8b5a00","orchid1":"#ff83fa","orchid2":"#ee7ae9","orchid3":"#cd69c9","orchid4":"#8b4789","pink1":"#ffb5c5","pink2":"#eea9b8","pink3":"#cd919e","pink4":"#8b636c","plum1":"#ffbbff","plum2":"#eeaeee","plum3":"#cd96cd","plum4":"#8b668b","purple1":"#9b30ff","purple2":"#912cee","purple3":"#7d26cd","purple4":"#551a8b","red1":"#ff0000","red2":"#ee0000","red3":"#cd0000","red4":"#8b0000","salmon1":"#ff8c69","salmon2":"#ee8262","salmon3":"#cd7054","salmon4":"#8b4c39","seashell1":"#fff5ee","seashell2":"#eee5de","seashell3":"#cdc5bf","seashell4":"#8b8682","sienna1":"#ff8247","sienna2":"#ee7942","sienna3":"#cd6839","sienna4":"#8b4726","snow1":"#fffafa","snow2":"#eee9e9","snow3":"#cdc9c9","snow4":"#8b8989","tan1":"#ffa54f","tan2":"#ee9a49","tan3":"#cd853f","tan4":"#8b5a2b","thistle1":"#ffe1ff","thistle2":"#eed2ee","thistle3":"#cdb5cd","thistle4":"#8b7b8b","tomato1":"#ff6347","tomato2":"#ee5c42","tomato3":"#cd4f39","tomato4":"#8b3626","turquoise1":"#00f5ff","turquoise2":"#00e5ee","turquoise3":"#00c5cd","turquoise4":"#00868b","wheat1":"#ffe7ba","wheat2":"#eed8ae","wheat3":"#cdba96","wheat4":"#8b7e66","yellow1":"#ffff00","yellow2":"#eeee00","yellow3":"#cdcd00","yellow4":"#8b8b00"
        };
        let c;
        if( !color ){
    	return "";
        }
        c = color.toLowerCase();
        if( typeof colors[c] !== "undefined" ){
            return colors[c];
        }
        arr = color.match(/rgb\((\d+)[,\s]+(\d+)[,\s]+(\d+)\)/i);
        if( arr ){
    	return sprintf("#%02x%02x%02x", arr[1], arr[2], arr[3]);
        }
        return color;
    };
    
    // parse array of static colors
    JS9.parseStaticColors = function(arr){
        let i, sobj, t, a;
        let staticColors = [];
        // can be json
        if( typeof arr === "string" ){
    	try{ arr = JSON.parse(arr); }
    	catch(e){ /* empty */ }
        }
        // sanity check
        if( !JS9.isArray(arr) ){
    	JS9.error("invalid input for static colors");
        }
        // for each array object
        for(i=0; i<arr.length; i++){
    	if( typeof arr[i] === "string" ){
    	    // format: "color:min:max"
    	    a = arr[i].split(":");
    	} else {
    	    // format: ["color" or [r:,g:,b:,a:], min, max]
    	    a = arr[i];
    	}
    	// canonical array
    	if( JS9.isArray(a) ){
    	    // sanity check for color name
    	    if( !a[0] ){ JS9.error(`no color specified: ${arr[i]}`); }
    	    // color name can be any valid tiny color format
    	    try{ t = tinycolor(a[0]); }
    	    catch(e){ JS9.error(`invalid color: ${a[0]}`); }
    	    // process min:max variations
    	    if( JS9.isNull(a[1]) ){
    		a[1] = 1;
    		a[2] = Infinity;
    	    } else if( a[1] === "" ){
    		a[1] = -Infinity;
    	    } else {
    		a[1] = parseFloat(a[1]);
    	    }
    	    if( JS9.isNull(a[2]) ){
    		a[2] = a[1];
    	    } else 	if( a[2] === "" ){
    		a[2] = Infinity;
    	    } else {
    		a[2] = parseFloat(a[2]);
    	    }
    	    // save this color object
    	    sobj = {active: true,
    		    red: t._r, green: t._g, blue: t._b, alpha: t._a * 255,
    		    min: a[1], max: a[2]};
    	    if( typeof a[0] === "string" ){
    		sobj.name = a[0];
    	    }
    	} else if( typeof a === "object" ){
    	    // raw object (e.g. saved static colormap)
    	    sobj = a;
    	}
    	staticColors.push(sobj);
        }
        // optimize lookup: sort so that first min is global min
        staticColors.sort((a, b) => { return a.min - b.min; });
        // return array of color objects
        return staticColors;
    };
    
    // look up a static color
    JS9.lookupStaticColor = (im, val, cache) => {
        let i, color;
        let nocolor = {red:0,green:0,blue:0,alpha:0};
        const maxcache = 10000000;
        const search = (array, val) => {
    	let middle, obj;
    	let start = 0;
    	let end = array.length - 1;
    	while( start <= end ){
                middle = Math.floor((start + end) / 2);
    	    obj = array[middle];
                if( val >= obj.min && val <= obj.max ) {
    		// found the interval
    		return middle;
                } else if( obj.max < val ){
    		// continue searching to the right
    		start = middle + 1;
                } else {
    		// continue searching to the left
    		end = middle - 1;
                }
    	}
    	// interval wasn't found
    	return -1;
        };
        if( im && im.staticObj ){
    	nocolor = im.params.nocolor || nocolor;
    	// colors are sorted, so we can skip values less than the first min
    	if( val < im.staticObj.colors[0].min ){ return nocolor; }
    	// return cached color, if possible
    	if( cache && cache[val] ){ return cache[val]; }
    	// look for the value within the static color intervals
    	i = search(im.staticObj.colors, val);
    	if( i < 0 ){
    	    color = nocolor;
    	} else {
    	    color = im.staticObj.colors[i];
    	    if( !color.active ){
    		color = nocolor;
    	    }
    	}
    	// save in cache, if possible
    	if( cache && val <= maxcache ){
    	    cache[val] = color;
    	}
    	// this is the color
    	return color;
        }
        // nothing found
        return nocolor;
    };
    
    // convert string to double, returning (possibly scaled) value and delim
    JS9.strtoscaled = function(s){
        let dval = JS9.saostrtod(s);
        const dtype = String.fromCharCode(JS9.saodtype());
        // scale for certain units
        switch(dtype){
        case '"':
    	dval /= 3600.0;
    	break;
        case "'":
    	dval /= 60.0;
    	break;
        case "r":
    	dval *= (180.0 / Math.PI) ;
    	break;
        default:
    	break;
        }
        return {dval, dtype};
    };
    
    // clean file path
    JS9.cleanPath = function(s, what){
        let t;
        // vulnerability hints culled from https://html5sec.org/
        const xssreg = /(<(animation|form|math|maction|svg|script|video)\s|<\?xml|javascript:|on.*&equals;|alert\(|alert&lpar;)|window\./i;
        if( !s ){ return ""; }
        // check for xss vulnerabilities (but not within cfitsio brackets)
        t = s.replace(/\[.*\]/, "");
        if( t.match(xssreg) ){
    	// we're under attack: turn on alerts no matter what
    	JS9.globalOpts.alerts = true;
    	// warn user they are under attack!
    	JS9.error(`${what||"filename"} is susceptible to XSS attack: ${t}`);
        }
        // remove unnecessary /./ etc
        return s.trim().replace(/\/\.\//, "/").replace(/^\.\//, "");
    };
    
    // normalize path substitutions used in JS9 templates/options
    JS9.fixPath = function(f, opts){
        opts = opts || {};
        if( opts.fixpath !== false &&
	    !f.match(JS9.URLEXP)   ){
	    if( f.match(/^\${JS9_DIR}\//) ){
	        f = f.replace(/^\${JS9_DIR}\//, JS9.INSTALLDIR);
	    } else if( f.match(/^\${JS9_INSTALLDIR}\//) ){
	        f = f.replace(/^\${JS9_INSTALLDIR}\//, JS9.INSTALLDIR);
	    } else if( f.match(/^\${JS9_PAGEDIR}\//) ){
	        f = f.replace(/^\${JS9_PAGEDIR}\//, "");
	    }
        }
        return f;
    };
    
    // return virtual path of a local access file, if warranted
    JS9.localAccess = function(file){
        let tfile, text;
        // only if local access is turned on and we have a local disk mounted
        if( !file || !JS9.globalOpts.localAccess || !JS9.hostFS ){
    	return null;
        }
        // get file without bracket extension
        tfile = file.replace(/\[.*\]/, "");
        // and file extension
        text = `.${tfile.split(".").pop().toLowerCase()}`;
        // this is the candidate virtual file
        tfile = `${JS9.hostFS}/${tfile}`;
        // check for existence
        // note to myself: cfitsio uncompresses .gz files into memory, so
        // there is no benefit to having ".gz" in the localTemplates list.
        if( JS9.vsize(tfile) >= 0 &&
    	JS9.inArray(text, JS9.globalOpts.localTemplates.split(",")) >= 0){
    	if( JS9.DEBUG > 2 ){
    	    JS9.log("local access file: %s", tfile);
    	}
    	return tfile;
        }
        // no local access file
        return null;
    };
    
    // get directory name of a file, including trailing "/";
    JS9.dirname = function(f){
        if( !f || !f.includes("/") ){
    	return "";
        }
        return f.match(/.*\//)[0];
    };
}

if( typeof globalThis !== "undefined" ){
    globalThis.JS9InstallViewerUtils = JS9InstallViewerUtils;
}
