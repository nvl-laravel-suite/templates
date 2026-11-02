import type { ColumnBlock as ColumnBlockType } from '#/voucher-builder/schema'

// ColumnBlock is rendered by RowBlock — this is a passthrough for the registry
export function ColumnBlockRenderer({ block: _block }: { block: ColumnBlockType }) {
  return (
    <div className="p-4 text-sm text-muted-foreground">
      Column (rendered by parent Row)
    </div>
  )
}
