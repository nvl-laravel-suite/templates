import { expect, it } from 'vitest'
import { createTemplateDefinition } from '../template-core/defaults'
import { TemplateDefinitionSchema } from '../template-core/schema'
import { exportBindingDocument } from './bindings'
import { hydrateTemplateDraft } from './hydration'
import { recompileTemplateDocument } from './recompile'

function mediaDefinition() {
  return TemplateDefinitionSchema.parse({
    ...createTemplateDefinition('Media'), roots: ['caption', 'logo', 'manual'],
    fields: [
      { id: 'caption', path: 'content.caption', label: 'Caption', schema: { type: 'string' }, defaultValue: 'Default caption', required: true, editable: false },
      { id: 'manual', path: 'content.manualImage', label: 'Manual image', schema: { type: 'string' }, defaultValue: 'default-manual-image', required: true, editable: false },
    ],
    assets: [{ id: 'logo', name: 'Logo', kind: 'image', url: 'https://example.com/logo.png', mimeType: 'image/png' }],
    nodes: {
      caption: { id: 'caption', name: 'Caption', kind: 'text', parts: [{ value: { source: 'field', fieldId: 'caption' } }] },
      logo: { id: 'logo', name: 'Logo', kind: 'element', tag: 'img', attributeBindings: { src: { source: 'asset', assetId: 'logo' } } },
      manual: { id: 'manual', name: 'Manual', kind: 'element', tag: 'img', attributeBindings: { src: { source: 'field', fieldId: 'manual' } } },
    },
  })
}

it.each([true, false])('uses remapped managed image IDs while retaining authored content (artifacts: %s)', keepArtifacts => {
  const definition = mediaDefinition()
  const previous = exportBindingDocument(definition, { target: 'document', managedAssets: { logo: 'managed-old' } })
  previous.content.caption = { kind: 'content', id: 'retained-copy', revision: 2 }
  previous.content.manualImage = 'authored-manual-image'
  previous.managedAssets!.logo = 'managed-new'
  const { artifacts, ...draft } = previous
  const source = keepArtifacts ? { ...draft, artifacts } : draft
  const next = recompileTemplateDocument(hydrateTemplateDraft(source), definition)
  expect(next.content).toEqual({ caption: { kind: 'content', id: 'retained-copy', revision: 2 }, manualImage: 'authored-manual-image', asset_logo: 'managed-new' })
  expect(next.artifacts.bindings).toContainEqual({ id: 'i_logo', path: 'content.asset_logo', kind: 'image' })
  expect(previous.content.asset_logo).toBe('managed-old')
})

it.each([true, false])('does not carry a derived image ID into a newly declared content field (artifacts: %s)', keepArtifacts => {
  const original = mediaDefinition()
  const previous = exportBindingDocument(original, { target: 'document', managedAssets: { logo: 'managed-old' } })
  previous.content.caption = { kind: 'content', id: 'retained-copy', revision: 2 }
  previous.content.manualImage = 'authored-manual-image'
  previous.managedAssets!.logo = 'managed-new'
  const changed = structuredClone(original)
  changed.fields.push({ id: 'newCaption', path: 'content.asset_logo', label: 'New caption', description: '', schema: { type: 'string' }, defaultValue: 'Caption', required: true, editable: false })
  const { artifacts, ...draft } = previous
  const source = keepArtifacts ? { ...draft, artifacts } : draft
  const next = recompileTemplateDocument(hydrateTemplateDraft(source), changed)
  expect(next.content).toEqual({ caption: { kind: 'content', id: 'retained-copy', revision: 2 }, manualImage: 'authored-manual-image', asset_logo: 'Caption', asset_logo_2: 'managed-new' })
  expect(next.artifacts.bindings).toContainEqual({ id: 'i_logo', path: 'content.asset_logo_2', kind: 'image' })
  expect(previous.content.asset_logo).toBe('managed-old')
})
