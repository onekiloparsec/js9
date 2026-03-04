import { describe, expect, it } from "vitest";
import { JS9MathUtils } from "../../src/core/mathUtils.ts";

describe("JS9MathUtils", () => {
  it("computes precision hints from floating ranges", () => {
    expect(JS9MathUtils.floatPrecision(0.0012, 0.01)).toBe(-2);
    expect(JS9MathUtils.floatPrecision(1234, 5)).toBe(3);
  });

  it("computes polygon center using the bounding box", () => {
    const center = JS9MathUtils.centerPolygon([
      { x: -2, y: 5 },
      { x: 6, y: 3 },
      { x: 1, y: 9 }
    ]);
    expect(center).toEqual({ x: 2, y: 6 });
  });

  it("computes polygon centroid and average-point fallback", () => {
    const square = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 }
    ];

    expect(JS9MathUtils.centroidPolygon(square, false)).toEqual({ x: 1, y: 1 });
    expect(JS9MathUtils.centroidPolygon(square, true)).toEqual({ x: 1, y: 1 });
  });
});
