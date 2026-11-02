import { expect, it } from 'vitest'
import * as renderer from '../template-renderer'

it.each([
  ['Welcome email', 'bindings'],
  ['Welcome {{customer}}', 'shared'],
] as const)('selects and renders the supported public email compiler for %s', (name, engine) => {
  const definition = renderer.createEmailTemplate(name)
  const compile = renderer.requiresSharedCompiler(definition) ? renderer.exportSharedTemplateDocument : renderer.exportBindingDocument
  const document = compile(definition, { target: 'email' })
  expect(document.artifacts.engine).toBe(engine)
  const html = engine === 'shared' ? renderer.renderSharedTemplateDocument(document, {
    facts: {}, context: {}, content: document.content, inputs: document.inputDefaults, settings: document.settingsDefaults,
  }).html : document.artifacts.html
  expect(html.match(/<title\b[^>]*>(.*?)<\/title>/)?.[1]).toBe(name)
  expect(html).toContain('<table')
  expect(html).toContain('Your email content')
})
