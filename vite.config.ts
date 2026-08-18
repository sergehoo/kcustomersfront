import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  build: {
    // No observability platform consumes them, so shipping 7 MB of `.map` files
    // only exposed the sources. Re-enable per build with `vite build --sourcemap`.
    sourcemap: mode !== 'production',
    // The villa GLB dwarfs every JS chunk; warning at 500 kB only produced noise.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          'react-three': ['@react-three/fiber', '@react-three/drei'],
        },
      },
    },
  },
}))
