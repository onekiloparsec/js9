import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// The js9 package ships its runtime assets at:
//   node_modules/@onekiloparsec/js9/dist/library/runtime/
// We mirror that directory at /runtime so loadJS9Runtime() can fetch from it.
const runtimeSrc = resolve(
  __dirname,
  "node_modules/@onekiloparsec/js9/dist/library/runtime"
);

export default defineConfig({
  server: { port: 5180 },
  plugins: [
    viteStaticCopy({
      targets: [{ src: `${runtimeSrc}/*`, dest: "runtime" }]
    })
  ]
});
