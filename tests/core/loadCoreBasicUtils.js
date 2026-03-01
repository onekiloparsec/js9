export async function loadCoreBasicUtils() {
  await import("../../src/core/basicUtils.ts");
  return globalThis.CoreBasicUtils;
}
