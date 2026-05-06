/**
 * Phase 6: FITS Pipeline Integration Tests
 *
 * Tests the critical path: FITS bytes → Fixi WASM parser → JS9 adapter → HDU object.
 * Run entirely in Node.js (no DOM/canvas required).
 */
import { beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import { loadCoreBasicUtils } from "./loadCoreBasicUtils.js";

const require = createRequire(import.meta.url);
const Fixi = require("@onekiloparsec/fixi-js");
const fixiDistDir = path.dirname(require.resolve("@onekiloparsec/fixi-js/dist/fixi.js"));
const fixturesDir = path.join(fixiDistDir, "..", "test", "data", "fits");
// fixi-js is published with only `dist` + README in its files glob; the test
// fixtures live in the source tree and are only present when fixi-js is
// installed via a workspace / file: link. Skip fixture-backed tests when
// the file isn't reachable so the suite still runs against a registry-
// installed fixi-js.
const hasFixtures = fs.existsSync(path.join(fixturesDir, "U10320.fits"));
const itWithFixtures = hasFixtures ? it : it.skip;

// --- Minimal synthetic FITS builder ---
// Ported from fixi-js/test/helpers/fits-builders.js so tests are self-contained.

function fitCard(line) {
  const card = String(line || "").slice(0, 80);
  return card + " ".repeat(80 - card.length);
}
function fitIntCard(key, value) {
  return fitCard(`${String(key).padEnd(8)}= ${String(value).padStart(20)}`);
}
function fitLogicalCard(key, value) {
  return fitCard(`${String(key).padEnd(8)}= ${(value ? "T" : "F").padStart(20)}`);
}
function buildHeader(cards) {
  const all = cards.concat([fitCard("END")]).join("");
  const padded = all + " ".repeat((2880 - (all.length % 2880)) % 2880);
  return Buffer.from(padded, "ascii");
}

/**
 * Builds a minimal FITS file: single image HDU, BITPIX=-32 (float32),
 * pixel values 1, 2, 3, ..., width*height (big-endian IEEE 754).
 */
function makeSyntheticFITS(width, height) {
  const header = buildHeader([
    fitLogicalCard("SIMPLE", true),
    fitIntCard("BITPIX", -32),
    fitIntCard("NAXIS", 2),
    fitIntCard("NAXIS1", width),
    fitIntCard("NAXIS2", height),
    fitLogicalCard("EXTEND", true),
  ]);
  const n = width * height;
  const data = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) data.writeFloatBE(i + 1, i * 4);
  const pad = (2880 - (data.length % 2880)) % 2880;
  return Buffer.concat([header, data, Buffer.alloc(pad)]);
}

// ---- shared state ----
let installCoreBasicUtils;

