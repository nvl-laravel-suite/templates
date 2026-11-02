import { ICON_POSITION_OPTIONS } from '../primitives/options'
import { defineTrait } from './registry'

export const iconTrait = defineTrait({
  id: 'icon',
  title: 'Icon',
  defaultOpen: false,
  fields: {
    icon: {
      source: 'settings',
      schema: { type: 'icon', default: '' },
    },
    iconPosition: {
      source: 'settings',
      schema: { type: 'enum', default: 'left', options: [...ICON_POSITION_OPTIONS] },
    },
    iconSize: {
      source: 'settings',
      schema: { type: 'slider', default: 16, min: 8, max: 64, step: 1, suffix: 'px' },
    },
  },
  fieldOrder: ['icon', 'iconPosition', 'iconSize'],
})
