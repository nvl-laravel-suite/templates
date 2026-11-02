import { Badge } from 'themelia-react-ui/base/badge'
import { Item } from 'themelia-react-ui/base/item'
import { EmptyState } from 'themelia-react-ui/blocks/data-display'
import { Alert, AlertDescription } from 'themelia-react-ui/base/feedback'
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { nanoid } from 'nanoid'
import {
  ArrowDown,
  ArrowUp,
  Braces,
  ChevronRight,
  Code2,
  Copy,
  Download,
  Ellipsis,
  FilePlus2,
  Image,
  Layers3,
  Plus,
  Redo2,
  SlidersHorizontal,
  Trash2,
  Undo2,
  Upload,
  X,
} from 'lucide-react'
import { VoucherPortalContext } from '../voucher-builder/context'
import { ActionDialog, ConfirmDialog, useOverlayVisibility } from 'themelia-react-ui/features/overlays'
import { Card } from 'themelia-react-ui/base/cards'
import { ListRadioGroup } from 'themelia-react-ui/base/choice-inputs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, OverflowTabBar } from 'themelia-react-ui/base/navigation'
import { Tree as StructureTree, type TreeNode } from 'themelia-react-ui/base/tree'
import { CodeBlock } from 'themelia-react-ui/base/code-block'
import {
  DataSchemaSchema,
  HTML_TAGS,
  JsonValueSchema,
  getTemplateJSONSchemas,
  type DataSchema,
  type TemplateField,
  type TemplateNode,
  type TemplateDefinition,
  type JsonObject,
} from '../template-core/schema'
import { childIds, nodeValues } from '../template-core/validation'
import { discoverTemplateClasses, safeTemplateURL, compileTemplateCSS } from '../template-core/styles'
import type { TemplateDocumentExport } from '../template-core/editing'
import { createInvoiceTemplate, createTemplateDefinition } from '../template-core/defaults'
import {
  TemplateCreatorProvider,
  useTemplateActions,
  useTemplateContract,
  useTemplateDocument,
  useTemplateHistory,
  useTemplateSelection,
  useTemplateCreatorInstance,
  type TemplateCreatorProviderProps,
} from './hooks'
import {
  CommitInput,
  Field,
  JsonInput,
  Toggle,
  ValueInput,
  defaultDataSchema,
  STYLE_LABELS,
} from './controls'
import { TemplateCanvas } from './canvas'
import { CanvasNodeActions } from './canvas-element-frame'
import { BlockDefinitionDialog, BlockInstanceControls } from './block-controls'
import { exportTemplateBlock } from '../template-core/blocks'
import { templateNodeLabel } from '../template-core/labels'
import { Button as Action } from 'themelia-react-ui/base/buttons'
import { Page, type PageHeaderProps } from 'themelia-react-ui/layout/page'
import { Stack, Grid } from 'themelia-react-ui/base/structure'
import { Heading, Text } from 'themelia-react-ui/typography'
import { ThemeScope } from 'themelia-react-ui/ui-provider'
import { Input } from 'themelia-react-ui/base/text-inputs'
import { Select } from 'themelia-react-ui/base/choice-inputs'
import { downloadJSON, downloadText } from './downloads'
import { getTemplatePresets, type TemplateInsertPreset } from '../template-core/presets'
import { templateInsertionParent } from './insertion'
import { InsertionPicker } from './insertion-picker'
import { ColumnLayoutControls } from './layout-controls'
import { LinkControls } from './element-bindings'
import { TextNodeControls } from './text-controls'
import '../voucher-builder/styles.css'
import { WorkspaceGrid, WorkspacePanel } from './workspace-panel'
import { revealDraftField, useInvalidDrafts } from '../shared/draft-validation'
import { InspectorSection } from './inspector-section'
import { getEmailPresets } from '../template-email/presets'
import { EMAIL_PROFILE, assertEmailTemplate, emailStyleProblem } from '../template-email/profile'
import { finalizeTemplateOutput } from '../template-platform/output'
import './workspace.css'

/** Native disclosure retains unfinished JSON drafts while the panel is collapsed. */
function AdvancedSettings({ title, children }: { title: string; children: ReactNode }) {
  return <InspectorSection title={title}>{children}</InspectorSection>
}

export interface TemplateCreatorPanel {
  id: string
  label: string
  content: ReactNode
  inspector?: ReactNode
  /** Selected subject in this tool, when it differs from the navigation label. */
  inspectorTitle?: ReactNode
}
export interface TemplateCreatorExtensions {
  /** Optional compact canvas and persistent right tools dock. Defaults to three panes. */
  layout?: 'default' | 'compact'
  /** Host-owned controls placed with canvas tools, outside the exported document. */
  canvasControls?: ReactNode
  /** Initially selected available tool. Later changes do not reset local navigation. */
  initialPanel?: string
  /** Replace the default JSON preset catalog. Dependencies belong to the supplied template. */
  insertPresets?: TemplateInsertPreset[]
  workspacePanels?: TemplateCreatorPanel[]
  inspectorFooter?: ReactNode
  header?: Partial<PageHeaderProps>
  previewTransform?: (template: TemplateDefinition) => TemplateDefinition
  previewTarget?: 'document' | 'email'
  previewData?: JsonObject
  fieldPathPrefix?: string
  builtInPanels?: ('structure' | 'fields' | 'styles' | 'assets' | 'blocks')[]
  allowTemplateImport?: boolean
  canInsert?: (parentId: string | null) => boolean
  /** Return undefined to retain the existing inspector for this selection. */
  nodeInspector?: (node: TemplateNode | null) => ReactNode | undefined
}
export type TemplateCreatorProps = Omit<TemplateCreatorProviderProps, 'children'> & TemplateCreatorExtensions & {
  className?: string
  theme?: 'light' | 'dark'
  /** Receive composition output; the host decides how to store or send it. */
  onExport?: (result: TemplateDocumentExport) => void
}
export function TemplateCreator({ className = '', theme = 'light', layout, canvasControls, initialPanel, onExport, workspacePanels, inspectorFooter, header, previewTransform, previewTarget, previewData, fieldPathPrefix, builtInPanels, allowTemplateImport, canInsert, nodeInspector, insertPresets, ...options }: TemplateCreatorProps) {
  return (
    <div className="tc-shell">
      <TemplateCreatorProvider {...options}>
        <CreatorWorkspace
          className={`${className} ${theme === 'dark' ? 'dark' : 'light'}`}
          insertPresets={insertPresets}
          layout={layout} canvasControls={canvasControls} initialPanel={initialPanel}
          onExport={onExport}
          workspacePanels={workspacePanels} inspectorFooter={inspectorFooter} header={header} previewTransform={previewTransform} previewTarget={previewTarget} previewData={previewData} fieldPathPrefix={fieldPathPrefix} builtInPanels={builtInPanels} allowTemplateImport={allowTemplateImport} canInsert={canInsert} nodeInspector={nodeInspector}
        />
      </TemplateCreatorProvider>
    </div>
  )
}
type Panel = 'structure' | 'fields' | 'styles' | 'assets' | 'blocks'
const panels: { id: Panel; label: string; icon: ReactNode }[] = [
  { id: 'structure', label: 'Structure', icon: <Layers3 /> },
  { id: 'fields', label: 'Fields', icon: <Braces /> },
  { id: 'styles', label: 'Styles', icon: <Code2 /> },
  { id: 'assets', label: 'Assets', icon: <Image /> },
  { id: 'blocks', label: 'Reusable blocks', icon: <Copy /> },
]

const workAreas = [
  { id: 'build', label: 'Build' },
  { id: 'library', label: 'Library' },
  { id: 'setup', label: 'Setup' },
]
function workArea(panel: string) {
  if (['structure', 'fields', 'variant-content', 'variant-points'].includes(panel)) return 'build'
  if (['assets', 'blocks'].includes(panel)) return 'library'
  return 'setup'
}
const panelOrder = ['structure', 'fields', 'variant-content', 'variant-points', 'assets', 'blocks', 'document-theme', 'variant-appearance', 'appearance-settings', 'variant-access', 'family-variations', 'email-checks', 'styles']
const panelHeadings: Record<string, string> = {
  structure: 'Document outline', fields: 'Data fields', styles: 'Document CSS',
  assets: 'Template images', blocks: 'Block library',
}

