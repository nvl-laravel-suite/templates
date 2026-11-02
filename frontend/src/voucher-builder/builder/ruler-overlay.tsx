import { mmToPx, A4_WIDTH_MM, A4_HEIGHT_MM } from '#/voucher-builder/lib/voucher'

const RULER_SIZE = 20
const TICK_COLOR = 'var(--border)'
const LABEL_COLOR = 'var(--muted-foreground)'
const LABEL_FONT_SIZE = 7
const BG_COLOR = 'var(--muted)'

/**
 * Rulers rendered OUTSIDE the canvas — wraps the canvas with
 * a top ruler bar and a left ruler bar.
 */
export function RulerWrapper({ children }: { children: React.ReactNode }) {
  const canvasWidthPx = mmToPx(A4_WIDTH_MM)
  const canvasHeightPx = mmToPx(A4_HEIGHT_MM)

  const topTicks: React.ReactNode[] = []
  for (let mm = 0; mm <= A4_WIDTH_MM; mm++) {
    const x = mmToPx(mm)
    const isMajor = mm % 10 === 0
    const tickH = isMajor ? 8 : 4
    topTicks.push(
      <line
        key={`t-${mm}`}
        x1={x}
        y1={RULER_SIZE - tickH}
        x2={x}
        y2={RULER_SIZE}
        stroke={TICK_COLOR}
        strokeWidth={0.5}
      />,
    )
    if (isMajor && mm > 0) {
      topTicks.push(
        <text
          key={`tl-${mm}`}
          x={x + 2}
          y={RULER_SIZE - 10}
          fontSize={LABEL_FONT_SIZE}
          fill={LABEL_COLOR}
          fontFamily="var(--font-sans)"
        >
          {mm}
        </text>,
      )
    }
  }

  const leftTicks: React.ReactNode[] = []
  for (let mm = 0; mm <= A4_HEIGHT_MM; mm++) {
    const y = mmToPx(mm)
    const isMajor = mm % 10 === 0
    const tickW = isMajor ? 8 : 4
    leftTicks.push(
      <line
        key={`l-${mm}`}
        x1={RULER_SIZE - tickW}
        y1={y}
        x2={RULER_SIZE}
        y2={y}
        stroke={TICK_COLOR}
        strokeWidth={0.5}
      />,
    )
    if (isMajor && mm > 0) {
      leftTicks.push(
        <text
          key={`ll-${mm}`}
          x={2}
          y={y - 2}
          fontSize={LABEL_FONT_SIZE}
          fill={LABEL_COLOR}
          fontFamily="var(--font-sans)"
          transform={`rotate(-90, 2, ${y - 2})`}
        >
          {mm}
        </text>,
      )
    }
  }

  return (
    <div className="inline-flex flex-col items-start">
      {/* Top ruler row: corner + ruler */}
      <div className="flex">
        <div
          style={{
            width: RULER_SIZE,
            height: RULER_SIZE,
            background: BG_COLOR,
            borderRight: '1px solid var(--border)',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        />
        <svg
          width={canvasWidthPx}
          height={RULER_SIZE}
          style={{ display: 'block', flexShrink: 0, borderBottom: '1px solid var(--border)' }}
        >
          <rect width={canvasWidthPx} height={RULER_SIZE} fill={BG_COLOR} />
          {topTicks}
        </svg>
      </div>
      {/* Content row: left ruler + canvas */}
      <div className="flex items-start">
        <div
          style={{
            width: RULER_SIZE,
            height: canvasHeightPx,
            flexShrink: 0,
            borderRight: '1px solid var(--border)',
            overflow: 'visible',
          }}
        >
          <svg width={RULER_SIZE} height={canvasHeightPx} style={{ display: 'block' }}>
            <rect width={RULER_SIZE} height={canvasHeightPx} fill={BG_COLOR} />
            {leftTicks}
          </svg>
        </div>
        {children}
      </div>
    </div>
  )
}
