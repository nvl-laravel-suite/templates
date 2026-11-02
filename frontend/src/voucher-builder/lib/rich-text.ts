const BLOCK_BREAK_TAGS = new Set(['DIV', 'P', 'LI'])

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function normalizeHref(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null

  if (/^(https?:|mailto:|tel:|#|\/)/i.test(trimmed)) {
    return trimmed
  }

  return `https://${trimmed}`
}

function normalizeBreaks(value: string): string {
  return value
    .replace(/(?:<br\s*\/?>\s*){3,}/gi, '<br><br>')
    .replace(/^(?:<br\s*\/?>\s*)+|(?:\s*<br\s*\/?>)+$/gi, '')
}

function sanitizeFallback(value: string, multiline: boolean): string {
  const escaped = escapeHtml(value)
  if (!multiline) {
    return escaped.replace(/\s+/g, ' ').trim()
  }

  return normalizeBreaks(escaped.replace(/\r\n?/g, '\n').replace(/\n/g, '<br>'))
}

function serializeNode(node: Node, multiline: boolean): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent || '').replace(/\u00a0/g, ' ')
    return multiline
      ? escapeHtml(text).replace(/\r\n?/g, '\n').replace(/\n/g, '<br>')
      : escapeHtml(text).replace(/\s+/g, ' ')
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return ''

  const element = node as HTMLElement
  const tag = element.tagName.toUpperCase()
  const children = Array.from(element.childNodes).map((child) => serializeNode(child, multiline)).join('')

  if (tag === 'BR') {
    return multiline ? '<br>' : ' '
  }

  if (tag === 'STRONG' || tag === 'B') {
    return children ? `<strong>${children}</strong>` : ''
  }

  if (tag === 'EM' || tag === 'I') {
    return children ? `<em>${children}</em>` : ''
  }

  if (tag === 'U') {
    return children ? `<u>${children}</u>` : ''
  }

  if (tag === 'A') {
    const href = normalizeHref(element.getAttribute('href'))
    if (!children) return ''
    if (!href) return children
    return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${children}</a>`
  }

  if (BLOCK_BREAK_TAGS.has(tag)) {
    if (!multiline) return `${children} `
    return children ? `${children}<br>` : ''
  }

  return children
}

export function sanitizeRichTextHtml(value: string, options?: { multiline?: boolean }): string {
  const multiline = options?.multiline ?? true
  if (!value) return ''

  if (typeof DOMParser === 'undefined') {
    return sanitizeFallback(value, multiline)
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(value, 'text/html')
  const sanitized = Array.from(doc.body.childNodes).map((node) => serializeNode(node, multiline)).join('')

  return normalizeBreaks(sanitized)
}

export function richTextToPlainText(value: string, options?: { multiline?: boolean }): string {
  const multiline = options?.multiline ?? true
  const sanitized = sanitizeRichTextHtml(value, { multiline })
  if (!sanitized) return ''

  if (typeof DOMParser === 'undefined') {
    return sanitized
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .trim()
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${sanitized.replace(/<br\s*\/?>/gi, '\n')}</div>`, 'text/html')
  return (doc.body.textContent || '').replace(/\u00a0/g, ' ').trim()
}

export function isRichTextEmpty(value: string, options?: { multiline?: boolean }): boolean {
  return richTextToPlainText(value, options).length === 0
}
