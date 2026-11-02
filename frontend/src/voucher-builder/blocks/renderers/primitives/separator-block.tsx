interface SeparatorBlockData {
  id: string
  type: 'separator'
  content: Record<string, never>
  settings: { style: string; color: string; size: string; spacing: string }
}

const sizeMap: Record<string, number> = { sm: 12, md: 16, lg: 24 }
const spacingMap: Record<string, string> = { sm: '8px 0', md: '16px 0', lg: '24px 0' }

function Dot({ size, color }: { size: number; color: string }) {
  const r = Math.max(2, size / 5)
  return <svg width={r * 2} height={r * 2} viewBox={`0 0 ${r * 2} ${r * 2}`}><circle cx={r} cy={r} r={r} fill={color} /></svg>
}

function Diamond({ size, color }: { size: number; color: string }) {
  const s = Math.max(6, size * 0.6)
  return <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}><rect x={s / 2} y="0" width={s * 0.5} height={s * 0.5} transform={`rotate(45 ${s / 2} ${s / 2})`} fill={color} /></svg>
}

function Star({ size, color }: { size: number; color: string }) {
  const s = Math.max(8, size * 0.65)
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={color} stroke="none">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
    </svg>
  )
}

export function SeparatorBlockRenderer({ block }: { block: SeparatorBlockData }) {
  const { style, color, size, spacing } = block.settings
  const c = color || 'var(--nc-secondary, #9ca3af)'
  const s = sizeMap[size] || 16
  const pad = spacingMap[spacing] || '16px 0'

  const base: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: pad,
    gap: `${Math.max(4, s * 0.5)}px`,
    lineHeight: 1,
  }

  if (style === 'dots') {
    return (
      <div style={base}>
        <Dot size={s} color={c} />
        <Dot size={s} color={c} />
        <Dot size={s} color={c} />
      </div>
    )
  }

  if (style === 'diamond') {
    return (
      <div style={base}>
        <Diamond size={s} color={c} />
      </div>
    )
  }

  if (style === 'wave') {
    const w = Math.max(60, s * 5)
    const h = Math.max(6, s * 0.4)
    return (
      <div style={base}>
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" stroke={c} strokeWidth={Math.max(1, s / 10)} strokeLinecap="round">
          <path d={`M0,${h / 2} Q${w * 0.125},0 ${w * 0.25},${h / 2} T${w * 0.5},${h / 2} T${w * 0.75},${h / 2} T${w},${h / 2}`} />
        </svg>
      </div>
    )
  }

  if (style === 'fade') {
    return (
      <div style={{ ...base, gap: 0 }}>
        <div
          style={{
            flex: 1,
            height: Math.max(1, s / 8),
            background: `linear-gradient(to right, transparent, ${c}, transparent)`,
          }}
        />
      </div>
    )
  }

  if (style === 'stars') {
    return (
      <div style={base}>
        <Star size={s} color={c} />
        <Star size={s} color={c} />
        <Star size={s} color={c} />
      </div>
    )
  }

  // Default: dots
  return (
    <div style={base}>
      <Dot size={s} color={c} />
      <Dot size={s} color={c} />
      <Dot size={s} color={c} />
    </div>
  )
}
