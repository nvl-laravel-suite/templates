import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { getTemplateJSONSchemas } from '../dist/template-schema.js'

const directory = new URL('../schemas/', import.meta.url)
await mkdir(directory, { recursive: true })
let changed = false
const profile = JSON.stringify(JSON.parse(await readFile(new URL('../src/template-email/profile.json', import.meta.url), 'utf8')), null, 2) + '\n'
const profilePath = new URL('email-profile.v1.json', directory)
if (process.argv.includes('--check')) {
  if (await readFile(profilePath, 'utf8').catch(() => '') !== profile) { changed = true; console.error('Outdated email profile rules.') }
} else await writeFile(profilePath, profile)
for (const [name, schema] of Object.entries(getTemplateJSONSchemas())) {
  const canonical = { $id: `urn:gct:schema:${name}`, ...schema }
  const output = JSON.stringify(canonical, null, 2) + '\n'
  const target = new URL(`${name}.schema.json`, directory)
  if (process.argv.includes('--check')) {
    let current = ''
    try {
      current = await readFile(target, 'utf8')
    } catch {}
    if (current !== output) {
      changed = true
      console.error(`Outdated JSON Schema: ${fileURLToPath(target)}`)
    }
  } else await writeFile(target, output)
}
if (changed) process.exitCode = 1
else
  console.log(
    process.argv.includes('--check')
      ? 'JSON Schemas match the runtime contracts.'
      : `Generated ${Object.keys(getTemplateJSONSchemas()).length} versioned JSON Schemas in schemas/.`,
  )
