import type { Block, BlockType } from '#/voucher-builder/schema'
import { formatDateValue } from '#/voucher-builder/lib/date-block'
import { localizeGeneratedContent } from '#/voucher-builder/i18n/core'
import { createBlock, getComposableTemplates } from './registry'
import { DEFAULT_COMMON_SETTINGS } from './types'

type FactoryOverrides = {
  commonSettings?: Partial<NonNullable<Block['commonSettings']>>
  content?: Record<string, unknown>
  settings?: Record<string, unknown>
}

function createDefinitionBackedBlock(
  type: BlockType,
  id: string,
  locale: string,
  overrides: FactoryOverrides = {},
): Block {
  const base = createBlock(type, id)
  const shouldMirrorChildIds = getComposableTemplates(type) !== undefined

  const content = {
    ...(base.content as Record<string, unknown>),
    ...(shouldMirrorChildIds ? { childIds: [] } : {}),
    ...(overrides.content || {}),
  }

  return {
    id,
    type,
    commonSettings: {
      ...DEFAULT_COMMON_SETTINGS,
      ...(overrides.commonSettings || {}),
    },
    content: localizeGeneratedContent(type, content, locale) as any,
    settings: {
      ...(base.settings as Record<string, unknown>),
      ...(overrides.settings || {}),
    } as any,
  } as Block
}

/**
 * Runtime block instantiation factory.
 *
 * This is intentionally separate from `schema.ts` so block creation rules can
 * evolve independently from Zod persistence schemas.
 */
export function createBlockInstance(type: BlockType, id: string, locale = 'en'): Block {
  switch (type) {
    case 'hero':
      return createDefinitionBackedBlock(type, id, locale, {
        commonSettings: { paddingTop: 40, paddingBottom: 40, paddingLeft: 24, paddingRight: 24 },
      })

    case 'row':
      return {
        id,
        type,
        commonSettings: { ...DEFAULT_COMMON_SETTINGS },
        content: { columnCount: 2, columnWidths: [50, 50], columnIds: [] },
        settings: { gap: 16, verticalAlign: 'top', responsive: 'stack' as const, reverseOnMobile: false },
      }

    case 'grid':
      return {
        id,
        type,
        commonSettings: { ...DEFAULT_COMMON_SETTINGS },
        content: { columns: 2, rows: 2, rowHeights: [180, 180], cellIds: [] },
        settings: { gap: 16, responsive: 'stack' as const },
      }

    case 'image':
      return {
        id,
        type,
        commonSettings: { ...DEFAULT_COMMON_SETTINGS },
        content: { url: '', alt: '', caption: '' },
        settings: {
          width: 100,
          widthUnit: '%',
          height: 0,
          heightUnit: 'auto',
          borderRadius: 8,
          objectFit: 'cover',
          borderWidth: 0,
          aspectRatio: 'auto',
          alignment: 'center' as const,
          shadow: 'none' as const,
          filter: 'none' as const,
        },
      }

    case 'table':
      return createDefinitionBackedBlock(type, id, locale, {
        content: { headers: ['Column 1', 'Column 2', 'Column 3'], rows: [['', '', '']] },
        settings: { showFooter: false },
      })

    case 'socials':
      return createDefinitionBackedBlock(type, id, locale, {
        content: { links: [{ platform: 'github' as const, url: '', label: 'GitHub' }] },
      })

    case 'contactInfo':
      return createDefinitionBackedBlock(type, id, locale, {
        content: { items: [{ type: 'email' as const, value: '', label: '' }] },
      })

    case 'date':
      return createDefinitionBackedBlock(type, id, locale, {
        content: { value: formatDateValue(new Date(), 'long') },
      })

    default:
      return createDefinitionBackedBlock(type, id, locale)
  }
}
