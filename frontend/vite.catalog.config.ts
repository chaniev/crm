import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const projectRoot = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  appType: 'mpa',
  plugins: [react()],
  build: {
    emptyOutDir: true,
    outDir: 'dist-catalog',
    rollupOptions: {
      input: resolve(projectRoot, 'catalog.html'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3020,
  },
})
