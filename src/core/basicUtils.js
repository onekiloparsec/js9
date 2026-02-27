/* JS9 browser core basic utilities. Attribution is centralized in README.md. */

"use strict";

// install helpers on a JS9 namespace object
var CoreBasicUtils = function(JS9){
    const toString = Object.prototype.toString;
    const hasOwn = Object.prototype.hasOwnProperty;

    const isPlainObject = function(obj){
        return !!obj && toString.call(obj) === "[object Object]";
    };

    // is this a string representation of a number?
    // https://stackoverflow.com/questions/175739/built-in-way-in-javascript-to-check-if-a-string-is-a-valid-number
    // NB: don't use Number.XXX routines, they don't work .. "2016-5" returns true
    JS9.isNumber = function(s){
        return !isNaN(parseFloat(s)) && isFinite(s);
    };

    // check if a variable is neither undefined nor null
    JS9.notNull = function(s){
        return s !== undefined && s !== null;
    };

    // check if a variable is either undefined or null
    JS9.isNull = function(s){
        return s === undefined || s === null;
    };

    // use a default if a variable is either undefined or null
    JS9.defNull = function(s, def){
        return JS9.notNull(s) ? s : def;
    };

    // check if a wcs system is a world coordinate system (fk5, etc)
    JS9.isWCSSys = function(s){
        return s !== "image" && s !== "physical";
    };

    // check if a wcs system is not a world coordinate system (fk5, etc)
    JS9.notWCS = function(s){
        return s === "image" || s === "physical";
    };

    // test for array values (jquery-compatible replacement)
    JS9.isArray = function(value){
        return Array.isArray(value);
    };

    // find a value in an array (jquery-compatible replacement)
    JS9.inArray = function(value, arr){
        if( !Array.isArray(arr) ){
            return -1;
        }
        return arr.indexOf(value);
    };

    // detect jquery objects without requiring jquery globals
    JS9.isJQueryObject = function(value){
        return !!(value &&
                  typeof value === "object" &&
                  typeof value.jquery === "string" &&
                  typeof value.length === "number");
    };

    // current document scroll offsets
    JS9.getDocumentScroll = function(){
        const doc = typeof document !== "undefined" ? document : null;
        const body = doc ? doc.body : null;
        const root = doc ? doc.documentElement : null;
        const x = (typeof window !== "undefined" && window.pageXOffset !== undefined) ?
              window.pageXOffset :
              ((root && root.scrollLeft) || (body && body.scrollLeft) || 0);
        const y = (typeof window !== "undefined" && window.pageYOffset !== undefined) ?
              window.pageYOffset :
              ((root && root.scrollTop) || (body && body.scrollTop) || 0);
        return {x, y};
    };

    // dispatch a document-level event with optional detail payload
    JS9.triggerDocumentEvent = function(name, payload){
        let ev;
        if( typeof document === "undefined" ){
            return;
        }
        try{
            ev = new CustomEvent(name, {detail: payload || {}});
        }
        catch(ignore){
            ev = document.createEvent("CustomEvent");
            ev.initCustomEvent(name, false, false, payload || {});
        }
        document.dispatchEvent(ev);
    };

    // deep/shallow merge utility compatible with jquery's extend usage
    JS9.extend = function(){
        let deep = false;
        let i = 0;
        let target;
        let source;
        let key;
        let copy;
        let clone;

        if( typeof arguments[0] === "boolean" ){
            deep = arguments[0];
            i = 1;
        }
        target = arguments[i] || {};
        i++;

        for(; i<arguments.length; i++){
            source = arguments[i];
            if( !source ){
                continue;
            }
            for(key in source){
                if( !hasOwn.call(source, key) ){
                    continue;
                }
                copy = source[key];
                if( target === copy || copy === undefined ){
                    continue;
                }
                if( deep && copy && (Array.isArray(copy) || isPlainObject(copy)) ){
                    if( Array.isArray(copy) ){
                        clone = Array.isArray(target[key]) ? target[key] : [];
                    } else {
                        clone = isPlainObject(target[key]) ? target[key] : {};
                    }
                    target[key] = JS9.extend(true, clone, copy);
                } else {
                    target[key] = copy;
                }
            }
        }
        return target;
    };

    // lightweight ajax wrapper for existing JS9 call patterns
    JS9.ajax = function(opts){
        let params;
        const ajaxOpts = opts || {};
        const method = (ajaxOpts.type || ajaxOpts.method || "GET").toUpperCase();
        const async = ajaxOpts.async !== false;

        return new Promise((resolve, reject) => {
            const done = (status, payload, err, xhr) => {
                if( status === "success" ){
                    if( typeof ajaxOpts.success === "function" ){
                        ajaxOpts.success(payload, "success", xhr);
                    }
                    if( typeof ajaxOpts.complete === "function" ){
                        ajaxOpts.complete(xhr, "success");
                    }
                    resolve(payload);
                } else {
                    if( typeof ajaxOpts.error === "function" ){
                        ajaxOpts.error(xhr, status, err);
                    }
                    if( typeof ajaxOpts.complete === "function" ){
                        ajaxOpts.complete(xhr, status);
                    }
                    reject(err instanceof Error ? err : new Error(String(err || status)));
                }
            };

            const xhr = new XMLHttpRequest();
            let url = ajaxOpts.url || "";
            let data = ajaxOpts.data;

            if( data && method === "GET" && ajaxOpts.processData !== false &&
                typeof data === "object" && !(data instanceof FormData) ){
                params = new URLSearchParams(data).toString();
                if( params ){
                    url += (url.indexOf("?") >= 0 ? "&" : "?") + params;
                }
                data = null;
            }

            xhr.open(method, url, async);
            if( ajaxOpts.mimeType && xhr.overrideMimeType ){
                xhr.overrideMimeType(ajaxOpts.mimeType);
            }
            if( ajaxOpts.timeout ){
                xhr.timeout = ajaxOpts.timeout;
            }
            if( ajaxOpts.headers && typeof ajaxOpts.headers === "object" ){
                Object.keys(ajaxOpts.headers).forEach((header) => {
                    xhr.setRequestHeader(header, ajaxOpts.headers[header]);
                });
            }

            xhr.onload = () => {
                let payload = xhr.responseText;
                if( xhr.status >= 200 && xhr.status < 300 ){
                    try{
                        switch(ajaxOpts.dataType){
                        case "json":
                            payload = payload ? JSON.parse(payload) : null;
                            break;
                        case "xml":
                            payload = xhr.responseXML || payload;
                            break;
                        case "script":
                            (new Function(payload))();
                            break;
                        default:
                            break;
                        }
                    }
                    catch(e){
                        done("parsererror", null, e, xhr);
                        return;
                    }
                    done("success", payload, null, xhr);
                    return;
                }
                done("error", null, new Error(`HTTP ${xhr.status}`), xhr);
            };

            xhr.onerror = () => {
                done("error", null, new Error("network error"), xhr);
            };

            xhr.ontimeout = () => {
                done("timeout", null, new Error("request timeout"), xhr);
            };

            if( method === "GET" || method === "HEAD" || data === undefined || data === null ){
                xhr.send();
                return;
            }

            if( ajaxOpts.processData !== false &&
                typeof data === "object" &&
                !(data instanceof FormData) &&
                !(data instanceof Blob) &&
                !(data instanceof ArrayBuffer) ){
                params = new URLSearchParams(data).toString();
                xhr.setRequestHeader("Content-Type",
                                     ajaxOpts.contentType ||
                                     "application/x-www-form-urlencoded; charset=UTF-8");
                xhr.send(params);
                return;
            }
            xhr.send(data);
        });
    };
};
