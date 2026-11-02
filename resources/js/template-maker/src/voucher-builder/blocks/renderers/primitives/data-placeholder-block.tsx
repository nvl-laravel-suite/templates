import type { DataPlaceholderBlock as DataPlaceholderBlockType } from '../../../schema'
import { ImageIcon } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { resolveTypography } from '../../primitives'

export function DataPlaceholderBlockRenderer({ block }: { block: DataPlaceholderBlockType }) {
  const { content, settings } = block
  const s = settings as Record<string, unknown>
  const textAlign = (s.alignment as string) || 'left'

  if (content.placeholderType === 'image') {
    const width = (s.width as number) || 120
    const height = (s.height as number) || 80

    return (
      <div style={{ textAlign: textAlign as React.CSSProperties['textAlign'] }}>
        <div
          className="inline-flex flex-col items-center justify-center gap-1 rounded border-2 border-dashed border-warning/50 bg-warning/10"
          style={{
            width: width || undefined,
            height: height || undefined,
            minWidth: 80,
            minHeight: 60,
          }}
        >
          <ImageIcon className="h-5 w-5 text-warning-accent" />
          <span className="text-warning-accent font-mono text-[10px]">{content.valueKey || '?'}</span>
          <span className="text-foreground/50 text-[10px]">{content.placeholderText}</span>
        </div>
      </div>
    )
  }

  const typo = resolveTypography({
    fontSize: s.fontSize as string,
    fontWeight: s.fontWeight as string,
  })

  return (
    <div style={{ textAlign: textAlign as React.CSSProperties['textAlign'] }}>
      <span
        className={cn('inline-block rounded border-2 border-dashed border-warning/50 bg-warning/10 px-2 py-0.5', ...typo.classes)}
        style={{
          ...typo.style,
          width: (s.width as number) || undefined,
          height: (s.height as number) || undefined,
        }}
      >
        <span className="text-warning-accent font-mono text-[10px] mr-1">{content.valueKey || '?'}</span>
        <span className="text-foreground/60">{content.placeholderText}</span>
      </span>
    </div>
  )
}
