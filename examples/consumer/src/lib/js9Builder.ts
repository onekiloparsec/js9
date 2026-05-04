import type { JS9Namespace } from "@onekiloparsec/js9";
import type { JS9Source } from "./types";

export interface JS9DisplaySettings {
  colormap?: string;
  contrast?: number;
  bias?: number;
  scale?: string;
  scalemin?: number;
  scalemax?: number;
  zoom?: number | string;
}

export interface JS9PixelGrid {
  size: number;
  values: Float32Array;
  centerX: number;
  centerY: number;
  min: number;
  max: number;
}

export type JS9MouseHandler = (info: {
  imageX: number;
  imageY: number;
  value: number | null;
}) => void;

/** RGB triplet returned by getColorCells(). */
export type JS9ColorCell = [number, number, number];

/**
 * Action bound to a mouse-button drag. JS9's defaults are:
 *   "display value/position" (no button), "change contrast/bias" (left),
 *   "pan the image" (middle). We rebind left → pan by default.
 */
export type JS9MouseAction =
  | "display value/position"
  | "change contrast/bias"
  | "pan the image"
  | "select region"
  | "select panner"
  | "select magnifier";

export interface JS9DisplayController {
  readonly id: string;
  load: (src: JS9Source, options?: JS9DisplaySettings) => Promise<void>;
  close: () => void;
  setColormap: (colormap?: string) => void;
  /** Reset contrast/bias to the colormap's defaults (no LUT change). */
  resetColormap: () => void;
  setScale: (scale?: string) => void;
  setZoom: (zoom: number | string) => void;
  resize: (width: number, height: number) => void;
  fit: () => void;
  /** Configure what each mouse button does when dragging on the display. */
  setMouseActions: (actions: JS9MouseAction[]) => void;
  /** Snapshot of the active LUT (256 entries by default), or null. */
  getColorCells: () => JS9ColorCell[] | null;
  getPixelGrid: (
    imageX: number,
    imageY: number,
    halfSize: number
  ) => JS9PixelGrid | null;
  onMouseMove: (handler: JS9MouseHandler) => () => void;
}

