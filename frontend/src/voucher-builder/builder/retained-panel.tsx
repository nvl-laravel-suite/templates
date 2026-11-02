import { useCallback, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { ActionDrawer } from 'themelia-react-ui/features/overlays'
import { ThemeScope } from 'themelia-react-ui/ui-provider'
import { useRetainedPanelHost } from '../../shared/use-retained-panel-host'

interface Props {
  children: ReactNode
  docked: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceRef: RefObject<HTMLDivElement | null>
  launcherLabel: string
  className: string
  label: string
  title: string
  description: string
  direction?: 'left' | 'right'
}

/** Reparent the DOM host, rather than the React tree, when editing tools become a drawer. */
export function RetainedPanel({ children, docked, open, onOpenChange, workspaceRef, launcherLabel, className, label, title, description, direction = 'right' }: Props) {
  const { host, hostRef, parkingRef } = useRetainedPanelHost('nc-retained-panel-host')
  const desktop = useRef<HTMLElement | null>(null)
  const drawer = useRef<HTMLDivElement | null>(null)
  const previousDocked = useRef(docked)
  const dockedRef = useRef(docked)
  dockedRef.current = docked
  const resizeFocus = useRef<HTMLElement | null>(null)
  const launcher = useCallback(() => workspaceRef.current?.querySelector<HTMLButtonElement>(`[aria-label="${launcherLabel}"]`) ?? null, [workspaceRef, launcherLabel])

  const placeHost = useCallback(() => {
    if (!host) return
    const destination = docked ? desktop.current : drawer.current ?? parkingRef.current
    if (destination && host.parentElement !== destination) destination.appendChild(host)
  }, [docked, host, parkingRef])
  useLayoutEffect(() => {
    const changed = previousDocked.current !== docked
    if (changed) {
      const active = document.activeElement
      if (active instanceof HTMLElement && (hostRef.current?.contains(active) || active === launcher())) resizeFocus.current = active
      previousDocked.current = docked
    }
    placeHost()
    if (!changed || !resizeFocus.current) return
    const frame = requestAnimationFrame(() => {
      const saved = resizeFocus.current
      const target = docked
        ? saved && hostRef.current?.contains(saved) ? saved : hostRef.current?.querySelector<HTMLElement>('input, [role="tab"][aria-selected="true"], button')
        : launcher()
      if (target?.isConnected && !target.closest('[hidden], [inert]')) target.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [docked, hostRef, launcher, placeHost])
  useLayoutEffect(() => { if (docked && open) onOpenChange(false) }, [docked, open, onOpenChange])
  const drawerSlot = useCallback((node: HTMLDivElement | null) => {
    drawer.current = node
    if (host) (node ?? (docked ? desktop.current : parkingRef.current))?.appendChild(host)
  }, [docked, host, parkingRef])
  const restoreFocus = useCallback(() => {
    requestAnimationFrame(() => {
      const target = dockedRef.current ? resizeFocus.current : launcher()
      if (target?.isConnected && !target.closest('[hidden], [inert]')) target.focus({ preventScroll: true })
    })
  }, [launcher])

  return <>
    <aside ref={desktop} className={className} aria-label={label} hidden={!docked} />
    <div ref={parkingRef} hidden />
    <ActionDrawer open={!docked && open} onOpenChange={onOpenChange} onClose={restoreFocus}
      direction={direction} width="sm" title={title} description={description} showFooter={false} contentClassName="p-0">
      <div ref={drawerSlot} className="nc-panel-drawer-slot" />
    </ActionDrawer>
    {host && createPortal(<ThemeScope className="nc-retained-panel-scope" onFocusCapture={(event) => {
      if (event.target instanceof HTMLElement) resizeFocus.current = event.target
    }}>{children}</ThemeScope>, host)}
  </>
}
