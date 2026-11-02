import { Alert, AlertTitle, AlertDescription, AlertAction } from 'themelia-react-ui/base/feedback'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Check,
  ChevronLeft,
  Copy,
  Eye,
  FileSliders,
  Keyboard,
  Layers,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  AlertTriangle,
} from 'lucide-react'
import { useFeature } from '../context'
import {
  useVoucherActions,
  useVoucherProject,
  useVoucherSelection,
} from '../hooks/use-voucher-builder'
import { getBlockDef } from '../blocks'
import { getParentContext } from '../engine/graph'
import { validateLayout, fitSectionHeights } from '../lib/voucher'
import { validateProject } from '../lib/validation'
import type { InspectorTab } from '../lib/inspector'
import { Button } from '../ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { useOverlayVisibility } from 'themelia-react-ui/features/overlays'
import { Page, type PageHeaderAction } from 'themelia-react-ui/layout/page'
import { Stack } from 'themelia-react-ui/base/structure'
import { Heading, Text } from 'themelia-react-ui/typography'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { WorkspaceSidebar, type LibraryTab } from './workspace-sidebar'
import { BlockSettings } from './block-settings'
import { SectionSettings } from './section-settings'
import { GlobalSettings } from './global-settings'
import { ValidationPanel } from './validation-panel'
import { RetainedPanel } from './retained-panel'
import { EmptyState } from 'themelia-react-ui/blocks/data-display'

export type InspectorMode = 'block' | 'global' | 'validate'

interface Props {
  children: ReactNode
  toolbar: (openInspector?: () => void) => ReactNode
  inspectorMode: InspectorMode
  inspectorRequest?: number
  onInspectorModeChange: (mode: InspectorMode) => void
  onPreview: () => void
  onExport: () => void
  onImport: () => void
  onReset: () => void
  onCommands: () => void
  onShortcuts: () => void
  onDelete: (ids: string[]) => void
}

