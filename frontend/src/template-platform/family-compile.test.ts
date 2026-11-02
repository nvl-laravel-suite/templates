import { expect, it } from 'vitest'
import { createExperienceDocument } from './demo-documents'
import { compileFamilyVariant } from './family-compile'
import type { GroupVariantDocument } from './types'
import fixture from '../../scripts/fixtures/family-structure.v1.json'
import type { BindingDocument } from './types'
import { recompileTemplateDocument } from './recompile'

it('compiles a structural variant from its exact family while retaining raw authority and a source stamp', () => {
  const family = createExperienceDocument()
  family.variationPoints = [{ id: 'weight', label: 'Message weight', kind: 'node-style', nodeId: 'personal_message', property: 'font-weight', schema: { type: 'string', enum: ['normal', 'bold'] } }]
  const raw: GroupVariantDocument = { format: 'template-document', schemaVersion: 1, target: 'document', source: { mode: 'group-variant', group: { id: 'family', revision: 1 }, overrides: { variations: { weight: { kind: 'node-style', value: 'bold' } } } } }
  const compiled = compileFamilyVariant(family, raw)
  expect(compiled.source).toEqual(raw.source)
  expect(compiled).not.toHaveProperty('source.definition')
  expect(compiled.compiled?.artifacts.html).toContain('font-weight:bold')
  expect(JSON.parse(compiled.compiled!.sourceKey)).toEqual(raw)
  expect(raw).not.toHaveProperty('compiled')
  expect(family.source.definition.nodes.personal_message).toMatchObject({ style: {} })
  const own = compileFamilyVariant(family, raw, { id: 'variant', name: 'Celebration' })
  expect(own.compiled?.artifacts.html).toContain('<title>Celebration</title>')
  expect(JSON.parse(own.compiled!.sourceKey)).toEqual(raw)
  expect(family.source.definition.name).not.toBe('Celebration')
})

it('preserves variation declarations when a family is recompiled', async () => {
  const { recompileTemplateDocument } = await import('./recompile')
  const family = createExperienceDocument()
  family.variationPoints = [{ id: 'text', label: 'Heading text', kind: 'node-property', nodeId: 'terms_text', property: 'parts', schema: { type: 'array', items: { type: 'object', properties: {}, additionalProperties: false } } }]
  expect(recompileTemplateDocument(family, family.source.definition).variationPoints).toEqual(family.variationPoints)
})

it.each(['shared', 'bindings'] as const)('keeps artifact-backed email subject, text and sidecar-only bindings with the %s engine', engine => {
  const family = structuredClone(fixture.base) as BindingDocument
  family.target = 'email'; delete family.rendering
  family.artifacts = { engine, html: 'STALE', css: 'STALE', subject: 'Gift for {{recipient}}', text: 'Dear {{recipient}}', bindings: [{ id: 'recipient', kind: 'text', path: 'inputs.recipient' }] }
  family.source.definition.fields.push({ id: 'recipient', path: 'inputs.recipient', label: 'Recipient', description: '', schema: { type: 'string' }, required: true, editable: true, defaultValue: 'Nicolas' })
  const raw: GroupVariantDocument = { format: 'template-document', schemaVersion: 1, target: 'email', source: { mode: 'group-variant', group: { id: 'family', revision: 1 }, overrides: { variations: { accent: { kind: 'node-style', value: 'red' } } } } }
  const result = compileFamilyVariant(family, raw)
  expect(result.compiled?.artifacts).toMatchObject({ subject: 'Gift for {{recipient}}', text: 'Dear {{recipient}}' })
  expect(result.compiled?.artifacts.bindings).toContainEqual({ id: 'recipient', kind: 'text', path: 'inputs.recipient' })
})

it.each(['shared', 'bindings'] as const)('uses authored sidecar bindings instead of stale family artifacts with the %s engine', engine => {
  const family = structuredClone(fixture.base) as BindingDocument
  family.target = 'email'
  family.rendering = { engine, subject: 'Gift for {{recipient}}', text: 'Dear {{recipient}}', bindings: [{ id: 'recipient', kind: 'text', path: 'inputs.recipient' }] }
  family.artifacts = { engine, html: 'STALE', css: 'STALE', bindings: [{ id: 'recipient', kind: 'text', path: 'inputs.missing' }] }
  family.source.definition.fields.push({ id: 'recipient', path: 'inputs.recipient', label: 'Recipient', description: '', schema: { type: 'string' }, required: true, editable: true, defaultValue: 'Nicolas' })
  const raw: GroupVariantDocument = { format: 'template-document', schemaVersion: 1, target: 'email', source: { mode: 'group-variant', group: { id: 'family', revision: 1 }, overrides: { variations: { accent: { kind: 'node-style', value: 'red' } } } } }
  const result = compileFamilyVariant(family, raw)
  expect(result.compiled?.artifacts).toMatchObject({ subject: 'Gift for {{recipient}}', text: 'Dear {{recipient}}' })
  expect(result.compiled?.artifacts.bindings).toContainEqual({ id: 'recipient', kind: 'text', path: 'inputs.recipient' })
  expect(result.compiled?.artifacts.bindings).not.toContainEqual(expect.objectContaining({ path: 'inputs.missing' }))
})

it('rejects sidecar bindings whose IDs were reused by the newly compiled graph', () => {
  const family = structuredClone(fixture.base) as BindingDocument
  family.artifacts = { engine: 'bindings', html: '', css: '', subject: 'Gift for {{b_recipient}}', bindings: [{ id: 'b_recipient', kind: 'text', path: 'inputs.other' }] }
  delete family.rendering
  for (const id of ['recipient', 'other']) family.source.definition.fields.push({ id, path: `inputs.${id}`, label: id, description: '', schema: { type: 'string' }, required: true, editable: true, defaultValue: id })
  const title = family.source.definition.nodes.title
  if (title.kind === 'text') title.parts[0].value = { source: 'field', fieldId: 'recipient' }
  expect(() => recompileTemplateDocument(family, family.source.definition)).toThrow(/binding.*collision|reused/i)
})

it('does not restore an undeclared data path when a sidecar binding field is removed', () => {
  const family = structuredClone(fixture.base) as BindingDocument
  family.artifacts = { engine: 'bindings', html: '', css: '', subject: 'Gift for {{recipient}}', bindings: [{ id: 'recipient', kind: 'text', path: 'inputs.recipient' }] }
  delete family.rendering
  expect(() => recompileTemplateDocument(family, family.source.definition)).toThrow(/binding.*undeclared|declared.*binding/i)
})
