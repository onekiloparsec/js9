import { describe, expect, test } from "vitest";

await import("../../src/core/sprintf.ts");

describe("sprintf", () => {
  test("formats strings and integers with width", () => {
    expect(globalThis.sprintf("%s %04d", "id", 12)).toBe("id 0012");
  });

  test("formats floats with precision", () => {
    expect(globalThis.sprintf("%.2f", 3.14159)).toBe("3.14");
  });

  test("formats hex with padding", () => {
    expect(globalThis.sprintf("#%02x%02x%02x", 1, 16, 255)).toBe("#0110ff");
  });
});
