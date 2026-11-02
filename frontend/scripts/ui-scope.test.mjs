import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { getUIScope, isUIFile, uiEntries } from './ui-scope.mjs'

const relative = (file) => path.relative(process.cwd(), file).replaceAll('\\', '/')
function exampleViews(directory = 'examples') {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = `${directory}/${entry.name}`
    return entry.isDirectory()
      ? exampleViews(file)
      : file.endsWith('.tsx') && !/\.(test|spec)\.tsx$/.test(file) ? [file] : []
  }).sort()
}

test('audits every consumer view as an explicit composition entry', () => {
  const examples = exampleViews()
  assert.equal(examples.length, 7, 'Review the intended scope when adding a consumer view.')
  assert.deepEqual(uiEntries.filter((file) => file.startsWith('examples/')).sort(), examples)
  const { targets } = getUIScope()
  assert.deepEqual(targets.map(relative).filter((file) => file.startsWith('examples/')), examples)
  assert.deepEqual(targets, [...targets].sort(), 'Target order must remain deterministic.')
})

test('keeps authored output and fixture tests outside application chrome checks', () => {
  for (const file of [
    'src/voucher-builder/blocks/definitions/heading.tsx',
    'src/voucher-builder/renderers/BlockRenderer.tsx',
    'src/template-core/render.tsx',
    'examples/laravel/host.test.tsx',
  ]) assert.equal(isUIFile(path.resolve(file)), false, file)
  assert.equal(getUIScope().targets.some((file) => /\.(test|spec)\.tsx$/.test(file)), false)
})

test('lets the library boundary guard retain its source-only reachability', () => {
  const library = getUIScope({ includeExamples: false })
  assert.equal([...library.visited].some((file) => relative(file).startsWith('examples/')), false)
  assert.equal(library.targets.some((file) => relative(file).startsWith('examples/')), false)
  const all = new Set(getUIScope().targets)
  assert.equal(library.targets.every((file) => all.has(file)), true)
  assert.ok(library.targets.length > 80, 'The library UI graph must still be traversed.')
})

test('includes mixed document renderers that own editor-only controls', () => {
  const mixed = [
    'layout/row-block.tsx', 'layout/grid-block.tsx', 'sections/section-block.tsx',
    'composables/composable-child-wrapper.tsx', 'shared/composable-child-list.tsx',
    'primitives/list-block.tsx', 'primitives/data-placeholder-block.tsx', 'primitives/qr-code-block.tsx', 'primitives/image-block.tsx',
  ].map(file => `src/voucher-builder/blocks/renderers/${file}`)
  const targets = new Set(getUIScope().targets.map(relative))
  for (const file of mixed) assert.ok(targets.has(file), file)
  assert.equal(isUIFile(path.resolve('src/voucher-builder/blocks/renderers/primitives/heading-block.tsx')), false)
})
