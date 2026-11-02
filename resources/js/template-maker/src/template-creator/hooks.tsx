import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import {
  createTemplateCreator,
  createTemplateEditor,
  getCreatorRuntime,
  getEditorRuntime,
  type TemplateCreatorInstance,
  type TemplateCreatorOptions,
  type TemplateEditorInstance,
  type TemplateEditorOptions,
} from '../template-core/editing'
import {
  TemplateError,
  type TemplateDefinition,
  type TemplateNode,
  type TemplateRevision,
  type TemplatePersonalization,
  type JsonValue,
} from '../template-core/schema'
import { getTemplateIssues } from '../template-core/validation'
import {
  getTemplateDataSchema,
  getValue,
  stableJSONStringify,
  validateJSONData,
} from '../template-core/contracts'
import { renderTemplate } from '../template-core/render'

const CreatorContext = createContext<TemplateCreatorInstance | null>(null)
const EditorContext = createContext<TemplateEditorInstance | null>(null)
const useCommitEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect
export type TemplateCreatorProviderProps = TemplateCreatorOptions & {
  instance?: TemplateCreatorInstance
  children: ReactNode
}
export function TemplateCreatorProvider({
  children,
  instance: supplied,
  ...options
}: TemplateCreatorProviderProps) {
  const owned = useRef<TemplateCreatorInstance | null>(null)
  if (!supplied && !owned.current) owned.current = createTemplateCreator(options)
  const instance = supplied ?? owned.current!
  const runtime = getCreatorRuntime(instance)
  const baseline = useMemo(() => runtime.getOptions(), [runtime])
  const { onChange, onError, validateChange } = options
  const present = ['onChange', 'onError', 'validateChange']
    .filter((key) => Object.hasOwn(options, key))
    .join('|')
  useCommitEffect(() => {
    const keys = new Set(present.split('|'))
    const callbacks = { onChange, onError, validateChange }
    runtime.configure({
      ...baseline,
      ...Object.fromEntries(Object.entries(callbacks).filter(([key]) => !supplied || keys.has(key))),
    })
  }, [runtime, baseline, supplied, present, onChange, onError, validateChange])
  useCommitEffect(
    () => () => {
      if (supplied) runtime.configure(baseline)
      else runtime.disconnect()
    },
    [runtime, baseline, supplied],
  )
  return <CreatorContext.Provider value={instance}>{children}</CreatorContext.Provider>
}
export type TemplateEditorProviderProps = (
  | (TemplateEditorOptions & { instance?: undefined })
  | (Omit<TemplateEditorOptions, 'template'> & {
      instance: TemplateEditorInstance
      template?: TemplateDefinition | TemplateRevision
    })
) & { children: ReactNode }
export function TemplateEditorProvider({
  children,
  instance: supplied,
  ...options
}: TemplateEditorProviderProps) {
  const owned = useRef<TemplateEditorInstance | null>(null)
  if (!supplied && !owned.current) {
    if (!options.template)
      throw new TemplateError('validation', 'Provide a template definition, snapshot, or editor instance.')
    owned.current = createTemplateEditor({ ...options, template: options.template })
  }
  const instance = supplied ?? owned.current!
  const runtime = getEditorRuntime(instance)
  useMemo(() => {
    if (
      supplied &&
      options.template &&
      stableJSONStringify(options.template) !== stableJSONStringify(
        options.template.format === 'gct-template' ? runtime.store.getState().template : runtime.store.getState().revision,
      )
    )
      throw new TemplateError(
        'validation',
        'The supplied editor state belongs to a different template. Pass the instance alone, or provide its matching template.',
      )
  }, [supplied, runtime, options.template])
  const baseline = useMemo(() => runtime.getOptions(), [runtime])
  const { onChange, onError } = options
  const present = ['onChange', 'onError']
    .filter((key) => Object.hasOwn(options, key))
    .join('|')
  useCommitEffect(() => {
    const keys = new Set(present.split('|'))
    const callbacks = { onChange, onError }
    runtime.configure({
      ...baseline,
      ...Object.fromEntries(Object.entries(callbacks).filter(([key]) => !supplied || keys.has(key))),
    })
  }, [runtime, baseline, supplied, present, onChange, onError])
  useCommitEffect(
    () => () => {
      if (supplied) runtime.configure(baseline)
      else runtime.disconnect()
    },
    [runtime, baseline, supplied],
  )
  return <EditorContext.Provider value={instance}>{children}</EditorContext.Provider>
}
export function useTemplateCreatorInstance() {
  const value = useContext(CreatorContext)
  if (!value) throw new Error('Wrap authoring controls in <TemplateCreatorProvider>.')
  return value
}
export function useTemplateEditorInstance() {
  const value = useContext(EditorContext)
  if (!value) throw new Error('Wrap personalization controls in <TemplateEditorProvider>.')
  return value
}
export function useTemplateDocument<T = TemplateDefinition>(
  selector: (template: TemplateDefinition) => T = (template) => template as T,
) {
  const instance = useTemplateCreatorInstance()
  return useStore(
    getCreatorRuntime(instance).store,
    useShallow((state) => selector(state.template)),
  )
}
export const useTemplateActions = () => useTemplateCreatorInstance().actions
/** Subscribe to one authoring node. Unrelated edits preserve its identity. */
export function useTemplateNode(id: string) {
  const instance = useTemplateCreatorInstance()
  const node = useStore(getCreatorRuntime(instance).store, (state) => Object.hasOwn(state.template.nodes, id) ? state.template.nodes[id] : null)
  const commands = useMemo(
    () => ({
      select: () => instance.actions.select(id),
      update: (patch: Partial<TemplateNode>) => instance.actions.updateNode(id, patch),
      remove: () => instance.actions.remove(id),
      duplicate: () => instance.actions.duplicate(id),
    }),
    [instance, id],
  )
  return useMemo(() => ({ node, ...commands }), [node, commands])
}
export function useTemplateSelection() {
  const instance = useTemplateCreatorInstance()
  const state = useStore(
    getCreatorRuntime(instance).store,
    useShallow((state) => ({
      id: state.selectedId,
      node: state.selectedId && Object.hasOwn(state.template.nodes, state.selectedId) ? state.template.nodes[state.selectedId] : null,
    })),
  )
  return useMemo(() => ({ ...state, select: instance.actions.select }), [state, instance])
}
export function useTemplateHistory() {
  const instance = useTemplateCreatorInstance()
  const state = useStore(
    getCreatorRuntime(instance).store,
    useShallow((state) => ({ canUndo: !!state.undo.length, canRedo: !!state.redo.length })),
  )
  return useMemo(
    () => ({ ...state, undo: instance.actions.undo, redo: instance.actions.redo }),
    [state, instance],
  )
}
/** Synchronous composition output; the consuming application decides what to do with it. */
export function useTemplateCreatorExport() {
  const instance = useTemplateCreatorInstance()
  return useMemo(() => ({ render: instance.render, exportDocument: instance.exportDocument }), [instance])
}
export function useTemplateContract() {
  const template = useTemplateDocument()
  const instance = useTemplateCreatorInstance()
  const error = useStore(getCreatorRuntime(instance).store, state => state.error)
  const clearError = useMemo(() => () => getCreatorRuntime(instance).store.setState({ error: null }), [instance])
  return useMemo(() => {
    const issues = getTemplateIssues(template)
    try {
      return { schema: getTemplateDataSchema(template), issues, error, clearError }
    } catch {
      return { schema: null, issues, error, clearError }
    }
  }, [template, error, clearError])
}
/** Select template/personalization data without subscribing to selection or local errors. */
export interface TemplateEditorDocument {
  template: TemplateDefinition
  revision: TemplateRevision
  personalization: TemplatePersonalization
}
export function useTemplateEditorDocument<T = TemplateEditorDocument>(
  selector?: (document: TemplateEditorDocument) => T,
) {
  const instance = useTemplateEditorInstance()
  return useStore(getEditorRuntime(instance).store, useShallow(state => {
    const document = { template: state.template, revision: state.revision, personalization: state.personalization }
    return selector ? selector(document) : document as T
  }))
}
/** Stable personalization commands; no state subscription. */
export const useTemplateEditorActions = () => useTemplateEditorInstance().actions
export function useTemplateEditorSelection() {
  const instance = useTemplateEditorInstance()
  const state = useStore(getEditorRuntime(instance).store, useShallow(state => ({
    id: state.selectedId,
    node: state.selectedId && Object.hasOwn(state.revision.template.nodes, state.selectedId) ? state.revision.template.nodes[state.selectedId] : null,
  })))
  return useMemo(() => ({ ...state, select: instance.actions.select }), [state, instance])
}
export function useTemplateEditorHistory() {
  const instance = useTemplateEditorInstance()
  const state = useStore(getEditorRuntime(instance).store, useShallow(state => ({
    canUndo: !!state.undo.length, canRedo: !!state.redo.length,
  })))
  return useMemo(() => ({ ...state, undo: instance.actions.undo, redo: instance.actions.redo }), [state, instance])
}
export function useTemplateEditorExport() {
  const instance = useTemplateEditorInstance()
  return useMemo(() => ({ render: instance.render, exportDocument: instance.exportDocument }), [instance])
}
export function useTemplateEditorValidation() {
  const document = useTemplateEditorDocument()
  return useMemo(() => ({ issues: renderTemplate(document.revision, {
    personalization: document.personalization,
  }).issues }), [document.revision, document.personalization])
}
export function useTemplatePersonalization() {
  const document = useTemplateEditorDocument()
  const selection = useTemplateEditorSelection()
  const history = useTemplateEditorHistory()
  const exporting = useTemplateEditorExport()
  const validation = useTemplateEditorValidation()
  const actions = useTemplateEditorActions()
  const instance = useTemplateEditorInstance()
  const error = useStore(getEditorRuntime(instance).store, state => state.error)
  return useMemo(() => ({ ...document, selectedId: selection.id, canUndo: history.canUndo, canRedo: history.canRedo,
    ...exporting, ...validation, error, actions }), [document, selection.id, history, exporting, validation, error, actions])
}

/** Subscribe to one runtime field, including its contract and validation messages. */
export function useTemplateDataField(id: string) {
  const instance = useTemplateEditorInstance()
  const state = useStore(
    getEditorRuntime(instance).store,
    useShallow((state) => {
      const field = state.revision.template.fields.find((field) => field.id === id) ?? null
      return { field, value: field ? getValue(state.personalization.data, field.path) : undefined }
    }),
  )
  const setValue = useMemo(
    () => (value: JsonValue | undefined) => instance.actions.setField(id, value),
    [instance, id],
  )
  return useMemo(
    () => ({
      ...state,
      editable: state.field?.editable ?? false,
      issues:
        state.field && (state.value !== undefined || state.field.required)
          ? validateJSONData(state.field.schema, state.value).map((issue) => ({
              ...issue,
              path: `${state.field!.path}${issue.path === '/' ? '' : issue.path}`,
            }))
          : [],
      setValue,
    }),
    [state, setValue],
  )
}
