// Optional trusted local worker. Build the package before configuring Laravel's command.
import { renderSharedTemplateDocument } from '../dist/template-renderer.js'
try {
  let input = ''
  process.stdin.setEncoding('utf8')
  for await (const chunk of process.stdin) {
    input += chunk
    if (Buffer.byteLength(input) > 10 * 1024 * 1024) throw new Error('Compiler request exceeds the byte limit.')
  }
  const { document, data, assets } = JSON.parse(input)
  const result = renderSharedTemplateDocument(document, data, assets)
  process.stdout.write(JSON.stringify(result))
} catch (error) {
  process.stderr.write(`Template compilation failed: ${error instanceof Error ? error.message : 'Invalid request'}\n`)
  process.exitCode = 1
}
