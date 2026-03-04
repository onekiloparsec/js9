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

/** Optional display targeting parameter accepted by most JS9 methods. */
export type JS9DisplayTarget = string | JS9DisplayLike;

export interface JS9ColormapInfo {
    colormap: string;
    contrast: number;
    bias: number;
}

export interface JS9ScaleInfo {
    scale: string;
    scalemin: number;
    scalemax: number;
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
    Load(url: string, opts?: JS9LoadOptions, display?: JS9DisplayTarget): void;
    LoadFITSFile(file: File, opts?: JS9LoadOptions, display?: JS9DisplayTarget): void;
    CloseImage(opts?: Record<string, unknown>, display?: JS9DisplayTarget): void;

    // --- Image info ---
    GetImageData(fits?: boolean, display?: JS9DisplayTarget): JS9ImageInfo | null;

    // --- Displays ---
    GetDisplays(): JS9DisplayLike[];

    // --- Colormap ---
    SetColormap(name: string, contrast?: number, bias?: number, display?: JS9DisplayTarget): void;
    GetColormap(display?: JS9DisplayTarget): JS9ColormapInfo;

    // --- Scale ---
    SetScale(scale: string, low?: number, high?: number, display?: JS9DisplayTarget): void;
    GetScale(display?: JS9DisplayTarget): JS9ScaleInfo;

    // --- Zoom / Pan ---
    SetZoom(zoom: number | string, display?: JS9DisplayTarget): void;
    GetZoom(display?: JS9DisplayTarget): number;
    SetPan(x?: number, y?: number, display?: JS9DisplayTarget): void;
    GetPan(display?: JS9DisplayTarget): JS9PanInfo;

    // --- Regions ---
    AddRegions(regions: unknown, opts?: JS9RegionOptions, display?: JS9DisplayTarget): unknown;
    GetRegions(region?: unknown, display?: JS9DisplayTarget): unknown[];
    RemoveRegions(region?: unknown, display?: JS9DisplayTarget): void;

    // Escape hatch — the full JS9 API is much larger; anything not listed
    // above is still accessible at runtime, just not yet typed.
    [key: string]: unknown;
}
