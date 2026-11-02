import { ErrorState } from 'themelia-react-ui/base/feedback'
import { Text } from 'themelia-react-ui/typography'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CanvasElementFrame, type CanvasBounds } from './canvas-element-frame'
import { childIds } from '../template-core/validation'
import { templateNodeLabel } from '../template-core/labels'
import { finalizeTemplateOutput } from '../template-platform/output'
import { renderTemplate } from '../template-core/render'
import { assertEmailTemplate } from '../template-email/profile'
import type { TemplateDefinition, TemplatePersonalization, TemplateRevision, JsonObject } from '../template-core/schema'

export function TemplateCanvas({
  template,
  personalization,
  selectedId,
  onSelect, previewTransform, target = 'document', data, selectionActions, selectionDescription,
}: {
  template: TemplateDefinition | TemplateRevision
  personalization?: TemplatePersonalization
  selectedId: string | null
  onSelect: (id: string | null) => void
  previewTransform?: (template: TemplateDefinition) => TemplateDefinition
  target?: 'document' | 'email'
  data?: JsonObject
  /** Editor-only contextual controls. Never included in source HTML or exports. */
  selectionActions?: ReactNode
  /** Explain restricted structural editing, for example inherited family content. */
  selectionDescription?: string
}) {
  const wrapper = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState<{ top: number; bottom: number }>()
  const selectRef = useRef(onSelect)
  const disposeFrame = useRef<() => void>(() => {})
  useEffect(() => {
    selectRef.current = onSelect
  }, [onSelect])
  const document = template.format === 'gct-template' ? template : template.template
  const [scale, setScale] = useState(0.8)
  const [height, setHeight] = useState((document.page.heightMm * 96) / 25.4)
  const [frameVersion, setFrameVersion] = useState(0)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [marks, setMarks] = useState<{ selected: CanvasBounds[]; hovered: CanvasBounds[] }>({ selected: [], hovered: [] })
  const result = useMemo(() => {
    try {
      if (target === 'email') assertEmailTemplate(document)
      const prepared = previewTransform ? (template.format === 'gct-template' ? previewTransform(template) : { ...template, template: previewTransform(template.template) }) : template
      const output = renderTemplate(prepared, { mode: 'preview', useSamples: !personalization, personalization, data, annotate: true })
      return { ...output, html: output.html ? finalizeTemplateOutput(output.html, target, true) : '' }
    } catch (error) {
      return { html: '', css: '', data: {}, issues: [{ path: '/', code: 'preview', message: error instanceof Error ? error.message : 'Unable to prepare preview.' }] }
    }
  }, [template, personalization, previewTransform, target, data])
  useLayoutEffect(() => () => disposeFrame.current(), [result.html])
  // Selection is editor chrome. Keeping it outside srcDoc preserves the iframe and authored CSS.
  useEffect(() => {
    const doc = frame.current?.contentDocument
    const bounds = (id: string | null): CanvasBounds[] => {
      if (!id || !doc) return []
      const elements = [...doc.querySelectorAll<HTMLElement>('[data-template-node-id]')]
      const direct = elements.filter(element => element.getAttribute('data-template-node-id') === id)
      const descendants = new Set<string>()
      const collect = (nodeId: string) => {
        if (descendants.has(nodeId)) return
        descendants.add(nodeId)
        const node = document.nodes[nodeId]
        if (node) childIds(node).forEach(collect)
      }
      if (!direct.length) collect(id)
      const measured = (direct.length ? direct : elements.filter(element => descendants.has(element.getAttribute('data-template-node-id') ?? '')))
        .map((element) => {
          const rect = element.getBoundingClientRect()
          return {
            left: rect.left * scale,
            top: rect.top * scale,
            width: rect.width * scale,
            height: rect.height * scale,
          }
        })
        .filter((rect) => rect.width > 0 && rect.height > 0)
      if (direct.length || !measured.length) return measured
      // Logical containers have no DOM wrapper; measure the union of their visible descendants.
      const left = Math.min(...measured.map(rect => rect.left)), top = Math.min(...measured.map(rect => rect.top))
      return [{ left, top, width: Math.max(...measured.map(rect => rect.left + rect.width)) - left,
        height: Math.max(...measured.map(rect => rect.top + rect.height)) - top }]
    }
    setMarks({ selected: bounds(selectedId), hovered: bounds(hoveredId === selectedId ? null : hoveredId) })
  }, [selectedId, hoveredId, scale, height, frameVersion, result.html])
  const width = target === 'email' ? 600 : (document.page.widthMm * 96) / 25.4
  const node = selectedId ? document.nodes[selectedId] : undefined
  const parent = node && Object.values(document.nodes).find(candidate => childIds(candidate).includes(node.id))
  const measureViewport = () => {
    if (!wrapper.current?.clientHeight || !stage.current) return
    const top = wrapper.current.getBoundingClientRect().top + wrapper.current.clientTop - stage.current.getBoundingClientRect().top
    const bottom = top + wrapper.current.clientHeight
    setViewport(previous => previous?.top === top && previous.bottom === bottom ? previous : { top, bottom })
  }
  useEffect(measureViewport, [scale, height, frameVersion, result.html])
  useEffect(() => {
    if (!wrapper.current) return
    const update = (available: number) => setScale(Math.min(1, Math.max(0.15, available / width)))
    const computed = getComputedStyle(wrapper.current)
    update(
      wrapper.current.clientWidth -
        parseFloat(computed.paddingLeft || '0') -
        parseFloat(computed.paddingRight || '0'),
    )
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      update(entries[0].contentRect.width)
      measureViewport()
    })
    observer.observe(wrapper.current)
    return () => observer.disconnect()
  }, [width])
  const loaded = () => {
    disposeFrame.current()
    const doc = frame.current?.contentDocument
    if (!doc) return
    if (!doc.querySelector('[data-template-preview-chrome]')) {
      const chrome = doc.createElement('style')
      chrome.setAttribute('data-template-preview-chrome', '')
      chrome.textContent = 'html,body{scrollbar-width:none}html::-webkit-scrollbar,body::-webkit-scrollbar{display:none}'
      doc.head.appendChild(chrome)
    }
    const page = doc.querySelector<HTMLElement>('.template-document')
    let disposed = false
    let pendingMeasurement: number | null = null
    let previousGeometry: string | null = null
    const measure = (force = false) => {
      if (disposed) return
      if (!page) { if (force) setFrameVersion(version => version + 1); return }
      const rect = page.getBoundingClientRect(), scrollHeight = page.scrollHeight, scrollWidth = page.scrollWidth
      const nextHeight = Math.ceil(Math.max(
        target === 'email' ? 300 : (document.page.heightMm * 96) / 25.4,
        scrollHeight,
        rect.height,
        ...Array.from(doc.body.children, child => child.getBoundingClientRect().bottom + (doc.scrollingElement?.scrollTop ?? 0)),
      ))
      const geometry = [rect.width, rect.height, scrollWidth, scrollHeight, nextHeight].join(':')
      if (!force && geometry === previousGeometry) return
      previousGeometry = geometry
      setFrameVersion(version => version + 1)
      setHeight(nextHeight)
    }
    measure(true)
    const click = (event: MouseEvent) => {
      event.preventDefault()
      const target = event.target as HTMLElement
      selectRef.current(
        target.closest('[data-template-node-id]')?.getAttribute('data-template-node-id') ?? null,
      )
    }
    doc.addEventListener('click', click)
    const hover = (event: PointerEvent) => {
      setHoveredId(
        (event.target as HTMLElement)
          .closest('[data-template-node-id]')
          ?.getAttribute('data-template-node-id') ?? null,
      )
    }
    doc.addEventListener('pointermove', hover)
    const scheduleMeasurement = () => {
      if (disposed || pendingMeasurement !== null) return
      pendingMeasurement = requestAnimationFrame(() => {
        pendingMeasurement = null
        measure()
      })
    }
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleMeasurement)
    if (page) observer?.observe(page)
    disposeFrame.current = () => {
      if (disposed) return
      disposed = true
      if (pendingMeasurement !== null) cancelAnimationFrame(pendingMeasurement)
      doc.removeEventListener('click', click)
      doc.removeEventListener('pointermove', hover)
      observer?.disconnect()
    }
  }
  return (
    <main className="tc-canvas" ref={wrapper} aria-label="Template canvas" tabIndex={0} onScroll={measureViewport}>
      <div className="tc-canvas-ruler">
        <Text type="secondary" size="sm">
          {target === 'email' ? 'Email · 600 px' : `${document.page.widthMm} × ${document.page.heightMm} mm`}
        </Text>
        <Text type="secondary" size="sm">
          {Math.round(scale * 100)}% · Fit width
        </Text>
      </div>
      {result.html ? (
        <div ref={stage} className="tc-paper-stage" style={{ width: width * scale, height: height * scale }}>
          <iframe
            ref={frame}
            title="Template document"
            sandbox="allow-same-origin"
            srcDoc={result.html}
            onLoad={loaded}
            onMouseLeave={() => setHoveredId(null)}
            style={{ width, height, transform: `scale(${scale})` }}
          />
          {marks.hovered.map((bounds, index) => (
            <div key={`hover-${index}`} aria-hidden className="tc-element-hover" style={bounds} />
          ))}
          {node && <CanvasElementFrame id={node.id} name={templateNodeLabel(node)} kind={node.kind === 'element' ? node.tag : node.kind}
            bounds={marks.selected} stageWidth={width * scale} viewport={viewport} actions={selectionActions} description={selectionDescription}
            parent={parent ? { name: templateNodeLabel(parent), select: () => onSelect(parent.id) } : undefined} />}
        </div>
      ) : (
        <ErrorState
          className="tc-canvas-error"
          title="Resolve the template checks to preview this document."
          description={result.issues
            .slice(0, 5)
            .map((issue) => issue.message)
            .join(' ')}
        />
      )}
    </main>
  )
}
