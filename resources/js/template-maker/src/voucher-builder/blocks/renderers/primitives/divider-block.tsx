import type { DividerBlock as DividerBlockType } from '../../../schema'

export function DividerBlockRenderer({ block }: { block: DividerBlockType }) {
  const { style, weight, color, width, alignment } = block.settings

  const alignmentStyle: React.CSSProperties = {
    maxWidth: width || '100%',
    ...(alignment === 'center' && { marginInline: 'auto' }),
    ...(alignment === 'left' && { marginRight: 'auto', marginLeft: 0 }),
    ...(alignment === 'right' && { marginLeft: 'auto', marginRight: 0 }),
  }

  return (
    <hr
      className="border-0"
      style={{
        borderTopWidth: weight,
        borderTopStyle: style,
        borderTopColor: color || 'var(--nc-border, #e5e7eb)',
        ...alignmentStyle,
      }}
    />
  )
}
