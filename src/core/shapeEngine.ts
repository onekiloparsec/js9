/* JS9 browser viewer core. Attribution is centralized in README.md. */

"use strict";

interface JS9ShapeEngineDefaults {
    getDevicePixelRatio: () => number;
    getDefaultOptions: () => Record<string, unknown> | null;
    applyDefaults: (defaults: Record<string, unknown>) => void;
    createActiveSelection: (objects: unknown[], canvas: unknown) => unknown;
    buildSelection: (objects: unknown[], canvas: unknown) => unknown;
    activateSelection: (canvas: unknown, selection: unknown) => unknown;
    clearSelection: (canvas: unknown) => unknown;
    groupSelection: (canvas: unknown, objects: unknown[]) => unknown;
    updateChildren: (dlayer: unknown, shape: unknown, type: string) => void;
}

interface JS9ShapeEngineMethodHost {
    ShapeEngine?: JS9ShapeEngineRegistry;
}

function JS9InstallShapeEngine(JS9: JS9ShapeEngineMethodHost): void{
    const shapeEngine = (JS9.ShapeEngine = JS9.ShapeEngine || {
        engines: {},
        active: null,
        defaults: {
            getDevicePixelRatio: () => {
                if( typeof window !== "undefined" ){
                    return window.devicePixelRatio || 1;
                }
                return 1;
            },
            getDefaultOptions: () => {
                return null;
            },
            applyDefaults: () => {},
            createActiveSelection: (objects: unknown[]) => {
                if( Array.isArray(objects) && objects.length ){
                    return objects[0];
                }
                return null;
            },
            buildSelection: (objects: unknown[], canvas: unknown) => {
                if( !Array.isArray(objects) || !objects.length ){
                    return null;
                }
                if( objects.length === 1 ){
                    return objects[0];
                }
                return shapeEngine.createActiveSelection(objects, canvas);
            },
            activateSelection: (canvas: any, selection: any) => {
                if( !canvas || !selection ){
                    return null;
                }
                if( typeof canvas.setActiveObject === "function" ){
                    canvas.setActiveObject(selection);
                }
                if( typeof canvas.renderAll === "function" ){
                    canvas.renderAll();
                }
                return selection;
            },
            clearSelection: (canvas: any) => {
                if( !canvas ){
                    return null;
                }
                if( typeof canvas.getActiveObject === "function" &&
                    canvas.getActiveObject() &&
                    typeof canvas.discardActiveObject === "function" ){
                    canvas.discardActiveObject();
                }
                if( typeof canvas.renderAll === "function" ){
                    canvas.renderAll();
                }
                return canvas;
            },
            groupSelection: (canvas: any, objects: unknown[]) => {
                const selection = shapeEngine.buildSelection(objects, canvas) as any;
                if( !canvas || !selection ){
                    return null;
                }
                if( typeof canvas.setActiveObject === "function" ){
                    canvas.setActiveObject(selection);
                }
                if( typeof canvas.getActiveObject === "function" &&
                    canvas.getActiveObject() &&
                    typeof canvas.getActiveObject().toGroup === "function" ){
                    canvas.getActiveObject().toGroup();
                    return canvas.getActiveObject();
                }
                return selection;
            },
            updateChildren: () => {}
        } as JS9ShapeEngineDefaults,
        register(name: string, engine: JS9ShapeEngine){
            if( !name || (typeof name !== "string") ){
                throw new Error("shape engine name must be a non-empty string");
            }
            if( !engine || (typeof engine.init !== "function") ){
                throw new Error(`shape engine '${name}' requires an init() function`);
            }
            if( engine.installDisplayApi &&
                typeof engine.installDisplayApi !== "function" ){
                throw new Error(`shape engine '${name}' has an invalid installDisplayApi()`);
            }
            this.engines[name] = engine;
            return engine;
        },
        use(name: string){
            const engine = this.engines[name];
            if( !engine ){
                return null;
            }
            if( this.active === name ){
                return engine;
            }
            if( typeof engine.installDisplayApi === "function" &&
                typeof globalThis !== "undefined" ){
                engine.installDisplayApi(
                    (globalThis as typeof globalThis & { JS9?: unknown }).JS9 || null
                );
            }
            engine.init();
            this.active = name;
            return engine;
        },
        get(){
            return this.engines[this.active || ""] || null;
        },
        getMethod(name: keyof JS9ShapeEngineDefaults){
            const engine = this.get();
            const fallback = this.defaults[name];
            if( engine && typeof engine[name] === "function" ){
                return engine[name]!.bind(engine);
            }
            if( typeof fallback === "function" ){
                return fallback;
            }
            return null;
        },
        applyDefaults(defaults: Record<string, unknown>){
            const handler = this.getMethod("applyDefaults");
            if( handler ){
                handler(defaults || {});
            }
        },
        getDefaultOptions(){
            const handler = this.getMethod("getDefaultOptions");
            if( handler ){
                return handler();
            }
            return null;
        },
        getDevicePixelRatio(){
            const handler = this.getMethod("getDevicePixelRatio");
            if( handler ){
                return handler();
            }
            return 1;
        },
        createActiveSelection(objects: unknown[], canvas: unknown){
            const handler = this.getMethod("createActiveSelection");
            if( handler ){
                return handler(objects || [], canvas || null);
            }
            return null;
        },
        buildSelection(objects: unknown[], canvas: unknown){
            const handler = this.getMethod("buildSelection");
            if( handler ){
                return handler(objects || [], canvas || null);
            }
            return null;
        },
        activateSelection(canvas: unknown, selection: unknown){
            const handler = this.getMethod("activateSelection");
            if( handler ){
                return handler(canvas || null, selection || null);
            }
            return null;
        },
        clearSelection(canvas: unknown){
            const handler = this.getMethod("clearSelection");
            if( handler ){
                return handler(canvas || null);
            }
            return null;
        },
        groupSelection(canvas: unknown, objects: unknown[]){
            const handler = this.getMethod("groupSelection");
            if( handler ){
                return handler(canvas || null, objects || []);
            }
            return null;
        },
        updateChildren(dlayer: unknown, shape: unknown, type: string){
            const handler = this.getMethod("updateChildren");
            if( handler ){
                handler(dlayer, shape, type);
            }
        }
    });

    shapeEngine.engines = shapeEngine.engines || {};
    shapeEngine.active = shapeEngine.active || null;
    shapeEngine.defaults = shapeEngine.defaults || {
        getDevicePixelRatio: () => {
            if( typeof window !== "undefined" ){
                return window.devicePixelRatio || 1;
            }
            return 1;
        },
        getDefaultOptions: () => {
            return null;
        },
        applyDefaults: () => {},
        createActiveSelection: (objects: unknown[]) => {
            if( Array.isArray(objects) && objects.length ){
                return objects[0];
            }
            return null;
        },
        buildSelection: (objects: unknown[]) => {
            if( Array.isArray(objects) && objects.length ){
                return objects[0];
            }
            return null;
        },
        activateSelection: (_canvas: unknown, selection: unknown) => {
            return selection || null;
        },
        clearSelection: (canvas: unknown) => {
            return canvas || null;
        },
        groupSelection: (_canvas: unknown, objects: unknown[]) => {
            if( Array.isArray(objects) && objects.length ){
                return objects[0];
            }
            return null;
        },
        updateChildren: () => {}
    };
}

if( typeof globalThis !== "undefined" ){
    (globalThis as typeof globalThis & {
        JS9InstallShapeEngine?: typeof JS9InstallShapeEngine;
    }).JS9InstallShapeEngine = JS9InstallShapeEngine;
}
