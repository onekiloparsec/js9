/* JS9 browser web worker. Attribution is centralized in README.md. */
/*global importScripts, io */
"use strict";
const workerSelf = self;
// socket.io support
let socket = null;
let socketActive = false;
let socketImported = false;
let connected = false;
const socksuffix = "/socket.io/socket.io.js";
const timeout = 10000;
// this uploads large data sets on my slow (70kb/sec) DSL line without a hang
const emitMax = 409600;
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/slice
// https://tc39.github.io/ecma262/#sec-%typedarray%.prototype.slice
if (!Uint8Array.prototype.slice) {
    // eslint-disable-next-line no-extend-native
    Object.defineProperty(Uint8Array.prototype, "slice", {
        value: Array.prototype.slice
    });
}
function initSocketIO(sockurl, pageid, id) {
    let sockscript;
    const sockopts = {
        reconnection: false,
        timeout: timeout
    };
    // if already connected, just say so and return;
    if (connected) {
        workerSelf.postMessage({ id: id, cmd: "initsocketio", result: "OK" });
        return;
    }
    // import socketio scripts
    if (!socketImported) {
        sockscript = sockurl + socksuffix;
        importScripts(sockscript);
        socketImported = true;
    }
    // close off previous socket connection, if necessary
    if (socket) {
        try {
            socket.disconnect();
        }
        catch (_e) { /* empty */ }
        socket = null;
    }
    // connect to the helper
    socket = io.connect(sockurl, sockopts);
    // on-event processing
    socket.on("connect", () => {
        socket.emit("worker", { pageid: pageid }, (s) => {
            if (s === "OK") {
                connected = true;
            }
            workerSelf.postMessage({ id: id, cmd: "initsocketio", result: s });
        });
    });
    socket.on("connect_error", () => {
        connected = false;
        socketActive = false;
        workerSelf.postMessage({ id: id, cmd: "connect_error", result: "" });
    });
    socket.on("connect_timeout", () => {
        connected = false;
        socketActive = false;
        workerSelf.postMessage({ id: id, cmd: "connect_timeout", result: "" });
    });
    socket.on("disconnect", () => {
        const obj = { id: id, cmd: "disconnect" };
        if (socketActive) {
            obj.alert = true;
            obj.result = "The JS9 helper connection was unexpectedly severed (probably on the server side). Please try again.";
        }
        else if (connected) {
            obj.result = "JS9 worker socket was disconnected";
        }
        connected = false;
        socketActive = false;
        workerSelf.postMessage(obj);
    });
}
// message handler
workerSelf.onmessage = function (e) {
    let fname = "";
    let data;
    let slice;
    let len = 0;
    let res = "";
    const obj = (e.data || {});
    const args = obj.args;
    const cmd = obj.cmd;
    const id = obj.id;
    const uploadFITS = function (uploadName, uploadData, total, cur, left) {
        let tlen = 0;
        let stdin = {};
        if (left > 0) {
            // how much to grab in this slice
            tlen = Math.min(left, emitMax);
            // grab the slice
            slice = new Uint8Array(uploadData).slice(cur, cur + tlen).buffer;
            // make up the object containing slice and slice info
            stdin = { data: slice, total: total, cur: cur, len: tlen };
            // send data
            socket.emit("uploadfits", { "cmd": `js9Xeq uploadfits ${uploadName}`, "stdin": stdin }, (r) => {
                if (r.stdout === "OK") {
                    // update progress bar
                    r = { value: Math.floor(((cur + tlen) / total) * 100), max: 100 };
                    workerSelf.postMessage({ id: id, cmd: "progress", result: r });
                    // recurse to send next slice
                    uploadFITS(uploadName, uploadData, total, cur + tlen, left - tlen);
                }
                else {
                    // oops, we got an error
                    r = "uploading FITS data to server";
                    workerSelf.postMessage({ id: id, cmd: "error", result: r });
                    socketActive = false;
                }
            });
        }
        else {
            // give a hint to the GC
            uploadData = null;
        }
    };
    switch (cmd) {
        case "initsocketio":
            initSocketIO(args[0], args[1], obj.id);
            break;
        case "uploadFITS":
            if (connected) {
                fname = args[0];
                socketActive = true;
                socket.emit("uploadfits", { "cmd": `js9Xeq uploadfits ${fname}`, "stdin": true }, (r) => {
                    workerSelf.postMessage({ id: id, cmd: cmd, result: r });
                    socketActive = false;
                });
                // initial data is raw buffer from a typed array
                // (hopefully with ownership transferred!)
                data = args[1];
                len = data.byteLength;
                uploadFITS(fname, data, len, 0, len);
            }
            else {
                res = "worker not connected to remote server: try reloading page";
                workerSelf.postMessage({ id: id, cmd: "error", result: res });
            }
            break;
        default:
            socketActive = false;
            res = `unknown web worker command: ${cmd}`;
            workerSelf.postMessage({ id: id, cmd: "error", result: res });
            break;
    }
};
// error handler
workerSelf.onerror = function (e) {
    let s = "in worker";
    if (typeof e === "string") {
        s = e;
    }
    else if (typeof e === "object" && e !== null) {
        const err = e;
        s = err.message || "in worker";
    }
    workerSelf.postMessage({ id: "NONE", cmd: "error", result: s });
};
