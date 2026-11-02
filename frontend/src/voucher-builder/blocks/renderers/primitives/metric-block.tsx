import { cn } from '#/voucher-builder/lib/utils'
import { resolveTypography } from '#/voucher-builder/blocks/primitives'

interface MetricBlockData {
  id: string
  type: 'metric'
  content: { value: string; label: string; prefix: string; suffix: string }
  settings: Record<string, unknown>
}

export function MetricBlockRenderer({ block }: { block: MetricBlockData }) {
  const s = block.settings
  const alignClass = { left: 'text-left', center: 'text-center', right: 'text-right' }[s.alignment as string] || 'text-center'

  const valueTypo = resolveTypography(
    {
      fontSize: (s.fontSize as string) || (s.valueSize as string) || 'xl',
      fontWeight: (s.fontWeight as string) || 'bold',
      textColor: s.valueColor as string,
    },
    { fallbackTextColor: 'var(--nc-accent, #3b82f6)' },
  )

  const labelTypo = resolveTypography(
    {
      fontSize: (s.labelFontSize as string) || 'sm',
      fontWeight: (s.labelFontWeight as string) || 'normal',
      textColor: s.textColor as string,
    },
    { fallbackTextColor: 'var(--nc-text, #111827)' },
  )

  return (
    <div className={cn('space-y-1', alignClass)}>
      <div className={cn('leading-tight tabular-nums', ...valueTypo.classes)} style={valueTypo.style}>
        {block.content.prefix}{block.content.value || '0'}{block.content.suffix}
      </div>
      <div className={cn(...labelTypo.classes)} style={labelTypo.style}>
        {block.content.label}
      </div>
    </div>
  )
}
