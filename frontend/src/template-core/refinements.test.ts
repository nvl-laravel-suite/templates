import { describe, expect, it, vi } from 'vitest'
import { createInvoiceTemplate } from './defaults'
import { getTemplateDataSchema, resolveTemplateData, setValue } from './contracts'
import { getTemplateIssues, parseTemplateDefinition } from './validation'
import { createTemplateCreator, createTemplateEditor, getCreatorRuntime, getEditorRuntime } from './editing'
import { createTemplateRevision } from './render'
import type { DataSchema, JsonObject } from './schema'

const fixture = () => {
  const template = createInvoiceTemplate()
  template.fields.find((field) => field.id === 'customerName')!.defaultValue = 'Anonymous'
  return template
}
describe('contract and snapshot refinements', () => {
  it.each([null, false, 'malformed', []])(
    'preserves malformed ancestors when applying defaults: %j',
    (customer) => {
      const template = fixture()
      const input: JsonObject = { customer }
      const result = resolveTemplateData(template, input)
      expect(result.data.customer).toEqual(customer)
      expect(result.issues).toContainEqual(expect.objectContaining({ path: '/customer', code: 'type' }))
      expect(input).toEqual({ customer })
    },
  )
  it('clears only existing nested values and prunes their empty parents', () => {
    const input: JsonObject = {}
    setValue(input, 'customer.address.city', undefined)
    expect(input).toEqual({})
    setValue(input, 'customer.address.city', 'Sofia')
    setValue(input, 'customer.name', 'Marlow')
    setValue(input, 'customer.address.city', undefined)
    expect(input).toEqual({ customer: { name: 'Marlow' } })
    setValue(input, 'customer.name', undefined)
    expect(input).toEqual({})
    const callback = vi.fn()
    const editor = createTemplateEditor({
      template: createTemplateRevision(createInvoiceTemplate()),
      onChange: callback,
    })
    editor.actions.setField('customerName', undefined)
    expect(callback).not.toHaveBeenCalled()
    expect(getEditorRuntime(editor).store.getState().undo).toEqual([])
  })
  it('does not expose source samples and defaults through the generated contract', () => {
    const template = fixture()
    template.fields.find((field) => field.id === 'items')!.defaultValue = []
    const contract = getTemplateDataSchema(template)
    const invoice = (contract.properties as JsonObject).invoice as JsonObject
    const items = (invoice.properties as JsonObject).items as JsonObject
    ;(items.default as unknown[]).push('changed')
    ;(items.examples as unknown[][])[0].push('changed')
    expect(template.fields.find((field) => field.id === 'items')!.defaultValue).toEqual([])
    expect(template.fields.find((field) => field.id === 'items')!.sample as unknown[]).toHaveLength(2)
  })
  it.each<DataSchema>([
    { type: 'string', minLength: 5, maxLength: 2 },
    { type: 'string', format: 'email', enum: ['invalid'] },
    { type: 'integer', minimum: 0.2, maximum: 0.8 },
    { type: 'number', minimum: 2, maximum: 1 },
    { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 1 },
    { type: 'object', properties: {}, required: ['unknown'], additionalProperties: false },
  ])('rejects impossible field contracts: %j', (schema) => {
    const template = fixture()
    template.fields.find((field) => field.id === 'customerName')!.schema = schema
    expect(getTemplateIssues(template)).toContainEqual(
      expect.objectContaining({ path: 'fields.customerName.schema', code: 'data-schema' }),
    )
    expect(() => parseTemplateDefinition(template)).toThrow()
  })
  it('normalizes restored defaults and injects omitted application-owned values', () => {
    const template = fixture()
    template.fields.find((field) => field.id === 'total')!.editable = false
    const revision = createTemplateRevision(template)
    const source = {
      format: 'gct-personalization' as const,
      schemaVersion: 1 as const,
      templateId: revision.templateId,
      revision: 1,
      data: {},
      overrides: {},
    }
    const editor = createTemplateEditor({
      template: revision,
      initialData: { invoice: { total: 42 } },
      initialPersonalization: source,
    })
    expect(editor.getPersonalization().data).toEqual({
      customer: { name: 'Anonymous' },
      invoice: { total: 42 },
    })
    expect(source.data).toEqual({})
    expect(() =>
      createTemplateEditor({
        template: revision,
        initialData: { invoice: { total: 42 } },
        initialPersonalization: { ...source, data: { invoice: { total: 999 } } },
      }),
    ).toThrow('supplied by the application')
    const copy = editor.getRevision()
    copy.template.name = 'Mutated copy'
    expect(editor.getRevision().template.name).toBe('Studio invoice')
  })
  it('checks dynamic reusable-block binding types before snapshot export', () => {
    const creator = createTemplateCreator({ initialTemplate: createInvoiceTemplate() })
    const source = creator.getTemplate().roots[0]
    const blockId = creator.actions.saveBlock(source, 'Header')
    const instanceId = creator.actions.insertBlock(blockId, 1)
    creator.actions.edit((draft) => {
      draft.blocks[0].props.p_invoiceNumber = { type: 'number' }
      const instance = draft.nodes[instanceId]
      if (instance.kind === 'block')
        instance.props.p_invoiceNumber = { source: 'field', fieldId: 'invoiceNumber' }
    })
    expect(getTemplateIssues(creator.getTemplate())).toContainEqual(
      expect.objectContaining({ code: 'binding-type', path: `nodes.${instanceId}.props.p_invoiceNumber` }),
    )
    expect(() => createTemplateRevision(creator.getTemplate())).toThrow('requires number')
    creator.actions.edit((draft) => {
      const block = draft.blocks[0]
      block.props.invalid = {
        type: 'object',
        properties: {},
        required: ['unknown'],
        additionalProperties: false,
      }
    })
    expect(() => getTemplateIssues(creator.getTemplate())).not.toThrow()
    expect(getTemplateIssues(creator.getTemplate())).toContainEqual(
      expect.objectContaining({ path: `blocks.${blockId}@1.props.invalid`, code: 'data-schema' }),
    )
  })
  it('preserves unchanged subtrees across edits and immutable undo snapshots', () => {
    const creator = createTemplateCreator({ initialTemplate: createInvoiceTemplate() })
    const runtime = getCreatorRuntime(creator)
    const before = runtime.store.getState().template
    creator.actions.edit((draft) => {
      draft.name = 'Changed'
    })
    expect(runtime.store.getState().template.nodes).toBe(before.nodes)
    expect(runtime.store.getState().template.fields).toBe(before.fields)
    creator.actions.updateNode(before.roots[0], { name: 'New name' })
    expect(before.nodes[before.roots[0]].name).not.toBe('New name')
    creator.actions.undo()
    expect(runtime.store.getState().template.nodes).toBe(before.nodes)
  })
})
