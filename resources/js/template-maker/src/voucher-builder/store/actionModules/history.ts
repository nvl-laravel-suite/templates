import type { DocumentRuntime } from '../runtime'
import type { ComposerActions } from '../types'

export function createHistoryActions(runtime: DocumentRuntime): Pick<ComposerActions, 'pushHistory' | 'undo' | 'redo'> {
  const { pushDocumentHistory, redoDocumentHistory, undoDocumentHistory } = runtime
  const emitAction = runtime.events.emit
  return {
    pushHistory: () => { pushDocumentHistory(); emitAction({ type: 'history.push' }) },
    undo: () => { if (!runtime.getEditorState().undoStack.length) return; undoDocumentHistory(); emitAction({ type: 'history.undo' }) },
    redo: () => { if (!runtime.getEditorState().redoStack.length) return; redoDocumentHistory(); emitAction({ type: 'history.redo' }) },
  }
}
