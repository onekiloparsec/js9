// @ts-nocheck
/* JS9-owned browser compatibility shims replacing legacy vendor helpers. */

"use strict";

(function(){
    const resolveNode = function(value){
        if( !value ){
            return null;
        }
        if( value.nodeType ){
            return value;
        }
        if( value[0] && value[0].nodeType ){
            return value[0];
        }
        return null;
    };

    const saveAs = function(blob, pathname){
        const name = pathname || "download";
        const href = typeof blob === "string" ? blob : URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = href;
        link.download = name;
        link.rel = "noopener";
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        if( typeof blob !== "string" ){
            setTimeout(() => URL.revokeObjectURL(href), 1000);
        }
    };

    class ResizeSensor {
        constructor(element, callback){
            this.element = resolveNode(element);
            this.callback = typeof callback === "function" ? callback : function(){ return; };
            this._lastWidth = this.element ? this.element.offsetWidth : 0;
            this._lastHeight = this.element ? this.element.offsetHeight : 0;
            this._observer = null;
            this._listener = null;
            if( !this.element ){
                return;
            }
            if( typeof ResizeObserver !== "undefined" ){
                this._observer = new ResizeObserver(() => {
                    this.callback();
                });
                this._observer.observe(this.element);
            } else {
                this._listener = () => {
                    const width = this.element.offsetWidth;
                    const height = this.element.offsetHeight;
                    if( width !== this._lastWidth || height !== this._lastHeight ){
                        this._lastWidth = width;
                        this._lastHeight = height;
                        this.callback();
                    }
                };
                window.addEventListener("resize", this._listener);
            }
        }

        detach(){
            if( this._observer ){
                this._observer.disconnect();
                this._observer = null;
            }
            if( this._listener ){
                window.removeEventListener("resize", this._listener);
                this._listener = null;
            }
        }

        static detach(element, instance){
            if( instance && typeof instance.detach === "function" ){
                instance.detach();
            } else if( element && typeof element.detach === "function" ){
                element.detach();
            }
        }
    }

    class Spinner {
        constructor(opts){
            this.opts = opts || {};
            this.node = null;
        }

        spin(target){
            const el = resolveNode(target) || document.body;
            this.stop();
            this.node = document.createElement("div");
            this.node.className = "JS9OwnedSpinner";
            this.node.innerHTML = "<div class='JS9OwnedSpinnerRing'></div>";
            Object.assign(this.node.style, {
                position: el === document.body ? "fixed" : "absolute",
                top: "50%",
                left: "50%",
                width: "32px",
                height: "32px",
                marginLeft: "-16px",
                marginTop: "-16px",
                zIndex: "9999",
                pointerEvents: "none"
            });
            const ring = this.node.firstChild;
            Object.assign(ring.style, {
                boxSizing: "border-box",
                display: "block",
                width: "32px",
                height: "32px",
                border: "4px solid transparent",
                borderTopColor: this.opts.color || "#000000",
                borderRightColor: this.opts.color || "#000000",
                borderRadius: "50%",
                opacity: String(this.opts.opacity || 0.4),
                animation: "js9-owned-spin 0.8s linear infinite"
            });
            if( !document.getElementById("js9-owned-spinner-style") ){
                const style = document.createElement("style");
                style.id = "js9-owned-spinner-style";
                style.textContent = "@keyframes js9-owned-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}";
                document.head.appendChild(style);
            }
            if( el !== document.body && getComputedStyle(el).position === "static" ){
                el.style.position = "relative";
            }
            el.appendChild(this.node);
            return this;
        }

        stop(){
            if( this.node && this.node.parentNode ){
                this.node.parentNode.removeChild(this.node);
            }
            this.node = null;
            return this;
        }
    }

    class ddtabcontent {
        constructor(id){
            this.id = id;
            this.persist = false;
            this.selectedClassTarget = "link";
        }

        setpersist(value){
            this.persist = !!value;
        }

        setselectedClassTarget(value){
            this.selectedClassTarget = value || "link";
        }

        init(){
            const container = document.getElementById(this.id);
            const links = container ? Array.from(container.querySelectorAll("a[rel]")) : [];
            const showPane = (targetId) => {
                links.forEach((link) => {
                    const paneId = link.getAttribute("rel");
                    const pane = paneId ? document.getElementById(paneId) : null;
                    const active = paneId === targetId;
                    if( pane ){
                        pane.style.display = active ? "block" : "none";
                    }
                    if( this.selectedClassTarget === "link" ){
                        link.classList.toggle("selected", active);
                    } else if( link.parentElement ){
                        link.parentElement.classList.toggle("selected", active);
                    }
                });
            };
            links.forEach((link, index) => {
                link.addEventListener("click", (evt) => {
                    evt.preventDefault();
                    showPane(link.getAttribute("rel"));
                });
                if( index === 0 ){
                    showPane(link.getAttribute("rel"));
                }
            });
        }
    }

    const parseWindowOptions = function(text){
        const result = {};
        String(text || "").split(",").forEach((entry) => {
            const parts = entry.split("=");
            const key = (parts[0] || "").trim().toLowerCase();
            const value = (parts[1] || "").trim();
            if( key ){
                result[key] = value;
            }
        });
        return result;
    };

    const makeDhtmlWindow = function(){
        const api = {
            imagefiles: [],
            ajaxbustcache: true,
            ajaxloadinghtml: "<b>Loading Page. Please wait...</b>",
            minimizeorder: 0,
            zIndexvalue: 100,
            tobjects: [],
            lastactivet: null,
            distancex: 0,
            distancey: 0,
            init(id){
                let win = document.getElementById(id);
                let controls;
                let title;
                let content;
                let status;
                let resize;
                if( win ){
                    return win;
                }
                win = document.createElement("div");
                win.id = id;
                win.className = "dhtmlwindow";
                win.style.position = "absolute";
                win.style.display = "none";
                win.style.visibility = "visible";
                win.style.left = "40px";
                win.style.top = "40px";
                title = document.createElement("div");
                title.className = "drag-handle";
                title.innerHTML = "<div class='drag-title'></div>";
                controls = document.createElement("div");
                controls.className = "drag-controls";
                controls.innerHTML = "<button type='button' data-action='minimize' title='Minimize'>_</button><button type='button' data-action='close' title='Close'>&times;</button>";
                title.appendChild(controls);
                content = document.createElement("div");
                content.className = "drag-contentarea";
                status = document.createElement("div");
                status.className = "drag-statusarea";
                resize = document.createElement("div");
                resize.className = "drag-resizearea";
                status.appendChild(resize);
                win.appendChild(title);
                win.appendChild(content);
                win.appendChild(status);
                win.handle = title;
                win.controls = controls;
                win.contentarea = content;
                win.statusarea = status;
                win.resizearea = resize;
                win.onclose = function(){ return true; };
                win.state = "fullview";
                win.isClosed = false;
                this.installWindowBehavior(win);
                const holder = document.getElementById("dhtmlwindowholder") || document.body;
                holder.appendChild(win);
                this.tobjects.push(win);
                return win;
            },
            installWindowBehavior(win){
                let dragState = null;
                const stopPointer = () => {
                    dragState = null;
                    this.distancex = 0;
                    this.distancey = 0;
                    document.removeEventListener("pointermove", onPointerMove);
                    document.removeEventListener("pointerup", stopPointer);
                };
                const onPointerMove = (evt) => {
                    if( !dragState ){
                        return;
                    }
                    this.distancex = evt.clientX - dragState.startX;
                    this.distancey = evt.clientY - dragState.startY;
                    if( dragState.mode === "move" ){
                        win.style.left = `${Math.max(0, dragState.left + this.distancex)}px`;
                        win.style.top = `${Math.max(0, dragState.top + this.distancey)}px`;
                    } else {
                        win.style.width = `${Math.max(150, dragState.width + this.distancex)}px`;
                        win.contentarea.style.height = `${Math.max(20, dragState.height + this.distancey)}px`;
                    }
                };
                const startPointer = (mode) => (evt) => {
                    if( mode === "resize" && win.resizeBool === false ){
                        return;
                    }
                    this.setfocus(win);
                    dragState = {
                        mode,
                        startX: evt.clientX,
                        startY: evt.clientY,
                        left: parseInt(win.style.left || "0", 10) || 0,
                        top: parseInt(win.style.top || "0", 10) || 0,
                        width: win.offsetWidth,
                        height: win.contentarea.offsetHeight
                    };
                    document.addEventListener("pointermove", onPointerMove);
                    document.addEventListener("pointerup", stopPointer);
                };
                win.handle.addEventListener("pointerdown", startPointer("move"));
                win.resizearea.addEventListener("pointerdown", startPointer("resize"));
                win.controls.addEventListener("click", (evt) => {
                    const action = evt.target && evt.target.dataset ? evt.target.dataset.action : "";
                    if( action === "close" ){
                        this.close(win);
                    } else if( action === "minimize" ){
                        if( win.state === "minimized" ){
                            this.restore(win);
                        } else {
                            this.minimize(win);
                        }
                    }
                });
                win.show = () => this.show(win);
                win.hide = () => this.hide(win);
                win.close = () => this.close(win);
                win.setSize = (w, h) => this.setSize(win, w, h);
                win.moveTo = (x, y) => this.moveTo(win, x, y);
                win.isResize = (flag) => this.isResize(win, flag);
                win.isScrolling = (flag) => this.isScrolling(win, flag);
                win.load = (type, source, title) => this.load(win, type, source, title);
            },
            setfocus(win){
                this.zIndexvalue += 1;
                win.style.zIndex = `${this.zIndexvalue}`;
                this.lastactivet = win;
            },
            setSize(win, width, height){
                if( width ){
                    win.style.width = `${parseInt(width, 10)}px`;
                }
                if( height ){
                    win.contentarea.style.height = `${Math.max(20, parseInt(height, 10) - win.handle.offsetHeight - win.statusarea.offsetHeight)}px`;
                }
            },
            moveTo(win, x, y){
                const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1024;
                const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 768;
                let left = x;
                let top = y;
                if( x === "middle" || x === "center" ){
                    left = Math.max(0, Math.round((viewportWidth - win.offsetWidth) / 2));
                }
                if( y === "middle" || y === "center" ){
                    top = Math.max(0, Math.round((viewportHeight - win.offsetHeight) / 2));
                }
                win.style.left = `${parseInt(left, 10) || 0}px`;
                win.style.top = `${parseInt(top, 10) || 0}px`;
            },
            isResize(win, flag){
                win.resizeBool = !!parseInt(flag, 10) || flag === true;
                win.statusarea.style.display = win.resizeBool ? "block" : "none";
            },
            isScrolling(win, flag){
                win.contentarea.style.overflow = (!!parseInt(flag, 10) || flag === true) ? "auto" : "hidden";
            },
            load(win, type, source, title){
                let node;
                if( title ){
                    const titleNode = win.handle.querySelector(".drag-title");
                    if( titleNode ){
                        titleNode.textContent = title;
                    }
                }
                switch(type){
                case "inline":
                    win.contentarea.innerHTML = source || "";
                    break;
                case "div":
                    node = typeof source === "string" ? document.getElementById(source) : resolveNode(source);
                    if( node ){
                        win.contentarea.innerHTML = "";
                        win.contentarea.appendChild(node);
                        node.style.display = "block";
                    }
                    break;
                case "iframe":
                    win.contentarea.innerHTML = `<iframe src="${source}" style="width:100%;height:100%;border:0"></iframe>`;
                    break;
                case "ajax":
                default:
                    if( typeof source === "string" && /^(https?:|\/)/.test(source) ){
                        win.contentarea.innerHTML = this.ajaxloadinghtml;
                        fetch(source).then((response) => response.text()).then((html) => {
                            win.contentarea.innerHTML = html;
                        }).catch(() => {
                            win.contentarea.innerHTML = "";
                        });
                    } else {
                        win.contentarea.innerHTML = source || "";
                    }
                    break;
                }
                win.contentarea.datatype = type;
            },
            minimize(win){
                win.lastLeft = win.style.left;
                win.lastTop = win.style.top;
                win.lastWidth = win.style.width;
                win.lastHeight = win.contentarea.style.height;
                win.state = "minimized";
                win.contentarea.style.display = "none";
                win.statusarea.style.display = "none";
                win.style.width = "200px";
            },
            restore(win){
                win.state = "fullview";
                win.contentarea.style.display = "block";
                win.statusarea.style.display = win.resizeBool ? "block" : "none";
                if( win.lastLeft ){ win.style.left = win.lastLeft; }
                if( win.lastTop ){ win.style.top = win.lastTop; }
                if( win.lastWidth ){ win.style.width = win.lastWidth; }
                if( win.lastHeight ){ win.contentarea.style.height = win.lastHeight; }
            },
            close(win){
                const shouldClose = typeof win.onclose === "function" ? win.onclose() : true;
                if( shouldClose !== false ){
                    win.style.display = "none";
                    win.isClosed = true;
                }
                return shouldClose;
            },
            show(win){
                win.style.display = "block";
                win.isClosed = false;
                this.setfocus(win);
            },
            hide(win){
                win.style.display = "none";
            },
            open(id, type, source, title, options){
                const win = this.init(id);
                const parsed = parseWindowOptions(options);
                this.setfocus(win);
                this.isResize(win, parsed.resize || 0);
                this.isScrolling(win, parsed.scrolling || 0);
                this.setSize(win, parsed.width || 400, parsed.height || 300);
                this.show(win);
                this.moveTo(win, parsed.center ? "middle" : (parsed.left || 40), parsed.center ? "middle" : (parsed.top || 40));
                this.load(win, type, source, title);
                return win;
            }
        };
        return api;
    };

    globalThis.saveAs = saveAs;
    globalThis.ResizeSensor = ResizeSensor;
    globalThis.Spinner = Spinner;
    globalThis.ddtabcontent = ddtabcontent;
    globalThis.dhtmlwindow = makeDhtmlWindow();
}());
