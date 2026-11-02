import { Sticker } from 'lucide-react'
import { defineBlock } from '../../registry'
import { StickerBlockRenderer } from '../../renderers/primitives/sticker-block'
import { contentGroup, sizeGroup, effectsGroup } from '../../helpers/settings-factories'

export const stickerBlock = defineBlock({
  type: 'sticker',
  name: 'Sticker',
  description: 'Absolutely-positioned image sticker with position, size, and rotation controls',
  icon: Sticker,
  category: 'media',

  allowedIn: ['page', 'column'],
  canContain: false,

  content: {
    imageUrl: { type: 'image', default: '' },
    alt: { type: 'string', default: '', placeholder: 'Describe the sticker' },
  },

  settings: {
    posX: { type: 'slider', default: 0, min: -50, max: 180, step: 1, suffix: 'mm' },
    posY: { type: 'slider', default: 0, min: -50, max: 260, step: 1, suffix: 'mm' },
    width: { type: 'slider', default: 30, min: 5, max: 100, step: 1, suffix: 'mm' },
    height: { type: 'slider', default: 30, min: 5, max: 100, step: 1, suffix: 'mm' },
    rotate: { type: 'slider', default: 0, min: -180, max: 180, step: 1, suffix: '°' },
    opacity: { type: 'slider', default: 1, min: 0, max: 1, step: 0.05, suffix: '' },
  },

  settingsLayout: [
    contentGroup(['imageUrl', 'alt'], { title: 'Sticker' }),
    sizeGroup(['posX', 'posY', 'width', 'height']),
    effectsGroup(['rotate', 'opacity']),
  ],

  render: StickerBlockRenderer,
})
