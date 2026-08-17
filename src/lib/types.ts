/**
 * Public types for the JS9 library.
 * These are stable, consumer-facing types.
 * Internal implementation types live in src/types/js9-core.d.ts.
 */

// ---------------------------------------------------------------------------
// Progress events emitted during loadJS9Runtime()
// ---------------------------------------------------------------------------

export interface JS9ProgressEvent {
    type: "style" | "script";
    url: string;
    phase: "loading" | "loaded" | "cached" | "error";
}

// ---------------------------------------------------------------------------
// Options for loadJS9Runtime()
// ---------------------------------------------------------------------------

export interface LoadJS9RuntimeOptions {
    /** URL prefix under which the runtime assets are served (e.g. "/static"). */
    baseUrl?: string;
    /** Sub-path inside baseUrl that holds the runtime bundle (default: "runtime"). */
    runtimePath?: string;
    /** CSS files to inject; relative to runtimePath (default: ["support.css","viewer.css"]). */
    styles?: string[];
    /** Core scripts to inject; relative to runtimePath (default: ["prefs.js","runtime.js"]). */
    scripts?: string[];
    /** Whether to also load the optional plugin scripts (default: false). */
    includePlugins?: boolean;
    /** Plugin scripts to use when includePlugins is true. */
    pluginScripts?: string[];
    /** Optional callback invoked for each asset as it loads. */
    onProgress?: (event: JS9ProgressEvent) => void;
}

// ---------------------------------------------------------------------------
// JS9 public API surface
// ---------------------------------------------------------------------------

/**
 * Minimal shape of a JS9 display object as exposed to library consumers.
 * The runtime object has many more fields; only the stable subset is typed here.
 */
export interface JS9DisplayLike {
    id?: string;
    image?: unknown;
    layers?: Record<string, unknown>;
    pluginInstances?: Record<string, unknown>;
}

/** Optional display targeting parameter accepted by most JS9 methods. */
export type JS9DisplayTarget = string | JS9DisplayLike;

/**
 * Trailing call argument used by every public JS9 method to pin the call to
 * a specific display. The runtime (`JS9.parsePublicArgs`) only recognises it
 * when it is the LAST positional argument AND is an object whose only own
 * property is `display`. Passing the display id as a bare string in the last
 * position is silently ignored — it is treated as an extra method argument
 * by the underlying image method.
 *
 * @example
 *   JS9.SetScale("log");                                // current display
 *   JS9.SetScale("log", { display: "myJS9" });          // pinned
 *   JS9.SetScale("user", 0.1, 0.5, { display: "myJS9" });
 */
export interface JS9PublicCallTarget {
    display: JS9DisplayTarget;
}

/**
 * Names accepted by `setScale` / `SetScale`.
 *
 * - The first eight (`linear`–`sinh`) are the registered scale algorithms
 *   from `JS9.scales`.
 * - The last four (`dataminmax`, `zscale`, `zmax`, `user`) are scale-clipping
 *   modes that update `params.scaleclipping` plus `scalemin`/`scalemax`
 *   without changing the algorithm.
 *
 * The `(string & {})` tail keeps the union assignable from a plain `string`
 * for forward compatibility while still suggesting the well-known names in
 * editor autocomplete.
 */
export type JS9ScaleName =
    | "linear"
    | "log"
    | "histeq"
    | "power"
    | "sqrt"
    | "squared"
    | "asinh"
    | "sinh"
    | "dataminmax"
    | "zscale"
    | "zmax"
    | "user"
    | (string & {});

/**
 * `JS9.SetScale` is variadic. The runtime overloads are:
 *
 * - `SetScale(scale)` — set the algorithm or clipping mode by name
 * - `SetScale(low, high)` — set `scalemin`/`scalemax` with `scaleclipping="user"`
 *   (no algorithm change)
 * - `SetScale(scale, low, high)` — set algorithm + min + max
 *
 * Any of these accepts a trailing `{ display }` object to target a specific
 * display.
 */
export interface JS9SetScale {
    (scale: JS9ScaleName): void;
    (scale: JS9ScaleName, target: JS9PublicCallTarget): void;
    (low: number, high: number): void;
    (low: number, high: number, target: JS9PublicCallTarget): void;
    (scale: JS9ScaleName, low: number, high: number): void;
    (scale: JS9ScaleName, low: number, high: number, target: JS9PublicCallTarget): void;
}

export interface JS9ColormapInfo {
    colormap: string;
    contrast: number;
    bias: number;
}

export interface JS9ScaleInfo {
    scale: JS9ScaleName;
    scalemin: number;
    scalemax: number;
    /** Mirrors `params.scaleclipping`: which sub-mode produced scalemin/scalemax. */
    scaleclipping?: "dataminmax" | "zscale" | "zmax" | "user";
}

export interface JS9PanInfo {
    x: number;
    y: number;
}

export interface JS9ImageInfo {
    id?: string;
    file?: string;
    width?: number;
    height?: number;
    bitpix?: number;
    [key: string]: unknown;
}

export interface JS9LoadOptions {
    /** Callback fired when the image finishes loading. */
    onload?: (im: JS9ImageInfo) => void;
    /** Callback fired on load error. */
    onerror?: (msg: string) => void;
    colormap?: string;
    scale?: string;
    zoom?: number | string;
    [key: string]: unknown;
}

