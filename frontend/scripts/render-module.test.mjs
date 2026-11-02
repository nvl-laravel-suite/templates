import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'

const worker = process.env.TEMPLATE_MAKER_TEST_WORKER
  ? path.resolve(process.env.TEMPLATE_MAKER_TEST_WORKER)
  : fileURLToPath(new URL('./render-module.mjs', import.meta.url))
const fixture = JSON.parse(readFileSync(new URL('./fixtures/bindings.json', import.meta.url), 'utf8'))

// The real worker and compiler consume a byte stream with a deterministic split.
// An asynchronous second chunk prevents the stream from coalescing both buffers.
function runWorker(input, splitAt) {
  const directory = mkdtempSync(path.join(tmpdir(), 'template-worker-transport-'))
  try {
    const request = path.join(directory, 'request.json')
    const preload = path.join(directory, 'stdin.mjs')
    writeFileSync(request, input)
    writeFileSync(preload, `import { readFileSync } from 'node:fs'
import { Readable } from 'node:stream'
const input = readFileSync(${JSON.stringify(request)})
async function* chunks() {
  yield input.subarray(0, ${splitAt})
  await new Promise(resolve => setImmediate(resolve))
  yield input.subarray(${splitAt})
}
Object.defineProperty(process, 'stdin', { value: Readable.from(chunks(), { objectMode: false }) })
`)
    return spawnSync(process.execPath, ['--import', pathToFileURL(preload).href, worker], {
      encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024,
    })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

for (const character of ['Δ', '—', '👩']) {
  test(`worker preserves ${character} when its UTF-8 bytes cross stdin chunks`, () => {
    const document = structuredClone(fixture)
    document.rendering.engine = document.artifacts.engine = 'shared'
    const input = Buffer.from(JSON.stringify({ document, data: {
      facts: { code: 'CODE' }, inputs: { message: `Hello ${character} world` },
      context: {}, content: {}, settings: { textSize: 16 },
    }, assets: {} }))
    const splitAt = input.indexOf(Buffer.from(`Hello ${character} world`)) + Buffer.byteLength('Hello ') + 1
    assert.ok(splitAt > 0)
    const result = runWorker(input, splitAt)
    assert.equal(result.error, undefined)
    assert.equal(result.status, 0, result.stderr)
    assert.ok(JSON.parse(result.stdout).html.includes(`Hello ${character} world`))
    assert.equal(result.stderr, '')
  })
}

test('worker bounds UTF-8 bytes rather than decoded character count', () => {
  const input = Buffer.from('é'.repeat(5 * 1024 * 1024 + 1))
  const result = runWorker(input, input.length)
  assert.equal(result.error, undefined)
  assert.equal(result.status, 1)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, 'Template compilation failed: Compiler request exceeds the byte limit.\n')
})
