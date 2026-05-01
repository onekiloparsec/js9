<template>
  <div class="js9-controls" :class="{ disabled: !controller }">
    <div class="group">
      <button :disabled="!controller" title="Zoom out" @click="zoom('out')">−</button>
      <button :disabled="!controller" title="Fit to view" @click="zoom('fit')">fit</button>
      <button :disabled="!controller" title="1:1" @click="zoom('one')">1:1</button>
      <button :disabled="!controller" title="Zoom in" @click="zoom('in')">+</button>
    </div>
    <div class="group">
      <label>scale</label>
      <select v-model="scaleModel" :disabled="!controller">
        <option v-for="o in scales" :key="o" :value="o">{{ o }}</option>
      </select>
    </div>
    <div class="group">
      <label>cmap</label>
      <select v-model="colormapModel" :disabled="!controller">
        <option v-for="o in colormaps" :key="o" :value="o">{{ o }}</option>
      </select>
      <label class="drag-label" title="Left-button drag action">drag</label>
      <select v-model="dragModeModel" :disabled="!controller" title="Left-button drag action">
        <option value="cmap">contrast / bias</option>
        <option value="pan">pan</option>
      </select>
      <button
        :disabled="!controller"
        title="Reset contrast/bias (left-drag changes them)"
        @click="controller?.resetColormap()"
      >reset</button>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { ref, watch } from "vue";
  import type { JS9DisplayController } from "../lib/js9Builder";

  const props = withDefaults(
    defineProps<{
      controller: JS9DisplayController | null;
      scale?: string;
      colormap?: string;
      /** What the left-button drag does. 'cmap' = JS9's contrast/bias (default), 'pan' = scroll. */
      dragMode?: "cmap" | "pan";
      zoomStep?: number;
    }>(),
    { scale: "zscale", colormap: "grey", dragMode: "cmap", zoomStep: 1.5 }
  );

  const emit = defineEmits<{
    (e: "update:scale", v: string): void;
    (e: "update:colormap", v: string): void;
    (e: "update:dragMode", v: "cmap" | "pan"): void;
  }>();

  // zscale is a clipping algorithm (auto-computes scalemin/max via the
  // standard IRAF-style sample) layered on top of linear scaling — it's
  // typically what you want as the default for astronomical images.
  const scales = ["zscale", "linear", "log", "sqrt", "asinh", "histeq"];
  const colormaps = ["grey", "heat", "cool", "viridis", "magma", "plasma"];

  const scaleModel = ref(props.scale);
  const colormapModel = ref(props.colormap);
  const dragModeModel = ref<"cmap" | "pan">(props.dragMode);

  watch(() => props.scale, (v) => { scaleModel.value = v; });
  watch(() => props.colormap, (v) => { colormapModel.value = v; });
  watch(() => props.dragMode, (v) => { dragModeModel.value = v; });

  watch(scaleModel, (v) => {
    emit("update:scale", v);
    props.controller?.setScale(v);
  });
  watch(colormapModel, (v) => {
    emit("update:colormap", v);
    props.controller?.setColormap(v);
  });
  // Apply the drag-mode immediately, including when the controller arrives
  // late (so the chosen mode persists across remounts).
  function applyDragMode (v: "cmap" | "pan") {
    if (!props.controller) return;
    props.controller.setMouseActions(
      v === "pan"
        ? ["display value/position", "pan the image", "change contrast/bias"]
        : ["display value/position", "change contrast/bias", "pan the image"]
    );
  }
  watch(dragModeModel, (v) => {
    emit("update:dragMode", v);
    applyDragMode(v);
  });
  watch(() => props.controller, (c) => { if (c) applyDragMode(dragModeModel.value); });

  function zoom (action: "in" | "out" | "fit" | "one") {
    const c = props.controller;
    if (!c) return;
    if (action === "fit") c.fit();
    else if (action === "one") c.setZoom(1);
    else if (action === "in") c.setZoom(`*${props.zoomStep}`);
    else c.setZoom(`/${props.zoomStep}`);
  }
</script>

<style scoped>
  .js9-controls {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    padding: 6px 10px;
    background: rgba(22, 27, 34, 0.85);
    border: 1px solid var(--border, #2a313c);
    border-radius: 6px;
    backdrop-filter: blur(4px);
  }
  .js9-controls.disabled { opacity: 0.5; pointer-events: none; }
  .group { display: inline-flex; align-items: center; gap: 6px; }
  label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted, #8b97a8); }
</style>
