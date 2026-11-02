import { CornerLeftUp, ArrowUp, ArrowDown, Copy, Trash2, LockKeyhole } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

export type CanvasBounds = { left: number; top: number; width: number; height: number }

/** App-owned drawing chrome, outside the authored document and its CSS cascade. */
export function CanvasElementFrame({ id, name, kind, bounds, stageWidth, viewport, parent, actions, description }: {
  id: string
  name: string
  kind: string
  bounds: CanvasBounds[]
  stageWidth: number
  viewport?: { top: number; bottom: number }
  parent?: { name: string; select: () => void }
  actions?: ReactNode
  description?: string
}) {
  const toolbar = useRef<HTMLDivElement>(null)
  const [toolbarWidth, setToolbarWidth] = useState(0)
  useLayoutEffect(() => {
    const element = toolbar.current
    if (!element) return
    const measure = () => setToolbarWidth(element.getBoundingClientRect().width)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [id, actions, description, bounds.length])
  // Keep the toolbar mounted through srcDoc reloads and for nonvisual conditions/repeaters.
  // 8px of selection padding + a 4px gap + the 32px toolbar.
  const toolbarOffset = 44
  const first = (viewport && bounds.find(rect => rect.top + rect.height > viewport.top + toolbarOffset && rect.top < viewport.bottom))
    || bounds[0] || { left: 0, top: 0 }
  const top = viewport ? Math.max(viewport.top + 4, Math.min(first.top - toolbarOffset, viewport.bottom - 36)) : first.top - toolbarOffset
  return <>
    {bounds.map((rect, index) => <div key={index} aria-hidden="true" data-template-selection={id}
      className="tc-element-frame" style={rect} />)}
    <div ref={toolbar} role="toolbar" aria-label={`Actions for ${name}`} className="tc-element-toolbar" tabIndex={-1}
      onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
        const index = buttons.indexOf(event.target as HTMLButtonElement)
        if (index < 0) return
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
          : (index + (event.key === 'ArrowLeft' ? -1 : 1) + buttons.length) % buttons.length
        event.preventDefault()
        buttons[next]?.focus()
      }}
      style={{ left: Math.max(0, Math.min(first.left - 8, stageWidth - toolbarWidth)), top, maxWidth: stageWidth }}>
      {parent && <button type="button" className="tc-element-command" aria-label={`Select parent: ${parent.name}`}
        title={`Select parent: ${parent.name}`} onClick={event => {
          const trigger = event.currentTarget
          parent.select()
          requestAnimationFrame(() => {
            if (!trigger.isConnected) (toolbar.current?.querySelector<HTMLButtonElement>('button:not(:disabled)') ?? toolbar.current)?.focus()
          })
        }}><CornerLeftUp aria-hidden="true" /></button>}
      <span className="tc-element-identity" title={name}>
        <span className="tc-element-name">{name}</span>
        <span className="tc-element-kind">{kind}</span>
      </span>
      {description && <span className="tc-element-access" title={description}><LockKeyhole aria-hidden="true" /><span>{description}</span></span>}
      {actions && <span className="tc-element-actions">{actions}</span>}
    </div>
  </>
}

export function CanvasNodeActions({ up, down, duplicate, remove }: {
  up?: () => void; down?: () => void; duplicate: () => void; remove: () => void
}) {
  return <>
    <button type="button" className="tc-element-command" aria-label="Move element up" title="Move up" disabled={!up} onClick={up}><ArrowUp aria-hidden="true" /></button>
    <button type="button" className="tc-element-command" aria-label="Move element down" title="Move down" disabled={!down} onClick={down}><ArrowDown aria-hidden="true" /></button>
    <button type="button" className="tc-element-command" aria-label="Duplicate element" title="Duplicate" onClick={duplicate}><Copy aria-hidden="true" /></button>
    <button type="button" className="tc-element-command is-destructive" aria-label="Remove element" title="Remove" onClick={remove}><Trash2 aria-hidden="true" /></button>
  </>
}
