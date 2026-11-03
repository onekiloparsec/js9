// @ts-nocheck
/*
 * JS9 browser postMessage helper.
 * Attribution is centralized in README.md.
 */

/*jslint plusplus: true, vars: true, white: true, continue: true, unparam: true, regexp: true, browser: true, devel: true, nomen: true */

// eslint-disable-next-line no-unused-vars
const JS9PM = (function(){
"use strict";

/* return module */
const JS9PM = {};
JS9PM.error = function(s){
    alert(`JS9PM ERROR: ${s}`);
    throw s;
};

// initialize post message processing (for iframes)
JS9PM.init = function (id, target){
    // a Map, so a reply's cmd can only reach a callback we stored, never a
    // built-in such as "push" or "constructor"
    const pm = {cb: new Map()};
    if( !id ){
        JS9PM.error("missing postMessage id for JS9");
    }
    pm.id = window.document.getElementById(id).contentWindow;
    if( !pm.id ){
        JS9PM.error("invalid postMessage id for JS9");
    }
    pm.target = target || "*";
    window.addEventListener("message", (ev) => {
	let msg, cb;
	// only replies from the JS9 iframe, and from its origin when one was
	// given: any other window can post here too
	if( ev.source !== pm.id ){
	    return;
	}
	if( pm.target !== "*" && ev.origin !== new URL(pm.target).origin ){
	    return;
	}
	const data = ev.data;
	if( typeof data === "string" ){
	    // json string passed (we hope)
	    try{ msg = JSON.parse(data); }
	    catch(e){ JS9PM.error(`can't parse msg: ${data}`, e); }
	} else if( typeof data === "object" ){
	    // object was passed directly
	    msg = data;
	} else {
	    JS9PM.error("invalid return msg from postMessage");
	}
	cb = msg && pm.cb.get(msg.cmd);
	if( typeof cb === "function" && msg.res ){
	    pm.cb.delete(msg.cmd);
	    cb(msg.res);
	}
    });
    return pm;
};

// send a postMessage to a JS9PM iframe
JS9PM.send = function(pm, cmd, args, cb){
    let obj;
    if( !pm || !pm.id || !cmd ){
        JS9PM.error("invalid postMessage send for JS9");
    }
    if( typeof args === "function" ){
	cb = args;
	args = null;
    }
    obj = {cmd: cmd, args: args};
    if( cb ){
	pm.cb.set(cmd, cb);
    }
    pm.id.postMessage(obj, pm.target);
};

// return namespace
return JS9PM;
}());
