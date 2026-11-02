import type { Project } from '#/voucher-builder/schema'

/**
 * Voucher export envelope.
 *
 * v2 (current): carries the full normalized Project snapshot. Lossless — round-trips
 * through `parseVoucherImport` without dropping rows, grids, tables, metadata,
 * preview data, or section appearance.
 *
 * v1 (legacy): denormalized shape with sections-own-blocks. Still readable on
 * import, but lossy for structural blocks. Kept only for backward compat.
 */
export interface VoucherExport {
  format: 'gct-voucher'
  version: 2
  page: { width: 210; height: 297; unit: 'mm' }
  project: Project
}

export function exportToJSON(project: Project): VoucherExport {
  return {
    format: 'gct-voucher',
    version: 2,
    page: { width: 210, height: 297, unit: 'mm' },
    project: structuredClone(project),
  }
}

// ── Legacy v1 types (still recognized on import) ──────────────────

export interface VoucherExportV1 {
  format: 'gct-voucher'
  version: 1
  page: { width: 210; height: 297; unit: 'mm' }
  margins: { top: number; bottom: number; left: number; right: number }
  frame: { imageUrl: string | null; opacity: number }
  global: {
    fonts: { heading: string; body: string }
    colors: Record<string, string>
    baseSize: number
  }
  sections: VoucherSectionExport[]
}

export interface VoucherSectionExport {
  id: string
  height: number
  padding: number
  backgroundColor?: string
  html?: string
  blocks?: ExportBlock[]
}

export interface ExportBlock {
  type: string
  content: Record<string, unknown>
  settings: Record<string, unknown>
  commonSettings: Record<string, unknown>
  children?: ExportBlock[]
}

export type JsonExportMode = 'html' | 'blocks'
