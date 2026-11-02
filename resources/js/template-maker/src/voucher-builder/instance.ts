import { createStore } from 'zustand/vanilla'
import type { Project } from './schema'
import type { ComposerActions, EditorStoreState } from './store/types'
import { createEmptyProject } from './lib/empty-project'
import { createInitialEditorState } from './store/editor'
import { createActionBus, type BuilderActionEvent, type BuilderEventHandler } from './store/events'
import { createDocumentRuntime, type DocumentRuntime } from './store/runtime'
import { createComposerActions } from './store/actions'
import { parseVoucherImport, type ImportResult } from './export/import'
import { exportToHTML, type ExportToHTMLOptions } from './export/html'
import { exportToJSON } from './export/json'
import type { VoucherBuilderCallbacks, VoucherBuilderConfig } from './types'
import {
  VoucherBuilderError,
  type CreateVoucherBuilderOptions,
  type VoucherActions,
  type VoucherExportOptions,
  type VoucherExportResult,
  type VoucherTemplateActions,
} from './api-types'
import { createTemplateLibrary, type VoucherTemplateLibrary } from './templates/library'
import { localizeProjectDefaults } from './i18n/core'
import { parseBuilderConfig } from './config-schema'
import { createSnippetStore } from './store/snippets'
import './blocks/definitions'

export interface VoucherBuilderInstance {
  readonly actions: VoucherActions
  readonly templates: VoucherTemplateActions
  /** An isolated snapshot; callers cannot mutate the live document through it. */
  getProject: () => Project
  subscribe: (listener: (project: Project) => void) => () => void
  subscribeAction: (listener: BuilderEventHandler) => () => void
  exportProject: (options: VoucherExportOptions) => VoucherExportResult
  exportHTML: (options?: ExportToHTMLOptions) => string
  exportJSON: () => string
  importProject: (input: unknown) => ImportResult
  /** Release callbacks, subscriptions, and timers when an externally created editor is discarded. */
  destroy: () => void
}

interface InstanceInternals {
  runtime: DocumentRuntime
  liveActions: ComposerActions
  configure: (
    options: Pick<CreateVoucherBuilderOptions, keyof VoucherBuilderCallbacks | 'config' | 'changeDebounceMs'>,
  ) => void
  disconnect: () => void
  report: (error: VoucherBuilderError) => void
  notifyExport: (result: VoucherExportResult) => void
  snippetStore: ReturnType<typeof createSnippetStore>
  templateLibrary: VoucherTemplateLibrary
  getOptions: () => Pick<
    CreateVoucherBuilderOptions,
    keyof VoucherBuilderCallbacks | 'config' | 'changeDebounceMs'
  >
  notify: (callback: ((...args: never[]) => unknown) | undefined, ...args: unknown[]) => void
}
const internals = new WeakMap<VoucherBuilderInstance, InstanceInternals>()
export function getInstanceInternals(instance: VoucherBuilderInstance): InstanceInternals {
  const value = internals.get(instance)
  if (!value) throw new Error('Invalid voucher builder instance. Use createVoucherBuilder().')
  return value
}

function readProject(input: unknown): Project {
  const result = parseVoucherImport(input, { strict: true })
  if (!result.project)
    throw new VoucherBuilderError('import', result.errors.join('; ') || 'Invalid voucher project')
  return structuredClone(result.project)
}