export function createDisplayController (
  js9: JS9Namespace,
  id: string
): JS9DisplayController {
  // JS9.parsePublicArgs only treats the last arg as a display target when it
  // is an object shaped exactly like `{display: id}`. A bare string id is
  // misinterpreted as opts and JSON.parsed, throwing "can't parse resize opts".
  const target: any = { display: id };
  const j = js9 as unknown as Record<string, any>;

  // zscale / zmax / dataminmax are clipping algorithms applied via setScale,
  // not stretch functions. Forwarding them through JS9.Load opts assigns them
  // directly to params.scale, after which the render switch hits 'default'
  // and throws "unknown scale". Apply them post-load instead.
  const CLIP_ONLY_SCALES = new Set(["zscale", "zmax", "dataminmax"]);

  function load (src: JS9Source, options: JS9DisplaySettings = {}): Promise<void> {
    if (!src) {
      close();
      return Promise.resolve();
    }
    const deferredScale = options.scale && CLIP_ONLY_SCALES.has(options.scale)
      ? options.scale
      : null;
    return new Promise((resolve, reject) => {
      const opts: Record<string, unknown> = {
        onload: () => {
          if (deferredScale) {
            try { (js9.SetScale as any)(deferredScale, target); } catch { /* ignore */ }
          }
          resolve();
        },
        onerror: (msg: string) => reject(new Error(msg || "JS9 load failed"))
      };
      if (options.colormap) opts.colormap = options.colormap;
      if (options.scale && !deferredScale) opts.scale = options.scale;
      if (typeof options.scalemin === "number") opts.scalemin = options.scalemin;
      if (typeof options.scalemax === "number") opts.scalemax = options.scalemax;
      if (options.zoom !== undefined) opts.zoom = options.zoom;

      // JS9.Load takes URL strings, File or Blob — the runtime branches on
      // `instanceof Blob` internally. Wrap a bare Blob in a File so JS9 has
      // a name to display in its info pane.
      const arg = typeof src === "string"
        ? src
        : src instanceof File
          ? src
          : new File([src], "image.fits", { type: "application/fits" });
      js9.Load(arg as any, opts, target);
    });
  }

  function close () {
    try { js9.CloseImage({}, target); } catch { /* ignore */ }
  }

  function setColormap (colormap?: string) {
    if (!colormap) return;
    // Pass only (name, target). setColormap branches on args.length, and
    // forwarding undefined contrast/bias triggers the (name, contrast, bias)
    // branch, scrambling the LUT.
    (js9.SetColormap as any)(colormap, target);
  }

  function resetColormap () {
    // SetColormap("reset") returns contrast/bias to defaults without
    // changing the colormap itself. Useful after the user dragged the
    // intensity bar and wants to "go back to neutral".
    try { (js9.SetColormap as any)("reset", target); } catch { /* ignore */ }
  }

  function setMouseActions (actions: any[]) {
    // mouseActions lives on the display object; mutating it changes drag
    // behavior immediately for that display only (no global side effects).
    try {
      const display = typeof j.lookupDisplay === "function"
        ? j.lookupDisplay(id)
        : null;
      if (display && Array.isArray(actions)) {
        display.mouseActions = actions.slice(0);
      }
    } catch { /* ignore */ }
  }

  function getColorCells (): JS9ColorCell[] | null {
    const im = getCurrentImage();
    const cells = im?.colorCells;
    if (!Array.isArray(cells) || cells.length === 0) return null;
    return cells.map((c: any) => [Number(c?.[0]) || 0, Number(c?.[1]) || 0, Number(c?.[2]) || 0]);
  }

  function setScale (scale?: string) {
    if (!scale) return;
    // zscale / zmax / dataminmax are *clipping* modes in JS9: they only
    // update params.scaleclipping + scalemin/max and leave params.scale
    // (the stretch function) untouched. So going `log` → `zscale` would
    // keep the log stretch and look identical — the user expects "back to
    // z-scale" to mean "auto-clip + linear". Force linear first.
    if (CLIP_ONLY_SCALES.has(scale)) {
      (js9.SetScale as any)("linear", target);
    }
    (js9.SetScale as any)(scale, target);
  }

  function setZoom (zoom: number | string) {
    js9.SetZoom(zoom, target);
  }

  function resize (width: number, height: number) {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    try {
      if (typeof j.ResizeDisplay === "function") j.ResizeDisplay(w, h, target);
    } catch { /* ignore */ }
  }

  function fit () {
    try { if (typeof j.SetZoom === "function") j.SetZoom("toFit", target); } catch { /* ignore */ }
    // SetPan() only recenters when called with no positional args — passing
    // undefined,undefined is taken as the (invalid) pan target. Just pass the
    // {display} so the wrapper pops it and forwards an empty argv.
    try { if (typeof j.SetPan === "function") j.SetPan(target); } catch { /* ignore */ }
  }

  function getCurrentImage (): any | null {
    try {
      // `target` is already shaped {display: id}; don't double-wrap it. The
      // earlier {display: target} form built {display: {display: id}}, which
      // parsePublicArgs unwrapped to `{display: id}` and then JS9.getImage
      // tried to use *that* as a display name, returning null.
      return typeof j.GetImage === "function" ? j.GetImage(target) : null;
    } catch { return null; }
  }

  function getPixelGrid (imageX: number, imageY: number, halfSize: number): JS9PixelGrid | null {
    const im = getCurrentImage();
    const raw = im?.raw;
    const data = raw?.data;
    const w = Number(raw?.width);
    const h = Number(raw?.height);
    if (!data || !Number.isFinite(w) || !Number.isFinite(h)) return null;

    const half = Math.max(0, Math.floor(halfSize));
    const size = half * 2 + 1;
    const values = new Float32Array(size * size);
    const cx = Math.round(imageX);
    const cy = Math.round(imageY);
    let min = Infinity;
    let max = -Infinity;
    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        let v = NaN;
        if (x >= 0 && x < w && y >= 0 && y < h) {
          v = data[y * w + x];
          if (Number.isFinite(v)) {
            if (v < min) min = v;
            if (v > max) max = v;
          }
        }
        values[(dy + half) * size + (dx + half)] = v;
      }
    }
    if (!Number.isFinite(min)) min = 0;
    if (!Number.isFinite(max)) max = 0;
    return { size, values, centerX: cx, centerY: cy, min, max };
  }

  function onMouseMove (handler: JS9MouseHandler): () => void {
    const div = typeof document !== "undefined" ? document.getElementById(id) : null;
    if (!div) return () => {};
    // JS9's own document-level mousemove handler keeps `im.ipos` updated with
    // the cursor position in image coordinates whenever the cursor is over a
    // display. Reading that is far more robust than redoing the
    // display→image conversion ourselves (which depends on the exact inner
    // canvas geometry that JS9 owns).
    const listener = () => {
      const im = getCurrentImage();
      const ipos = im?.ipos;
      const imageX = Number(ipos?.x);
      const imageY = Number(ipos?.y);
      if (!Number.isFinite(imageX) || !Number.isFinite(imageY)) {
        handler({ imageX: NaN, imageY: NaN, value: null });
        return;
      }
      const raw = im?.raw;
      const data = raw?.data;
      const w = Number(raw?.width);
      const h = Number(raw?.height);
      let value: number | null = null;
      const ix = Math.round(imageX);
      const iy = Math.round(imageY);
      if (data && ix >= 0 && ix < w && iy >= 0 && iy < h) {
        const v = data[iy * w + ix];
        value = Number.isFinite(v) ? v : null;
      }
      handler({ imageX, imageY, value });
    };
    const leaveListener = () => handler({ imageX: NaN, imageY: NaN, value: null });
    div.addEventListener("mousemove", listener);
    div.addEventListener("mouseleave", leaveListener);
    return () => {
      div.removeEventListener("mousemove", listener);
      div.removeEventListener("mouseleave", leaveListener);
    };
  }

  return {
    id, load, close,
    setColormap, resetColormap,
    setScale, setZoom,
    resize, fit,
    setMouseActions, getColorCells,
    getPixelGrid, onMouseMove
  };
}
