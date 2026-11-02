import { defineTrait } from './registry'

/**
 * Width/height sliders. Sensible defaults for primitives — blocks can
 * override min/max/step/suffix via `traitConfig` defaults.
 */
export const dimensionTrait = defineTrait({
  id: 'dimension',
  title: 'Size',
  defaultOpen: true,
  fields: {
    width: {
      source: 'settings',
      schema: { type: 'slider', default: 100, min: 10, max: 100, step: 10, suffix: '%' },
    },
    height: {
      source: 'settings',
      schema: { type: 'slider', default: 0, min: 0, max: 800, step: 10, suffix: 'px' },
    },
  },
  fieldOrder: ['width', 'height'],
})