beforeAll(async () => {
  // Initialize Fixi WASM (loads fixi_core.wasm from the dist directory).
  await Fixi.init({ baseURL: fixiDistDir });
  installCoreBasicUtils = await loadCoreBasicUtils();
  globalThis.window = {};
  await import("../../src/core/fitsRuntime.ts");
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Fixi WASM runtime
// ─────────────────────────────────────────────────────────────────────────────

describe("Fixi WASM runtime", () => {
  it("reports ready after init()", () => {
    expect(Fixi.ready()).toBe(true);
  });

  it("exposes the expected public API surface", () => {
    for (const method of ["init", "ready", "inspectFITS", "extractHDU", "createRustWasmAdapter", "configureForJS9"]) {
      expect(typeof Fixi[method]).toBe("function");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Header parsing — Fixi.inspectFITS
// inspectFITS HDU shape: { kind, bitpix, naxis, axes: number[], ... }
// axes is 0-indexed: axes[0]=NAXIS1, axes[1]=NAXIS2
// ─────────────────────────────────────────────────────────────────────────────

describe("Fixi.inspectFITS – header parsing", () => {
  it("parses a synthetic 8×4 float32 image", async () => {
    const bytes = makeSyntheticFITS(8, 4);
    const summary = await Fixi.inspectFITS(bytes);

    expect(Array.isArray(summary.hdus)).toBe(true);
    expect(summary.hdus.length).toBeGreaterThan(0);

    const img = summary.hdus.find((h) => h.kind === "image");
    expect(img).toBeDefined();
    expect(img.bitpix).toBe(-32);
    expect(img.naxis).toBe(2);
    expect(img.axes[0]).toBe(8);   // NAXIS1
    expect(img.axes[1]).toBe(4);   // NAXIS2
  });

  itWithFixtures("parses a real FITS file (U10320.fits — a 1D spectrum)", async () => {
    const bytes = fs.readFileSync(path.join(fixturesDir, "U10320.fits"));
    const summary = await Fixi.inspectFITS(bytes);

    expect(Array.isArray(summary.hdus)).toBe(true);
    const img = summary.hdus.find((h) => h.kind === "image");
    expect(img).toBeDefined();
    expect(img.naxis).toBeGreaterThanOrEqual(1);
    expect(img.axes.length).toBeGreaterThanOrEqual(1);
    expect(img.axes[0]).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Pixel extraction — Fixi.extractHDU
// extractHDU HDU shape: { bitpix, naxis, axis: number[], data: Float32Array, dmin, dmax, ... }
// axis is 1-indexed: axis[1]=NAXIS1, axis[2]=NAXIS2
// ─────────────────────────────────────────────────────────────────────────────

describe("Fixi.extractHDU – pixel data", () => {
  it("extracts float32 pixels from a 4×4 synthetic image", async () => {
    const W = 4, H = 4;
    const bytes = makeSyntheticFITS(W, H);
    const hdu = await Fixi.extractHDU(bytes, 0);

    expect(hdu).toBeDefined();
    expect(hdu.data).toBeInstanceOf(Float32Array);
    expect(hdu.data.length).toBe(W * H);
    expect(hdu.dmin).toBe(1);
    expect(hdu.dmax).toBe(W * H);
  });

  it("pixel range is consistent: dmax > dmin", async () => {
    const bytes = makeSyntheticFITS(3, 2);
    const hdu = await Fixi.extractHDU(bytes, 0);

    expect(hdu.dmax).toBeGreaterThan(hdu.dmin);
    expect(hdu.data.length).toBe(6);
    expect(hdu.axis[1]).toBe(3);  // NAXIS1 (1-indexed)
    expect(hdu.axis[2]).toBe(2);  // NAXIS2
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Fixi adapter — createRustWasmAdapter + handleFITSFile
// ─────────────────────────────────────────────────────────────────────────────

describe("Fixi.createRustWasmAdapter – handleFITSFile", () => {
  function makeAdapter() {
    const adapter = Fixi.createRustWasmAdapter();
    Fixi.configureForJS9(adapter, { fitsCompliance: "strict" });
    adapter.options.error = (msg) => { throw new Error(String(msg)); };
    return adapter;
  }

  it("loads a synthetic FITS and delivers an HDU to the callback", async () => {
    const bytes = makeSyntheticFITS(10, 8);
    const adapter = makeAdapter();

    const hdu = await new Promise((resolve, reject) => {
      adapter.options.error = (msg) => reject(new Error(String(msg)));
      adapter.handleFITSFile(bytes, {}, resolve);
    });

    expect(hdu.bitpix).toBe(-32);
    expect(hdu.axis[1]).toBe(10);  // NAXIS1
    expect(hdu.axis[2]).toBe(8);   // NAXIS2
    expect(hdu.data).toBeInstanceOf(Float32Array);
    expect(hdu.data.length).toBe(80);
    expect(Number.isFinite(hdu.dmin)).toBe(true);
    expect(Number.isFinite(hdu.dmax)).toBe(true);
    expect(hdu.dmax).toBeGreaterThan(hdu.dmin);
  });

  itWithFixtures("loads a real FITS file (U10320.fits) via the adapter", async () => {
    const bytes = fs.readFileSync(path.join(fixturesDir, "U10320.fits"));
    const adapter = makeAdapter();

    const hdu = await new Promise((resolve, reject) => {
      adapter.options.error = (msg) => reject(new Error(String(msg)));
      adapter.handleFITSFile(bytes, {}, resolve);
    });

    expect(hdu.data).toBeInstanceOf(Float32Array);
    expect(hdu.data.length).toBeGreaterThan(0);
    expect(Number.isFinite(hdu.dmin)).toBe(true);
    expect(Number.isFinite(hdu.dmax)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Full JS9 pipeline — FITSRuntime + fixi adapter → handleFITSFile
// ─────────────────────────────────────────────────────────────────────────────

describe("JS9 FITS pipeline – FITSRuntime + fixi adapter", () => {
  function makeJS9() {
    const JS9 = {
      fits: {},
      userOpts: { fits: null },
      globalOpts: {
        extlist: "",
        maxMemory: 0,
        fitsCompliance: false,
        table: { bin: 1 },
        image: { bin: 1 },
      },
      notNull: (v) => v !== undefined && v !== null,
      NewFitsImage() {},
      waiting() {},
      error(msg) { throw new Error(String(msg)); },
    };
    installCoreBasicUtils(JS9);
    globalThis.JS9InstallFITSRuntime(JS9);
    return JS9;
  }

  it("registers and activates the fixi adapter, then loads a synthetic FITS", async () => {
    const JS9 = makeJS9();

    const adapter = Fixi.createRustWasmAdapter();
    Fixi.configureForJS9(adapter, { fitsCompliance: "strict" });
    JS9.registerFITSAdapter("fixi", adapter);
    JS9.useFITSAdapter("fixi");

    expect(JS9.fits.name).toBe("fixi");
    expect(typeof JS9.fits.handleFITSFile).toBe("function");

    const bytes = makeSyntheticFITS(6, 5);

    const hdu = await new Promise((resolve, reject) => {
      adapter.options.error = (msg) => reject(new Error(String(msg)));
      JS9.fits.handleFITSFile(bytes, {}, resolve);
    });

    expect(hdu.bitpix).toBe(-32);
    expect(hdu.axis[1]).toBe(6);
    expect(hdu.axis[2]).toBe(5);
    expect(hdu.data).toBeInstanceOf(Float32Array);
    expect(hdu.data.length).toBe(30);
    expect(hdu.dmax).toBeGreaterThan(hdu.dmin);
  });

  it("exposes wcsInitMode on the registered adapter", () => {
    const JS9 = makeJS9();
    const adapter = Fixi.createRustWasmAdapter();
    Fixi.configureForJS9(adapter, {});
    JS9.registerFITSAdapter("fixi", adapter);
    JS9.useFITSAdapter("fixi");

    // The Rust/WASM adapter initialises WCS from the header text,
    // so JS9 should be told to use "header" mode.
    expect(JS9.wcsInitMode).toBe("header");
  });
});
