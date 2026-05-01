<template>
  <div class="js9-colorbar" :class="{ inactive: !controller }">
    <canvas ref="canvas" :width="width" :height="height" />
    <div class="hint">drag on the image to adjust · use <code>reset</code> to restore</div>
  </div>
</template>

<script lang="ts" setup>
  import { ref, watch, onBeforeUnmount } from "vue";
  import type { JS9DisplayController } from "../lib/js9Builder";

  const props = withDefaults(
    defineProps<{
      controller: JS9DisplayController | null;
      width?: number;
      height?: number;
      /** Repaint cadence in ms; the LUT changes during contrast/bias drags. */
      pollMs?: number;
    }>(),
    { width: 256, height: 12, pollMs: 100 }
  );

  const canvas = ref<HTMLCanvasElement | null>(null);
  let pollTimer: number | null = null;

  function paint () {
    const c = canvas.value;
    if (!c || !props.controller) return;
    const cells = props.controller.getColorCells();
    if (!cells || cells.length === 0) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const W = c.width;
    const H = c.height;
    const N = cells.length;
    const stripe = ctx.createImageData(W, 1);
    for (let x = 0; x < W; x++) {
      // Map column → cell, clamp.
      const idx = Math.min(N - 1, Math.max(0, Math.floor((x / W) * N)));
      const [r, g, b] = cells[idx];
      const off = x * 4;
      stripe.data[off] = r;
      stripe.data[off + 1] = g;
      stripe.data[off + 2] = b;
      stripe.data[off + 3] = 255;
    }
    for (let y = 0; y < H; y++) ctx.putImageData(stripe, 0, y);
  }

  function start () {
    stop();
    if (!props.controller) return;
    paint();
    // Poll because JS9 doesn't expose a colormap-change event; the cost is
    // tiny (256-pixel strip) and the user only sees it during drags anyway.
    pollTimer = window.setInterval(paint, props.pollMs);
  }
  function stop () {
    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  watch(() => props.controller, () => start(), { immediate: true });
  onBeforeUnmount(stop);
</script>

<style scoped>
  .js9-colorbar {
    display: inline-flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px 8px;
    background: rgba(22, 27, 34, 0.85);
    border: 1px solid var(--border, #2a313c);
    border-radius: 6px;
  }
  .js9-colorbar.inactive { opacity: 0.5; }
  canvas { display: block; border-radius: 2px; }
  .hint { font-size: 0.7rem; color: var(--muted, #8b97a8); }
  code { background: var(--panel-2, #1f2630); padding: 0 4px; border-radius: 2px; }
</style>
