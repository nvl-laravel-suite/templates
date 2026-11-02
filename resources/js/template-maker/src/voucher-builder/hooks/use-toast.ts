import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react'
export type ToastVariant = 'success' | 'info' | 'warning' | 'error'
export interface Toast {
  id: string
  message: string
  variant: ToastVariant
}
type Notify = (message: string, variant?: ToastVariant) => void
const ActionsContext = createContext<{ notify: Notify; dismiss: (id: string) => void } | null>(null)
const ItemsContext = createContext<Toast[]>([])
/** Notification lifetime and messages belong to one voucher provider. */
export function ToastProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<Toast[]>([])
  const nextId = useRef(0)
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    const pending = timers.current
    return () => {
      mounted.current = false
      pending.forEach(clearTimeout)
      pending.clear()
    }
  }, [])
  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id)
    if (timer) clearTimeout(timer)
    timers.current.delete(id)
    if (mounted.current) setItems((previous) => previous.filter((item) => item.id !== id))
  }, [])
  const notify = useCallback<Notify>(
    (message, variant = 'success') => {
      if (!mounted.current) return
      const id = String(++nextId.current)
      setItems((previous) => [...previous.slice(-2), { id, message, variant }])
      // Errors stay available until dismissed so a failed operation is never lost.
      if (variant !== 'error')
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), 4000),
        )
    },
    [dismiss],
  )
  const actions = useMemo(() => ({ notify, dismiss }), [notify, dismiss])
  return createElement(
    ActionsContext.Provider,
    { value: actions },
    createElement(ItemsContext.Provider, { value: items }, children),
  )
}
function useToastActions() {
  const context = useContext(ActionsContext)
  if (!context) throw new Error('Voucher notifications require VoucherBuilderProvider.')
  return context
}
export function useToast() {
  return useToastActions().notify
}
export function useDismissToast() {
  return useToastActions().dismiss
}
export function useToasts() {
  return useContext(ItemsContext)
}
