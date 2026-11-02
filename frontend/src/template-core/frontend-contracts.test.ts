import { describe, expect, it, vi } from 'vitest'
import { createTemplateDefinition } from './defaults'
import { TemplateFieldSchema, TemplateNodeSchema } from './schema'
import { createTemplateCreator, createTemplateEditor, getCreatorRuntime, getEditorRuntime } from './editing'
import { createTemplateRevision, renderTemplate } from './render'

const definition = () => {
  const draft = createTemplateDefinition('Application document')
  draft.nodes.note = TemplateNodeSchema.parse({ id: 'note', kind: 'text', name: 'Note',
    parts: [{ value: { source: 'literal', value: 'Portable content' } }] })
  draft.roots = ['note']
  return draft
}

describe('frontend-only component contracts', () => {
  it('starts with empty composition rather than implicit business content', () => {
    const creator = createTemplateCreator()
    expect(creator.getTemplate()).toMatchObject({ name: 'Untitled template', roots: [], nodes: {}, fields: [], assets: [], blocks: [] })
    expect(creator.render().html).toContain('<!DOCTYPE html>')
    creator.destroy()
  })
  it('exposes synchronous composition and exports without persistence or publication state', () => {
    const creator = createTemplateCreator({ initialTemplate: definition() })
    expect(Object.keys(creator).sort()).toEqual(['actions', 'destroy', 'exportDocument', 'getTemplate', 'render'])
    expect(Object.keys(getCreatorRuntime(creator).store.getState()).sort())
      .toEqual(['error', 'redo', 'selectedId', 'template', 'undo'])
    expect(creator.exportDocument('html').data).toContain('Portable content')
    expect(JSON.parse(creator.exportDocument('json').data)).toEqual(creator.getTemplate())
    creator.destroy()
  })

  it('uses plain definitions directly and never needs a publish step', () => {
    const draft = definition()
    const editor = createTemplateEditor({ template: draft })
    expect(editor.render().html).toContain('Portable content')
    expect(editor.getTemplate()).toEqual(draft)
    expect(editor.getRevision()).toMatchObject({ revision: 1, publishedAt: '1970-01-01T00:00:00.000Z' })
    expect(renderTemplate(draft, { personalization: editor.getPersonalization() }).html).toContain('Portable content')
    expect(Object.keys(getEditorRuntime(editor).store.getState()).sort())
      .toEqual(['error', 'personalization', 'redo', 'revision', 'selectedId', 'template', 'undo'])
    editor.destroy()
  })

  it('accepts empty templates and host-owned snapshot metadata without generating a counter', () => {
    const empty = createTemplateDefinition()
    expect(createTemplateEditor({ template: empty }).render().html).toContain('<!DOCTYPE html>')
    const source = definition()
    const snapshot = createTemplateRevision(source, 41, '2026-01-02T03:04:05.000Z')
    const editor = createTemplateEditor({ template: snapshot })
    expect(editor.getRevision()).toEqual(snapshot)
    const copy = editor.getRevision()
    copy.template.name = 'Caller mutation'
    expect(editor.getTemplate().name).toBe('Application document')
    expect(createTemplateRevision(source).revision).toBe(1)
    editor.destroy()
  })

  it('exports incomplete values as JSON while HTML export reports missing values', () => {
    const template = definition()
    template.fields.push(TemplateFieldSchema.parse({ id: 'customer', path: 'customer', label: 'Customer',
      required: true, schema: { type: 'string', minLength: 1 } }))
    template.nodes.note = TemplateNodeSchema.parse({ id: 'note', kind: 'text', name: 'Customer',
      parts: [{ value: { source: 'field', fieldId: 'customer' } }] })
    const editor = createTemplateEditor({ template, onError: vi.fn() })
    expect(JSON.parse(editor.exportDocument('json').data).data).toEqual({})
    expect(() => editor.exportDocument('html')).toThrow('Complete')
    editor.actions.setField('customer', 'Marlow')
    expect(editor.exportDocument('html').data).toContain('Marlow')
    editor.destroy()
  })

  it('rejects unsupported export formats from untyped integrations before returning output', () => {
    const template = definition(), onError = vi.fn()
    const creator = createTemplateCreator({ initialTemplate: template, onError })
    const editor = createTemplateEditor({ template, onError })
    for (const instance of [creator, editor]) {
      // @ts-expect-error Untyped hosts must receive the same format contract at runtime.
      expect(() => instance.exportDocument('pdf')).toThrow('Supported export formats are html and json')
      expect(instance.getTemplate()).toEqual(template)
    }
    expect(onError).toHaveBeenCalledTimes(2)
    creator.destroy(); editor.destroy()
  })

  it('preloads replacement documents atomically and resets only local selection and undo history', () => {
    const onChange = vi.fn(), editor = createTemplateEditor({ template: definition(), onChange })
    const replacement = definition()
    replacement.fields.push(TemplateFieldSchema.parse({ id: 'amount', path: 'amount', label: 'Amount',
      editable: false, required: true, schema: { type: 'number' } }))
    editor.actions.load(replacement, { data: { amount: 42 } })
    expect(editor.getPersonalization().data).toEqual({ amount: 42 })
    expect(getEditorRuntime(editor).store.getState()).toMatchObject({ selectedId: null, undo: [], redo: [] })
    expect(onChange).toHaveBeenCalledTimes(1)
    const before = editor.getPersonalization()
    const invalid = { ...replacement, roots: ['missing'] }
    expect(() => editor.actions.load(invalid)).toThrow()
    expect(editor.getPersonalization()).toEqual(before)
    expect(onChange).toHaveBeenCalledTimes(1)
    editor.destroy()
  })

  it('keeps observer and getter mutations separate from local composition state', () => {
    const onChange = vi.fn(template => { template.name = 'Changed by observer' })
    const creator = createTemplateCreator({ initialTemplate: definition(), onChange })
    creator.actions.edit(template => { template.name = 'Edited' })
    expect(creator.getTemplate().name).toBe('Edited')
    const exported = JSON.parse(creator.exportDocument('json').data)
    exported.name = 'Changed by application'
    expect(creator.getTemplate().name).toBe('Edited')
    creator.actions.undo()
    expect(creator.getTemplate().name).toBe('Application document')
    creator.destroy()
  })
})
