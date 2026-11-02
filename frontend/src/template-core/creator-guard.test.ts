import { it, expect, vi } from 'vitest'
import { createTemplateCreator, getCreatorRuntime } from './editing'
import { createTemplateDefinition } from './defaults'
it('guards edit/load/undo/redo before changing graph, selection or history', () => {
  const source = createTemplateDefinition('Family'), calls: string[] = []
  let reject = false
  const changes = vi.fn()
  const creator = createTemplateCreator({ initialTemplate: source, onChange: changes, onError: () => {},
    validateChange: (_before, _next, operation) => { calls.push(operation); if (reject) throw new Error('Inherited graph') },
  })
  creator.actions.edit(draft => { draft.name = 'One' }); creator.actions.edit(draft => { draft.name = 'Two' })
  const runtime = getCreatorRuntime(creator); reject = true
  const before = runtime.store.getState()
  expect(() => creator.actions.edit(draft => { draft.name = 'Forbidden' })).toThrow('Inherited graph')
  expect(() => creator.actions.load(source)).toThrow('Inherited graph'); expect(() => creator.actions.undo()).toThrow('Inherited graph')
  expect(runtime.store.getState()).toMatchObject({ template: before.template, selectedId: before.selectedId, undo: before.undo, redo: before.redo })
  reject = false; creator.actions.undo(); reject = true
  const undone = runtime.store.getState()
  expect(() => creator.actions.redo()).toThrow('Inherited graph')
  expect(runtime.store.getState()).toMatchObject({ template: undone.template, undo: undone.undo, redo: undone.redo })
  expect(changes).toHaveBeenCalledTimes(3)
  expect(calls).toEqual(['edit', 'edit', 'edit', 'load', 'undo', 'undo', 'redo'])
})
it('allows semantically incomplete standalone drafts without a guard', () => {
  const creator = createTemplateCreator({ onError: () => {} }); creator.actions.edit(draft => { draft.roots = ['missing'] })
  expect(creator.getTemplate().roots).toEqual(['missing'])
})
