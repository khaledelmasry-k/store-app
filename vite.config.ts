import { defineConfig, type Plugin } from 'vite'
import preact from '@preact/preset-vite'

function preactSingleRuntimeGuard(): Plugin {
  return {
    name: 'preact-single-runtime-guard',
    apply: 'build' as const,
    generateBundle(_options, bundle) {
      const packageRoots = new Set<string>()
      let hasCore = false
      let hasHooks = false
      let hasCompat = false

      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue
        for (const rawId of Object.keys(output.modules ?? {})) {
          const id = rawId.replaceAll('\\', '/')
          const marker = '/node_modules/preact/'
          const markerIndex = id.lastIndexOf(marker)
          if (markerIndex === -1) continue

          packageRoots.add(id.slice(0, markerIndex + '/node_modules/preact'.length))
          hasCore ||= id.includes('/preact/dist/preact.module.js')
          hasHooks ||= id.includes('/preact/hooks/dist/hooks.module.js')
          hasCompat ||= id.includes('/preact/compat/dist/compat.module.js')
        }
      }

      if (packageRoots.size !== 1 || !hasCore || !hasHooks || !hasCompat) {
        this.error(
          `Production bundle must contain one complete Preact runtime (core/hooks/compat). ` +
          `Found roots: ${JSON.stringify([...packageRoots])}; ` +
          `core=${hasCore}, hooks=${hasHooks}, compat=${hasCompat}.`,
        )
      }
    },
  }
}

export default defineConfig({
  plugins: [preact(), preactSingleRuntimeGuard()],
  resolve: {
    dedupe: ['preact'],
    alias: {
      react: 'preact/compat',
      'react-dom': 'preact/compat',
      'react-dom/client': 'preact/compat/client',
      'react-dom/server': 'preact/compat/server',
      'react-dom/test-utils': 'preact/compat/test-utils',
      'react/jsx-runtime': 'preact/jsx-runtime',
      'react/jsx-dev-runtime': 'preact/jsx-dev-runtime',
    },
  },
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
          return undefined
        },
      },
    },
  },
})
