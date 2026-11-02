import { describe, expect, it, vi } from 'vitest'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { createInvoiceTemplate } from './defaults'
import { getTemplateDataSchema, resolveTemplateData, validateJSONData } from './contracts'
import {
  getTemplateJSONSchemas,
  TemplateError,
  TemplateBlockLibrarySchema,
  type TemplateNode,
  type TemplatePersonalization,
} from './schema'
import {
  parseTemplateDefinition,
  parseTemplatePersonalization,
  parseTemplateRevision,
  parseTemplateRenderInput,
} from './validation'
import { createTemplateRevision, renderTemplate } from './render'
import { createTemplateCreator, createTemplateEditor, getCreatorRuntime } from './editing'
import { adaptVoucherProject } from './legacy'
import { createEmptyProject } from '../voucher-builder/lib/empty-project'
import { HeadingBlockSchema } from '../voucher-builder/schema'
import { compileTemplateCSS } from './styles'

const completeData = () => resolveTemplateData(createInvoiceTemplate(), {}, 'preview').data
describe('portable template contracts', () => {
  it.each([
    ['2026-11-01T10:11:12Z', true],
    ['2026-11-01T10:11:12.345Z', true],
    ['2026-11-01T10:11Z', false],
    ['2026-02-30T10:11:12Z', false],
  ] as const)('agrees with portable date-time validation for %s', (publishedAt, valid) => {
    const revision = { ...createTemplateRevision(createInvoiceTemplate()), publishedAt }
    const ajv = new Ajv2020({ strict: true })
    addFormats(ajv)
    expect(ajv.compile(getTemplateJSONSchemas()['template-revision.v1'])(revision)).toBe(valid)
    if (valid) expect(parseTemplateRevision(revision)).toEqual(revision)
    else expect(() => parseTemplateRevision(revision)).toThrow()
  })
  it('validates render requests against the revision and full runtime dataset', () => {
    const template = createTemplateRevision(createInvoiceTemplate())
    const personalization = {
      format: 'gct-personalization',
      schemaVersion: 1,
      templateId: template.templateId,
      revision: 1,
      data: completeData(),
      overrides: {},
    }
    expect(parseTemplateRenderInput({ template, personalization }).personalization.data).toEqual(
      completeData(),
    )
    expect(() =>
      parseTemplateRenderInput({ template, personalization: { ...personalization, data: {} } }),
    ).toThrow('Render data')
    expect(() =>
      parseTemplateRenderInput({ template, personalization: { ...personalization, revision: 2 } }),
    ).toThrow('different template revision')
  })
  it('validates wire artifacts with the exported JSON Schemas', () => {
    const definition = createInvoiceTemplate()
    const revision = createTemplateRevision(definition)
    const personalization = {
      format: 'gct-personalization',
      schemaVersion: 1,
      templateId: revision.templateId,
      revision: 1,
      data: completeData(),
      overrides: {},
    }
    const fixtures = {
      'template-definition.v1': definition,
      'template-revision.v1': revision,
      'template-personalization.v1': personalization,
      'template-field.v1': definition.fields[0],
      'template-render-input.v1': { template: revision, personalization },
      'template-block-library.v1': TemplateBlockLibrarySchema.parse({
        format: 'gct-template-block-library', schemaVersion: 1, entry: { blockId: 'note', version: 1 },
        blocks: [{ id: 'note', version: 1, name: 'Note', roots: ['text'], nodes: {
          text: { id: 'text', name: 'Text', kind: 'text', parts: [{ value: { source: 'literal', value: 'Note' } }] },
        } }],
      }),
    }
    for (const [name, schema] of Object.entries(getTemplateJSONSchemas())) {
      const ajv = new Ajv2020({ strict: true, allErrors: true })
      addFormats(ajv)
      const validate = ajv.compile(schema)
      expect(validate(fixtures[name as keyof typeof fixtures]), JSON.stringify(validate.errors)).toBe(true)
      expect(validate({ ...fixtures[name as keyof typeof fixtures], unexpected: true })).toBe(false)
    }
  })
  it('keeps design samples distinct from production defaults and validates nested data types', () => {
    const template = createInvoiceTemplate()
    expect(resolveTemplateData(template, {}).issues.length).toBeGreaterThan(0)
    expect(resolveTemplateData(template, {}, 'preview').issues).toEqual([])
    const schema = getTemplateDataSchema(template)
    expect(validateJSONData(schema, completeData())).toEqual([])
    const wrong = completeData()
    ;(wrong.invoice as Record<string, unknown>).total = '1850'
    expect(validateJSONData(schema, wrong)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'type', path: '/invoice/total' })]),
    )
    expect((wrong.invoice as Record<string, unknown>).total).toBe('1850')
    template.fields.find((field) => field.id === 'total')!.defaultValue = 0
    expect((resolveTemplateData(template).data.invoice as Record<string, unknown>).total).toBe(0)
  })
  it('rejects inconsistent paths, bad examples, dangling bindings, and graph cycles', () => {
    const template = createInvoiceTemplate()
    template.fields[0].path = 'constructor.name'
    expect(() => parseTemplateDefinition(template)).toThrow('Invalid data path')
    const examples = createInvoiceTemplate()
    examples.fields.find((field) => field.id === 'total')!.defaultValue = 'wrong'
    expect(() => parseTemplateDefinition(examples)).toThrow()
    const cyclic = createInvoiceTemplate()
    const root = cyclic.nodes[cyclic.roots[0]]
    if ('children' in root) root.children.push(root.id)
    expect(() => parseTemplateDefinition(cyclic)).toThrow('Cyclic')
    const binding = createInvoiceTemplate()
    binding.fields = []
    expect(() => parseTemplateDefinition(binding)).toThrow('Unknown field')
    const overlapping = createInvoiceTemplate()
    overlapping.fields.push({
      id: 'invoice',
      path: 'invoice',
      label: 'Invoice',
      description: '',
      schema: { type: 'object', properties: {}, additionalProperties: false },
      required: true,
      editable: true,
    })
    expect(() => parseTemplateDefinition(overlapping)).toThrow('overlapping')
  })
  it('rejects undeclared item paths and reusable block dependency cycles', () => {
    const template = createInvoiceTemplate()
    const itemText = Object.values(template.nodes).find(
      (node) => node.kind === 'text' && node.parts.some((part) => part.value.source === 'item'),
    )!
    if (itemText.kind === 'text') itemText.parts[0].value = { source: 'item', path: 'notDeclared' }
    expect(() => parseTemplateDefinition(template)).toThrow('not declared')
    const cyclic = createInvoiceTemplate()
    const permissions = { content: false, style: false }
    cyclic.blocks = [
      {
        id: 'blockA',
        version: 1,
        name: 'A',
        props: {},
        requiredProps: [],
        css: '',
        roots: ['refB'],
        nodes: {
          refB: {
            id: 'refB',
            name: 'B',
            permissions,
            kind: 'block',
            blockId: 'blockB',
            version: 1,
            props: {},
            slots: {},
          },
        },
      },
      {
        id: 'blockB',
        version: 1,
        name: 'B',
        props: {},
        requiredProps: [],
        css: '',
        roots: ['refA'],
        nodes: {
          refA: {
            id: 'refA',
            name: 'A',
            permissions,
            kind: 'block',
            blockId: 'blockA',
            version: 1,
            props: {},
            slots: {},
          },
        },
      },
    ]
    expect(() => parseTemplateDefinition(cyclic)).toThrow('dependency cycle')
  })
  it('rejects unknown versions and mismatched revision contracts', () => {
    const revision = createTemplateRevision(createInvoiceTemplate())
    expect(() => parseTemplateRevision({ ...revision, schemaVersion: 2 })).toThrow(TemplateError)
    expect(() => parseTemplateRevision({ ...revision, dataContract: {} })).toThrow('must match')
  })
  it('renders repeaters, scoped item bindings, and escaped text without executing markup', () => {
    const template = createInvoiceTemplate()
    const data = completeData()
    ;(data.customer as Record<string, unknown>).name = '<img src=x onerror=alert(1)>'
    const result = renderTemplate(template, { data })
    expect(result.issues).toEqual([])
    expect(result.html).toContain('Brand direction &amp; identity')
    expect(result.html).toContain('Editorial design')
    expect(result.html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(result.html).toContain('€1,850.00')
    expect(renderTemplate(template).html).toBe('')
    expect(renderTemplate(template, { mode: 'preview', useSamples: false }).html).toContain('Missing value')
  })
  it('parses stylesheets, scopes selectors, and rejects executable or external CSS sources', () => {
    const result = compileTemplateCSS(
      ':root{--brand:green}@media print{.invoice > h1:hover{color:var(--brand)}}',
    )
    expect(result.issues).toEqual([])
    expect(result.css).toContain('.template-document .invoice > h1:hover')
    expect(result.classes).toContain('invoice')
    for (const css of [
      '@import "https://elsewhere.test/a.css";',
      '.x{background:url(https://x.test/image)}',
      '.x{color:red}</style><script>alert(1)</script>',
    ])
      expect(compileTemplateCSS(css).issues.length).toBeGreaterThan(0)
  })
})

