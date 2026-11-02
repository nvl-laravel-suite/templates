import { describe, it, expect } from 'vitest'
import { createTemplateCreator } from './editing'
import { createInvoiceTemplate, createTemplateNode } from './defaults'
import { createTemplateRevision, renderTemplate } from './render'
import { resolveTemplateData } from './contracts'
import {
  getTemplateIssues,
  parseTemplateDefinition,
  parseTemplatePersonalization,
  parseTemplateRenderInput,
} from './validation'
import { TemplateBlockSchema, type TemplatePersonalization } from './schema'

const personalization = (
  template: ReturnType<typeof createTemplateRevision>,
  data: TemplatePersonalization['data'] = {},
): TemplatePersonalization => ({
  format: 'gct-personalization',
  schemaVersion: 1,
  templateId: template.templateId,
  revision: template.revision,
  data,
  overrides: {},
})
describe('deep public contract audit', () => {
  it('never injects design samples into a personalization preview by default', () => {
    const template = createTemplateRevision(createInvoiceTemplate())
    const result = renderTemplate(template, { mode: 'preview', personalization: personalization(template) })
    expect(result.html).toContain('Missing value')
    expect(result.html).not.toContain('Marlow &amp; Co.')
    expect(result.data).toEqual({})
    expect(renderTemplate(template, { mode: 'preview' }).html).toContain('Marlow &amp; Co.')
  })
  it('applies read-only runtime defaults consistently at the data contract boundary', () => {
    const definition = createInvoiceTemplate()
    const total = definition.fields.find((field) => field.id === 'total')!
    total.editable = false
    total.defaultValue = 0
    const template = createTemplateRevision(definition)
    const data = resolveTemplateData(definition, {}, 'preview').data
    ;(data.invoice as Record<string, unknown>).total = 0
    const values = personalization(template, data)
    expect(parseTemplatePersonalization(values, template, { trustedData: {} }).data).toEqual(data)
    expect(
      parseTemplateRenderInput({ template, personalization: values }, { trustedData: {} }).personalization
        .data,
    ).toEqual(data)
  })
  it.each([null, 'malformed', []])(
    'rejects malformed parents before trusted-value injection: %j',
    (invoice) => {
      const definition = createInvoiceTemplate()
      definition.fields.find((field) => field.id === 'total')!.editable = false
      const template = createTemplateRevision(definition)
      const supplied = personalization(template, { invoice })
      expect(() =>
        parseTemplatePersonalization(supplied, template, { trustedData: { invoice: { total: 42 } } }),
      ).toThrow('invoice must be an object')
      expect(supplied.data.invoice).toEqual(invoice)
      expect(() =>
        parseTemplatePersonalization(personalization(template), template, { trustedData: { invoice } }),
      ).toThrow('invoice must be an object')
    },
  )
  it.each([null, [], false, 'invalid'])('rejects non-object trusted data: %j', (input) => {
    const template = createTemplateRevision(createInvoiceTemplate())
    expect(() =>
      parseTemplatePersonalization(personalization(template), template, {
        // @ts-expect-error Verify the runtime boundary for untyped callers.
        trustedData: input,
      }),
    ).toThrow('Trusted data must be a JSON object')
  })
  it('detaches a filled slot without leaving cloned fallback nodes unreachable', () => {
    const creator = createTemplateCreator({ initialTemplate: createInvoiceTemplate() })
    const fallback = createTemplateNode('text')
    creator.actions.edit((draft) => {
      draft.blocks.push(
        TemplateBlockSchema.parse({
          id: 'card',
          version: 1,
          name: 'Card',
          roots: ['body'],
          nodes: {
            body: { id: 'body', kind: 'slot', name: 'Body', slot: 'body', children: [fallback.id] },
            [fallback.id]: fallback,
          },
        }),
      )
    })
    const id = creator.actions.insertBlock('card', 1)
    const custom = createTemplateNode('text')
    if (custom.kind === 'text') custom.parts[0].value = { source: 'literal', value: 'Slotted content' }
    creator.actions.edit((draft) => {
      draft.nodes[custom.id] = custom
      const instance = draft.nodes[id]
      if (instance.kind === 'block') instance.slots.body = [custom.id]
    })
    expect(getTemplateIssues(creator.getTemplate())).toEqual([])
    const count = Object.keys(creator.getTemplate().nodes).length
    creator.actions.detachBlock(id)
    expect(getTemplateIssues(creator.getTemplate())).toEqual([])
    expect(Object.keys(creator.getTemplate().nodes)).toHaveLength(count + 1)
    expect(renderTemplate(creator.getTemplate(), { mode: 'preview' }).html).toContain('Slotted content')
    expect(() => createTemplateRevision(creator.getTemplate())).not.toThrow()
    creator.destroy()
  })
  it('rejects unsupported factory kinds rather than silently creating an element', () => {
    // @ts-expect-error Block and slot creation require explicit references.
    expect(() => createTemplateNode('slot')).toThrow('Create block and slot nodes')
  })
  it('rejects repeated slot names and invalid language tags with actionable paths', () => {
    const definition = createInvoiceTemplate()
    definition.locale = '%%'
    expect(getTemplateIssues(definition)).toContainEqual(
      expect.objectContaining({ path: 'locale', code: 'locale' }),
    )
    definition.locale = 'en-GB'
    definition.blocks.push(
      TemplateBlockSchema.parse({
        id: 'card',
        version: 1,
        name: 'Card',
        roots: ['a', 'b'],
        nodes: {
          a: { id: 'a', kind: 'slot', name: 'A', slot: 'body', children: [] },
          b: { id: 'b', kind: 'slot', name: 'B', slot: 'body', children: [] },
        },
      }),
    )
    expect(() => parseTemplateDefinition(definition)).toThrow('Slot names must be unique')
  })
})
