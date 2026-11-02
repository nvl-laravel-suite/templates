/** Instance-local action dispatch. Payloads are snapshots, delivered after committed edits. */

import type { Block, Project, VoucherSection } from '../schema'
import type { VoucherExportResult } from '../api-types'

export type BuilderActionEvent =
  | { type: 'block.add'; sectionId: string; blockId: string; blockType: string }
  | { type: 'block.remove'; blockIds: string[] }
  | { type: 'block.update'; blockId: string; patch: Partial<Block> }
  | { type: 'block.duplicate'; sourceId: string; newId: string; sectionId: string }
  | { type: 'block.move'; blockId: string; sectionId: string; fromIndex: number; toIndex: number }
  | { type: 'block.reorder'; sectionId: string; blockIds: string[] }
  | { type: 'selection.change'; activeBlockId: string | null; activeBlockIds: string[]; activeSectionId?: string | null }
  | { type: 'container.update'; containerId: string; blockIds: string[] }
  | { type: 'section.update'; sectionId: string; patch: Partial<VoucherSection> }
  | { type: 'section.activate'; sectionId: string | null }
  | { type: 'history.undo' }
  | { type: 'history.redo' }
  | { type: 'history.push' }
  | { type: 'project.load'; project: Project }
  | { type: 'project.reset' }
  | { type: 'template.load'; templateId: string; templateName: string }
  | { type: 'template.add'; templateId: string; templateName: string }
  | { type: 'template.update'; templateId: string; templateName: string }
  | { type: 'template.delete'; templateId: string; templateName: string }
  | { type: 'clipboard.copy'; blockIds: string[] }
  | { type: 'clipboard.cut'; blockIds: string[] }
  | { type: 'clipboard.paste'; sectionId: string; count: number }
  | { type: 'global.update'; patch: Record<string, unknown> }
  | { type: 'frame.update'; patch: Record<string, unknown> }
  | { type: 'export.complete'; result: VoucherExportResult }
  | { type: 'export.error'; error: Error }

export type BuilderActionType = BuilderActionEvent['type']

export type BuilderEventHandler = (event: BuilderActionEvent) => void

export function createActionBus(onError: (error: unknown) => void = (error) => console.error('[voucher-builder] Event subscriber failed:', error)) {
  const handlers = new Set<BuilderEventHandler>()
  return {
    subscribe(handler: BuilderEventHandler) {
      handlers.add(handler)
      return () => { handlers.delete(handler) }
    },
    emit(event: BuilderActionEvent) {
      for (const handler of [...handlers]) {
        try {
          // Observers cannot change the live document or another observer's payload.
          const snapshot = event.type === 'export.complete'
            ? { ...event, result: { ...event.result } }
            : structuredClone(event)
          if ('error' in event && 'error' in snapshot) snapshot.error = Object.assign(new Error(event.error.message, { cause: event.error.cause }), event.error)
          const result: unknown = handler(snapshot)
          if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
            void Promise.resolve(result).catch(onError)
          }
        } catch (error) {
          onError(error)
        }
      }
    },
    clear() { handlers.clear() },
  }
}

export type BuilderActionBus = Pick<ReturnType<typeof createActionBus>, 'subscribe' | 'emit'>
export const legacyActionBus = createActionBus()
export const subscribeAction = legacyActionBus.subscribe
export const emitAction = legacyActionBus.emit