function CreatorWorkspace({ className, layout = 'default', canvasControls, initialPanel, onExport, workspacePanels = [], inspectorFooter, header, previewTransform, previewTarget, previewData, fieldPathPrefix = '', builtInPanels, allowTemplateImport = true, canInsert, nodeInspector, insertPresets }: { className: string; onExport?: (result: TemplateDocumentExport) => void } & TemplateCreatorExtensions) {
  const template = useTemplateDocument()
  const actions = useTemplateActions()
  const fieldChoiceName = useId()
  const selection = useTemplateSelection()
  const history = useTemplateHistory()
  const contract = useTemplateContract()
  const instance = useTemplateCreatorInstance()
  const importRef = useRef<HTMLInputElement>(null)
  const defaultPresets = useMemo(() => previewTarget === 'email' ? getEmailPresets() : getTemplatePresets(), [previewTarget])
  const [panel, setCurrentPanel] = useState<string>(() => {
    const allowed = [...panels.filter(item => !builtInPanels || builtInPanels.includes(item.id)), ...workspacePanels]
    return allowed.find(item => item.id === initialPanel)?.id ?? (builtInPanels?.length === 0 ? workspacePanels[0]?.id ?? '__selection-properties' : builtInPanels?.[0] ?? 'structure')
  })
  const previousPanels = useRef<Record<string, string>>({ [workArea(panel)]: panel })
  const [visitedPanels, setVisitedPanels] = useState(() => new Set([panel]))
  const [compactView, setCompactView] = useState<'properties' | 'structure' | 'tool'>(() => panel === 'structure' || panel === '__selection-properties' ? 'properties' : 'tool')
  const [dockOpen, setDockOpen] = useState(false)
  const setPanel = (next: string) => {
    previousPanels.current[workArea(next)] = next
    setVisitedPanels(previous => previous.has(next) ? previous : new Set([...previous, next]))
    setCurrentPanel(next)
    setCompactView(next === 'structure' ? 'structure' : 'tool')
  }
  const openProperties = () => { setPanel('__selection-properties'); setCompactView('properties'); setDockOpen(true) }
  const allPanels = [...panels.filter(item => !builtInPanels || builtInPanels.includes(item.id)), ...workspacePanels].sort((a, b) => (panelOrder.includes(a.id) ? panelOrder.indexOf(a.id) : 100) - (panelOrder.includes(b.id) ? panelOrder.indexOf(b.id) : 100))
  const area = workArea(panel)
  const availableAreas = workAreas.filter(group => allPanels.some(item => workArea(item.id) === group.id))
  const areaPanels = allPanels.filter(item => workArea(item.id) === area)
  const selectArea = (next: string) => {
    const remembered = previousPanels.current[next]
    const target = allPanels.find(item => item.id === remembered && workArea(item.id) === next) ?? allPanels.find(item => workArea(item.id) === next)
    if (target) setPanel(target.id)
  }
  const contextVisited = [...visitedPanels].some(id => id !== 'fields' && workspacePanels.find(item => item.id === id)?.inspector === undefined)
  const customInspector = nodeInspector?.(selection.node)
  const extension = workspacePanels.find(item => item.id === panel)
  const [fieldId, setFieldId] = useState<string | null>(template.fields[0]?.id ?? null)
  const [portal, setPortal] = useState<HTMLDivElement | null>(null)
  const drafts = useInvalidDrafts(portal)
  const reviewDraft = () => {
    const field = drafts.firstInvalid()
    if (!field) return
    const tool = field.closest<HTMLElement>('[data-creator-panel]')?.dataset.creatorPanel
    if (tool && tool !== '__selection-properties') { setPanel(tool); setDockOpen(true) }
    else if (layout === 'compact') openProperties()
    else {
      const contextPanel = allPanels.find(item => item.id !== 'fields' && workspacePanels.find(extension => extension.id === item.id)?.inspector === undefined)
      setPanel(contextPanel?.id ?? '__selection-properties')
    }
    revealDraftField(field)
  }
  const editProperties = () => {
    openProperties()
    requestAnimationFrame(() => {
      const inspector = portal?.querySelector<HTMLElement>('.tc-inspector')
      const field = [...(inspector?.querySelectorAll<HTMLElement>('input:not([type="hidden"]), textarea, [role="combobox"], [role="checkbox"], [role="switch"]') ?? [])]
        .find(target => !target.closest('[hidden], [inert]') && !target.matches(':disabled'))
      if (inspector?.isConnected) (field ?? inspector).focus({ preventScroll: true })
    })
  }
  const [message, setMessage] = useState('')
  const [removeId, setRemoveId] = useState<string | null>(null)
  const removeTrigger = useRef<HTMLElement | null>(null)
  const restoreRemoveFocus = useRef(false)
  useEffect(() => {
    if (removeId || !restoreRemoveFocus.current) return
    restoreRemoveFocus.current = false
    const frame = requestAnimationFrame(() => {
      (removeTrigger.current?.isConnected ? removeTrigger.current : portal?.querySelector<HTMLElement>('.tc-canvas'))?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [removeId, portal])
  const requestRemove = (id: string) => {
    removeTrigger.current = portal?.ownerDocument.activeElement as HTMLElement | null
    setRemoveId(id)
  }
  useEffect(() => setMessage(''), [template.id])
  const { open: schemaOpen, setOpen: setSchemaOpen } = useOverlayVisibility()
  const { open: blockOpen, setOpen: setBlockOpen } = useOverlayVisibility()
  const [blockName, setBlockName] = useState('')
  const [editingBlock, setEditingBlock] = useState<{ id: string; version: number } | null>(null)
  const editedDefinition = template.blocks.find(block => block.id === editingBlock?.id && block.version === editingBlock.version)
  const run = (task: () => unknown) => {
    try {
      setMessage('')
      const result = task()
      if (result && typeof (result as PromiseLike<unknown>).then === 'function')
        void Promise.resolve(result).catch((error) => setMessage(error instanceof Error ? error.message : String(error)))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    }
  }
  const submit = (task: () => unknown) =>
    run(() => {
      if (portal?.querySelector('[aria-invalid="true"]'))
        throw new Error('Fix the highlighted fields before exporting.')
      return task()
    })
  const select = (id: string | null) => {
    actions.select(id)
    if (panel === 'fields') setPanel('structure')
  }
  const selectCanvas = (id: string | null) => {
    select(id)
    if (layout === 'compact') openProperties()
  }
  const insertParent = templateInsertionParent(template, selection.id)
  const selectedParent = selection.node && Object.values(template.nodes).find(node => childIds(node).includes(selection.node!.id))
  const selectedSiblings = selectedParent ? childIds(selectedParent) : template.roots
  const selectedIndex = selectedSiblings.indexOf(selection.id ?? '')
  const canReorder = selectedParent?.kind !== 'block'
  const canvasActions = selection.node && customInspector === undefined ? <CanvasNodeActions
    up={canReorder && selectedIndex > 0 ? () => run(() => actions.move(selection.id!, selectedParent?.id ?? null, selectedIndex - 1)) : undefined}
    down={canReorder && selectedIndex >= 0 && selectedIndex < selectedSiblings.length - 1 ? () => run(() => actions.move(selection.id!, selectedParent?.id ?? null, selectedIndex + 1)) : undefined}
    duplicate={() => run(() => actions.duplicate(selection.id!))} remove={() => requestRemove(selection.id!)}
  /> : undefined
  const selectedField = template.fields.find((field) => field.id === fieldId) ?? template.fields[0]
  const exportFile = (format: 'html' | 'json') => submit(() => {
    const result = instance.exportDocument(format)
    if (format === 'html' && previewTarget === 'email') {
      assertEmailTemplate(template)
      result.data = finalizeTemplateOutput(result.data, 'email')
    }
    if (onExport) return onExport(result)
    downloadText(result.data, result.filename, result.mimeType)
  })
  const addField = () => {
    const id = `field_${nanoid(8).replace(/-/g, '_')}`
    actions.edit((draft) => {
      let suffix = draft.fields.length + 1
      while (draft.fields.some((field) => field.path === `${fieldPathPrefix}field${suffix}`)) suffix++
      draft.fields.push({
        id,
        path: `${fieldPathPrefix}field${suffix}`,
        label: 'New field',
        description: '',
        schema: { type: 'string', minLength: 1 },
        required: true,
        editable: true,
      })
    })
    setFieldId(id)
  }
  return (
    <VoucherPortalContext.Provider value={portal}>
      <ThemeScope ref={setPortal} className={`tc-workspace ${className}`}>
        <Page
          className="tc-page"
          maxWidth="full"
          gutter="md"
          padding="md"
          slotProps={{ body: { className: 'tc-page-body' } }}
          header={{
            title: template.name,
            description: 'Compose the layout, connect your data and choose what customers can edit.',
            primaryAction: {
              label: 'Export HTML',
              disabled: contract.issues.length > 0 || !template.roots.length,
              onClick: () => exportFile('html'),
            },
            secondaryActions: [
              {
                label: 'Export JSON',
                onClick: () => exportFile('json'),
              },
              { label: 'Data contract', onClick: () => setSchemaOpen(true) },
            ],
            tabs: layout === 'compact' ? undefined : {
              items: availableAreas,
              value: area,
              onValueChange: selectArea,
              label: 'Editor work areas',
            },
            ...header,
          }}
        >
          <WorkspaceGrid layout={layout} prioritizeInspector={Boolean(extension?.inspector)} dockOpen={dockOpen} onDockOpenChange={setDockOpen}
            dockSidebarHidden={compactView === 'properties'}
            dockInspectorHidden={compactView === 'structure' || (compactView === 'tool' && panel !== 'fields' && extension?.inspector === undefined)}
            dockNavigation={<Stack gap="sm">
              <OverflowTabBar items={[{ id: 'properties', label: 'Properties' }, ...(allPanels.some(item => item.id === 'structure') ? [{ id: 'structure', label: 'Structure' }] : [])]} value={compactView === 'tool' ? '' : compactView}
                onValueChange={value => { if (value === 'properties') openProperties(); else { setPanel('structure'); setDockOpen(true) } }} strings={{ navigationLabel: 'Editing panels', more: 'More panels' }} />
              <Select aria-label="Editor tool" placeholder="More tools…" value={compactView === 'tool' ? panel : ''}
                options={allPanels.filter(item => item.id !== 'structure').map(item => ({ value: item.id, label: item.label }))}
                onValueChange={value => { if (value) { setPanel(value); setDockOpen(true) } }} />
            </Stack>}>
            <WorkspacePanel area="sidebar"><aside className="tc-sidebar" aria-label={panelHeadings[panel] ?? allPanels.find((item) => item.id === panel)?.label}>
              {layout !== 'compact' && <div className="tc-panel-navigation"><OverflowTabBar items={areaPanels.map(({ id, label }) => ({ id, label }))} value={panel} onValueChange={setPanel} strings={{ navigationLabel: 'Creator panels', more: 'More tools' }} /></div>}
              <Stack
                direction="horizontal"
                align="center"
                justify="between"
                gap="lg"
                className="tc-panel-heading"
              >
                <Heading tag="h2" size="sm">
                  {panelHeadings[panel] ?? allPanels.find((item) => item.id === panel)?.label}
                </Heading>
                {panel === 'fields' && (
                  <Action size="sm" iconOnly aria-label="Add field" onClick={() => run(addField)}>
                    <Plus />
                  </Action>
                )}
              </Stack>
              {workspacePanels.filter(item => visitedPanels.has(item.id)).map(item => <div key={item.id} hidden={panel !== item.id} className="tc-panel-view" data-creator-panel={item.id}><div className="tc-panel-content">{item.content}</div></div>)}
              {visitedPanels.has('structure') && <div hidden={panel !== 'structure'} data-creator-panel="structure" className="tc-panel-view">
                  <Text type="secondary" className="tc-panel-intro">
                    Select a block to edit its content, layout and access.
                  </Text>
                  <div className="tc-tree">
                    <Tree
                      ids={template.roots}
                      nodes={template.nodes}
                      selected={selection.id}
                      select={select}
                    />
                  </div>
                  <Stack gap="lg" className="tc-sidebar-bottom">
                    {layout === 'compact' && <Action onClick={editProperties}>Edit properties</Action>}
                    <Action disabled={canInsert ? !canInsert(null) : false} onClick={() => run(() => previewTarget === 'email' ? actions.insertFragment(getEmailPresets().find(preset => preset.id === 'email-section')!.fragment) : actions.insert('section'))}>
                      <Plus />
                      Add section
                    </Action>
                    {allowTemplateImport && <Action buttonStyle="ghost" onClick={() => importRef.current?.click()}>
                      <Upload />
                      Import template
                    </Action>}
                  </Stack>
              </div>}
              {visitedPanels.has('fields') && <div hidden={panel !== 'fields'} data-creator-panel="fields" className="tc-panel-view">
                  <Text type="secondary" className="tc-panel-intro">
                    Define expected values and preview samples.
                  </Text>
                  <div className="tc-field-navigation" role="group" aria-label="Template fields">
                    <ListRadioGroup
                      name={fieldChoiceName}
                      options={template.fields.map((field) => ({
                        value: field.id,
                        label: field.label,
                        description: `${field.path} · ${field.schema.type}`,
                      }))}
                      value={selectedField?.id}
                      onValueChange={setFieldId}
                    />
                  </div>
                  <Stack gap="lg" className="tc-sidebar-bottom">
                    <Action onClick={() => run(addField)}>
                      <Plus />
                      Add data field
                    </Action>
                  </Stack>
              </div>}
              {visitedPanels.has('styles') && <div hidden={panel !== 'styles'} data-creator-panel="styles" className="tc-panel-view"><StylesPanel /></div>}
              {visitedPanels.has('assets') && <div hidden={panel !== 'assets'} data-creator-panel="assets" className="tc-panel-view"><AssetsPanel run={run} email={previewTarget === 'email'} /></div>}
              {visitedPanels.has('blocks') && <div hidden={panel !== 'blocks'} data-creator-panel="blocks" className="tc-panel-view">
                  <Text type="secondary" className="tc-panel-intro">
                    Insert a saved block or reuse the selected structure.
                  </Text>
                  <Stack gap="2xl" className="tc-list">
                    {template.blocks.map((block) => (
                      <Card
                        surface="flat"
                        padding="none"
                        key={`${block.id}@${block.version}`}
                        title={<span className="[overflow-wrap:anywhere]">{block.name}</span>}
                        titleSuffix={<Badge>v{block.version}</Badge>}
                        description={`${Object.keys(block.props).length} ${Object.keys(block.props).length === 1 ? 'property' : 'properties'} · ${Object.keys(block.nodes).length} ${Object.keys(block.nodes).length === 1 ? 'element' : 'elements'}`}
                        actionsLabel={`Actions for block ${block.name}`}
                        actions={[
                          { label: 'Edit definition', onClick: () => setEditingBlock({ id: block.id, version: block.version }) },
                          { label: 'Export block', onClick: () => run(() => downloadJSON(
                            exportTemplateBlock(template, block.id, block.version), `${block.id}-v${block.version}`)) },
                          {
                            label: 'Save new version',
                            disabled: !selection.id,
                            onClick: () =>
                              run(() => {
                                if (selection.id) actions.saveBlock(selection.id, block.name, block.id)
                              }),
                          },
                        ]}
                        footerSlot={
                          <Action
                            onClick={() =>
                              run(() => actions.insertBlock(block.id, block.version, insertParent))
                            }
                          >
                            Insert block
                          </Action>
                        }
                      />
                    ))}
                    {!template.blocks.length && (
                      <EmptyState
                        padding="sm"
                        title="Your building blocks"
                        description="Select a section in the canvas, then save it here to reuse its structure and bindings."
                      />
                    )}
                  </Stack>
                  <Stack gap="lg" className="tc-sidebar-bottom">
                    <Action buttonStyle="ghost" onClick={() => importRef.current?.click()}><Upload />Import block library</Action>
                    <Action
                      disabled={!selection.id}
                      onClick={() => {
                        setBlockName(selection.node?.name ?? 'Reusable block')
                        setBlockOpen(true)
                      }}
                    >
                      <Plus />
                      Save selected as block
                    </Action>
                  </Stack>
              </div>}
            </aside></WorkspacePanel>
            <WorkspacePanel area="design"><div className="tc-design">
              <Stack direction="horizontal" align="center" justify="between" gap="sm" className="tc-toolbar">
                <Stack direction="horizontal" align="center" gap="sm" wrap>
                  {canvasControls}
                  <Action iconOnly buttonStyle="ghost" aria-label="Undo" disabled={!history.canUndo} onClick={history.undo}>
                    <Undo2 />
                  </Action>
                  <Action iconOnly buttonStyle="ghost" aria-label="Redo" disabled={!history.canRedo} onClick={history.redo}>
                    <Redo2 />
                  </Action>

                  <InsertionPicker presets={insertPresets ?? defaultPresets} selectedId={selection.id} canInsert={canInsert}
                    disabled={panel === 'fields'} run={run} />
                </Stack>
                <Text type="secondary" className="tc-toolbar-context">
                  {panel === 'fields'
                    ? 'Design preview · sample data'
                    : insertParent
                      ? `Inside ${template.nodes[insertParent]?.name}`
                      : 'Document root'}
                </Text>
              </Stack>
              <TemplateCanvas
                template={template}
                previewTransform={previewTransform} target={previewTarget} data={previewData}
                selectedId={panel === 'fields' ? null : selection.id}
                onSelect={selectCanvas}
                selectionActions={canvasActions}
                selectionDescription={selection.node && customInspector !== undefined ? 'Managed structure' : undefined}
              />
              <Stack
                render={<footer />}
                direction="horizontal"
                align="center"
                justify="between"
                gap="sm"
                className="tc-footer"
              >
                <Text type="secondary" size="sm">
                  {Object.keys(template.nodes).length} elements{template.fields.length ? ` · ${template.fields.length} data fields` : ''}
                </Text>
                <Action
                  buttonStyle="ghost"
                  onClick={drafts.count ? reviewDraft : () => setSchemaOpen(true)}
                  tone={drafts.count ? 'destructive' : contract.issues.length ? 'warning' : undefined}
                >
                  {drafts.count
                    ? `${drafts.count} ${drafts.count === 1 ? 'field needs' : 'fields need'} attention`
                    : contract.issues.length
                    ? `${contract.issues.length} ${contract.issues.length === 1 ? 'check' : 'checks'} to resolve`
                    : 'Template contract valid'}
                </Action>
              </Stack>
            </div></WorkspacePanel>
            <WorkspacePanel area="inspector"><aside className="tc-inspector" aria-label="Template inspector" tabIndex={-1}>
              <Stack
                direction="horizontal"
                align="center"
                justify="between"
                gap="lg"
                className="tc-panel-heading"
              >
                <Heading tag="h2" size="sm">
                  {extension?.inspector ? extension.inspectorTitle ?? extension.label : panel === 'fields'
                    ? selectedField
                      ? 'Field contract'
                      : 'No field selected'
                    : selection.node
                      ? selection.node.name
                      : 'Document settings'}
                </Heading>
                {selection.node && panel !== 'fields' && !extension?.inspector && <Stack direction="horizontal" align="center" gap="xs">
                  <Action size="sm" iconOnly buttonStyle="ghost" aria-label="Document settings" onClick={() => actions.select(null)}><SlidersHorizontal /></Action>
                  {customInspector === undefined && <DropdownMenu>
                    <DropdownMenuTrigger render={<Action size="sm" iconOnly buttonStyle="ghost" aria-label="Element actions" />}><Ellipsis /></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem disabled={!canReorder || selectedIndex <= 0} onClick={() => run(() => actions.move(selection.id!, selectedParent?.id ?? null, selectedIndex - 1))}><ArrowUp />Move element up</DropdownMenuItem>
                      <DropdownMenuItem disabled={!canReorder || selectedIndex < 0 || selectedIndex >= selectedSiblings.length - 1} onClick={() => run(() => actions.move(selection.id!, selectedParent?.id ?? null, selectedIndex + 1))}><ArrowDown />Move element down</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => run(() => actions.duplicate(selection.id!))}><Copy />Duplicate element</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setBlockName(selection.node?.name ?? 'Reusable block'); setBlockOpen(true) }}><Layers3 />Save as reusable block</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onClick={() => requestRemove(selection.id!)}><Trash2 />Remove element</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>}
                </Stack>}
              </Stack>
              <Stack gap="xl" className="tc-inspector-scroll">
                {workspacePanels.filter(item => visitedPanels.has(item.id) && item.inspector !== undefined).map(item => <div key={item.id} hidden={panel !== item.id} data-creator-panel={item.id}>{item.inspector}</div>)}
                {visitedPanels.has('fields') && <div hidden={panel !== 'fields'} data-creator-panel="fields"><Stack gap="xl">{
                  selectedField ? (
                    <FieldInspector key={selectedField.id} field={selectedField} run={run} />
                  ) : (
                    <EmptyState
                      padding="sm"
                      title="No data fields yet"
                      description="Add a field to define the data your template expects."
                    />
                  )
                }</Stack></div>}
                {contextVisited && <div hidden={panel === 'fields' || extension?.inspector !== undefined} data-creator-panel="__selection-properties"><Stack gap="xl">{customInspector !== undefined ? customInspector : selection.node ? (
                  <NodeInspector
                    email={previewTarget === 'email'}
                    key={selection.node.id}
                    node={selection.node}
                    run={run}
                  />
                ) : (
                  <PageInspector email={previewTarget === 'email'} />
                )}</Stack></div>}
                {contextVisited && inspectorFooter && <div hidden={panel === 'fields' || extension?.inspector !== undefined} data-creator-panel="__selection-properties"><InspectorSection title="Customer and family access">{inspectorFooter}</InspectorSection></div>}
              </Stack>
            </aside></WorkspacePanel>
          </WorkspaceGrid>
        </Page>
        <ConfirmDialog open={Boolean(removeId && template.nodes[removeId])} onOpenChange={open => { if (!open) setRemoveId(null) }}
          onClose={() => { restoreRemoveFocus.current = true; setRemoveId(null) }}
          title={`Remove ${removeId && template.nodes[removeId] ? templateNodeLabel(template.nodes[removeId]) : 'element'}?`}
          description="This removes the element and its contents. You can undo this change."
          destructive strings={{ confirm: 'Remove element', cancel: 'Keep element' }}
          onConfirm={() => { if (removeId) run(() => actions.remove(removeId)); setRemoveId(null) }} />
        {(message || contract.error) && (
          <Alert role="alert" tone="destructive" className="tc-toast">
            <Stack direction="horizontal" align="center" justify="between" gap="lg">
              <AlertDescription>{message || contract.error?.message}</AlertDescription>
              <Action
                buttonStyle="ghost"
                aria-label="Dismiss message"
                onClick={() => {
                  setMessage('')
                  contract.clearError()
                }}
              >
                <X />
              </Action>
            </Stack>
          </Alert>
        )}
        <input
          ref={importRef}
          className="tc-sr-only"
          type="file"
          accept="application/json,.json"
          aria-label="Import template file"
          disabled={!allowTemplateImport}
          hidden={!allowTemplateImport}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file)
              run(async () => {
                const value: unknown = JSON.parse(await file.text())
                if (value && typeof value === 'object' && 'format' in value && value.format === 'gct-template-block-library') {
                  actions.importBlockLibrary(value)
                  setPanel('blocks')
                  return
                }
                if (
                  value &&
                  typeof value === 'object' &&
                  ('global' in value || ('format' in value && value.format === 'gct-voucher'))
                ) {
                  const { adaptVoucherProject } = await import('../template-core/legacy')
                  const migration = adaptVoucherProject(value)
                  actions.load(migration.template)
                  setMessage(migration.warnings.join(' '))
                } else actions.load(value)
              })
            event.target.value = ''
          }}
        />
        <SchemaDialog
          open={schemaOpen}
          close={() => setSchemaOpen(false)}
          reviewTarget={() =>
            [...(portal?.querySelectorAll<HTMLElement>(
              layout === 'compact' ? '.tc-compact-region input, .tc-compact-region [role=combobox], .tc-compact-region textarea' : '.tc-inspector input, .tc-inspector [role=combobox], .tc-inspector textarea',
            ) ?? [])].find(target => !target.closest('[hidden], [inert]') && !target.matches(':disabled')) ?? null
          }
          onLocate={(path) => {
            if (layout === 'compact') { setDockOpen(true); setCompactView('properties') }
            if (path.startsWith('fields')) {
              setPanel('fields')
              const match = template.fields.find(
                (field) => path.startsWith(`fields.${field.id}.`) || path === `fields.${field.id}`,
              )
              if (match) setFieldId(match.id)
            } else if (path.startsWith('nodes.')) {
              if (layout === 'compact') openProperties()
              else setPanel('structure')
              actions.select(path.split('.')[1])
            } else if (path.startsWith('blocks')) setPanel('blocks')
            else if (path.startsWith('assets')) setPanel('assets')
            else if (path.startsWith('page') || path === 'locale') {
              if (layout === 'compact') openProperties()
              else setPanel('structure')
              actions.select(null)
            } else setPanel('styles')
            setSchemaOpen(false)
          }}
        />
        <ActionDialog
          open={blockOpen}
          onOpenChange={setBlockOpen}
          title="Save reusable block"
          description="Field bindings become configurable block properties. Each insertion pins a specific version."
          strings={{ confirm: 'Save block' }}
          onAsyncConfirm={async () => {
            if (!selection.id) throw new Error('Select an element to save as a block.')
            actions.saveBlock(selection.id, blockName)
            setPanel('blocks')
          }}
        >
          <Field label="Block name">
            <Input
              aria-label="Block name"
              value={blockName}
              onChange={(event) => setBlockName(event.target.value)}
            />
          </Field>
        </ActionDialog>
        {editedDefinition && <BlockDefinitionDialog key={`${editedDefinition.id}@${editedDefinition.version}`}
          block={editedDefinition} close={() => setEditingBlock(null)} />}
      </ThemeScope>
    </VoucherPortalContext.Provider>
  )
}

