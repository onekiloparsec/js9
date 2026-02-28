const DEFAULT_STYLES = ["support.css", "viewer.css"];
const PLUGIN_SUPPORT_SCRIPTS = [];
const SUPPORT_SOURCE_SCRIPTS = [
  "js/sprintf.min.js",
  "js/dhtmlwindow.min.js",
  "js/dhtmlwindow_blurb.js",
  "js/fabric.min.js",
  "js/pako_inflate.min.js",
  "js/FileSaver.min.js",
  "js/canvas-toBlob.js",
  "js/tabcontent.js",
  "js/spin.js",
  "js/ResizeSensor.js",
  "js/gaussblur.js",
  "js/imagefilters.js",
  "js/js9inline.js",
  "js/tinycolor.min.js",
  "js/regSelect.js",
  "runtime/dom-adapter.js",
  "runtime/math-utils.js",
  "runtime/basic-utils.js",
  "runtime/fits-runtime.js",
  "runtime/fits-bootstrap.js",
  "runtime/viewer-utils.js",
  "runtime/viewer-events.js",
  "runtime/viewer-plugins.js",
  "runtime/colormaps.js",
  "runtime/commands.js",
  "runtime/helper-runtime.js",
  "runtime/shape-engine.js",
  "runtime/fabric-engine.js",
  "runtime/init-analysis.js",
  "runtime/public-api.js",
  "runtime/viewer-init.js"
];
const CORE_SCRIPTS = ["prefs.js", ...SUPPORT_SOURCE_SCRIPTS, "viewer.js"];
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

function trimSlashes(s) {
  return s.replace(/^\/+|\/+$/g, "");
}

function toBaseUrl(baseUrl) {
  if (!baseUrl || baseUrl === ".") {
    return "";
  }
  return trimSlashes(baseUrl);
}

function makeAssetUrl(baseUrl, assetPath) {
  const cleanAsset = trimSlashes(assetPath);
  const cleanBase = toBaseUrl(baseUrl);
  return cleanBase ? `/${cleanBase}/${cleanAsset}` : `/${cleanAsset}`;
}

function resolveAssetPath(runtimePath, assetPath) {
  const clean = trimSlashes(assetPath);
  if (clean.includes("/")) {
    return clean;
  }
  return `${trimSlashes(runtimePath)}/${clean}`;
}

function ensureCss(baseUrl, href, onProgress) {
  const url = makeAssetUrl(baseUrl, href);
  const existing = document.querySelector(`link[data-js9-asset=\"${url}\"]`);
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

function ensureScript(baseUrl, src, onProgress) {
  const url = makeAssetUrl(baseUrl, src);
  const existing = document.querySelector(`script[data-js9-asset=\"${url}\"]`);
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

let loadPromise = null;

function isJS9Namespace(value) {
  return Boolean(value) &&
    typeof value === "object" &&
    value.NAME === "JS9" &&
    typeof value.VERSION === "string";
}

function setLoaderState(state, extra = {}) {
  globalThis.__JS9_LOADER_STATE__ = {
    state,
    ...extra,
    updatedAt: new Date().toISOString()
  };
}

function finalizeJS9Runtime(baseUrl, runtimePath) {
  setLoaderState("finalizing", {
    hasJS9: isJS9Namespace(globalThis.JS9),
    inited: Boolean(globalThis.JS9?.inited)
  });
  if (!isJS9Namespace(globalThis.JS9)) {
    throw new Error("JS9 runtime loaded but window.JS9 is unavailable");
  }

  if (globalThis.JS9.globalOpts) {
    // JS9 derives INSTALLDIR from viewer.css, so extracted assets should use
    // filenames relative to that directory instead of source-tree node_modules paths.
    globalThis.JS9.globalOpts.fixiURL = "fixi.js";
    globalThis.JS9.globalOpts.fixiWasmURL = "fixi_core.wasm";
  }

  if (
    document.readyState !== "loading" &&
    !globalThis.JS9.inited &&
    typeof globalThis.JS9.init === "function"
  ) {
    globalThis.JS9.init();
  }

  globalThis.JS9.WORKERFILE = makeAssetUrl(baseUrl, `${trimSlashes(runtimePath)}/worker.js`);
  setLoaderState("ready", {
    hasJS9: true,
    inited: Boolean(globalThis.JS9.inited),
    workerFile: globalThis.JS9.WORKERFILE
  });

  return globalThis.JS9;
}

export function getJS9() {
  return isJS9Namespace(globalThis.JS9) ? globalThis.JS9 : null;
}

export async function loadJS9Runtime(options = {}) {
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
    return finalizeJS9Runtime(baseUrl, runtimePath);
  }

  if (loadPromise) {
    setLoaderState("awaiting-existing-load-promise");
    await loadPromise;
    return finalizeJS9Runtime(baseUrl, runtimePath);
  }

  const runtimeStyles = styles.map((href) => resolveAssetPath(runtimePath, href));
  const runtimeScripts = [
    ...(includePlugins ? PLUGIN_SUPPORT_SCRIPTS : []),
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
  return finalizeJS9Runtime(baseUrl, runtimePath);
}
