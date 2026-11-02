import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
let entries = 0
for (const [subpath, value] of Object.entries(pkg.exports)) {
  if (typeof value !== 'object') continue
  await stat(new URL('../' + value.import, import.meta.url))
  await stat(new URL('../' + value.types, import.meta.url))
  assert.ok(await import(pkg.name + (subpath === '.' ? '' : subpath.slice(1))))
  entries++
}
await stat(new URL('../dist/styles.css', import.meta.url))
for (const target of Object.values(pkg.browser ?? {}))
  if (typeof target === 'string' && target.startsWith('./'))
    await stat(new URL('../' + target, import.meta.url))
await stat(new URL('../dist-browser/THIRD_PARTY_LICENSES.txt', import.meta.url))
for (const name of [
  'README',
  'PUBLIC_API',
  'API',
  'TEMPLATE_API',
  'COMMANDS',
  'CONTRACTS',
  'INTEGRATION',
  'WORKSPACES',
  'UI',
  'MAINTENANCE',
])
  await stat(new URL(`../docs/${name}.md`, import.meta.url))
for (const name of ['definition', 'revision', 'personalization', 'field', 'render-input', 'block-library']) {
  await stat(new URL(`../schemas/template-${name}.v1.schema.json`, import.meta.url))
  await stat(new URL(`../docs/examples/template-${name}.v1.json`, import.meta.url))
}
const hooks = await import(`${pkg.name}/hooks`)
for (const name of ['useVoucherSave', 'useTemplatePublishing', 'useTemplateEditorSave'])
  assert.ok(!Object.hasOwn(hooks, name), `Removed lifecycle hook is still exported: ${name}`)
const renderer = await import(`${pkg.name}/template-renderer`)
for (const name of ['publishTemplate', 'TemplateRenderRequestSchema', 'parseTemplateRenderRequest'])
  assert.ok(!Object.hasOwn(renderer, name), `Removed service API is still exported: ${name}`)
const creator = hooks.createTemplateCreator()
const editor = hooks.createTemplateEditor({ template: creator.getTemplate() })
const voucher = hooks.createVoucherBuilder()
for (const controller of [creator, editor, voucher]) {
  for (const name of ['save', 'publish', 'previewPDF', 'getSaveState', 'subscribeSave'])
    assert.ok(!Object.hasOwn(controller, name), `Removed lifecycle command is present: ${name}`)
}
for (const controller of [creator, editor]) {
  const output = controller.exportDocument('json')
  assert.equal(output.format, 'json')
  assert.equal(typeof output.data, 'string')
  assert.ok(!Object.hasOwn(output, 'then'), 'Composition output must be synchronous')
}
assert.equal(typeof voucher.exportJSON(), 'string')
for (const controller of [creator, editor, voucher]) controller.destroy()
const result = spawnSync(process.execPath, [fileURLToPath(new URL('check-rendering.mjs', import.meta.url))], {
  stdio: 'inherit',
})
assert.equal(result.status, 0, 'Isolated pure-rendering smoke test failed')
console.log(`All ${entries} package entries and their declarations/CSS are present and importable.`)
