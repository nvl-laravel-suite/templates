import type { TemplateDefinition } from '../template-core/schema'

/** Import mutable media before composition; only managed image bindings cross the contract. */
export function assertManagedMedia(source: TemplateDefinition, engine: 'bindings' | 'shared') {
  if (/url\s*\(/i.test(source.styles.css + source.styles.theme)) throw new Error('CSS media URLs need a qualified managed asset adapter.')
  for (const nodes of [source.nodes, ...source.blocks.map(block => block.nodes)]) for (const node of Object.values(nodes)) {
    if (node.kind !== 'element') continue
    if (Object.keys(node.attributes).some(key => ['src', 'srcset', 'background', 'poster', 'xlink:href'].includes(key.toLowerCase())) || Object.values(node.style).some(value => /url\s*\(/i.test(value))) throw new Error('Static media needs a managed asset binding.')
    const image = node.attributeBindings.src
    if (image && image.source !== 'asset' && !(engine === 'bindings' && image.source === 'field')) throw new Error('This image source needs a managed asset binding or supported resolver.')
  }
}
