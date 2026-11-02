import { defineTrait } from './registry'

export const linkTrait = defineTrait({
  id: 'link',
  title: 'Link',
  defaultOpen: false,
  fields: {
    url: {
      source: 'content',
      schema: { type: 'string', default: '', placeholder: 'https://…' },
    },
    openInNew: {
      source: 'settings',
      schema: { type: 'boolean', default: false },
    },
    rel: {
      source: 'settings',
      schema: { type: 'string', default: '', placeholder: 'noopener' },
    },
  },
  fieldOrder: ['url', 'openInNew', 'rel'],
})
