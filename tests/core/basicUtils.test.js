import { describe, expect, it } from "vitest";
import { loadCoreBasicUtils } from "./loadCoreBasicUtils.js";

describe("CoreBasicUtils", () => {
  it("installs primitive null/number helpers", async () => {
    const install = await loadCoreBasicUtils();
    const JS9 = {};
    install(JS9);

    expect(JS9.isNumber("12.3")).toBe(true);
    expect(JS9.isNumber("-4e2")).toBe(true);
    expect(JS9.isNumber("2016-5")).toBe(false);
    expect(JS9.isNumber("abc")).toBe(false);

    expect(JS9.notNull(0)).toBe(true);
    expect(JS9.notNull(null)).toBe(false);
    expect(JS9.isNull(undefined)).toBe(true);
    expect(JS9.isNull("x")).toBe(false);

    expect(JS9.defNull(undefined, "fallback")).toBe("fallback");
    expect(JS9.defNull("value", "fallback")).toBe("value");
  });

  it("installs WCS-system classification helpers", async () => {
    const install = await loadCoreBasicUtils();
    const JS9 = {};
    install(JS9);

    expect(JS9.isWCSSys("fk5")).toBe(true);
    expect(JS9.isWCSSys("image")).toBe(false);
    expect(JS9.notWCS("physical")).toBe(true);
    expect(JS9.notWCS("icrs")).toBe(false);
  });

  it("installs collection/object helper utilities", async () => {
    const install = await loadCoreBasicUtils();
    const JS9 = {};
    install(JS9);

    expect(JS9.isArray([1, 2])).toBe(true);
    expect(JS9.isArray("x")).toBe(false);
    expect(JS9.inArray("b", ["a", "b", "c"])).toBe(1);
    expect(JS9.inArray("z", ["a", "b", "c"])).toBe(-1);

    const merged = JS9.extend(true, { a: { b: 1 }, c: [1, 2] }, { a: { d: 2 }, c: [3] });
    expect(merged).toEqual({ a: { b: 1, d: 2 }, c: [3, 2] });

    expect(JS9.isWrappedCollection({ __js9Wrapped: true, length: 1 })).toBe(true);
    expect(JS9.isWrappedCollection({ length: 1 })).toBe(false);
  });
});
