import { resolve } from "node:path";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

const runtimeDirs = [
  "runtime",
  "analysis-plugins",
  "analysis-wrappers",
  "css",
  "images",
  "js",
  "node_modules/@onekiloparsec/fixi-js/dist",
  "params",
  "plugins"
];

const runtimeFiles = [
  "src/core/basicUtils.js",
  "src/viewer.js",
  "src/worker.js"
];

export default defineConfig({
  root: __dirname,
  plugins: [
    vue(),
    viteStaticCopy({
      targets: [
        ...runtimeDirs.map((dir) => ({ src: resolve(__dirname, `../${dir}/**/*`), dest: dir })),
        ...runtimeFiles.map((file) => ({
          src: resolve(__dirname, `../${file}`),
          dest: "runtime",
          rename:
            file === "src/worker.js"
              ? "worker.js"
              : file === "src/viewer.js"
                ? "viewer.js"
                : file === "src/core/basicUtils.js"
                  ? "basic-utils.js"
                : undefined
        }))
      ]
    })
  ],
  build: {
    outDir: resolve(__dirname, "../dist/demo"),
    emptyOutDir: true
  }
});
