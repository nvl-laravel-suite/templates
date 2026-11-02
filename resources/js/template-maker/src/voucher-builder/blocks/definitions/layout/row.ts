import { Columns } from 'lucide-react'
import { defineBlock } from '../../registry'
import { layoutGroup } from '../../helpers/settings-factories'
import { RowBlockRenderer } from '../../renderers/layout/row-block'

export const rowBlock = defineBlock({
  type: 'row',
  name: 'Row',
  description: 'Multi-column row layout container',
  icon: Columns,
  category: 'layout',

  allowedIn: ['page'],
  canContain: false, // only auto-created Columns
  capabilities: {
    childKind: 'row-columns',
  },

  content: {},

  settings: {
    gap:           { type: 'slider', default: 0, min: 0, max: 48, step: 4, suffix: 'px' },
    verticalAlign: { type: 'enum', default: 'top', options: [
      { value: 'top', label: 'Top' }, { value: 'center', label: 'Middle' },
      { value: 'bottom', label: 'Bottom' }, { value: 'stretch', label: 'Stretch' },
    ]},
    responsive: { type: 'enum', default: 'stack', options: [{ value: 'stack', label: 'Stack' }, { value: 'scroll', label: 'Scroll' }, { value: 'none', label: 'None' }] },
    reverseOnMobile: { type: 'boolean', default: false },
  },

  settingsLayout: [
    layoutGroup(['gap', 'verticalAlign', 'responsive', 'reverseOnMobile'], { title: 'Grid' }),
  ],

  render: RowBlockRenderer,
})
