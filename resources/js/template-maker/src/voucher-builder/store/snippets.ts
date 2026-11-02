import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { nanoid } from 'nanoid'
import type { BlockTreeSnapshot } from '../lib/block-tree'
import { captureBlockTree, instantiateBlockTree } from '../lib/block-tree'
import { getBlockDef } from '../blocks'
import { type DocumentRuntime } from './runtime'
import { useMemo } from 'react'
import { useVoucherInstance } from '../editor-context'
import { getInstanceInternals } from '../instance'

const MAX_SNIPPETS = 24

export interface SavedSnippet {
  id: string
  name: string
  blockType: string
  createdAt: string
  updatedAt: string
  snapshot: BlockTreeSnapshot
}

interface SnippetState {
  snippets: SavedSnippet[]
  saveSnippetFromBlock: (blockId: string, name?: string, runtime?: DocumentRuntime) => SavedSnippet | null
  removeSnippet: (snippetId: string) => void
  insertSnippet: (snippetId: string, sectionId: string, runtime?: DocumentRuntime) => string | null
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

export function createSnippetStore(runtime: DocumentRuntime) {
  return createStore<SnippetState>()((set, get) => ({
      snippets: [],

      saveSnippetFromBlock: (blockId, name, targetRuntime = runtime) => {
        const document = targetRuntime.getProjectState()
        const root = document.blocks[blockId]
        if (!root) return null

        const snapshot = captureBlockTree(blockId, document.blocks, document.columnBlocks)
        if (!snapshot) return null

        const def = getBlockDef(root.type)
        const snippet: SavedSnippet = {
          id: nanoid(8),
          name: name?.trim() || root.commonSettings?.alias?.trim() || def?.name || 'Snippet',
          blockType: root.type,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          snapshot: clone(snapshot),
        }

        set((state) => ({
          snippets: [snippet, ...state.snippets].slice(0, MAX_SNIPPETS),
        }))

        return snippet
      },

      removeSnippet: (snippetId) => {
        set((state) => ({
          snippets: state.snippets.filter((snippet) => snippet.id !== snippetId),
        }))
      },

      insertSnippet: (snippetId, sectionId, targetRuntime = runtime) => {
        const snippet = get().snippets.find((entry) => entry.id === snippetId)
        if (!snippet) return null

        if (!targetRuntime.getProjectState().sections.some((section) => section.id === sectionId)) return null
        targetRuntime.pushDocumentHistory()

        const instantiated = instantiateBlockTree(clone(snippet.snapshot))

        targetRuntime.document.setState((state) => ({
          blocks: { ...state.blocks, ...instantiated.blocks },
          columnBlocks: { ...state.columnBlocks, ...instantiated.columnBlocks },
          sections: state.sections.map((section) =>
            section.id === sectionId ? { ...section, blockIds: [...section.blockIds, instantiated.rootId] } : section
          ) as typeof state.sections,
        }))
        targetRuntime.editor.setState({ activeBlockId: instantiated.rootId, activeBlockIds: [instantiated.rootId], activeSectionId: sectionId })
        targetRuntime.events.emit({ type: 'block.add', blockId: instantiated.rootId, sectionId, blockType: snippet.blockType })

        set((state) => ({
          snippets: state.snippets.map((entry) =>
            entry.id === snippetId ? { ...entry, updatedAt: new Date().toISOString() } : entry
          ),
        }))

        return instantiated.rootId
      },
    }))
}

export function useSnippetStore<T>(selector: (state: SnippetState) => T): T {
  return useStore(getInstanceInternals(useVoucherInstance()).snippetStore, selector)
}

/** Reusable snippets are local to this editor and never stored automatically. */
export function useScopedSnippetActions() {
  const instance = useVoucherInstance()
  const { runtime, snippetStore } = getInstanceInternals(instance)
  return useMemo(() => ({
    saveSnippetFromBlock: (id: string, name?: string) => snippetStore.getState().saveSnippetFromBlock(id, name, runtime),
    insertSnippet: (id: string, sectionId: string) => instance.actions.transaction(() => snippetStore.getState().insertSnippet(id, sectionId, runtime)),
  }), [instance, runtime, snippetStore])
}
