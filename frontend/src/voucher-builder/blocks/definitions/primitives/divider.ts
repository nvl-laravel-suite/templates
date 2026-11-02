import { Minus } from 'lucide-react'
import { defineBlock } from '../../registry'
import { DividerBlockRenderer } from '#/voucher-builder/blocks/renderers/primitives/divider-block'
import { appearanceGroup } from '../../helpers/settings-factories'

export const dividerBlock = defineBlock({
  type: 'divider',
  name: 'Divider',
  description: 'Horizontal rule separator',
  icon: Minus,
  category: 'content',
  allowedIn: ['page', 'column'],
  canContain: false,
  content: {},
  settings: {
    style:     { type: 'enum', default: 'solid', options: [
      { value: 'solid', label: 'Solid' }, { value: 'dashed', label: 'Dash' }, { value: 'dotted', label: 'Dot' },
    ]},
    weight:    { type: 'slider', default: 1, min: 1, max: 5, step: 1, suffix: 'px' },
    color:     { type: 'color', default: '#e5e7eb' },
    width:     { type: 'enum', default: '100%', options: [
      { value: '100%', label: '100%' }, { value: '75%', label: '75%' },
      { value: '50%', label: '50%' }, { value: '25%', label: '25%' },
    ]},
    alignment: { type: 'alignment', default: 'center' },
  },
  settingsLayout: [
    appearanceGroup(['style', 'weight', 'color', 'width', 'alignment'], { display: 'flat' }),
  ],
  render: DividerBlockRenderer,
})
