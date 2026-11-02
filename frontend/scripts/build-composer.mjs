import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createRequire, isBuiltin } from 'node:module'
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import { build } from 'esbuild'

const packageRoot = fileURLToPath(new URL('../', import.meta.url))
const defaultResourceRoot = path.resolve(packageRoot, '../resources')
const require = createRequire(import.meta.url)
const toPosix = value => value.split(path.sep).join('/')

function relativeSpecifier(file, target) {
  const relative = path.posix.relative(path.posix.dirname(file), target)
  return relative.startsWith('.') ? relative : `./${relative}`
}

/** Rewrite module nodes only: comments, CSS strings and user copy remain unchanged. */
export function normalizeModuleSpecifiers(source, relativeFile, packageName = '@nicolasvlachos/voucher-builder') {
  const ast = ts.createSourceFile(relativeFile, source, ts.ScriptTarget.Latest, true)
  const replacements = []
  const rewrite = literal => {
    if (!literal || !ts.isStringLiteralLike(literal)) return
    const specifier = literal.text
    let replacement
    if (specifier.startsWith('#/') || specifier.startsWith('@/')) {
      replacement = relativeSpecifier(relativeFile, `src/${specifier.slice(2)}`)
    } else if (specifier === 'postcss') {
      replacement = relativeSpecifier(relativeFile, 'portable/postcss.js')
    } else if (specifier === packageName || specifier.startsWith(`${packageName}/`)) {
      replacement = relativeSpecifier(relativeFile, specifier === packageName ? 'index' : specifier.slice(packageName.length + 1))
    }
    if (replacement !== undefined) replacements.push({ start: literal.getStart(ast) + 1, end: literal.end - 1, text: replacement })
  }
  const visit = node => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) rewrite(node.moduleSpecifier)
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) rewrite(node.argument.literal)
    if (ts.isExternalModuleReference(node)) rewrite(node.expression)
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) rewrite(node.arguments[0])
    ts.forEachChild(node, visit)
  }
  visit(ast)
  return replacements.sort((a, b) => b.start - a.start).reduce((text, edit) => text.slice(0, edit.start) + edit.text + text.slice(edit.end), source)
}

async function filesUnder(directory) {
  const result = []
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) result.push(...await filesUnder(absolute))
    else if (entry.isFile()) result.push(absolute)
    else throw new Error(`Unexpected non-file build input: ${entry.name}`)
  }
  return result
}

function isPublicSource(relative) {
  return /\.(?:tsx?|css|json)$/.test(relative)
    && !/(?:^|\/)(?:__tests__|__fixtures__|fixtures|demos?)(?:\/|\.)/.test(relative)
    && !/(?:^|\/)(?:main\.tsx|demo(?:-documents)?\.tsx?)$/.test(relative)
    && !/\.(?:test|spec)\.[^/]+$/.test(relative)
}

async function write(destination, contents) {
  await mkdir(path.dirname(destination), { recursive: true })
  await writeFile(destination, contents)
}

async function packageNotice(id) {
  for (let directory = path.dirname(id); directory !== path.dirname(directory); directory = path.dirname(directory)) {
    let metadata
    try { metadata = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8')) } catch (error) {
      if (error.code === 'ENOENT') continue
      throw error
    }
    if (!metadata.name || !metadata.version) continue
    const licenses = (await readdir(directory)).filter(name => /^licen[cs]e(?:[.-].*)?$/i.test(name)).sort()
    if (licenses.length) return {
      name: `${metadata.name}@${metadata.version}`,
      license: (await Promise.all(licenses.map(name => readFile(path.join(directory, name), 'utf8')))).join('\n\n'),
    }
    throw new Error(`Missing third-party license: ${metadata.name}`)
  }
  throw new Error('Missing metadata for a bundled dependency')
}

