import { useSyncExternalStore } from 'react'
import { useDocumentStore } from './document'
import { useEditorStore } from './editor'
import { composerActions } from './actions'
import type { ComposerState, DocumentStoreState, EditorStoreState } from './types'
import { getEditorState, getProjectState } from './runtime'

function getComposerState(): ComposerState {
  return {
    ...getProjectState(),
    ...getEditorState(),
    ...composerActions,
  }
}

function splitComposerState(partial: Partial<ComposerState>) {
  const documentKeys = new Set<keyof DocumentStoreState>(['global', 'blocks', 'sections', 'columnBlocks', 'frame'])
  const editorKeys = new Set<keyof EditorStoreState>([
    'activeSectionId',
    'activeBlockId',
    'activeBlockIds',
    'undoStack',
    'redoStack',
    'history',
    'historyIndex',
    'clipboard',
  ])

  const documentPartial: Partial<DocumentStoreState> = {}
  const editorPartial: Partial<EditorStoreState> = {}

  for (const [key, value] of Object.entries(partial) as Array<[keyof ComposerState, unknown]>) {
    if (documentKeys.has(key as keyof DocumentStoreState)) {
      ;(documentPartial as any)[key] = value
    }
    if (editorKeys.has(key as keyof EditorStoreState)) {
      ;(editorPartial as any)[key] = value
    }
  }

  return { documentPartial, editorPartial }
}

function setComposerState(
  partial:
    | Partial<ComposerState>
    | ((state: ComposerState) => Partial<ComposerState> | ComposerState),
) {
  const resolved = typeof partial === 'function' ? partial(getComposerState()) : partial
  const { documentPartial, editorPartial } = splitComposerState(resolved)
  if (Object.keys(documentPartial).length > 0) useDocumentStore.setState(documentPartial)
  if (Object.keys(editorPartial).length > 0) useEditorStore.setState(editorPartial)
}

function subscribeComposer(listener: () => void) {
  const unsubscribeDocument = useDocumentStore.subscribe(listener)
  const unsubscribeEditor = useEditorStore.subscribe(listener)
  return () => {
    unsubscribeDocument()
    unsubscribeEditor()
  }
}

export type UseComposerStore = {
  (): ComposerState
  <T>(selector: (state: ComposerState) => T): T
  getState: () => ComposerState
  setState: (
    partial:
      | Partial<ComposerState>
      | ((state: ComposerState) => Partial<ComposerState> | ComposerState),
  ) => void
  subscribe: (listener: () => void) => () => void
}

export function createComposerStore(): UseComposerStore {
  return Object.assign(
    function useComposerStore<T = ComposerState>(selector?: (state: ComposerState) => T): T {
      const select = selector ?? ((state: ComposerState) => state as T)
      return useSyncExternalStore(
        subscribeComposer,
        () => select(getComposerState()),
        () => select(getComposerState()),
      )
    },
    {
      getState: getComposerState,
      setState: setComposerState,
      subscribe: subscribeComposer,
    },
  ) as UseComposerStore
}
