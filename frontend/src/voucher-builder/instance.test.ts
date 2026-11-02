import { afterEach, describe, expect, it, vi } from 'vitest'
import { createVoucherBuilder, getInstanceInternals } from './instance'

describe('local voucher editors', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('isolates documents, selection, history, clipboard, and events', () => {
    const a = createVoucherBuilder()
    const b = createVoucherBuilder()
    const eventA = vi.fn()
    const eventB = vi.fn()
    a.subscribeAction(eventA)
    b.subscribeAction(eventB)
    a.actions.addBlock(a.getProject().sections[0].id, 'heading')
    expect(Object.keys(a.getProject().blocks)).toHaveLength(1)
    expect(Object.keys(b.getProject().blocks)).toHaveLength(0)
    expect(eventA).toHaveBeenCalled()
    expect(eventB).not.toHaveBeenCalled()
    b.actions.undo()
    expect(Object.keys(a.getProject().blocks)).toHaveLength(1)
    a.actions.undo()
    expect(Object.keys(a.getProject().blocks)).toHaveLength(0)
    a.destroy()
    b.destroy()
  })
  it('records grouped edits as one undo step and rolls back failed transactions', () => {
    const builder = createVoucherBuilder()
    const original = builder.getProject()
    const changes = vi.fn()
    builder.subscribe(changes)
    builder.actions.transaction((actions) => {
      actions.addBlock(original.sections[0].id, 'heading')
      actions.updateMetadata({ title: 'Updated' })
    })
    expect(changes).toHaveBeenCalledTimes(1)
    builder.actions.undo()
    expect(builder.getProject()).toEqual(original)
    expect(() =>
      builder.actions.transaction((actions) => {
        actions.updateMetadata({ title: 'Broken' })
        throw new Error('Abort')
      }),
    ).toThrow('Abort')
    expect(builder.getProject()).toEqual(original)
    builder.destroy()
  })

  it('reports callback failures without turning a successful export into a failed operation', async () => {
    const onError = vi.fn()
    const builder = createVoucherBuilder({
      onError,
      onExportComplete: () => {
        throw new Error('Observer failed')
      },
    })
    const result = await builder.exportProject({ format: 'json' })
    expect(result.format).toBe('json')
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ operation: 'callback' }))
    builder.destroy()
  })
  it('does not allow a snapshot consumer to mutate the document', () => {
    const builder = createVoucherBuilder()
    builder.getProject().global.metadata.title = 'Outside mutation'
    expect(builder.getProject().global.metadata.title).toBe('Untitled Voucher')
    builder.destroy()
  })
  it('isolates action inputs and observer payloads, including failing async observers', async () => {
    const onError = vi.fn()
    const builder = createVoucherBuilder({ onError })
    const patch = { keywords: ['original'] }
    builder.actions.updateMetadata(patch)
    patch.keywords.push('outside mutation')
    expect(builder.getProject().global.metadata.keywords).toEqual(['original'])
    builder.subscribeAction((event) => {
      if (event.type === 'project.load') event.project.global.metadata.title = 'observer mutation'
    })
    const observer = vi.fn()
    builder.subscribeAction(observer)
    builder.subscribeAction(async () => {
      throw new Error('async observer')
    })
    const project = builder.getProject()
    project.global.metadata.title = 'host document'
    builder.actions.loadProject(project)
    expect(builder.getProject().global.metadata.title).toBe('host document')
    expect(observer).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'project.load',
        project: expect.objectContaining({
          global: expect.objectContaining({ metadata: expect.objectContaining({ title: 'host document' }) }),
        }),
      }),
    )
    await Promise.resolve()
    await Promise.resolve()
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ operation: 'callback' }))
    builder.destroy()
  })

  it('imports atomically with Undo and rejects invalid input without editing', () => {
    const onError = vi.fn()
    const builder = createVoucherBuilder({ onError })
    const original = builder.getProject()
    const imported = builder.getProject()
    imported.global.metadata.title = 'Imported'
    expect(builder.importProject(imported).project).toBeTruthy()
    builder.actions.undo()
    expect(builder.getProject()).toEqual(original)
    expect(builder.importProject({ unexpected: true }).project).toBeFalsy()
    expect(builder.getProject()).toEqual(original)
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ operation: 'import' }))
    builder.destroy()
  })
  it('makes container edits observable and safely resizes nested layout trees', () => {
    const builder = createVoucherBuilder()
    const sectionId = builder.getProject().sections[0].id
    builder.actions.addBlock(sectionId, 'row')
    const rowId = builder.getProject().sections[0].blockIds[0]
    const row = builder.getProject().blocks[rowId]
    if (row.type !== 'row') throw new Error('Expected row')
    const [first, second] = row.content.columnIds
    const observer = vi.fn()
    builder.subscribeAction(observer)
    builder.actions.addBlockToColumn(second, 'row')
    expect(observer).toHaveBeenCalledWith(expect.objectContaining({ type: 'block.add' }))
    expect(observer).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'container.update', containerId: second }),
    )
    const original = builder.getProject()
    builder.actions.moveBlockToColumn(rowId, sectionId, first, 0)
    expect(builder.getProject()).toEqual(original)
    builder.actions.resizeRow(rowId, 1)
    expect(Object.keys(builder.getProject().blocks)).toHaveLength(2)
    builder.actions.undo()
    expect(builder.getProject()).toEqual(original)
    builder.destroy()
  })
  it('ignores invalid/no-op edits without emitting document actions or consuming Undo', () => {
    const builder = createVoucherBuilder()
    const observer = vi.fn()
    builder.subscribeAction(observer)
    builder.actions.addBlock('missing-section', 'heading')
    builder.actions.updateBlock('missing-block', { content: {} })
    builder.actions.updateMetadata({ title: builder.getProject().global.metadata.title })
    expect(observer).not.toHaveBeenCalled()
    expect(getInstanceInternals(builder).runtime.editor.getState().undoStack).toHaveLength(0)
    builder.destroy()
  })
  it('keeps user templates scoped and reports their CRUD callbacks exactly once', () => {
    const onTemplateAdd = vi.fn()
    const onTemplateUpdate = vi.fn()
    const onTemplateDelete = vi.fn()
    const builder = createVoucherBuilder({ onTemplateAdd, onTemplateUpdate, onTemplateDelete })
    const other = createVoucherBuilder()
    builder.actions.updateMetadata({ title: 'Template document' })
    const template = builder.templates.add({ name: 'Personal' })
    expect(other.templates.list().some((t) => t.id === template.id)).toBe(false)
    builder.templates.update(template.id, { name: 'Renamed' })
    builder.templates.load(template.id)
    builder.templates.remove(template.id)
    expect(onTemplateAdd).toHaveBeenCalledTimes(1)
    const imported = other.templates.importJSON(builder.templates.exportJSON())
    expect(imported.errors).toEqual([])
    expect(onTemplateUpdate).toHaveBeenCalledTimes(1)
    expect(onTemplateDelete).toHaveBeenCalledTimes(1)
    builder.destroy()
    other.destroy()
  })

  it('rejects malformed templates before mutation and clears the error after a corrected import', () => {
    const onError = vi.fn()
    const builder = createVoucherBuilder({ onError })
    const before = builder.templates.list()
    const result = builder.templates.importJSON(
      '{"templates":[{"id":"bad","name":"Bad","mode":"full","project":{}}]}',
    )
    expect(result.errors).toHaveLength(1)
    expect(builder.templates.list()).toEqual(before)
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ operation: 'templates' }))
    expect(getInstanceInternals(builder).templateLibrary.store.getState().error).not.toBeNull()
    const recovered = builder.templates.importJSON(JSON.stringify({ templates: [{
      id: 'recovered', name: 'Recovered template', mode: 'full', project: builder.getProject(),
    }] }))
    expect(recovered).toEqual({ imported: 1, skipped: 0, errors: [] })
    expect(getInstanceInternals(builder).templateLibrary.store.getState().error).toBeNull()
    expect(builder.templates.list().some(template => template.id === 'recovered')).toBe(true)
    expect(onError).toHaveBeenCalledTimes(1)
    builder.destroy()
  })

  it('rejects async results in nested transactions without leaking a rejected promise', async () => {
    const builder = createVoucherBuilder()
    const before = builder.getProject()
    expect(() =>
      builder.actions.transaction((commands) => {
        commands.updateMetadata({ title: 'Outer edit' })
        commands.transaction((nested) => {
          nested.updateFrame({ opacity: 0.3 })
          return Promise.reject(new Error('Async failure'))
        })
      }),
    ).toThrow('Transactions must be synchronous')
    await Promise.resolve()
    expect(builder.getProject()).toEqual(before)
    builder.destroy()
  })
  it('accepts host data and generates isolated synchronous HTML and JSON results without I/O', () => {
    const fetcher = vi.fn(() => { throw new Error('Unexpected transport') })
    const storage = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() }
    vi.stubGlobal('fetch', fetcher)
    vi.stubGlobal('localStorage', storage)
    const completed = vi.fn()
    const builder = createVoucherBuilder({ onExportComplete: completed })
    const supplied = builder.getProject()
    supplied.global.metadata.title = 'Host document'
    builder.actions.loadProject(supplied)
    supplied.global.metadata.title = 'Outside edit'
    const template = builder.templates.add({ name: 'Reusable' })
    const other = createVoucherBuilder({ config: { templates: [template] } })
    other.templates.load(template.id)
    expect(other.getProject().global.metadata.title).toBe('Host document')
    const html = builder.exportProject({ format: 'html', filename: 'document' })
    const json = builder.exportProject({ format: 'json', filename: 'document.json' })
    expect(html).toMatchObject({ format: 'html', filename: 'document.html', mimeType: 'text/html' })
    expect(html.data).toContain('<!DOCTYPE html>')
    expect(JSON.parse(json.data)).toBeTruthy()
    expect(completed).toHaveBeenCalledTimes(2)
    expect(fetcher).not.toHaveBeenCalled()
    expect(storage.getItem).not.toHaveBeenCalled()
    expect(storage.setItem).not.toHaveBeenCalled()
    expect('save' in builder).toBe(false)
    expect('getSaveState' in builder).toBe(false)
    builder.destroy(); other.destroy()
  })
  it('atomically replaces preloaded templates and isolates reusable snippets between editors', () => {
    const builder = createVoucherBuilder({ onError: vi.fn() })
    const other = createVoucherBuilder()
    const project = builder.getProject()
    const hostTemplate = { id: 'host', name: 'Host design', description: '', mode: 'full' as const, source: 'host' as const, project }
    builder.templates.replace([hostTemplate])
    hostTemplate.name = 'Outside mutation'
    expect(builder.templates.list().find(item => item.id === 'host')?.name).toBe('Host design')
    expect(other.templates.list().some(item => item.id === 'host')).toBe(false)
    const before = builder.templates.list()
    expect(() => builder.templates.replace([{ ...hostTemplate, project: {} as typeof project }])).toThrow()
    expect(builder.templates.list()).toEqual(before)
    builder.actions.addBlock(project.sections[0].id, 'heading')
    const id = builder.getProject().sections[0].blockIds[0]
    getInstanceInternals(builder).snippetStore.getState().saveSnippetFromBlock(id)
    expect(getInstanceInternals(builder).snippetStore.getState().snippets).toHaveLength(1)
    expect(getInstanceInternals(other).snippetStore.getState().snippets).toHaveLength(0)
    builder.templates.replace([])
    expect(builder.templates.list().some(item => item.id === 'host')).toBe(false)
    builder.destroy(); other.destroy()
  })
  it('stops local commands and notifications after destroy', () => {
    const onAction = vi.fn()
    const onChange = vi.fn()
    const builder = createVoucherBuilder({ onAction, onChange })
    const observer = vi.fn()
    builder.subscribeAction(observer)
    builder.actions.updateMetadata({ title: 'Before disposal' })
    builder.destroy()
    onAction.mockClear(); observer.mockClear()
    expect(() => builder.actions.updateMetadata({ title: 'Invalid' })).toThrow('destroyed')
    expect(onAction).not.toHaveBeenCalled()
    expect(observer).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })

})
