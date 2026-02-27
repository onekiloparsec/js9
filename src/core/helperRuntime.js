/* JS9 browser viewer core. Attribution is centralized in README.md. */

/*global io, Worker, URL, alert, document, location, window */

"use strict";

function JS9InstallHelperRuntime(JS9){
    const triggerDocumentEvent = (name, payload) => {
	if( typeof JS9.triggerDocumentEvent === "function" ){
	    JS9.triggerDocumentEvent(name, payload);
	}
    };

const loadExternalScript = (url, timeout, onload, onerror) => {
    let timer;
    let finished = false;
    const script = document.createElement("script");
    const cleanup = () => {
	if( timer ){
	    window.clearTimeout(timer);
	}
	script.onload = null;
	script.onerror = null;
    };
    const fail = (status, message) => {
	if( finished ){
	    return;
	}
	finished = true;
	cleanup();
	try{ script.remove(); } catch(ignore){ /* empty */ }
	onerror(status, message);
    };
    script.onload = () => {
	if( finished ){
	    return;
	}
	finished = true;
	cleanup();
	onload();
    };
    script.onerror = () => {
	fail("error", "script load failed");
    };
    if( timeout > 0 ){
	timer = window.setTimeout(() => {
	    fail("timeout", "timeout");
	}, timeout);
    }
    script.src = url;
    (document.head || document.documentElement).appendChild(script);
};

const requestText = (url, method, data, timeout, onSuccess, onFailure) => {
    const params = new URLSearchParams();
    let fullURL = url;
    let body;
    let controller;
    let timer;
    let options;

    for( const key of Object.keys(data || {}) ){
	const val = data[key];
	if( val === undefined || val === null ){
	    continue;
	}
	params.append(key, typeof val === "object" ? JSON.stringify(val) : String(val));
    }

    if( method === "GET" ){
	const query = params.toString();
	if( query ){
	    fullURL += fullURL.includes("?") ? `&${query}` : `?${query}`;
	}
    } else {
	body = params.toString();
    }

    if( typeof AbortController !== "undefined" ){
	controller = new AbortController();
    }

    options = {
	method,
	cache: "no-store"
    };
    if( controller ){
	options.signal = controller.signal;
    }
    if( method !== "GET" ){
	options.headers = {"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"};
	options.body = body;
    }

    if( timeout > 0 && controller ){
	timer = window.setTimeout(() => {
	    controller.abort();
	}, timeout);
    }

    fetch(fullURL, options).then((res) => {
	if( timer ){
	    window.clearTimeout(timer);
	}
	if( !res.ok ){
	    throw new Error(res.statusText || "error");
	}
	return res.text();
    }).then((text) => {
	onSuccess(text);
    }).catch((e) => {
	if( timer ){
	    window.clearTimeout(timer);
	}
	if( e && e.name === "AbortError" ){
	    onFailure("timeout", "timeout");
	} else {
	    onFailure("error", e && e.message ? e.message : "error");
	}
    });
};

// ---------------------------------------------------------------------
// JS9 Command, commands for console window
// ---------------------------------------------------------------------

JS9.Command = function(obj){
    let p;
    // copy properties to new object
    obj = obj || {};
    for( p of Object.keys(obj) ){
	this[p] = obj[p];
    }
    // sanity check
    if( !obj.name ){
	JS9.error("command has no name");
    }
    if( !obj.get && !obj.set  ){
	JS9.error("command requires get and/or set routine");
    }
    // save in commands list
    JS9.commands.push(this);
    // debugging
    if( JS9.DEBUG > 1 ){
	JS9.log("JS9 command:  %s", this.name);
    }
};

// get the display tied to this command (as well as the current image).
JS9.Command.prototype.getDisplayInfo = function(display){
    if( display && display.id ){
	this.display = display;
	this.image = display.image;
    }
    // allow chaining
    return this;
};

// return "get" or "set" to specify which command to run
JS9.Command.prototype.getWhich = function(args){
    let which;
    if( this.get && !this.set ){
	which = "get";
    } else if( this.set && !this.get ){
	which = "set";
    } else if( this.which ){
	which = this.which(args);
    } else if( args.length === 0 ){
	which = "get";
    } else {
	which = "set";
    }
    return which;
};

// ---------------------------------------------------------------------
// JS9 helper to manage connection to back-end services
// ---------------------------------------------------------------------

JS9.Helper = function(){
    // reset protocol for file:
    if( JS9.globalOpts.helperProtocol === "file:" ){
	JS9.globalOpts.helperProtocol = "http:";
    }
    // reset helper timeout for local access
    if( !document.domain || document.domain === "localhost" ){
	JS9.globalOpts.htimeout = JS9.globalOpts.lhtimeout;
    }
    // add suffix, if necessary
    if( !JS9.globalOpts.helperProtocol.match(/\/\/$/) ){
	JS9.globalOpts.helperProtocol += "//";
    }
    // assume the worst
    this.connected = false;
    this.helper = false;
    // set up initial type of helper connection
    if( JS9.allinone && !JS9.globalOpts.allinoneHelper ){
	this.type = "none";
    } else {
	this.type = JS9.globalOpts.helperType || "sock.io";
    }
    // no page id yet
    this.pageid = null;
    // make the connection
    this.connect();
};

// get back-end helper connection info
JS9.Helper.prototype.connectinfo = function(){
    let s;
    // no connection configured
    if( JS9.helper.connected === null ){
	return "notConfigured";
    }
    // connection configured and established
    if( JS9.helper.connected ){
	s = `connected ${JS9.helper.type} ${JS9.helper.url}`;
	if( JS9.helper.pageid ){
	    s += `<p>${JS9.helper.pageid}`;
	}
	return s;
    }
    // connection configured but not established
    return `notConnected ${JS9.helper.type}`;
};

// connect to back-end helper
JS9.Helper.prototype.connect = function(type){
    let sockbase, sockfile;
    const failedHelper = (textStatus, errorThrown) => {
	this.connected = false;
	this.helper = false;
	this.ready = true;
	triggerDocumentEvent("JS9:helperReady",
			     {type: "socket.io", status: "error"});
	textStatus = textStatus || "timeout";
	if( !errorThrown || errorThrown === "timeout" ){
	    errorThrown = "or connection refused";
	}
	if( errorThrown === textStatus  ){
	    textStatus = "";
	}
	if( errorThrown === "error" ){
	    errorThrown = "is the helper running?";
	}
	// throw error if needed
	if( JS9.globalOpts.requireHelper ){
	    JS9.error(`helper connect error: ${textStatus} (${errorThrown})`);
	} else if( JS9.DEBUG ){
	    JS9.log(`JS9 helper connect error: ${textStatus} (${errorThrown})`);
	}
    };
    const connectHelper = (url) => {
	loadExternalScript(url, JS9.globalOpts.htimeout,
	    () => {
		// if there is no io object, we didn't really succeed
		// can happen, for example, in the Jupyter environment
		if( typeof io === "undefined" ){
		    failedHelper("socket io object is undefined", null);
		    return;
		}
		// connect to the helper
		this.socket = io.connect(this.url, JS9.socketioOpts);
		// on-event processing
		this.socket.on("connect", () => {
		    let ii, d, p;
		    this.connected = true;
		    this.helper = true;
		    d = [];
		    for(ii=0; ii<JS9.displays.length; ii++){
			d.push(JS9.displays[ii].id);
		    }
		    p = this.pageid;
		    this.socket.emit("initialize", {displays: d, pageid: p},
                    (obj) => {
			this.pageid = obj.pageid;
			this.js9helper = obj.js9helper;
			JS9.globalOpts.dataPathModify = obj.dataPathModify;
			this.ready = true;
			triggerDocumentEvent("JS9:helperReady",
					     {type: "socket.io", status: "OK"});
			if( JS9.DEBUG ){
			    JS9.log(`JS9 helper: connect: ${this.type}`);
			}
		    });
		    triggerDocumentEvent("JS9:connected",
					 {type: "socket.io", status: "OK"});
		});
		this.socket.on("connect_error", () => {
		    this.connected = false;
		    this.helper = false;
		    if( JS9.DEBUG > 1 ){
			JS9.log("JS9 helper: connect error");
		    }
		});
		this.socket.on("connect_timeout", () => {
		    this.connected = false;
		    this.helper = false;
		    if( JS9.DEBUG > 1 ){
			JS9.log("JS9 helper: connect timeout");
		    }
		});
		this.socket.on("disconnect", (reason) => {
		    this.connected = false;
		    this.helper = false;
		    if( JS9.DEBUG > 1 ){
			JS9.log(`JS9 helper: disconnect: ${reason}`);
		    }
		    // https://github.com/socketio/socket.io-client/blob/master/docs/API.md#event-disconnect
		    if( reason === "io server disconnect" ){
			// the disconnection was initiated by the server,
			// you need to reconnect manually
			if( JS9.DEBUG > 1 ){
			    JS9.log("JS9 helper: manual reconnect");
			}
			this.socket.connect();
		    }
		    // else the socket will automatically try to reconnect
		});
		this.socket.on("reconnect", () => {
		    this.connected = true;
		    this.helper = true;
		    if( JS9.DEBUG > 1 ){
			JS9.log("JS9 helper: reconnect");
		    }
		});
		this.socket.on("msg", JS9.msgHandler);
	    },
	    (textStatus, errorThrown) => {
		failedHelper(textStatus, errorThrown);
	    });
    };
    // might be establishing a new type
    if( type ){
	this.type = type;
    }
    // close off previous socket connection, if necessary
    if( this.socket ){
	try{this.socket.disconnect();}
	catch(e){JS9.log("warning: can't disconnect from socket");}
	this.socket = null;
    }
    // base of helper url is either specified, same as current domain, or local
    if( JS9.globalOpts.helperURL ){
	if( JS9.globalOpts.helperURL.search(/:\/\//) >=0 ){
	    this.url = JS9.globalOpts.helperURL;
	} else {
	    this.url = JS9.globalOpts.helperProtocol + JS9.globalOpts.helperURL;
	}
    } else if( document.domain ){
	if( location.origin ){
	    this.url = location.origin;
	} else {
	    this.url = JS9.globalOpts.helperProtocol + document.domain;
	}
    } else {
	this.url = `${JS9.globalOpts.helperProtocol}localhost`;
    }
    // save base of url
    this.baseurl = this.url;
    // try to establish connection, based on connection type
    switch(this.type){
    case "none":
	this.connected = null;
	this.ready = true;
        // signal JS9 helper is ready
        triggerDocumentEvent("JS9:helperReady", {type: "none", status: "OK"});
        break;
    case "get":
    case "post":
	// sanity check
	if( !JS9.globalOpts.helperCGI ){
	    JS9.error("cgi script name missing for helper");
	}
	this.url += `/${JS9.globalOpts.helperCGI}`;
	this.connected = true;
	this.helper = true;
	        if( JS9.DEBUG ){
		    JS9.log(`JS9 helper: connect: ${this.type}`);
	        }
		this.ready = true;
        triggerDocumentEvent("JS9:helperReady", {type: "get", status: "OK"});
		break;
    case "sock.io":
    case "nodejs":
	if( !JS9.globalOpts.helperPort ){
	    JS9.error("port missing for helper");
	}
	// ignore port on url, add our own
	this.url = `${this.url.replace(/:[0-9][0-9]*$/, "")}:${JS9.globalOpts.helperPort}`;
	// which version of socket.io?
	sockbase = "socket.io";
	// use min version for production, as per migration docs
	if( JS9.DEBUG <= 2 ){
	    sockfile  = "socket.io.min.js";
	} else {
	    sockfile  = "socket.io.js";
	}
	// full url of the socket.io.js file
	this.sockurl  = `${this.url}/${sockbase}/${sockfile}`;
	// make sure helper is running and then connect
	connectHelper(this.sockurl);
	break;
    default:
	JS9.error(`unknown helper type: ${this.type}`);
	break;
    }
};

// send request to back-end helper
JS9.Helper.prototype.send = function(key, obj, cb){
    // sanity check
    if( !this.connected ){ return null; }
    // add cookie value
    // add dataPath, if available (but always look in the helper directory)
    if( obj && (typeof obj === "object") ){
	// wrap this in a try to catch CORS errors
        try{ obj.cookie = document.cookie; }
	catch(e){ delete obj.cookie; }
	if( JS9.globalOpts.dataPath && !obj.dataPath ){
	    obj.dataPath = `${JS9.globalOpts.dataPath}:.`;
	}
    } else {
	obj = {dataPath: "."};
    }
    // add path which gets us to the js9 root
    if( JS9.TOROOT ){
	obj.dataPath += `:${JS9.TOROOT}`;
    }
    // tell server how to get to root (for datapath)
    // send message, based on connection type
    switch(this.type){
    case "get":
    case "post":
	obj.key = key;
	if( JS9.helper.pageid ){
	    obj.pageid = JS9.helper.pageid;
	}
		if( JS9.DEBUG ){
		    JS9.log("JS9 cgi helper [%s, %s]: %s",
			    this.type, JSON.stringify(obj), this.url);
	        }
		requestText(this.url, this.type.toUpperCase(), obj,
			    JS9.globalOpts.htimeout,
		    (data) => {
			if( typeof data === "string" &&
			    data.search(JS9.analOpts.epattern) >=0 ){
			    JS9.log(data);
		}
			if( cb ){
			    cb(data);
			}
		    },
		    (textStatus, errorThrown) => {
			if( JS9.DEBUG ){
		            JS9.log(`JS9 helper: ${this.type} failure: ${textStatus} ${errorThrown}`);
			}
		    });
		break;
    case "sock.io":
    case "nodejs":
	JS9.helper.socket.emit(key, obj, cb);
	break;
    }
    // allow chaining
    return this;
};

// ---------------------------------------------------------------------
// JS9 web worker support to off-load CPU intensive tasks
// ---------------------------------------------------------------------

// create new web worker
JS9.WebWorker = function(url){
    const finishup = () => {
	this.worker.onmessage = JS9.WebWorker.prototype.msgHandler.bind(this);
	this.handlers = [];
    };
    if( url.match(JS9.URLEXP) ){
	// avoid cross-origin problems if the webworker is being retrieved
	// from somewhere other than the local host
	// this leaks a small bit of memory (no revokeObjectURL call)
	JS9.fetchURL(null, url, null, (blob) => {
	    this.worker = new Worker(URL.createObjectURL(blob));
	    finishup();
	});
    } else {
	// ordinary retrieval of a local file
	this.worker = new Worker(url);
	finishup();
    }
};

// handle (known) messages from web worker
JS9.WebWorker.prototype.msgHandler = function(msg){
    let i, handler;
    const h = JS9.helper;
    const obj = msg.data;
    switch(obj.cmd){
    case "progress":
	JS9.progress(obj.result.value, obj.result.max);
	break;
    case "initsocketio":
	if( obj.result === "OK" ){
	    this.sockinit = true;
	    for(i=0; i<this.handlers.length; i++){
		handler = this.handlers[i];
		if( handler.id === obj.id ){
		    handler.func(obj.result);
		    this.handlers.splice(i, 1);
		    break;
		}
	    }
	}
	break;
    case "uploadFITS":
	for(i=0; i<this.handlers.length; i++){
	    handler = this.handlers[i];
	    if( handler.id === obj.id ){
		handler.func(obj.result);
		this.handlers.splice(i, 1);
		break;
	    }
	}
	break;
    case "connect_error":
    case "connect_timeout":
	delete JS9.worker.uploadActive;
	JS9.progress(false);
	if( JS9.DEBUG > 1 ){
	    JS9.log(`JS9 worker socketio: ${obj.cmd}`);
	}
	break;
    case "disconnect":
	delete JS9.worker.uploadActive;
	JS9.progress(false);
	obj.result = obj.result || "JS9 worker socket was disconnected";
	// need a slight delay here, not sure why
	window.setTimeout(() => {
	    JS9.worker.send("initsocketio", [h.url, h.pageid],
			    () => {
				if( obj.alert ){
				    alert(obj.result);
				} else if(  JS9.DEBUG > 1 ){
				    JS9.log(obj.result);
				}
			    });
	}, JS9.WORKEROUT);
	break;
    case "error":
	delete JS9.worker.uploadActive;
	JS9.progress(false);
	JS9.error(obj.result||"in web worker");
	break;
    default:
	break;
    }
};

// send a message to a web worker
JS9.WebWorker.prototype.send = function(cmd, args, func, xfer){
    const id = cmd + JS9.uniqueID();
    const obj = {id, cmd, args};
    // push context
    if( func ){
	args = args || [];
	this.handlers.push({id, cmd, args, func});
    }
    // send message, possibly with transferred data
    if( xfer ){
	this.worker.postMessage(obj, xfer);
    } else {
	this.worker.postMessage(obj);
    }
};

// initialize worker socketio connection, then call handler
JS9.WebWorker.prototype.socketio = function(handler){
    const h = JS9.helper;
    JS9.worker.send("initsocketio", [h.url, h.pageid], (s) => {
	if( s === "OK" ){
	    if( handler ){ handler(); }
	} else {
	    JS9.error(`can't init socket.io for JS9 worker: ${s}`);
	}
    });
};

// terminate a web worker
JS9.WebWorker.prototype.terminate = function(){
    this.worker.terminate();
};
}

if( typeof globalThis !== "undefined" ){
    globalThis.JS9InstallHelperRuntime = JS9InstallHelperRuntime;
}
