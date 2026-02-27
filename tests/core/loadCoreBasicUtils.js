import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createContext, runInContext } from "node:vm";

export function loadCoreBasicUtils() {
  const source = readFileSync(resolve(process.cwd(), "src/core/basicUtils.js"), "utf8");
  const context = createContext({
    isNaN,
    parseFloat,
    isFinite
  });
  runInContext(`${source}\nthis.__CoreBasicUtils = CoreBasicUtils;`, context);
  return context.__CoreBasicUtils;
}
