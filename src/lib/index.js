const DEFAULT_STYLES = ["support.css", "viewer.css"];
const SUPPORT_SOURCE_SCRIPTS = [
  "js/winmod.js",
  "js/jquery.min.js",
  "js/jquery-ui.min.js",
  "js/jquery.contextMenu.min.js",
  "js/jquery.flot.min.js",
  "js/jquery.flot.errorbars.min.js",
  "js/jquery.flot.navigate.min.js",
  "js/jquery.flot.resize.min.js",
  "js/jquery.flot.selection.min.js",
  "js/flot-zoom.min.js",
  "js/sprintf.min.js",
  "js/dhtmlwindow.min.js",
  "js/dhtmlwindow_blurb.js",
  "js/fabric.min.js",
  "js/pako_inflate.min.js",
  "js/FileSaver.min.js",
  "js/canvas-toBlob.js",
  "js/tabcontent.js",
  "js/arrive.min.js",
  "js/jquery.doubletap.min.js",
  "js/jquery.flot.axislabels.js",
  "js/spin.js",
  "js/ElementQueries.js",
  "js/ResizeSensor.js",
  "js/gaussblur.js",
  "js/imagefilters.js",
  "js/jquery.ui.touch-punch.js",
  "js/js9inline.js",
  "js/spectrum.min.js",
  "js/tinycolor.min.js",
  "js/jquery.mark.es6.min.js",
  "js/jquery.caret.min.js",
  "js/regSelect.js",
  "runtime/basic-utils.js"
];
const CORE_SCRIPTS = ["prefs.js", ...SUPPORT_SOURCE_SCRIPTS, "viewer.js"];
const DEFAULT_PLUGIN_SCRIPTS = ["plugins.js"];

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

function ensureCss(baseUrl, href) {
  const url = makeAssetUrl(baseUrl, href);
  const existing = document.querySelector(`link[data-js9-asset=\"${url}\"]`);
  if (existing) {
    return;
  }
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = url;
  link.dataset.js9Asset = url;
  document.head.appendChild(link);
}

function ensureScript(baseUrl, src) {
  const url = makeAssetUrl(baseUrl, src);
  const existing = document.querySelector(`script[data-js9-asset=\"${url}\"]`);
  if (existing) {
    if (existing.dataset.js9Loaded === "true") {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${url}`)), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.async = false;
    script.dataset.js9Asset = url;
    script.onload = () => {
      script.dataset.js9Loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${url}`));
    document.head.appendChild(script);
  });
}

let loadPromise = null;

export function getJS9() {
  return globalThis.JS9 || null;
}

export async function loadJS9Runtime(options = {}) {
  if (globalThis.JS9) {
    return globalThis.JS9;
  }

  if (loadPromise) {
    await loadPromise;
    return globalThis.JS9 || null;
  }

  const {
    baseUrl = "",
    runtimePath = "runtime",
    styles = DEFAULT_STYLES,
    scripts = CORE_SCRIPTS,
    includePlugins = false,
    pluginScripts = DEFAULT_PLUGIN_SCRIPTS
  } = options;

  const runtimeStyles = styles.map((href) => resolveAssetPath(runtimePath, href));
  const runtimeScripts = [
    ...scripts,
    ...(includePlugins ? pluginScripts : [])
  ].map((src) => resolveAssetPath(runtimePath, src));

  loadPromise = (async () => {
    runtimeStyles.forEach((href) => ensureCss(baseUrl, href));
    for (const src of runtimeScripts) {
      await ensureScript(baseUrl, src);
    }
  })();

  await loadPromise;
  loadPromise = null;

  if (!globalThis.JS9) {
    throw new Error("JS9 runtime loaded but window.JS9 is unavailable");
  }

  globalThis.JS9.WORKERFILE = makeAssetUrl(baseUrl, `${trimSlashes(runtimePath)}/worker.js`);

  return globalThis.JS9;
}
