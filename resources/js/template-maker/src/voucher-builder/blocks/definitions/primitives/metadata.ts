import { Table2 } from 'lucide-react'
import { defineBlock } from '../../registry'
import { MetadataBlockRenderer } from '../../renderers/primitives/metadata-block'
import { contentGroup, layoutGroup } from '../../helpers/settings-factories'

export const metadataBlock = defineBlock({
  type: 'metadata',
  name: 'Metadata',
  description: 'Structured field-separator-label data display',
  icon: Table2,
  category: 'content',
  allowedIn: ['page', 'column'],
  canContain: false,

  content: {
    field: { type: 'string', default: 'Field' },
    label: { type: 'string', default: 'Value' },
  },

  settings: {
    separator: { type: 'enum', default: ':', options: [
      { value: ':', label: ':' },
      { value: '|', label: '|' },
      { value: '-', label: '-' },
      { value: '·', label: '·' },
      { value: 'none', label: 'None' },
    ]},
    layout: { type: 'enum', default: 'horizontal', options: [
      { value: 'horizontal', label: 'Horizontal' },
      { value: 'vertical', label: 'Vertical' },
    ]},
    alignment: { type: 'enum', default: 'left', options: [
      { value: 'left', label: 'Left' },
      { value: 'center', label: 'Center' },
      { value: 'right', label: 'Right' },
    ]},
    fieldMinWidth: { type: 'slider', default: 0, min: 0, max: 200, step: 5, suffix: 'px' },
    spacing: { type: 'slider', default: 8, min: 0, max: 32, step: 2, suffix: 'px' },
  },

  traits: [
    {
      trait: 'typography',
      as: 'field',
      title: 'Field Style',
      defaults: { fontSize: 'sm', fontWeight: 'normal' },
      hideFields: ['alignment', 'letterSpacing', 'textTransform', 'lineHeight', 'maxWidth'],
    },
    {
      trait: 'typography',
      as: 'label',
      title: 'Label Style',
      defaults: { fontSize: 'md', fontWeight: 'bold' },
      hideFields: ['alignment', 'letterSpacing', 'textTransform', 'lineHeight', 'maxWidth'],
    },
  ],

  settingsLayout: [
    contentGroup(['field', 'label']),
    layoutGroup(['layout', 'separator', 'alignment', 'spacing', 'fieldMinWidth']),
    'trait:typography:field',
    'trait:typography:label',
  ],

  render: MetadataBlockRenderer,
})
