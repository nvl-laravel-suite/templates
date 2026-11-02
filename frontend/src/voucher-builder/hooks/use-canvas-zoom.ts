import { useEffect, useState } from 'react'
import { A4_HEIGHT_MM, A4_WIDTH_MM, mmToPx } from '../lib/voucher'

export function getFitZoom(width: number, height: number, mode: 'width' | 'page'): number {
  const widthRatio = Math.max(1, width - 48) / (mmToPx(A4_WIDTH_MM) + 20)
  const heightRatio = Math.max(1, height - 48) / (mmToPx(A4_HEIGHT_MM) + 64)
  return Math.max(10, Math.min(100, Math.floor((mode === 'page' ? Math.min(widthRatio, heightRatio) : widthRatio) * 100)))
}

/** Editing starts at fit width; fit page remains an explicit overview action. */
export function useCanvasZoom() {
  const [element, canvasRef] = useState<HTMLElement | null>(null)
  const [customZoom, setZoom] = useState<number | null>(null)
  const [fitMode, setFitMode] = useState<'width' | 'page'>('width')
  const [fitZoom, setFitZoom] = useState(75)
  useEffect(() => {
    if (!element || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      setFitZoom(getFitZoom(element.clientWidth, element.clientHeight, fitMode))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [element, fitMode])
  const fit = (mode: 'width' | 'page') => { setFitMode(mode); setZoom(null) }
  return { canvasRef, zoom: customZoom ?? fitZoom, setZoom, fitWidth: () => fit('width'), fitPage: () => fit('page') }
}
