// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { richTextToPlainText, sanitizeRichTextHtml } from './rich-text'

describe('sanitizeRichTextHtml', () => {
  it('keeps supported inline tags and strips unsupported markup', () => {
    expect(
      sanitizeRichTextHtml('<strong>Hello</strong> <script>alert(1)</script><span>world</span>', { multiline: false })
    ).toBe('<strong>Hello</strong> alert(1)world')
  })

  it('normalizes paragraph-like blocks into line breaks', () => {
    expect(
      sanitizeRichTextHtml('<p>Line 1</p><div>Line 2</div>', { multiline: true })
    ).toBe('Line 1<br>Line 2')
  })

  it('normalizes links to safe hrefs', () => {
    expect(
      sanitizeRichTextHtml('<a href="example.com">Portfolio</a>', { multiline: false })
    ).toBe('<a href="https://example.com" target="_blank" rel="noopener noreferrer">Portfolio</a>')
  })
})

describe('richTextToPlainText', () => {
  it('converts inline html to clean text', () => {
    expect(
      richTextToPlainText('Hello <strong>there</strong><br>friend', { multiline: true })
    ).toBe('Hello there\nfriend')
  })
})
