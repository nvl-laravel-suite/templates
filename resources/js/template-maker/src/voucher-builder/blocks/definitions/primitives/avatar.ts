import { CircleUser } from 'lucide-react'
import { defineBlock } from '../../registry'
import { AvatarBlockRenderer } from '../../renderers/primitives/avatar-block'
import { contentGroup, appearanceGroup, colorsGroup } from '../../helpers/settings-factories'

export const avatarBlock = defineBlock({
  type: 'avatar',
  name: 'Avatar',
  description: 'Circular or shaped avatar with image or initials fallback',
  icon: CircleUser,
  category: 'media',
  allowedIn: ['page', 'column'],
  canContain: false,
  contentOnlyWhenChild: true,

  content: {
    url: { type: 'image', default: '' },
    alt: { type: 'string', default: '', placeholder: 'Alt text' },
    initials: { type: 'string', default: '', placeholder: 'e.g. JD' },
  },

  settings: {
    shape: { type: 'enum', default: 'circle', options: [{ value: 'circle', label: 'Circle' }, { value: 'square', label: 'Square' }, { value: 'squircle', label: 'Squircle' }] },
    size: { type: 'enum', default: 'md', options: [{ value: 'sm', label: 'S' }, { value: 'md', label: 'M' }, { value: 'lg', label: 'L' }, { value: 'xl', label: 'XL' }] },
    borderWidth: { type: 'slider', default: 0, min: 0, max: 8, step: 1, suffix: 'px' },
    borderColor: { type: 'color', default: '#e5e7eb' },
    showInitials: { type: 'boolean', default: true },
  },

  settingsLayout: [
    contentGroup(['url', 'alt', 'initials']),
    appearanceGroup(['shape', 'size', 'showInitials']),
    colorsGroup(['borderWidth', 'borderColor'], { title: 'Border' }),
  ],

  render: AvatarBlockRenderer,
})
