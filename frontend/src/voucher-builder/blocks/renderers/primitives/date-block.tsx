import { useEffect, useState } from 'react'
import { cn } from '#/voucher-builder/lib/utils'
import type { DateBlock as DateBlockType } from '#/voucher-builder/schema'
import { resolveDateBlockValue, type DateDisplayFormat, type DateSourceMode } from '#/voucher-builder/lib/date-block'
import { DEFAULT_TEXT_COLOR, resolveTypography } from '#/voucher-builder/blocks/primitives'

export function DateBlockRenderer({ block }: { block: DateBlockType }) {
  const s = block.settings as Record<string, unknown>
  const [displayValue, setDisplayValue] = useState(() => (
    s.mode === 'auto'
      ? block.content.value || resolveDateBlockValue({
          mode: s.mode as DateSourceMode,
          format: s.format as DateDisplayFormat,
          staticValue: block.content.value,
        })
      : block.content.value
  ))

  useEffect(() => {
    setDisplayValue(resolveDateBlockValue({
      mode: s.mode as DateSourceMode,
      format: s.format as DateDisplayFormat,
      staticValue: block.content.value,
    }))
  }, [block.content.value, s.format, s.mode])

  const typo = resolveTypography(
    {
      fontSize: s.fontSize as string,
      fontWeight: s.fontWeight as string,
      alignment: s.alignment as string,
      textColor: s.textColor as string,
    },
    { fallbackTextColor: DEFAULT_TEXT_COLOR },
  )

  return (
    <p className={cn(...typo.classes)} style={typo.style}>
      {displayValue}
    </p>
  )
}
