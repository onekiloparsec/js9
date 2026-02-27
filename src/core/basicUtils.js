/* JS9 browser core basic utilities. Attribution is centralized in README.md. */

"use strict";

// install helpers on a JS9 namespace object
var CoreBasicUtils = function(JS9){
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
};
