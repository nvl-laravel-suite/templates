import { afterEach, describe, expect, it, vi } from 'vitest'
import { createVoucherBuilder } from '../instance'
import { parseBuilderConfig } from '../config-schema'

afterEach(() => vi.unstubAllGlobals())

describe('frontend-only component boundary', () => {
  it('rejects removed endpoint and storage configuration', () => {
    for (const key of ['apiTemplateEndpoint', 'localTemplatePath', 'pdfExportEndpoint', 'templatesUrl', 'templateStorageKey']) {
      expect(() => parseBuilderConfig({ [key]: '/host-owned' })).toThrow()
    }
  })
  it('rejects unsupported remote/PDF export requests without invoking transport', () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    const onError = vi.fn()
    const editor = createVoucherBuilder({ onError })
    // @ts-expect-error Only locally generated HTML and JSON are component outputs.
    expect(() => editor.exportProject({ format: 'pdf' })).toThrow('Supported export formats')
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ operation: 'export' }))
    expect(fetcher).not.toHaveBeenCalled()
    expect(editor.exportProject({ format: 'html' }).data).toContain('<!DOCTYPE html>')
    editor.destroy()
  })
})
