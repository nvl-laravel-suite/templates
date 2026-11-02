import { SquareDashedBottom } from 'lucide-react'
import { defineBlock } from '../../registry'
import { styleGroup } from '../../helpers/settings-factories'
import { ColumnBlockRenderer } from '#/voucher-builder/blocks/renderers/layout/column-block'

export const columnBlock = defineBlock({
  type: 'column',
  name: 'Column',
  description: 'Column within a row layout',
  icon: SquareDashedBottom,
  category: 'layout',

  allowedIn: [], // never user-addable — auto-created by Row
  canContain: ['content', 'media'],

  content: {},

  settings: {
    backgroundColor: { type: 'color', default: 'transparent' },
    padding:         { type: 'slider', default: 0, min: 0, max: 64, step: 2, suffix: 'px' },
    borderRadius:    { type: 'slider', default: 0, min: 0, max: 32, step: 1, suffix: 'px' },
    borderWidth:     { type: 'slider', default: 0, min: 0, max: 8, step: 1, suffix: 'px' },
    borderColor:     { type: 'color', default: '#e5e7eb' },
    gridColumnSpan:  { type: 'slider', default: 1, min: 1, max: 4, step: 1 },
    gridRowSpan:     { type: 'slider', default: 1, min: 1, max: 4, step: 1 },
  },

  settingsLayout: [
    styleGroup(['backgroundColor', 'padding', 'borderRadius', 'borderWidth', 'borderColor', 'gridColumnSpan', 'gridRowSpan'], { title: 'Column Style', display: 'flat' }),
  ],

  render: ColumnBlockRenderer,
})
