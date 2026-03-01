import { describe, expect, test } from "vitest";

await import("../../src/core/colorUtils.ts");

describe("tinycolor replacement", () => {
  test("normalizes hex colors", () => {
    const color = globalThis.tinycolor("#336699");
    expect(color.toHex()).toBe("336699");
    expect(color.toHexString()).toBe("#336699");
  });

  test("converts rgb to hsl", () => {
    const hsl = globalThis.tinycolor("rgb(255, 0, 0)").toHsl();
    expect(Math.round(hsl.h)).toBe(0);
    expect(Math.round(hsl.s * 100)).toBe(100);
    expect(Math.round(hsl.l * 100)).toBe(50);
  });

  test("builds analogous colors", () => {
    const colors = globalThis.tinycolor("#00ff00").analogous(3, 6);
    expect(colors).toHaveLength(3);
    expect(colors[0].toHex()).not.toBe(colors[1].toHex());
  });
});
