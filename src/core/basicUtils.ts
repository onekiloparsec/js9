// @ts-nocheck
/* JS9 browser core basic utilities. Attribution is centralized in README.md. */

"use strict";

// install helpers on a JS9 namespace object
var CoreBasicUtils = function(JS9){
    const toString = Object.prototype.toString;
    const hasOwn = Object.prototype.hasOwnProperty;

    const isPlainObject = function(obj){
        return !!obj && toString.call(obj) === "[object Object]";
    };
    const resolveNode = function(value){
        if( !value ){
            return null;
        }
        if( JS9.isJQueryObject && JS9.isWrappedCollection(value) ){
            return value[0] || null;
        }
        if( Array.isArray(value) ){
            return value[0] || null;
        }
        if( value.nodeType ){
            return value;
        }
        if( typeof value === "string" && typeof document !== "undefined" ){
            return value.charAt(0) === "#" ?
                document.querySelector(value) :
                document.getElementById(value);
        }
        return null;
    };
    const toNodeList = function(value){
        if( value === null || value === undefined ){
            return [];
        }
        if( JS9.isJQueryObject && JS9.isWrappedCollection(value) ){
            return Array.from(value);
        }
        if( Array.isArray(value) ){
            return value.filter(Boolean);
        }
        if( typeof NodeList !== "undefined" && value instanceof NodeList ){
            return Array.from(value);
        }
        if( typeof HTMLCollection !== "undefined" && value instanceof HTMLCollection ){
            return Array.from(value);
        }
        if( value.nodeType ){
            return [value];
        }
        return [];
    };
    const makeColorValue = function(value){
        if( typeof tinycolor === "function" ){
            return tinycolor(value);
        }
        return {
            toHex(){
                return String(value || "").replace(/^#/, "");
            },
            toHexString(){
                const text = String(value || "");
                return text.charAt(0) === "#" ? text : `#${text}`;
            }
        };
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

    // test for array values
    JS9.isArray = function(value){
        return Array.isArray(value);
    };

    // find a value in an array
    JS9.inArray = function(value, arr){
        if( !Array.isArray(arr) ){
            return -1;
        }
        return arr.indexOf(value);
    };

    // detect JS9 wrapped collections
    JS9.isWrappedCollection = function(value){
        return !!(value &&
                  typeof value === "object" &&
                  value.__js9Wrapped === true &&
                  typeof value.length === "number");
    };
    JS9.isJQueryObject = JS9.isWrappedCollection;

    JS9.getDomAdapter = function(){
        if( typeof globalThis === "undefined" ){
            return null;
        }
        if( globalThis.JS9Dom && typeof globalThis.JS9Dom.wrap === "function" ){
            return globalThis.JS9Dom;
        }
        return null;
    };

    // wrap a node/selector using the internal DOM adapter when present
    JS9.wrapCollection = function(value){
        const adapter = JS9.getDomAdapter();
        if( JS9.isWrappedCollection(value) ){
            return value;
        }
        if( adapter ){
            return adapter.wrap(value);
        }
        return value;
    };

    JS9.plotAdapter = function(){
        const adapter = JS9.getDomAdapter();
        if( adapter && typeof adapter.plot === "function" ){
            return adapter.plot.apply(adapter, arguments);
        }
        return null;
    };

    JS9.supportsInputType = function(type){
        let input;
        if( typeof document === "undefined" ){
            return false;
        }
        input = document.createElement("input");
        input.setAttribute("type", type);
        return input.type === type;
    };

    JS9.getChildIds = function(container){
        const node = resolveNode(container);
        if( !node ){
            return [];
        }
        return Array.from(node.children).map((child) => child.id).filter(Boolean);
    };

    JS9.makeDraggable = function(container, opts){
        const node = resolveNode(container);
        if( !node ){
            return null;
        }
        if( opts && typeof opts.start === "function" ){
            node._js9DraggableStart = opts.start;
        }
        if( opts && typeof opts.stop === "function" ){
            node._js9DraggableStop = opts.stop;
        }
        return {
            destroy(){
                delete node._js9DraggableStart;
                delete node._js9DraggableStop;
            }
        };
    };

    JS9.enableDragSort = function(container, opts){
        const node = resolveNode(container);
        let dragged = null;
        let startIndex = -1;
        let observer;
        const applyChildren = function(){
            Array.from(node.children).forEach((child) => {
                child.draggable = true;
                child.dataset.js9SortableItem = "true";
            });
        };
        const getItem = function(target){
            if( !target || !target.closest ){
                return null;
            }
            const item = target.closest("[data-js9-sortable-item='true']");
            return item && item.parentElement === node ? item : null;
        };
        const onDragStart = function(evt){
            const item = getItem(evt.target);
            if( !item ){
                return;
            }
            dragged = item;
            startIndex = Array.from(node.children).indexOf(item);
            item.classList.add("JS9DragSortActive");
            if( evt.dataTransfer ){
                evt.dataTransfer.effectAllowed = "move";
                try{
                    evt.dataTransfer.setData("text/plain", item.id || "");
                }
                catch(ignore){ /* empty */ }
            }
            if( opts && typeof opts.start === "function" ){
                opts.start({item, oldIndex: startIndex, newIndex: startIndex}, evt);
            }
        };
        const onDragOver = function(evt){
            const item = getItem(evt.target);
            let rect;
            let after;
            if( !dragged ){
                return;
            }
            evt.preventDefault();
            if( !item || item === dragged ){
                return;
            }
            rect = item.getBoundingClientRect();
            after = evt.clientY > rect.top + rect.height / 2;
            node.insertBefore(dragged, after ? item.nextSibling : item);
        };
        const onDrop = function(evt){
            if( dragged ){
                evt.preventDefault();
            }
        };
        const onDragEnd = function(evt){
            let newIndex;
            let item;
            if( !dragged ){
                return;
            }
            item = dragged;
            newIndex = Array.from(node.children).indexOf(item);
            item.classList.remove("JS9DragSortActive");
            dragged = null;
            if( opts && typeof opts.stop === "function" ){
                opts.stop({item, oldIndex: startIndex, newIndex: newIndex}, evt);
            }
            startIndex = -1;
        };

        if( !node ){
            return null;
        }
        if( node._js9DragSortDestroy ){
            node._js9DragSortDestroy();
        }
        applyChildren();
        observer = new MutationObserver(() => {
            applyChildren();
        });
        observer.observe(node, {childList: true});
        node.addEventListener("dragstart", onDragStart);
        node.addEventListener("dragover", onDragOver);
        node.addEventListener("drop", onDrop);
        node.addEventListener("dragend", onDragEnd);
        node._js9DragSortDestroy = function(){
            observer.disconnect();
            node.removeEventListener("dragstart", onDragStart);
            node.removeEventListener("dragover", onDragOver);
            node.removeEventListener("drop", onDrop);
            node.removeEventListener("dragend", onDragEnd);
            Array.from(node.children).forEach((child) => {
                child.draggable = false;
                delete child.dataset.js9SortableItem;
            });
            delete node._js9DragSortDestroy;
        };
        return {
            destroy: node._js9DragSortDestroy
        };
    };

    JS9.setupColorInputs = function(targets, opts){
        return toNodeList(targets).map((input) => {
            const listeners = [];
            const add = function(name, handler){
                input.addEventListener(name, handler);
                listeners.push({name, handler});
            };
            if( !(input instanceof HTMLInputElement) ){
                return {destroy(){ return; }};
            }
            if( JS9.supportsInputType("color") ){
                input.type = "color";
            }
            if( opts && opts.color ){
                input.value = makeColorValue(opts.color).toHexString();
            }
            if( opts && typeof opts.onMove === "function" ){
                add("input", (evt) => {
                    opts.onMove({target: input, color: makeColorValue(input.value), event: evt});
                });
            }
            if( opts && typeof opts.onChange === "function" ){
                add("change", (evt) => {
                    opts.onChange({target: input, color: makeColorValue(input.value), event: evt});
                });
            }
            return {
                destroy(){
                    listeners.forEach(({name, handler}) => {
                        input.removeEventListener(name, handler);
                    });
                }
            };
        });
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

    // deep/shallow merge utility matching legacy JS9 call patterns
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

if( typeof globalThis !== "undefined" ){
    globalThis.CoreBasicUtils = CoreBasicUtils;
}
