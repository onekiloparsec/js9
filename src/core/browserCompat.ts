/* JS9-owned browser compatibility shims replacing legacy vendor helpers. */

"use strict";

const resolveNode = function(value: unknown): HTMLElement | null {
    if( !value ){
        return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = value as any;
    if( node.nodeType ){
        return node as HTMLElement;
    }
    if( node[0] && node[0].nodeType ){
        return node[0] as HTMLElement;
    }
    return null;
};

export const saveAs = function(blob: Blob | string, pathname?: string): void {
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

export class ResizeSensor {
    element: HTMLElement | null;
    callback: () => void;
    _lastWidth: number;
    _lastHeight: number;
    _observer: ResizeObserver | null;
    _listener: (() => void) | null;

    constructor(element: unknown, callback: unknown){
        this.element = resolveNode(element);
        this.callback = typeof callback === "function" ? callback as () => void : function(){ return; };
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
            const el = this.element;
            this._listener = () => {
                const width = el.offsetWidth;
                const height = el.offsetHeight;
                if( width !== this._lastWidth || height !== this._lastHeight ){
                    this._lastWidth = width;
                    this._lastHeight = height;
                    this.callback();
                }
            };
            window.addEventListener("resize", this._listener);
        }
    }

    detach(): void {
        if( this._observer ){
            this._observer.disconnect();
            this._observer = null;
        }
        if( this._listener ){
            window.removeEventListener("resize", this._listener);
            this._listener = null;
        }
    }

    static detach(element: unknown, instance?: unknown): void {
        const inst = instance as { detach?: () => void } | undefined;
        const elem = element as { detach?: () => void } | undefined;
        if( inst && typeof inst.detach === "function" ){
            inst.detach();
        } else if( elem && typeof elem.detach === "function" ){
            elem.detach();
        }
    }
}

export class Spinner {
    opts: Record<string, unknown>;
    node: HTMLElement | null;

    constructor(opts?: Record<string, unknown>){
        this.opts = opts || {};
        this.node = null;
    }

    spin(target: unknown): this {
        const el = (resolveNode(target) || document.body) as HTMLElement;
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
        const ring = this.node.firstChild as HTMLElement;
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

    stop(): this {
        if( this.node && this.node.parentNode ){
            this.node.parentNode.removeChild(this.node);
        }
        this.node = null;
        return this;
    }
}

export class ddtabcontent {
    id: string;
    persist: boolean;
    selectedClassTarget: string;

    constructor(id: string){
        this.id = id;
        this.persist = false;
        this.selectedClassTarget = "link";
    }

    setpersist(value: unknown): void {
        this.persist = !!value;
    }

    setselectedClassTarget(value: string | undefined): void {
        this.selectedClassTarget = value || "link";
    }

    init(): void {
        const container = document.getElementById(this.id);
        const links = container ? Array.from(container.querySelectorAll("a[rel]")) : [];
        const showPane = (targetId: string | null): void => {
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

const parseWindowOptions = function(text: unknown): Record<string, string> {
    const result: Record<string, string> = {};
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const makeDhtmlWindow = function(): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api: Record<string, any> = {
        imagefiles: [],
        ajaxbustcache: true,
        ajaxloadinghtml: "<b>Loading Page. Please wait...</b>",
        minimizeorder: 0,
        zIndexvalue: 100,
        tobjects: [],
        lastactivet: null,
        distancex: 0,
        distancey: 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        init(id: string): any {
            let win = document.getElementById(id);
            let controls: HTMLElement;
            let title: HTMLElement;
            let content: HTMLElement;
            let status: HTMLElement;
            let resize: HTMLElement;
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const w = win as any;
            w.handle = title;
            w.controls = controls;
            w.contentarea = content;
            w.statusarea = status;
            w.resizearea = resize;
            w.onclose = function(){ return true; };
            w.state = "fullview";
            w.isClosed = false;
            this.installWindowBehavior(w);
            const holder = document.getElementById("dhtmlwindowholder") || document.body;
            holder.appendChild(w);
            this.tobjects.push(w);
            return w;
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        installWindowBehavior(win: any): void {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let dragState: any = null;
            const stopPointer = (): void => {
                dragState = null;
                this.distancex = 0;
                this.distancey = 0;
                document.removeEventListener("pointermove", onPointerMove);
                document.removeEventListener("pointerup", stopPointer);
            };
            const onPointerMove = (evt: PointerEvent): void => {
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
            const startPointer = (mode: string) => (evt: PointerEvent): void => {
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
            win.controls.addEventListener("click", (evt: MouseEvent) => {
                const action = (evt.target as HTMLElement | null)?.dataset?.action ?? "";
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
            win.setSize = (w: number | string, h: number | string) => this.setSize(win, w, h);
            win.moveTo = (x: number | string, y: number | string) => this.moveTo(win, x, y);
            win.isResize = (flag: unknown) => this.isResize(win, flag);
            win.isScrolling = (flag: unknown) => this.isScrolling(win, flag);
            win.load = (type: string, source: unknown, title: string) => this.load(win, type, source, title);
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setfocus(win: any): void {
            this.zIndexvalue += 1;
            win.style.zIndex = `${this.zIndexvalue}`;
            this.lastactivet = win;
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setSize(win: any, width: number | string, height: number | string): void {
            if( width ){
                win.style.width = `${parseInt(String(width), 10)}px`;
            }
            if( height ){
                win.contentarea.style.height = `${Math.max(20, parseInt(String(height), 10) - win.handle.offsetHeight - win.statusarea.offsetHeight)}px`;
            }
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        moveTo(win: any, x: number | string, y: number | string): void {
            const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1024;
            const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 768;
            let left: number | string = x;
            let top: number | string = y;
            if( x === "middle" || x === "center" ){
                left = Math.max(0, Math.round((viewportWidth - win.offsetWidth) / 2));
            }
            if( y === "middle" || y === "center" ){
                top = Math.max(0, Math.round((viewportHeight - win.offsetHeight) / 2));
            }
            win.style.left = `${parseInt(String(left), 10) || 0}px`;
            win.style.top = `${parseInt(String(top), 10) || 0}px`;
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        isResize(win: any, flag: unknown): void {
            win.resizeBool = !!parseInt(String(flag), 10) || flag === true;
            win.statusarea.style.display = win.resizeBool ? "block" : "none";
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        isScrolling(win: any, flag: unknown): void {
            win.contentarea.style.overflow = (!!parseInt(String(flag), 10) || flag === true) ? "auto" : "hidden";
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        load(win: any, type: string, source: unknown, title?: string): void {
            let node: HTMLElement | null;
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        minimize(win: any): void {
            win.lastLeft = win.style.left;
            win.lastTop = win.style.top;
            win.lastWidth = win.style.width;
            win.lastHeight = win.contentarea.style.height;
            win.state = "minimized";
            win.contentarea.style.display = "none";
            win.statusarea.style.display = "none";
            win.style.width = "200px";
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        restore(win: any): void {
            win.state = "fullview";
            win.contentarea.style.display = "block";
            win.statusarea.style.display = win.resizeBool ? "block" : "none";
            if( win.lastLeft ){ win.style.left = win.lastLeft; }
            if( win.lastTop ){ win.style.top = win.lastTop; }
            if( win.lastWidth ){ win.style.width = win.lastWidth; }
            if( win.lastHeight ){ win.contentarea.style.height = win.lastHeight; }
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        close(win: any): boolean {
            const shouldClose = typeof win.onclose === "function" ? win.onclose() : true;
            if( shouldClose !== false ){
                win.style.display = "none";
                win.isClosed = true;
            }
            return shouldClose;
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        show(win: any): void {
            win.style.display = "block";
            win.isClosed = false;
            this.setfocus(win);
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        hide(win: any): void {
            win.style.display = "none";
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        open(id: string, type: string, source: unknown, title: string, options: unknown): any {
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

export const dhtmlwindow = makeDhtmlWindow();
