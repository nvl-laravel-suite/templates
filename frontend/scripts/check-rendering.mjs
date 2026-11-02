import { registerHooks } from 'node:module'
import assert from 'node:assert/strict'
const ioCalls = []
const forbiddenIO = (operation) => () => {
  ioCalls.push(operation)
  throw new Error(`Portable schema/render entry attempted ${operation}`)
}
globalThis.fetch = forbiddenIO('network access')
for (const storage of ['localStorage', 'sessionStorage'])
  Object.defineProperty(globalThis, storage, { value: Object.fromEntries(
    ['getItem', 'setItem', 'removeItem', 'clear'].map(method => [method, forbiddenIO(`${storage}.${method}`)]),
  ) })
registerHooks({
  resolve(specifier, context, next) {
    if (/^(react|react-dom)(\/|$)/.test(specifier))
      throw new Error('Pure rendering entry imported React: ' + specifier)
    return next(specifier, context)
  },
})
const root = '@nicolasvlachos/voucher-builder'
for (const name of ['schema', 'manifest', 'renderer', 'headless', 'template-schema', 'template-renderer'])
  await import(`${root}/${name}`)
const { createInvoiceTemplate, createTemplateRevision, renderTemplate, resolveTemplateData, getTemplateJSONSchemas } = await import(
  `${root}/template-renderer`
)
const definition = createInvoiceTemplate()
const revision = createTemplateRevision(definition)
const result = renderTemplate(revision, { data: resolveTemplateData(definition, {}, 'preview').data })
assert.ok(result.html.includes('Invoice'))
assert.deepEqual(result.issues, [])
const schemas = JSON.parse(JSON.stringify(getTemplateJSONSchemas()))
assert.equal(Object.keys(schemas).length, 6)
for (const schema of Object.values(schemas)) {
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema')
  for (const match of JSON.stringify(schema).matchAll(/"\$ref":"([^"]+)"/g))
    assert.ok(match[1].startsWith('#'), 'Wire schemas must resolve without an external schema registry')
}
assert.deepEqual(ioCalls, [], 'Portable imports/rendering must not perform network or storage I/O')
console.log('All six non-UI entries import/render without React, network or browser storage; six JSON Schemas are self-contained.')
