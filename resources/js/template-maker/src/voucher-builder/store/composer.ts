import { createComposerStore } from './adapter'
import '../blocks/definitions'

/**
 * @deprecated Use focused hooks from `#/store/hooks` or action APIs from `#/store/actions`.
 * This export exists only as a backwards-compatibility shim.
 */
export const useComposerStore = createComposerStore()
