import { useEffect, useState } from 'react'

const REVEAL_DRAFT = 'template-builder:reveal-draft'
function invalidFields(root: HTMLElement | null) {
  // A field and its labelled wrapper may both mark the same invalid draft.
  return [...(root?.querySelectorAll<HTMLElement>('[aria-invalid="true"]') ?? [])]
    .filter(field => !field.querySelector('[aria-invalid="true"]'))
}

/** Retained/closed panels still contain unfinished edits that block export. */
export function useInvalidDrafts(root: HTMLElement | null) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!root) { setCount(0); return }
    const inspect = () => setCount(invalidFields(root).length)
    inspect()
    const observer = new MutationObserver(inspect)
    observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-invalid'] })
    return () => observer.disconnect()
  }, [root])
  return { count, firstInvalid: () => invalidFields(root)[0] ?? null }
}

/** App-owned disclosures react without depending on a library's DOM anatomy. */
export function useDraftReveal(body: HTMLElement | null, onReveal: (event: Event) => void) {
  useEffect(() => {
    if (!body) return
    body.addEventListener(REVEAL_DRAFT, onReveal)
    return () => body.removeEventListener(REVEAL_DRAFT, onReveal)
  }, [body, onReveal])
}

export function revealDraftField(target: HTMLElement) {
  target.dispatchEvent(new CustomEvent(REVEAL_DRAFT, { bubbles: true }))
  // Navigation/disclosure state is committed before trying to focus the field.
  let attempts = 0
  const focus = () => {
    if (!target.isConnected) return
    if (target.closest('[hidden], [inert]')) {
      if (++attempts < 12) requestAnimationFrame(focus)
      return
    }
    const selector = 'input:not([type="hidden"]), textarea, select, button, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]'
    const field = target.matches(selector) ? target : [...target.querySelectorAll<HTMLElement>(selector)]
      .find(candidate => !candidate.matches(':disabled') && !candidate.closest('[hidden], [inert]'))
    if (!field) return
    field.focus({ preventScroll: true })
    field.scrollIntoView?.({ block: 'nearest', behavior: 'instant' })
  }
  requestAnimationFrame(focus)
}
