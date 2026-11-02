import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import tsconfigPaths from 'vite-tsconfig-paths'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import pkg from './package.json' with { type: 'json' }

const external = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
].filter((id, i, arr) => arr.indexOf(id) === i)

const externalRegex = new RegExp(`^(${external.map((d) => d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(/.*)?$`)

export default defineConfig({
  plugins: [
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    viteReact(),
  ],
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    cssCodeSplit: false,
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        editor: resolve(__dirname, 'src/editor.ts'),
        hooks: resolve(__dirname, 'src/hooks.ts'),
        renderer: resolve(__dirname, 'src/renderer.ts'),
        schema: resolve(__dirname, 'src/schema.ts'),
        manifest: resolve(__dirname, 'src/manifest.ts'),
        headless: resolve(__dirname, 'src/headless.ts'),
        'template-creator': resolve(__dirname, 'src/template-creator.ts'),
        'template-schema': resolve(__dirname, 'src/template-schema.ts'),
        'template-renderer': resolve(__dirname, 'src/template-renderer.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: (id) => externalRegex.test(id),
      output: {
        assetFileNames: (asset) => (asset.name?.endsWith('.css') ? 'styles.css' : 'assets/[name][extname]'),
      },
    },
  },
})
