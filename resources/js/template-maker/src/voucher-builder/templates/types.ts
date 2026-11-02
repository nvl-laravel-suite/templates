import type { Project, GlobalSettings, Frame, BlockType, CommonBlockSettings } from '../schema'

export interface VoucherTemplate {
  id: string
  name: string
  description: string
  icon?: string
  category?: string
  thumbnail?: string
  mode: 'full' | 'partial'
  source: 'builtin' | 'host' | 'user'
  /** ISO timestamp of the latest local template edit. */
  updatedAt?: string
  project?: Project
  partial?: PartialTemplate
}

export interface PartialTemplate {
  global?: Partial<GlobalSettings>
  frame?: Partial<Frame>
  sections?: PartialTemplateSection[]
}

export interface PartialTemplateSection {
  index: 0 | 1 | 2
  height?: number
  backgroundColor?: string
  backgroundOpacity?: number
  widthMode?: 'wide' | 'narrow' | 'tight'
  verticalAlign?: 'center' | 'start' | 'end'
  blocks: PartialTemplateBlock[]
}

export interface PartialTemplateBlock {
  type: BlockType
  content?: Record<string, unknown>
  settings?: Record<string, unknown>
  commonSettings?: Partial<CommonBlockSettings>
  children?: PartialTemplateBlock[]
}
