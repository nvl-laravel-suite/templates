import { Table } from 'lucide-react'
import { defineBlock } from '../../registry'
import { appearanceGroup } from '../../helpers/settings-factories'
import { TableBlockRenderer } from '../../renderers/composables/table-block'
import { FONT_SIZE_OPTIONS } from '../../../lib/font-sizes'

export const tableBlock = defineBlock({
  type: 'table',
  name: 'Table',
  description: 'Data table with headers and rows',
  icon: Table,
  category: 'media',
  allowedIn: ['page', 'column'],
  canContain: false,

  // Table has complex content (2D array). Managed by custom settings UI.
  content: {},

  settings: {
    striped: { type: 'boolean', default: true },
    compact: { type: 'boolean', default: false },
    showFooter: { type: 'boolean', default: false },
    headerBackground: { type: 'color', default: '#f9fafb' },
    variant: { type: 'enum', default: 'horizontal', options: [{ value: 'none', label: 'None' }, { value: 'horizontal', label: 'Horiz' }, { value: 'full', label: 'Full' }, { value: 'minimal', label: 'Minimal' }] },
    textColor: { type: 'color', default: '' },
    fontSize: { type: 'enum', default: 'sm', display: 'pills', options: [...FONT_SIZE_OPTIONS] },
    fontWeight: { type: 'enum', default: 'normal', options: [
      { value: 'normal', label: 'Normal' }, { value: 'medium', label: 'Medium' },
      { value: 'semibold', label: 'Semibold' }, { value: 'bold', label: 'Bold' },
    ]},
    headerFontWeight: { type: 'enum', default: 'semibold', options: [
      { value: 'normal', label: 'Normal' }, { value: 'medium', label: 'Medium' },
      { value: 'semibold', label: 'Semibold' }, { value: 'bold', label: 'Bold' },
    ]},
  },

  settingsLayout: [
    appearanceGroup(['striped', 'compact', 'showFooter', 'headerBackground', 'variant', 'fontSize', 'fontWeight', 'headerFontWeight']),
  ],

  render: TableBlockRenderer,
})
