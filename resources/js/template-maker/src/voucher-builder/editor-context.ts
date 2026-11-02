import { createContext, useContext } from 'react'
import type { VoucherBuilderInstance } from './instance'

export const VoucherEditorContext = createContext<VoucherBuilderInstance | null>(null)
export const useOptionalVoucherInstance = () => useContext(VoucherEditorContext)

/** Stable local editor access without subscribing to document changes. */
export function useVoucherInstance(): VoucherBuilderInstance {
  const instance = useOptionalVoucherInstance()
  if (!instance) throw new Error('Voucher hooks require <VoucherBuilderProvider>. Wrap your editor and custom controls in the same provider.')
  return instance
}
