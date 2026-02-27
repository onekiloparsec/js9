/* JS9 browser viewer core. Attribution is centralized in README.md. */

"use strict";

function JS9InstallShapeEngine(JS9){
    JS9.ShapeEngine = JS9.ShapeEngine || {};
    JS9.ShapeEngine.engines = JS9.ShapeEngine.engines || {};
    JS9.ShapeEngine.active = JS9.ShapeEngine.active || null;

    JS9.ShapeEngine.register = function(name, engine){
        if( !name || (typeof name !== "string") ){
            throw new Error("shape engine name must be a non-empty string");
        }
        if( !engine || (typeof engine.init !== "function") ){
            throw new Error(`shape engine '${name}' requires an init() function`);
        }
        this.engines[name] = engine;
        return engine;
    };

    JS9.ShapeEngine.use = function(name){
        const engine = this.engines[name];
        if( !engine ){
            return null;
        }
        if( this.active === name ){
            return engine;
        }
        engine.init();
        this.active = name;
        return engine;
    };

    JS9.ShapeEngine.get = function(){
        return this.engines[this.active] || null;
    };
}

if( typeof globalThis !== "undefined" ){
    globalThis.JS9InstallShapeEngine = JS9InstallShapeEngine;
}
