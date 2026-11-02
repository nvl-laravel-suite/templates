import { LayoutTemplate } from 'lucide-react'
import { defineSectionBlock } from '../../helpers/define-section-block'
import { SectionBlockRenderer } from '../../renderers/sections/section-block'

export const sectionBlock = defineSectionBlock({
  type: 'section',
  name: 'Section',
  description: 'Container with icon, title, divider, and child blocks',
  icon: LayoutTemplate,
  category: 'layout',
  canContain: true,
  childTemplates: [],
  defaultTitle: 'Section Title',
  defaultIcon: 'briefcase',
  extraContent: {
    description: { type: 'string', default: '', multiline: true, rows: 2 },
  },
  extraSettings: {
    showTitle: { type: 'boolean', default: true },
    showDescription: { type: 'boolean', default: false },
    titleFontWeight: { type: 'enum', default: 'bold', options: [
      { value: 'normal', label: 'Normal' }, { value: 'medium', label: 'Medium' },
      { value: 'semibold', label: 'Semibold' }, { value: 'bold', label: 'Bold' }, { value: 'extrabold', label: 'Extra Bold' },
    ]},
  },
  appearanceFields: ['showTitle', 'showIcon', 'showDivider', 'showDescription', 'titleSize', 'titleFontWeight'],
  render: SectionBlockRenderer,
})
