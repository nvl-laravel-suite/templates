import { createStore } from 'zustand/vanilla'
import { nanoid } from 'nanoid'
import { builtinTemplates } from './builtins'
import { instantiateTemplate, type AddVoucherTemplateInput, type ImportTemplatesResult } from './registry'
import type { VoucherTemplate } from './types'
import type { VoucherBuilderConfig } from '../types'
import { VoucherBuilderError } from '../api-types'
import { parseVoucherImport } from '../export/import'
import type { Project } from '../schema'

export interface VoucherTemplateSnapshot {
  templates: VoucherTemplate[]
  error: VoucherBuilderError | null
}

export function createTemplateLibrary(initialConfig: VoucherBuilderConfig, notify: (kind: 'add' | 'update' | 'delete', template: VoucherTemplate) => void, report: (error: VoucherBuilderError) => void) {
  let users: VoucherTemplate[] = []
  let host: VoucherTemplate[] = []
  const store = createStore<VoucherTemplateSnapshot>(() => ({ templates: [], error: null }))
  const publish = () => {
    const map = new Map<string, VoucherTemplate>()
    for (const template of [...builtinTemplates, ...host, ...users]) map.set(template.id, template)
    store.setState({ templates: [...map.values()] })
  }
  const parse = (input: unknown, source: VoucherTemplate['source']): VoucherTemplate => {
    if (!input || typeof input !== 'object') throw new Error('Invalid template')
    const value = input as VoucherTemplate
    if (typeof value.id !== 'string' || typeof value.name !== 'string' || !['full', 'partial'].includes(value.mode)) throw new Error('Templates require an id, name, and full or partial mode')
    if (value.mode === 'full') {
      const result = parseVoucherImport(value.project, { strict: true })
      if (!result.project) throw new Error(result.errors.join('; '))
      return { ...structuredClone(value), source, project: result.project, description: value.description ?? '' }
    }
    if (!value.partial || typeof value.partial !== 'object' || Array.isArray(value.partial) || value.partial.sections !== undefined && !Array.isArray(value.partial.sections)) throw new Error('A partial template requires a valid partial document')
    // Instantiate once to reject unknown block types before putting a template in the picker.
    const instantiated = parseVoucherImport(instantiateTemplate(value), { strict: true })
    if (!instantiated.project) throw new Error(instantiated.errors.join('; '))
    return { ...structuredClone(value), source, description: value.description ?? '' }
  }
  const checkedHost = (next: VoucherBuilderConfig) => (next.templates ?? []).map(value => parse(value, 'host'))
  const fail = (cause: unknown) => {
    const error = cause instanceof VoucherBuilderError ? cause : new VoucherBuilderError('templates', cause instanceof Error ? cause.message : 'Template operation failed', cause)
    store.setState({ error }); report(error)
    return error
  }
  const checked = <T,>(operation: () => T): T => {
    try { const result = operation(); store.setState({ error: null }); return result }
    catch (cause) { throw fail(cause) }
  }
  host = checked(() => checkedHost(initialConfig))
  publish()
  return {
    store,
    configure(next: VoucherBuilderConfig) {
      const nextHost = checked(() => checkedHost(next))
      host = nextHost
      publish()
    },
    replace(templates: VoucherTemplate[]) {
      const nextHost = checked(() => checkedHost({ templates }))
      host = nextHost
      publish()
    },
    load(templateOrId: VoucherTemplate | string): { project: Project; template: VoucherTemplate } {
      return checked(() => {
        const template = typeof templateOrId === 'string' ? store.getState().templates.find((item) => item.id === templateOrId) : templateOrId
        if (!template) throw new VoucherBuilderError('templates', `Template not found: ${templateOrId}`)
        const checked = parse(template, template.source)
        return { project: instantiateTemplate(checked), template: checked }
      })
    },
    add(input: AddVoucherTemplateInput): VoucherTemplate {
      return checked(() => {
        const template = parse({ ...input, id: `user-${nanoid(8)}`, description: input.description ?? '', mode: 'full', source: 'user', updatedAt: new Date().toISOString() }, 'user')
        users = [...users, template]; publish(); notify('add', template)
        return structuredClone(template)
      })
    },
    update(id: string, patch: Partial<AddVoucherTemplateInput>): VoucherTemplate | null {
      return checked(() => {
        const index = users.findIndex((item) => item.id === id)
        if (index < 0) return null
        const template = parse({ ...users[index], ...patch, updatedAt: new Date().toISOString() }, 'user')
        users = users.map((item, i) => i === index ? template : item); publish(); notify('update', template)
        return structuredClone(template)
      })
    },
    remove(id: string): VoucherTemplate | null {
      return checked(() => {
        const template = users.find((item) => item.id === id)
        if (!template) return null
        users = users.filter((item) => item.id !== id); publish(); notify('delete', template)
        return structuredClone(template)
      })
    },
    exportJSON: () => JSON.stringify({ templates: users }, null, 2),
    importJSON(input: string): ImportTemplatesResult {
      const result: ImportTemplatesResult = { imported: 0, skipped: 0, errors: [] }
      try {
        const raw: unknown = JSON.parse(input)
        const list = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? (raw as { templates?: unknown }).templates : undefined
        if (!Array.isArray(list)) throw new Error('Expected an array of templates')
        const parsed = list.map((value) => parse(value, 'user'))
        const ids = new Set(users.map((item) => item.id))
        const added = parsed.filter((item) => { if (ids.has(item.id)) { result.skipped++; return false }; ids.add(item.id); return true })
        users = [...users, ...added]; result.imported = added.length; publish()
        store.setState({ error: null })
        added.forEach(template => notify('add', template))
      } catch (cause) { result.errors.push(fail(cause).message) }
      return result
    },
  }
}

export type VoucherTemplateLibrary = ReturnType<typeof createTemplateLibrary>
