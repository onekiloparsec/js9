export {};

declare global {
    // --- lib/index.ts loader state (internal) ---
    var __JS9_LOADER_STATE__: Record<string, unknown> | undefined;

    interface JS9ShapeEngine {
        init: () => void;
        installDisplayApi?: (JS9: unknown) => void;
        getDefaultOptions?: () => Record<string, unknown> | null;
        applyDefaults?: (defaults: Record<string, unknown>) => void;
        getDevicePixelRatio?: () => number;
        createActiveSelection?: (objects: unknown[], canvas: unknown) => unknown;
        buildSelection?: (objects: unknown[], canvas: unknown) => unknown;
        activateSelection?: (canvas: unknown, selection: unknown) => unknown;
        clearSelection?: (canvas: unknown) => unknown;
        groupSelection?: (canvas: unknown, objects: unknown[]) => unknown;
        updateChildren?: (dlayer: unknown, shape: unknown, type: string) => void;
    }

    interface JS9ShapeEngineRegistry {
        engines: Record<string, JS9ShapeEngine>;
        active: string | null;
        defaults: {
            getDevicePixelRatio: () => number;
            getDefaultOptions: () => Record<string, unknown> | null;
            applyDefaults: (defaults: Record<string, unknown>) => void;
            createActiveSelection: (objects: unknown[], canvas: unknown) => unknown;
            buildSelection: (objects: unknown[], canvas: unknown) => unknown;
            activateSelection: (canvas: unknown, selection: unknown) => unknown;
            clearSelection: (canvas: unknown) => unknown;
            groupSelection: (canvas: unknown, objects: unknown[]) => unknown;
            updateChildren: (dlayer: unknown, shape: unknown, type: string) => void;
        };
        register: (name: string, engine: JS9ShapeEngine) => JS9ShapeEngine;
        use: (name: string) => JS9ShapeEngine | null;
        get: () => JS9ShapeEngine | null;
        getMethod: (name: keyof JS9ShapeEngineRegistry["defaults"]) => Function | null;
        getDefaultOptions: () => Record<string, unknown> | null;
        applyDefaults: (defaults: Record<string, unknown>) => void;
        getDevicePixelRatio: () => number;
        createActiveSelection: (objects: unknown[], canvas: unknown) => unknown;
        buildSelection: (objects: unknown[], canvas: unknown) => unknown;
        activateSelection: (canvas: unknown, selection: unknown) => unknown;
        clearSelection: (canvas: unknown) => unknown;
        groupSelection: (canvas: unknown, objects: unknown[]) => unknown;
        updateChildren: (dlayer: unknown, shape: unknown, type: string) => void;
    }

    interface JS9DisplayLike {
        id?: string;
        image?: JS9ImageLike | null;
        layers?: Record<string, JS9ShapeLayerLike>;
        pluginInstances?: Record<string, JS9PluginInstanceLike>;
    }

    interface JS9ImageLike {
        display?: JS9DisplayLike | null;
        layers?: Record<string, JS9ShapeLayerLike>;
    }

    interface JS9PluginInstanceLike {
        divjq?: unknown;
        display?: JS9DisplayLike | null;
        status?: string;
    }

    interface JS9ShapeLayerLike {
        canvas?: unknown;
        dlayer?: unknown;
        layerName?: string;
        nshape?: number;
    }

    // Phase 5: viewer.ts decomposition installers
    var JS9InstallDisplay: (JS9: any) => void;
    var JS9InstallImageCore: (JS9: any) => void;
    var JS9InstallImageRender: (JS9: any) => void;
    var JS9InstallImageCoords: (JS9: any) => void;
    var JS9InstallImageData: (JS9: any) => void;
    var JS9InstallRegions: (JS9: any) => void;
    var JS9InstallOverlays: (JS9: any) => void;
}
