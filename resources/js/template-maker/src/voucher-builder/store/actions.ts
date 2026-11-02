import { legacyRuntime, type DocumentRuntime } from './runtime'
import { createBlockActions } from './actionModules/blocks'
import { createClipboardActions } from './actionModules/clipboard'
import { createContainerActions } from './actionModules/containers'
import { createGlobalActions } from './actionModules/global'
import { createHistoryActions } from './actionModules/history'
import { createSectionActions } from './actionModules/sections'
import { createProjectActions } from './actionModules/project'
import { createSelectionActions } from './actionModules/selection'
import type { ComposerActions } from './types'
import { createStructureActions } from './actionModules/structure'

export function createComposerActions(runtime: DocumentRuntime): ComposerActions {
  return {
    ...createHistoryActions(runtime),
    ...createSelectionActions(runtime),
    ...createSectionActions(runtime),
    ...createBlockActions(runtime),
    ...createContainerActions(runtime),
    ...createStructureActions(runtime),
    ...createGlobalActions(runtime),
    ...createClipboardActions(runtime),
    ...createProjectActions(runtime),
  }

}

export const composerActions = createComposerActions(legacyRuntime)
