import { ImageIcon } from 'lucide-react'
import { defineBlock } from '../../registry'
import { ImageBlockRenderer } from '../../renderers/primitives/image-block'
import { borderGroup, contentGroup, effectsGroup, sizeGroup } from '../../helpers/settings-factories'
import { IMAGE_FILTER_OPTIONS, SHADOW_PRESET_OPTIONS } from '../../primitives/options'

export const imageBlock = defineBlock({
  type: 'image',
  name: 'Image',
  description: 'Image with URL or upload, sizing, and border controls',
  icon: ImageIcon,
  category: 'media',

  allowedIn: ['page', 'column'],
  canContain: false,
  contentOnlyWhenChild: true,

  content: {
    caption: { type: 'string', default: '' },
  },

  settings: {
    width: { type: 'slider', default: 100, min: 10, max: 100, step: 10, suffix: '%' },
    height: { type: 'slider', default: 0, min: 0, max: 800, step: 10, suffix: 'px' },
    borderRadius: { type: 'slider', default: 8, min: 0, max: 48, step: 1, suffix: 'px' },
    borderWidth: { type: 'slider', default: 0, min: 0, max: 8, step: 1, suffix: 'px' },
    alignment: { type: 'alignment', default: 'center' },
    shadow: { type: 'enum', default: 'none', options: [...SHADOW_PRESET_OPTIONS] },
    filter: { type: 'enum', default: 'none', options: [...IMAGE_FILTER_OPTIONS] },
  },

  traits: ['image-source'],

  settingsLayout: [
    'trait:image-source',
    contentGroup(['caption']),
    sizeGroup(['width', 'height', 'alignment']),
    effectsGroup(['shadow', 'filter']),
    borderGroup(['borderRadius', 'borderWidth']),
  ],

  render: ImageBlockRenderer,
})
