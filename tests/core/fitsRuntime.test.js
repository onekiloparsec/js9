import { beforeAll, describe, expect, it } from "vitest";
import { loadCoreBasicUtils } from "./loadCoreBasicUtils.js";

let installCoreBasicUtils;

beforeAll(async () => {
  installCoreBasicUtils = await loadCoreBasicUtils();
  await import("../../src/core/fitsRuntime.ts");
});

function makeJS9() {
  return {
    fits: {},
    userOpts: { fits: null },
    globalOpts: {
      extlist: "",
      maxMemory: 0,
      fitsCompliance: false,
      table: { bin: 1 },
      image: { bin: 1 }
    },
    notNull(v) {
      return v !== undefined && v !== null;
    },
    NewFitsImage() {},
    waiting() {},
    error(message) {
      throw new Error(String(message));
    }
  };
}

describe("JS9InstallFITSRuntime", () => {
  it("registers aliases and activates an adapter by alias", () => {
    globalThis.window = {};

    const JS9 = makeJS9();
    installCoreBasicUtils(JS9);
    globalThis.JS9InstallFITSRuntime(JS9);

    const adapter = {
      marker: 42,
      handleFITSFile() {},
      getFITSImage() {},
      cleanupFITSFile() {},
      maxFITSMemory() {},
      vmalloc() {
        return this.marker;
      },
      wcsInitMode: "header"
    };

    JS9.registerFITSAdapter("custom", adapter, { aliases: ["cstm"] });
    expect(JS9.listFITSAdapters()).toContain("custom");

    const selected = JS9.useFITSAdapter("CSTM");
    expect(selected).toBe("custom");
    expect(JS9.fits.name).toBe("custom");
    expect(JS9.vmalloc()).toBe(42);
    expect(JS9.wcsInitMode).toBe("header");
  });

  it("falls back to captured runtime methods when adapter omits optional methods", () => {
    globalThis.window = {};

    const JS9 = makeJS9();
    installCoreBasicUtils(JS9);
    JS9.vsize = () => -77;
    globalThis.JS9InstallFITSRuntime(JS9);
    JS9.captureFITSRuntimeFallbacks();

    const minimalAdapter = {
      handleFITSFile() {},
      getFITSImage() {},
      cleanupFITSFile() {},
      maxFITSMemory() {}
    };

    JS9.registerFITSAdapter("minimal", minimalAdapter);
    JS9.useFITSAdapter("minimal");
    expect(JS9.vsize()).toBe(-77);
    expect(JS9.wcsInitMode).toBe("pointer");
  });

  it("throws for unknown adapter names in silent fitsLibrary mode", () => {
    globalThis.window = {};

    const JS9 = makeJS9();
    installCoreBasicUtils(JS9);
    globalThis.JS9InstallFITSRuntime(JS9);

    expect(() => JS9.fitsLibrary("does-not-exist", { silent: true })).toThrow(
      /unknown fits library/i
    );
  });

  it("accepts an adapter that emits XISF-derived HDUs", () => {
    globalThis.window = {};

    const JS9 = makeJS9();
    installCoreBasicUtils(JS9);
    globalThis.JS9InstallFITSRuntime(JS9);

    let captured = null;
    const xisfAdapter = {
      name: "fixi",
      handleFITSFile(_file, _opts, handler) {
        const hdu = {
          file: "sample.xisf",
          fits: { vfile: "sample.xisf", file: "sample.xisf" },
          bitpix: -32,
          naxis: 2,
          axis: [0, 4, 4],
          image: new Float32Array(16),
          data: new Float32Array(16),
          dmin: 0,
          dmax: 1,
          head: {
            SIMPLE: true,
            BITPIX: -32,
            NAXIS: 2,
            NAXIS1: 4,
            NAXIS2: 4,
            FIXI_FORMAT: "xisf"
          },
          card: [],
          ncard: 0,
          imtab: "image",
          bin: 1,
          x1: 1,
          y1: 1
        };
        captured = hdu;
        handler(hdu);
      },
      getFITSImage() {},
      cleanupFITSFile() {},
      maxFITSMemory() {}
    };

    JS9.registerFITSAdapter("fixi", xisfAdapter);
    JS9.useFITSAdapter("fixi");

    JS9.fits.handleFITSFile({}, {}, (hdu) => {
      expect(hdu.bitpix).toBe(-32);
      expect(hdu.naxis).toBe(2);
      expect(hdu.head.FIXI_FORMAT).toBe("xisf");
      expect(hdu.image).toBeInstanceOf(Float32Array);
    });

    expect(captured).not.toBeNull();
  });
});
