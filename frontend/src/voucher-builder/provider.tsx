import { ToastProvider } from './hooks/use-toast'
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { VoucherBuilderContext } from './context'
import {
  resolveFeatures,
  type VoucherWorkspaceProps,
  type VoucherBuilderCallbacks,
} from './types'
import { createVoucherBuilder, getInstanceInternals } from './instance'
import { VoucherEditorContext } from './editor-context'
import { parseBuilderConfig } from './config-schema'

const useCommitEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

export type VoucherBuilderProviderProps = Omit<VoucherWorkspaceProps, 'locale' | 'theme' | 'className'> & {
  children: ReactNode
}

/** One provider owns local editor state. `initialProject` is read once, before children render. */
export function VoucherBuilderProvider(props: VoucherBuilderProviderProps) {
  const {
    children,
    instance: suppliedInstance,
    initialProject,
    config,
    mode,
    features: overrides,
    changeDebounceMs,
    onChange,
    onAction,
    onExport,
    onExportComplete,
    onSelectionChange,
    onError,
    onTemplateAdd,
    onTemplateUpdate,
    onTemplateDelete,
  } = props
  const owned = useRef<ReturnType<typeof createVoucherBuilder> | null>(null)
  if (!suppliedInstance && !owned.current)
    owned.current = createVoucherBuilder({ ...props, initialProject })
  const instance = suppliedInstance ?? owned.current!
  const internals = getInstanceInternals(instance)
  const baseline = useMemo(() => getInstanceInternals(instance).getOptions(), [instance])
  const callbackProps = useMemo(
    () => ({
      onChange,
      onAction,
      onExport,
      onExportComplete,
      onSelectionChange,
      onError,
      onTemplateAdd,
      onTemplateUpdate,
      onTemplateDelete,
    }),
    [
      onChange,
      onAction,
      onExport,
      onExportComplete,
      onSelectionChange,
      onError,
      onTemplateAdd,
      onTemplateUpdate,
      onTemplateDelete,
    ],
  )
  const presentKeys = Object.keys(callbackProps)
    .filter((key) => Object.prototype.hasOwnProperty.call(props, key))
    .join('|')
  const callbacks = useMemo<VoucherBuilderCallbacks>(() => {
    if (!suppliedInstance) return callbackProps
    const explicit = new Set(presentKeys.split('|'))
    return {
      ...baseline,
      ...Object.fromEntries(Object.entries(callbackProps).filter(([key]) => explicit.has(key))),
    }
  }, [suppliedInstance, baseline, callbackProps, presentKeys])
  const resolvedConfig = useMemo(
    () =>
      parseBuilderConfig({
        ...(suppliedInstance ? baseline.config : {}),
        ...config,
      }),
    [suppliedInstance, baseline, config],
  )
  const features = useMemo(() => resolveFeatures(mode, overrides), [mode, overrides])
  useCommitEffect(() => {
    internals.configure({
      ...callbacks,
      config: resolvedConfig,
      changeDebounceMs: changeDebounceMs ?? baseline.changeDebounceMs ?? 100,
    })
  }, [internals, baseline, callbacks, resolvedConfig, changeDebounceMs])
  useCommitEffect(
    () => () => {
      if (suppliedInstance) internals.configure(baseline)
      else internals.disconnect()
    },
    [internals, suppliedInstance, baseline],
  )
  const value = useMemo(
    () => ({ config: resolvedConfig, features, callbacks, readOnly: mode === 'viewer' }),
    [resolvedConfig, features, callbacks, mode],
  )
  return (
    <VoucherEditorContext.Provider value={instance}>
      <VoucherBuilderContext.Provider value={value}>
        <ToastProvider>{children}</ToastProvider>
      </VoucherBuilderContext.Provider>
    </VoucherEditorContext.Provider>
  )
}
