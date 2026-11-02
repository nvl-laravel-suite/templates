import { ASPECT_RATIO_OPTIONS, OBJECT_FIT_OPTIONS } from '../primitives/options'
import { defineTrait } from './registry'

export const imageSourceTrait = defineTrait({
  id: 'image-source',
  title: 'Source',
  defaultOpen: true,
  display: 'flat',
  fields: {
    url: {
      source: 'content',
      schema: { type: 'image', default: '' },
    },
    alt: {
      source: 'content',
      schema: { type: 'string', default: '', placeholder: 'Describe the image' },
    },
    objectFit: {
      source: 'settings',
      schema: { type: 'enum', default: 'cover', options: [...OBJECT_FIT_OPTIONS] },
    },
    aspectRatio: {
      source: 'settings',
      schema: { type: 'enum', default: 'auto', options: [...ASPECT_RATIO_OPTIONS] },
    },
  },
  fieldOrder: ['url', 'alt', 'objectFit', 'aspectRatio'],
})