describe('local authoring and personalization', () => {
  it('keeps document settings selected after edits and inserts bound images in one undo step', () => {
    const onError = vi.fn()
    const creator = createTemplateCreator({ initialTemplate: createInvoiceTemplate(), onError })
    creator.actions.select(null)
    creator.actions.edit((draft) => {
      draft.page.widthMm = 215.9
    })
    expect(getCreatorRuntime(creator).store.getState().selectedId).toBeNull()
    expect(() =>
      creator.actions.edit((draft) => {
        draft.page.widthMm = 12
      }),
    ).toThrow()
    expect(onError.mock.calls[0][0]).toMatchObject({
      operation: 'validation',
      issues: [expect.objectContaining({ path: 'page.widthMm' })],
    })
    creator.actions.edit((draft) => {
      draft.assets.push({
        id: 'logo',
        name: 'Brand mark',
        kind: 'image',
        url: '/logo.png',
        mimeType: 'image/png',
      })
    })
    const before = creator.getTemplate()
    const id = creator.actions.insertImage('logo')
    expect(creator.getTemplate().nodes[id]).toMatchObject({
      tag: 'img',
      attributes: { alt: 'Brand mark' },
      attributeBindings: { src: { source: 'asset', assetId: 'logo' } },
    })
    expect(() => parseTemplateDefinition(creator.getTemplate())).not.toThrow()
    creator.actions.undo()
    expect(creator.getTemplate()).toEqual(before)
    expect(() => creator.actions.insertImage('missing')).toThrow('image asset')
    creator.destroy()
  })
  it('isolates component state and makes document edits undoable', () => {
    const a = createTemplateCreator({ initialTemplate: createInvoiceTemplate() })
    const b = createTemplateCreator({ initialTemplate: createInvoiceTemplate() })
    const before = a.getTemplate()
    a.actions.edit((draft) => {
      draft.name = 'A'
      draft.page.widthMm = 216
    })
    expect(b.getTemplate().name).not.toBe('A')
    a.actions.undo()
    expect(a.getTemplate()).toEqual(before)
    a.actions.redo()
    expect(a.getTemplate().name).toBe('A')
    a.destroy()
    b.destroy()
  })
  it('pins reusable block versions and detaches copies without changing the library', () => {
    const creator = createTemplateCreator({ initialTemplate: createInvoiceTemplate() })
    const source = creator.getTemplate().roots[0]
    const id = creator.actions.saveBlock(source, 'Header')
    const instance = creator.actions.insertBlock(id, 1)
    creator.actions.saveBlock(source, 'Header', id)
    expect((creator.getTemplate().nodes[instance] as Extract<TemplateNode, { kind: 'block' }>).version).toBe(
      1,
    )
    const library = creator.getTemplate().blocks
    creator.actions.detachBlock(instance)
    expect(creator.getTemplate().nodes[instance].kind).toBe('element')
    expect(creator.getTemplate().blocks).toEqual(library)
    expect(() => createTemplateRevision(creator.getTemplate())).not.toThrow()
    creator.destroy()
  })
  it('enforces editing permissions in commands and serialized personalization', () => {
    const revision = createTemplateRevision(createInvoiceTemplate())
    const onError = vi.fn()
    const editor = createTemplateEditor({ template: revision, initialData: completeData(), onError })
    const original = editor.getPersonalization()
    const locked = revision.template.roots[0]
    expect(() => editor.actions.override(locked, { style: { color: 'red' } })).toThrow('controlled')
    expect(editor.getPersonalization()).toEqual(original)
    const allowed = Object.values(revision.template.nodes).find(
      (node) => node.kind === 'text' && node.permissions.content,
    )!
    editor.actions.override(allowed.id, { text: 'Personal thank-you note' })
    expect(editor.render().html).toContain('Personal thank-you note')
    editor.actions.undo()
    expect(editor.getPersonalization()).toEqual(original)
    const invalid = { ...original, overrides: { [locked]: { text: 'tampered' } } }
    expect(() => parseTemplatePersonalization(invalid, revision)).toThrow(TemplateError)
    editor.destroy()
  })
  it('does not allow the user to change application-supplied fields', () => {
    const template = createInvoiceTemplate()
    template.fields.find((field) => field.id === 'total')!.editable = false
    const editor = createTemplateEditor({
      template: createTemplateRevision(template),
      initialData: completeData(),
      onError: vi.fn(),
    })
    expect(() => editor.actions.setField('total', 1)).toThrow('application')
    const forged = editor.getPersonalization()
    ;(forged.data.invoice as Record<string, unknown>).total = 1
    expect(() =>
      parseTemplatePersonalization(forged, createTemplateRevision(template), { trustedData: completeData() }),
    ).toThrow('application')
    expect(editor.render().html).toContain('€1,850.00')
    editor.destroy()
  })
  it('validates HTML export while retaining editable JSON with missing values', () => {
    const onError = vi.fn()
    const revision = createTemplateRevision(createInvoiceTemplate())
    const editor = createTemplateEditor({ template: revision, onError })
    expect(() => editor.exportDocument('html')).toThrow('Complete')
    expect(JSON.parse(editor.exportDocument('json').data)).toEqual(editor.getPersonalization())
    const ready = createTemplateEditor({ template: revision, initialData: completeData() })
    expect(ready.exportDocument('html').data).toContain('<!DOCTYPE html>')
    editor.destroy()
    ready.destroy()
  })
  it('migrates voucher HTML through a parser while preserving rich text and binding contracts', () => {
    const project = createEmptyProject()
    const heading = HeadingBlockSchema.parse({ id: 'heading', type: 'heading', content: {}, settings: {} })
    heading.content = { ...heading.content, text: '<strong>Hello</strong>' } as typeof heading.content
    heading.commonSettings = {
      ...heading.commonSettings!,
      dynamicKey: ':customer_name',
      previewValue: 'Jane',
    }
    project.blocks.heading = heading
    project.sections[0].blockIds.push('heading')
    const migrated = adaptVoucherProject(project)
    expect(migrated.template.fields[0]).toMatchObject({
      path: 'customer_name',
      sample: 'Jane',
      required: true,
    })
    expect(migrated.template.fields[0].defaultValue).toBeUndefined()
    expect(migrated.warnings.length).toBeGreaterThan(0)
    const result = renderTemplate(migrated.template, { data: { customer_name: 'Real customer' } })
    expect(result.issues).toEqual([])
    expect(result.html).toContain('Real customer')
  })
  it('keeps personalization tied to the selected template snapshot', () => {
    const revision = createTemplateRevision(createInvoiceTemplate())
    const invalid = {
      format: 'gct-personalization',
      schemaVersion: 1,
      templateId: revision.templateId,
      revision: 99,
      data: {},
      overrides: {},
    } as TemplatePersonalization
    expect(() => parseTemplatePersonalization(invalid, revision)).toThrow('different template revision')
  })
})
