import { parse } from 'parse5'
import postcss from 'postcss'
import { nanoid } from 'nanoid'
import { parseVoucherImport } from '../voucher-builder/export/import'
import { exportToHTML } from '../voucher-builder/export/html'
import { getProjectDynamicKeys } from '../voucher-builder/export/dynamic-keys'
import { createTemplateDefinition } from './defaults'
import {
  HTML_TAGS,
  TemplateError,
  TemplateNodeSchema,
  type TemplateDefinition,
  type TemplateValue,
} from './schema'
import { parseTemplateDefinition } from './validation'
import { allowedAttribute, styleIssues } from './styles'
import { pathParts } from './contracts'

interface HtmlNode {
  nodeName: string
  tagName?: string
  value?: string
  attrs?: { name: string; value: string }[]
  childNodes?: HtmlNode[]
}
export interface VoucherMigrationResult {
  template: TemplateDefinition
  warnings: string[]
  fieldPaths: Record<string, string>
}
/** Explicit migration. Existing VoucherBuilder documents do not migrate automatically. */
export function adaptVoucherProject(input: unknown): VoucherMigrationResult {
  const imported = parseVoucherImport(input, { strict: true })
  if (!imported.project)
    throw new TemplateError(
      'validation',
      'Unable to migrate the voucher.',
      imported.errors.map((message) => ({ path: '/', code: 'legacy', message })),
    )
  const project = imported.project
  const template = createTemplateDefinition(project.global.metadata.title)
  const warnings = [...imported.warnings]
  const fieldPaths: Record<string, string> = {}
  const markers = new Map<string, string>()
  const data: Record<string, string> = {}
  const manifest = getProjectDynamicKeys(project)
  for (const key of manifest.keys) {
    const id = `f_${nanoid(8).replace(/-/g, '_')}`
    let path = key.replace(/^:/, '')
    try {
      pathParts(path)
    } catch {
      path = `legacyField${template.fields.length + 1}`
      warnings.push(`Field ${key} now uses data path ${path}.`)
    }
    fieldPaths[key] = path
    const sample = manifest.occurrences.find(
      (occurrence) => occurrence.key === key && occurrence.defaultValue !== undefined,
    )?.defaultValue
    template.fields.push({
      id,
      path,
      label: key,
      description: 'Migrated voucher binding. Review its type and required status.',
      schema: { type: 'string', minLength: 1 },
      required: true,
      editable: true,
      ...(sample !== undefined ? { sample } : {}),
    })
    const marker = `GCTBIND_${id}_END`
    markers.set(marker, id)
    data[key] = marker
  }
  const document = parse(exportToHTML(project, { data })) as unknown as HtmlNode
  const find = (node: HtmlNode, tag: string): HtmlNode | undefined =>
    node.tagName === tag ? node : node.childNodes?.map((child) => find(child, tag)).find(Boolean)
  const head = find(document, 'head')
  const body = find(document, 'body')
  const style =
    head?.childNodes
      ?.filter((node) => node.tagName === 'style')
      .map((node) => node.childNodes?.map((child) => child.value ?? '').join('') ?? '')
      .join('\n') ?? ''
  const stylesheet = postcss.parse(style)
  stylesheet.walkAtRules((rule) => {
    if (['keyframes', '-webkit-keyframes', 'page'].includes(rule.name)) rule.remove()
  })
  stylesheet.walkDecls((decl) => {
    if (decl.prop.startsWith('animation')) decl.remove()
  })
  template.styles.css = stylesheet.toString()
  template.locale = project.global.metadata.language || 'en'
  template.page.margins = { top: 0, right: 0, bottom: 0, left: 0 }
  const used = new Set<string>()
  const parts = (text: string) => {
    const output: { value: TemplateValue; format: 'text'; currency: string }[] = []
    const expression = /GCTBIND_(f_[a-zA-Z0-9_]+)_END/g
    let cursor = 0
    for (const match of text.matchAll(expression)) {
      if (match.index! > cursor)
        output.push({
          value: { source: 'literal', value: text.slice(cursor, match.index) },
          format: 'text',
          currency: 'EUR',
        })
      output.push({ value: { source: 'field', fieldId: match[1] }, format: 'text', currency: 'EUR' })
      used.add(match[1])
      cursor = match.index! + match[0].length
    }
    if (cursor < text.length || !output.length)
      output.push({
        value: { source: 'literal', value: text.slice(cursor) },
        format: 'text',
        currency: 'EUR',
      })
    return output
  }
  const convert = (source: HtmlNode): string[] => {
    if (source.nodeName === '#comment') return []
    const id = `n_${nanoid(10).replace(/-/g, '_')}`
    if (source.nodeName === '#text') {
      if (!source.value || /^\s*\n\s*$/.test(source.value)) return []
      template.nodes[id] = TemplateNodeSchema.parse({
        id,
        name: 'Text',
        kind: 'text',
        parts: parts(source.value),
      })
      return [id]
    }
    if (!source.tagName) return source.childNodes?.flatMap(convert) ?? []
    if (source.tagName === 'svg')
      throw new TemplateError(
        'validation',
        'SVG-based voucher blocks need a registered template block before migration. Keep editing this document in the voucher workspace.',
      )
    if (!HTML_TAGS.includes(source.tagName as (typeof HTML_TAGS)[number]))
      throw new TemplateError('validation', `The voucher contains an unsupported element: ${source.tagName}.`)
    const attributes: Record<string, string> = {}
    const inline: Record<string, string> = {}
    const attributeBindings: Record<string, TemplateValue> = {}
    let classes: string[] = []
    for (const attribute of source.attrs ?? []) {
      if (attribute.name === 'class') {
        classes = attribute.value.split(/\s+/).filter(Boolean)
        continue
      }
      if (attribute.name === 'style') {
        postcss.parse(`a{${attribute.value}}`).walkDecls((decl) => {
          if (decl.prop.startsWith('animation')) return
          if (styleIssues({ [decl.prop]: decl.value }, 'legacy').length)
            warnings.push(`Review unsupported style ${decl.prop} after migration.`)
          else inline[decl.prop] = decl.value
        })
        continue
      }
      if (!allowedAttribute(attribute.name)) {
        warnings.push(`Dropped unsupported attribute ${attribute.name}.`)
        continue
      }
      const fieldId = markers.get(attribute.value)
      if (fieldId) {
        attributeBindings[attribute.name] = { source: 'field', fieldId }
        used.add(fieldId)
      } else attributes[attribute.name] = attribute.value
    }
    template.nodes[id] = TemplateNodeSchema.parse({
      id,
      name: source.tagName.toUpperCase(),
      kind: 'element',
      tag: source.tagName,
      classes,
      attributes,
      attributeBindings,
      style: inline,
      children: source.childNodes?.flatMap(convert) ?? [],
    })
    return [id]
  }
  template.roots = body?.childNodes?.flatMap(convert) ?? []
  for (const field of template.fields)
    if (!used.has(field.id))
      warnings.push(`Rebind ${field.label}: its generated voucher output could not preserve this binding.`)
  template.fields = template.fields.filter((field) => used.has(field.id))
  warnings.push(
    'Review migrated permissions and field types before use. Voucher preview fallbacks are design samples, not runtime defaults. Web fonts and animation require explicit template resources.',
  )
  return { template: parseTemplateDefinition(template), warnings: [...new Set(warnings)], fieldPaths }
}
