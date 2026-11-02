import { cn } from '../../../lib/utils'
import type { TableBlock as TableBlockType } from '../../../schema'
import {
  FONT_WEIGHT_NUMERIC_MAP,
  resolveTypography,
} from '../../primitives'

interface TableSettings {
  variant: 'none' | 'horizontal' | 'full' | 'minimal'
  headerBackground?: string
  textColor?: string
  fontSize?: string
  fontWeight?: string
  headerFontWeight?: string
  compact?: boolean
  striped?: boolean
  showFooter?: boolean
}

function getBorderClasses(borderStyle: string, isHeader?: boolean) {
  switch (borderStyle) {
    case 'none': return ''
    case 'horizontal': return isHeader ? 'border-b-2' : 'border-b border-border'
    case 'full': return 'border border-border'
    case 'minimal': return isHeader ? 'border-b' : ''
    default: return isHeader ? 'border-b-2' : 'border-b border-border'
  }
}

export function TableBlockRenderer({ block }: { block: TableBlockType }) {
  const s = block.settings as TableSettings
  const borderStyle = s.variant || 'horizontal'
  const headerBg = s.headerBackground || 'var(--nc-surface, #f9fafb)'

  // Body typography via the shared resolver
  const bodyTypo = resolveTypography({
    fontSize: s.fontSize || 'sm',
    fontWeight: s.fontWeight || 'normal',
    textColor: s.textColor,
  })

  const headerFontWeight = FONT_WEIGHT_NUMERIC_MAP[s.headerFontWeight || 'semibold'] || 600

  return (
    <div className={cn('overflow-x-auto', ...bodyTypo.classes)} style={bodyTypo.style}>
      <table className={cn('w-full border-collapse', borderStyle === 'full' && 'border border-border')}>
        <thead>
          <tr
            className={getBorderClasses(borderStyle, true)}
            style={{
              borderColor: borderStyle === 'horizontal' ? 'var(--nc-accent, #3b82f6)' : undefined,
              backgroundColor: headerBg,
            }}
          >
            {block.content.headers.map((h, i) => (
              <th
                key={i}
                className={cn(
                  'px-3 py-2 text-left',
                  s.compact && 'px-2 py-1',
                  borderStyle === 'full' && 'border border-border',
                )}
                style={{ fontWeight: headerFontWeight }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(s.showFooter && block.content.rows.length > 0
            ? block.content.rows.slice(0, -1)
            : block.content.rows
          ).map((row, ri) => (
            <tr
              key={ri}
              className={cn(
                getBorderClasses(borderStyle),
                s.striped && ri % 2 === 1 && 'bg-muted/50',
              )}
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={cn(
                    'px-3 py-2',
                    s.compact && 'px-2 py-1',
                    borderStyle === 'full' && 'border border-border',
                  )}
                >
                  {cell || '\u00A0'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {s.showFooter && block.content.rows.length > 0 && (
          <tfoot>
            <tr className="border-t-2" style={{ borderColor: 'var(--nc-accent, #3b82f6)' }}>
              {block.content.rows[block.content.rows.length - 1].map((cell, ci) => (
                <td key={ci} className={cn('px-3 py-2 font-semibold', s.compact && 'px-2 py-1')}>
                  {cell || '\u00A0'}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
