import en from './locales/en.json'
import ar from './locales/ar.json'

type Messages = Record<string, string>

const dictionaries: Record<string, Messages> = { en, ar }

export function normalizeLocale(locale?: string): string {
  const base = (locale || 'en').trim().toLowerCase().split('-')[0]
  return dictionaries[base] ? base : 'en'
}

export function getDirection(locale?: string): 'ltr' | 'rtl' {
  return normalizeLocale(locale) === 'ar' ? 'rtl' : 'ltr'
}

export function t(key: string, params?: Record<string, string | number>, locale?: string): string {
  const normalizedLocale = normalizeLocale(locale)
  const dictionary = dictionaries[normalizedLocale] || dictionaries.en
  const template = dictionary[key] || dictionaries.en[key] || key

  if (!params) return template

  return Object.entries(params).reduce((result, [paramKey, paramValue]) => {
    return result.replaceAll(`{${paramKey}}`, String(paramValue))
  }, template)
}

export function localizedDefault(key: string, locale?: string, fallback = ''): string {
  const value = t(key, undefined, locale)
  return value === key ? fallback : value
}

export function localizeGeneratedContent<T extends Record<string, any>>(type: string, content: T, locale?: string): T {
  switch (type) {
    case 'heading':
      return {
        ...content,
        text: content.text === 'Heading' || !content.text
          ? localizedDefault('defaults.heading', locale, content.text || 'Heading')
          : content.text === 'Project Name'
          ? localizedDefault('defaults.project.title', locale, content.text)
          : content.text === 'Your Name'
          ? localizedDefault('defaults.contact.name', locale, content.text)
          : content.text,
      }
    case 'text': {
      const body = content.body || ''
      const nextBody = body === 'Start writing here...'
        ? localizedDefault('defaults.text', locale, body)
        : body === 'Write your professional summary here. Highlight your key achievements, skills, and career objectives.'
        ? localizedDefault('defaults.summary.body', locale, body)
        : body
      return { ...content, body: nextBody }
    }
    default:
      return content
  }
}

export function localizeProjectDefaults<T extends {
  global: { metadata: { language?: string } }
  blocks: Record<string, { type: string; content: Record<string, any> }>
}>(project: T, locale?: string): T {
  const nextLocale = normalizeLocale(locale || project.global.metadata.language || 'en')
  const nextBlocks = Object.fromEntries(
    Object.entries(project.blocks).map(([blockId, block]) => ([
      blockId,
      {
        ...block,
        content: localizeGeneratedContent(block.type, block.content, nextLocale),
      },
    ]))
  ) as T['blocks']

  return {
    ...project,
    global: {
      ...project.global,
      metadata: {
        ...project.global.metadata,
        language: nextLocale,
      },
    },
    blocks: nextBlocks,
  }
}
