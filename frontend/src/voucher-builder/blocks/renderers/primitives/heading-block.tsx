import { cn } from '#/voucher-builder/lib/utils'
import type { HeadingBlock as HeadingBlockType } from '#/voucher-builder/schema'
import {
  DEFAULT_TEXT_COLOR,
  HEADING_LEVEL_SIZES,
  resolveTypography,
} from '#/voucher-builder/blocks/primitives'

export function HeadingBlockRenderer({ block }: { block: HeadingBlockType }) {
  const s = block.settings as Record<string, unknown>
  const Tag = (s.level as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6') || 'h2'
  const fontSizeSetting = (s.fontSize as string) || 'auto'
  const useLevelSize = fontSizeSetting === 'auto'

  const typo = resolveTypography(
    {
      fontSize: useLevelSize ? undefined : fontSizeSetting,
      fontWeight: s.fontWeight as string,
      letterSpacing: s.letterSpacing as string,
      textTransform: s.textTransform as string,
      alignment: s.alignment as string,
      lineHeight: s.lineHeight as number,
      maxWidth: s.maxWidth as number,
      textColor: s.textColor as string,
    },
    { fallbackTextColor: DEFAULT_TEXT_COLOR },
  )

  return (
    <Tag
      className={cn(useLevelSize && HEADING_LEVEL_SIZES[Tag], ...typo.classes, 'min-h-6 leading-tight')}
      style={typo.style}
      dangerouslySetInnerHTML={{ __html: block.content.text || '' }}
    />
  )
}
