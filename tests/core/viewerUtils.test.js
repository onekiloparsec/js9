import { beforeAll, describe, expect, it } from "vitest";
import { loadCoreBasicUtils } from "./loadCoreBasicUtils.js";

const installCoreBasicUtils = loadCoreBasicUtils();

beforeAll(async () => {
  await import("../../src/core/viewerUtils.js");
});

function installViewerUtils(overrides = {}) {
  class CanvasRenderingContext2DMock {}
  globalThis.CanvasRenderingContext2D = CanvasRenderingContext2DMock;

  const JS9 = {
    allinone: false,
    globalOpts: {
      loadProxy: true,
      helperType: "helper",
      workDir: "/tmp",
      alerts: false,
      localAccess: true,
      localTemplates: ".fits,.fz"
    },
    hostFS: "/mnt",
    saodtype() {
      return ":".charCodeAt(0);
    },
    isNumber(s) {
      return !Number.isNaN(parseFloat(s)) && Number.isFinite(parseFloat(s));
    },
    vsize(file) {
      return file === "/mnt/x.fits" ? 123 : -1;
    },
    error(message) {
      throw new Error(String(message));
    },
    ...overrides
  };

  installCoreBasicUtils(JS9);
  globalThis.JS9InstallViewerUtils(JS9);
  return JS9;
}

describe("JS9InstallViewerUtils", () => {
  it("handles HMS detection and proxy availability", () => {
    const JS9 = installViewerUtils();

    expect(JS9.isHMS("fk5", ":")).toBe(true);
    expect(JS9.isHMS("galactic", ":")).toBe(false);
    expect(JS9.isHMS("fk5")).toBe(true);

    expect(JS9.proxyAvailable()).toBe("/tmp");
    JS9.allinone = true;
    expect(JS9.proxyAvailable()).toBe(false);
  });

  it("parses FITS cards and basic path helpers", () => {
    const JS9 = installViewerUtils();

    expect(JS9.cardpars("HISTORY  some text here")).toEqual(["HISTORY", "some text here"]);
    expect(JS9.cardpars("COMMENT  comment text")).toEqual(["COMMENT", "comment text"]);
    expect(JS9.cardpars("SIMPLE  =                    T / conforms")).toEqual(["SIMPLE", true]);
    expect(JS9.cardpars("EXTVER  =               12.50 / ext version")).toEqual(["EXTVER", 12.5]);
    expect(JS9.cardpars("NOKEYWORD something")).toBeUndefined();

    expect(JS9.dirname("/a/b/file.fits")).toBe("/a/b/");
    expect(JS9.dirname("file.fits")).toBe("");
  });

  it("normalizes safe paths and rejects XSS-like values", () => {
    const JS9 = installViewerUtils();

    expect(JS9.cleanPath("./a/./b.fits")).toBe("a/b.fits");

    expect(() => JS9.cleanPath("<script>alert(1)</script>", "filename")).toThrow(
      /susceptible to XSS attack/i
    );
    expect(JS9.globalOpts.alerts).toBe(true);
  });

  it("returns local-access virtual file paths only when eligible", () => {
    const JS9 = installViewerUtils();

    expect(JS9.localAccess("x.fits[1]")).toBe("/mnt/x.fits");
    expect(JS9.localAccess("x.txt")).toBeNull();
    expect(JS9.localAccess(null)).toBeNull();
  });

  it("formats and clears tooltip content without wrapped collections", () => {
    const JS9 = installViewerUtils();
    const tooltip = {
      nodeType: 1,
      innerHTML: "",
      style: {},
      offsetWidth: 80,
      offsetHeight: 20,
      getBoundingClientRect() {
        return { width: 80, height: 20 };
      }
    };
    const im = {
      id: "im1",
      display: {
        width: 200,
        height: 120,
        tooltip
      }
    };
    const xreg = {
      data: {
        tag: "region-1"
      }
    };

    JS9.tooltip(190, 110, "$im.id:$data.tag", im, xreg, {});

    expect(tooltip.innerHTML).toBe("im1:region-1");
    expect(tooltip.style.display).toBe("inline-block");
    expect(tooltip.style.left).toBe("110px");
    expect(tooltip.style.top).toBe("90px");

    JS9.tooltip(10, 10, "", im, xreg, {});

    expect(tooltip.innerHTML).toBe("");
    expect(tooltip.style.left).toBe("-9999px");
    expect(tooltip.style.display).toBe("none");
  });

  it("supports tooltip nodes wrapped in array-like objects", () => {
    const JS9 = installViewerUtils();
    const tooltip = {
      nodeType: 1,
      innerHTML: "",
      style: {},
      offsetWidth: 40,
      offsetHeight: 10,
      getBoundingClientRect() {
        return { width: 40, height: 10 };
      }
    };
    const im = {
      display: {
        width: 100,
        height: 80,
        tooltip: {
          0: tooltip,
          length: 1
        }
      }
    };

    JS9.tooltip(5, 5, "hello", im, { data: {} }, {});

    expect(tooltip.innerHTML).toBe("hello");
    expect(tooltip.style.display).toBe("inline-block");
  });
});
