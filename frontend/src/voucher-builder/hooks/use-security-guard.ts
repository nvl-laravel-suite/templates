import { useEffect, useRef } from 'react'

interface SecurityCallbacks {
  onDevToolsDetected?: () => void
  onPrintAttempt?: () => void
}

/**
 * Security guard hook — prevents unauthorized content access.
 * - Blocks printing (CSS + JS)
 * - Detects devtools opening
 * - Disables right-click (caller provides custom context menu)
 */
export function useSecurityGuard(callbacks?: SecurityCallbacks) {
  const enabled = callbacks !== undefined
  // Use refs to avoid re-running effects when callbacks change identity
  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks

  // ── Block printing ──
  useEffect(() => {
    if (!enabled) return

    const beforePrint = () => {
      callbacksRef.current?.onPrintAttempt?.()
      document.body.classList.add('nc-print-blocked')
    }
    const afterPrint = () => {
      document.body.classList.remove('nc-print-blocked')
    }

    window.addEventListener('beforeprint', beforePrint)
    window.addEventListener('afterprint', afterPrint)

    // Block Ctrl+P / Cmd+P
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault()
        e.stopImmediatePropagation()
        callbacksRef.current?.onPrintAttempt?.()
      }
      // Block Ctrl+S / Cmd+S (save page)
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)

    return () => {
      window.removeEventListener('beforeprint', beforePrint)
      window.removeEventListener('afterprint', afterPrint)
      document.removeEventListener('keydown', handleKeyDown, true)
      document.body.classList.remove('nc-print-blocked')
    }
  }, [enabled])

  // ── Detect DevTools ──
  useEffect(() => {
    if (!enabled) return

    let devtoolsOpen = false
    const threshold = 160

    const checkDevTools = () => {
      const widthDiff = window.outerWidth - window.innerWidth > threshold
      const heightDiff = window.outerHeight - window.innerHeight > threshold

      if ((widthDiff || heightDiff) && !devtoolsOpen) {
        devtoolsOpen = true
        callbacksRef.current?.onDevToolsDetected?.()
        document.body.classList.add('nc-devtools-detected')
      } else if (!widthDiff && !heightDiff && devtoolsOpen) {
        devtoolsOpen = false
        document.body.classList.remove('nc-devtools-detected')
      }
    }

    const interval = setInterval(checkDevTools, 1000)
    return () => {
      clearInterval(interval)
      document.body.classList.remove('nc-devtools-detected')
    }
  }, [enabled])

  // ── Disable right-click (global — context menu components handle their own) ──
  useEffect(() => {
    if (!enabled) return

    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const tagName = target.tagName.toLowerCase()
      if (tagName === 'input' || tagName === 'textarea' || target.isContentEditable) return
      if (target.closest('[data-context-menu]')) return
      e.preventDefault()
    }

    document.addEventListener('contextmenu', handleContextMenu)
    return () => document.removeEventListener('contextmenu', handleContextMenu)
  }, [enabled])
}
