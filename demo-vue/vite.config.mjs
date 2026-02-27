import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

const coreManifest = JSON.parse(
  readFileSync(resolve(__dirname, "../manifests/runtime-core.json"), "utf8")
);
const pluginManifest = JSON.parse(
  readFileSync(resolve(__dirname, "../manifests/runtime-plugins.json"), "utf8")
);

const copyEntries = [
  ...(coreManifest.copy || []),
  ...(pluginManifest.copy || [])
];

export default defineConfig({
  root: __dirname,
  server: {
    port: 5177
  },
  plugins: [
    vue(),
    viteStaticCopy({
      targets: copyEntries.map((entry) => {
        const target = {
          src: resolve(__dirname, `../${entry.src}`),
          dest: entry.dest
        };
        if (entry.rename) {
          target.rename = entry.rename;
        }
        return target;
      })
    })
  ],
  build: {
    outDir: resolve(__dirname, "../dist/demo"),
    emptyOutDir: true
  }
});