/** Local editor state for one document: history, selection, clipboard, and observers. */
export function createVoucherBuilder(options: CreateVoucherBuilderOptions = {}): VoucherBuilderInstance {
  let callbacks: VoucherBuilderCallbacks = options
  let config: VoucherBuilderConfig = parseBuilderConfig(options.config ?? {})
  let debounceMs = Math.max(0, options.changeDebounceMs ?? 100)
  let disposed = false
  let changeTimer: ReturnType<typeof setTimeout> | undefined
  const assertActive = () => {
    if (disposed) throw new Error('This voucher builder instance has been destroyed.')
  }
  const report = (error: VoucherBuilderError) => {
    if (disposed) return
    try {
      if (callbacks.onError) {
        const result: unknown = callbacks.onError(error)
        if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
          void Promise.resolve(result).catch((cause) =>
            console.error('[voucher-builder] onError failed:', cause),
          )
        }
      } else console.error('[voucher-builder]', error)
    } catch (observerError) {
      console.error('[voucher-builder] onError failed:', observerError)
    }
  }
  const notify = (callback: ((...args: never[]) => unknown) | undefined, ...args: unknown[]) => {
    if (!callback || disposed) return
    try {
      const result = callback(...(args as never[]))
      if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
        void Promise.resolve(result).catch((cause) =>
          report(new VoucherBuilderError('callback', 'A builder callback failed', cause)),
        )
      }
    } catch (cause) {
      report(new VoucherBuilderError('callback', 'A builder callback failed', cause))
    }
  }
  const initial = options.initialProject ? readProject(options.initialProject) : createEmptyProject()
  const document = createStore<Project>(() => initial)
  const editor = createStore<EditorStoreState>(() => ({
    ...createInitialEditorState(),
    activeSectionId: initial.sections[0].id,
  }))
  const actionBus = createActionBus((cause) =>
    report(new VoucherBuilderError('callback', 'An action subscriber failed', cause)),
  )
  let depth = 0
  let pendingEvents: BuilderActionEvent[] = []
  const events = {
    subscribe: actionBus.subscribe,
    emit(event: BuilderActionEvent) {
      if (disposed) return
      if (depth) pendingEvents.push(event)
      else actionBus.emit(event)
    },
  }
  const runtime = createDocumentRuntime(document, editor, events)
  const raw = createComposerActions(runtime)
  let fingerprint = JSON.stringify(initial)
  const listeners = new Set<(project: Project) => void>()
  const getProject = () => structuredClone(document.getState())
  const templateLibrary = createTemplateLibrary(
    config,
    (kind, template) => {
      events.emit({ type: `template.${kind}`, templateId: template.id, templateName: template.name })
      notify(
        kind === 'add'
          ? callbacks.onTemplateAdd
          : kind === 'update'
            ? callbacks.onTemplateUpdate
            : callbacks.onTemplateDelete,
        structuredClone(template),
      )
    },
    report,
  )
  const publish = () => {
    const next = JSON.stringify(document.getState())
    if (next === fingerprint) return
    fingerprint = next
    for (const listener of [...listeners]) notify(listener, getProject())
    clearTimeout(changeTimer)
    if (callbacks.onChange)
      changeTimer = setTimeout(() => notify(callbacks.onChange, getProject()), debounceMs)
  }
  const unsubscribeDocument = document.subscribe(() => {
    if (!depth) publish()
  })
  const unsubscribeEditor = editor.subscribe((state, previous) => {
    if (
      state.activeBlockId === previous.activeBlockId &&
      state.activeSectionId === previous.activeSectionId &&
      state.activeBlockIds.join('\0') === previous.activeBlockIds.join('\0')
    )
      return
    events.emit({
      type: 'selection.change',
      activeBlockId: state.activeBlockId,
      activeBlockIds: [...state.activeBlockIds],
      activeSectionId: state.activeSectionId,
    })
  })
  const unsubscribeActions = actionBus.subscribe((event) => {
    const selection =
      event.type === 'selection.change'
        ? {
            activeBlockId: event.activeBlockId,
            activeBlockIds: [...event.activeBlockIds],
            activeSectionId: event.activeSectionId ?? null,
          }
        : null
    notify(callbacks.onAction, event)
    if (selection) notify(callbacks.onSelectionChange, selection)
  })
  const batch = <T>(edit: () => T): T => {
    assertActive()
    depth++
    try {
      return edit()
    } finally {
      depth--
      if (!depth) {
        publish()
        const queued = pendingEvents
        pendingEvents = []
        queued.forEach((event) => actionBus.emit(event))
      }
    }
  }
  const liveActions = Object.fromEntries(
    Object.entries(raw).map(([name, action]) => [
      name,
      (...args: unknown[]) => batch(() => (action as (...args: unknown[]) => unknown)(...args)),
    ]),
  ) as unknown as ComposerActions
  const transient = new Set([
    'getProject',
    'pushHistory',
    'undo',
    'redo',
    'resetProject',
    'loadProject',
    'setActiveBlock',
    'setActiveBlocks',
    'clearActiveSelection',
    'setFocusedBlocks',
    'clearFocusedBlocks',
    'setActiveSectionId',
    'copyBlock',
    'copyBlocks',
    'setShowRulers',
    'setShowGrid',
    'setGridSize',
    'setSnapToGrid',
    'setDebugMode',
    'setShowPreviewData',
    'setZoomLevel',
    'setZoomMode',
  ])
  const actions = Object.fromEntries(
    Object.entries(liveActions).map(([name, action]) => [
      name,
      (...args: unknown[]) => {
        const run = () => (action as (...values: unknown[]) => unknown)(...structuredClone(args))
        return transient.has(name) ? run() : actions.transaction(run)
      },
    ]),
  ) as unknown as VoucherActions
  actions.getProject = getProject
  liveActions.getProject = getProject
  let transactionDepth = 0
  actions.transaction = <T>(edit: (commands: VoucherActions) => T): T =>
    batch(() => {
      const apply = () => {
        const result = edit(actions)
        if (result && typeof (result as unknown as PromiseLike<unknown>).then === 'function') {
          void Promise.resolve(result).catch(() => {})
          throw new Error(
            'Transactions must be synchronous. Await external work before editing the document.',
          )
        }
        return result
      }
      if (transactionDepth) return apply()
      const before = getProject()
      const beforeEditor = editor.getState()
      const eventCount = pendingEvents.length
      transactionDepth++
      try {
        const result = runtime.withoutHistory(apply)
        if (JSON.stringify(document.getState()) !== JSON.stringify(before)) {
          const alreadyRecorded = JSON.stringify(beforeEditor.undoStack.at(-1)) === JSON.stringify(before)
          editor.setState({
            undoStack: alreadyRecorded
              ? beforeEditor.undoStack
              : [...beforeEditor.undoStack, before].slice(-50),
            redoStack: [],
          })
        } else {
          const retained = pendingEvents
            .slice(eventCount)
            .filter(
              (event) =>
                !event.type.startsWith('block.') &&
                !['global.update', 'frame.update', 'section.update', 'container.update'].includes(event.type),
            )
          pendingEvents.splice(eventCount, pendingEvents.length - eventCount, ...retained)
        }
        return result
      } catch (error) {
        document.setState(before, true)
        editor.setState(beforeEditor, true)
        pendingEvents.splice(eventCount)
        throw error
      } finally {
        transactionDepth--
      }
    })
  actions.loadProject = (project, loadOptions) =>
    batch(() => {
      const parsed = readProject(project)
      const load = () =>
        raw.loadProject(parsed, {
          ...loadOptions,
          preserveHistory: loadOptions?.history === 'record' || loadOptions?.preserveHistory,
        })
      if (loadOptions?.history === 'record') actions.transaction(load)
      else load()
    })
  liveActions.loadProject = actions.loadProject
  const notifyExport = (result: VoucherExportResult) => {
    events.emit({ type: 'export.complete', result })
    notify(callbacks.onExportComplete, { ...result })
    if (result.data !== undefined) notify(callbacks.onExport, result.format, result.data)
  }
  const exportHTML = (renderOptions?: ExportToHTMLOptions) => {
    assertActive()
    const data = exportToHTML(getProject(), renderOptions)
    notifyExport({ format: 'html', data, filename: 'voucher.html', mimeType: 'text/html' })
    return data
  }
  const exportJSON = () => {
    assertActive()
    const data = JSON.stringify(exportToJSON(getProject()), null, 2)
    notifyExport({ format: 'json', data, filename: 'voucher.json', mimeType: 'application/json' })
    return data
  }
  const exportProject = (exportOptions: VoucherExportOptions): VoucherExportResult => {
    assertActive()
    try {
      if (!['html', 'json'].includes(exportOptions.format)) throw new Error('Supported export formats are html and json')
      const project = getProject()
      const baseFilename = exportOptions.filename?.trim() || project.global.metadata.title || 'voucher'
      const filename = baseFilename.endsWith(`.${exportOptions.format}`)
        ? baseFilename : `${baseFilename}.${exportOptions.format}`
      const result: VoucherExportResult = exportOptions.format === 'json'
        ? { format: 'json', data: JSON.stringify(exportToJSON(project), null, 2), filename, mimeType: 'application/json' }
        : { format: 'html', data: exportToHTML(project, exportOptions), filename, mimeType: 'text/html' }
      notifyExport(result)
      return result
    } catch (cause) {
      const error = new VoucherBuilderError('export', cause instanceof Error ? cause.message : String(cause), cause)
      events.emit({ type: 'export.error', error })
      report(error)
      throw error
    }
  }
  const disconnect = () => {
    callbacks = {}
    clearTimeout(changeTimer)
  }
  const instance: VoucherBuilderInstance = {
    templates: {
      list: () => structuredClone(templateLibrary.store.getState().templates),
      replace: (templates) => {
        assertActive()
        templateLibrary.replace(templates)
      },
      load(value) {
        assertActive()
        const { project, template } = templateLibrary.load(value)
        const localized = localizeProjectDefaults(project, document.getState().global.metadata.language)
        actions.loadProject(localized, { history: 'record' })
        events.emit({ type: 'template.load', templateId: template.id, templateName: template.name })
        return getProject()
      },
      add: (input) => {
        assertActive()
        return templateLibrary.add({ ...input, project: input.project ?? getProject() })
      },
      update: (id, patch) => {
        assertActive()
        return templateLibrary.update(id, patch)
      },
      remove: (id) => {
        assertActive()
        return templateLibrary.remove(id)
      },
      exportJSON: templateLibrary.exportJSON,
      importJSON: (input) => {
        assertActive()
        return templateLibrary.importJSON(input)
      },
    },
    actions,
    getProject,
    exportProject,
    exportHTML,
    exportJSON,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    subscribeAction: events.subscribe,
    importProject(input) {
      assertActive()
      const result = parseVoucherImport(input, { strict: true })
      if (result.project) actions.loadProject(result.project, { history: 'record' })
      else report(new VoucherBuilderError('import', result.errors.join('; ')))
      return result
    },
    destroy() {
      disconnect()
      disposed = true
      listeners.clear()
      actionBus.clear()
      pendingEvents = []
      unsubscribeDocument()
      unsubscribeEditor()
      unsubscribeActions()
    },
  }
  internals.set(instance, {
    runtime,
    liveActions,
    notifyExport,
    disconnect,
    snippetStore: createSnippetStore(runtime),
    templateLibrary,
    notify,
    report,
    getOptions: () => ({ ...callbacks, config, changeDebounceMs: debounceMs }),
    configure(next) {
      callbacks = next
      const nextConfig = parseBuilderConfig(next.config ?? {})
      if (JSON.stringify(nextConfig) !== JSON.stringify(config)) templateLibrary.configure(nextConfig)
      config = nextConfig
      debounceMs = Math.max(0, next.changeDebounceMs ?? 100)
      if (!callbacks.onChange) clearTimeout(changeTimer)
    },
  })
  return instance
}
