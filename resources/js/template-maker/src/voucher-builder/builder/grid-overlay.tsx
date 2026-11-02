import { mmToPx, A4_WIDTH_MM, A4_HEIGHT_MM } from '../lib/voucher'

interface GridOverlayProps {
  gridSizeMm: number
}

export function GridOverlay({ gridSizeMm }: GridOverlayProps) {
  const widthPx = mmToPx(A4_WIDTH_MM)
  const heightPx = mmToPx(A4_HEIGHT_MM)
  const stepPx = mmToPx(gridSizeMm)

  const lines: React.ReactNode[] = []

  // Vertical lines
  for (let x = stepPx; x < widthPx; x += stepPx) {
    lines.push(
      <line key={`v-${Math.round(x)}`} x1={x} y1={0} x2={x} y2={heightPx} stroke="#cbd5e1" strokeWidth={0.5} />,
    )
  }

  // Horizontal lines
  for (let y = stepPx; y < heightPx; y += stepPx) {
    lines.push(
      <line key={`h-${Math.round(y)}`} x1={0} y1={y} x2={widthPx} y2={y} stroke="#cbd5e1" strokeWidth={0.5} />,
    )
  }

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: widthPx,
        height: heightPx,
        pointerEvents: 'none',
        zIndex: 2,
      }}
    >
      {lines}
    </svg>
  )
}
