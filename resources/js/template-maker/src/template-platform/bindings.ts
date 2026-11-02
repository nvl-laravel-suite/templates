import { parse, serialize, type DefaultTreeAdapterMap } from 'parse5'
import { assertManagedMedia } from './media'
import { finalizeTemplateOutput } from './output'
import type { DataSchema, JsonObject, TemplateDefinition, TemplateNode, TemplateValue } from '../template-core/schema'
import { renderTemplate } from '../template-core/render'
import { applyTemplateTheme } from './theme'
import { applyPresentationSettings } from './settings'
import { createDocumentContract, type TemplateExportOptions } from './document'
import type { BindingDocument, RuntimeBinding } from './types'
import { hasAuthoredBindingTokens } from './binding-literals'

type Element = DefaultTreeAdapterMap['element']
type Node = DefaultTreeAdapterMap['node']

export function exportBindingDocument(input: TemplateDefinition, options: TemplateExportOptions): BindingDocument {
  const contract = createDocumentContract(input, options)
  const source = contract.source.definition
  if (hasAuthoredBindingTokens(source)) throw new Error('Literal binding-token syntax requires the shared compiler.')
  assertManagedMedia(source, 'bindings')
  const theme = contract.theme
  const settings = contract.settingsSpec
  const prepared = applyPresentationSettings(applyTemplateTheme(source, theme, options.target), settings)
  const bindings = new Map<string, RuntimeBinding>()
  const managedContent: JsonObject = {}
  const contentSchema = contract.dataSchema.properties.content as Extract<DataSchema, { type: 'object' }>
  const allocated = new Map<string, string>()
  const used = new Set<string>()
  const allocate = (key: string, preferred: string, reserved: Record<string, unknown> = {}) => {
    if (allocated.has(key)) return allocated.get(key)!
    const base = preferred.replace(/[^a-zA-Z0-9_]/g, '_')
    let id = base
    for (let index = 2; used.has(id) || Object.hasOwn(reserved, id); index++) id = `${base}_${index}`
    allocated.set(key, id); used.add(id)
    return id
  }
  if (source.assets.some(asset => asset.kind === 'font')) throw new Error('Managed font export requires the shared compiler and a qualified font driver.')
  const bind = (value: TemplateValue, kind: RuntimeBinding['kind']): TemplateValue => {
    if (value.source === 'asset') {
      const managed = options.managedAssets?.[value.assetId]
      if (!managed || kind !== 'image') throw new Error('Image export requires a managed asset reference.')
      const key = allocate(`assetKey:${value.assetId}`, `asset_${value.assetId}`, contentSchema.properties)
      const id = allocate(`asset:${value.assetId}`, `i_${value.assetId}`)
      managedContent[key] = managed
      bindings.set(id, { id, path: `content.${key}`, kind: 'image' })
      return { source: 'literal', value: `{{${id}}}` }
    }
    if (value.source !== 'field') return value
    const field = source.fields.find(field => field.id === value.fieldId)
    if (!field || ['array', 'object'].includes(field.schema.type)) throw new Error('Use the shared compiler for structured bindings.')
    if (kind !== 'text' && kind !== 'image' && !field.required) throw new Error('Optional attribute bindings require the shared compiler.')
    const id = allocate(`field:${kind}:${field.id}`, `${kind === 'text' ? 'b' : kind === 'link' ? 'l' : kind === 'image' ? 'i' : 'a'}_${field.id}`)
    bindings.set(id, { id, path: field.path, kind })
    return { source: 'literal', value: `{{${id}}}` }
  }
  const prepareNodes = (nodes: Record<string, TemplateNode>) => {
    for (const node of Object.values(nodes)) {
      if (node.kind === 'repeat' || node.kind === 'condition') throw new Error('Runtime conditions and repeats require the shared compiler.')
      if (node.kind === 'block' && Object.values(node.props).some(value => value.source !== 'literal')) throw new Error('Dynamic block properties require the shared compiler.')
      if (node.kind === 'text') node.parts = node.parts.map(part => {
        if (part.format !== 'text' && part.value.source !== 'literal') throw new Error('Runtime formatting requires the shared compiler.')
        return { ...part, value: bind(part.value, 'text') }
      })
      if (node.kind === 'element') for (const [attribute, value] of Object.entries(node.attributeBindings)) node.attributeBindings[attribute] = bind(value, attribute === 'href' ? 'link' : attribute === 'src' ? 'image' : 'attribute')
    }
  }
  prepareNodes(prepared.nodes)
  for (const block of prepared.blocks) prepareNodes(block.nodes)
  prepared.fields = []
  const output = renderTemplate(prepared, { annotate: true })
  if (output.issues.length || !output.html) throw new Error(output.issues[0]?.message ?? 'Unable to export template.')
  const document = parse(output.html)
  const visit = (node: Node) => {
    if ('tagName' in node) {
      const element = node as Element
      const id = element.attrs.find(a => a.name === 'data-template-node-id')?.value
      const styles = new Map((element.attrs.find(a => a.name === 'style')?.value ?? '').split(';').filter(Boolean).map(declaration => { const index = declaration.indexOf(':'); return [declaration.slice(0, index), declaration.slice(index + 1)] }))
      for (const setting of settings) for (const target of setting.targets) if (target.nodeId === id) {
        const bindingId = allocate(`setting:${setting.id}:${target.property}`, `s_${setting.id}${setting.targets.some(other => other.property !== target.property) ? '_'+target.property : ''}`)
        bindings.set(bindingId, { id: bindingId, path: `settings.${setting.id}`, kind: 'style', property: target.property, unit: setting.unit ?? '' })
        styles.set(target.property, `{{${bindingId}}}`)
      }
      element.attrs = element.attrs.filter(a => a.name !== 'data-template-node-id' && a.name !== 'style')
      if (styles.size) element.attrs.push({ name: 'style', value: [...styles].map(([k, v]) => `${k}:${v}`).join(';') })
    }
    if ('childNodes' in node) node.childNodes.forEach(visit)
  }
  visit(document)
  for (const key of Object.keys(managedContent)) contentSchema.properties[key] = { type: 'string', minLength: 1 }
  return { ...contract, rendering: { ...contract.rendering, engine: 'bindings' }, content: { ...contract.content, ...managedContent },
    artifacts: { ...contract.artifacts, engine: 'bindings', html: finalizeTemplateOutput(serialize(document), options.target), css: '', bindings: [...bindings.values()] },
  }
}
