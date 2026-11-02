import { FileText } from 'lucide-react'
import { defineBlock } from '../../registry'
import { TextBlockRenderer } from '../../renderers/primitives/text-block'
import { contentGroup } from '../../helpers/settings-factories'

export const textBlock = defineBlock({
  type: 'text',
  name: 'Text',
  description: 'Paragraph text with typography controls',
  icon: FileText,
  category: 'content',

  allowedIn: ['page', 'column'],
  canContain: false,
  contentOnlyWhenChild: true,

  content: {
    body: { type: 'string', default: 'Start writing here...', multiline: true, rows: 6, richText: true },
  },
  settings: {},

  traits: ['typography'],

  settingsLayout: [
    contentGroup(['body']),
    'trait:typography',
  ],

  render: TextBlockRenderer,
})
