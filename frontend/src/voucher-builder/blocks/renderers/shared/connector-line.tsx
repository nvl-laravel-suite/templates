interface ConnectorLineProps {
  color: string
  style?: 'solid' | 'dashed'
  dotSize?: string
}

export function ConnectorLine({ color, style = 'solid', dotSize = 'h-2.5 w-2.5' }: ConnectorLineProps) {
  const resolvedColor = color || 'var(--nc-border, #e5e7eb)'

  return (
    <div className="flex flex-col items-center pt-1">
      <div
        className={`${dotSize} shrink-0 rounded-full`}
        style={{ backgroundColor: resolvedColor }}
      />
      <div
        className="w-px flex-1 min-h-[20px]"
        style={
          style === 'dashed'
            ? { borderLeft: `1px dashed ${resolvedColor}`, background: 'none' }
            : { backgroundColor: resolvedColor }
        }
      />
    </div>
  )
}
