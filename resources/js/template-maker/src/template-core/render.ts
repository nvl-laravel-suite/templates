import {
  getTemplateDataSchema,
  getValue,
  resolveTemplateData,
  stableJSONStringify,
  validateJSONData,
} from './contracts'
import {
  TemplateError,
  type JsonObject,
  type JsonValue,
  type TemplateDefinition,
  type TemplateIssue,
  type TemplateNode,
  type TemplatePersonalization,
  type TemplateRevision,
  type TemplateValue,
} from './schema'
import { parseTemplateDefinition, parseTemplatePersonalization, parseTemplateRevision } from './validation'
import { compileTemplateCSS, safeTemplateURL } from './styles'

export interface TemplateRenderOptions {
  data?: JsonObject
  mode?: 'preview' | 'runtime'
  /** Personalization previews show missing inputs rather than substituting author samples. */
  useSamples?: boolean
  personalization?: TemplatePersonalization
  annotate?: boolean
  selectedNodeId?: string | null
  resolveAsset?: (asset: TemplateDefinition['assets'][number]) => string
}
export interface TemplateRenderResult {
  html: string
  css: string
  data: JsonObject
  issues: TemplateIssue[]
}
const escape = (input: unknown) =>
  String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
const styleText = (style: Record<string, string>) =>
  Object.entries(style)
    .map(([key, value]) => `${key}:${value}`)
    .join(';')
const blockClass = (id: string, version: number) => `tpl-block-${id}-${version}`

