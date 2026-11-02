import type { DocumentRuntime } from '../runtime'
import type { Project } from '../../schema'
import { createEmptyProject } from '../document'
import { createInitialEditorState } from '../editor'
import type { ComposerActions } from '../types'

export function createProjectActions(runtime: DocumentRuntime): Pick<ComposerActions, 'resetProject' | 'loadProject' | 'getProject'> {
  const { getProjectState, setProjectState } = runtime
  const emitAction = runtime.events.emit
  return {
    resetProject: () => {
      const project = createEmptyProject()
      setProjectState(project)
      runtime.editor.setState(createInitialEditorState())
      emitAction({ type: 'project.reset' })
    },

    loadProject: (project: Project, options) => {
      setProjectState({
        global: project.global,
        blocks: project.blocks,
        sections: project.sections,
        columnBlocks: project.columnBlocks ?? {},
        frame: project.frame,
      })
      runtime.editor.setState({
        ...(options?.preserveHistory ? runtime.editor.getState() : createInitialEditorState()),
        activeSectionId: project.sections[0]?.id ?? null,
        activeBlockId: null,
        activeBlockIds: [],
        focusedBlockIds: [],
      })
      emitAction({ type: 'project.load', project })
    },

    getProject: () => {
      const state = getProjectState()
      return { global: state.global, blocks: state.blocks, sections: state.sections, columnBlocks: state.columnBlocks, frame: state.frame }
    },
  }
}
