import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import { viteStaticCopy } from 'vite-plugin-static-copy'

const coreManifest = JSON.parse(
  readFileSync(resolve(__dirname, 'manifests/runtime-core.json'), 'utf8')
)
const pluginManifest = JSON.parse(
  readFileSync(resolve(__dirname, 'manifests/runtime-plugins.json'), 'utf8')
)

const includePlugins = process.env.JS9_INCLUDE_PLUGINS === '1'
const copyEntries = [
  ...(coreManifest.copy || []),
  ...(includePlugins ? (pluginManifest.copy || []) : [])
]

export default defineConfig({
  plugins: [
    viteStaticCopy({
      targets: copyEntries.map((entry) => {
        const target = {
          src: resolve(__dirname, entry.src),
          dest: entry.dest
        }
        if (entry.rename) {
          target.rename = entry.rename
        }
        return target
      })
    })
  ],
  build: {
    outDir: 'dist/library',
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'src/lib/index.ts'),
      name: 'JS9Library',
      formats: ['es', 'umd'],
      fileName: (format) => `js9.${format}.js`
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{js,ts}']
  }
})
