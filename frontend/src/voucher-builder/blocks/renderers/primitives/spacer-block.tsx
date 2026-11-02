import type { SpacerBlock as SpacerBlockType } from '#/voucher-builder/schema'

export function SpacerBlockRenderer({ block }: { block: SpacerBlockType }) {
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ height: block.settings.height }}
    >
      {block.settings.showLine && (
        <hr className="w-full border-t border-muted-foreground/20" />
      )}
      <span className="absolute text-[10px] text-muted-foreground/40 bg-background px-2 print:hidden">
        {block.settings.height}px
      </span>
    </div>
  )
}
