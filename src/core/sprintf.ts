/* JS9-owned sprintf/vsprintf implementation for browser runtime. */

"use strict";

const formatInteger = function(value: unknown, base: number, uppercase: boolean): string {
    let result: string;
    if( base === 10 ){
        result = `${Math.trunc(Math.abs(Number(value) || 0))}`;
    } else {
        result = Math.trunc(Math.abs(Number(value) || 0)).toString(base);
    }
    return uppercase ? result.toUpperCase() : result;
};

const pad = function(text: string, width: number, flags: string, prefixLength: number): string {
    const leftAlign = flags.includes("-");
    const zeroPad = flags.includes("0") && !leftAlign;
    const fill = zeroPad ? "0" : " ";
    const needed = Math.max(0, width - text.length);
    if( !needed ){
        return text;
    }
    if( zeroPad && prefixLength > 0 ){
        return text.slice(0, prefixLength) + fill.repeat(needed) + text.slice(prefixLength);
    }
    return leftAlign ? `${text}${fill.repeat(needed)}` : `${fill.repeat(needed)}${text}`;
};

const precisionFrom = function(token: string | undefined | null, nextArg: () => unknown): number | undefined {
    if( token === undefined || token === null ){
        return undefined;
    }
    if( token === "*" ){
        return Number(nextArg());
    }
    return Number(token);
};

const widthFrom = function(token: string | undefined | null, nextArg: () => unknown): number | undefined {
    if( token === undefined || token === null ){
        return undefined;
    }
    if( token === "*" ){
        return Number(nextArg());
    }
    return Number(token);
};

const formatSpecifier = function(specifier: string, value: unknown, flags: string, width: number | undefined, precision: number | undefined): string {
    const leftAlign = flags.includes("-");
    const forceSign = flags.includes("+");
    const spaceSign = flags.includes(" ") && !forceSign;
    const alternate = flags.includes("#");
    let text = "";
    let prefix = "";
    let prefixLength = 0;
    let numeric: number;
    switch(specifier){
    case "s":
        text = String(value);
        if( precision !== undefined && precision >= 0 ){
            text = text.slice(0, precision);
        }
        break;
    case "c":
        numeric = Number(value);
        text = String.fromCharCode(Number.isNaN(numeric) ? 0 : numeric);
        break;
    case "d":
    case "i":
    case "u":
        numeric = Number(value) || 0;
        if( specifier === "u" ){
            numeric = numeric >>> 0;
            text = `${numeric}`;
        } else {
            prefix = numeric < 0 ? "-" : (forceSign ? "+" : (spaceSign ? " " : ""));
            text = `${Math.trunc(Math.abs(numeric))}`;
        }
        if( precision !== undefined ){
            text = text.padStart(Math.max(0, precision), "0");
        }
        text = `${prefix}${text}`;
        prefixLength = prefix.length;
        break;
    case "x":
    case "X":
        numeric = Number(value) >>> 0;
        prefix = alternate && numeric ? (specifier === "X" ? "0X" : "0x") : "";
        text = formatInteger(numeric, 16, specifier === "X");
        if( precision !== undefined ){
            text = text.padStart(Math.max(0, precision), "0");
        }
        text = `${prefix}${text}`;
        prefixLength = prefix.length;
        break;
    case "o":
        numeric = Number(value) >>> 0;
        prefix = alternate && numeric ? "0" : "";
        text = formatInteger(numeric, 8, false);
        if( precision !== undefined ){
            text = text.padStart(Math.max(0, precision), "0");
        }
        text = `${prefix}${text}`;
        prefixLength = prefix.length;
        break;
    case "b":
        numeric = Number(value) >>> 0;
        prefix = alternate && numeric ? "0b" : "";
        text = formatInteger(numeric, 2, false);
        if( precision !== undefined ){
            text = text.padStart(Math.max(0, precision), "0");
        }
        text = `${prefix}${text}`;
        prefixLength = prefix.length;
        break;
    case "f":
        numeric = Number(value) || 0;
        prefix = numeric < 0 ? "-" : (forceSign ? "+" : (spaceSign ? " " : ""));
        text = Math.abs(numeric).toFixed(precision !== undefined ? precision : 6);
        text = `${prefix}${text}`;
        prefixLength = prefix.length;
        break;
    case "e":
    case "E":
        numeric = Number(value) || 0;
        prefix = numeric < 0 ? "-" : (forceSign ? "+" : (spaceSign ? " " : ""));
        text = Math.abs(numeric).toExponential(precision !== undefined ? precision : 6);
        if( specifier === "E" ){
            text = text.toUpperCase();
        }
        text = `${prefix}${text}`;
        prefixLength = prefix.length;
        break;
    case "g":
    case "G":
        numeric = Number(value) || 0;
        prefix = numeric < 0 ? "-" : (forceSign ? "+" : (spaceSign ? " " : ""));
        text = Math.abs(numeric).toPrecision(precision !== undefined && precision > 0 ? precision : 6);
        if( !alternate ){
            text = text.replace(/(\.\d*?)0+(e|$)/i, "$1$2").replace(/\.(e|$)/i, "$1");
        }
        if( specifier === "G" ){
            text = text.toUpperCase();
        }
        text = `${prefix}${text}`;
        prefixLength = prefix.length;
        break;
    default:
        text = String(value);
        break;
    }
    if( width !== undefined ){
        if( width < 0 ){
            width = Math.abs(width);
            flags = `${flags}-`;
        }
        text = pad(text, width, flags, prefixLength);
        if( leftAlign ){
            text = pad(text, width, "-", prefixLength);
        }
    }
    return text;
};

export const vsprintf = function(format: string, argv: unknown[]): string {
    let argIndex = 0;
    const args = Array.isArray(argv) ? argv : [];
    const nextArg = function(){
        const value = args[argIndex];
        argIndex += 1;
        return value;
    };
    return String(format).replace(/%%|%([-+'#0 ]*)(\*|\d+)?(?:\.(\*|\d+))?([scboxXuidfegEG])/g, (match, flags, widthToken, precisionToken, specifier) => {
        let width: number | undefined;
        let precision: number | undefined;
        if( match === "%%" ){
            return "%";
        }
        width = widthFrom(widthToken, nextArg);
        precision = precisionFrom(precisionToken, nextArg);
        return formatSpecifier(specifier, nextArg(), flags || "", width, precision);
    });
};

export const sprintf = function(format: string, ...args: unknown[]): string {
    return vsprintf(format, args);
};
