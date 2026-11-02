import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { build } from 'esbuild'
import { build as buildVite } from 'vite'
import tailwindcss from '@tailwindcss/vite'

const generator = new URL('./build-composer.mjs', import.meta.url)

test('Composer resources retain public entries and bundle without a Template Maker npm package or host aliases', async () => {
  assert.ok(existsSync(generator), 'The Composer resource generator must exist')
  const { buildComposerResources, checkComposerResources, normalizeModuleSpecifiers } = await import(generator.href)
  assert.equal(normalizeModuleSpecifiers("export type T = import('#/voucher-builder/schema').Block\nexport * from '#/hooks'\nconst literal = '#/untouched'", 'src/nested/example.ts'),
    "export type T = import('../voucher-builder/schema').Block\nexport * from '../hooks'\nconst literal = '#/untouched'")
  const directory = await mkdtemp(path.join(tmpdir(), 'composer-frontend-test-'))
  try {
    await buildComposerResources({ resourceRoot: directory })
    const frontend = path.join(directory, 'js/template-maker')
    assert.equal(await readFile(path.join(frontend, 'index.ts'), 'utf8'), "export * from './src/index'\n")
    assert.equal(await readFile(path.join(frontend, 'template-creator.ts'), 'utf8'), "export * from './src/template-creator'\n")
    assert.equal(await readFile(path.join(frontend, 'template-renderer.ts'), 'utf8'), "export * from './src/template-renderer'\n")
    assert.equal(await readFile(path.join(frontend, 'template-schema.ts'), 'utf8'), "export * from './src/template-schema'\n")
    const hostExample = await readFile(path.join(frontend, 'integrations/laravel/laravel-host.tsx'), 'utf8')
    assert.ok(hostExample.includes("from '../../template-creator'"))
    assert.ok(!hostExample.includes('@nicolasvlachos/voucher-builder'))
    assert.ok(!existsSync(path.join(frontend, 'integrations/laravel/laravel/http-kernel-driver.ts')))
    assert.match(await readFile(path.join(frontend, 'styles.css'), 'utf8'), /@source ['"]\.\/src['"]/)
    const dependencies = JSON.parse(await readFile(path.join(frontend, 'dependencies.json'), 'utf8'))
    assert.equal(dependencies.dependencies.react, '^19.0.0')
    assert.equal(dependencies.dependencies['themelia-react-ui'], '^2.0.5')
    assert.equal(dependencies.devDependencies.tailwindcss, '^4.1.18')
    assert.ok(!existsSync(path.join(frontend, 'src/main.tsx')))
    assert.ok(!existsSync(path.join(frontend, 'src/template-creator/demo.tsx')))
    const manifest = JSON.parse(await readFile(path.join(directory, 'frontend-manifest.json'), 'utf8'))
    assert.equal(manifest.peerDependencies['themelia-react-ui'].required, '^2.0.5')
    assert.ok(manifest.files['js/template-maker/src/template-core/styles.ts'])
    const contracts = (await readdir(new URL('../schemas/', import.meta.url))).filter(name => name.endsWith('.json')).sort()
    assert.equal(contracts.length, 7)
    for (const name of contracts) {
      assert.equal(await readFile(path.join(directory, 'contracts', name), 'utf8'), await readFile(new URL(`../schemas/${name}`, import.meta.url), 'utf8'))
      assert.ok(manifest.files[`contracts/${name}`], `Contract missing from manifest: ${name}`)
    }
    for (const [name, hash] of Object.entries(manifest.files)) {
      assert.equal(createHash('sha256').update(await readFile(path.join(directory, name))).digest('hex'), hash, `Resource checksum mismatch: ${name}`)
    }
    assert.ok(!JSON.stringify(manifest).includes('/Users/'))
    const seenImports = new Set()
    const output = await build({
      absWorkingDir: directory,
      entryPoints: [path.join(frontend, 'index.ts'), path.join(frontend, 'src/template-renderer.ts')],
      outdir: path.join(directory, 'build'), bundle: true, platform: 'browser', format: 'esm',
      write: false, logLevel: 'silent',
      plugins: [{ name: 'consumer-dependencies', setup(builder) {
        builder.onResolve({ filter: /^[^./]/ }, args => {
          seenImports.add(args.path)
          assert.ok(!args.path.startsWith('#/') && !args.path.startsWith('@/'), `Unresolved host alias: ${args.path}`)
          assert.ok(!args.path.includes('voucher-builder') && !args.path.includes('template-maker'), `Template Maker npm dependency: ${args.path}`)
          assert.notEqual(args.path, 'postcss', 'Browser runtime must use the bundled portable parser')
          return { path: args.path, external: true }
        })
      } }],
    })
    assert.ok(output.outputFiles.length >= 2)
    assert.ok(seenImports.has('react'))
    const names = await readdir(path.join(frontend, 'portable'))
    assert.deepEqual(names.sort(), ['THIRD_PARTY_LICENSES.txt', 'postcss.d.ts', 'postcss.js'])
    assert.doesNotMatch(await readFile(path.join(frontend, 'portable/postcss.js'), 'utf8'), /^\/\/# sourceMappingURL=/m)
    const fixture = JSON.parse(await readFile(new URL('./fixtures/bindings.json', import.meta.url), 'utf8'))
    fixture.rendering.engine = fixture.artifacts.engine = 'shared'
    const worker = path.join(directory, 'runtime/renderer.mjs')
    const workerSource = await readFile(worker, 'utf8')
    assert.doesNotMatch(workerSource, /\/Users\/|\/private\/|template-maker-composer-20261101/)
    const rendered = spawnSync(process.execPath, [worker], {
      cwd: directory, encoding: 'utf8', timeout: 15000,
      input: JSON.stringify({ document: fixture, data: { facts: { code: 'PORTABLE' }, inputs: { message: 'Hello portable world' }, context: {}, content: {}, settings: { textSize: 16 } }, assets: {} }),
    })
    assert.equal(rendered.status, 0, rendered.stderr)
    assert.equal(rendered.stderr, '')
    assert.ok(JSON.parse(rendered.stdout).html.includes('Hello portable world'))
    const invalid = spawnSync(process.execPath, [worker], { cwd: directory, encoding: 'utf8', timeout: 15000, input: '{invalid' })
    assert.equal(invalid.status, 1)
    assert.equal(invalid.stdout, '')
    assert.match(invalid.stderr, /^Template compilation failed:/)
    const transport = spawnSync(process.execPath, ['--test', fileURLToPath(new URL('./render-module.test.mjs', import.meta.url))], {
      cwd: directory, encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024,
      env: { ...process.env, TEMPLATE_MAKER_TEST_WORKER: worker },
    })
    assert.equal(transport.error, undefined)
    assert.equal(transport.status, 0, `${transport.stdout}\n${transport.stderr}`)
    const firstManifest = await readFile(path.join(directory, 'frontend-manifest.json'), 'utf8')
    await writeFile(path.join(frontend, 'stale.ts'), 'stale')
    await buildComposerResources({ resourceRoot: directory, rebuildBrowser: false })
    assert.ok(!existsSync(path.join(frontend, 'stale.ts')))
    assert.equal(await readFile(path.join(directory, 'frontend-manifest.json'), 'utf8'), firstManifest)
    assert.equal(typeof checkComposerResources, 'function')
    await checkComposerResources({ resourceRoot: directory })
    await writeFile(path.join(frontend, 'template-renderer.ts'), 'consumer-modified')
    await assert.rejects(checkComposerResources({ resourceRoot: directory }), /template-renderer\.ts/)
    assert.equal(await readFile(path.join(frontend, 'template-renderer.ts'), 'utf8'), 'consumer-modified', 'Checking must not repair resource drift')
    await buildComposerResources({ resourceRoot: directory, rebuildBrowser: false })
    await writeFile(path.join(frontend, 'obsolete.ts'), 'stale')
    await assert.rejects(checkComposerResources({ resourceRoot: directory }), /obsolete\.ts/)
    await buildComposerResources({ resourceRoot: directory, rebuildBrowser: false })
    for (const contract of contracts) {
      assert.equal(await readFile(path.join(directory, 'contracts', contract), 'utf8'), await readFile(new URL(`../schemas/${contract}`, import.meta.url), 'utf8'))
    }
    await writeFile(path.join(directory, 'contracts/template-definition.v1.schema.json'), '{}')
    await assert.rejects(checkComposerResources({ resourceRoot: directory }), /contracts\/template-definition\.v1\.schema\.json/)
    await buildComposerResources({ resourceRoot: directory, rebuildBrowser: false })
    await writeFile(path.join(directory, 'runtime/renderer.mjs'), 'consumer-modified')
    await assert.rejects(checkComposerResources({ resourceRoot: directory }), /runtime\/renderer\.mjs/)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('published source typechecks and builds in a host without package aliases, then renders in Node without browser globals', async () => {
  const { buildComposerResources } = await import(generator.href)
  const directory = await mkdtemp(path.join(tmpdir(), 'template-maker-host-'))
  try {
    await buildComposerResources({ resourceRoot: directory, rebuildBrowser: false })
    await symlink(fileURLToPath(new URL('../node_modules', import.meta.url)), path.join(directory, 'node_modules'), 'dir')
    await writeFile(path.join(directory, 'package.json'), '{"name":"template-maker-consumer-check","type":"module"}')
    await writeFile(path.join(directory, 'tsconfig.json'), JSON.stringify({
      compilerOptions: { strict: true, noEmit: true, skipLibCheck: true, target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', jsx: 'react-jsx', lib: ['ES2022', 'DOM', 'DOM.Iterable'] },
      include: ['js/**/*.ts', 'js/**/*.tsx'],
    }))
    const types = spawnSync(process.execPath, [fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url)), '-p', directory], { encoding: 'utf8', timeout: 60000, maxBuffer: 1024 * 1024 })
    assert.equal(types.status, 0, `${types.stdout}\n${types.stderr}`)
    await writeFile(path.join(directory, 'main.ts'), "export { TemplateCreator, TemplateEditor, TemplateWorkspace, GroupVariantWorkspace } from './js/template-maker/template-creator'\nimport './js/template-maker/styles.css'\n")
    const browser = await buildVite({
      root: directory, configFile: false, logLevel: 'silent', plugins: [tailwindcss()],
      build: { write: false, minify: false, lib: { entry: path.join(directory, 'main.ts'), formats: ['es'] }, rollupOptions: { external: ['react', 'react-dom', 'react/jsx-runtime'] } },
    })
    const css = (Array.isArray(browser) ? browser.flatMap(result => result.output) : browser.output).find(file => file.type === 'asset' && file.fileName.endsWith('.css'))
    assert.ok(css, 'Host build must emit editor CSS')
    assert.match(String(css.source), /\.tc-workspace/)
    assert.match(String(css.source), /\.min-h-0/)
    await writeFile(path.join(directory, 'headless.ts'), `
      import assert from 'node:assert/strict'
      import { createTemplateDefinition, renderTemplate } from './js/template-maker/template-renderer'
      assert.equal(typeof window, 'undefined')
      const result = renderTemplate(createTemplateDefinition('Standalone'))
      assert.equal(result.issues.length, 0)
      assert.equal(typeof result.html, 'string')
      console.log('headless-ok')
    `)
    const headless = await build({ entryPoints: [path.join(directory, 'headless.ts')], outfile: path.join(directory, 'headless.mjs'), bundle: true, platform: 'node', format: 'esm', packages: 'external', metafile: true })
    assert.ok(Object.keys(headless.metafile.inputs).every(name => !/(?:react|template-creator)\//.test(name)), 'Headless entry must not pull React UI')
    const rendered = spawnSync(process.execPath, [path.join(directory, 'headless.mjs')], { cwd: directory, encoding: 'utf8', timeout: 15000 })
    assert.equal(rendered.status, 0, rendered.stderr)
    assert.equal(rendered.stdout.trim(), 'headless-ok')
    await writeFile(path.join(directory, 'ssr.tsx'), `
      import { createElement } from 'react'
      import { renderToString } from 'react-dom/server'
      import { UIProvider } from 'themelia-react-ui/ui-provider'
      import { TemplateEditor } from './js/template-maker/template-creator'
      import { createTemplateDefinition } from './js/template-maker/template-renderer'
      const html = renderToString(createElement(UIProvider, null, createElement(TemplateEditor, { template: createTemplateDefinition('Standalone') })))
      if (!html) throw new Error('Missing editor markup')
      console.log('ssr-ok')
    `)
    await build({ entryPoints: [path.join(directory, 'ssr.tsx')], outfile: path.join(directory, 'ssr.mjs'), bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', packages: 'external' })
    const ssr = spawnSync(process.execPath, [path.join(directory, 'ssr.mjs')], { cwd: directory, encoding: 'utf8', timeout: 15000 })
    assert.equal(ssr.status, 0, ssr.stderr)
    assert.equal(ssr.stdout.trim(), 'ssr-ok')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
