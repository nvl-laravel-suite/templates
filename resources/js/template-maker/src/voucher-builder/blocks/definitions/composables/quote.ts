import { Quote } from 'lucide-react'
import { defineComposableBlock } from '../../helpers/define-composable-block'
import { QuoteBlockRenderer } from '../../renderers/composables/quote-block'

export const quoteBlock = defineComposableBlock({
  type: 'quote',
  name: 'Quote',
  description: 'Composable blockquote with quote text and attribution',
  icon: Quote,
  childTemplates: [
    { type: 'text', alias: 'Quote Text', contentOverrides: { body: 'Your quote here...' }, settingsOverrides: { fontSize: 'lg', fontWeight: 'medium' } },
    { type: 'text', alias: 'Author', contentOverrides: { body: '' }, settingsOverrides: { fontSize: 'sm' } },
  ],
  layoutFields: ['variant', 'borderColor'],
  settings: {
    variant:  { type: 'enum', default: 'bordered', options: [
      { value: 'minimal', label: 'Minimal' }, { value: 'bordered', label: 'Bordered' }, { value: 'heavy', label: 'Heavy' },
    ]},
    borderColor: { type: 'color', default: '' },
  },
  render: QuoteBlockRenderer,
})
