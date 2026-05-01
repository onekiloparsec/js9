import { loadJS9Runtime, getJS9 } from "@onekiloparsec/js9";
import type {
  JS9Namespace,
  LoadJS9RuntimeOptions
} from "@onekiloparsec/js9";

const DEFAULT_OPTIONS: LoadJS9RuntimeOptions = {
  baseUrl: "/",
  runtimePath: "runtime"
};

let cachedPromise: Promise<JS9Namespace> | null = null;

export function ensureJS9 (
  overrides: Partial<LoadJS9RuntimeOptions> = {}
): Promise<JS9Namespace> {
  if (cachedPromise) return cachedPromise;
  cachedPromise = loadJS9Runtime({ ...DEFAULT_OPTIONS, ...overrides }).catch(
    (error) => {
      cachedPromise = null;
      throw error;
    }
  );
  return cachedPromise;
}

export function getLoadedJS9 (): JS9Namespace | null {
  return getJS9();
}

export type { JS9Namespace } from "@onekiloparsec/js9";
