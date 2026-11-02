import { applyDocumentCommand } from '../../engine/commands'
import type { DocumentRuntime } from '../runtime'

export function createCommandHelpers(runtime: DocumentRuntime) {
  const { applyDocumentResult, getProjectState, pushDocumentHistory } = runtime
  type DocumentCommand = Parameters<typeof applyDocumentCommand>[1]

  function getCurrentLocale() {
    return getProjectState().global.metadata.language || 'en'
  }

  function applyProjectCommand(
    command: DocumentCommand,
    options?: { updateSelection?: boolean; updateActivePage?: boolean },
    config?: { pushHistory?: boolean },
  ) {
    const current = getProjectState()
    const result = applyDocumentCommand(current, command)
    if (JSON.stringify(result.project) === JSON.stringify(current)) return result
    if (config?.pushHistory !== false) pushDocumentHistory()
    applyDocumentResult(result, options)
    return result
  }
  return { getCurrentLocale, applyProjectCommand }
}
