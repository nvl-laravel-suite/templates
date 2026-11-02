import { createContext, useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from 'themelia-react-ui/base/buttons'
import { OverflowTabBar } from 'themelia-react-ui/base/navigation'
import { Grid } from 'themelia-react-ui/base/structure'
import { ActionDrawer } from 'themelia-react-ui/features/overlays'
import { PanelRight } from 'lucide-react'
import { ThemeScope } from 'themelia-react-ui/ui-provider'
import { Card } from 'themelia-react-ui/base/cards'
import { useDraftReveal } from '../shared/draft-validation'
import { useRetainedPanelHost } from '../shared/use-retained-panel-host'

export const CompactDockContext = createContext(false)

function visibleDockTarget(host: HTMLElement | null, saved: HTMLElement | null) {
  if (saved?.isConnected) return saved
  return host?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]') ?? host?.querySelector<HTMLElement>('[role="combobox"]') ?? null
}

export interface CompactDockOptions {
  dockLabels?: { sidebar: string; inspector: string }
  dockNavigation?: ReactNode
  dockSidebarHidden?: boolean
  dockInspectorHidden?: boolean
  dockOpen?: boolean
  onDockOpenChange?: (open: boolean) => void
}

/** A stable portal keeps editor controls alive while their native drawer comes and goes. */
export function CompactWorkspace({ sidebar, design, inspector, dockLabels = { sidebar: 'Values', inspector: 'Appearance' }, dockNavigation, dockSidebarHidden, dockInspectorHidden, dockOpen, onDockOpenChange }: CompactDockOptions & { sidebar: ReactNode; design: ReactNode; inspector: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null)
  const { host, hostRef, parkingRef: parking } = useRetainedPanelHost('tc-compact-host')
  const desktop = useRef<HTMLDivElement>(null)
  const drawer = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const mobileRef = useRef(false)
  const resizeFocus = useRef<HTMLElement | null>(null)
  const [mobile, setMobile] = useState(false)
  const [ownOpen, setOwnOpen] = useState(false)
  const [tab, setTab] = useState('sidebar')
  const open = dockOpen ?? ownOpen
  const changeOpen = useCallback((value: boolean) => { setOwnOpen(value); onDockOpenChange?.(value) }, [onDockOpenChange])
  useLayoutEffect(() => {
    const shell = frame.current?.closest('.tc-shell')
    if (!shell) return
    const measure = () => {
      const width = shell.getBoundingClientRect().width
      const next = width > 0 && width <= 760
      if (next !== mobileRef.current) {
        const active = shell.ownerDocument.activeElement
        resizeFocus.current = active instanceof HTMLElement && (hostRef.current?.contains(active) || active === trigger.current) ? active : null
        mobileRef.current = next
        setMobile(next)
      }
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure); observer.observe(shell)
    return () => observer.disconnect()
  }, [])
  // Portal target identity never changes. Only its DOM placement changes.
  const placeHost = useCallback(() => {
    if (!host) return
    const destination = mobile ? drawer.current ?? parking.current : desktop.current ?? parking.current
    if (destination && host.parentElement !== destination) destination.appendChild(host)
  }, [host, mobile])
  useLayoutEffect(placeHost, [placeHost, open])
  useLayoutEffect(() => {
    if (!resizeFocus.current) return
    const target = resizeFocus.current
    const id = requestAnimationFrame(() => {
      if (mobile) { trigger.current?.focus(); resizeFocus.current = null }
      else {
        const next = visibleDockTarget(hostRef.current, target)
        if (next && !next.closest('[hidden], [inert]')) next.focus({ preventScroll: true })
      }
    })
    return () => cancelAnimationFrame(id)
  }, [mobile, host])
  const drawerSlot = useCallback((node: HTMLDivElement | null) => {
    drawer.current = node
    if (host) (node ?? (mobile ? parking.current : desktop.current) ?? parking.current)?.appendChild(host)
  }, [host, mobile])
  useLayoutEffect(() => {
    if (!mobile && open) changeOpen(false)
  }, [mobile, open, changeOpen])
  // Hosts retain inactive mode trees. An inactive modal must release its focus trap.
  useLayoutEffect(() => {
    if (!open || !frame.current || typeof MutationObserver === 'undefined') return
    const closeInactive = () => { if (frame.current?.closest('[hidden]')) changeOpen(false) }
    const observer = new MutationObserver(closeInactive)
    for (let node = frame.current.parentElement; node; node = node.parentElement) observer.observe(node, { attributes: true, attributeFilter: ['hidden'] })
    closeInactive()
    return () => observer.disconnect()
  }, [open, changeOpen])
  useDraftReveal(host, event => {
    const region = (event.target as HTMLElement).closest<HTMLElement>('[data-compact-region]')?.dataset.compactRegion
    if (region === 'sidebar' || region === 'inspector') setTab(region)
    changeOpen(true)
  })
  const sidebarHidden = dockSidebarHidden ?? tab !== 'sidebar'
  const inspectorHidden = dockInspectorHidden ?? tab !== 'inspector'
  return <ThemeScope className="tc-compact-scope"><Grid ref={frame} columns={2} gap="lg" className="tc-body tc-body-compact" data-compact-mobile={mobile || undefined}>
    <div className="tc-compact-canvas">
      {mobile && <div className="tc-compact-launcher"><Button ref={trigger} onClick={() => changeOpen(true)} aria-haspopup="dialog" aria-expanded={open}><PanelRight />Editing tools</Button></div>}
      {design}
    </div>
    <div ref={desktop} className="tc-compact-desktop" hidden={mobile} />
    <div ref={parking} hidden />
    <ActionDrawer open={mobile && open} onOpenChange={changeOpen} onClose={() => {
      requestAnimationFrame(() => {
        if (frame.current?.closest('[hidden]')) return
        const target = mobile ? trigger.current : resizeFocus.current && visibleDockTarget(hostRef.current, resizeFocus.current)
        if (target?.isConnected && !target.closest('[hidden], [inert]')) target.focus({ preventScroll: true })
        resizeFocus.current = null
      })
    }}
      title="Editing tools" direction="right" width="lg" showFooter={false} contentClassName="tc-compact-drawer-body">
      <div ref={drawerSlot} className="tc-compact-drawer-slot" />
    </ActionDrawer>
    {host && createPortal(<ThemeScope className="tc-compact-dock"><CompactDockContext.Provider value><Card surface={mobile ? 'flat' : 'card'} padding="none" gap="none" className="tc-compact-card" contentClassName="tc-compact-dock-content">
      <div className="tc-panel-navigation">{dockNavigation ?? <OverflowTabBar items={[{ id: 'sidebar', label: dockLabels.sidebar }, { id: 'inspector', label: dockLabels.inspector }]} value={tab} onValueChange={setTab} strings={{ navigationLabel: 'Editing panels', more: 'More panels' }} />}</div>
      <div className="tc-compact-region" data-compact-region="sidebar" hidden={sidebarHidden}>{sidebar}</div>
      <div className="tc-compact-region" data-compact-region="inspector" hidden={inspectorHidden}>{inspector}</div>
    </Card></CompactDockContext.Provider></ThemeScope>, host)}
  </Grid></ThemeScope>
}
