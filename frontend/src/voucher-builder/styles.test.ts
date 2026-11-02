// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import postcss, { type AnyNode, type Rule } from 'postcss'
import selectorParser from 'postcss-selector-parser'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const stylesheet = postcss.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'styles.css'), 'utf8'))
const printRules: Rule[] = []
stylesheet.walkRules(rule => {
  let parent: AnyNode | undefined = rule.parent
  while (parent) {
    if (parent.type === 'atrule' && parent.name === 'media' && /\bprint\b/.test(parent.params)) {
      printRules.push(rule)
      return
    }
    parent = parent.parent
  }
})

function matchesRule(rule: Rule, element: Element, pseudo?: string): boolean {
  return rule.selectors.some(selector => {
    const parsed = selectorParser().astSync(selector)
    const pseudos: string[] = []
    parsed.walkPseudos(node => {
      if (node.value.startsWith('::')) {
        pseudos.push(node.value)
        node.remove()
      }
    })
    return (pseudo ? pseudos.length === 1 && pseudos[0] === pseudo : pseudos.length === 0)
      && element.matches(parsed.toString())
  })
}

function printDeclarations(element: Element, pseudo?: string): Record<string, string> {
  const declarations: Record<string, string> = {}
  for (const rule of printRules) if (matchesRule(rule, element, pseudo)) {
    rule.walkDecls(declaration => { declarations[declaration.prop] = declaration.value })
  }
  return declarations
}

function hostScreenDeclarations(element: Element): Record<string, string> {
  const declarations: Record<string, string> = {}
  stylesheet.walkRules(rule => {
    let parent: AnyNode | undefined = rule.parent
    while (parent) {
      if (parent.type === 'atrule' && (parent.name.endsWith('keyframes') || (parent.name === 'media' && /\bprint\b/.test(parent.params)))) return
      parent = parent.parent
    }
    if (matchesRule(rule, element)) rule.walkDecls(declaration => {
      if (!declaration.prop.startsWith('--nc-')) declarations[declaration.prop] = declaration.value
    })
  })
  return declarations
}

function affectedHostElements(): string[] {
  const host = document.querySelector('[data-surface="host"]')!
  return [document.body, host, ...host.querySelectorAll('*')].flatMap(element =>
    [undefined, '::before', '::after'].flatMap(pseudo =>
      printRules.filter(rule => matchesRule(rule, element, pseudo))
        .map(rule => `${element.tagName.toLowerCase()}${pseudo ?? ''}: ${rule.selector}`),
    ),
  )
}

beforeEach(() => {
  for (const [surface, className] of [['host', ''], ['voucher', 'nc-workspace'], ['template', 'tc-workspace']]) {
    const root = document.createElement('section')
    root.dataset.surface = surface
    if (surface === 'host') root.id = 'app'
    root.className = className
    root.innerHTML = `
      <header>Page actions</header><aside>Navigation</aside>
      <main><div class="group shadow-xl nc-paper">
        <h1>Document title</h1><p>Body copy</p><ul><li>Item</li></ul>
        <table><tbody><tr><th>Label</th><td>Value</td></tr></tbody></table>
        <img alt="Image"><section>Section</section><article>Article</article>
        <span class="absolute ring-blue-500">Positioned content</span>
      </div></main>
      <div data-canvas-toolbar>Canvas tools</div>
      <div data-radix-popper-content-wrapper>Popup</div>
      <div class="nc-section-annotation">Section annotation</div>
      <div class="nc-section-empty">Empty section</div>
      <div class="nc-selected">Selection</div>
      <div class="hidden print:block" data-print-only>Print content</div>
    `
    document.body.append(root)
  }
})

afterEach(() => {
  document.body.replaceChildren()
  document.body.classList.remove('nc-print-blocked')
})

describe('imported builder styles', () => {
  it('leaves host document and app-root sizing and base styles to the host', () => {
    for (const element of [document.documentElement, document.body, document.querySelector('#app')!]) {
      expect(hostScreenDeclarations(element), element.tagName).toEqual({})
    }
  })

  it('leaves an unrelated host page and its print content unaffected', () => {
    expect(affectedHostElements()).toEqual([])
  })

  it('leaves host page dimensions and margins to the host document', () => {
    const pageRules: string[] = []
    stylesheet.walkAtRules('page', rule => { pageRules.push(rule.toString()) })
    expect(pageRules).toEqual([])
  })

  it.each(['voucher', 'template'])('retains local print chrome and paper behavior in the %s editor', surface => {
    const root = document.querySelector(`[data-surface="${surface}"]`)!
    for (const selector of ['header', 'aside', '[data-canvas-toolbar]', '[data-radix-popper-content-wrapper]', '.nc-section-annotation', '.nc-section-empty']) {
      expect(printDeclarations(root.querySelector(selector)!).display, selector).toBe('none')
    }
    expect(printDeclarations(root.querySelector('.nc-selected')!, '::after').display).toBe('none')
    expect(printDeclarations(root.querySelector('.nc-paper')!)).toMatchObject({ 'box-shadow': 'none', width: '100%' })
    expect(printDeclarations(root.querySelector('[data-print-only]')!).display).toBe('block')
  })

  it('confines the explicit print restriction and its message to editor surfaces', () => {
    const editors = [...document.querySelectorAll('.nc-workspace, .tc-workspace')]
    for (const editor of editors) expect(printDeclarations(editor).visibility).toBeUndefined()

    document.body.classList.add('nc-print-blocked')

    expect(affectedHostElements()).toEqual([])
    for (const editor of editors) {
      expect(printDeclarations(editor).visibility).toBe('hidden')
      expect(printDeclarations(editor.querySelector('p')!).visibility).toBe('hidden')
      expect(printDeclarations(editor, '::after')).toMatchObject({ visibility: 'visible', position: 'absolute' })
    }
  })
})
