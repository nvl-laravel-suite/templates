import { Calendar } from 'lucide-react'
import { defineBlock } from '../../registry'
import { DateBlockRenderer } from '#/voucher-builder/blocks/renderers/primitives/date-block'

export const dateBlock = defineBlock({
  type: 'date',
  name: 'Date',
  description: 'Display a static date or auto-updating current date',
  icon: Calendar,
  category: 'media',
  allowedIn: ['page', 'column'],
  canContain: false,

  content: {},
  settings: {},

  traits: [
    'date-format',
    { trait: 'typography', defaults: { fontSize: 'sm', fontWeight: 'medium' }, hideFields: ['letterSpacing', 'textTransform', 'lineHeight', 'maxWidth'] },
  ],

  settingsLayout: [
    'trait:date-format',
    'trait:typography',
  ],

  render: DateBlockRenderer,
})
