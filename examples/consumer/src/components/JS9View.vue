<template>
  <div
    ref="wrapper"
    class="js9-view-wrapper"
    :id="wrapperId"
    :style="wrapperStyle"
  >
    <div v-if="!ready" class="js9-loading">Loading JS9 View…</div>
    <div
      :id="displayId"
      class="JS9"
      :class="{ 'opacity-hidden': !ready }"
      :style="displayStyle"
    />
  </div>
</template>

<script lang="ts" setup>
  import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue";
  import { ensureJS9 } from "../lib/js9Loader";
  import {
    createDisplayController,
    type JS9DisplayController
  } from "../lib/js9Builder";
  import type { JS9Source } from "../lib/types";

  const props = withDefaults(
    defineProps<{
      src?: JS9Source;
      width?: string | number;
      height?: string | number;
      colormap?: string;
      scale?: string;
      zoom?: number | string;
      fitOnLoad?: boolean;
      fitOnResize?: boolean;
    }>(),
    {
      src: null,
      width: "100%",
      height: "100%",
      fitOnLoad: true,
      fitOnResize: true
    }
  );

  const emit = defineEmits<{
    (e: "ready", controller: JS9DisplayController): void;
    (e: "loaded"): void;
    (e: "error", err: Error): void;
  }>();

  const id = Math.random().toString(36).slice(2, 10);
  const wrapperId = `js9-wrapper-${id}`;
  const displayId = `JS9-${id}`;

  const ready = ref(false);
  const wrapper = ref<HTMLDivElement | null>(null);
  let controller: JS9DisplayController | null = null;

  const wrapperStyle = computed(() => ({
    width: typeof props.width === "number" ? `${props.width}px` : props.width,
    height: typeof props.height === "number" ? `${props.height}px` : props.height
  }));

  const displayStyle = computed(() => ({
    width: "100%",
    height: "100%",
    resize: "none" as const
  }));

  function currentLoadOptions () {
    return {
      colormap: props.colormap,
      scale: props.scale,
      zoom: props.zoom
    };
  }

  function syncSizeToWrapper () {
    if (!controller || !wrapper.value) return;
    const rect = wrapper.value.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    controller.resize(rect.width, rect.height);
    if (props.fitOnResize) controller.fit();
  }

  let resizeObserver: ResizeObserver | null = null;

  onMounted(async () => {
    try {
      const js9 = await ensureJS9();
      const makePublic = (js9 as unknown as Record<string, unknown>)["makePublic"];
      if (typeof makePublic === "function") {
        try { (makePublic as (s: string) => void)(displayId); } catch { /* ignore */ }
      }
      controller = createDisplayController(js9, displayId);
      // Keep JS9's default mouseActions: hover = readout, left-drag =
      // change contrast/bias, middle-drag = pan. Consumers can switch to
      // "pan on left" via JS9Controls' mode dropdown (or by calling
      // controller.setMouseActions directly).
      syncSizeToWrapper();

      if (props.src) {
        await controller.load(props.src, currentLoadOptions());
        if (props.fitOnLoad) controller.fit();
        emit("loaded");
      }

      ready.value = true;
      emit("ready", controller);

      if (wrapper.value && typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => syncSizeToWrapper());
        resizeObserver.observe(wrapper.value);
      }
    } catch (err) {
      emit("error", err instanceof Error ? err : new Error(String(err)));
    }
  });

  onBeforeUnmount(() => {
    resizeObserver?.disconnect();
    try { controller?.close(); } finally { controller = null; }
  });

  watch(() => props.src, async (next) => {
    if (!controller) return;
    try {
      if (!next) {
        controller.close();
      } else {
        await controller.load(next, currentLoadOptions());
        if (props.fitOnLoad) controller.fit();
        emit("loaded");
      }
    } catch (err) {
      emit("error", err instanceof Error ? err : new Error(String(err)));
    }
  });

  watch(() => props.colormap, (v) => controller?.setColormap(v));
  watch(() => props.scale, (v) => controller?.setScale(v));
  watch(() => props.zoom, (v) => { if (v !== undefined) controller?.setZoom(v); });

  defineExpose({ getController: () => controller });
</script>

<style scoped>
  .js9-view-wrapper {
    position: relative;
    background: #000;
    overflow: hidden;
  }
  .js9-loading {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--muted, #888);
    font-size: 0.9rem;
  }
  .opacity-hidden { opacity: 0; }
</style>
