import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: 'generated/runtime',
    emptyOutDir: false,
    minify: false,
    lib: {
      entry: resolve(__dirname, 'src/runtime-bundle.ts'),
      formats: ['iife'],
      name: 'JS9Runtime',
      fileName: () => 'runtime.js'
    },
    rollupOptions: {
      treeshake: false
    }
  }
})
