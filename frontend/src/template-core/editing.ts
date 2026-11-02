import { createStore } from 'zustand/vanilla'
import { nanoid } from 'nanoid'
import { ZodError } from 'zod'
import { createTemplateDefinition, createTemplateNode } from './defaults'
import {
  childIds,
  getTemplateIssues,
  nodeValues,
  parseTemplateDraft,
  parseTemplatePersonalization,
  parseTemplateRevision,
} from './validation'
import {
  TemplateDefinitionSchema,
  TemplateNodeSchema,
  TemplateBlockSchema,
  TemplateError,
  JsonObjectSchema,
  type JsonObject,
  type JsonValue,
  type TemplateDefinition,
  type TemplateNode,
  type TemplatePersonalization,
  type TemplateRevision,
  type TemplateValue,
  type TemplateBlock,
} from './schema'
import { getTemplateBlockField, parseTemplateBlockLibrary } from './blocks'
import { getValue, resolveTemplateData, setValue, stableJSONStringify } from './contracts'
import { createTemplateRevision, renderTemplate } from './render'
import { shareJSON } from './structural-sharing'
import { parseTemplateFragment, type TemplateFragment } from './fragments'
import { applyTemplateColumnLayout, type TemplateColumnLayoutPatch } from './columns'

interface Callbacks {
  onError?: (error: TemplateError) => void
}
function asTemplateError(cause: unknown, operation: TemplateError['operation'] = 'validation') {
  if (cause instanceof TemplateError) return cause
  if (cause instanceof ZodError)
    return new TemplateError(
      operation,
      cause.issues[0]?.message ?? 'Check the supplied values.',
      cause.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message, code: issue.code })),
      cause,
    )
  return new TemplateError(operation, cause instanceof Error ? cause.message : String(cause), [], cause)
}
export type TemplateCreatorOperation = 'edit' | 'load' | 'undo' | 'redo'
export interface TemplateCreatorOptions extends Callbacks {
  /** Synchronous authorization/constraint check, invoked before any graph/history mutation. */
  validateChange?: (before: TemplateDefinition, next: TemplateDefinition, operation: TemplateCreatorOperation) => void
  initialTemplate?: TemplateDefinition
  onChange?: (template: TemplateDefinition) => void
}
export interface TemplateCreatorState {
  template: TemplateDefinition
  selectedId: string | null
  undo: TemplateDefinition[]
  redo: TemplateDefinition[]
  error: TemplateError | null
}
const newId = () => `n_${nanoid(10).replace(/-/g, '_')}`
const firstRoot = (template: TemplateDefinition) => template.roots.find(id => Object.hasOwn(template.nodes, id)) ?? null
function report(callbacks: Callbacks, error: TemplateError) {
  try {
    if (callbacks.onError) {
      const result: unknown = callbacks.onError(error)
      if (result && typeof (result as PromiseLike<unknown>).then === 'function')
        void Promise.resolve(result).catch((cause) =>
          console.error('[template-builder] onError failed', cause),
        )
    } else console.error('[template-builder]', error)
  } catch (cause) {
    console.error('[template-builder] onError failed', cause)
  }
}
function notify<T>(callbacks: Callbacks, handler: ((value: T) => unknown) | undefined, value: T) {
  try {
    const result = handler?.(structuredClone(value))
    if (result && typeof (result as PromiseLike<unknown>).then === 'function')
      void Promise.resolve(result).catch((cause) =>
        report(callbacks, new TemplateError('callback', 'A template callback failed.', [], cause)),
      )
  } catch (cause) {
    report(callbacks, new TemplateError('callback', 'A template callback failed.', [], cause))
  }
}
function replaceChildReference(template: TemplateDefinition, id: string, replacement: string[]) {
  const replace = (ids: string[]) => ids.flatMap((value) => (value === id ? replacement : [value]))
  template.roots = replace(template.roots)
  for (const node of Object.values(template.nodes)) {
    if ('children' in node) node.children = replace(node.children)
    if (node.kind === 'block')
      for (const name of Object.keys(node.slots)) node.slots[name] = replace(node.slots[name])
  }
}
function descendants(nodes: Record<string, TemplateNode>, id: string, found = new Set<string>()) {
  if (!Object.hasOwn(nodes, id) || found.has(id)) return found
  found.add(id)
  childIds(nodes[id]).forEach((child) => descendants(nodes, child, found))
  return found
}
function remapNode(node: TemplateNode, map: Map<string, string>): TemplateNode {
  const copy = structuredClone(node)
  copy.id = map.get(node.id)!
  if ('children' in copy) copy.children = copy.children.map((id) => map.get(id)!)
  if (copy.kind === 'block')
    for (const name of Object.keys(copy.slots)) copy.slots[name] = copy.slots[name].map((id) => map.get(id)!)
  return copy
}
function mapValues(node: TemplateNode, transform: (value: TemplateValue) => TemplateValue) {
  if (node.kind === 'text') node.parts = node.parts.map((part) => ({ ...part, value: transform(part.value) }))
  else if (node.kind === 'element')
    node.attributeBindings = Object.fromEntries(
      Object.entries(node.attributeBindings).map(([key, value]) => [key, transform(value)]),
    )
  else if (node.kind === 'block')
    node.props = Object.fromEntries(Object.entries(node.props).map(([key, value]) => [key, transform(value)]))
  else if ('binding' in node) node.binding = transform(node.binding)
}