async function bundleRenderer(resourceRoot) {
  const worker = (await readFile(path.join(packageRoot, 'scripts/render-module.mjs'), 'utf8'))
    .replace('../dist/template-renderer.js', '../src/template-renderer.ts')
  const result = await build({
    absWorkingDir: packageRoot,
    stdin: { contents: worker, sourcefile: 'scripts/render-module.mjs', resolveDir: path.join(packageRoot, 'scripts'), loader: 'js' },
    bundle: true, platform: 'node', target: 'node22', format: 'esm',
    write: false, metafile: true, sourcemap: false, minify: true, legalComments: 'none',
    // CommonJS dependencies can still require Node built-ins in the ESM bundle.
    banner: { js: "import { createRequire as __templateMakerCreateRequire } from 'node:module'; const require = __templateMakerCreateRequire(import.meta.url);" },
  })
  for (const output of Object.values(result.metafile.outputs)) {
    for (const dependency of output.imports) {
      if (dependency.external && !isBuiltin(dependency.path)) throw new Error(`Unbundled renderer dependency: ${dependency.path}`)
    }
  }
  await write(path.join(resourceRoot, 'runtime/renderer.mjs'), result.outputFiles[0].contents)
  const notices = new Map()
  for (const input of Object.keys(result.metafile.inputs)) {
    if (!input.includes('node_modules/')) continue
    const notice = await packageNotice(path.resolve(packageRoot, input))
    notices.set(notice.name, notice.license)
  }
  await write(path.join(resourceRoot, 'runtime/THIRD_PARTY_LICENSES.txt'), [...notices].sort(([a], [b]) => a.localeCompare(b))
    .map(([name, license]) => `${name}\n${'='.repeat(name.length)}\n\n${license.trim()}\n`).join('\n'))
}

async function requirements(dependencies) {
  const result = {}
  for (const [name, required] of Object.entries(dependencies).sort(([a], [b]) => a.localeCompare(b))) {
    // Resolve metadata through this package's installed dependency tree, including
    // packages whose export maps intentionally hide package.json.
    const metadata = JSON.parse(await readFile(path.join(packageRoot, 'node_modules', name, 'package.json'), 'utf8'))
    result[name] = { required, builtWith: metadata.version }
  }
  return result
}

