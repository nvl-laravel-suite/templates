import { List } from 'lucide-react'
import { defineBlock } from '../../registry'
import { ListBlockRenderer } from '#/voucher-builder/blocks/renderers/primitives/list-block'
import { appearanceGroup, contentGroup } from '../../helpers/settings-factories'

export const listBlock = defineBlock({
  type: 'list',
  name: 'List',
  description: 'Ordered, unordered, or checklist items',
  icon: List,
  category: 'content',
  allowedIn: ['page', 'column'],
  canContain: false,
  contentOnlyWhenChild: true,

  content: {
    items: { type: 'list', default: ['Item 1', 'Item 2', 'Item 3'], placeholder: 'Item', addLabel: 'Add Item', richText: true },
  },
  settings: {
    listType: { type: 'enum', default: 'unordered', options: [
      { value: 'unordered', label: 'Bullet' }, { value: 'ordered', label: 'Number' }, { value: 'checklist', label: 'Check' },
    ]},
    spacing: { type: 'enum', default: 'normal', options: [
      { value: 'none', label: 'None' }, { value: 'compact', label: 'Tight' }, { value: 'normal', label: 'Normal' }, { value: 'relaxed', label: 'Loose' },
    ]},
    columns: { type: 'enum', default: '1', options: [
      { value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' },
    ]},
    iconType: { type: 'enum', default: 'disc', options: [
      { value: 'disc', label: 'Disc' }, { value: 'circle', label: 'Circle' }, { value: 'square', label: 'Square' },
      { value: 'dash', label: 'Dash' }, { value: 'check', label: 'Check' }, { value: 'arrow', label: 'Arrow' },
    ]},
    // keep existing lineHeight default (1.4) distinct from typography trait's (0)
    lineHeight: { type: 'slider', default: 1.4, min: 1, max: 2.5, step: 0.1 },
  },

  traits: [
    { trait: 'typography', defaults: { fontSize: 'sm' }, hideFields: ['alignment', 'letterSpacing', 'textTransform', 'maxWidth'] },
  ],

  settingsLayout: [
    contentGroup(['items'], { title: 'Items' }),
    appearanceGroup(['listType', 'spacing', 'columns', 'iconType']),
    'trait:typography',
  ],

  render: ListBlockRenderer,
})
