import type { DocumentRuntime } from '../runtime'
import type { ComposerActions } from '../types'
import type { VoucherSection } from '#/voucher-builder/schema'

export function createSectionActions(runtime: DocumentRuntime): Pick<ComposerActions, 'updateSection' | 'setActiveSectionId'> {
  const { updateProjectState } = runtime
  const emitAction = runtime.events.emit
  return {
    updateSection: (sectionId, updates) => {
      updateProjectState((state) => {
        const idx = state.sections.findIndex((s) => s.id === sectionId)
        if (idx === -1) return null
        const newSections = [...state.sections] as [VoucherSection, VoucherSection, VoucherSection]
        newSections[idx] = { ...newSections[idx], ...updates }
        return { sections: newSections }
      })
      emitAction({ type: 'section.update', sectionId, patch: updates as Partial<VoucherSection> })
    },
    setActiveSectionId: (sectionId) => {
      if (sectionId && !runtime.getProjectState().sections.some(s => s.id === sectionId)) return
      if (runtime.getEditorState().activeSectionId === sectionId) return
      runtime.editor.setState({ activeSectionId: sectionId })
      emitAction({ type: 'section.activate', sectionId })
    },
  }
}
