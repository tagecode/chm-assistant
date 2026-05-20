import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron/simple'

const srcPath = fileURLToPath(new URL('./src', import.meta.url))
const electronPath = fileURLToPath(new URL('./electron', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    electron({
      main: {
        entry: 'electron/main.ts',
      },
      preload: {
        input: path.join(electronPath, 'preload.ts'),
      },
    }),
  ],
  resolve: {
    alias: {
      '@': srcPath,
    },
  },
})
