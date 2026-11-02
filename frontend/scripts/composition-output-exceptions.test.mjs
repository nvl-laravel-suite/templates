import assert from 'node:assert/strict'
import path from 'node:path'
import { test } from 'node:test'
import { classifyCompositionFindings } from './composition-output-exceptions.mjs'

const root = '/fixture'
const image = 'src/voucher-builder/blocks/renderers/primitives/image-block.tsx'
const qr = 'src/voucher-builder/blocks/renderers/primitives/qr-code-block.tsx'
const source = (expression, classes = 'mt-2 text-center text-xs text-muted-foreground') =>
  `export function Preview({block}) { return <p className="${classes}">{${expression}}</p> }`
const finding = (file, patch = {}) => ({ file: path.resolve(root, file), line: 1, column: source('block.content.caption').indexOf('<p') + 1, rule: 'copy-margin', severity: 'error', message: 'Display copy is margin-free.', ...patch })
const report = (...findings) => ({ errors: findings.filter(item => item.severity === 'error').length, warnings: findings.filter(item => item.severity === 'warning').length, findings })
const classify = (value, sources = { [image]: source('block.content.caption'), [qr]: source('block.content.label') }) =>
  classifyCompositionFindings(value, { root, readSource: file => sources[path.relative(root, file).replaceAll('\\', '/')] })

test('retains original findings and names only the two authored caption decisions', () => {
  const original = report(finding(image), finding(qr))
  const result = classify(original)
  assert.equal(result.findings, original.findings)
  assert.equal(result.errors, 2, 'The upstream error total must remain visible.')
  assert.equal(result.actionableErrors, 0)
  assert.deepEqual(result.authoredOutputExceptions.map(item => item.id), ['authored-image-caption-spacing', 'authored-qr-label-spacing'])
})

test('keeps a new error actionable even beside a reviewed authored caption', () => {
  const result = classify(report(finding(image), finding(qr, { rule: 'raw-color' })))
  assert.equal(result.authoredOutputExceptions.length, 1)
  assert.equal(result.actionableErrors, 1)
})

test('does not exempt another file, rule, source binding or changed styling', () => {
  for (const [item, sources] of [
    [finding('src/other.tsx'), { 'src/other.tsx': source('block.content.caption') }],
    [finding(image, { rule: 'control-class' }), { [image]: source('block.content.caption') }],
    [finding(image), { [image]: source('block.content.name') }],
    [finding(image), { [image]: source('block.content.caption', 'mt-8 text-center text-xs text-muted-foreground') }],
    [finding(image, { line: 2 }), { [image]: source('block.content.caption') }],
    [finding(image, { column: 1 }), { [image]: source('block.content.caption') }],
    [finding(image), { [image]: 'export function View(){ return <p className="mt-2">Instruction</p> }' }],
  ]) {
    const result = classify(report(item), sources)
    assert.equal(result.authoredOutputExceptions.length, 0)
    assert.equal(result.actionableErrors, 1)
  }
})

test('does not acknowledge the same reviewed output decision twice', () => {
  const result = classify(report(finding(image), finding(image)))
  assert.equal(result.authoredOutputExceptions.length, 1)
  assert.equal(result.actionableErrors, 1)
})
