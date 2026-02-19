/*
 *
 * js9Worker.js: web worker support (March 23, 2017)
 *
 * Principals: Eric Mandel
 * Organization: Harvard Smithsonian Center for Astrophysics, Cambridge MA
 * Contact: saord@cfa.harvard.edu
 *
 * Copyright (c) 2017 - 2022 Smithsonian Astrophysical Observatory
 *
 */

/*global importScripts, io */

"use strict";

interface WorkerReply {
    id: string | undefined;
    cmd: string;
    result?: unknown;
    alert?: boolean;
}

interface WorkerCommand {
    id?: string;
    cmd?: string;
    args?: unknown[];
}

interface SocketIOOptions {
    reconnection: boolean;
    timeout: number;
}

interface SocketConnection {
    disconnect: () => void;
    on: (event: string, callback: () => void) => void;
    emit: (
        event: string,
        payload: unknown,
        callback?: (response: any) => void
    ) => void;
}

interface SocketIOGlobal {
    connect: (url: string, opts: SocketIOOptions) => SocketConnection;
}

declare const io: SocketIOGlobal;
declare function importScripts(...urls: string[]): void;
const workerSelf = self as unknown as {
    postMessage: (msg: WorkerReply) => void;
    onmessage: ((e: { data?: WorkerCommand }) => void) | null;
    onerror: ((e: unknown) => void) | null;
};

// socket.io support
let socket: SocketConnection | null = null;
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

function initSocketIO(sockurl: string, pageid: string, id: string): void{
    let sockscript: string;
    const sockopts = {
        reconnection: false,
        timeout: timeout
    };
    // if already connected, just say so and return;
    if( connected ){
        workerSelf.postMessage({id: id, cmd: "initsocketio", result: "OK"});
        return;
    }
    // import socketio scripts
    if( !socketImported ){
        sockscript = sockurl + socksuffix;
        importScripts(sockscript);
        socketImported = true;
    }
    // close off previous socket connection, if necessary
    if( socket ){
        try{ socket.disconnect(); }
        catch(_e){ /* empty */ }
        socket = null;
    }
    // connect to the helper
    socket = io.connect(sockurl, sockopts);
    // on-event processing
    socket.on("connect", () => {
        socket!.emit("worker", {pageid: pageid}, (s: any) => {
            if( s === "OK" ){
                connected = true;
            }
            workerSelf.postMessage({id: id, cmd: "initsocketio", result: s});
        });
    });
    socket.on("connect_error", () => {
        connected = false;
        socketActive = false;
        workerSelf.postMessage({id: id, cmd: "connect_error", result: ""});
    });
    socket.on("connect_timeout", () => {
        connected = false;
        socketActive = false;
        workerSelf.postMessage({id: id, cmd: "connect_timeout", result: ""});
    });
    socket.on("disconnect", () => {
        const obj: WorkerReply = {id: id, cmd: "disconnect"};
        if( socketActive ){
            obj.alert = true;
            obj.result = "The JS9 helper connection was unexpectedly severed (probably on the server side). Please try again.";
        } else if( connected ){
            obj.result = "JS9 worker socket was disconnected";
        }
        connected = false;
        socketActive = false;
        workerSelf.postMessage(obj);
    });
}

// message handler
workerSelf.onmessage = function(e): void{
    let fname = "";
    let data: ArrayBuffer;
    let slice: ArrayBuffer;
    let len = 0;
    let res = "";
    const obj = (e.data || {}) as WorkerCommand;
    const args = obj.args as unknown[];
    const cmd = obj.cmd as string;
    const id = obj.id;
    const uploadFITS = function(
        uploadName: string,
        uploadData: ArrayBuffer,
        total: number,
        cur: number,
        left: number
    ): void{
        let tlen = 0;
        let stdin: unknown = {};
        if( left > 0 ){
            // how much to grab in this slice
            tlen = Math.min(left, emitMax);
            // grab the slice
            slice = new Uint8Array(uploadData).slice(cur, cur + tlen).buffer;
            // make up the object containing slice and slice info
            stdin = {data: slice, total: total, cur: cur, len: tlen};
            // send data
            socket!.emit(
                "uploadfits",
                {"cmd": `js9Xeq uploadfits ${uploadName}`, "stdin": stdin},
                (r: any) => {
                    if( r.stdout === "OK" ){
                        // update progress bar
                        r = {value: Math.floor(((cur + tlen) / total) * 100), max: 100};
                        workerSelf.postMessage({id: id, cmd: "progress", result: r});
                        // recurse to send next slice
                        uploadFITS(uploadName, uploadData, total, cur + tlen, left - tlen);
                    } else {
                        // oops, we got an error
                        r = "uploading FITS data to server";
                        workerSelf.postMessage({id: id, cmd: "error", result: r});
                        socketActive = false;
                    }
                }
            );
        } else {
            // give a hint to the GC
            uploadData = null as unknown as ArrayBuffer;
        }
    };
    switch(cmd){
    case "initsocketio":
        initSocketIO(args[0] as string, args[1] as string, obj.id as string);
        break;
    case "uploadFITS":
        if( connected ){
            fname = args[0] as string;
            socketActive = true;
            socket!.emit(
                "uploadfits",
                {"cmd": `js9Xeq uploadfits ${fname}`, "stdin": true},
                (r: any) => {
                    workerSelf.postMessage({id: id, cmd: cmd, result: r});
                    socketActive = false;
                }
            );
            // initial data is raw buffer from a typed array
            // (hopefully with ownership transferred!)
            data = args[1] as ArrayBuffer;
            len = data.byteLength;
            uploadFITS(fname, data, len, 0, len);
        } else {
            res = "worker not connected to remote server: try reloading page";
            workerSelf.postMessage({id: id, cmd: "error", result: res});
        }
        break;
    default:
        socketActive = false;
        res = `unknown web worker command: ${cmd}`;
        workerSelf.postMessage({id: id, cmd: "error", result: res});
        break;
    }
};

// error handler
workerSelf.onerror = function(e): void{
    let s = "in worker";
    if( typeof e === "string" ){
        s = e;
    } else if( typeof e === "object" && e !== null ){
        const err = e as { message?: string };
        s = err.message || "in worker";
    }
    workerSelf.postMessage({id: "NONE", cmd: "error", result: s});
};
