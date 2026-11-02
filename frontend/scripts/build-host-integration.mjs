import { build } from 'esbuild'
import { mkdir } from 'node:fs/promises'
const output = new URL('../.cache/', import.meta.url)
await mkdir(output, { recursive: true })
await build({ entryPoints: [new URL('../examples/laravel/http-kernel-driver.ts', import.meta.url).pathname], outfile: new URL('http-kernel-driver.mjs', output).pathname, bundle: true, platform: 'node', format: 'esm', packages: 'external', sourcemap: true })
