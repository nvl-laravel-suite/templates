import postcss from 'postcss'
import selectorParser from 'postcss-selector-parser'
import rules from './profile.json'
import type { TemplateDefinition, TemplateIssue } from '../template-core/schema'

export const EMAIL_PROFILE = rules
export interface EmailCompatibilityIssue extends TemplateIssue { severity: 'error' | 'warning' }
export function emailStyleProblem(property: string, value: string): string | undefined {
  if (!rules.styles.includes(property)) return `${property} is outside the email profile.`
  if ([...value.matchAll(/([a-z-]+)\s*\(/gi)].some(match => !['rgb', 'rgba', 'hsl', 'hsla'].includes(match[1].toLowerCase()))) return `${property} needs a plain email value; CSS layout functions are unsupported.`
  if (/var\s*\(|calc\s*\(|(?:^|[^a-z])[-\d.]+(?:mm|cm|in|pt|pc|rem|em|vw|vh|dvh|vmin|vmax)\b|url\s*\(|expression\s*\(|[<>\\]/i.test(value)) return `${property} needs a plain email value in px, %, or a unitless number.`
  if (property === 'display' && !rules.displays.includes(value.trim().toLowerCase())) return `display:${value} is outside the email profile. Use email sections and columns.`
}
export function emailSelectorProblem(selector: string): boolean {
  let invalid = false
  try { selectorParser(root => root.walk(node => {
    if (!['root', 'selector', 'tag', 'class', 'id', 'universal', 'combinator', 'pseudo', 'attribute'].includes(node.type)) invalid = true
    if (node.type === 'pseudo' && node.value !== ':root') invalid = true
    if (node.type === 'combinator' && !['', '>'].includes(node.value.trim())) invalid = true
    if (node.type === 'attribute' && node.operator && node.operator !== '=') invalid = true
    if (node.type === 'attribute' && node.insensitive !== undefined) invalid = true
    if (['tag', 'universal', 'attribute'].includes(node.type) && 'namespace' in node && node.namespace !== undefined) invalid = true
  })).processSync(selector) } catch { invalid = true }
  return invalid
}
export function emailCSSIssues(css: string, path: string): EmailCompatibilityIssue[] {
  const issues: EmailCompatibilityIssue[] = []
  const add = (message: string, severity: EmailCompatibilityIssue['severity'] = 'error') => issues.push({ path, code: 'email-css', message: `Email: ${message}`, severity })
  try {
    const root = postcss.parse(css)
    root.walkAtRules(rule => { if (rule.name !== 'media' || !/^(?:screen\s+and\s+)?\((?:min|max)-width\s*:\s*\d+px\)$/i.test(rule.params.trim()) || rule.parent?.type !== 'root') add('Only top-level screen width media queries are supported.') })
    root.walkRules(rule => { if (rule.parent?.type === 'rule' || emailSelectorProblem(rule.selector)) add(`Unsupported selector ${rule.selector}; use element, class, ID, attribute, descendant or child selectors.`) })
    root.walkDecls(decl => { if (decl.parent?.type !== 'rule') add('Declarations must belong to an email selector.'); if (decl.parent?.parent?.type === 'atrule' && !decl.important) add('Responsive email declarations require !important to override inlined styles.'); const problem = emailStyleProblem(decl.prop.toLowerCase(), decl.value); if (problem) add(problem); else if (rules.conditionalStyles.includes(decl.prop)) add(`${decl.prop} can differ between clients; provide an acceptable fallback.`, 'warning') })
  } catch { add('The stylesheet could not be parsed.') }
  return issues
}
/** Includes pinned definitions, unused library entries and imported CSS so insertion cannot bypass the profile. */
export function getEmailTemplateIssues(template: TemplateDefinition): EmailCompatibilityIssue[] {
  const issues = [...emailCSSIssues(template.styles.theme, 'styles.theme'), ...emailCSSIssues(template.styles.css, 'styles.css')]
  const add = (path: string, message: string, severity: EmailCompatibilityIssue['severity'] = 'error') => issues.push({ path, code: 'email-compatibility', message: `Email: ${message}`, severity })
  for (const [prefix, nodes] of [['nodes', template.nodes], ...template.blocks.map(block => [`blocks.${block.id}@${block.version}.nodes`, block.nodes] as const)] as const) {
    for (const node of Object.values(nodes)) {
      if (node.kind !== 'element') continue
      if (!rules.tags.includes(node.tag)) add(`${prefix}.${node.id}.tag`, `${node.tag} is outside the email profile.`)
      if (['data-email-shell', 'data-email-profile'].some(name => Object.hasOwn(node.attributes, name) || Object.hasOwn(node.attributeBindings, name))) add(`${prefix}.${node.id}.attributes`, 'Email shell markers belong to the compiler.')
      for (const [property, value] of Object.entries(node.style)) {
        const problem = emailStyleProblem(property, value)
        if (problem) add(`${prefix}.${node.id}.style.${property}`, problem)
        else if (rules.conditionalStyles.includes(property)) add(`${prefix}.${node.id}.style.${property}`, `${property} can differ between clients.`, 'warning')
      }
      if (node.tag === 'img' && !Object.hasOwn(node.attributes, 'alt') && !Object.hasOwn(node.attributeBindings, 'alt')) add(`${prefix}.${node.id}.attributes.alt`, 'Images need alternative text, or an explicit empty alt for decoration.', 'warning')
      for (const attr of ['href', 'src']) {
        const value = node.attributes[attr]
        if (value && !(attr === 'href' ? /^(https?:|mailto:|tel:)/i : /^https:\/\//i).test(value)) add(`${prefix}.${node.id}.attributes.${attr}`, `${attr} requires an absolute destination; retained assets use a binding.`)
      }
    }
  }
  for (const block of template.blocks) issues.push(...emailCSSIssues(block.css, `blocks.${block.id}@${block.version}.css`))
  for (const asset of template.assets) {
    if (asset.kind !== 'image' || !['image/png', 'image/jpeg', 'image/gif'].includes(asset.mimeType)) add(`assets.${asset.id}`, 'Use PNG, JPEG or GIF for the baseline email profile.')
  }
  return issues
}
export function assertEmailTemplate(template: TemplateDefinition): void {
  const issue = getEmailTemplateIssues(template).find(issue => issue.severity === 'error')
  if (issue) throw new Error(`${issue.message} (${issue.path})`)
}
