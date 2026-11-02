import type { BindingDocument, StandaloneTemplateDraft } from './types'

/** Open saved authoring source without compiling it or claiming placeholder output is publishable. */
export function hydrateTemplateDraft(source: StandaloneTemplateDraft): BindingDocument {
  const copy = structuredClone(source)
  const subject = copy.rendering?.subject ?? copy.artifacts?.subject
  const text = copy.rendering?.text ?? copy.artifacts?.text
  const sidecars = [subject, text].join('\n')
  const bindings = copy.rendering?.bindings ?? copy.artifacts?.bindings
    .filter(binding => binding.kind === 'text' && sidecars.includes(`{{${binding.id}}}`))
    .map(binding => ({ id: binding.id, path: binding.path, kind: 'text' as const }))
  const hasBindings = copy.rendering?.bindings !== undefined || Boolean(bindings?.length)
  const rendering: NonNullable<BindingDocument['rendering']> = {
    engine: copy.rendering?.engine ?? copy.artifacts?.engine ?? 'shared',
    ...(subject !== undefined ? { subject } : {}), ...(text !== undefined ? { text } : {}),
    ...(hasBindings ? { bindings: bindings ?? [] } : {}),
  }
  return { ...copy, rendering, artifacts: copy.artifacts ?? { engine: rendering.engine, html: '', css: '', bindings: structuredClone(rendering.bindings ?? []), subject: rendering.subject, text: rendering.text } }
}
