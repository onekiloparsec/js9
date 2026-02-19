/*
 *
 * js9Regions: Node-based js9 to ds9 region converter
 *
 * Principals: Eric Mandel
 * Organization: Center for Astrophysics | Harvard & Smithsonian, Cambridge MA
 * Contact: emandel@cfa.harvard.edu
 *
 * Copyright (c) 2017 - 2022 Smithsonian Astrophysical Observatory
 *
 */
/* global */
/* eslint no-console: "off" */
"use strict";
// modules
const fs = require("fs");
const minimist = require("minimist");
const argv = minimist(process.argv.slice(2));
// add to ds9 comment string
const addComment = function (comment, key, val) {
    let value = val;
    if (comment !== "") {
        comment += " ";
    }
    if (value === true) {
        value = 1;
    }
    if (value === false) {
        value = 0;
    }
    if (key) {
        if (key !== "dashlist" && typeof value === "string") {
            value = `{${value}}`;
        }
        comment += `${key}=${value}`;
    }
    else {
        comment += String(value);
    }
    return comment;
};
// parse region, convert from js9 to ds9
const parseRegion = function (s) {
    let cmd;
    let json = {};
    let highlite = "";
    let comment = "";
    const fontarr = [];
    const optsrexp = /(\{.*\})/;
    const comrexp = /#(?![a-zA-Z0-9]{6}['"])/;
    // split on comment (ignore color specifications starting with '#')
    const sarr = s.trim().split(comrexp);
    // this is the region or command
    cmd = sarr[0].replace(optsrexp, "").trim();
    if (cmd.match(/text/)) {
        cmd = `# ${cmd}`;
        cmd = cmd.replace(/, *"(.*)", (.*)\)/, ") text={$1} textangle=$2");
        cmd = cmd.replace(/, *"(.*)"\)/, ") text={$1}");
    }
    // look for json opts after the argument list
    const jarr = optsrexp.exec(sarr[0]);
    if (jarr && jarr[0]) {
        // convert to object
        try {
            json = JSON.parse(jarr[0].trim());
        }
        catch (_e) {
            json = {};
        }
    }
    // look for comments
    if (sarr[1]) {
        if (sarr[1].match("=")) {
            // ds9 comments using key=val (leave as a comment)
            comment = sarr[1].trim();
        }
        else {
            // js9 comment containing tags (convert to series of tags)
            const carr = sarr[1].split(",");
            for (let i = 0; i < carr.length; i++) {
                const c = carr[i].trim();
                if (c === "source" || c === "background") {
                    comment = addComment(comment, null, c);
                }
                else if (c !== "include" && c !== "exclude") {
                    comment = addComment(comment, "tag", c);
                }
            }
        }
    }
    // convert js9 json to ds9 comments
    for (const key of Object.keys(json)) {
        const value = json[key];
        switch (key) {
            case "color":
                if (typeof value === "string" &&
                    value.match(/black|white|red|green|blue|cyan|magenta|yellow/)) {
                    comment = addComment(comment, "color", value);
                }
                break;
            case "strokeDashArray":
                if (Array.isArray(value)) {
                    comment = addComment(comment, "dash", 1);
                    comment = addComment(comment, "dashlist", value.join(" "));
                }
                break;
            case "strokeWidth":
                if (typeof value === "number") {
                    comment = addComment(comment, "width", Math.floor(value));
                }
                break;
            case "removable":
                comment = addComment(comment, "delete", !!value);
                break;
            case "selectable":
                comment = addComment(comment, "edit", !!value);
                break;
            case "rotatable":
                comment = addComment(comment, "rotate", !!value);
                break;
            case "resizable":
                comment = addComment(comment, "resize", !!value);
                break;
            case "zoomable":
                comment = addComment(comment, "fixed", !!value);
                break;
            case "fontFamily":
                fontarr[0] = String(value);
                break;
            case "fontSize":
                fontarr[1] = String(value);
                break;
            case "fontWeight":
                fontarr[2] = String(value);
                break;
            case "fontStyle":
                fontarr[3] = String(value);
                break;
            case "hasControls":
            case "hasBorders":
            case "hasRotatingPoint":
                if (!highlite) {
                    highlite = String(!!value);
                }
                break;
            case "text":
                comment = addComment(comment, "text", value);
                break;
            case "tags":
                if (typeof value === "string") {
                    const tarr = value.split(",");
                    for (let i = 0; i < tarr.length; i++) {
                        comment = addComment(comment, "tag", tarr[i].trim());
                    }
                }
                break;
        }
    }
    if (cmd) {
        let ostr = cmd;
        if (fontarr.length === 4) {
            comment = addComment(comment, "font", fontarr.join(" "));
        }
        if (highlite !== "") {
            comment = addComment(comment, "highlite", highlite);
        }
        if (comment !== "") {
            ostr += ` # ${comment}`;
        }
        console.log(ostr);
    }
};
// main routine
const convertRegion = function (s) {
    const seprexp = /\n|;/;
    // get individual lines (new-line or semi-colon separated)
    const lines = s.split(seprexp);
    // for each region or cmd
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line && line.substr(0, 1) !== "#") {
            parseRegion(line);
        }
    }
};
// required args: region file
if (!argv.r || typeof argv.r !== "string") {
    console.error("ERROR: no JS9 region file specified");
    process.exit(1);
}
fs.readFile(argv.r, "ascii", (err, data) => {
    if (err) {
        const s = `ERROR: reading ${argv.r}: ${err.message}`;
        console.error(s);
        process.exit(2);
    }
    convertRegion(data);
    process.exit(0);
});
