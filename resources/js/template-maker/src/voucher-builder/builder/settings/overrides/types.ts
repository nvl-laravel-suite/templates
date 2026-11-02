import type { Block } from '../../../schema'

export interface BlockOverrideProps {
  block: any
  update: (updates: Partial<Block>) => void
}
