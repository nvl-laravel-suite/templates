import type { Project } from '../schema'
import { validateLayout } from './voucher'

export interface ValidationResult {
  severity: 'error' | 'warning' | 'info'
  message: string
  blockId?: string
  suggestion?: string
}

/**
 * Validate a voucher project and return actionable suggestions.
 */
export function validateProject(project: Project): ValidationResult[] {
  const results: ValidationResult[] = []
  const { blocks, sections, columnBlocks } = project

  const layout = validateLayout(sections.map((s) => s.height) as [number, number, number], project.global.layout.margin ?? 10)
  if (!layout.valid) {
    results.push({
      severity: 'error',
      message: `Sections exceed the A4 page by ${Number(layout.overflow.toFixed(2))} mm`,
      suggestion: 'Reduce section heights or page margins in Document settings. Exported content may be clipped.',
    })
  }

  // Collect all blocks (including children)
  const allBlockIds = new Set<string>()
  for (const section of sections) {
    for (const id of section.blockIds) {
      allBlockIds.add(id)
      const children = columnBlocks[id]
      if (children) {
        for (const childId of children) {
          allBlockIds.add(childId)
          // Check nested children (e.g., rows -> columns -> blocks)
          const grandchildren = columnBlocks[childId]
          if (grandchildren) {
            for (const gcId of grandchildren) allBlockIds.add(gcId)
          }
        }
      }
    }
  }

  // Check for empty sections
  for (const section of sections) {
    if (section.blockIds.length === 0) {
      results.push({
        severity: 'info',
        message: 'One or more voucher sections are empty',
        suggestion: 'Add blocks to fill all three sections of your voucher',
      })
      break
    }
  }

  // Check for empty heading/text blocks
  for (const id of allBlockIds) {
    const block = blocks[id]
    if (!block) continue

    // Empty sections
    if (block.type.endsWith('Section') || block.type === 'section') {
      const childIds = columnBlocks[id] || []
      if (childIds.length === 0) {
        results.push({
          severity: 'warning',
          message: `Empty section: "${(block.content as any).title || 'Untitled'}"`,
          blockId: id,
          suggestion: 'Add entries or remove this section',
        })
      }
    }

    // Empty heading/text blocks
    if (block.type === 'heading') {
      const text = (block.content as any).text || ''
      if (text === 'Heading' || !text) {
        results.push({
          severity: 'info',
          message: 'Default heading text',
          blockId: id,
          suggestion: 'Replace with your actual heading',
        })
      }
    }
  }

  return results
}

/**
 * Calculate a voucher completeness score (0-100).
 */
export function calculateScore(results: ValidationResult[]): number {
  let score = 100
  for (const r of results) {
    if (r.severity === 'error') score -= 15
    if (r.severity === 'warning') score -= 8
    if (r.severity === 'info') score -= 3
  }
  return Math.max(0, Math.min(100, score))
}