/** Authoring and personalization share the same schemas, renderer, and transaction semantics. */
function createCreator(options: TemplateCreatorOptions = {}) {
  let callbacks = options
  let disposed = false
  const initial = TemplateDefinitionSchema.parse(options.initialTemplate ?? createTemplateDefinition())
  const store = createStore<TemplateCreatorState>(() => ({
    template: initial,
    selectedId: firstRoot(initial),
    undo: [],
    redo: [],
    error: null,
  }))
  const active = () => {
    if (disposed) throw new Error('Template creator has been destroyed.')
  }
  const error = (cause: unknown, operation: TemplateError['operation'] = 'validation') => {
    const problem = asTemplateError(cause, operation)
    if (!disposed) {
      store.setState({ error: problem })
      report(callbacks, problem)
    }
    return problem
  }
  const guard = (before: TemplateDefinition, next: TemplateDefinition, operation: TemplateCreatorOperation) => {
    try {
      const result: unknown = callbacks.validateChange?.(structuredClone(before), structuredClone(next), operation)
      if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
        void Promise.resolve(result).catch(() => {})
        throw new TemplateError('validation', 'Authoring change guards must be synchronous.')
      }
    } catch (cause) { throw error(cause) }
  }
  const edit = (change: (draft: TemplateDefinition) => void) => {
    active()
    const state = store.getState()
    const draft = structuredClone(state.template)
    try {
      const result: unknown = change(draft)
      if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
        void Promise.resolve(result).catch(() => {})
        throw new TemplateError(
          'validation',
          'Authoring edits must be synchronous. Await external work before editing.',
        )
      }
      const checked = shareJSON(state.template, TemplateDefinitionSchema.parse(draft))
      if (checked.id !== state.template.id)
        throw new TemplateError('validation', 'Template identity can only change when loading a document.')
      if (JSON.stringify(checked) === JSON.stringify(state.template)) return
      guard(state.template, checked, 'edit')
      store.setState({
        template: checked,
        undo: [...state.undo, state.template].slice(-100),
        redo: [],
        error: null,
        selectedId: state.selectedId && Object.hasOwn(checked.nodes, state.selectedId) ? state.selectedId : null,
      })
      notify(
        {
          onError: (problem) => {
            if (!disposed) report(callbacks, problem)
          },
        },
        callbacks.onChange,
        checked,
      )
    } catch (cause) {
      throw error(cause)
    }
  }
  const insert = (draft: TemplateDefinition, id: string, parentId: string | null, index?: number) => {
    const parent = parentId ? draft.nodes[parentId] : undefined
    if (parentId && (!parent || !('children' in parent)))
      throw new TemplateError('validation', 'Choose a container for nested content.')
    if (parent?.kind === 'element' && ['img', 'br', 'hr'].includes(parent.tag))
      throw new TemplateError('validation', 'This element cannot contain children.')
    const list = parent && 'children' in parent ? parent.children : draft.roots
    list.splice(index === undefined ? list.length : Math.max(0, Math.min(index, list.length)), 0, id)
  }
  const actions = {
    edit,
    select(id: string | null) {
      active()
      if (id && !Object.hasOwn(store.getState().template.nodes, id)) return
      store.setState({ selectedId: id })
    },
    updateNode(id: string, patch: Partial<TemplateNode>) {
      edit((draft) => {
        if (!Object.hasOwn(draft.nodes, id)) return
        const node = TemplateNodeSchema.parse({
          ...draft.nodes[id],
          ...patch,
          id,
          kind: draft.nodes[id].kind,
        })
        draft.nodes[id] = node
      })
    },
    insert(tag = 'p', parentId: string | null = null) {
      let id = ''
      edit((draft) => {
        const node = createTemplateNode('element', tag)
        id = node.id
        if ('children' in node && !['div', 'section', 'img', 'hr', 'br', 'table', 'ul', 'ol'].includes(tag)) {
          const text = createTemplateNode('text')
          draft.nodes[text.id] = text
          node.children.push(text.id)
        }
        if (node.kind === 'element' && tag === 'img') node.attributes.alt = 'Image'
        draft.nodes[id] = node
        insert(draft, id, parentId)
      })
      actions.select(id)
      return id
    },
    insertControl(kind: 'repeat' | 'condition', parentId: string | null = null) {
      const node = createTemplateNode(kind)
      edit((draft) => {
        draft.nodes[node.id] = node
        insert(draft, node.id, parentId)
      })
      actions.select(node.id)
      return node.id
    },
    insertFragment(input: TemplateFragment, parentId: string | null = null) {
      let roots: string[] = []
      edit(draft => {
        const fragment = parseTemplateFragment(input)
        const map = new Map(Object.keys(fragment.nodes).map(id => [id, newId()]))
        roots = fragment.roots.map(id => map.get(id)!)
        for (const node of Object.values(fragment.nodes)) draft.nodes[map.get(node.id)!] = remapNode(node, map)
        for (const id of roots) insert(draft, id, parentId)
      })
      actions.select(roots[0])
      return roots
    },
    setColumnLayout(id: string, patch: TemplateColumnLayoutPatch) {
      edit(draft => applyTemplateColumnLayout(draft, id, patch))
    },
    insertImage(assetId: string, parentId: string | null = null) {
      let id = ''
      edit((draft) => {
        const asset = draft.assets.find((asset) => asset.id === assetId && asset.kind === 'image')
        if (!asset) throw new TemplateError('validation', 'Choose an image asset before inserting it.')
        const node = createTemplateNode('element', 'img')
        if (node.kind !== 'element') return
        id = node.id
        node.attributes.alt = asset.name
        node.attributeBindings.src = { source: 'asset', assetId }
        draft.nodes[id] = node
        insert(draft, id, parentId)
      })
      actions.select(id)
      return id
    },
    remove(id: string) {
      edit((draft) => {
        replaceChildReference(draft, id, [])
        for (const child of descendants(draft.nodes, id)) delete draft.nodes[child]
      })
    },
    duplicate(id: string) {
      let clonedId = ''
      edit((draft) => {
        const ids = [...descendants(draft.nodes, id)]
        if (!ids.length) return
        const map = new Map(ids.map((id) => [id, newId()]))
        clonedId = map.get(id)!
        for (const source of ids) draft.nodes[map.get(source)!] = remapNode(draft.nodes[source], map)
        replaceChildReference(draft, id, [id, clonedId])
      })
      if (clonedId) actions.select(clonedId)
    },
    move(id: string, parentId: string | null, index: number) {
      edit((draft) => {
        if (!Object.hasOwn(draft.nodes, id)) return
        if (parentId && descendants(draft.nodes, id).has(parentId))
          throw new TemplateError('validation', 'An element cannot move into its own subtree.')
        replaceChildReference(draft, id, [])
        insert(draft, id, parentId, index)
      })
    },
    undo() {
      active()
      const state = store.getState()
      const template = state.undo.at(-1)
      if (template) {
        guard(state.template, template, 'undo')
        store.setState({
          template,
          undo: state.undo.slice(0, -1),
          redo: [...state.redo, state.template],
          selectedId: state.selectedId && Object.hasOwn(template.nodes, state.selectedId) ? state.selectedId : null,
        })
        notify(
          {
            onError: (problem) => {
              if (!disposed) report(callbacks, problem)
            },
          },
          callbacks.onChange,
          template,
        )
      }
    },
    redo() {
      active()
      const state = store.getState()
      const template = state.redo.at(-1)
      if (template) {
        guard(state.template, template, 'redo')
        store.setState({
          template,
          redo: state.redo.slice(0, -1),
          undo: [...state.undo, state.template],
          selectedId: state.selectedId && Object.hasOwn(template.nodes, state.selectedId) ? state.selectedId : null,
        })
        notify(
          {
            onError: (problem) => {
              if (!disposed) report(callbacks, problem)
            },
          },
          callbacks.onChange,
          template,
        )
      }
    },
    load(input: unknown) {
      active()
      const snapshot =
        input && typeof input === 'object' && 'format' in input && input.format === 'gct-template-revision'
          ? parseTemplateRevision(input)
          : null
      const template = snapshot?.template ?? parseTemplateDraft(input)
      guard(store.getState().template, template, 'load')
      store.setState({
        template,
        undo: [],
        redo: [],
        selectedId: firstRoot(template),
        error: null,
      })
      notify(
        {
          onError: (problem) => {
            if (!disposed) report(callbacks, problem)
          },
        },
        callbacks.onChange,
        template,
      )
    },
    saveBlock(id: string, name: string, existingBlockId?: string) {
      const blockId = existingBlockId ?? `b_${nanoid(8).replace(/-/g, '_')}`
      edit((draft) => {
        const ids = [...descendants(draft.nodes, id)]
        if (!ids.length) throw new TemplateError('validation', 'Select content to reuse.')
        const nodes = Object.fromEntries(ids.map((id) => [id, structuredClone(draft.nodes[id])]))
        const used = new Set(
          Object.values(nodes).flatMap((node) =>
            nodeValues(node)
              .filter((value) => value.source === 'field')
              .map((value) => (value.source === 'field' ? value.fieldId : '')),
          ),
        )
        const fields = draft.fields.filter((field) => used.has(field.id))
        const names = new Map<string, string>()
        for (const [index, field] of fields.entries()) {
          let name = field.id.length <= 78 ? `p_${field.id}` : field.id
          let suffix = index
          while ([...names.values()].includes(name)) name = `p_${suffix++}`
          names.set(field.id, name)
        }
        for (const node of Object.values(nodes))
          mapValues(node, (value) =>
            value.source === 'field' ? { source: 'prop', name: names.get(value.fieldId)! } : value,
          )
        const version =
          Math.max(0, ...draft.blocks.filter((block) => block.id === blockId).map((block) => block.version)) +
          1
        const block = {
          id: blockId,
          version,
          name: name.trim() || 'Reusable block',
          roots: [id],
          nodes,
          props: Object.fromEntries(fields.map((field) => [names.get(field.id)!, field.schema])),
          propertyMetadata: Object.fromEntries(fields.map(field => [names.get(field.id)!, {
            label: field.label, description: field.description, fieldId: field.id,
            ...(field.defaultValue !== undefined ? { defaultValue: field.defaultValue } : {}),
          }])),
          requiredProps: fields.filter((field) => field.required).map((field) => names.get(field.id)!),
          css: draft.styles.css,
        }
        const candidate = { ...draft, blocks: [...draft.blocks, block] }
        const problems = getTemplateIssues(candidate).filter((issue) =>
          issue.path.startsWith(`blocks.${blockId}`),
        )
        if (problems.length)
          throw new TemplateError(
            'validation',
            'Select a complete structure, including its repeater context.',
            problems,
          )
        draft.blocks.push(block)
      })
      return blockId
    },
    insertBlock(blockId: string, version: number, parentId: string | null = null) {
      const id = newId()
      edit((draft) => {
        const block = draft.blocks.find((block) => block.id === blockId && block.version === version)
        if (!block) throw new TemplateError('validation', 'Unknown reusable block version.')
        const props = Object.fromEntries(
          Object.keys(block.props).flatMap(name => {
            const field = getTemplateBlockField(draft, block, name)
            return field ? [[name, { source: 'field', fieldId: field.id }]] : []
          }),
        )
        draft.nodes[id] = TemplateNodeSchema.parse({
          id,
          kind: 'block',
          name: block.name,
          blockId,
          version,
          props,
        })
        insert(draft, id, parentId)
      })
      actions.select(id)
      return id
    },
    setBlockProperty(id: string, name: string, value: TemplateValue | undefined) {
      edit(draft => {
        const node = draft.nodes[id]
        if (node?.kind !== 'block') throw new TemplateError('validation', 'Select a reusable block instance.')
        const block = draft.blocks.find(block => block.id === node.blockId && block.version === node.version)
        if (!block || !Object.hasOwn(block.props, name)) throw new TemplateError('validation', `Unknown block property: ${name}`)
        if (value === undefined) delete node.props[name]
        else node.props[name] = value
      })
    },
    setBlockSlot(id: string, name: string, ids: string[] | undefined) {
      edit(draft => {
        const node = draft.nodes[id]
        if (node?.kind !== 'block') throw new TemplateError('validation', 'Select a reusable block instance.')
        const block = draft.blocks.find(block => block.id === node.blockId && block.version === node.version)
        if (!block || !Object.values(block.nodes).some(item => item.kind === 'slot' && item.slot === name))
          throw new TemplateError('validation', `Unknown block slot: ${name}`)
        const next = ids ?? []
        if (new Set(next).size !== next.length || next.some(child => !Object.hasOwn(draft.nodes, child) || descendants(draft.nodes, child).has(id)))
          throw new TemplateError('validation', 'Choose distinct existing elements outside the block ancestor chain.')
        const previous = Object.hasOwn(node.slots, name) ? node.slots[name] : []
        for (const child of next) replaceChildReference(draft, child, [])
        // Keep displaced content editable at the root rather than orphaning/deleting it.
        draft.roots.push(...previous.filter(child => !next.includes(child)))
        if (ids === undefined) delete node.slots[name]
        else node.slots[name] = [...ids]
      })
    },
    reviseBlock(blockId: string, version: number, patch: Partial<Omit<TemplateBlock, 'id' | 'version'>>) {
      let nextVersion = 0
      edit(draft => {
        const source = draft.blocks.find(block => block.id === blockId && block.version === version)
        if (!source) throw new TemplateError('validation', 'Unknown reusable block version.')
        nextVersion = Math.max(...draft.blocks.filter(block => block.id === blockId).map(block => block.version)) + 1
        const block = TemplateBlockSchema.parse({ ...source, ...patch, id: blockId, version: nextVersion })
        const candidate = { ...draft, blocks: [...draft.blocks, block] }
        const issues = getTemplateIssues(candidate).filter(issue => issue.path.startsWith(`blocks.${blockId}@${nextVersion}`))
        if (issues.length) throw new TemplateError('validation', 'Resolve the reusable block definition checks.', issues)
        draft.blocks.push(block)
      })
      return nextVersion
    },
    importBlockLibrary(input: unknown) {
      const library = parseTemplateBlockLibrary(input)
      edit(draft => {
        if (library.theme && draft.styles.theme && library.theme !== draft.styles.theme)
          throw new TemplateError('validation', 'The block library theme differs. Reconcile the template theme before importing.')
        for (const block of library.blocks) {
          const existing = draft.blocks.find(item => item.id === block.id && item.version === block.version)
          if (existing && stableJSONStringify(existing) !== stableJSONStringify(block))
            throw new TemplateError('validation', `A different pinned block already uses ${block.id}@${block.version}.`)
          if (!existing) draft.blocks.push(block)
        }
        for (const asset of library.assets) {
          const existing = draft.assets.find(item => item.id === asset.id)
          if (existing && stableJSONStringify(existing) !== stableJSONStringify(asset))
            throw new TemplateError('validation', `A different asset already uses ${asset.id}.`)
          if (!existing) draft.assets.push(asset)
        }
        if (library.theme) draft.styles.theme = library.theme
      })
      return library.entry
    },
    detachBlock(id: string) {
      edit((draft) => {
        const instance = draft.nodes[id]
        if (instance?.kind !== 'block') return
        const block = draft.blocks.find(
          (block) => block.id === instance.blockId && block.version === instance.version,
        )
        if (!block) throw new TemplateError('validation', 'Unknown reusable block version.')
        const map = new Map(Object.keys(block.nodes).map((id) => [id, newId()]))
        for (const source of Object.values(block.nodes)) {
          let node = remapNode(source, map)
          if (node.kind === 'slot')
            node = TemplateNodeSchema.parse({
              id: node.id,
              name: node.name,
              kind: 'element',
              tag: 'div',
              children: Object.hasOwn(instance.slots, node.slot) ? instance.slots[node.slot] : node.children,
            })
          draft.nodes[node.id] = node
        }
        draft.nodes[id] = TemplateNodeSchema.parse({
          id,
          name: instance.name,
          kind: 'element',
          tag: 'div',
          classes: [`tpl-block-${block.id}-${block.version}`],
          children: block.roots.map((id) => map.get(id)!),
        })
        const reachable = descendants(draft.nodes, id)
        for (const copiedId of map.values()) if (!reachable.has(copiedId)) delete draft.nodes[copiedId]
        for (const copiedId of map.values()) if (draft.nodes[copiedId])
          mapValues(draft.nodes[copiedId], value => {
            if (value.source !== 'prop') return value
            const fallback = block.propertyMetadata?.[value.name]?.defaultValue
            if (Object.hasOwn(instance.props, value.name)) {
              const binding = instance.props[value.name]
              const field = binding.source === 'field' ? draft.fields.find(field => field.id === binding.fieldId) : undefined
              if (fallback !== undefined && (binding.source === 'item' || binding.source === 'prop' ||
                (binding.source === 'field' && !field?.required && field?.defaultValue === undefined)))
                throw new TemplateError('validation', `Property ${value.name} can use a block default when its binding is absent. Use a literal or required/defaulted field before detaching.`)
              return binding
            }
            if (fallback !== undefined) return { source: 'literal', value: fallback }
            throw new TemplateError('validation', `Set property ${value.name} before detaching this block. Omitted values cannot be represented as standalone bindings.`)
          })
      })
    },
  }
  return {
    store,
    actions,
    getTemplate: () => structuredClone(store.getState().template),
    render: (mode: 'preview' | 'runtime' = 'preview') => {
      active()
      return renderTemplate(store.getState().template, { mode })
    },
    exportDocument(format: 'html' | 'json'): TemplateDocumentExport {
      active()
      if (format !== 'html' && format !== 'json')
        throw error(new TemplateError('validation', 'Supported export formats are html and json.'))
      const template = store.getState().template
      // Draft JSON remains exportable while the author is resolving incomplete content.
      if (format === 'json') return documentExport(format, template.name, JSON.stringify(template, null, 2))
      const rendered = renderTemplate(template, { mode: 'preview' })
      if (!rendered.html || rendered.issues.length)
        throw error(new TemplateError('validation', 'Resolve the template checks before exporting HTML.', rendered.issues))
      return documentExport(format, template.name, rendered.html)
    },
    getOptions: () => callbacks,
    configure(next: TemplateCreatorOptions) {
      callbacks = next
    },
    disconnect() {
      callbacks = {}
    },
    destroy() {
      disposed = true
      callbacks = {}
    },
  }
}
type CreatorRuntime = ReturnType<typeof createCreator>
export type TemplateCreatorInstance = Pick<
  CreatorRuntime,
  'actions' | 'getTemplate' | 'render' | 'exportDocument' | 'destroy'
