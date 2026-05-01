import type {
    JS9Namespace,
    LoadJS9RuntimeOptions,
    JS9ProgressEvent
} from "./types";

// Re-export all public types so consumers can import them from 'js9'.
export type {
    JS9Namespace,
    LoadJS9RuntimeOptions,
    JS9ProgressEvent,
    JS9LoadOptions,
    JS9ColormapInfo,
    JS9ScaleInfo,
    JS9PanInfo,
    JS9ImageInfo,
    JS9RegionOptions,
    JS9DisplayTarget,
    JS9DisplayLike
} from "./types";

// Declare the globalThis shape used internally by the loader.
// This augments the global scope only in compilations that include this file.
declare global {
    var JS9: JS9Namespace | undefined;
}

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

const DEFAULT_STYLES = ["support.css", "viewer.css"];
const CORE_SCRIPTS = ["prefs.js", "runtime.js"];
const DEFAULT_PLUGIN_SCRIPTS = [
    "plugins/archive/archive.js",
    "plugins/core/blend.js",
    "plugins/core/blink.js",
    "plugins/core/cmaps.js",
    "plugins/core/colorbar.js",
    "plugins/core/colorcontrols.js",
    "plugins/core/console.js",
    "plugins/core/cube.js",
    "plugins/core/divs.js",
    "plugins/core/filters.js",
    "plugins/core/imarith.js",
    "plugins/core/info.js",
    "plugins/core/keyboard.js",
    "plugins/core/layers.js",
    "plugins/core/magnifier.js",
    "plugins/core/mef.js",
    "plugins/core/menubar.js",
    "plugins/core/panner.js",
    "plugins/core/zoomcontrols.js",
    "plugins/core/prefs.js",
    "plugins/core/scalecontrols.js",
    "plugins/core/separate.js",
    "plugins/core/statusbar.js",
    "plugins/core/sync.js",
    "plugins/core/syncui.js",
    "plugins/core/toolbar.js",
    "plugins/imexam/imexam.js",
    "plugins/imexam/encircled.js",
    "plugins/imexam/imcnts.js",
    "plugins/imexam/pixtable.js",
    "plugins/imexam/radproj.js",
    "plugins/imexam/reghist.js",
    "plugins/imexam/regstat.js",
    "plugins/imexam/xyproj.js",
    "plugins/imexam/3dplot.js",
    "plugins/imexam/contour.js"
];

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

function trimSlashes(s: string): string {
    return s.replace(/^\/+|\/+$/g, "");
}

function toBaseUrl(baseUrl: string): string {
    if (!baseUrl || baseUrl === ".") {
        return "";
    }
    return trimSlashes(baseUrl);
}

function makeAssetUrl(baseUrl: string, assetPath: string): string {
    const cleanAsset = trimSlashes(assetPath);
    const cleanBase = toBaseUrl(baseUrl);
    return cleanBase ? `/${cleanBase}/${cleanAsset}` : `/${cleanAsset}`;
}

function resolveAssetPath(runtimePath: string, assetPath: string): string {
    const clean = trimSlashes(assetPath);
    if (clean.includes("/")) {
        return clean;
    }
    return `${trimSlashes(runtimePath)}/${clean}`;
}

// ---------------------------------------------------------------------------
// DOM asset injection
// ---------------------------------------------------------------------------

function ensureCss(baseUrl: string, href: string, onProgress?: (e: JS9ProgressEvent) => void): void {
    const url = makeAssetUrl(baseUrl, href);
    const existing = document.querySelector(`link[data-js9-asset="${url}"]`);
    if (existing) {
        onProgress?.({ type: "style", url, phase: "cached" });
        return;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    link.dataset.js9Asset = url;
    document.head.appendChild(link);
    onProgress?.({ type: "style", url, phase: "loaded" });
}

function ensureScript(baseUrl: string, src: string, onProgress?: (e: JS9ProgressEvent) => void): Promise<void> {
    const url = makeAssetUrl(baseUrl, src);
    const existing = document.querySelector(`script[data-js9-asset="${url}"]`) as HTMLScriptElement | null;
    if (existing) {
        if (existing.dataset.js9Loaded === "true") {
            onProgress?.({ type: "script", url, phase: "cached" });
            return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
            existing.addEventListener("load", () => {
                onProgress?.({ type: "script", url, phase: "loaded" });
                resolve();
            }, { once: true });
            existing.addEventListener("error", () => {
                onProgress?.({ type: "script", url, phase: "error" });
                reject(new Error(`Failed to load ${url}`));
            }, { once: true });
        });
    }

    return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = url;
        script.async = false;
        script.dataset.js9Asset = url;
        onProgress?.({ type: "script", url, phase: "loading" });
        script.onload = () => {
            script.dataset.js9Loaded = "true";
            onProgress?.({ type: "script", url, phase: "loaded" });
            resolve();
        };
        script.onerror = () => {
            onProgress?.({ type: "script", url, phase: "error" });
            reject(new Error(`Failed to load ${url}`));
        };
        document.head.appendChild(script);
    });
}

// ---------------------------------------------------------------------------
// JS9 namespace validation + loader state
// ---------------------------------------------------------------------------

let loadPromise: Promise<void> | null = null;