export interface JS9RegionOptions {
    color?: string;
    width?: number;
    [key: string]: unknown;
}

/** Summary of one measured quantity over the detected stars. */
export interface JS9StatSummary {
    median: number;
    mean: number;
    /** Not reported for every statistic (eccentricity omits it). */
    stddev?: number;
}

/** One detected star, in image coordinates. */
export interface JS9Star {
    x: number;
    y: number;
    /** Half-flux radius, in pixels. */
    hfr: number;
    /** Full width at half maximum, in pixels. */
    fwhm: number;
    /** Background-subtracted integrated flux. */
    flux: number;
    /** Brightest pixel value. */
    peak: number;
    /** Gaussian sigma along each axis, in pixels. */
    sigmaX: number;
    sigmaY: number;
    /** 0 for a round star, approaching 1 as it elongates. */
    eccentricity: number;
}

/** Result of Image.computeStarMetrics() / JS9.ComputeStarMetrics(). */
export interface JS9StarMetrics {
    /** Stars detected in the whole frame. */
    count: number;
    /** Stars actually returned in `stars`, capped by maxStarsReturned. */
    returned?: number;
    /** Identifier of the detector that produced these numbers. */
    algorithm?: string;
    hfr?: JS9StatSummary;
    fwhm?: JS9StatSummary;
    eccentricity?: JS9StatSummary;
    /** Sigma-clipped background median. */
    background?: number;
    /** Sigma-clipped background standard deviation (image "noise"). */
    noise?: number;
    /** Detection threshold applied (typically background + N*noise). */
    threshold?: number;
    stars?: JS9Star[];
}

export interface JS9StarMetricsOptions {
    /** Detection threshold in units of background noise. Default 5. */
    sigmaThreshold?: number;
    /** Smallest and largest accepted blob, in pixels. Default 3 / 1024. */
    minSize?: number;
    maxSize?: number;
    /** Largest accepted star radius, in pixels. Default 12. */
    maxRadius?: number;
    /** Cap on the length of `stars`. Default 500. */
    maxStarsReturned?: number;
}

/**
 * The JS9 runtime namespace returned by loadJS9Runtime().
 *
 * Only the most commonly used methods are typed here; the full API is large
 * and still being migrated.  Access untyped methods via index access:
 *   (js9 as Record<string, unknown>).SomeMethod(...)
 * or wait for Phase 4 when the full API is exported as ES modules.
 */
export interface JS9Namespace {
    // --- Identity ---
    readonly NAME: "JS9";
    readonly VERSION: string;

    // --- Lifecycle ---
    WORKERFILE: string;
    inited: boolean;
    globalOpts: Record<string, unknown>;
    init(): void;

    // --- Image loading ---
    // Load also accepts `opts.display` as an alternative to the trailing
    // `{ display }` form; both work because Load merges them internally.
    Load(url: string, opts?: JS9LoadOptions, target?: JS9PublicCallTarget): void;
    LoadFITSFile(file: File, opts?: JS9LoadOptions, target?: JS9PublicCallTarget): void;
    CloseImage(opts?: Record<string, unknown>, target?: JS9PublicCallTarget): void;

    // --- Image info ---
    GetImageData(fits?: boolean, target?: JS9PublicCallTarget): JS9ImageInfo | null;

    // --- Statistics ---
    /** Detect stars and summarise HFR/FWHM/eccentricity for the loaded image. */
    ComputeStarMetrics(
        opts?: JS9StarMetricsOptions,
        target?: JS9PublicCallTarget
    ): JS9StarMetrics | null;

    // --- Displays ---
    GetDisplays(): JS9DisplayLike[];

    // --- Colormap ---
    SetColormap(name: string, target?: JS9PublicCallTarget): void;
    SetColormap(name: string, contrast: number, bias: number, target?: JS9PublicCallTarget): void;
    GetColormap(target?: JS9PublicCallTarget): JS9ColormapInfo;

    // --- Scale ---
    SetScale: JS9SetScale;
    GetScale(target?: JS9PublicCallTarget): JS9ScaleInfo;

    // --- Zoom / Pan ---
    SetZoom(zoom: number | string, target?: JS9PublicCallTarget): void;
    GetZoom(target?: JS9PublicCallTarget): number;
    /** Pan to image center. */
    SetPan(target?: JS9PublicCallTarget): void;
    /** Pan using a `"x y"` / `"mouse"` string or a JSON-encoded position. */
    SetPan(spec: string, target?: JS9PublicCallTarget): void;
    /** Pan to explicit image coordinates. */
    SetPan(x: number, y: number, target?: JS9PublicCallTarget): void;
    GetPan(target?: JS9PublicCallTarget): JS9PanInfo;

    // --- Regions ---
    AddRegions(regions: unknown, opts?: JS9RegionOptions, target?: JS9PublicCallTarget): unknown;
    GetRegions(region?: unknown, target?: JS9PublicCallTarget): unknown[];
    RemoveRegions(region?: unknown, target?: JS9PublicCallTarget): void;

    // Escape hatch — the full JS9 API is much larger; anything not listed
    // above is still accessible at runtime, just not yet typed.
    [key: string]: unknown;
}