export async function buildComposerResources({ resourceRoot = defaultResourceRoot, rebuildBrowser = true } = {}) {
  const metadata = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'))
  if (rebuildBrowser) execFileSync(process.execPath, [path.join(packageRoot, 'scripts/build-browser.mjs')], { cwd: packageRoot, stdio: 'pipe' })
  const frontendRoot = path.join(resourceRoot, 'js/template-maker')
  await rm(frontendRoot, { recursive: true, force: true })
  await rm(path.join(resourceRoot, 'runtime'), { recursive: true, force: true })
  await rm(path.join(resourceRoot, 'contracts'), { recursive: true, force: true })
  for (const file of await filesUnder(path.join(packageRoot, 'src'))) {
    const relative = toPosix(path.relative(packageRoot, file))
    if (!isPublicSource(relative.slice(4))) continue
    const source = await readFile(file, 'utf8')
    await write(path.join(frontendRoot, relative), /\.tsx?$/.test(file) ? normalizeModuleSpecifiers(source, relative) : source)
  }
  for (const file of await filesUnder(path.join(packageRoot, 'schemas'))) {
    if (!file.endsWith('.json')) continue
    await write(path.join(frontendRoot, 'schemas', path.relative(path.join(packageRoot, 'schemas'), file)), await readFile(file))
  }
  for (const name of (await readdir(path.join(packageRoot, 'schemas'))).filter(name => name.endsWith('.json')).sort()) {
    await write(path.join(resourceRoot, 'contracts', name), await readFile(path.join(packageRoot, 'schemas', name)))
  }
  const integrationFiles = [
    ...['laravel-host.tsx', 'laravel-published-host.tsx', 'laravel-family-host.tsx'].map(name => path.join(packageRoot, 'examples', name)),
    ...(await filesUnder(path.join(packageRoot, 'examples/laravel'))).filter(file => isPublicSource(file) && !file.endsWith('/http-kernel-driver.ts')),
  ]
  for (const file of integrationFiles) {
    const relative = `integrations/laravel/${toPosix(path.relative(path.join(packageRoot, 'examples'), file))}`
    await write(path.join(frontendRoot, relative), normalizeModuleSpecifiers(await readFile(file, 'utf8'), relative, metadata.name))
  }
  for (const [entry, value] of Object.entries(metadata.exports)) {
    if (typeof value !== 'object' || !value.import) continue
    const name = entry === '.' ? 'index' : entry.slice(2)
    await write(path.join(frontendRoot, `${name}.ts`), `export * from './src/${name}'\n`)
  }
  await write(path.join(frontendRoot, 'styles.css'), "@import './src/voucher-builder/styles.css';\n@source './src';\n")
  await write(path.join(frontendRoot, 'dependencies.json'), `${JSON.stringify({
    dependencies: { ...metadata.dependencies, ...metadata.peerDependencies },
    devDependencies: Object.fromEntries(['tailwindcss', '@tailwindcss/vite', '@types/react', '@types/react-dom'].map(name => [name, metadata.devDependencies[name]])),
  }, null, 2)}\n`)
  await copyFile(path.join(packageRoot, 'docs/published-frontend.md'), path.join(frontendRoot, 'README.md'))
  await write(path.join(frontendRoot, 'portable/postcss.js'), (await readFile(path.join(packageRoot, 'dist-browser/postcss.js'), 'utf8')).replace(/^\/\/# sourceMappingURL=.*(?:\r?\n|$)/gm, ''))
  await write(path.join(frontendRoot, 'portable/postcss.d.ts'), "export * from 'postcss'\nexport { default } from 'postcss'\n")
  await copyFile(path.join(packageRoot, 'dist-browser/THIRD_PARTY_LICENSES.txt'), path.join(frontendRoot, 'portable/THIRD_PARTY_LICENSES.txt'))
  await bundleRenderer(resourceRoot)
  const hashes = {}
  for (const directory of [frontendRoot, path.join(resourceRoot, 'runtime'), path.join(resourceRoot, 'contracts')]) {
    for (const file of await filesUnder(directory)) hashes[toPosix(path.relative(resourceRoot, file))] = createHash('sha256').update(await readFile(file)).digest('hex')
  }
  const manifest = {
    formatVersion: 1,
    version: metadata.version,
    entry: 'js/template-maker/index.ts',
    entries: Object.fromEntries(Object.entries(metadata.exports)
      .filter(([, value]) => typeof value === 'object' && value.import)
      .map(([entry]) => [entry, `js/template-maker/${entry === '.' ? 'index' : entry.slice(2)}.ts`])),
    styles: 'js/template-maker/styles.css',
    dependencies: await requirements(metadata.dependencies),
    peerDependencies: await requirements(metadata.peerDependencies),
    buildDependencies: await requirements({ tailwindcss: metadata.devDependencies.tailwindcss, '@tailwindcss/vite': metadata.devDependencies['@tailwindcss/vite'] }),
    typeDependencies: await requirements({ '@types/react': metadata.devDependencies['@types/react'], '@types/react-dom': metadata.devDependencies['@types/react-dom'] }),
    tools: { node: process.versions.node, typescript: ts.version, esbuild: require('esbuild/package.json').version, vite: require('vite/package.json').version },
    files: Object.fromEntries(Object.entries(hashes).sort(([a], [b]) => a.localeCompare(b))),
  }
  await write(path.join(resourceRoot, 'frontend-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}

export async function checkComposerResources({ resourceRoot = defaultResourceRoot } = {}) {
  const temporary = await mkdtemp(path.join(tmpdir(), 'template-maker-resources-'))
  try {
    const expected = await buildComposerResources({ resourceRoot: temporary, rebuildBrowser: false })
    const differences = []
    const actualFiles = new Map()
    for (const directory of ['js/template-maker', 'runtime', 'contracts']) {
      try {
        for (const file of await filesUnder(path.join(resourceRoot, directory))) {
          actualFiles.set(toPosix(path.relative(resourceRoot, file)), createHash('sha256').update(await readFile(file)).digest('hex'))
        }
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }
    }
    for (const name of new Set([...Object.keys(expected.files), ...actualFiles.keys()])) {
      if (expected.files[name] !== actualFiles.get(name)) differences.push(name)
    }
    try {
      if (await readFile(path.join(resourceRoot, 'frontend-manifest.json'), 'utf8') !== await readFile(path.join(temporary, 'frontend-manifest.json'), 'utf8')) differences.push('frontend-manifest.json')
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      differences.push('frontend-manifest.json')
    }
    if (differences.length) throw new Error(`Composer resources are stale; run npm run build:composer.\n${differences.sort().join('\n')}`)
    return expected
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const check = process.argv.includes('--check')
  const manifest = await (check ? checkComposerResources() : buildComposerResources())
  console.log(`${check ? 'Verified' : 'Generated'} ${Object.keys(manifest.files).length} Composer resource files for Template Maker ${manifest.version}.`)
}
