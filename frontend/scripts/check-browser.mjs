import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createIdResolver, optimizeDeps, resolveConfig } from 'vite'

const packageRoot = fileURLToPath(new URL('../', import.meta.url))
const cache = join(packageRoot, '.cache')
const reportPath = join(cache, 'check-browser.json')
const css = '.brand{color:#123456;padding:12px}@media screen and (max-width:620px){.brand{font-size:20px!important}}'

// Compare the package's real compiler in Node and Vite's optimized client graph.
// These paths exercise PostCSS AST traversal, mutation, serialization and errors.
function exercise(renderer, template) {
  const compiled = renderer.compileTemplateCSS(css)
  assert.deepEqual(compiled.issues, [])
  assert.deepEqual(compiled.classes, ['brand'])
  assert.equal(compiled.css, '.template-document .brand{color:#123456;padding:12px}@media screen and (max-width:620px){.template-document .brand{font-size:20px!important}}')
  const malformed = renderer.compileTemplateCSS('.brand{color:red')
  assert.equal(malformed.css, '')
  assert.equal(malformed.issues[0]?.code, 'css-syntax')
  assert.match(malformed.issues[0].message, /Unclosed block/)
  const document = renderer.exportBindingDocument(template, { target: 'document' }).artifacts
  const email = renderer.exportBindingDocument(template, { target: 'email' }).artifacts
  for (const output of [document, email]) assert.match(output.html, /Hello browser/)
  assert.match(email.html, /style="[^"]*color:#123456[^"]*padding:12px/)
  assert.match(email.html, /@media screen and \(max-width:620px\)/)
  assert.match(email.html, /role="presentation"/)
  return { compiled, malformed, document, email }
}

