import type { MetadataBlock as MetadataBlockType } from '#/voucher-builder/schema'
import { resolveTypography } from '#/voucher-builder/blocks/primitives'

export function MetadataBlockRenderer({ block }: { block: MetadataBlockType }) {
  const { content } = block
  const s = block.settings as Record<string, unknown>
  const isVertical = s.layout === 'vertical'
  const sep = s.separator === 'none' ? '' : (s.separator as string)
  const alignment = (s.alignment as string) || 'left'

  // Legacy field names (`fieldColor`, `labelColor`) take precedence when set on
  // persisted projects predating the trait migration; otherwise use the
  // trait-contributed `fieldTextColor` / `labelTextColor`.
  const fieldTypo = resolveTypography(
    {
      fontSize: s.fieldFontSize as string,
      fontWeight: s.fieldFontWeight as string,
      textColor: (s.fieldColor as string) || (s.fieldTextColor as string),
    },
    { fallbackTextColor: 'var(--nc-secondary, #6b7280)' },
  )

  const labelTypo = resolveTypography(
    {
      fontSize: s.labelFontSize as string,
      fontWeight: s.labelFontWeight as string,
      textColor: (s.labelColor as string) || (s.labelTextColor as string),
    },
    { fallbackTextColor: 'var(--nc-text, #111827)' },
  )

  return (
    <div style={{ textAlign: alignment as React.CSSProperties['textAlign'] }}>
      <div
        style={{
          display: isVertical ? 'flex' : 'inline-flex',
          flexDirection: isVertical ? 'column' : 'row',
          alignItems: isVertical
            ? alignment === 'center'
              ? 'center'
              : alignment === 'right'
                ? 'flex-end'
                : 'flex-start'
            : 'baseline',
          gap: s.spacing as number,
        }}
      >
        <span
          className={fieldTypo.classes.join(' ')}
          style={{ ...fieldTypo.style, minWidth: (s.fieldMinWidth as number) || undefined }}
        >
          {content.field}
        </span>
        {sep && !isVertical && (
          <span style={{ color: 'var(--nc-secondary, #6b7280)', opacity: 0.5 }}>{sep}</span>
        )}
        <span className={labelTypo.classes.join(' ')} style={labelTypo.style}>
          {content.label}
        </span>
      </div>
    </div>
  )
}
