import { defineTrait } from './registry'

/**
 * Rich-text content trait. Registers as a single `text` field on
 * content, with rich-text enabled. Blocks that need a different
 * field name use `as` prefix (e.g. `as: 'body'` → content.bodyText).
 */
export const richTextTrait = defineTrait({
  id: 'rich-text',
  title: 'Content',
  defaultOpen: true,
  display: 'flat',
  fields: {
    text: {
      source: 'content',
      schema: {
        type: 'string',
        default: 'Text',
        placeholder: 'Enter text…',
        richText: true,
        multiline: true,
        rows: 4,
      },
    },
  },
})
