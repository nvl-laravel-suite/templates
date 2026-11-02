import { MousePointer } from 'lucide-react'
import { defineBlock } from '../../registry'
import { ButtonBlockRenderer } from '#/voucher-builder/blocks/renderers/primitives/button-block'
import { appearanceGroup, contentGroup } from '../../helpers/settings-factories'

export const buttonBlock = defineBlock({
  type: 'button',
  name: 'Button',
  description: 'Call-to-action link with variant styling',
  icon: MousePointer,
  category: 'content',

  allowedIn: ['page', 'column'],
  canContain: false,
  contentOnlyWhenChild: true,

  content: {
    text: { type: 'string', default: 'Click Me' },
    // button's `url` is block-owned (defaults differ from link trait); link trait still contributes openInNew/rel
    url: { type: 'string', default: '#', placeholder: 'https://...' },
  },

  settings: {
    variant: { type: 'enum', default: 'primary', options: [
      { value: 'primary', label: 'Primary' }, { value: 'secondary', label: 'Secondary' },
      { value: 'outline', label: 'Outline' }, { value: 'ghost', label: 'Ghost' },
    ]},
    size: { type: 'enum', default: 'md', options: [
      { value: 'sm', label: 'S' }, { value: 'md', label: 'M' }, { value: 'lg', label: 'L' },
    ]},
    alignment: { type: 'alignment', default: 'center' },
    fullWidth: { type: 'boolean', default: false },
  },

  traits: ['link', 'icon'],

  settingsLayout: [
    contentGroup(['text', 'url']),
    appearanceGroup(['variant', 'size', 'alignment', 'fullWidth']),
    'trait:link',
    'trait:icon',
  ],

  render: ButtonBlockRenderer,
})
