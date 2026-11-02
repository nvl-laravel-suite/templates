import { create } from 'zustand'
import type { DocumentStoreState } from './types'
import { defaultGlobal, createEmptyProject } from '#/voucher-builder/lib/empty-project'

export { defaultGlobal, createEmptyProject }

// Legacy adapter state is private and memory-only. Public providers create local editor state.
export const useDocumentStore = create<DocumentStoreState>(() => createEmptyProject())
