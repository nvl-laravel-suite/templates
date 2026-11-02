import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import {
  TemplateDefinitionSchema,
  TemplateFieldSchema,
  TemplateBlockSchema,
  exportTemplateBlock,
  getTemplateJSONSchemas,
  createTemplateRevision,
  parseTemplateRevision,
  parseTemplatePersonalization,
  parseTemplateRenderInput,
  renderTemplate,
  validateJSONData,
} from '@nicolasvlachos/voucher-builder/template-renderer'

// Deterministic IDs and timestamps make these fixtures reproducible in any host.
const definition = TemplateDefinitionSchema.parse({
  format: 'gct-template',
  schemaVersion: 1,
  id: 'invoice_example',
  name: 'Invoice example',
  page: {},
  fields: [
    {
      id: 'customerName',
      path: 'customer.name',
      label: 'Customer name',
      schema: { type: 'string', minLength: 1 },
      sample: 'Marlow & Co.',
    },
    {
      id: 'invoiceNumber',
      path: 'invoice.number',
      label: 'Invoice number',
      schema: { type: 'string', minLength: 1 },
      sample: 'INV-001',
    },
    {
      id: 'total',
      path: 'invoice.total',
      label: 'Total',
      schema: { type: 'number', minimum: 0 },
      editable: false,
      defaultValue: 0,
      sample: 125,
    },
  ],
  roots: ['document'],
  nodes: {
    document: {
      id: 'document',
      kind: 'element',
      name: 'Invoice',
      tag: 'section',
      children: ['heading', 'customer', 'number', 'total'],
      classes: ['invoice'],
    },
    heading: {
      id: 'heading',
      kind: 'text',
      name: 'Title',
      parts: [{ value: { source: 'literal', value: 'Invoice' } }],
      permissions: { content: true, style: false },
    },
    customer: {
      id: 'customer',
      kind: 'text',
      name: 'Customer',
      parts: [{ value: { source: 'field', fieldId: 'customerName' } }],
    },
    number: {
      id: 'number',
      kind: 'text',
      name: 'Number',
      parts: [{ value: { source: 'field', fieldId: 'invoiceNumber' } }],
    },
    total: {
      id: 'total',
      kind: 'text',
      name: 'Total',
      parts: [{ value: { source: 'field', fieldId: 'total' }, format: 'currency', currency: 'EUR' }],
    },
  },
  styles: { css: '.invoice { display: grid; gap: 12px; }' },
})
// Snapshot metadata is optional caller data, not a publication workflow.
const revision = parseTemplateRevision(createTemplateRevision(definition, 1, '2026-10-22T00:00:00.000Z'))
const submitted = {
  format: 'gct-personalization',
  schemaVersion: 1,
  templateId: revision.templateId,
  revision: revision.revision,
  data: { customer: { name: 'Marlow & Co.' }, invoice: { number: 'INV-001' } },
  overrides: { heading: { text: 'Your invoice' } },
}
const trustedData = { invoice: { total: 125 } }
const personalization = parseTemplatePersonalization(submitted, revision, { trustedData })
const renderInput = parseTemplateRenderInput({ template: revision, personalization }, { trustedData })
const result = renderTemplate(definition, { data: renderInput.personalization.data })
const personalizedResult = renderTemplate(revision, { personalization: renderInput.personalization })
assert.deepEqual(result.issues, [])
assert.deepEqual(personalizedResult.issues, [])
assert.ok(personalizedResult.html.includes('Your invoice'))
assert.ok(result.html.includes('Marlow &amp; Co.'))
const fixtures = {
  'template-definition.v1': definition,
  'template-revision.v1': revision,
  'template-personalization.v1': personalization,
  'template-field.v1': TemplateFieldSchema.parse(definition.fields[0]),
  'template-render-input.v1': renderInput,
  'template-block-library.v1': exportTemplateBlock({ ...definition, blocks: [TemplateBlockSchema.parse({
    id: 'invoice_heading', version: 1, name: 'Invoice heading', roots: ['heading'], nodes: { heading: definition.nodes.heading },
  })] }, 'invoice_heading', 1),
}
for (const [name, schema] of Object.entries(getTemplateJSONSchemas())) {
  assert.deepEqual(validateJSONData(schema, fixtures[name]), [], `${name} wire schema`)
  const json = JSON.stringify(fixtures[name], null, 2) + '\n'
  const target = new URL(`../docs/examples/${name}.json`, import.meta.url)
  if (process.argv.includes('--write')) await writeFile(target, json)
  if (process.argv.includes('--check'))
    assert.equal(await readFile(target, 'utf8'), json, `${name} example is stale`)
}
console.log('Local definition, optional snapshot, personalization, blocks and HTML composition: passed.')
