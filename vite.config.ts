import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    sourcemap: false,
    // Boot fetches the dynamic spatial boundary only when WebGL2 is supported.
    // Let Rolldown preserve that import boundary instead of hoisting spatial
    // dependencies into modulepreloads needed by the 2D fallback entry.
    chunkSizeWarningLimit: 1400,
  },
})
