import { memo } from 'react'
import type { Block } from '../../schema'
import { getBlockDef } from '..'
import { BlockErrorBoundary } from './block-error-boundary'
// Ensure all definitions are registered
import '../definitions'

export const BlockRenderer = memo(function BlockRenderer({ block }: { block: Block }) {
  const def = getBlockDef(block.type)

  if (def?.render) {
    const Comp = def.render
    return (
      <BlockErrorBoundary blockType={def.name || block.type}>
        <Comp block={block} />
      </BlockErrorBoundary>
    )
  }

  return <div className="p-4 text-sm text-muted-foreground">Unknown block type</div>
})
