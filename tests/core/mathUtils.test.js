import { beforeAll, describe, expect, it } from "vitest";

beforeAll(async () => {
  await import("../../src/core/mathUtils.ts");
});

describe("JS9MathUtils", () => {
  it("computes precision hints from floating ranges", () => {
    const utils = globalThis.JS9MathUtils;
    expect(utils.floatPrecision(0.0012, 0.01)).toBe(-2);
    expect(utils.floatPrecision(1234, 5)).toBe(3);
  });

  it("computes polygon center using the bounding box", () => {
    const utils = globalThis.JS9MathUtils;
    const center = utils.centerPolygon([
      { x: -2, y: 5 },
      { x: 6, y: 3 },
      { x: 1, y: 9 }
    ]);
    expect(center).toEqual({ x: 2, y: 6 });
  });

  it("computes polygon centroid and average-point fallback", () => {
    const utils = globalThis.JS9MathUtils;
    const square = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 }
    ];

    expect(utils.centroidPolygon(square, false)).toEqual({ x: 1, y: 1 });
    expect(utils.centroidPolygon(square, true)).toEqual({ x: 1, y: 1 });
  });
});
