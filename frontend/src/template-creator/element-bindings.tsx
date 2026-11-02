import type { TemplateNode } from '../template-core/schema'
import { SettingBlock } from '../voucher-builder/builder/settings/primitives/setting-block'
import { useTemplateActions, useTemplateDocument } from './hooks'
import { ValueInput, Toggle } from './controls'

export function LinkControls({ node, run }: { node: Extract<TemplateNode, { kind: 'element' }>; run: (task: () => unknown) => void }) {
  const template = useTemplateDocument()
  const actions = useTemplateActions()
  if (node.tag !== 'a') return null
  return <SettingBlock label="Link destination" display="inline" description="Bind the destination separately from the link’s text or action label.">
    <ValueInput fields={template.fields.filter(field => field.schema.type === 'string')} value={node.attributeBindings.href ?? { source: 'literal', value: node.attributes.href ?? '' }} onChange={value => {
      const attributes = { ...node.attributes }
      const attributeBindings = { ...node.attributeBindings }
      delete attributes.href
      delete attributeBindings.href
      if (value.source === 'literal') {
        if (typeof value.value !== 'string') throw new Error('A link destination must be text.')
        attributes.href = value.value
      } else attributeBindings.href = value
      actions.updateNode(node.id, { attributes, attributeBindings })
    }} onError={cause => run(() => { throw cause })} />
    <Toggle label="Open in a new tab" checked={node.attributes.target === '_blank'} onChange={enabled => run(() => {
      const attributes = { ...node.attributes }
      if (enabled) attributes.target = '_blank'
      else delete attributes.target
      actions.updateNode(node.id, { attributes })
    })} />
  </SettingBlock>
}
