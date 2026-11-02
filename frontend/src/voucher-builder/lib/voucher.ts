// src/lib/voucher.ts

/** A4 dimensions in mm */
export const A4_WIDTH_MM = 210
export const A4_HEIGHT_MM = 297

/** Conversion factor: 1mm = 3.7795275591px at 96dpi */
export const MM_TO_PX = 3.7795275591

/** Convert mm to px */
export function mmToPx(mm: number): number {
  return mm * MM_TO_PX
}

/** Convert px to mm */
export function pxToMm(px: number): number {
  return px / MM_TO_PX
}

/** Default section heights in mm */
export const DEFAULT_SECTION_HEIGHTS: [number, number, number] = [90, 97, 90]

/** Default uniform margin in mm */
export const DEFAULT_MARGIN = 10

/** Preserve section proportions while fitting inside the page, including both margins. */
export function fitSectionHeights(heights: [number, number, number], margin: number): [number, number, number] {
  const available = Math.max(0, A4_HEIGHT_MM - 2 * margin)
  const sum = heights.reduce((total, h) => total + h, 0)
  const first = Math.floor((sum ? heights[0] / sum : 1 / 3) * available * 100) / 100
  const second = Math.floor((sum ? heights[1] / sum : 1 / 3) * available * 100) / 100
  return [first, second, Number((available - first - second).toFixed(2))]
}

/** Validate that sections fit within A4 given a uniform margin */
export function validateLayout(
  sectionHeights: [number, number, number],
  margin: number
): { valid: boolean; overflow: number } {
  const availableHeight = A4_HEIGHT_MM - 2 * margin
  const totalSections = sectionHeights[0] + sectionHeights[1] + sectionHeights[2]
  return {
    valid: totalSections <= availableHeight + 0.001,
    overflow: Math.max(0, totalSections - availableHeight),
  }
}

/** Section IDs (stable) */
export const SECTION_IDS = ['section-1', 'section-2', 'section-3'] as const
export type VoucherSectionId = typeof SECTION_IDS[number]

/** Compute section Y positions in mm */
export function computeSectionPositions(
  sectionHeights: [number, number, number],
  margin: number
): [number, number, number] {
  const y1 = margin
  const y2 = y1 + sectionHeights[0]
  const y3 = y2 + sectionHeights[1]
  return [y1, y2, y3]
}
