// @ts-nocheck
/* JS9-owned tinycolor-compatible subset for browser runtime. */

"use strict";

(function(){
    const clamp = function(value, min, max){
        return Math.min(max, Math.max(min, value));
    };

    const hue2rgb = function(p, q, t){
        if( t < 0 ){ t += 1; }
        if( t > 1 ){ t -= 1; }
        if( t < 1/6 ){ return p + (q - p) * 6 * t; }
        if( t < 1/2 ){ return q; }
        if( t < 2/3 ){ return p + (q - p) * (2/3 - t) * 6; }
        return p;
    };

    const rgbToHsl = function(r, g, b){
        let h, s;
        const rn = r / 255;
        const gn = g / 255;
        const bn = b / 255;
        const max = Math.max(rn, gn, bn);
        const min = Math.min(rn, gn, bn);
        const l = (max + min) / 2;
        const d = max - min;
        if( d === 0 ){
            h = 0;
            s = 0;
        } else {
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch(max){
            case rn:
                h = ((gn - bn) / d) + (gn < bn ? 6 : 0);
                break;
            case gn:
                h = ((bn - rn) / d) + 2;
                break;
            default:
                h = ((rn - gn) / d) + 4;
                break;
            }
            h /= 6;
        }
        return {h: h * 360, s, l};
    };

    const hslToRgb = function(h, s, l){
        let r, g, b;
        const hn = ((((h % 360) + 360) % 360) / 360);
        if( s === 0 ){
            r = g = b = l;
        } else {
            const q = l < 0.5 ? l * (1 + s) : l + s - (l * s);
            const p = (2 * l) - q;
            r = hue2rgb(p, q, hn + 1/3);
            g = hue2rgb(p, q, hn);
            b = hue2rgb(p, q, hn - 1/3);
        }
        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    };

    const parseHex = function(text){
        const clean = text.replace(/^#/, "").trim();
        if( /^[0-9a-f]{3}$/i.test(clean) ){
            return {
                r: parseInt(clean.charAt(0) + clean.charAt(0), 16),
                g: parseInt(clean.charAt(1) + clean.charAt(1), 16),
                b: parseInt(clean.charAt(2) + clean.charAt(2), 16),
                a: 1
            };
        }
        if( /^[0-9a-f]{6}$/i.test(clean) ){
            return {
                r: parseInt(clean.slice(0, 2), 16),
                g: parseInt(clean.slice(2, 4), 16),
                b: parseInt(clean.slice(4, 6), 16),
                a: 1
            };
        }
        return null;
    };

    const parseRgb = function(text){
        const match = text.match(/rgba?\(([^)]+)\)/i);
        const parts = match && match[1] ? match[1].split(",").map((part) => part.trim()) : null;
        if( !parts || parts.length < 3 ){
            return null;
        }
        return {
            r: clamp(parseFloat(parts[0]) || 0, 0, 255),
            g: clamp(parseFloat(parts[1]) || 0, 0, 255),
            b: clamp(parseFloat(parts[2]) || 0, 0, 255),
            a: clamp(parts[3] === undefined ? 1 : (parseFloat(parts[3]) || 0), 0, 1)
        };
    };

    const parseHsl = function(text){
        const match = text.match(/hsla?\(([^)]+)\)/i);
        const parts = match && match[1] ? match[1].split(",").map((part) => part.trim()) : null;
        let rgb;
        if( !parts || parts.length < 3 ){
            return null;
        }
        rgb = hslToRgb(parseFloat(parts[0]) || 0,
            clamp((parseFloat(parts[1]) || 0) / 100, 0, 1),
            clamp((parseFloat(parts[2]) || 0) / 100, 0, 1));
        return {
            r: rgb.r,
            g: rgb.g,
            b: rgb.b,
            a: clamp(parts[3] === undefined ? 1 : (parseFloat(parts[3]) || 0), 0, 1)
        };
    };

    const parseCssColor = function(text){
        if( typeof document === "undefined" ){
            return null;
        }
        const el = document.createElement("span");
        el.style.color = "";
        el.style.color = text;
        if( !el.style.color ){
            return null;
        }
        document.body ? document.body.appendChild(el) : null;
        const computed = globalThis.getComputedStyle ? getComputedStyle(el).color : el.style.color;
        if( el.parentNode ){
            el.parentNode.removeChild(el);
        }
        return parseRgb(computed);
    };

    const normalizeColor = function(input){
        let parsed;
        if( input && typeof input === "object" ){
            if( input._r !== undefined ){
                return {
                    r: clamp(Number(input._r) || 0, 0, 255),
                    g: clamp(Number(input._g) || 0, 0, 255),
                    b: clamp(Number(input._b) || 0, 0, 255),
                    a: clamp(Number(input._a) || 0, 0, 1)
                };
            }
            if( input.r !== undefined && input.g !== undefined && input.b !== undefined ){
                return {
                    r: clamp(Number(input.r) || 0, 0, 255),
                    g: clamp(Number(input.g) || 0, 0, 255),
                    b: clamp(Number(input.b) || 0, 0, 255),
                    a: clamp(input.a === undefined ? 1 : (Number(input.a) || 0), 0, 1)
                };
            }
            if( input.h !== undefined && input.s !== undefined && input.l !== undefined ){
                parsed = hslToRgb(Number(input.h) || 0, clamp(Number(input.s) || 0, 0, 1), clamp(Number(input.l) || 0, 0, 1));
                return {r: parsed.r, g: parsed.g, b: parsed.b, a: clamp(input.a === undefined ? 1 : (Number(input.a) || 0), 0, 1)};
            }
        }
        if( typeof input !== "string" ){
            return {r: 0, g: 0, b: 0, a: 1};
        }
        parsed = parseHex(input) || parseRgb(input) || parseHsl(input) || parseCssColor(input);
        return parsed || {r: 0, g: 0, b: 0, a: 1};
    };

    const tinycolor = function(input){
        const color = normalizeColor(input);
        return {
            _r: color.r,
            _g: color.g,
            _b: color.b,
            _a: color.a,
            toHsl(){
                const hsl = rgbToHsl(color.r, color.g, color.b);
                return {h: hsl.h, s: hsl.s, l: hsl.l, a: color.a};
            },
            toHex(){
                return [color.r, color.g, color.b].map((value) => value.toString(16).padStart(2, "0")).join("");
            },
            toHexString(){
                return `#${this.toHex()}`;
            },
            analogous(results, slices){
                let i;
                const ret = [];
                const count = Math.max(1, Number(results) || 1);
                const totalSlices = Math.max(1, Number(slices) || count);
                const hsl = this.toHsl();
                const step = 360 / totalSlices;
                const start = hsl.h - (Math.floor(count / 2) * step);
                for(i=0; i<count; i++){
                    ret.push(tinycolor({h: start + (i * step), s: hsl.s, l: hsl.l, a: hsl.a}));
                }
                return ret;
            }
        };
    };

    globalThis.tinycolor = tinycolor;
}());
