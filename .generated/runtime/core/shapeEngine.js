/* JS9 browser viewer core. Attribution is centralized in README.md. */
"use strict";
function JS9InstallShapeEngine(JS9) {
    const shapeEngine = (JS9.ShapeEngine = JS9.ShapeEngine || {
        engines: {},
        active: null,
        defaults: {
            getDevicePixelRatio: () => {
                if (typeof window !== "undefined") {
                    return window.devicePixelRatio || 1;
                }
                return 1;
            },
            getDefaultOptions: () => {
                return null;
            },
            applyDefaults: () => { },
            createActiveSelection: (objects) => {
                if (Array.isArray(objects) && objects.length) {
                    return objects[0];
                }
                return null;
            },
            updateChildren: () => { }
        },
        register(name, engine) {
            if (!name || (typeof name !== "string")) {
                throw new Error("shape engine name must be a non-empty string");
            }
            if (!engine || (typeof engine.init !== "function")) {
                throw new Error(`shape engine '${name}' requires an init() function`);
            }
            if (engine.installDisplayApi &&
                typeof engine.installDisplayApi !== "function") {
                throw new Error(`shape engine '${name}' has an invalid installDisplayApi()`);
            }
            this.engines[name] = engine;
            return engine;
        },
        use(name) {
            const engine = this.engines[name];
            if (!engine) {
                return null;
            }
            if (this.active === name) {
                return engine;
            }
            if (typeof engine.installDisplayApi === "function" &&
                typeof globalThis !== "undefined") {
                engine.installDisplayApi(globalThis.JS9 || null);
            }
            engine.init();
            this.active = name;
            return engine;
        },
        get() {
            return this.engines[this.active || ""] || null;
        },
        getMethod(name) {
            const engine = this.get();
            const fallback = this.defaults[name];
            if (engine && typeof engine[name] === "function") {
                return engine[name].bind(engine);
            }
            if (typeof fallback === "function") {
                return fallback;
            }
            return null;
        },
        applyDefaults(defaults) {
            const handler = this.getMethod("applyDefaults");
            if (handler) {
                handler(defaults || {});
            }
        },
        getDefaultOptions() {
            const handler = this.getMethod("getDefaultOptions");
            if (handler) {
                return handler();
            }
            return null;
        },
        getDevicePixelRatio() {
            const handler = this.getMethod("getDevicePixelRatio");
            if (handler) {
                return handler();
            }
            return 1;
        },
        createActiveSelection(objects, canvas) {
            const handler = this.getMethod("createActiveSelection");
            if (handler) {
                return handler(objects || [], canvas || null);
            }
            return null;
        },
        updateChildren(dlayer, shape, type) {
            const handler = this.getMethod("updateChildren");
            if (handler) {
                handler(dlayer, shape, type);
            }
        }
    });
    shapeEngine.engines = shapeEngine.engines || {};
    shapeEngine.active = shapeEngine.active || null;
    shapeEngine.defaults = shapeEngine.defaults || {
        getDevicePixelRatio: () => {
            if (typeof window !== "undefined") {
                return window.devicePixelRatio || 1;
            }
            return 1;
        },
        getDefaultOptions: () => {
            return null;
        },
        applyDefaults: () => { },
        createActiveSelection: (objects) => {
            if (Array.isArray(objects) && objects.length) {
                return objects[0];
            }
            return null;
        },
        updateChildren: () => { }
    };
}
if (typeof globalThis !== "undefined") {
    globalThis.JS9InstallShapeEngine = JS9InstallShapeEngine;
}
