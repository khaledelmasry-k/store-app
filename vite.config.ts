import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

export default defineConfig({
  plugins: [preact()],
  server: {
    port: 5173,
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes('node_modules/firebase')) return 'firebase'
          if (id.includes('node_modules/wouter')) return 'wouter'
          if (id.includes('node_modules/preact')) return 'preact-vendor'
          return undefined
        },
      },
    },
  },
})