if (process.argv[2] === '--evaluate') {
  const input = JSON.parse(await readFile(process.argv[3], 'utf8'))
  const warnings = []
  const warn = console.warn
  console.warn = (...args) => {
    warnings.push(args.map(String).join(' '))
    warn(...args)
  }
  // Avoid Node's experimental web-storage getter when importing UI dependencies.
  for (const name of ['localStorage', 'sessionStorage'])
    Object.defineProperty(globalThis, name, { value: undefined, configurable: true })
  try {
    if (input.browserCSS) {
      const processGlobal = globalThis.process
      const bufferGlobal = globalThis.Buffer
      try {
        globalThis.process = undefined
        globalThis.Buffer = undefined
        const postcss = (await import(pathToFileURL(input.browserCSS))).default
        const ast = postcss.parse('.brand{color:red}')
        ast.walkDecls(decl => { decl.value = '#123456' })
        assert.equal(ast.toString(), '.brand{color:#123456}')
        assert.throws(() => postcss.parse('.brand{'), /Unclosed block/)
      } finally {
        globalThis.process = processGlobal
        globalThis.Buffer = bufferGlobal
      }
    }
    const modules = new Map()
    for (const [name, file] of input.entries) modules.set(name, await import(pathToFileURL(file)))
    const result = exercise(modules.get(input.renderer), input.template)
    await writeFile(input.output, JSON.stringify({ warnings, result }))
  } finally {
    console.warn = warn
  }
} else {
  await mkdir(cache, { recursive: true })
  // Keep the fixture under this package so installed dependencies resolve without
  // host aliases, dependency copies, network access or a development server.
  const fixture = await mkdtemp(join(cache, 'check-browser-'))
  const report = { entries: 0, externalizedWarnings: [], checks: [] }
  try {
    const pkg = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'))
    const entries = Object.entries(pkg.exports).filter(([, value]) => typeof value === 'object' && value.import)
    assert.equal(entries.length, 10, 'Update the browser smoke test when the published JS entry contract changes')
    const installed = join(fixture, 'node_modules', ...pkg.name.split('/'))
    await mkdir(installed, { recursive: true })
    await cp(join(packageRoot, 'dist'), join(installed, 'dist'), { recursive: true })
    const browserRuntime = pkg.browser?.postcss
    if (typeof browserRuntime === 'string' && browserRuntime.startsWith('./')) {
      const directory = dirname(browserRuntime)
      const runtimeFiles = directory === '.' ? browserRuntime : directory
      await cp(join(packageRoot, runtimeFiles), join(installed, runtimeFiles), { recursive: true })
    }
    await writeFile(join(installed, 'package.json'), JSON.stringify(pkg))
    await writeFile(join(fixture, 'package.json'), JSON.stringify({ private: true, type: 'module' }))
    const include = entries.map(([subpath]) => pkg.name + (subpath === '.' ? '' : subpath.slice(1)))
    const config = await resolveConfig({
      configFile: false,
      envFile: false,
      root: fixture,
      cacheDir: join(fixture, 'vite-cache'),
      logLevel: 'error',
      optimizeDeps: { include },
      environments: { ssr: { resolve: { noExternal: true } } },
    }, 'serve')
    const metadata = await optimizeDeps(config, true, true)
    const nodePostCSS = createRequire(import.meta.url).resolve('postcss')
    assert.equal(createRequire(join(installed, 'package.json')).resolve('postcss'), nodePostCSS)
    const resolve = createIdResolver(config, { asSrc: false, scan: true })
    const importer = join(installed, pkg.exports['./template-renderer'].import)
    const ssr = { name: 'ssr', config: config.environments.ssr, mode: 'dev', getTopLevelConfig: () => config }
    const ssrPostCSS = await resolve(ssr, 'postcss', importer)
    assert.equal(ssrPostCSS, fileURLToPath(import.meta.resolve('postcss')))
    report.checks.push('Node and Vite SSR resolve installed PostCSS')
    report.nodePostCSS = nodePostCSS
    report.ssrPostCSS = ssrPostCSS

    const rendererName = `${pkg.name}/template-renderer`
    const renderer = await import(pathToFileURL(join(packageRoot, pkg.exports['./template-renderer'].import)))
    const template = renderer.TemplateDefinitionSchema.parse({
      ...renderer.createTemplateDefinition('Browser CSS regression'), id: 'browser-css-regression', roots: ['copy'],
      nodes: {
        copy: { id: 'copy', kind: 'element', name: 'Message', tag: 'p', classes: ['brand'], children: ['text'] },
        text: { id: 'text', kind: 'text', name: 'Text', parts: [{ value: { source: 'literal', value: 'Hello browser' } }] },
      },
      styles: { theme: '', css },
    })
    const baseline = exercise(renderer, template)
    const input = join(fixture, 'evaluate.json')
    const output = join(fixture, 'result.json')
    await writeFile(input, JSON.stringify({
      renderer: rendererName, template, output,
      browserCSS: typeof pkg.browser?.postcss === 'string' ? join(installed, pkg.browser.postcss) : undefined,
      entries: include.map(name => [name, metadata.optimized[name].file]),
    }))
    const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--evaluate', input], { stdio: 'inherit' })
    assert.equal(child.status, 0, 'Evaluating Vite client dependencies or CSS rendering failed')
    const evaluated = JSON.parse(await readFile(output, 'utf8'))
    report.entries = include.length
    report.externalizedWarnings = evaluated.warnings.filter(message => message.includes('externalized for browser compatibility'))
    assert.deepEqual(evaluated.result, baseline, 'Browser CSS/document/email output differs from the original Node renderer')
    report.checks.push('All published JS entries import', 'CSS traversal/serialization and malformed CSS feedback', 'Document/email output matches Node')
    report.documentBytes = Buffer.byteLength(evaluated.result.document.html)
    report.emailBytes = Buffer.byteLength(evaluated.result.email.html)
    assert.equal(report.externalizedWarnings.length, 0, `Vite browser imports emitted ${report.externalizedWarnings.length} externalized-property warnings`)
    report.checks.push('No browser externalized-property warnings')
    console.log(`All ${include.length} browser entries import without externalized-property warnings; CSS/document/email output matches Node and SSR retains installed PostCSS.`)
  } finally {
    await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n')
    await rm(fixture, { recursive: true, force: true })
    console.log(`Browser regression report: ${reportPath}`)
  }
}