>
const creatorRuntimes = new WeakMap<TemplateCreatorInstance, CreatorRuntime>()
export function createTemplateCreator(options: TemplateCreatorOptions = {}): TemplateCreatorInstance {
  const runtime = createCreator(options)
  const instance = {
    actions: runtime.actions,
    getTemplate: runtime.getTemplate,
    render: runtime.render,
    exportDocument: runtime.exportDocument,
    destroy: runtime.destroy,
  }
  creatorRuntimes.set(instance, runtime)
  return instance
}
export function getCreatorRuntime(instance: TemplateCreatorInstance) {
  const runtime = creatorRuntimes.get(instance)
  if (!runtime) throw new Error('Use createTemplateCreator() to create an instance.')
  return runtime
}

export interface TemplateDocumentExport {
  format: 'html' | 'json'
  data: string
  filename: string
  mimeType: string
}
function documentExport(format: 'html' | 'json', name: string, data: string): TemplateDocumentExport {
  return { format, data, filename: `${name}.${format}`, mimeType: format === 'html' ? 'text/html' : 'application/json' }
}
export interface TemplateEditorOptions extends Callbacks {
  /** A definition can be edited directly. A revision optionally pins a host-owned version. */
  template: TemplateDefinition | TemplateRevision
  initialData?: JsonObject
  initialPersonalization?: TemplatePersonalization
  onChange?: (personalization: TemplatePersonalization) => void
}
export interface TemplateEditorPreload {
  data?: JsonObject
  personalization?: TemplatePersonalization
}
function editorInput(input: TemplateDefinition | TemplateRevision, preload: TemplateEditorPreload = {}) {
  const revision = input.format === 'gct-template-revision'
    ? parseTemplateRevision(input)
    : createTemplateRevision(input)
  const initialData = resolveTemplateData(revision.template, JsonObjectSchema.parse(preload.data ?? {})).data
  const personalization = preload.personalization
    ? parseTemplatePersonalization(preload.personalization, revision, { trustedData: initialData })
    : {
        format: 'gct-personalization' as const,
        schemaVersion: 1 as const,
        templateId: revision.templateId,
        revision: revision.revision,
        data: initialData,
        overrides: {},
      }
  personalization.data = resolveTemplateData(revision.template, personalization.data).data
  return { revision, initialData, personalization }
}
function createEditor(options: TemplateEditorOptions) {
  const input = editorInput(options.template, { data: options.initialData, personalization: options.initialPersonalization })
  let revision = input.revision
  let callbacks = options
  let disposed = false
  let initialData = input.initialData
  const store = createStore(() => ({
    revision,
    template: revision.template,
    personalization: input.personalization,
    selectedId: null as string | null,
    undo: [] as TemplatePersonalization[],
    redo: [] as TemplatePersonalization[],
    error: null as TemplateError | null,
  }))
  const active = () => {
    if (disposed) throw new Error('Template editor has been destroyed.')
  }
  const fail = (cause: unknown, operation: TemplateError['operation'] = 'validation') => {
    const error = asTemplateError(cause, operation)
    if (!disposed) {
      store.setState({ error })
      report(callbacks, error)
    }
    return error
  }
  const edit = (change: (draft: TemplatePersonalization) => void) => {
    active()
    const before = store.getState().personalization
    const draft = structuredClone(before)
    try {
      change(draft)
      const checked = shareJSON(before, parseTemplatePersonalization(draft, revision))
      for (const field of revision.template.fields)
        if (
          !field.editable &&
          stableJSONStringify(getValue(checked.data, field.path)) !==
            stableJSONStringify(getValue(initialData, field.path))
        )
          throw new TemplateError('permission', `${field.label} is supplied by the application.`)
      if (JSON.stringify(checked) === JSON.stringify(before)) return
      store.setState((state) => ({
        personalization: checked,
        undo: [...state.undo, before].slice(-100),
        redo: [],
        error: null,
      }))
      notify(
        {
          onError: (problem) => {
            if (!disposed) report(callbacks, problem)
          },
        },
        callbacks.onChange,
        checked,
      )
    } catch (cause) {
      throw fail(cause)
    }
  }
  const actions = {
    load(template: TemplateDefinition | TemplateRevision, preload: TemplateEditorPreload = {}) {
      active()
      // Validate the complete replacement before touching current content or history.
      const next = editorInput(template, preload)
      revision = next.revision
      initialData = next.initialData
      store.setState({ revision, template: revision.template, personalization: next.personalization,
        selectedId: null, undo: [], redo: [], error: null })
      notify(callbacks, callbacks.onChange, next.personalization)
    },
    refreshTrustedData(data: JsonObject) {
      active()
      const nextData = resolveTemplateData(revision.template, JsonObjectSchema.parse(data)).data
      const state = store.getState()
      const refresh = (value: TemplatePersonalization) => {
        const next = structuredClone(value)
        for (const field of revision.template.fields) if (!field.editable) setValue(next.data, field.path, getValue(nextData, field.path))
        return parseTemplatePersonalization(next, revision)
      }
      const next = refresh(state.personalization)
      initialData = nextData
      if (stableJSONStringify(next) === stableJSONStringify(state.personalization)) return
      store.setState({ personalization: next, undo: state.undo.map(refresh), redo: state.redo.map(refresh), error: null })
      notify(callbacks, callbacks.onChange, next)
    },
    select(id: string | null) {
      active()
      if (id && !Object.hasOwn(revision.template.nodes, id)) return
      store.setState({ selectedId: id })
    },
    setField(id: string, value: JsonValue | undefined) {
      edit((draft) => {
        const field = revision.template.fields.find((field) => field.id === id)
        if (!field || !field.editable)
          throw new TemplateError('permission', 'This field is supplied by the application.')
        setValue(draft.data, field.path, value)
      })
    },
    override(id: string, patch: TemplatePersonalization['overrides'][string]) {
      edit((draft) => {
        if (!Object.hasOwn(revision.template.nodes, id)) throw new TemplateError('validation', 'Unknown node.')
        const override = { ...draft.overrides[id], ...patch }
        if (override.style && !Object.keys(override.style).length) delete override.style
        if (Object.keys(override).length) draft.overrides[id] = override
        else delete draft.overrides[id]
      })
    },
    clearOverride(id: string) {
      edit((draft) => {
        delete draft.overrides[id]
      })
    },
    undo() {
      active()
      const state = store.getState()
      const value = state.undo.at(-1)
      if (value) {
        store.setState({
          personalization: value,
          undo: state.undo.slice(0, -1),
          redo: [...state.redo, state.personalization],
        })
        notify(
          {
            onError: (problem) => {
              if (!disposed) report(callbacks, problem)
            },
          },
          callbacks.onChange,
          value,
        )
      }
    },
    redo() {
      active()
      const state = store.getState()
      const value = state.redo.at(-1)
      if (value) {
        store.setState({
          personalization: value,
          redo: state.redo.slice(0, -1),
          undo: [...state.undo, state.personalization],
        })
        notify(
          {
            onError: (problem) => {
              if (!disposed) report(callbacks, problem)
            },
          },
          callbacks.onChange,
          value,
        )
      }
    },
  }
  return {
    store,
    actions,
    getRevision: () => structuredClone(revision),
    getTemplate: () => structuredClone(revision.template),
    getPersonalization: () => structuredClone(store.getState().personalization),
    render: (mode: 'preview' | 'runtime' = 'runtime') => {
      active()
      return renderTemplate(revision, {
        personalization: store.getState().personalization,
        mode,
        useSamples: false,
      })
    },
    exportDocument(format: 'html' | 'json'): TemplateDocumentExport {
      active()
      if (format !== 'html' && format !== 'json')
        throw fail(new TemplateError('validation', 'Supported export formats are html and json.'))
      const value = store.getState().personalization
      if (format === 'json')
        return documentExport(format, revision.template.name, JSON.stringify(value, null, 2))
      const rendered = renderTemplate(revision, { personalization: value })
      if (!rendered.html || rendered.issues.length)
        throw fail(
          new TemplateError('validation', 'Complete the template values before exporting.', rendered.issues),
        )
      return documentExport(format, revision.template.name, rendered.html)
    },
    getOptions: () => callbacks,
    configure(next: TemplateEditorOptions) {
      callbacks = next
    },
    disconnect() {
      callbacks = { template: revision }
    },
    destroy() {
      disposed = true
      callbacks = { template: revision }
    },
  }
}
type EditorRuntime = ReturnType<typeof createEditor>
export type TemplateEditorInstance = Pick<
  EditorRuntime,
  | 'actions'
  | 'render'
  | 'getRevision'
  | 'getTemplate'
  | 'getPersonalization'
  | 'exportDocument'
  | 'destroy'
>
const editorRuntimes = new WeakMap<TemplateEditorInstance, EditorRuntime>()
export function createTemplateEditor(options: TemplateEditorOptions): TemplateEditorInstance {
  const runtime = createEditor(options)
  const instance = {
    actions: runtime.actions,
    render: runtime.render,
    getRevision: runtime.getRevision,
    getTemplate: runtime.getTemplate,
    getPersonalization: runtime.getPersonalization,
    exportDocument: runtime.exportDocument,
    destroy: runtime.destroy,
  }
  editorRuntimes.set(instance, runtime)
  return instance
}
export function getEditorRuntime(instance: TemplateEditorInstance) {
  const runtime = editorRuntimes.get(instance)
  if (!runtime) throw new Error('Use createTemplateEditor() to create an instance.')
  return runtime
}
