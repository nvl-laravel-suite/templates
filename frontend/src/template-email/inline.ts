import { parse, serialize, type DefaultTreeAdapterMap } from 'parse5'
import postcss, { type Declaration } from 'postcss'
import selectorParser, { type Node as SelectorNode } from 'postcss-selector-parser'
import { emailSelectorProblem } from './profile'
type Node = DefaultTreeAdapterMap['node']
type Element = DefaultTreeAdapterMap['element']
const element = (node: Node | undefined | null): node is Element => Boolean(node && 'tagName' in node)
const attr = (node: Element, name: string) => node.attrs.find(a => a.name === name)?.value
function matches(node: Element, parts: SelectorNode[]): boolean {
  let index = parts.length - 1
  while (index >= 0 && parts[index].type !== 'combinator') {
    const part = parts[index--]
    if (part.type === 'tag' && node.tagName !== part.value.toLowerCase() || part.type === 'class' && !attr(node, 'class')?.split(/\s+/).includes(part.value) || part.type === 'id' && attr(node, 'id') !== part.value || part.type === 'pseudo' && node.tagName !== 'html') return false
    if (part.type === 'attribute' && (attr(node, part.attribute.toLowerCase()) === undefined || part.operator === '=' && attr(node, part.attribute.toLowerCase()) !== part.value)) return false
  }
  if (index < 0) return true
  const direct = String(parts[index].value ?? '').trim() === '>'
  const remaining = parts.slice(0, index)
  let parent = node.parentNode
  while (element(parent)) { if (matches(parent, remaining)) return true; if (direct) break; parent = parent.parentNode }
  return false
}
interface Candidate { property: string; value: string; important: boolean; rank: number[]; order: number }
const compare = (a: Candidate, b: Candidate) => Number(a.important) - Number(b.important) || a.rank.reduce((found, value, index) => found || value - b.rank[index], 0) || a.order - b.order
/** Restricted selectors are deliberate: unsupported author selectors fail before finalization. */
export function inlineEmailCSS(html: string): string {
  let prefix = 'EMAILTOKEN'
  while (html.includes(prefix)) prefix += 'X'
  const tokens = new Map<string, string>()
  html = html.replace(/\{\{[a-zA-Z][a-zA-Z0-9_]*\}\}/g, token => { const marker = `${prefix}${tokens.size}END`; tokens.set(marker, token); return marker })
  const document = parse(html)
  const nodes: Element[] = []
  const visit = (node: Node) => { if (element(node)) nodes.push(node); if ('childNodes' in node) node.childNodes.forEach(visit) }
  visit(document)
  const candidates = new Map<Element, Candidate[]>()
  let order = 0
  const push = (node: Element, decl: Declaration, rank: number[]) => { if (order >= 100000) throw new Error('Email style expansion exceeds 100,000 declarations.'); const list = candidates.get(node) ?? []; list.push({ property: decl.prop, value: decl.value, important: Boolean(decl.important), rank, order: order++ }); candidates.set(node, list) }
  for (const style of nodes.filter(node => node.tagName === 'style')) {
    const css = postcss.parse(style.childNodes.filter(node => node.nodeName === '#text').map(node => (node as DefaultTreeAdapterMap['textNode']).value).join(''))
    for (const rule of [...css.nodes]) {
      if (rule.type !== 'rule') continue
      if (emailSelectorProblem(rule.selector)) throw new Error(`Email: unsupported selector ${rule.selector}.`)
      const selectors = selectorParser().astSync(rule.selector).nodes
      for (const selector of selectors) {
        const rank = [0, 0, 0, 0]
        selector.walk(part => { if (part.type === 'id') rank[1]++; else if (['class', 'attribute', 'pseudo'].includes(part.type)) rank[2]++; else if (part.type === 'tag') rank[3]++ })
        for (const node of nodes) if (matches(node, selector.nodes)) rule.walkDecls(decl => push(node, decl, rank))
      }
      rule.remove()
    }
    style.childNodes = [{ nodeName: '#text', value: css.toString(), parentNode: style }]
  }
  for (const node of nodes) {
    const existing = attr(node, 'style')
    if (existing) postcss.parse(`x{${existing}}`).walkDecls(decl => push(node, decl, [1, 0, 0, 0]))
    const list = candidates.get(node)
    if (!list?.length) continue
    // Preserve shorthand/longhand ordering by cascading the whole declaration sequence.
    const css = list.sort(compare).map(decl => `${decl.property}:${decl.value}${decl.important ? '!important' : ''}`).join(';')
    node.attrs = node.attrs.filter(attr => attr.name !== 'style'); node.attrs.push({ name: 'style', value: css })
  }
  let output = serialize(document)
  for (const [marker, token] of tokens) output = output.replaceAll(marker, token)
  return output
}
