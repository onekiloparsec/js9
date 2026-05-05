<script setup>
import { onMounted, ref } from "vue";
import { loadJS9Runtime } from "../../src/lib/index.ts";

const status = ref("Loading JS9 runtime...");
const js9Ref = ref(null);
const isReady = ref(false);

onMounted(async () => {
  try {
    const JS9 = await loadJS9Runtime({
      baseUrl: "",
      includePlugins: true,
      pluginScripts: [
        "plugins/core/menubar.js",
        "plugins/core/toolbar.js",
        "plugins/core/colorbar.js",
        "plugins/core/statusbar.js"
      ],
      styles: [
        "support.css",
        "viewer.css",
        "plugins/core/toolbar.css",
        "plugins/core/colorbar.css",
        "plugins/core/statusbar.css"
      ]
    });
    if (!JS9.inited && typeof JS9.init === "function") {
      JS9.init();
    }
    if (!JS9.inited) {
      await new Promise((resolve) => {
        document.addEventListener("JS9:init", () => resolve(), { once: true });
      });
    }
    if (!JS9.fits?.ready) {
      await new Promise((resolve) => {
        document.addEventListener("JS9:ready", () => resolve(), { once: true });
      });
    }
    js9Ref.value = JS9;
    isReady.value = true;
    JS9.Load("/sample.fits", { display: "js9-display" });
    status.value = "JS9 viewer ready";
  } catch (err) {
    status.value = `Failed to load JS9 runtime: ${err.message}`;
  }
});

function loadSample(url, label, opts = {}) {
  const JS9 = js9Ref.value;
  if (!JS9) return;
  status.value = `Loading ${label}...`;
  try {
    JS9.Load(url, {
      display: "js9-display",
      onload: (im) => {
        // Master darks and many astro images have a long bright tail; default
        // dataminmax clipping makes them look near-black. Apply a sensible
        // stretch on load so structure is visible.
        if (opts.scale) {
          im.setScale(opts.scale);
        }
        if (opts.scaleclipping) {
          im.setScale(opts.scaleclipping);
        }
        status.value = `${label} loaded`;
      }
    });
  } catch (err) {
    status.value = `Failed to load ${label}: ${err.message}`;
  }
}
</script>

<template>
  <main>
    <h1>JS9 Vue Demo</h1>
    <p>{{ status }}</p>
    <div class="actions">
      <button :disabled="!isReady" @click="loadSample('/sample.fits', 'FITS sample')">
        Load FITS sample
      </button>
      <button
        :disabled="!isReady"
        @click="loadSample('/sample.xisf', 'XISF sample', { scale: 'log', scaleclipping: 'zscale' })"
      >
        Load XISF sample
      </button>
    </div>
    <div id="js9-host">
      <div
        id="js9-displayMenubar"
        class="JS9Menubar"
        data-js9id="js9-display"
        data-width="900"
      ></div>
      <div
        id="js9-displayToolbar"
        class="JS9Toolbar"
        data-js9id="js9-display"
        data-width="900"
      ></div>
      <div
        id="js9-display"
        class="JS9"
        data-width="900"
        data-height="560"
        style="width: 900px; height: 560px;"
      ></div>
      <div style="margin-top: 2px;">
        <div
          id="js9-displayColorbar"
          class="JS9Colorbar"
          data-js9id="js9-display"
          data-width="900"
        ></div>
      </div>
      <div
        id="js9-displayStatusbar"
        class="JS9Statusbar"
        data-js9id="js9-display"
        data-width="900"
      ></div>
    </div>
  </main>
</template>

<style scoped>
main {
  display: grid;
  gap: 0.75rem;
}

h1 {
  margin: 0;
  font-size: 1.35rem;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.actions button {
  padding: 0.35rem 0.85rem;
  border: 1px solid #c7ced9;
  background: #fff;
  border-radius: 4px;
  cursor: pointer;
}

.actions button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

#js9-host {
  margin-top: 0.5rem;
  border: 1px solid #c7ced9;
  box-shadow: 0 8px 24px rgba(16, 31, 56, 0.08);
  width: fit-content;
  background: #f7f8fb;
}
</style>
