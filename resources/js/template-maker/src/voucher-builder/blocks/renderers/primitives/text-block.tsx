import { cn } from '../../../lib/utils'
import type { TextBlock as TextBlockType } from '../../../schema'
import { DEFAULT_TEXT_COLOR, resolveTypography } from '../../primitives'

export function TextBlockRenderer({ block }: { block: TextBlockType }) {
  const s = block.settings as Record<string, unknown>
  const typo = resolveTypography(
    {
      fontSize: s.fontSize as string,
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
    <div
      className={cn('min-h-6', ...typo.classes)}
      style={typo.style}
      dangerouslySetInnerHTML={{ __html: block.content.body || '' }}
    />
  )
}
