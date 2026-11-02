import {
  FONT_SIZE_FIELD_OPTIONS,
  TRACKING_OPTIONS,
  TRANSFORM_OPTIONS,
  WEIGHT_OPTIONS,
} from '../primitives/options'
import { defineTrait } from './registry'

export const typographyTrait = defineTrait({
  id: 'typography',
  title: 'Typography',
  defaultOpen: true,
  fields: {
    fontSize: {
      source: 'settings',
      schema: {
        type: 'enum',
        default: 'md',
        display: 'pills',
        options: [...FONT_SIZE_FIELD_OPTIONS],
      },
    },
    alignment: {
      source: 'settings',
      schema: { type: 'alignment', default: 'left' },
    },
    fontWeight: {
      source: 'settings',
      schema: { type: 'enum', default: 'normal', options: [...WEIGHT_OPTIONS] },
    },
    letterSpacing: {
      source: 'settings',
      schema: { type: 'enum', default: 'normal', options: [...TRACKING_OPTIONS] },
    },
    textTransform: {
      source: 'settings',
      schema: { type: 'enum', default: 'none', options: [...TRANSFORM_OPTIONS] },
    },
    lineHeight: {
      source: 'settings',
      schema: { type: 'slider', default: 0, min: 0, max: 3, step: 0.1 },
    },
    maxWidth: {
      source: 'settings',
      schema: { type: 'slider', default: 0, min: 0, max: 100, step: 5, suffix: '%' },
    },
    textColor: {
      source: 'settings',
      schema: { type: 'color', default: '' },
    },
  },
  fieldOrder: [
    'fontSize',
    'alignment',
    'fontWeight',
    'letterSpacing',
    'textTransform',
    'lineHeight',
    'maxWidth',
    'textColor',
  ],
})
