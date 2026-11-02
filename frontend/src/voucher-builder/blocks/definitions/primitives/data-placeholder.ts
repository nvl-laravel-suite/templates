import { Braces } from 'lucide-react'
import { defineBlock } from '../../registry'
import { DataPlaceholderBlockRenderer } from '#/voucher-builder/blocks/renderers/primitives/data-placeholder-block'
import { contentGroup, sizeGroup } from '../../helpers/settings-factories'

export const dataPlaceholderBlock = defineBlock({
  type: 'dataPlaceholder',
  name: 'Data Placeholder',
  description: 'Dynamic data placeholder replaced via API at render time',
  icon: Braces,
  category: 'media',

  allowedIn: ['page', 'column'],
  canContain: false,

  content: {
    valueKey: { type: 'string', default: '', placeholder: ':recipient_name' },
    placeholderText: { type: 'string', default: 'Placeholder', placeholder: 'Label shown in builder' },
    placeholderType: { type: 'enum', default: 'text', options: [
      { value: 'text', label: 'Text' },
      { value: 'image', label: 'Image' },
    ]},
  },

  settings: {
    width: { type: 'number', default: 0 },
    height: { type: 'number', default: 0 },
  },

  traits: [
    { trait: 'typography', hideFields: ['letterSpacing', 'textTransform', 'lineHeight', 'maxWidth', 'textColor'] },
  ],

  settingsLayout: [
    contentGroup(['valueKey', 'placeholderText', 'placeholderType'], { title: 'Placeholder' }),
    sizeGroup(['width', 'height']),
    'trait:typography',
  ],

  render: DataPlaceholderBlockRenderer,
})
