import { describe, expect, it } from 'vitest'
import { createEmptyProject } from './empty-project'
import { fitSectionHeights, validateLayout } from './voucher'
import { validateProject } from './validation'
import { getFieldInspectorTab } from './inspector'
import { getFitZoom } from '../hooks/use-canvas-zoom'

describe('workspace layout', () => {
  it('fits new documents inside A4, including page margins', () => {
    const project = createEmptyProject()
    expect(validateLayout(project.sections.map((s) => s.height) as [number, number, number], project.global.layout.margin).valid).toBe(true)
    expect(validateProject(project).filter((issue) => issue.severity === 'error')).toEqual([])
  })
  it('reports legacy overflow and fits it proportionally without rounding overflow', () => {
    const project = createEmptyProject()
    project.sections[1].height = 100
    expect(validateProject(project)).toContainEqual(expect.objectContaining({ severity: 'error', message: 'Sections exceed the A4 page by 3 mm' }))
    const heights = fitSectionHeights([90, 100, 90], 10)
    expect(heights.reduce((sum, h) => sum + h, 0)).toBeCloseTo(277)
    expect(heights[0] / heights[1]).toBeCloseTo(0.9, 2)
    expect(validateLayout(heights, 10).valid).toBe(true)
    expect(project.sections[1].height).toBe(100)
  })
  it('starts editing at fit width and offers a smaller full-page overview', () => {
    expect(getFitZoom(740, 580, 'width')).toBeGreaterThan(getFitZoom(740, 580, 'page'))
    expect(getFitZoom(740, 580, 'page')).toBeLessThanOrEqual(45)
    expect(getFitZoom(390, 700, 'width')).toBeLessThanOrEqual(43)
    expect(getFitZoom(2000, 1400, 'width')).toBe(100)
  })
  it('gives content, style, and dynamic fields one consistent home', () => {
    expect(getFieldInspectorTab('text', 'content')).toBe('content')
    expect(getFieldInspectorTab('level', 'settings')).toBe('content')
    expect(getFieldInspectorTab('fontSize', 'settings')).toBe('style')
    expect(getFieldInspectorTab('valueKey', 'content')).toBe('data')
    expect(getFieldInspectorTab('dynamicKey', 'settings')).toBe('data')
  })
})
