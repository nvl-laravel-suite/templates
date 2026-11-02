import { parse, parseFragment, serialize, type DefaultTreeAdapterMap } from 'parse5'
import postcss from '../../portable/postcss.js'
import { inlineEmailCSS } from './inline'
import { safeTemplateURL } from '../template-core/styles'
import { emailStyleProblem } from './profile'
type Node = DefaultTreeAdapterMap['node']
type Element = DefaultTreeAdapterMap['element']
export function finalizeEmailHTML(html: string, preview = false): string {
  const document = parse(html)
  const elements: Element[] = []
  const visit = (node: Node) => { if ('tagName' in node) elements.push(node); if ('childNodes' in node) node.childNodes.forEach(visit) }
  visit(document)
  for (const node of elements) {
    if (['main', 'section', 'article', 'header', 'footer'].includes(node.tagName)) { node.tagName = 'div'; node.nodeName = 'div' }
    if (node.tagName !== 'style') continue
    const css = postcss.parse(node.childNodes.filter(item => item.nodeName === '#text').map(item => (item as DefaultTreeAdapterMap['textNode']).value).join(''))
    css.walkAtRules(rule => { if (rule.name === 'page' || (rule.name === 'media' && rule.params === 'print')) rule.remove() })
    css.walkRules(rule => { if (rule.parent?.type === 'root' && rule.selector === '.template-document') rule.walkDecls(decl => { if (['width', 'min-height', 'padding'].includes(decl.prop)) decl.remove() }) })
    css.walkDecls(decl => { if (decl.prop === 'break-inside') decl.remove(); if (decl.prop === 'min-height') decl.prop = 'height' })
    node.childNodes = [{ nodeName: '#text', value: css.toString(), parentNode: node }]
  }
  const content = elements.find(node => node.attrs.some(a => a.name === 'class' && a.value.split(/\s+/).includes('template-document')))
  const body = elements.find(node => node.tagName === 'body'), head = elements.find(node => node.tagName === 'head')
  if (content && body && !elements.some(node => node.attrs.some(a => a.name === 'data-email-shell'))) {
    const shell = parseFragment('<table role="presentation" width="100%" cellpadding="0" cellspacing="0" data-email-shell="1" data-email-profile="email-safe/1"><tbody><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" class="template-document" style="width:600px;max-width:100%;margin:0 auto"><tbody><tr><td style="padding:24px">placeholder</td></tr></tbody></table></td></tr></tbody></table>')
    const outer = shell.childNodes[0] as Element
    const row = (outer.childNodes[0] as Element).childNodes[0] as Element
    const middle = ((row.childNodes[0] as Element).childNodes[0]) as Element
    const inner = (((middle.childNodes[0] as Element).childNodes[0] as Element).childNodes[0]) as Element
    inner.childNodes = content.childNodes; inner.childNodes.forEach(child => { child.parentNode = inner })
    body.childNodes = [outer]; outer.parentNode = body
    if (head) {
      const style = parseFragment('<style>@media screen and (max-width:620px){.template-document{width:100%!important}}@media screen and (max-width:480px){.email-stack>tbody>tr>.email-column{display:block!important;width:100%!important;box-sizing:border-box!important}}</style>').childNodes[0]
      style.parentNode = head; head.childNodes.push(style)
    }
  }
  elements.length = 0; visit(document)
  for (const node of elements) {
    for (const attribute of node.attrs) {
      if (!['href', 'src'].includes(attribute.name) || /^\{\{[a-zA-Z][a-zA-Z0-9_]*\}\}$/.test(attribute.value)) continue
      const valid = attribute.name === 'href' ? /^(https?:|mailto:|tel:)/i.test(attribute.value) : /^(https:\/\/|cid:[a-zA-Z0-9._%+@-]+$)/i.test(attribute.value)
      if (!valid && !(preview && attribute.name === 'src' && safeTemplateURL(attribute.value))) throw new Error(`Email: ${attribute.name} requires an absolute destination or retained image.`)
    }
    if (node.tagName === 'table' && node.attrs.some(a => a.name === 'role' && a.value === 'presentation')) for (const name of ['cellpadding', 'cellspacing', 'border']) if (!node.attrs.some(a => a.name === name)) node.attrs.push({ name, value: '0' })
  }
  const output = inlineEmailCSS(serialize(document))
  // Validate computed output too: direct personalization can add styles after source validation.
  elements.length = 0; visit(parse(output))
  for (const node of elements) {
    const style = node.attrs.find(attribute => attribute.name === 'style')?.value
    if (!style) continue
    const css = postcss.parse(`x{${style.replace(/\{\{[a-zA-Z][a-zA-Z0-9_]*\}\}/g, '0')}}`)
    css.walkDecls(decl => { const problem = emailStyleProblem(decl.prop.toLowerCase(), decl.value); if (problem) throw new Error(`Email: ${problem}`) })
  }
  return output
}
