// @ts-nocheck
/* Minimal DOM compatibility layer for JS9 core runtime. */

/*global document, window, Element, HTMLInputElement, HTMLFormElement, CustomEvent */

"use strict";

(function(){
    const dataStore = new WeakMap();
    const eventStore = new WeakMap();
    const hiddenDisplayStore = new WeakMap();
    const noop = function(){ return; };
    const contextMenuRegistry = new Map();
    let activeContextMenu = null;
    let contextMenuStylesInstalled = false;
    let contextMenuId = 0;

    const isNode = function(value){
        return !!(value && typeof value === "object" && typeof value.nodeType === "number");
    };

    const isWindow = function(value){
        return !!(value && value === value.window);
    };

    const isHtml = function(value){
        return typeof value === "string" &&
            value.trim().charAt(0) === "<" &&
            value.trim().charAt(value.trim().length - 1) === ">";
    };

    const toArray = function(value){
        if( value === null || value === undefined ){
            return [];
        }
        if( value instanceof DomCollection ){
            return [...value];
        }
        if( Array.isArray(value) ){
            return [...value];
        }
        if( typeof NodeList !== "undefined" && value instanceof NodeList ){
            return Array.from(value);
        }
        if( typeof HTMLCollection !== "undefined" && value instanceof HTMLCollection ){
            return Array.from(value);
        }
        return [value];
    };

    const unique = function(items){
        const seen = new Set();
        return items.filter((item) => {
            if( seen.has(item) ){
                return false;
            }
            seen.add(item);
            return true;
        });
    };

    const normalizeSelector = function(selector){
        return String(selector || "").trim();
    };

    const toDatasetKey = function(key){
        return String(key).replace(/-([a-z])/g, (m, c) => c.toUpperCase());
    };

    const toKebabKey = function(key){
        return String(key).replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
    };

    const isPixelStyleProperty = function(name){
        return /^(width|height|top|left|right|bottom|minWidth|minHeight|maxWidth|maxHeight|margin.*|padding.*)$/i.test(String(name || ""));
    };

    const normalizeCssValue = function(name, value){
        if( value === null || value === undefined ){
            return "";
        }
        if( typeof value === "number" ){
            return name !== "zIndex" ? `${value}px` : String(value);
        }
        if( typeof value === "string" ){
            const trimmed = value.trim();
            if( isPixelStyleProperty(name) &&
                /^-?\d+(\.\d+)?$/.test(trimmed) ){
                return `${trimmed}px`;
            }
            return trimmed;
        }
        return String(value);
    };

    const getStore = function(target){
        let store = dataStore.get(target);
        if( !store ){
            store = {};
            dataStore.set(target, store);
        }
        return store;
    };

    const getListeners = function(target){
        let listeners = eventStore.get(target);
        if( !listeners ){
            listeners = [];
            eventStore.set(target, listeners);
        }
        return listeners;
    };

    const createNodesFromHtml = function(html, attrs){
        const template = document.createElement("template");
        template.innerHTML = String(html).trim();
        const nodes = Array.from(template.content.childNodes).filter((node) => {
            return node.nodeType === 1 || node.nodeType === 3;
        });
        if( attrs && nodes[0] && nodes[0].nodeType === 1 ){
            Object.keys(attrs).forEach((key) => {
                const value = attrs[key];
                switch(key){
                case "text":
                    nodes[0].textContent = value;
                    break;
                case "html":
                    nodes[0].innerHTML = value;
                    break;
                case "class":
                case "className":
                    nodes[0].className = value;
                    break;
                default:
                    if( key in nodes[0] ){
                        try{ nodes[0][key] = value; }
                        catch(ignore){ /* empty */ }
                    }
                    if( value !== undefined && value !== null ){
                        nodes[0].setAttribute(key, String(value));
                    }
                    break;
                }
            });
        }
        return nodes;
    };

    const queryAll = function(selector, context){
        const ctx = context || document;
        if( !selector ){
            return [];
        }
        if( isNode(selector) || isWindow(selector) ){
            return [selector];
        }
        if( selector instanceof DomCollection ){
            return [...selector];
        }
        if( Array.isArray(selector) ){
            return [...selector];
        }
        if( typeof selector === "string" ){
            if( isHtml(selector) ){
                return createNodesFromHtml(selector, arguments[2]);
            }
            return Array.from(ctx.querySelectorAll(selector));
        }
        return toArray(selector);
    };

    const toElements = function(content){
        if( content instanceof DomCollection ){
            return [...content];
        }
        if( isNode(content) || isWindow(content) ){
            return [content];
        }
        if( Array.isArray(content) ){
            return content;
        }
        if( typeof content === "string" ){
            if( isHtml(content) ){
                return createNodesFromHtml(content);
            }
            return [document.createTextNode(content)];
        }
        return [];
    };

    const appendContent = function(parent, content){
        const nodes = toElements(content);
        if( typeof content === "string" && !isHtml(content) ){
            parent.insertAdjacentText("beforeend", content);
            return;
        }
        nodes.forEach((node) => {
            parent.appendChild(node);
        });
    };

    const installContextMenuStyles = function(){
        let style;
        if( contextMenuStylesInstalled || typeof document === "undefined" ){
            return;
        }
        style = document.createElement("style");
        style.dataset.js9ContextMenu = "true";
        style.textContent = [
            ".JS9ContextMenuList{position:absolute;z-index:100000;min-width:220px;margin:0;padding:6px 0;list-style:none;background:#fff;border:1px solid #b9c4d2;border-radius:8px;box-shadow:0 12px 28px rgba(18,34,56,.18);font:13px/1.4 sans-serif;color:#132238;overflow:visible;}",
            ".JS9ContextMenuItem{position:relative;display:block;white-space:nowrap;cursor:pointer;user-select:none;overflow:visible;}",
            ".JS9ContextMenuItem.JS9ContextMenuInput{cursor:default;align-items:flex-start;}",
            ".JS9ContextMenuItem.JS9ContextMenuHover{background:#eaf2ff;}",
            ".JS9ContextMenuItem.JS9ContextMenuDisabled{opacity:.45;cursor:not-allowed;}",
            ".JS9ContextMenuSeparator{height:1px;margin:6px 10px;background:#d9e0ea;}",
            ".JS9ContextMenuItem > .JS9ContextMenuList{display:none;top:-6px;left:calc(100% - 1px);margin-left:0;}",
            ".JS9ContextMenuItem.JS9ContextMenuVisible > .JS9ContextMenuList{display:block;}",
            ".JS9ContextMenuItem label{display:flex;flex-direction:column;gap:4px;width:100%;}",
            ".JS9ContextMenuItem > .JS9ContextMenuLabel,.JS9ContextMenuItem > label{padding:7px 14px;}",
            ".JS9ContextMenuItem input[type='text'],.JS9ContextMenuItem textarea,.JS9ContextMenuItem select{width:100%;box-sizing:border-box;padding:5px 7px;border:1px solid #b9c4d2;border-radius:4px;background:#fff;color:#132238;}",
            ".JS9ContextMenuItem input[type='text']:focus,.JS9ContextMenuItem textarea:focus,.JS9ContextMenuItem select:focus{outline:2px solid #89aef7;outline-offset:0;}",
            ".JS9MenubarKeyAction{float:right;color:#6b7a90;}",
            ".JS9ContextMenuCheck{display:inline-block;min-width:14px;color:#2d5fbf;font-weight:700;}",
            ".JS9ContextMenuLabel{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;box-sizing:border-box;}",
            ".JS9ContextMenuText{display:inline-flex;align-items:center;gap:8px;flex:1 1 auto;min-width:0;}",
            ".JS9ContextMenuCaret{display:inline-flex;align-items:center;justify-content:center;min-width:12px;color:#6b7a90;font-size:14px;line-height:1;}",
            ".JS9ContextMenuRoot{max-height:none;overflow:visible;}"
        ].join("");
        document.head.appendChild(style);
        contextMenuStylesInstalled = true;
    };

    const closeActiveContextMenu = function(){
        const entry = activeContextMenu;
        if( !entry ){
            return;
        }
        activeContextMenu = null;
        document.removeEventListener("mousedown", entry.onDocumentMouseDown, true);
        document.removeEventListener("keydown", entry.onDocumentKeyDown, true);
        if( entry.events && typeof entry.events.hide === "function" ){
            entry.events.hide(entry.opt);
        }
        if( entry.menu && entry.menu.remove ){
            entry.menu.remove();
        }
    };

    const makeContextMenuEvent = function(type, target, opt, originalEvent){
        const evt = originalEvent || new Event(type);
        evt.type = type;
        evt.data = opt;
        evt.currentTarget = target;
        evt.target = target;
        return evt;
    };

    const getContextMenuValues = function(opt){
        const values = {};
        Object.keys((opt && opt.inputs) || {}).forEach((key) => {
            const input = opt.inputs[key];
            if( !input ){
                return;
            }
            if( input.type === "checkbox" || input.type === "radio" ){
                values[key] = !!input.checked;
            } else {
                values[key] = input.value;
            }
        });
        return values;
    };

    const setContextMenuValues = function(opt, values){
        Object.keys(values || {}).forEach((key) => {
            const input = opt && opt.inputs ? opt.inputs[key] : null;
            if( !input ){
                return;
            }
            if( input.type === "checkbox" || input.type === "radio" ){
                input.checked = !!values[key];
            } else if( values[key] !== undefined && values[key] !== null ){
                input.value = values[key];
            } else {
                input.value = "";
            }
        });
    };

    const positionElement = function(target, options){
        let ref;
        let rect;
        let top;
        let left;
        const at = String((options && options.at) || "left top").split(/\s+/);
        const my = String((options && options.my) || "left top").split(/\s+/);
        if( !target || !target.style ){
            return;
        }
        ref = wrap(options && options.of)[0];
        if( !ref || !ref.getBoundingClientRect ){
            return;
        }
        rect = ref.getBoundingClientRect();
        left = rect.left + window.pageXOffset;
        top = rect.top + window.pageYOffset;
        if( at[0] === "right" ){
            left += rect.width;
        } else if( at[0] === "center" ){
            left += rect.width / 2;
        }
        if( at[1] === "bottom" ){
            top += rect.height;
        } else if( at[1] === "center" ){
            top += rect.height / 2;
        }
        if( my[0] === "right" ){
            left -= target.offsetWidth;
        } else if( my[0] === "center" ){
            left -= target.offsetWidth / 2;
        }
        if( my[1] === "bottom" ){
            top -= target.offsetHeight;
        } else if( my[1] === "center" ){
            top -= target.offsetHeight / 2;
        }
        target.style.left = `${Math.max(8, left)}px`;
        target.style.top = `${Math.max(8, top)}px`;
    };

    const buildContextMenuTree = function(items, state, depth){
        const closeSiblingSubmenus = function(parentMenu, currentItem){
            Array.from(parentMenu.children).forEach((sibling) => {
                if( sibling === currentItem || !sibling.classList ){
                    return;
                }
                sibling.classList.remove("JS9ContextMenuVisible");
                sibling.querySelectorAll(".JS9ContextMenuVisible").forEach((node) => {
                    node.classList.remove("JS9ContextMenuVisible");
                });
            });
        };
        const menu = document.createElement("ul");
        menu.className = depth === 0 ?
            "JS9ContextMenuList JS9ContextMenuRoot" :
            "JS9ContextMenuList";
        Object.keys(items || {}).forEach((key) => {
            const item = items[key];
            let li;
            let label;
            let input;
            let marker;
            let childMenu;
            if( item === "------" ){
                li = document.createElement("li");
                li.className = "JS9ContextMenuSeparator";
                menu.appendChild(li);
                return;
            }
            li = document.createElement("li");
            li.className = "JS9ContextMenuItem";
            li.dataset.key = key;
            if( item && item.disabled ){
                li.classList.add("JS9ContextMenuDisabled");
            }
            if( item && item.type === "text" ){
                li.classList.add("JS9ContextMenuInput");
                label = document.createElement("label");
                if( item.name ){
                    marker = document.createElement("span");
                    if( item.isHtmlName || /<[^>]+>/.test(String(item.name)) ){
                        marker.innerHTML = item.name;
                    } else {
                        marker.textContent = item.name;
                    }
                    label.appendChild(marker);
                }
                input = document.createElement("input");
                input.type = "text";
                input.name = key;
                input.value = item.value || "";
                label.appendChild(input);
                li.appendChild(label);
                state.inputs[key] = input;
                if( item.events && typeof item.events.keyup === "function" ){
                    input.addEventListener("keyup", (evt) => {
                        evt.data = state.opt;
                        item.events.keyup(evt);
                    });
                }
                input.addEventListener("mousedown", (evt) => {
                    evt.stopPropagation();
                });
                input.addEventListener("click", (evt) => {
                    evt.stopPropagation();
                });
                menu.appendChild(li);
                return;
            }
            label = document.createElement("span");
            label.className = "JS9ContextMenuLabel";
            const labelText = document.createElement("span");
            labelText.className = "JS9ContextMenuText";
            if( item && item.icon ){
                marker = document.createElement("span");
                marker.className = "JS9ContextMenuCheck";
                marker.textContent = "\u2713";
                labelText.appendChild(marker);
            }
            marker = document.createElement("span");
            if( item && (item.isHtmlName || /<[^>]+>/.test(String(item.name || ""))) ){
                marker.innerHTML = item.name;
            } else {
                marker.textContent = item && item.name !== undefined ? item.name : key;
            }
            labelText.appendChild(marker);
            label.appendChild(labelText);
            li.appendChild(label);
            if( item && item.items ){
                const caret = document.createElement("span");
                li.classList.add("JS9ContextMenuSubmenu");
                caret.className = "JS9ContextMenuCaret";
                caret.textContent = "\u203a";
                label.appendChild(caret);
                childMenu = buildContextMenuTree(item.items, state, (depth || 0) + 1);
                li.appendChild(childMenu);
                li.addEventListener("mouseenter", () => {
                    closeSiblingSubmenus(menu, li);
                    li.classList.add("JS9ContextMenuVisible");
                });
                li.addEventListener("click", (evt) => {
                    if( item && item.disabled ){
                        evt.preventDefault();
                        evt.stopPropagation();
                        return;
                    }
                    evt.preventDefault();
                    evt.stopPropagation();
                    closeSiblingSubmenus(menu, li);
                    li.classList.add("JS9ContextMenuVisible");
                });
            } else {
                li.addEventListener("click", (evt) => {
                    if( item && item.disabled ){
                        evt.preventDefault();
                        evt.stopPropagation();
                        return;
                    }
                    if( typeof state.callback === "function" ){
                        state.callback(key, {
                            selector: state.selector,
                            key: key,
                            item: item,
                            trigger: state.opt.trigger,
                            menu: state.opt.menu
                        });
                    }
                    closeActiveContextMenu();
                });
            }
            li.addEventListener("mouseenter", () => {
                if( !li.classList.contains("JS9ContextMenuDisabled") ){
                    closeSiblingSubmenus(menu, li);
                    li.classList.add("JS9ContextMenuHover");
                }
            });
            li.addEventListener("mouseleave", () => {
                li.classList.remove("JS9ContextMenuHover");
            });
            menu.appendChild(li);
        });
        return menu;
    };

    const openContextMenu = function(config, trigger){
        let built;
        let menu;
        let opt;
        let entry;
        let state;
        if( !config || !trigger ){
            return;
        }
        closeActiveContextMenu();
        installContextMenuStyles();
        built = typeof config.build === "function" ? config.build() : config;
        if( !built || !built.items ){
            return;
        }
        opt = {
            selector: config.selector,
            trigger: wrap(trigger),
            triggerNode: trigger,
            menu: null,
            menuNode: null,
            inputs: {}
        };
        state = {
            selector: config.selector,
            callback: built.callback,
            inputs: opt.inputs,
            opt: opt
        };
        menu = buildContextMenuTree(built.items, state, 0);
        menu.dataset.contextMenuId = `js9-context-menu-${++contextMenuId}`;
        opt.menu = wrap(menu);
        opt.menuNode = menu;
        menu.classList.add("JS9ContextMenuList");
        document.body.appendChild(menu);
        menu.style.display = "block";
        menu.style.position = "absolute";
        entry = {
            config: config,
            built: built,
            menu: menu,
            opt: opt,
            events: built.events || config.events || {},
            onDocumentMouseDown: (evt) => {
                if( !menu.contains(evt.target) && evt.target !== trigger ){
                    closeActiveContextMenu();
                }
            },
            onDocumentKeyDown: (evt) => {
                if( evt.key === "Escape" ){
                    closeActiveContextMenu();
                }
            }
        };
        activeContextMenu = entry;
        opt.inputs = {};
        Array.from(menu.querySelectorAll("input[name], textarea[name], select[name]")).forEach((input) => {
            opt.inputs[input.name] = input;
        });
        if( typeof config.position === "function" ){
            config.position({
                menu: wrap(menu),
                trigger: wrap(trigger)
            });
        } else {
            positionElement(menu, {my: "left top", at: "left bottom", of: trigger});
        }
        if( entry.events && typeof entry.events.show === "function" ){
            entry.events.show(opt);
        }
        document.addEventListener("mousedown", entry.onDocumentMouseDown, true);
        document.addEventListener("keydown", entry.onDocumentKeyDown, true);
    };

    const openRegisteredContextMenu = function(target){
        let config;
        if( !target || !target.matches ){
            return;
        }
        contextMenuRegistry.forEach((value, selector) => {
            if( !config && target.matches(selector) ){
                config = value;
            }
        });
        if( config ){
            openContextMenu(config, target);
        }
    };

    class DomCollection extends Array {
        constructor(items){
            super(...(items || []));
            this.__js9Wrapped = true;
        }

        each(callback){
            this.forEach((item, index) => {
                callback.call(item, index, item);
            });
            return this;
        }

        map(callback){
            return new DomCollection(Array.from(this).map((item, index) => {
                return callback.call(item, index, item);
            }));
        }

        get(index){
            if( index === undefined ){
                return Array.from(this);
            }
            return this[index];
        }

        first(){
            return new DomCollection(this.length ? [this[0]] : []);
        }

        addClass(name){
            const classes = String(name || "").split(/\s+/).filter(Boolean);
            return this.each((index, item) => {
                if( item.classList ){
                    item.classList.add(...classes);
                }
            });
        }

        removeClass(name){
            const classes = String(name || "").split(/\s+/).filter(Boolean);
            return this.each((index, item) => {
                if( item.classList ){
                    item.classList.remove(...classes);
                }
            });
        }

        append(content){
            return this.each((index, item) => {
                if( item && item.appendChild ){
                    appendContent(item, index === 0 ? content : cloneContent(content));
                }
            });
        }

        appendTo(target){
            wrap(target).append(this);
            return this;
        }

        insertBefore(target){
            const ref = wrap(target)[0];
            if( !ref || !ref.parentNode ){
                return this;
            }
            this.forEach((item) => {
                ref.parentNode.insertBefore(item, ref);
            });
            return this;
        }

        wrap(html){
            return this.each((index, item) => {
                const wrapper = createNodesFromHtml(html)[0];
                if( wrapper && item.parentNode ){
                    item.parentNode.insertBefore(wrapper, item);
                    wrapper.appendChild(item);
                }
            });
        }

        parent(){
            return new DomCollection(unique(this.map((item) => item.parentElement).filter(Boolean)));
        }

        siblings(selector){
            let items = [];
            this.forEach((item) => {
                if( !item || !item.parentElement ){
                    return;
                }
                items = items.concat(Array.from(item.parentElement.children).filter((child) => {
                    if( child === item ){
                        return false;
                    }
                    return selector ? child.matches(selector) : true;
                }));
            });
            return new DomCollection(unique(items));
        }

        closest(selector){
            return new DomCollection(unique(this.map((item) => {
                return item && item.closest ? item.closest(selector) : null;
            }).filter(Boolean)));
        }

        find(selector){
            let items = [];
            this.forEach((item) => {
                if( item && item.querySelectorAll ){
                    items = items.concat(Array.from(item.querySelectorAll(selector)));
                }
            });
            return new DomCollection(unique(items));
        }

        attr(name, value){
            if( typeof name === "object" ){
                Object.keys(name).forEach((key) => {
                    this.attr(key, name[key]);
                });
                return this;
            }
            if( value === undefined ){
                if( !this[0] || !this[0].getAttribute ){
                    return undefined;
                }
                return this[0].getAttribute(name);
            }
            return this.each((index, item) => {
                if( !item || !item.setAttribute ){
                    return;
                }
                if( value === null || value === false ){
                    item.removeAttribute(name);
                } else {
                    item.setAttribute(name, String(value));
                }
            });
        }

        prop(name, value){
            if( value === undefined ){
                return this[0] ? this[0][name] : undefined;
            }
            return this.each((index, item) => {
                if( item ){
                    item[name] = value;
                }
            });
        }

        css(name, value){
            if( typeof name === "object" ){
                Object.keys(name).forEach((key) => {
                    this.css(key, name[key]);
                });
                return this;
            }
            if( value === undefined ){
                if( !this[0] || !this[0].style ){
                    return undefined;
                }
                return this[0].style[name] || window.getComputedStyle(this[0])[name];
            }
            return this.each((index, item) => {
                if( item && item.style ){
                    item.style[name] = normalizeCssValue(name, value);
                }
            });
        }

        html(value){
            if( value === undefined ){
                return this[0] ? this[0].innerHTML : undefined;
            }
            return this.each((index, item) => {
                if( item ){
                    item.innerHTML = String(value);
                }
            });
        }

        text(value){
            if( value === undefined ){
                return this[0] ? this[0].textContent : undefined;
            }
            return this.each((index, item) => {
                if( item ){
                    item.textContent = String(value);
                }
            });
        }

        val(value){
            if( value === undefined ){
                return this[0] ? this[0].value : undefined;
            }
            return this.each((index, item) => {
                if( item ){
                    item.value = value;
                }
            });
        }

        data(key, value){
            const item = this[0];
            if( value === undefined ){
                if( !item ){
                    return undefined;
                }
                const store = getStore(item);
                if( store[key] !== undefined ){
                    return store[key];
                }
                if( item.dataset ){
                    return item.dataset[toDatasetKey(key)];
                }
                return undefined;
            }
            return this.each((index, target) => {
                const store = getStore(target);
                store[key] = value;
                if( target.dataset && (typeof value === "string" || typeof value === "number" || typeof value === "boolean") ){
                    target.dataset[toDatasetKey(key)] = String(value);
                }
            });
        }

        on(events, dataOrHandler, handler){
            const callback = handler || dataOrHandler;
            const data = handler ? dataOrHandler : undefined;
            String(events || "").split(/\s+/).filter(Boolean).forEach((eventName) => {
                const baseEvent = eventName.split(".")[0];
                this.forEach((item) => {
                    if( !item || !item.addEventListener ){
                        return;
                    }
                    const wrapped = (evt) => {
                        if( data !== undefined ){
                            evt.data = data;
                        }
                        if( evt.detail !== undefined ){
                            return callback.call(item, evt, evt.detail);
                        }
                        return callback.call(item, evt);
                    };
                    getListeners(item).push({eventName, baseEvent, callback, wrapped});
                    item.addEventListener(baseEvent, wrapped);
                });
            });
            return this;
        }

        off(events){
            const names = String(events || "").split(/\s+/).filter(Boolean);
            return this.each((index, item) => {
                const listeners = getListeners(item);
                names.forEach((eventName) => {
                    const baseEvent = eventName.split(".")[0];
                    listeners.slice().forEach((entry, idx) => {
                        if( entry.eventName === eventName || entry.baseEvent === baseEvent ){
                            item.removeEventListener(entry.baseEvent, entry.wrapped);
                            listeners.splice(listeners.indexOf(entry), 1);
                        }
                    });
                });
            });
        }

        trigger(eventName, detail){
            const baseEvent = String(eventName || "").split(".")[0];
            return this.each((index, item) => {
                let evt;
                if( !item || !item.dispatchEvent ){
                    return;
                }
                try{
                    evt = new CustomEvent(baseEvent, {
                        bubbles: true,
                        cancelable: true,
                        detail: detail
                    });
                }
                catch(ignore){
                    evt = document.createEvent("CustomEvent");
                    evt.initCustomEvent(baseEvent, true, true, detail);
                }
                item.dispatchEvent(evt);
            });
        }

        focus(){
            return this.each((index, item) => {
                if( item && item.focus ){
                    item.focus();
                }
            });
        }

        blur(){
            return this.each((index, item) => {
                if( item && item.blur ){
                    item.blur();
                }
            });
        }

        click(handler){
            if( handler ){
                return this.on("click", handler);
            }
            return this.each((index, item) => {
                if( item && item.click ){
                    item.click();
                }
            });
        }

        hide(){
            return this.each((index, item) => {
                if( item && item.style ){
                    hiddenDisplayStore.set(item, item.style.display || "");
                    item.style.display = "none";
                }
            });
        }

        show(){
            return this.each((index, item) => {
                if( item && item.style ){
                    item.style.display = hiddenDisplayStore.get(item) || "";
                }
            });
        }

        remove(){
            return this.each((index, item) => {
                if( item && item.remove ){
                    item.remove();
                }
            });
        }

        width(value){
            if( value === undefined ){
                if( !this[0] ){
                    return 0;
                }
                if( isWindow(this[0]) ){
                    return window.innerWidth;
                }
                return this[0].getBoundingClientRect ? this[0].getBoundingClientRect().width : this[0].offsetWidth;
            }
            return this.css("width", value);
        }

        height(value){
            if( value === undefined ){
                if( !this[0] ){
                    return 0;
                }
                if( isWindow(this[0]) ){
                    return window.innerHeight;
                }
                return this[0].getBoundingClientRect ? this[0].getBoundingClientRect().height : this[0].offsetHeight;
            }
            return this.css("height", value);
        }

        offset(){
            if( !this[0] || !this[0].getBoundingClientRect ){
                return {left: 0, top: 0};
            }
            const rect = this[0].getBoundingClientRect();
            return {
                left: rect.left + window.pageXOffset,
                top: rect.top + window.pageYOffset
            };
        }

        position(options){
            if( !options ){
                if( !this[0] || !this[0].offsetParent ){
                    return {left: 0, top: 0};
                }
                return {
                    left: this[0].offsetLeft,
                    top: this[0].offsetTop
                };
            }
            return this.each((index, item) => {
                positionElement(item, options);
            });
        }

        is(selector){
            if( !this[0] ){
                return false;
            }
            if( selector === ":visible" ){
                const style = window.getComputedStyle(this[0]);
                return style.display !== "none" &&
                    style.visibility !== "hidden" &&
                    this[0].getClientRects().length > 0;
            }
            if( selector instanceof DomCollection ){
                return selector.includes(this[0]);
            }
            if( isNode(selector) ){
                return this[0] === selector;
            }
            return this[0].matches ? this[0].matches(selector) : false;
        }

        not(other){
            const excluded = new Set(toArray(other));
            return new DomCollection(this.filter((item) => !excluded.has(item)));
        }

        serializeArray(){
            const form = this[0];
            const out = [];
            if( !(form instanceof HTMLFormElement) ){
                return out;
            }
            Array.from(form.elements).forEach((element) => {
                if( !element.name || element.disabled ){
                    return;
                }
                if( (element.type === "checkbox" || element.type === "radio") && !element.checked ){
                    return;
                }
                out.push({name: element.name, value: element.value});
            });
            return out;
        }

        animate(props){
            const top = props && props.scrollTop;
            const left = props && props.scrollLeft;
            if( top !== undefined || left !== undefined ){
                window.scrollTo(left !== undefined ? left : window.pageXOffset,
                                top !== undefined ? top : window.pageYOffset);
            }
            return this;
        }

    }

    const cloneContent = function(content){
        if( content instanceof DomCollection ){
            return new DomCollection(content.map((item) => {
                return item && item.cloneNode ? item.cloneNode(true) : item;
            }));
        }
        if( isNode(content) ){
            return content.cloneNode(true);
        }
        if( Array.isArray(content) ){
            return content.map((item) => item && item.cloneNode ? item.cloneNode(true) : item);
        }
        return content;
    };

    const wrap = function(selector, attrs){
        let items;
        if( typeof selector === "string" && isHtml(selector) ){
            items = createNodesFromHtml(selector, attrs);
        } else if( typeof selector === "string" ){
            items = queryAll(selector, document);
        } else if( attrs && isNode(selector) ){
            items = [selector];
        } else {
            items = toArray(selector);
        }
        return new DomCollection(items);
    };

    const registerContextMenu = function(config){
        if( config && config.selector ){
            contextMenuRegistry.set(config.selector, config);
        }
        return config;
    };

    const plot = function(divjq, series, options){
        const axes = {
            xaxis: {options: (options && options.xaxis) || {}},
            yaxis: {options: (options && options.yaxis) || {}}
        };
        return {
            data: series || [],
            options: options || {},
            getAxes(){
                return axes;
            },
            setupGrid: noop,
            draw: noop,
            pointOffset(pos){
                return {left: pos.x, top: pos.y};
            }
        };
    };

    if( typeof globalThis !== "undefined" ){
        globalThis.JS9Dom = {
            wrap(value){
                return wrap(value);
            },
            plot(){
                return plot.apply(null, arguments);
            },
            openRegisteredContextMenu,
            registerContextMenu(config){
                return registerContextMenu(config);
            },
            getContextMenuValues,
            setContextMenuValues
        };
    }
}());
