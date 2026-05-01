<template>
  <div class="js9-pixel3d" :class="{ inactive: !active }">
    <div class="header">
      <span>Pixel 3D</span>
      <span v-if="active && info" class="meta">
        ({{ info.x }}, {{ info.y }}) · {{ formatValue(info.value) }}
      </span>
      <span v-else class="meta dim">hover image</span>
    </div>
    <canvas ref="canvas" :width="canvasSize" :height="canvasSize" />
  </div>
</template>

<script lang="ts" setup>
  import { ref, computed, watch, onBeforeUnmount } from "vue";
  import type {
    JS9DisplayController,
    JS9PixelGrid
  } from "../lib/js9Builder";

  const props = withDefaults(
    defineProps<{
      controller: JS9DisplayController | null;
      halfSize?: number;
      canvasSize?: number;
      throttleMs?: number;
    }>(),
    { halfSize: 10, canvasSize: 180, throttleMs: 30 }
  );

  const canvas = ref<HTMLCanvasElement | null>(null);
  const info = ref<{ x: number; y: number; value: number | null } | null>(null);
  const active = computed(() => !!props.controller && info.value !== null);

  let teardown: (() => void) | null = null;
  let lastSampledAt = 0;
  let pendingFrame = 0;

  function attach (controller: JS9DisplayController | null) {
    teardown?.();
    teardown = null;
    if (!controller) return;
    teardown = controller.onMouseMove(({ imageX, imageY, value }) => {
      if (!Number.isFinite(imageX) || !Number.isFinite(imageY)) {
        info.value = null;
        clearCanvas();
        return;
      }
      const now = performance.now();
      if (now - lastSampledAt < props.throttleMs) return;
      lastSampledAt = now;
      const grid = controller.getPixelGrid(imageX, imageY, props.halfSize);
      info.value = { x: Math.round(imageX), y: Math.round(imageY), value };
      if (grid) {
        cancelAnimationFrame(pendingFrame);
        pendingFrame = requestAnimationFrame(() => render(grid));
      }
    });
  }

  watch(() => props.controller, (next) => attach(next ?? null), { immediate: true });
  onBeforeUnmount(() => teardown?.());

  function clearCanvas () {
    const c = canvas.value;
    if (!c) return;
    c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
  }

  function render (grid: JS9PixelGrid) {
    const c = canvas.value;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const W = c.width;
    const H = c.height;
    ctx.clearRect(0, 0, W, H);

    const { size, values, min, max } = grid;
    const range = max - min || 1;
    const cell = (W * 0.7) / size;
    const heightScale = H * 0.35;
    const cx = W / 2;
    const baseY = H * 0.78;

    function project (i: number, j: number, h: number): [number, number] {
      const ic = i - (size - 1) / 2;
      const jc = j - (size - 1) / 2;
      const x = cx + (ic - jc) * cell * 0.6;
      const y = baseY + (ic + jc) * cell * 0.3 - h * heightScale;
      return [x, y];
    }
    function valueAt (i: number, j: number): number {
      const v = values[j * size + i];
      return Number.isFinite(v) ? v : min;
    }
    function normHeight (v: number): number { return (v - min) / range; }
    function colorFor (v: number): string {
      const t = Math.min(1, Math.max(0, (v - min) / range));
      const r = Math.round(255 * Math.min(1, Math.max(0, t * 1.6 - 0.2)));
      const g = Math.round(255 * Math.min(1, Math.max(0, t * 1.2)));
      const b = Math.round(255 * Math.min(1, Math.max(0, 1 - t * 1.1)));
      return `rgb(${r},${g},${b})`;
    }

    const order: Array<[number, number]> = [];
    for (let j = 0; j < size - 1; j++) {
      for (let i = 0; i < size - 1; i++) order.push([i, j]);
    }
    order.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]));

    for (const [i, j] of order) {
      const v00 = valueAt(i, j);
      const v10 = valueAt(i + 1, j);
      const v01 = valueAt(i, j + 1);
      const v11 = valueAt(i + 1, j + 1);
      const p00 = project(i, j, normHeight(v00));
      const p10 = project(i + 1, j, normHeight(v10));
      const p11 = project(i + 1, j + 1, normHeight(v11));
      const p01 = project(i, j + 1, normHeight(v01));
      ctx.beginPath();
      ctx.moveTo(p00[0], p00[1]);
      ctx.lineTo(p10[0], p10[1]);
      ctx.lineTo(p11[0], p11[1]);
      ctx.lineTo(p01[0], p01[1]);
      ctx.closePath();
      ctx.fillStyle = colorFor((v00 + v10 + v01 + v11) / 4);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }

    const centerI = (size - 1) / 2;
    const centerVal = valueAt(Math.round(centerI), Math.round(centerI));
    const cBase = project(centerI, centerI, 0);
    const cTop = project(centerI, centerI, normHeight(centerVal));
    ctx.strokeStyle = "rgba(255, 80, 80, 0.9)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cBase[0], cBase[1]);
    ctx.lineTo(cTop[0], cTop[1]);
    ctx.stroke();
  }

  function formatValue (v: number | null) {
    if (v === null) return "—";
    if (!Number.isFinite(v)) return "NaN";
    if (Math.abs(v) >= 1000 || (Math.abs(v) < 0.01 && v !== 0)) return v.toExponential(2);
    return v.toFixed(2);
  }
</script>

<style scoped>
  .js9-pixel3d {
    display: inline-flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px;
    background: rgba(22, 27, 34, 0.9);
    border: 1px solid var(--border, #2a313c);
    border-radius: 6px;
  }
  .js9-pixel3d.inactive { opacity: 0.6; }
  .header {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted, #8b97a8);
  }
  .meta { font-family: ui-monospace, monospace; text-transform: none; letter-spacing: 0; }
  .dim { opacity: 0.5; }
  canvas { background: #05080d; border-radius: 3px; }
</style>
