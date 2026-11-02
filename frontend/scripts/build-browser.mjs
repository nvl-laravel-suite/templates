import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))

async function packageNotice(id) {
  for (let directory = dirname(id); directory !== dirname(directory); directory = dirname(directory)) {
    let pkg
    try {
      pkg = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'))
    } catch (error) {
      if (error.code === 'ENOENT') continue
      throw error
    }
    // Nested entry metadata (for example nanoid/non-secure) is not a package.
    if (typeof pkg.name !== 'string' || typeof pkg.version !== 'string') continue
    for (const name of ['LICENSE', 'LICENSE.md', 'LICENSE.txt']) {
      try {
        const license = await readFile(join(directory, name), 'utf8')
        return { key: `${pkg.name}@${pkg.version}`, license }
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }
    }
    throw new Error(`Missing license for bundled browser dependency ${pkg.name}`)
  }
  throw new Error(`Missing package metadata for bundled browser module ${id}`)
}

await build({
  configFile: false,
  envFile: false,
  root,
  publicDir: false,
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  plugins: [{
    name: 'browser-css-license-notices',
    async generateBundle(_options, bundle) {
      const notices = new Map()
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue
        for (const id of Object.keys(chunk.modules)) {
          if (id.startsWith('\0') || !id.includes('/node_modules/')) continue
          const notice = await packageNotice(id.split('?')[0])
          notices.set(notice.key, notice.license)
        }
      }
      this.emitFile({
        type: 'asset',
        fileName: 'THIRD_PARTY_LICENSES.txt',
        source: [...notices].sort(([a], [b]) => a.localeCompare(b))
          .map(([name, license]) => `${name}\n${'='.repeat(name.length)}\n\n${license.trim()}\n`).join('\n'),
      })
    },
  }],
  build: {
    // Keep this asset outside both the demo and Node library output directories.
    outDir: join(root, 'dist-browser'),
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      // Node resolves the original entry here; the generated browser mapping
      // must never become its own input on subsequent builds.
      entry: fileURLToPath(import.meta.resolve('postcss')),
      formats: ['es'],
      fileName: () => 'postcss.js',
    },
  },
})