function Tree({
  ids,
  nodes,
  selected,
  select,
}: {
  ids: string[]
  nodes: Record<string, TemplateNode>
  selected: string | null
  select: (id: string) => void
}) {
  const [expanded, setExpanded] = useState<string[]>(ids)
  const items = useMemo(() => {
    const visit = (ids: string[], ancestors = new Set<string>()): TreeNode[] =>
      ids.flatMap((id) => {
        const node = Object.hasOwn(nodes, id) ? nodes[id] : undefined
        if (!node || ancestors.has(id) || ancestors.size > 64) return []
        const next = new Set(ancestors).add(id)
        const label = templateNodeLabel(node)
        const children = visit(childIds(node), next)
        return [
          { value: id, label, description: node.kind, children: children.length ? children : undefined },
        ]
      })
    return visit(ids)
  }, [ids, nodes])
  useEffect(() => {
    if (!selected) return
    const reveal = (items: TreeNode[], path: string[] = []): string[] | null => {
      for (const item of items) {
        if (item.value === selected) return path
        const found = reveal(item.children ? [...item.children] : [], [...path, item.value])
        if (found) return found
      }
      return null
    }
    const ancestors = reveal(items)
    if (ancestors) setExpanded((previous) => [...new Set([...previous, ...ancestors])])
  }, [selected, items])
  return (
    <StructureTree
      aria-label="Document structure"
      items={items}
      expandedValues={expanded}
      onExpandedValuesChange={setExpanded}
      selectedValues={selected ? [selected] : []}
      onSelectedValuesChange={(_, node) => select(node.value)}
      showGuides
    />
  )
}

