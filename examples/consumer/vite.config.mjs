import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { fileURLToPath } from "node:url";
import { resolve, dirname, join, normalize, extname } from "node:path";
import { createReadStream, existsSync, statSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const runtimeSrc = resolve(
  __dirname,
  "node_modules/@onekiloparsec/js9/dist/library/runtime"
);

// vite-plugin-static-copy v4 only fires at build time; during `vite dev`
// the /runtime/* URLs would 404. This middleware streams the runtime files
// straight out of node_modules so the loader can fetch them in dev mode.
const MIME = {
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".wasm": "application/wasm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf"
};

const js9DevServePlugin = {
  name: "js9-runtime-dev-serve",
  configureServer (server) {
    const safeRoot = normalize(runtimeSrc);
    server.middlewares.use("/runtime", (req, res, next) => {
      try {
        const url = (req.url || "/").split("?")[0];
        const filePath = normalize(join(safeRoot, decodeURIComponent(url)));
        if (!filePath.startsWith(safeRoot)) return next();
        if (!existsSync(filePath)) return next();
        const stat = statSync(filePath);
        if (stat.isDirectory()) return next();
        res.setHeader("Content-Type", MIME[extname(filePath).toLowerCase()] || "application/octet-stream");
        res.setHeader("Content-Length", String(stat.size));
        res.setHeader("Cache-Control", "no-cache");
        createReadStream(filePath).pipe(res);
      } catch {
        next();
      }
    });
  }
};

export default defineConfig({
  server: { port: 5180 },
  plugins: [
    vue(),
    js9DevServePlugin,
    viteStaticCopy({
      targets: [{ src: `${runtimeSrc}/*`, dest: "runtime" }]
    })
  ]
});
