import { Tag } from 'lucide-react'
import { defineBlock } from '../../registry'
import { BadgeBlockRenderer } from '../../renderers/primitives/badge-block'
import { contentGroup, styleGroup } from '../../helpers/settings-factories'

export const badgeBlock = defineBlock({
  type: 'badge',
  name: 'Badge',
  description: 'Tag or label badge for skills and categories',
  icon: Tag,
  category: 'content',
  allowedIn: ['page', 'column'],
  canContain: false,
  contentOnlyWhenChild: true,

  content: {
    text: { type: 'string', default: 'Badge' },
  },
  settings: {
    variant: { type: 'enum', default: 'filled', options: [
      { value: 'filled', label: 'Filled' }, { value: 'outline', label: 'Outline' }, { value: 'subtle', label: 'Subtle' },
    ]},
    color: { type: 'color', default: '#3b82f6' },
    size: { type: 'enum', default: 'md', options: [
      { value: 'sm', label: 'S' }, { value: 'md', label: 'M' },
    ]},
    borderRadius: { type: 'enum', default: 'full', options: [
      { value: 'sm', label: 'Rounded' }, { value: 'full', label: 'Pill' },
    ]},
  },

  traits: [
    { trait: 'typography', defaults: { fontSize: 'sm', fontWeight: 'medium' }, hideFields: ['alignment', 'letterSpacing', 'lineHeight', 'maxWidth'] },
    'icon',
  ],

  settingsLayout: [
    contentGroup(['text']),
    styleGroup(['variant', 'color', 'size', 'borderRadius']),
    'trait:icon',
    'trait:typography',
  ],

  render: BadgeBlockRenderer,
})
