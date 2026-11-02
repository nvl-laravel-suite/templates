import postcss from 'postcss'
import selectorParser from 'postcss-selector-parser'
import type { TemplateDefinition, TemplateIssue } from './schema'

export function safeTemplateURL(value: string): boolean {
  if (!value || /[\u0000-\u0020<>"'\\]/.test(value)) return false
  if (/^data:image\/(png|jpeg|gif|webp);base64,[a-zA-Z0-9+/=]+$/.test(value)) return true
  if (value.startsWith('//')) return false
  return !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value) || /^(https?:|mailto:|tel:)/i.test(value)
}
export function allowedAttribute(name: string) {
  return /^(id|title|alt|src|href|width|height|colspan|rowspan|align|valign|cellpadding|cellspacing|border|target|rel|role|lang|dir|aria-[a-z-]+|data-[a-z-]+)$/.test(
    name,
  )
}
export function styleIssues(style: Record<string, string>, path: string): TemplateIssue[] {
  return Object.entries(style).flatMap(([property, value]) => {
    if (
      !/^(--[a-zA-Z][a-zA-Z0-9-]*|[a-zA-Z][a-zA-Z0-9-]*)$/.test(property) ||
      /[<>\\{};]/.test(value) ||
      /url\s*\(|expression\s*\(|javascript:|behavior\s*:/i.test(value)
    ) {
      return [
        {
          path: `${path}.${property}`,
          code: 'unsafe-style',
          message: 'Use a plain CSS declaration; image and font URLs belong in Assets.',
        },
      ]
    }
    return []
  })
}
export function compileTemplateCSS(
  css: string,
  scope = 'template-document',
): { css: string; issues: TemplateIssue[]; classes: string[] } {
  const issues: TemplateIssue[] = []
  const classes = new Set<string>()
  try {
    if (/[<\\]/.test(css))
      throw new Error('CSS escapes and HTML opening delimiters are not supported in template styles.')
    const root = postcss.parse(css)
    root.walkAtRules((rule) => {
      if (!['media', 'supports', 'layer', 'page'].includes(rule.name.toLowerCase()))
        issues.push({ path: 'styles', code: 'at-rule', message: `Unsupported CSS rule: @${rule.name}` })
    })
    root.walkDecls((decl) => {
      issues.push(...styleIssues({ [decl.prop]: decl.value }, 'styles'))
    })
    root.walkRules((rule) => {
      if (rule.parent?.type === 'atrule' && rule.parent.name === 'page') return
      rule.selector = selectorParser((selectors) => {
        selectors.walkClasses((node) => {
          classes.add(node.value)
        })
        selectors.each((selector) => {
          let hasRoot = false
          selector.walkPseudos((node) => {
            if (node.value === ':root') {
              hasRoot = true
              node.replaceWith(selectorParser.className({ value: scope }))
            }
          })
          selector.walkTags((node) => {
            if (node.value === 'html' || node.value === 'body') {
              hasRoot = true
              node.replaceWith(selectorParser.className({ value: scope }))
            }
          })
          if (!hasRoot) {
            selector.prepend(selectorParser.combinator({ value: ' ' }))
            selector.prepend(selectorParser.className({ value: scope }))
          }
        })
      }).processSync(rule.selector)
    })
    return { css: issues.length ? '' : root.toString(), issues, classes: [...classes].sort() }
  } catch (error) {
    return {
      css: '',
      issues: [
        {
          path: 'styles',
          code: 'css-syntax',
          message: error instanceof Error ? error.message : 'Invalid stylesheet',
        },
      ],
      classes: [],
    }
  }
}
export function discoverTemplateClasses(template: TemplateDefinition) {
  const found = new Map<string, { name: string; nodeIds: string[]; sources: string[] }>()
  for (const node of Object.values(template.nodes))
    if (node.kind === 'element')
      for (const name of node.classes) {
        const entry = found.get(name) ?? { name, nodeIds: [], sources: [] }
        entry.nodeIds.push(node.id)
        found.set(name, entry)
      }
  for (const [source, css] of [
    ['Theme', template.styles.theme],
    ['Template', template.styles.css],
    ...template.blocks.map((block) => [block.name, block.css]),
  ]) {
    for (const name of compileTemplateCSS(css).classes) {
      const entry = found.get(name) ?? { name, nodeIds: [], sources: [] }
      entry.sources.push(source)
      found.set(name, entry)
    }
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name))
}