function isJS9Namespace(value: unknown): value is JS9Namespace {
    if (!value || typeof value !== "object") return false;
    const v = value as Record<string, unknown>;
    return v["NAME"] === "JS9" && typeof v["VERSION"] === "string";
}

function setLoaderState(state: string, extra: Record<string, unknown> = {}): void {
    globalThis.__JS9_LOADER_STATE__ = {
        state,
        ...extra,
        updatedAt: new Date().toISOString()
    };
}

function finalizeJS9Runtime(baseUrl: string, runtimePath: string): JS9Namespace {
    setLoaderState("finalizing", {
        hasJS9: isJS9Namespace(globalThis.JS9),
        inited: Boolean(globalThis.JS9?.inited)
    });

    const js9 = globalThis.JS9;
    if (!isJS9Namespace(js9)) {
        throw new Error("JS9 runtime loaded but window.JS9 is unavailable");
    }

    if (js9.globalOpts) {
        // JS9 derives INSTALLDIR from viewer.css, so extracted assets should use
        // filenames relative to that directory instead of source-tree node_modules paths.
        js9.globalOpts["fixiURL"] = "fixi.js";
        js9.globalOpts["fixiWasmURL"] = "fixi_core.wasm";
    }

    if (
        document.readyState !== "loading" &&
        !js9.inited &&
        typeof js9["init"] === "function"
    ) {
        js9.init();
    }

    js9.WORKERFILE = makeAssetUrl(baseUrl, `${trimSlashes(runtimePath)}/worker.js`);
    setLoaderState("ready", {
        hasJS9: true,
        inited: Boolean(js9.inited),
        workerFile: js9.WORKERFILE
    });

    return js9;
}

/**
 * Wait until the FITS adapter (fixi) finishes initialising. `js9.init()` kicks
 * off an *async* fixi.js + WASM load chain that can still be in flight when
 * this function returns. Calling `JS9.Load(url)` while `JS9.fits` is null
 * throws "no FITS module available to process FITS file" — the symptom
 * consumers hit when their viewer mounts on a route that immediately loads
 * a frame.
 */
async function waitForFITSAdapter(js9: JS9Namespace, timeoutMs = 15000): Promise<void> {
    const fits = (js9 as unknown as { fits?: { ready?: boolean } }).fits;
    if (fits?.ready) return;
    const start = Date.now();
    return new Promise<void>((resolve, reject) => {
        const tick = () => {
            const f = (js9 as unknown as { fits?: { ready?: boolean } }).fits;
            if (f?.ready) {
                resolve();
                return;
            }
            if (Date.now() - start > timeoutMs) {
                reject(new Error(
                    `JS9 FITS adapter did not become ready within ${timeoutMs}ms ` +
                    `(check that ${js9.globalOpts?.["fixiURL"] || "fixi.js"} ` +
                    `and ${js9.globalOpts?.["fixiWasmURL"] || "fixi_core.wasm"} are reachable)`
                ));
                return;
            }
            setTimeout(tick, 30);
        };
        tick();
    });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Returns the JS9 namespace if already loaded, or null. */
export function getJS9(): JS9Namespace | null {
    return isJS9Namespace(globalThis.JS9) ? globalThis.JS9 : null;
}

/** Load the JS9 runtime assets and return the initialised JS9 namespace. */
export async function loadJS9Runtime(options: LoadJS9RuntimeOptions = {}): Promise<JS9Namespace> {
    const {
        baseUrl = "",
        runtimePath = "runtime",
        styles = DEFAULT_STYLES,
        scripts = CORE_SCRIPTS,
        includePlugins = false,
        pluginScripts = DEFAULT_PLUGIN_SCRIPTS,
        onProgress
    } = options;

    setLoaderState("entered", {
        hasJS9: isJS9Namespace(globalThis.JS9),
        hasLoadPromise: Boolean(loadPromise)
    });

    if (isJS9Namespace(globalThis.JS9) && !loadPromise) {
        setLoaderState("using-existing-js9", {
            inited: Boolean(globalThis.JS9.inited)
        });
        const js9 = finalizeJS9Runtime(baseUrl, runtimePath);
        await waitForFITSAdapter(js9);
        return js9;
    }

    if (loadPromise) {
        setLoaderState("awaiting-existing-load-promise");
        await loadPromise;
        const js9 = finalizeJS9Runtime(baseUrl, runtimePath);
        await waitForFITSAdapter(js9);
        return js9;
    }

    const runtimeStyles = styles.map((href) => resolveAssetPath(runtimePath, href));
    const runtimeScripts = [
        ...scripts,
        ...(includePlugins ? pluginScripts : [])
    ].map((src) => resolveAssetPath(runtimePath, src));

    loadPromise = (async () => {
        setLoaderState("loading-assets", {
            styles: runtimeStyles.length,
            scripts: runtimeScripts.length
        });
        runtimeStyles.forEach((href) => ensureCss(baseUrl, href, onProgress));
        for (const src of runtimeScripts) {
            await ensureScript(baseUrl, src, onProgress);
        }
    })();

    await loadPromise;
    loadPromise = null;
    const js9 = finalizeJS9Runtime(baseUrl, runtimePath);
    await waitForFITSAdapter(js9);
    return js9;
}
