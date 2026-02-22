import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import { viteStaticCopy } from "vite-plugin-static-copy";

const runtimeDirs = [
  "analysis-plugins",
  "analysis-wrappers",
  "css",
  "help",
  "images",
  "js",
  "node",
  "node_modules/@onekiloparsec/fixi-js/dist",
  "params",
  "plugins"
];

const runtimeFiles = [
  "favicon.ico",
  "js9.css",
  "js9support.css",
  "js9prefs.js",
  "js9Prefs.json",
  "js9.min.js",
  "js9support.min.js",
  "js9plugins.js",
  "js9plugins.min.js",
  "js9support.js",
  "js9-allinone.js",
  "js9-allinone.css",
  "js9.js",
  "js9worker.js",
  "js9PostMessage.js",
  "js9Msg.js",
  "js9Helper.js",
  "js9Regions.js",
  "js9support.txt"
];

export default defineConfig({
  base: "./",
  plugins: [
    viteStaticCopy({
      targets: [
        ...runtimeDirs.map((dir) => ({ src: `${dir}/**/*`, dest: dir })),
        ...runtimeFiles.map((file) => ({ src: file, dest: "." }))
      ]
    })
  ],
  build: {
    outDir: "dist-vite",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        js9: resolve(__dirname, "js9.html")
      }
    }
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.{js,ts}"]
  }
});
