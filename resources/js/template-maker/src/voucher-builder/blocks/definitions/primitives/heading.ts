import { Heading } from 'lucide-react'
import { defineBlock } from '../../registry'
import { HeadingBlockRenderer } from '../../renderers/primitives/heading-block'
import { contentGroup } from '../../helpers/settings-factories'
import { FONT_SIZE_FIELD_OPTIONS_WITH_AUTO } from '../../primitives/options'

export const headingBlock = defineBlock({
  type: 'heading',
  name: 'Heading',
  description: 'Title text with level and styling',
  icon: Heading,
  category: 'content',

  allowedIn: ['page', 'column'],
  canContain: false,
  contentOnlyWhenChild: true,

  content: {
    text: { type: 'string', default: 'Heading', placeholder: 'Enter heading text', richText: true },
  },
  settings: {
    // Override the typography trait's fontSize with an 'auto' option.
    fontSize: {
      type: 'enum',
      default: 'auto',
      display: 'pills',
      options: [...FONT_SIZE_FIELD_OPTIONS_WITH_AUTO],
    },
  },

  traits: [
    'heading-level',
    { trait: 'typography', defaults: { fontWeight: 'bold' } },
  ],

  settingsLayout: [
    contentGroup(['text']),
    'trait:heading-level',
    'trait:typography',
  ],

  render: HeadingBlockRenderer,
})
