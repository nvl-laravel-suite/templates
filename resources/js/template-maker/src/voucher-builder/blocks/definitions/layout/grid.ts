import { Grid3x3 } from 'lucide-react'
import { defineBlock } from '../../registry'
import { layoutGroup } from '../../helpers/settings-factories'
import { GridBlockRenderer } from '../../renderers/layout/grid-block'

export const gridBlock = defineBlock({
  type: 'grid',
  name: 'Grid',
  description: 'Bento-style 2D layout container with resizable cells',
  icon: Grid3x3,
  category: 'layout',
  allowedIn: ['page'],
  canContain: false,
  capabilities: {
    childKind: 'grid-cells',
  },
  content: {},
  settings: {
    gap: { type: 'slider', default: 0, min: 0, max: 48, step: 4, suffix: 'px' },
    responsive: { type: 'enum', default: 'stack', options: [
      { value: 'stack', label: 'Stack' },
      { value: 'scroll', label: 'Scroll' },
      { value: 'none', label: 'None' },
    ]},
  },
  settingsLayout: [
    layoutGroup(['gap', 'responsive'], { title: 'Grid' }),
  ],
  render: GridBlockRenderer,
})
