import { HEADING_LEVEL_OPTIONS } from '../primitives/options'
import { defineTrait } from './registry'

export const headingLevelTrait = defineTrait({
  id: 'heading-level',
  title: 'Level',
  defaultOpen: true,
  display: 'flat',
  fields: {
    level: {
      source: 'settings',
      schema: { type: 'enum', default: 'h2', options: [...HEADING_LEVEL_OPTIONS] },
    },
  },
})
