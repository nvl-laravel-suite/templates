import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type { Block, Project } from '../schema'
import { getInstanceInternals } from '../instance'
import { useVoucherInstance } from '../editor-context'
import type { BuilderActionEvent, BuilderActionType } from '../store/events'
import type { VoucherActions, VoucherSelectionSnapshot, VoucherBlockPatch } from '../api-types'

const selectProject = (project: Project) => project
const useCommitEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

function useLatest<T>(value: T) {
  const ref = useRef(value)
  useCommitEffect(() => { ref.current = value }, [value])
  return ref
}

/** Subscribe to a document slice. Object and array selectors use shallow equality. */
export function useVoucherProject<T = Project>(selector: (project: Project) => T = selectProject as (project: Project) => T): T {
  const instance = useVoucherInstance()
  return useStore(getInstanceInternals(instance).runtime.document, useShallow(selector))
}

/** Stable commands for this provider only; this hook does not subscribe to state. */
export function useVoucherActions(): VoucherActions {
  return useVoucherInstance().actions
}

/** Subscribe to one block, with undoable updates that preserve its other fields. */
export function useVoucherBlock(blockId: string | null) {
  const block = useVoucherProject((p) => blockId ? p.blocks[blockId] ?? null : null)
  const actions = useVoucherActions()
  const update = useCallback((patch: VoucherBlockPatch) => {
    if (blockId) actions.transaction((commands) => commands.updateBlock(blockId, patch))
  }, [actions, blockId])
  const updateContent = useCallback((patch: Record<string, unknown>) => {
    if (!blockId) return
    const current = actions.getProject().blocks[blockId]
    if (current) actions.transaction((commands) => commands.updateBlock(blockId, { content: { ...current.content, ...patch } } as Partial<Block>))
  }, [actions, blockId])
  const updateSettings = useCallback((patch: Record<string, unknown>) => {
    if (!blockId) return
    const current = actions.getProject().blocks[blockId]
    if (current) actions.transaction((commands) => commands.updateBlock(blockId, { settings: { ...current.settings, ...patch } } as Partial<Block>))
  }, [actions, blockId])
  return useMemo(() => ({ block, update, updateContent, updateSettings }), [block, update, updateContent, updateSettings])
}

export function useVoucherSelection() {
  const instance = useVoucherInstance()
  const selection = useStore(getInstanceInternals(instance).runtime.editor, useShallow((s): VoucherSelectionSnapshot => ({
    activeBlockId: s.activeBlockId,
    activeBlockIds: s.activeBlockIds,
    activeSectionId: s.activeSectionId,
  })))
  const selectedBlocks = useVoucherProject((project) => selection.activeBlockIds.map((id) => project.blocks[id]).filter((block): block is Block => !!block))
  return useMemo(() => ({
    ...selection, selectedBlocks,
    activeBlock: selectedBlocks.find((block) => block.id === selection.activeBlockId) ?? null,
    select: instance.actions.setActiveBlock,
    selectMany: instance.actions.setActiveBlocks,
    selectSection: instance.actions.setActiveSectionId,
    clear: instance.actions.clearActiveSelection,
  }), [instance, selection, selectedBlocks])
}

export function useVoucherHistory() {
  const instance = useVoucherInstance()
  const state = useStore(getInstanceInternals(instance).runtime.editor, useShallow((s) => ({
    canUndo: s.undoStack.length > 0,
    canRedo: s.redoStack.length > 0,
  })))
  return useMemo(() => ({ ...state, undo: instance.actions.undo, redo: instance.actions.redo }), [state, instance])
}

/** Listeners always see the latest committed handler and unsubscribe on unmount. */
export function useVoucherEvent<T extends BuilderActionType | '*'>(
  type: T,
  handler: ((event: T extends BuilderActionType ? Extract<BuilderActionEvent, { type: T }> : BuilderActionEvent) => void) | undefined,
) {
  const instance = useVoucherInstance()
  const latest = useLatest(handler)
  const enabled = !!handler
  useEffect(() => {
    if (!enabled) return
    return instance.subscribeAction((event) => {
      if (type === '*' || event.type === type) return latest.current?.(event as never)
    })
  }, [instance, type, enabled, latest])
}

/** Observe committed document edits; pending debounced notifications are cancelled on cleanup. */
export function useVoucherChange(handler: ((project: Project) => void) | undefined, debounceMs = 100) {
  const instance = useVoucherInstance()
  const latest = useLatest(handler)
  const enabled = !!handler
  useEffect(() => {
    if (!enabled) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const unsubscribe = instance.subscribe(() => {
      clearTimeout(timer)
      timer = setTimeout(() => getInstanceInternals(instance).notify(latest.current, instance.getProject()), Math.max(0, debounceMs))
    })
    return () => { unsubscribe(); clearTimeout(timer) }
  }, [instance, enabled, debounceMs, latest])
}

/** Generate local payloads; the host owns all subsequent handling. */
export function useVoucherExport() {
  const instance = useVoucherInstance()
  return useMemo(() => ({ exportProject: instance.exportProject, exportHTML: instance.exportHTML, exportJSON: instance.exportJSON }), [instance])
}

/** Preloaded and locally authored templates, with no transport or persistence. */
export function useVoucherTemplates() {
  const instance = useVoucherInstance()
  const state = useStore(getInstanceInternals(instance).templateLibrary.store)
  return useMemo(() => ({ ...state, ...instance.templates }), [state, instance])
}

/** Convenience facade. Focused hooks avoid rerendering for unrelated document changes. */
export function useVoucherBuilder() {
  const instance = useVoucherInstance()
  const project = useVoucherProject()
  const selection = useVoucherSelection()
  const history = useVoucherHistory()
  const exports = useVoucherExport()
  return useMemo(() => ({ instance, project, actions: instance.actions, selection, history, exports }), [instance, project, selection, history, exports])
}
