import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig({
  plugins: [tsconfigPaths({ projects: ['./tsconfig.json'] }), tailwindcss(), viteReact()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Split heavy vendor deps
          if (id.includes('node_modules')) {
            if (id.includes('@dnd-kit')) return 'vendor-dnd'
            if (id.includes('qrcode')) return 'vendor-qr'
            if (id.includes('lucide-react')) return 'vendor-icons'
            if (id.includes('@base-ui')) return 'vendor-ui'
            if (id.includes('zod')) return 'vendor-zod'
            if (id.includes('ajv')) return 'vendor-contracts'
            if (id.includes('postcss') || id.includes('cssesc')) return 'vendor-css'
            if (id.includes('parse5') || id.includes('entities')) return 'vendor-html'
            if (id.includes('zustand') || id.includes('nanoid')) return 'vendor-store'
          }
          // Keep the interdependent block registry, renderers, and editor
          // together so manual feature chunks cannot create import cycles.
          return undefined
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})

export default config
