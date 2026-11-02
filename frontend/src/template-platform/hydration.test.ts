import { expect, it } from 'vitest'
import { createExperienceDocument } from './demo-documents'
import { hydrateTemplateDraft } from './hydration'
it('opens a recoverable draft without compiling an incomplete graph or mutating source', () => {
  const { artifacts: _, ...draft } = createExperienceDocument()
  draft.source.definition.roots.push('unfinished')
  const hydrated = hydrateTemplateDraft(draft)
  expect(hydrated.source.definition.roots).toContain('unfinished')
  expect(hydrated.artifacts.html).toBe('')
  expect(draft).not.toHaveProperty('artifacts')
})

it('promotes legacy sidecar text bindings without retaining unrelated derived bindings', () => {
  const initial = createExperienceDocument()
  initial.rendering = { engine: 'bindings', subject: 'Hello {{custom}}' }
  initial.artifacts.bindings.push({ id: 'custom', path: 'inputs.recipient', kind: 'text' })
  const hydrated = hydrateTemplateDraft(initial)
  expect(hydrated.rendering?.bindings).toEqual([{ id: 'custom', path: 'inputs.recipient', kind: 'text' }])
  expect(initial.rendering).not.toHaveProperty('bindings')
})

it('keeps an explicitly empty authored manifest authoritative over older artifacts', () => {
  const initial = createExperienceDocument()
  initial.rendering = { engine: 'shared', subject: 'Hello {{custom}}', bindings: [] }
  initial.artifacts.bindings.push({ id: 'custom', path: 'inputs.recipient', kind: 'text' })
  expect(hydrateTemplateDraft(initial).rendering?.bindings).toEqual([])
})