/** Pure JSON → HTML/CSS. Production rendering never falls back to design samples. */
export function renderTemplate(
  input: TemplateDefinition | TemplateRevision,
  options: TemplateRenderOptions = {},
): TemplateRenderResult {
  let template: TemplateDefinition
  let personalization: TemplatePersonalization | undefined
  try {
    if (input.format === 'gct-template-revision') {
      const revision = parseTemplateRevision(input)
      template = revision.template
      if (options.personalization)
        personalization = parseTemplatePersonalization(options.personalization, revision)
    } else {
      template = parseTemplateDefinition(input)
      if (options.personalization)
        personalization = parseTemplatePersonalization(options.personalization, {
          format: 'gct-template-revision', schemaVersion: 1, templateId: template.id,
          revision: 1, publishedAt: '1970-01-01T00:00:00.000Z', template,
          dataContract: getTemplateDataSchema(template),
        })
    }
  } catch (error) {
    return {
      html: '',
      css: '',
      data: {},
      issues:
        error instanceof TemplateError
          ? error.issues.length
            ? error.issues
            : [{ path: '/', code: 'validation', message: error.message }]
          : [{ path: '/', code: 'validation', message: String(error) }],
    }
  }
  const { data, issues } = resolveTemplateData(
    template,
    options.data ?? personalization?.data ?? {},
    options.mode === 'preview' && (options.useSamples ?? !personalization) ? 'preview' : 'runtime',
  )
  if (issues.length && options.mode !== 'preview') return { html: '', css: '', data, issues }
  const theme = compileTemplateCSS(template.styles.theme).css
  const blocksCSS = template.blocks
    .map((block) => compileTemplateCSS(block.css, blockClass(block.id, block.version)).css)
    .join('\n')
  const customCSS = compileTemplateCSS(template.styles.css).css
  let fonts = ''
  try {
    fonts = template.assets
      .filter((asset) => asset.kind === 'font')
      .map((asset) => {
        const url = options.resolveAsset?.(asset) ?? asset.url
        if (!safeTemplateURL(url))
          throw new TemplateError('render', 'Font resolver returned an unsupported URL.')
        return `@font-face{font-family:"${asset.fontFamily ?? asset.name}";src:url("${url}");font-display:swap}`
      })
      .join('\n')
  } catch (error) {
    return {
      html: '',
      css: '',
      data,
      issues: [
        {
          path: 'assets',
          code: 'font',
          message: error instanceof Error ? error.message : 'Unable to resolve fonts.',
        },
      ],
    }
  }
  const css = [fonts, theme, blocksCSS, customCSS].join('\n')
  const retainedImageSources = new Set<string>()
  type Context = {
    item?: JsonValue
    props?: Record<string, JsonValue | undefined>
    slots?: Record<string, () => string>
  }
  const resolve = (value: TemplateValue, context: Context): JsonValue | undefined => {
    switch (value.source) {
      case 'literal':
        return value.value
      case 'field': {
        const field = template.fields.find((field) => field.id === value.fieldId)
        return field ? getValue(data, field.path) : undefined
      }
      case 'item':
        return value.path === '' ? context.item : getValue(context.item, value.path)
      case 'prop':
        return context.props && Object.hasOwn(context.props, value.name) ? context.props[value.name] : undefined
      case 'asset': {
        const asset = template.assets.find((asset) => asset.id === value.assetId)
        const url = asset ? (options.resolveAsset?.(asset) ?? asset.url) : undefined
        const retainedCid = Boolean(options.resolveAsset && asset?.kind === 'image' && url && /^cid:[a-zA-Z0-9._%+@-]+$/.test(url))
        if (retainedCid && url) retainedImageSources.add(url)
        if (url && !safeTemplateURL(url) && !retainedCid)
          throw new TemplateError('render', 'Asset resolver returned an unsupported URL.')
        return url
      }
    }
  }
  let rendered = 0
  const renderNodes = (ids: string[], nodes: Record<string, TemplateNode>, context: Context): string =>
    ids
      .map((id) => {
        if (++rendered > 20000) throw new TemplateError('render', 'Rendered document exceeds 20,000 nodes.')
        const node = nodes[id]
        if (!node) throw new TemplateError('render', `Unknown node: ${id}`)
        const override = nodes === template.nodes ? personalization?.overrides[id] : undefined
        const annotation =
          options.annotate && nodes === template.nodes ? ` data-template-node-id="${escape(id)}"` : ''
        switch (node.kind) {
          case 'text': {
            const text =
              override?.text !== undefined
                ? escape(override.text)
                : node.parts
                    .map((part) => {
                      const value = resolve(part.value, context)
                      if (value === undefined || value === null)
                        return options.mode === 'preview'
                          ? '<span class="tpl-missing">Missing value</span>'
                          : ''
                      let formatted: string
                      if (part.format === 'currency' || part.format === 'number') {
                        if (typeof value !== 'number')
                          throw new TemplateError(
                            'render',
                            'Number and currency formatting require numeric values.',
                          )
                        formatted = new Intl.NumberFormat(
                          template.locale,
                          part.format === 'currency' ? { style: 'currency', currency: part.currency } : {},
                        ).format(value)
                      } else if (part.format === 'date') {
                        if (typeof value !== 'string' || Number.isNaN(Date.parse(value)))
                          throw new TemplateError('render', 'Date formatting requires an ISO date string.')
                        formatted = new Intl.DateTimeFormat(template.locale, {
                          dateStyle: 'medium',
                          timeZone: 'UTC',
                        }).format(new Date(value))
                      } else formatted = typeof value === 'object' ? JSON.stringify(value) : String(value)
                      return escape(formatted)
                    })
                    .join('')
            return annotation ? `<span${annotation}>${text}</span>` : text
          }
          case 'element': {
            const attrs: Record<string, string> = { ...node.attributes }
            for (const [name, value] of Object.entries(node.attributeBindings)) {
              const resolved = resolve(value, context)
              if (resolved !== undefined && resolved !== null) attrs[name] = String(resolved)
            }
            for (const name of ['src', 'href'])
              if (attrs[name] && !safeTemplateURL(attrs[name]) && !(name === 'src' && retainedImageSources.has(attrs[name])))
                throw new TemplateError('render', `Unsupported ${name} URL.`)
            if (attrs.target === '_blank') attrs.rel = 'noopener noreferrer'
            const serialized = Object.entries(attrs)
              .map(([name, value]) => ` ${name}="${escape(value)}"`)
              .join('')
            const className = node.classes.length ? ` class="${escape(node.classes.join(' '))}"` : ''
            const style = styleText({ ...node.style, ...override?.style })
            const open = `<${node.tag}${annotation}${className}${serialized}${style ? ` style="${escape(style)}"` : ''}>`
            return ['img', 'br', 'hr'].includes(node.tag)
              ? open
              : `${open}${renderNodes(node.children, nodes, context)}</${node.tag}>`
          }
          case 'condition': {
            const value = resolve(node.binding, context)
            return (
              node.operator === 'equals'
                ? stableJSONStringify(value) === stableJSONStringify(node.value)
                : !!value
            )
              ? renderNodes(node.children, nodes, context)
              : ''
          }
          case 'repeat': {
            const values = resolve(node.binding, context)
            // Required absence is already rejected by the data contract; optional absence is empty.
            if (values === undefined) return ''
            if (!Array.isArray(values))
              throw new TemplateError('render', 'Repeater binding must resolve to an array.')
            if (values.length > 1000)
              throw new TemplateError('render', 'A repeater may contain at most 1,000 items.')
            return values.map((item) => renderNodes(node.children, nodes, { ...context, item })).join('')
          }
          case 'slot':
            return context.slots && Object.hasOwn(context.slots, node.slot)
              ? context.slots[node.slot]() : renderNodes(node.children, nodes, context)
          case 'block': {
            const block = template.blocks.find(
              (block) => block.id === node.blockId && block.version === node.version,
            )!
            const props = Object.fromEntries(
              Object.entries(node.props).flatMap(([name, value]) => {
                const resolved = resolve(value, context)
                return resolved === undefined ? [] : [[name, resolved]]
              }),
            )
            for (const [name, metadata] of Object.entries(block.propertyMetadata ?? {}))
              if (!Object.hasOwn(props, name) && metadata.defaultValue !== undefined)
                props[name] = structuredClone(metadata.defaultValue)
            const errors = validateJSONData(
              {
                type: 'object',
                properties: block.props,
                required: block.requiredProps,
                additionalProperties: false,
              },
              props,
            )
            if (errors.length && options.mode !== 'preview')
              throw new TemplateError(
                'render',
                'Reusable block properties do not match their contract.',
                errors,
              )
            const slots = Object.fromEntries(
              Object.entries(node.slots).map(([name, ids]) => [name, () => renderNodes(ids, nodes, context)]),
            )
            return `<div${annotation} class="${blockClass(block.id, block.version)}">${renderNodes(block.roots, block.nodes, { ...context, props, slots })}</div>`
          }
        }
      })
      .join('')
  try {
    const body = renderNodes(template.roots, template.nodes, {})
    const page = template.page
    const margins = page.margins
    const selection =
      options.annotate && options.selectedNodeId && template.nodes[options.selectedNodeId]
        ? `[data-template-node-id="${options.selectedNodeId}"]{outline:2px solid #237568;outline-offset:3px}`
        : ''
    const html = `<!DOCTYPE html><html lang="${escape(template.locale)}"><head><meta charset="utf-8"><title>${escape(template.name)}</title><style>
      *{box-sizing:border-box}body{margin:0;background:#fff;color:#202722;font:14px/1.55 Arial,sans-serif}h1,h2,h3,p{margin:0 0 12px}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:10px 8px}img{max-width:100%}tr{break-inside:avoid}.template-document{padding:${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm;width:${page.widthMm}mm;min-height:${page.heightMm}mm}.tpl-missing{background:#fff0ca;color:#8c5a00;border-radius:3px;padding:1px 4px;font-size:12px}@page{size:${page.widthMm}mm ${page.heightMm}mm;margin:${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm}@media print{.template-document{padding:0;width:auto;min-height:0}.tpl-missing{background:none}}${css}${selection}
      </style></head><body><main class="template-document">${body}</main></body></html>`
    return { html, css, data, issues }
  } catch (error) {
    const problem =
      error instanceof TemplateError
        ? error
        : new TemplateError('render', error instanceof Error ? error.message : 'Rendering failed', [], error)
    return {
      html: '',
      css,
      data,
      issues: [...issues, ...problem.issues, { path: '/', code: 'render', message: problem.message }],
    }
  }
}

/** Create an immutable JSON snapshot. Version metadata is supplied by the consuming application. */
export function createTemplateRevision(
  input: unknown,
  revision = 1,
  publishedAt = '1970-01-01T00:00:00.000Z',
): TemplateRevision {
  const template = parseTemplateDefinition(input)
  const preview = renderTemplate(template, { mode: 'preview' })
  if (!preview.html)
    throw new TemplateError('validation', 'Resolve rendering issues before creating a template snapshot.', preview.issues)
  const result = parseTemplateRevision({
    format: 'gct-template-revision',
    schemaVersion: 1,
    templateId: template.id,
    revision,
    publishedAt,
    template,
    dataContract: getTemplateDataSchema(template),
  })
  return structuredClone(result)
}
