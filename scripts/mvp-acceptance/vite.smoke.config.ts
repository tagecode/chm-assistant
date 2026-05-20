import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')

/** 将 mvp-smoke 打成可独立由 Electron 执行的 ESM 包（不清空 dist-electron） */
export default defineConfig({
  build: {
    ssr: true,
    outDir: path.join(root, 'dist-electron'),
    emptyOutDir: false,
    rollupOptions: {
      input: path.join(root, 'electron/mvp-smoke.ts'),
      output: {
        entryFileNames: 'mvp-smoke.js',
        format: 'es',
      },
      external: ['electron'],
    },
  },
})
