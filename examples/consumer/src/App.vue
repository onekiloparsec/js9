<template>
  <div class="app">
    <header>
      <h1>JS9 consumer demo</h1>
      <p class="muted">
        Showcasing <code>@onekiloparsec/js9</code> with a fit-to-parent viewer,
        a controls toolbar, and a cursor pixel-3D probe.
      </p>
    </header>

    <section class="loaders">
      <button @click="loadRemoteSample">Load remote sample FITS</button>
      <input type="file" accept=".fits,.fts,.fz,.gz" @change="onPick" />
      <span class="muted small">{{ status }}</span>
    </section>

    <section class="layout">
      <!-- Left: a resizable wrapper so you can verify fit-to-parent in real time. -->
      <div class="viewer-pane" :style="paneStyle">
        <JS9View
          :src="src"
          :scale="scale"
          :colormap="colormap"
          @ready="onReady"
          @loaded="status = 'loaded'"
          @error="onError"
        />
        <div class="overlay">
          <JS9Controls
            :controller="controller"
            v-model:scale="scale"
            v-model:colormap="colormap"
          />
        </div>
      </div>

      <!-- Right: the pixel 3D probe lives on its own; consumers can place it anywhere. -->
      <aside class="probe-pane">
        <JS9Colorbar :controller="controller" :width="220" />
        <JS9Pixel3D :controller="controller" :half-size="10" :canvas-size="200" />

        <div class="meta-block">
          <h3>Pane size</h3>
          <div class="row">
            <label>width <input type="range" min="320" max="1100" v-model.number="paneWidth" /></label>
            <span>{{ paneWidth }}px</span>
          </div>
          <div class="row">
            <label>height <input type="range" min="240" max="800" v-model.number="paneHeight" /></label>
            <span>{{ paneHeight }}px</span>
          </div>
          <p class="muted small">
            Use the sliders to change the parent size and watch the JS9 display
            re-fit & recenter without remounting.
          </p>
        </div>
      </aside>
    </section>
  </div>
</template>

<script lang="ts" setup>
  import { ref, computed } from "vue";
  import JS9View from "./components/JS9View.vue";
  import JS9Controls from "./components/JS9Controls.vue";
  import JS9Pixel3D from "./components/JS9Pixel3D.vue";
  import JS9Colorbar from "./components/JS9Colorbar.vue";
  import type { JS9DisplayController } from "./lib/js9Builder";
  import type { JS9Source } from "./lib/types";

  const REMOTE_SAMPLE = "https://hea-www.cfa.harvard.edu/~eric/coma.fits.gz";

  const src = ref<JS9Source>(null);
  const scale = ref("zscale");
  const colormap = ref("grey");
  const status = ref("idle — pick a file or load the remote sample");
  const controller = ref<JS9DisplayController | null>(null);

  const paneWidth = ref(640);
  const paneHeight = ref(480);
  const paneStyle = computed(() => ({
    width: `${paneWidth.value}px`,
    height: `${paneHeight.value}px`
  }));

  function onReady (c: JS9DisplayController) {
    controller.value = c;
    status.value = "ready — drop a FITS file or click 'Load remote sample'";
  }
  function onError (err: Error) {
    status.value = `error: ${err.message}`;
  }
  function loadRemoteSample () {
    status.value = `fetching ${REMOTE_SAMPLE}…`;
    src.value = REMOTE_SAMPLE;
  }
  function onPick (ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    status.value = `loading ${file.name}…`;
    src.value = file;
  }
</script>

<style scoped>
  .app {
    max-width: 1280px;
    margin: 0 auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  header h1 { margin: 0 0 4px; font-size: 1.3rem; font-weight: 600; }
  .muted { color: var(--muted, #8b97a8); }
  .small { font-size: 0.8rem; }
  code { background: var(--panel, #161b22); padding: 1px 6px; border-radius: 3px; font-size: 0.85em; }

  .loaders {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .layout {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 24px;
    align-items: flex-start;
  }

  .viewer-pane {
    position: relative;
    border: 1px dashed var(--border, #2a313c);
    border-radius: 6px;
    overflow: hidden;
  }
  .overlay {
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 10;
  }
  .probe-pane {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 240px;
  }

  .meta-block {
    background: var(--panel, #161b22);
    border: 1px solid var(--border, #2a313c);
    border-radius: 6px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .meta-block h3 { margin: 0; font-size: 0.85rem; font-weight: 600; }
  .row { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; }
  .row label { display: inline-flex; align-items: center; gap: 6px; flex: 1; }
  .row input[type="range"] { flex: 1; }
</style>