function PageInspector({ email = false }: { email?: boolean }) {
  const template = useTemplateDocument()
  const actions = useTemplateActions()
  const landscape = template.page.widthMm > template.page.heightMm
  const short = Math.min(template.page.widthMm, template.page.heightMm)
  const long = Math.max(template.page.widthMm, template.page.heightMm)
  const paper = short === 210 && long === 297 ? 'a4' : short === 215.9 && long === 279.4 ? 'letter' : 'custom'
  return (
    <>
      <Text type="secondary" className="tc-panel-intro">
        {email ? 'Email uses a 600px content wrapper and responsive width rules. Use section and cell padding for spacing.' : 'Page dimensions control print output. Long content flows onto additional pages.'}
      </Text>
      <CommitInput
        label="Template name"
        value={template.name}
        onCommit={(name) =>
          actions.edit((draft) => {
            draft.name = name
          })
        }
      />
      {!email && <><Field label="Paper size">
        <Select
          className="tc-input"
          aria-label="Paper size"
          value={paper}
          onValueChange={(value) => {
            if ((value ?? '') === 'custom') return
            const dimensions = (value ?? '') === 'letter' ? [215.9, 279.4] : [210, 297]
            actions.edit((draft) => {
              draft.page.widthMm = dimensions[landscape ? 1 : 0]
              draft.page.heightMm = dimensions[landscape ? 0 : 1]
            })
          }}
          options={[
            { value: 'a4', label: 'A4 · 210 × 297 mm' },
            { value: 'letter', label: 'Letter · 215.9 × 279.4 mm' },
            { value: 'custom', label: 'Custom dimensions', disabled: true },
          ]}
        />
      </Field>
      <Field label="Orientation">
        <Select
          className="tc-input"
          aria-label="Orientation"
          value={landscape ? 'landscape' : 'portrait'}
          onValueChange={(value) => {
            const nextLandscape = (value ?? '') === 'landscape'
            actions.edit((draft) => {
              draft.page.widthMm = nextLandscape ? long : short
              draft.page.heightMm = nextLandscape ? short : long
            })
          }}
          options={[
            { value: 'portrait', label: 'Portrait' },
            { value: 'landscape', label: 'Landscape' },
          ]}
        />
      </Field>
      <Grid columns={2} gap="lg" className="tc-field-grid">
        {(['widthMm', 'heightMm'] as const).map((dimension) => (
          <CommitInput
            key={dimension}
            label={`${dimension === 'widthMm' ? 'Width' : 'Height'} (mm)`}
            type="number"
            value={String(template.page[dimension])}
            onCommit={(value) =>
              actions.edit((draft) => {
                draft.page[dimension] = Number(value)
              })
            }
          />
        ))}
      </Grid>
      <Grid columns={2} gap="lg" className="tc-field-grid">
        {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
          <CommitInput
            key={side}
            label={`${side[0].toUpperCase()}${side.slice(1)} margin (mm)`}
            value={String(template.page.margins[side])}
            type="number"
            onCommit={(value) =>
              actions.edit((draft) => {
                draft.page.margins[side] = Number(value)
              })
            }
          />
        ))}
      </Grid>
      </>}
      <CommitInput
        label="Formatting locale"
        value={template.locale}
        onCommit={(locale) =>
          actions.edit((draft) => {
            draft.locale = locale
          })
        }
      />
      <CommitInput
        label="Description"
        multiline
        value={template.description}
        onCommit={(value) =>
          actions.edit((draft) => {
            draft.description = value
          })
        }
      />
      <Heading tag="h3" size="sm">
        Starting point
      </Heading>
      <Action
        onClick={() =>
          actions.edit((draft) =>
            Object.assign(draft, { ...createTemplateDefinition(draft.name), id: draft.id }),
          )
        }
      >
        <FilePlus2 />
        Clear document
      </Action>
      <Action
        className="tc-mt"
        onClick={() =>
          actions.edit((draft) =>
            Object.assign(draft, { ...createInvoiceTemplate(), id: draft.id, name: draft.name }),
          )
        }
      >
        Load invoice starter
      </Action>
    </>
  )
}
function NodeInspector({
  node,
  run,
  email = false,
}: {
  node: TemplateNode
  run: (task: () => unknown) => void
  email?: boolean
}) {
  const template = useTemplateDocument()
  const actions = useTemplateActions()
  const update = (patch: Partial<TemplateNode>) => actions.updateNode(node.id, patch)
  const parent = Object.values(template.nodes).find((parent) => childIds(parent).includes(node.id))
  const excluded = new Set<string>()
  const exclude = (id: string) => {
    if (excluded.has(id) || !Object.hasOwn(template.nodes, id)) return
    excluded.add(id)
    childIds(template.nodes[id]).forEach(exclude)
  }
  exclude(node.id)
  const containers: { id: string; label: string }[] = []
  const walked = new Set<string>()
  const collect = (ids: string[], ancestors: string[]) =>
    ids.forEach((id, index) => {
      const item = Object.hasOwn(template.nodes, id) ? template.nodes[id] : undefined
      if (!item || walked.has(id)) return
      walked.add(id)
      const label = [...ancestors, `${item.name || item.kind} ${index + 1}`].join(' / ')
      if (
        !excluded.has(id) &&
        'children' in item &&
        !(item.kind === 'element' && ['img', 'hr', 'br'].includes(item.tag))
      )
        containers.push({ id, label })
      collect(childIds(item), [...ancestors, item.name || item.kind])
    })
  collect(template.roots, [])
  return (
    <>
      {node.kind === 'element' && <>
        {node.children.length === 1 && template.nodes[node.children[0]]?.kind === 'text' && <TextNodeControls key={node.children[0]} node={template.nodes[node.children[0]] as Extract<TemplateNode, { kind: 'text' }>} run={run} />}
        <ColumnLayoutControls nodeId={node.id} run={run} />
        <LinkControls node={node} run={run} />
      </>}
      {node.kind === 'element' && (
        <>
          {node.tag === 'img' && (
            <>
              <Field label="Image asset">
                <Select
                  placeholder="Choose an image…"
                  className="tc-input"
                  aria-label="Image asset"
                  value={
                    node.attributeBindings.src?.source === 'asset' ? node.attributeBindings.src.assetId : ''
                  }
                  onValueChange={(value) =>
                    run(() =>
                      update({
                        attributeBindings:
                          (value ?? '')
                            ? {
                                ...node.attributeBindings,
                                src: { source: 'asset', assetId: value ?? '' },
                              }
                            : Object.fromEntries(
                                Object.entries(node.attributeBindings).filter(([key]) => key !== 'src'),
                              ),
                      } as Partial<TemplateNode>),
                    )
                  }
                  options={[
                    { value: '', label: 'Choose an image…' },
                    ...template.assets
                      .filter((asset) => asset.kind === 'image')
                      .map((asset) => ({ value: String(asset.id), label: String(asset.name) })),
                  ]}
                />
              </Field>
              <CommitInput
                label="Alternative text"
                value={node.attributes.alt ?? ''}
                onCommit={(alt) =>
                  update({ attributes: { ...node.attributes, alt } } as Partial<TemplateNode>)
                }
              />
            </>
          )}
        </>
      )}
      {node.kind === 'text' && <TextNodeControls node={node} run={run} />}
      {(node.kind === 'repeat' || node.kind === 'condition') && (
        <>
          <Field label={node.kind === 'repeat' ? 'Repeat this data' : 'Visibility condition'}>
            <ValueInput
              fields={node.kind === 'repeat' ? template.fields.filter(field => field.schema.type === 'array') : template.fields}
              literalArray={node.kind === 'repeat'}
              value={node.binding}
              onChange={(binding) => update({ binding } as Partial<TemplateNode>)}
            />
          </Field>
          {node.kind === 'repeat' && (
            <Text type="secondary" className="tc-hint">
              Children use “Repeating item” bindings to address each item’s properties.
            </Text>
          )}
          {node.kind === 'condition' && (
            <>
              <Select
                className="tc-input"
                aria-label="Condition operator"
                value={node.operator}
                onValueChange={(value) =>
                  run(() => update({ operator: value ?? '' } as Partial<TemplateNode>))
                }
                options={[
                  { value: 'truthy', label: 'Value is truthy' },
                  { value: 'equals', label: 'Value equals…' },
                ]}
              />
              {node.operator === 'equals' && (
                <JsonInput
                  label="Comparison value"
                  value={node.value}
                  onCommit={(value) =>
                    update({ value: JsonValueSchema.parse(value) } as Partial<TemplateNode>)
                  }
                />
              )}
            </>
          )}
        </>
      )}
      {node.kind === 'block' && (
        <BlockInstanceControls node={node} run={run} />
      )}
      <CommitInput label="Element name" value={node.name} onCommit={(name) => update({ name })} />
      {node.kind === 'element' && (
        <>
          <InspectorSection title="Appearance">
          <Grid columns={2} gap="lg" className="tc-field-grid">
            {[
              'color',
              'background-color',
              'font-size',
              'line-height',
              'width',
              'height',
              'border-radius',
              'padding',
              'margin',
              'display',
              'gap',
              'text-align',
            ].filter(property => !email || EMAIL_PROFILE.styles.includes(property) && property !== 'display').map((property) => (
              <CommitInput
                key={property}
                label={STYLE_LABELS[property] ?? property}
                value={node.style[property] ?? ''}
                onCommit={(value) => {
                  if (email && value) { const problem = emailStyleProblem(property, value); if (problem) throw new Error(`Email: ${problem}`) }
                  const style = { ...node.style }
                  if (value) style[property] = value
                  else delete style[property]
                  update({ style } as Partial<TemplateNode>)
                }}
              />
            ))}
          </Grid>
          </InspectorSection>
          <AdvancedSettings title="Advanced settings">
          <Field label="HTML element">
            <Select
              className="tc-input"
              aria-label="HTML element"
              value={node.tag}
              onValueChange={(value) => run(() => update({ tag: value ?? '' } as Partial<TemplateNode>))}
              options={HTML_TAGS.filter(tag => !email || EMAIL_PROFILE.tags.includes(tag)).map(tag => ({ value: String(tag), label: String(tag) }))}
            />
          </Field>
          <CommitInput
            label="CSS classes"
            value={node.classes.join(' ')}
            onCommit={(text) =>
              update({ classes: text.trim().split(/\s+/).filter(Boolean) } as Partial<TemplateNode>)
            }
          />
            <JsonInput
              label="HTML attributes"
              value={node.attributes}
              onCommit={(attributes) => update({ attributes } as Partial<TemplateNode>)}
            />
            <JsonInput
              label="All inline styles"
              value={node.style}
              onCommit={(style) => update({ style } as Partial<TemplateNode>)}
            />
            <JsonInput label="Attribute bindings" value={node.attributeBindings}
              onCommit={attributeBindings => update({ attributeBindings } as Partial<TemplateNode>)} />
          </AdvancedSettings>
        </>
      )}
      <InspectorSection title="Placement">
      <Field label="Parent container">
        <Select
          placeholder="Document root"
          className="tc-input"
          aria-label="Parent container"
          value={parent?.id ?? ''}
          onValueChange={(value) =>
            run(() => actions.move(node.id, (value ?? '') || null, Number.MAX_SAFE_INTEGER))
          }
          options={[
            { value: '', label: 'Document root' },
            ...containers.map((container) => ({
              value: String(container.id),
              label: String(container.label),
            })),
            ...(parent?.kind === 'block'
              ? [{ value: String(parent.id), label: [parent.name, '· slot content'].join('') }]
              : []),
          ]}
        />
      </Field>
      </InspectorSection>
      <InspectorSection title="Personalization permissions">
      {node.kind === 'text' && node.parts.every((part) => part.value.source === 'literal') && (
        <Toggle
          label="Allow text editing"
          hint="Applies to static text. Bound values use the field contract."
          checked={node.permissions.content}
          onChange={(content) => run(() => update({ permissions: { ...node.permissions, content } }))}
        />
      )}
      {node.kind === 'element' && (
        <Toggle
          label="Allow style editing"
          hint="Applies to this HTML element only."
          checked={node.permissions.style}
          onChange={(style) => run(() => update({ permissions: { ...node.permissions, style } }))}
        />
      )}
      {node.kind !== 'element' &&
        (node.kind !== 'text' || node.parts.some((part) => part.value.source !== 'literal')) && (
          <Text type="secondary" className="tc-hint">
            This element is controlled by the template. Data values follow their field permissions.
          </Text>
        )}
      </InspectorSection>
    </>
  )
}
function FieldInspector({ field, run }: { field: TemplateField; run: (task: () => unknown) => void }) {
  const actions = useTemplateActions()
  const update = (patch: Partial<TemplateField>) =>
    actions.edit((draft) => {
      draft.fields = draft.fields.map((item) => (item.id === field.id ? { ...item, ...patch } : item))
    })
  return (
    <>
      <CommitInput label="Field label" value={field.label} onCommit={(label) => update({ label })} />
      <CommitInput label="Data path" mono value={field.path} onCommit={(path) => update({ path })} />
      <Field label="Data type">
        <Select
          className="tc-input"
          aria-label="Data type"
          value={field.schema.type}
          onValueChange={(value) =>
            run(() =>
              update({
                schema: defaultDataSchema((value ?? '') as typeof field.schema.type),
                sample: undefined,
                defaultValue: undefined,
              }),
            )
          }
          options={[
            ...['string', 'number', 'integer', 'boolean', 'array', 'object'].map((type) => ({
              value: String(String(type)),
              label: String(type),
            })),
          ]}
        />
      </Field>
      <CommitInput
        label="Field description"
        multiline
        value={field.description}
        onCommit={(description) => update({ description })}
      />
      <Toggle
        label="Required at runtime"
        checked={field.required}
        onChange={(required) => run(() => update({ required }))}
      />
      <Toggle
        label="Editable by the user"
        hint="Turn off for values your application supplies."
        checked={field.editable}
        onChange={(editable) => run(() => update({ editable }))}
      />
      <SchemaConstraints schema={field.schema} onChange={(schema) => update({ schema })} run={run} />
      <JsonInput
        label="Design sample"
        value={field.sample}
        onCommit={(sample) =>
          update({ sample: sample === undefined ? undefined : JsonValueSchema.parse(sample) })
        }
        hint="Preview only. This never satisfies a required runtime value."
      />
      <JsonInput
        label="Runtime default"
        value={field.defaultValue}
        onCommit={(defaultValue) =>
          update({
            defaultValue: defaultValue === undefined ? undefined : JsonValueSchema.parse(defaultValue),
          })
        }
        hint="Used only when the application omits this value."
      />
      <AdvancedSettings title="Validation schema">
        <JsonInput
          label="Field JSON Schema"
          value={field.schema}
          onCommit={(value) => update({ schema: DataSchemaSchema.parse(value) })}
        />
      </AdvancedSettings>
      <Action
        onClick={() =>
          run(() =>
            actions.edit((draft) => {
              const uses = Object.values(draft.nodes).some((node) =>
                nodeValues(node).some((value) => value.source === 'field' && value.fieldId === field.id),
              )
              if (uses) throw new Error('Remove this field’s bindings before deleting it.')
              draft.fields = draft.fields.filter((item) => item.id !== field.id)
            }),
          )
        }
      >
        <Trash2 />
        Delete field
      </Action>
    </>
  )
}
function StylesPanel() {
  const template = useTemplateDocument()
  const actions = useTemplateActions()
  const [source, setSource] = useState<'theme' | 'css'>('css')
  const classes = discoverTemplateClasses(template)
  return (
    <Stack gap="lg" className="tc-panel-content">
      <Text type="secondary" className="tc-panel-intro">
        Theme → block → template → inline. Selectors are scoped to the document.
      </Text>
      <Select
        aria-label="Stylesheet source"
        className="tc-input"
        value={source}
        onValueChange={(value) => setSource((value ?? '') as typeof source)}
        options={[
          { value: 'css', label: 'Template stylesheet' },
          { value: 'theme', label: 'Theme stylesheet' },
        ]}
      />
      <CommitInput
        key={source}
        label="Stylesheet"
        multiline
        mono
        inputClassName="tc-css-editor"
        rows={14}
        value={template.styles[source]}
        hint="Changes apply when you leave the field."
        onCommit={(css) => {
          const result = compileTemplateCSS(css)
          if (result.issues.length) throw new Error(result.issues[0].message)
          actions.edit((draft) => {
            draft.styles[source] = css
          })
        }}
      />
      <Stack direction="horizontal" align="center" gap="md">
        <Heading tag="h3" size="sm">
          Classes
        </Heading>
        <Badge>{classes.length}</Badge>
      </Stack>
      {classes.map((item) => (
        <Item
          key={item.name}
          title={<code className="truncate">.{item.name}</code>}
          trailing={<Badge>{item.nodeIds.length} uses</Badge>}
          density="compact"
          className="flex-nowrap"
          render={
            <button
              type="button"
              disabled={!item.nodeIds.length}
              onClick={() => actions.select(item.nodeIds[0])}
            />
          }
        />
      ))}
    </Stack>
  )
}
function AssetsPanel({ run, email = false }: { run: (task: () => unknown) => void; email?: boolean }) {
  const template = useTemplateDocument()
  const actions = useTemplateActions()
  const [name, setName] = useState('')
  const [url, setURL] = useState('')
  const [mimeType, setMimeType] = useState('image/png')
  return (
    <Stack gap="lg" className="tc-panel-content">
      <Text type="secondary" className="tc-panel-intro">
        Manage stable asset references. Your application owns uploads and production URL resolution.
      </Text>
      <Field label="Image name">
        <Input
          className="tc-input"
          aria-label="Image name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </Field>
      <Field label="Image URL">
        <Input
          className="tc-input"
          aria-label="Image URL"
          placeholder="https://…"
          value={url}
          onChange={(event) => {
            const value = event.target.value
            setURL(value)
            const extension = value
              .split(/[?#]/)[0]
              .match(/\.(png|jpe?g|gif|webp)$/i)?.[1]
              ?.toLowerCase()
            const dataType = value.match(/^data:(image\/(?:png|jpeg|gif|webp));/i)?.[1]?.toLowerCase()
            if (dataType) setMimeType(dataType)
            else if (extension) setMimeType(`image/${extension === 'jpg' ? 'jpeg' : extension}`)
          }}
        />
      </Field>
      <Field label="Image format">
        <Select
          className="tc-input"
          aria-label="Image format"
          value={mimeType}
          onValueChange={(value) => setMimeType(value ?? '')}
          options={[
            ...(email ? ['image/png', 'image/jpeg', 'image/gif'] : ['image/png', 'image/jpeg', 'image/webp', 'image/gif']).map((type) => ({
              value: String(type),
              label: [type.replace('image/', '').toUpperCase()].join(''),
            })),
          ]}
        />
      </Field>
      <Action
        disabled={!name.trim() || !url.trim()}
        onClick={() =>
          run(() => {
            if (email && !['image/png', 'image/jpeg', 'image/gif'].includes(mimeType)) throw new Error('Use PNG, JPEG or GIF for email.')
            if (!safeTemplateURL(url.trim())) throw new Error('Enter a supported image URL.')
            actions.edit((draft) => {
              draft.assets.push({
                id: `asset_${nanoid(8).replace(/-/g, '_')}`,
                name: name.trim(),
                kind: 'image',
                url: url.trim(),
                mimeType,
              })
            })
            setName('')
            setURL('')
          })
        }
      >
        <Plus />
        Add image asset
      </Action>
      <Stack direction="horizontal" align="center" gap="md">
        <Heading tag="h3" size="sm">
          Assets
        </Heading>
        <Badge>{template.assets.length}</Badge>
      </Stack>
      <Stack gap="2xl">
        {template.assets.map((asset) => (
          <Card
            surface="flat"
            padding="none"
            key={asset.id}
            title={<span className="[overflow-wrap:anywhere]">{asset.name}</span>}
            titleSuffix={<Badge>{asset.kind}</Badge>}
            description={
              <span className="[overflow-wrap:anywhere]">
                {asset.kind === 'font' ? `${asset.fontFamily ?? asset.name} · ${asset.url}` : asset.url}
              </span>
            }
            actionsLabel={`Actions for asset ${asset.name}`}
            actions={[
              {
                label: 'Remove asset',
                icon: Trash2,
                tone: 'destructive',
                onClick: () =>
                  run(() =>
                    actions.edit((draft) => {
                      const nodes = [
                        ...Object.values(draft.nodes),
                        ...draft.blocks.flatMap((block) => Object.values(block.nodes)),
                      ]
                      if (
                        nodes.some((node) =>
                          nodeValues(node).some(
                            (value) => value.source === 'asset' && value.assetId === asset.id,
                          ),
                        )
                      )
                        throw new Error('Remove this asset’s bindings before deleting it.')
                      draft.assets = draft.assets.filter((item) => item.id !== asset.id)
                    }),
                  ),
              },
            ]}
            footerSlot={
              asset.kind === 'image' ? (
                <Action onClick={() => run(() => actions.insertImage(asset.id))}>Insert image</Action>
              ) : undefined
            }
          />
        ))}
        {!template.assets.length && (
          <EmptyState
            padding="sm"
            title="No assets yet"
            description="Add an image URL above to use it in this template."
          />
        )}
      </Stack>
    </Stack>
  )
}
function SchemaConstraints({
  schema,
  onChange,
  run,
}: {
  schema: DataSchema
  onChange: (schema: DataSchema) => void
  run: (task: () => unknown) => void
}) {
  const numeric = (label: string, key: string, value: number | undefined) => (
    <CommitInput
      key={key}
      label={label}
      type="number"
      value={value === undefined ? '' : String(value)}
      placeholder="No limit"
      onCommit={(input) => {
        const next = { ...schema, [key]: input.trim() === '' ? undefined : Number(input) }
        onChange(DataSchemaSchema.parse(next))
      }}
    />
  )
  return (
    <Card surface="flat" padding="none" title="Validation rules" className="tc-constraints">
      <Stack gap="lg">
        {schema.type === 'string' && (
          <>
            <Field label="Format">
              <Select
                placeholder="Plain text"
                className="tc-input"
                aria-label="String format"
                value={schema.format ?? ''}
                onValueChange={(value) =>
                  run(() =>
                    onChange(DataSchemaSchema.parse({ ...schema, format: (value ?? '') || undefined })),
                  )
                }
                options={[
                  { value: '', label: 'Plain text' },
                  { value: 'date', label: 'Date' },
                  { value: 'date-time', label: 'Date and time' },
                  { value: 'email', label: 'Email' },
                  { value: 'uri', label: 'URL' },
                ]}
              />
            </Field>
            <Grid columns={2} gap="lg" className="tc-grid-2">
              {numeric('Minimum length', 'minLength', schema.minLength)}
              {numeric('Maximum length', 'maxLength', schema.maxLength)}
            </Grid>
          </>
        )}
        {(schema.type === 'number' || schema.type === 'integer') && (
          <Grid columns={2} gap="lg" className="tc-grid-2">
            {numeric('Minimum value', 'minimum', schema.minimum)}
            {numeric('Maximum value', 'maximum', schema.maximum)}
          </Grid>
        )}
        {schema.type === 'array' && (
          <Grid columns={2} gap="lg" className="tc-grid-2">
            {numeric('Minimum items', 'minItems', schema.minItems)}
            {numeric('Maximum items', 'maxItems', schema.maxItems)}
          </Grid>
        )}
        {(schema.type === 'boolean' || schema.type === 'object') && (
          <Text type="secondary" className="tc-hint">
            {schema.type === 'boolean'
              ? 'Accepts Yes or No.'
              : 'Configure nested properties in the validation schema below.'}
          </Text>
        )}
      </Stack>
    </Card>
  )
}
function SchemaDialog({
  open,
  close,
  onLocate,
  reviewTarget,
}: {
  open: boolean
  close: () => void
  onLocate: (path: string) => void
  reviewTarget: () => HTMLElement | null
}) {
  const reviewing = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (open || !reviewing.current) return
    // Review navigates to a different panel, so focus follows that destination
    // after the overlay owner has finished restoring/removing its modal subtree.
    const focusDestination = () => {
      if (!reviewing.current) return
      if (reviewing.current?.isConnected) return
      reviewing.current = null
      observer.disconnect()
      const target = reviewTarget()
      requestAnimationFrame(() => {
        if (target?.isConnected) target.focus()
      })
    }
    const observer = new MutationObserver(focusDestination)
    observer.observe(document.body, { childList: true, subtree: true })
    queueMicrotask(focusDestination)
    return () => observer.disconnect()
  }, [open, reviewTarget])
  const contract = useTemplateContract()
  const schemas = useMemo(() => getTemplateJSONSchemas(), [])
  const [kind, setKind] = useState('runtime')
  const schema = kind === 'runtime' ? contract.schema : schemas[kind as keyof typeof schemas]
  return (
    <ActionDialog
      open={open}
      onOpenChange={(value) => {
        if (!value) close()
      }}
      title="Template contracts"
      description="JSON Schema · Draft 2020-12 · Shared frontend/backend contracts"
      size="3xl"
      showConfirm={false}
      showCancel={false}
    >
      <Stack gap="lg">
        <Select
          className="tc-input"
          aria-label="Contract type"
          value={kind}
          onValueChange={(value) => setKind(value ?? '')}
          options={[
            { value: 'runtime', label: 'This template’s runtime data' },
            ...Object.keys(schemas).map((key) => ({ value: String(key), label: String(key) })),
          ]}
        />
        {contract.issues.length > 0 && (
          <div role="alert" className="tc-checks">
            {contract.issues.map((issue, index) => (
              <Stack
                direction="horizontal"
                align="center"
                justify="between"
                gap="lg"
                className="tc-check-item"
                key={`${issue.path}:${index}`}
              >
                <Text>
                  <code>{issue.path}</code>
                  <span>{issue.message}</span>
                </Text>
                <Action
                  onClick={(event) => {
                    reviewing.current = event.currentTarget.closest<HTMLElement>('[data-slot=dialog-content]')
                    onLocate(issue.path)
                  }}
                  aria-label={`Resolve: ${issue.message}`}
                >
                  Review
                  <ChevronRight data-icon="inline-end" />
                </Action>
              </Stack>
            ))}
          </div>
        )}
        <CodeBlock code={JSON.stringify(schema, null, 2)} language="json" maxHeight="45dvh" showLineNumbers />
        <Action
          disabled={!schema}
          onClick={() => downloadJSON(schema, kind === 'runtime' ? 'runtime-data.schema' : `${kind}.schema`)}
        >
          <Download />
          Download JSON Schema
        </Action>
      </Stack>
    </ActionDialog>
  )
}
