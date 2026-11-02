import {
  TemplateBlockLibrarySchema, TemplateError, type TemplateBlock, type TemplateBlockLibrary,
  type TemplateDefinition,
} from './schema'
import { getTemplateIssues, nodeValues, parseTemplateDraft } from './validation'
import { createTemplateDefinition } from './defaults'

/** Resolve authoring hints without making a block depend on another template's fields. */
export function getTemplateBlockField(template: TemplateDefinition, block: TemplateBlock, name: string) {
  const hint = block.propertyMetadata?.[name]?.fieldId
  return template.fields.find(field => hint ? field.id === hint : name === `p_${field.id}` || name === field.id)
}

export function parseTemplateBlockLibrary(input: unknown): TemplateBlockLibrary {
  const parsed = TemplateBlockLibrarySchema.safeParse(input)
  if (!parsed.success) throw new TemplateError('validation', 'The reusable block library contract is invalid.',
    parsed.error.issues.map(issue => ({ path: issue.path.join('.'), code: issue.code, message: issue.message })))
  const library = parsed.data
  const definition = createTemplateDefinition('Reusable block library')
  definition.blocks = library.blocks
  definition.assets = library.assets
  definition.styles.theme = library.theme
  const issues = getTemplateIssues(definition)
  if (!library.blocks.some(block => block.id === library.entry.blockId && block.version === library.entry.version))
    issues.push({ path: 'entry', code: 'reference', message: 'The entry block revision is missing.' })
  if (issues.length) throw new TemplateError('validation', issues[0].message, issues)
  return library
}

/** Include nested pinned blocks, referenced images, fonts and the authored theme. */
export function exportTemplateBlock(input: unknown, blockId: string, version: number): TemplateBlockLibrary {
  const template = parseTemplateDraft(input)
  const blocks: TemplateBlock[] = []
  const visited = new Set<string>()
  const include = (id: string, revision: number) => {
    const key = `${id}@${revision}`
    if (visited.has(key)) return
    visited.add(key)
    const matches = template.blocks.filter(block => block.id === id && block.version === revision)
    if (matches.length !== 1) throw new TemplateError('validation', `Expected one reusable block revision: ${key}`)
    const block = matches[0]
    blocks.push(block)
    for (const node of Object.values(block.nodes)) if (node.kind === 'block') include(node.blockId, node.version)
  }
  include(blockId, version)
  const assets = new Set(blocks.flatMap(block => Object.values(block.nodes).flatMap(node =>
    nodeValues(node).flatMap(value => value.source === 'asset' ? [value.assetId] : []))))
  return parseTemplateBlockLibrary({ format: 'gct-template-block-library', schemaVersion: 1,
    entry: { blockId, version }, blocks, theme: template.styles.theme,
    assets: template.assets.filter(asset => asset.kind === 'font' || assets.has(asset.id)),
  })
}
