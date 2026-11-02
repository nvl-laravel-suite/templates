import { Children, useContext, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Card } from 'themelia-react-ui/base/cards'
import { Grid } from 'themelia-react-ui/base/structure'
import { CompactWorkspace, CompactDockContext, type CompactDockOptions } from './compact-workspace'

/** Match the responsive visual order without losing keyed panel/input instances. */
export function WorkspaceGrid({ children, prioritizeInspector = false, layout = 'default', ...dock }: { children: ReactNode; prioritizeInspector?: boolean; layout?: 'default' | 'compact' } & CompactDockOptions) {
  const root = useRef<HTMLDivElement>(null)
  const [narrow, setNarrow] = useState(false)
  useLayoutEffect(() => {
    if (!prioritizeInspector) return
    const shell = root.current?.closest('.tc-shell')
    if (!shell) return
    const measure = () => setNarrow(shell.getBoundingClientRect().width <= 1100)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(shell)
    return () => observer.disconnect()
  }, [prioritizeInspector])
  const panels = Children.toArray(children)
  if (layout === 'compact') return <CompactWorkspace sidebar={panels[0]} design={panels[1]} inspector={panels[2]} {...dock} />
  const ordered = prioritizeInspector && narrow ? [panels[0], panels[2], panels[1]] : panels
  return <Grid ref={root} columns={3} gap="lg" className="tc-body" data-controls-first={prioritizeInspector || undefined}>{ordered}</Grid>
}

/** Native frame; the docked regions inside own their single header/body inset. */
export function WorkspacePanel({ area, children }: { area: 'sidebar' | 'design' | 'inspector'; children: ReactNode }) {
  const inCompactDock = useContext(CompactDockContext)
  return <Card surface={inCompactDock ? 'flat' : 'card'} padding="none" gap="none" className={`tc-workspace-panel tc-${area}-panel`} contentClassName="tc-workspace-panel-content">
    {children}
  </Card>
}
