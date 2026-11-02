import { createContext, useContext } from 'react'
import { resolveFeatures, type VoucherBuilderCallbacks, type VoucherBuilderConfig, type VoucherBuilderFeatures } from './types'
import { useVoucherInstance } from './editor-context'

export interface VoucherBuilderContextValue {
  config: VoucherBuilderConfig
  features: VoucherBuilderFeatures
  callbacks: VoucherBuilderCallbacks
  readOnly?: boolean
}

/** Keep popups inside the editor's theme and typography scope when embedded. */
export const VoucherPortalContext = createContext<HTMLElement | null>(null)
export const useVoucherPortal = () => useContext(VoucherPortalContext)
export const useReadOnly = () => useContext(VoucherBuilderContext).readOnly ?? false

export const VoucherBuilderContext = createContext<VoucherBuilderContextValue>({
  config: {},
  features: resolveFeatures(),
  callbacks: {},
})

export function useFeature(name: keyof VoucherBuilderFeatures): boolean {
  const { features } = useContext(VoucherBuilderContext)
  return features[name]
}

export function useBuilderConfig(): VoucherBuilderConfig {
  const { config } = useContext(VoucherBuilderContext)
  return config
}

/** @deprecated Prefer focused operation hooks and useVoucherEvent. */
export function useBuilderCallbacks(): VoucherBuilderContextValue['callbacks'] {
  const { callbacks } = useContext(VoucherBuilderContext)
  return callbacks
}

/** Provider-scoped configuration for custom controls. */
export function useVoucherConfig(): VoucherBuilderConfig {
  useVoucherInstance()
  return useBuilderConfig()
}

export function useVoucherFeature(name: keyof VoucherBuilderFeatures): boolean {
  useVoucherInstance()
  return useFeature(name)
}
