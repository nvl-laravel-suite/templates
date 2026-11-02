import { DATE_FORMAT_OPTIONS, DATE_MODE_OPTIONS } from '../primitives/options'
import { defineTrait } from './registry'

export const dateFormatTrait = defineTrait({
  id: 'date-format',
  title: 'Format',
  defaultOpen: true,
  display: 'flat',
  fields: {
    mode: {
      source: 'settings',
      schema: { type: 'enum', default: 'auto', options: [...DATE_MODE_OPTIONS] },
    },
    format: {
      source: 'settings',
      schema: { type: 'enum', default: 'long', options: [...DATE_FORMAT_OPTIONS] },
    },
    value: {
      source: 'content',
      schema: {
        type: 'string',
        default: '',
        placeholder: 'March 16, 2026',
        when: { field: 'mode', value: 'static' },
      },
    },
    locale: {
      source: 'settings',
      schema: { type: 'string', default: '', placeholder: 'en' },
    },
  },
  fieldOrder: ['mode', 'format', 'value', 'locale'],
})