/** A single set of panels moves between the dock and modal drawers as space changes. */
export function DockedWorkspace({
  children,
  toolbar,
  inspectorMode,
  inspectorRequest = 0,
  onInspectorModeChange,
  ...handlers
}: Props) {
  const root = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(1280)
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('layers')
  const { open: libraryOpen, setOpen: setLibraryOpen } = useOverlayVisibility()
  const { open: inspectorOpen, setOpen: setInspectorOpen } = useOverlayVisibility()
  const [blockTab, setBlockTab] = useState<InspectorTab>('content')
  const project = useVoucherProject()
  const { activeBlock, activeBlockIds, activeSectionId } = useVoucherSelection()
  const actions = useVoucherActions()
  const layers = useFeature('elementsPanel')
  const blocks = useFeature('blockLibrary')
  const templates = useFeature('templates')
  const documentSettings = useFeature('globalSettings')
  const blockSettings = useFeature('blockSettings')
  const checks = useFeature('validation')
  const preview = useFeature('preview')
  const exporting = useFeature('export')
  const importing = useFeature('importJson')
  const history = useFeature('undoRedo')
  const commands = useFeature('commandPalette')
  const hasLibrary = layers || blocks || templates
  const hasInspector = blockSettings || documentSettings || checks
  const dockLibrary = width >= 860
  const dockInspector = width >= 1120
  const emptyDocument = project.sections.every((section) => section.blockIds.length === 0)
  const layout = validateLayout(
    project.sections.map((s) => s.height) as [number, number, number],
    project.global.layout.margin,
  )
  const issues = validateProject(project).filter((r) => r.severity !== 'info')
  const sectionIndex = project.sections.findIndex((s) => s.id === activeSectionId)
  const parent = activeBlock ? getParentContext(project, activeBlock.id) : null
  const selectionHasStructural = activeBlockIds.some(
    (id) => getParentContext(project, id)?.kind === 'structural',
  )
  const canDuplicate =
    !selectionHasStructural &&
    (activeBlockIds.length === 1 ||
      activeBlockIds.every((id) => {
        const context = getParentContext(project, id)
        return context?.kind === 'section' && context.sectionId === activeSectionId
      }))
  const siblings =
    parent?.kind === 'section'
      ? (project.sections.find((s) => s.id === parent.sectionId)?.blockIds ?? [])
      : parent?.kind === 'container'
        ? (project.columnBlocks[parent.parentId] ?? [])
        : []
  const title =
    activeBlockIds.length > 1
      ? `${activeBlockIds.length} blocks selected`
      : activeBlock
        ? (getBlockDef(activeBlock.type)?.name ?? activeBlock.type)
        : sectionIndex >= 0
          ? `Section ${sectionIndex + 1}`
          : 'Inspector'
  useEffect(() => {
    const element = root.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (activeBlock && blockSettings) onInspectorModeChange('block')
  }, [activeBlock?.id, blockSettings, onInspectorModeChange])
  useEffect(() => {
    if (inspectorRequest) setInspectorOpen(true)
  }, [inspectorRequest])
  const openMode = (mode: InspectorMode) => {
    onInspectorModeChange(mode)
    if (!dockInspector) setInspectorOpen(true)
  }
  const openLibrary = (tab: LibraryTab) => {
    setLibraryTab(tab)
    if (!dockLibrary) setLibraryOpen(true)
  }
  const move = (delta: number) => {
    if (!activeBlock || !parent) return
    if (parent.kind === 'container')
      actions.reorderColumnBlocks(parent.parentId, parent.index, parent.index + delta)
    else if (parent.kind === 'section')
      (delta < 0 ? actions.moveBlockUp : actions.moveBlockDown)(activeBlock.id, parent.sectionId)
  }
  const fixLayout = () => {
    const heights = fitSectionHeights(
      project.sections.map((s) => s.height) as [number, number, number],
      project.global.layout.margin,
    )
    actions.transaction((commands) =>
      project.sections.forEach((s, i) => commands.updateSection(s.id, { height: heights[i] })),
    )
  }
  const inspector = (
    <div className="nc-inspector-content">
      <Stack direction="horizontal" align="center" gap="sm" className="nc-inspector-heading">
        {inspectorMode !== 'block' && blockSettings && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Back to selection"
            onClick={() => onInspectorModeChange('block')}
          >
            <ChevronLeft />
          </Button>
        )}
        <div className="min-w-0 flex-1">
          <Text type="secondary">
            {inspectorMode === 'block'
              ? activeBlock
                ? `Section ${sectionIndex + 1} / Block`
                : 'Selection'
              : 'Document'}
          </Text>
          <Heading tag="h2" size="sm">
            {inspectorMode === 'global'
              ? 'Document settings'
              : inspectorMode === 'validate'
                ? 'Document checks'
                : title}
          </Heading>
        </div>
        {inspectorMode === 'block' && activeBlock && blockSettings && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" aria-label="Block actions" />}
            >
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuGroup>
                <DropdownMenuItem
                  disabled={activeBlockIds.length !== 1 || !parent || !siblings.length || parent.index <= 0}
                  onClick={() => move(-1)}
                >
                  <ArrowUp />
                  Move up
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={
                    activeBlockIds.length !== 1 ||
                    !parent ||
                    !siblings.length ||
                    parent.index >= siblings.length - 1
                  }
                  onClick={() => move(1)}
                >
                  <ArrowDown />
                  Move down
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!canDuplicate}
                  onClick={() => {
                    if (parent?.kind === 'container')
                      actions.duplicateBlockInColumn(parent.parentId, activeBlock.id)
                    else if (activeSectionId) actions.duplicateBlocks(activeBlockIds, activeSectionId)
                  }}
                >
                  <Copy />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={selectionHasStructural}
                  variant="destructive"
                  onClick={() => handlers.onDelete([...activeBlockIds])}
                >
                  <Trash2 />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </Stack>
      {inspectorMode === 'global' && documentSettings ? (
        <div className="nc-dock-scroll">
          {!layout.valid && (
            <div className="nc-panel-inset">
              <Alert tone="warning">
                <AlertTitle>Page overflow · {Number(layout.overflow.toFixed(2))} mm</AlertTitle>
                <AlertDescription>Reduce heights or margins to fit the A4 page.</AlertDescription>
                <AlertAction>
                  <Button variant="outline" onClick={fixLayout}>
                    Fit sections to page
                  </Button>
                </AlertAction>
              </Alert>
            </div>
          )}
          <GlobalSettings />
        </div>
      ) : inspectorMode === 'validate' && checks ? (
        <div className="nc-dock-scroll">
          <ValidationPanel onDocument={documentSettings ? () => openMode('global') : undefined} />
        </div>
      ) : blockSettings ? (
        activeBlock ? (
          <Tabs
            value={blockTab}
            onValueChange={(v) => setBlockTab(v as InspectorTab)}
            className="nc-dock-tabs"
          >
            <TabsList variant="line" className="nc-dock-tablist" aria-label="Block settings">
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="style">Style</TabsTrigger>
              <TabsTrigger value="data">Data</TabsTrigger>
            </TabsList>
            {(['content', 'style', 'data'] as const).map((tab) => (
              <TabsContent key={tab} value={tab} className="nc-dock-scroll">
                <BlockSettings tab={tab} />
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <div className="nc-dock-scroll">
            <SectionSettings />
          </div>
        )
      ) : (
        <div className="nc-panel-inset">
          <Text type="secondary" size="sm">
            Select Document settings or Document checks above.
          </Text>
        </div>
      )}
    </div>
  )
  const library = (
    <WorkspaceSidebar
      tab={libraryTab}
      onTabChange={setLibraryTab}
      onSelectSection={() => onInspectorModeChange('block')}
      onInsert={() => {
        setLibraryOpen(false)
        onInspectorModeChange('block')
      }}
    />
  )
  return (
    <div ref={root} className="nc-docked-workspace">
      <Page
        className="nc-workspace-page"
        maxWidth="full"
        gutter="sm"
        padding="sm"
        slotProps={{ body: { className: 'nc-workspace-page-body' } }}
        header={{
          title: project.global.metadata.title || 'Untitled voucher',
          description: `Voucher design · A4 · ${project.sections.length} sections`,
          primaryAction: exporting
            ? { label: 'Export', icon: ArrowUpRight, onClick: handlers.onExport }
            : undefined,
          secondaryActions: [
            ...(preview ? [{ label: 'Preview', icon: Eye, onClick: handlers.onPreview }] : []),
            ...(documentSettings
              ? [{ label: 'Document settings', icon: FileSliders, onClick: () => openMode('global') }]
              : []),
            ...(checks
              ? [
                  {
                    label: issues.length ? `${issues.length} document issues` : 'Document checks',
                    onClick: () => openMode('validate'),
                  },
                ]
              : []),
            ...(importing ? [{ label: 'Import project', icon: Upload, onClick: handlers.onImport }] : []),
            ...(commands ? [{ label: 'Find a command', icon: Search, onClick: handlers.onCommands }] : []),
            { label: 'Keyboard shortcuts', icon: Keyboard, onClick: handlers.onShortcuts },
            ...(history
              ? [{ label: 'Reset project', destructive: true, icon: RotateCcw, onClick: handlers.onReset }]
              : []),
          ] satisfies PageHeaderAction[],
          maxVisibleSecondaryActions: 1,
          moreActionsLabel: 'Workspace menu',
        }}
      >
        <div className="nc-workspace-body rounded-surface">
          {hasLibrary && <RetainedPanel docked={dockLibrary} open={libraryOpen} onOpenChange={setLibraryOpen}
            workspaceRef={root} launcherLabel="Open library" className="nc-library-dock" label="Layers, blocks, and templates"
            direction="left" title="Library" description="Layers, blocks, and templates">{library}</RetainedPanel>}
          <div className="nc-canvas-column">
            {(preview || exporting) && <Stack direction="horizontal" align="center" justify="end" gap="sm" className="nc-mobile-document-actions" role="toolbar" aria-label="Document actions">
              {preview && <Button variant="outline" onClick={handlers.onPreview}><Eye />Preview</Button>}
              {exporting && <Button onClick={handlers.onExport}><ArrowUpRight />Export</Button>}
            </Stack>}
            <div className="nc-viewbar">
              {hasLibrary && !dockLibrary && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="ms-2"
                  aria-label="Open library"
                  onClick={() => setLibraryOpen(true)}
                >
                  <Layers />
                </Button>
              )}
              {toolbar(hasInspector && !dockInspector ? () => setInspectorOpen(true) : undefined)}
            </div>
            {emptyDocument && (blocks || templates) && <div className="nc-empty-canvas-guide">
              <EmptyState padding="sm" title="Start your voucher"
                description={blocks ? `Add content to Section ${Math.max(0, sectionIndex) + 1}${templates ? ', or choose a complete template.' : '.'}` : 'Choose a template to start your design.'}
                actions={<>
                  {blocks && <Button onClick={() => openLibrary('blocks')}><Plus />Add a block</Button>}
                  {templates && <Button variant={blocks ? 'outline' : 'default'} onClick={() => openLibrary('templates')}>Browse templates</Button>}
                </>} />
            </div>}
            {children}
            <footer className="nc-workspace-status">
              <Text tag="span" size="xs" type="secondary">
                A4 <span className="nc-wide-label">· 210 × 297 mm</span> · 3 sections
              </Text>
              {checks || documentSettings ? (
                <Button
                  variant="ghost"

                  onClick={() => openMode(checks ? 'validate' : 'global')}
                >
                  {!layout.valid ? (
                    <>
                      <AlertTriangle />
                      {Number(layout.overflow.toFixed(2))} mm overflow
                    </>
                  ) : issues.length && checks ? (
                    <>
                      {issues.length} {issues.length === 1 ? 'issue' : 'issues'} to review
                    </>
                  ) : (
                    <>
                      <Check />
                      Page fits A4
                    </>
                  )}
                </Button>
              ) : null}
            </footer>
          </div>
          {hasInspector && <RetainedPanel docked={dockInspector} open={inspectorOpen} onOpenChange={setInspectorOpen}
            workspaceRef={root} launcherLabel="Open inspector" className="nc-inspector-dock" label="Design inspector"
            title="Inspector" description="Settings for your selection or document">{inspector}</RetainedPanel>}
        </div>
      </Page>
    </div>
  )
}
