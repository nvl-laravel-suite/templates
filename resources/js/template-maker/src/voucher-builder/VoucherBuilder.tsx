import { ToastContainer } from './ui/toast'
import { TemplateEditor } from '../template-creator/TemplateEditor'
import { useState, useEffect, type CSSProperties } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { VoucherCanvas } from './builder/voucher-canvas'
import { CanvasToolbar } from './builder/canvas-toolbar'
import { DockedWorkspace, type InspectorMode } from './builder/docked-workspace'
import { CommandPalette } from './builder/command-palette'
import { ConfirmDialog } from './builder/confirm-dialog'
import { ShortcutLegend } from './builder/shortcut-legend'
import { BlockContextMenu } from './builder/block-context-menu'
import { ExportDialog } from './builder/export-dialog'
import { useKeyboardShortcuts } from './hooks/use-keyboard-shortcuts'
import { useSecurityGuard } from './hooks/use-security-guard'
import { useCanvasZoom } from './hooks/use-canvas-zoom'
import {
  useVoucherActions,
  useVoucherProject,
  useVoucherSelection,
  useVoucherTemplates,
} from './hooks/use-voucher-builder'
import { useVoucherInstance } from './editor-context'
import { useToast } from './hooks/use-toast'
import { useFeature, useReadOnly, VoucherPortalContext } from './context'
import { VoucherBuilderProvider } from './provider'
import { ActionDialog } from 'themelia-react-ui/features/overlays'
import { ThemeScope, DirectionProvider } from 'themelia-react-ui/ui-provider'
import { cn } from './lib/utils'
import { A4_HEIGHT_MM, A4_WIDTH_MM, mmToPx } from './lib/voucher'
import { getDirection } from './i18n/core'
import { exportToHTML } from './export'
import { getParentContext, getSectionForBlock } from './engine/graph'
import type { CommandContext } from './lib/commands'
import type { BlockType } from './schema'
import type { VoucherBuilderProps } from './types'
import { VoucherBuilderError } from './api-types'
import './styles.css'

export function VoucherBuilder(props: VoucherBuilderProps) {
  const {
    locale,
    theme,
    className,
    personalization,
    ...runtime
  } = props
  if (personalization) {
    const unsupported = Object.entries(props)
      .filter(([key, value]) => value !== undefined && !['personalization', 'theme', 'className'].includes(key))
      .map(([key]) => key)
    if ((props as { theme?: unknown }).theme === 'system') unsupported.push('theme="system"')
    if (unsupported.length)
      throw new VoucherBuilderError(
        'configuration',
        `Personalization does not accept voucher options: ${unsupported.join(', ')}. Use TemplateEditor and pass template callbacks inside personalization.`,
      )
    return (
      <TemplateEditor
        {...personalization}
        theme={theme === 'dark' ? 'dark' : 'light'}
        className={className}
      />
    )
  }
  return (
    <VoucherBuilderProvider {...runtime}>
      <VoucherBuilderEditor locale={locale} theme={theme} className={className} />
    </VoucherBuilderProvider>
  )
}

export type VoucherBuilderEditorProps = Pick<VoucherBuilderProps, 'locale' | 'theme' | 'className'>

/** The editor surface for consumers composing their own provider and controls. */
export function VoucherBuilderEditor({
  locale = 'en',
  theme = 'light',
  className,
}: VoucherBuilderEditorProps) {
  const [portalRoot, setPortalRoot] = useState<HTMLDivElement | null>(null)
  const [systemDark, setSystemDark] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches,
  )
  useEffect(() => {
    if (theme !== 'system' || !window.matchMedia) return
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    setSystemDark(query.matches)
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    query.addEventListener('change', handler)
    return () => query.removeEventListener('change', handler)
  }, [theme])
  return (
    <VoucherPortalContext.Provider value={portalRoot}>
      <ThemeScope
        ref={setPortalRoot}
        className={cn(
          'nc-workspace',
          theme === 'dark' || (theme === 'system' && systemDark) ? 'dark' : 'light',
          className,
        )}
      >
        <DirectionProvider direction={getDirection(locale)}>
          <ComposerInner locale={locale} />
        </DirectionProvider>
      </ThemeScope>
    </VoucherPortalContext.Provider>
  )
}

function ComposerInner({ locale }: { locale: string }) {
  const toast = useToast()

  const readOnly = useReadOnly()
  const viewerProject = useVoucherProject((p) => (readOnly ? p : null))
  const { activeSectionId } = useVoucherSelection()
  const sections = useVoucherProject((p) => p.sections)
  const language = useVoucherProject((p) => p.global.metadata.language) || locale
  const instance = useVoucherInstance()
  const actions = useVoucherActions()
  const { templates, load: loadTemplate } = useVoucherTemplates()
  const { canvasRef, zoom, setZoom, fitWidth, fitPage } = useCanvasZoom()
  const [preview, setPreview] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [rightTab, setRightTab] = useState<InspectorMode>('block')
  const [inspectorRequest, setInspectorRequest] = useState(0)
  const openInspector = (mode: InspectorMode) => {
    setRightTab(mode)
    setInspectorRequest((n) => n + 1)
  }
  const showBlockSettings = useFeature('blockSettings')
  const showGlobalSettings = useFeature('globalSettings')
  const showValidation = useFeature('validation')
  const showExport = useFeature('export')
  const showCommandPalette = useFeature('commandPalette')
  const showContextMenu = useFeature('contextMenu')
  const showSecurity = useFeature('security')
  const showClipboard = useFeature('clipboard')
  const showUndoRedo = useFeature('undoRedo')
  useEffect(() => {
    const available = [
      showBlockSettings && 'block',
      showGlobalSettings && 'global',
      showValidation && 'validate',
    ].filter(Boolean)
    if (!available.includes(rightTab) && available[0]) setRightTab(available[0] as InspectorMode)
  }, [rightTab, showBlockSettings, showGlobalSettings, showValidation])
  const [confirmState, setConfirmState] = useState({
    open: false,
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    onConfirm: () => {},
  })
  const [contextMenu, setContextMenu] = useState<{
    position: { x: number; y: number } | null
    blockId: string | null
  }>({ position: null, blockId: null })
  const requestDelete = (ids: string[]) => {
    const project = actions.getProject()
    if (ids.some((id) => getParentContext(project, id)?.kind === 'structural')) return
    const removable = ids.filter((id) => project.blocks[id])
    if (!removable.length) return
    setConfirmState({
      open: true,
      title: `Delete ${removable.length === 1 ? 'selected block' : 'selected blocks'}?`,
      message: 'The selected blocks will be removed from this document. You can restore them with Undo.',
      confirmLabel: 'Delete blocks',
      onConfirm: () => {
        actions.removeBlocks(removable)
        setConfirmState((state) => ({ ...state, open: false }))
      },
    })
  }
  useKeyboardShortcuts({
    onOpenPalette: showCommandPalette ? () => setPaletteOpen(true) : undefined,
    onOpenShortcuts: () => setShortcutsOpen(true),
    onDelete: requestDelete,
    clipboardEnabled: showClipboard,
    undoRedoEnabled: showUndoRedo,
    editingEnabled: !readOnly,
  })
  useSecurityGuard(
    showSecurity
      ? {
          onPrintAttempt: () => toast('Printing is disabled. Use Export instead.', 'warning'),
          onDevToolsDetected: () => toast('Developer tools detected', 'warning'),
        }
      : undefined,
  )
  const handleCanvasContextMenu = (e: React.MouseEvent) => {
    if (!showContextMenu) return
    const blockId = (e.target as HTMLElement).closest('[data-block-id]')?.getAttribute('data-block-id')
    if (!blockId) return
    e.preventDefault()
    actions.setActiveBlock(blockId)
    setContextMenu({ position: { x: e.clientX, y: e.clientY }, blockId })
  }
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const project = actions.getProject()
    const section = getSectionForBlock(project, String(active.id))
    if (!section) return
    const oldIndex = section.blockIds.indexOf(String(active.id))
    const newIndex = section.blockIds.indexOf(String(over.id))
    if (oldIndex >= 0 && newIndex >= 0) actions.reorderBlocks(section.id, oldIndex, newIndex)
  }
  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,.cved,application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const result = instance.importProject(JSON.parse(await file.text()))
        if (!result.project) {
          toast(result.errors[0] || 'Invalid project file', 'error')
          return
        }
        toast(
          result.warnings.length ? `Project imported — ${result.warnings[0]}` : 'Project imported',
          result.warnings.length ? 'warning' : 'success',
        )
      } catch {
        toast('Invalid file format', 'error')
      }
    }
    input.click()
  }
  const handleReset = () =>
    setConfirmState({
      open: true,
      title: 'Reset project',
      message: 'This will clear your blocks and settings. Export your work first if you want to keep a copy.',
      confirmLabel: 'Reset',
      onConfirm: () => {
        actions.resetProject()
        setConfirmState((s) => ({ ...s, open: false }))
        toast('Project reset', 'info')
      },
    })
  const commandContext: CommandContext = {
    addBlock: (type) => {
      if (activeSectionId) actions.addBlock(activeSectionId, type as BlockType)
    },
    addPage: () => toast('Voucher sections are fixed', 'info'),
    switchPage: actions.setActiveSectionId,
    templates,
    pages: sections.map((s, i) => ({ id: s.id, title: `Section ${i + 1}` })),
    loadTemplate: (id) => {
      const template = templates.find((t) => t.id === id)
      if (!template) return
      setConfirmState({
        open: true,
        title: 'Load template',
        message: 'Replace the current document? You can undo this change.',
        confirmLabel: 'Load template',
        onConfirm: () => {
          loadTemplate(template)
          setConfirmState((s) => ({ ...s, open: false }))
        },
      })
    },
    undo: actions.undo,
    redo: actions.redo,
    exportHTML: () => setExportOpen(true),
    exportJSON: () => setExportOpen(true),
    importJSON: handleImport,
    preview: () => setPreview(true),
    reset: handleReset,
    openShortcuts: () => setShortcutsOpen(true),
    focusTab: (tab) => openInspector(tab === 'global' || tab === 'validate' ? tab : 'block'),
  }
  return (
    <div lang={language} dir={getDirection(language)}>
      <DockedWorkspace
        inspectorMode={rightTab}
        inspectorRequest={inspectorRequest}
        onInspectorModeChange={setRightTab}
        onPreview={() => setPreview(true)}
        onExport={() => setExportOpen(true)}
        onImport={handleImport}
        onReset={handleReset}
        onCommands={() => setPaletteOpen(true)}
        onShortcuts={() => setShortcutsOpen(true)}
        onDelete={requestDelete}
        toolbar={(openInspector) => (
          <CanvasToolbar
            zoom={zoom}
            onZoomChange={setZoom}
            onFitWidth={fitWidth}
            onFitPage={fitPage}
            onOpenInspector={openInspector}
          />
        )}
      >
        <main
          ref={canvasRef}
          aria-label="Voucher canvas"
          className="nc-canvas nc-canvas-scroll"
          onContextMenu={handleCanvasContextMenu}
        >
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={sections.flatMap((s) => s.blockIds)}
              strategy={verticalListSortingStrategy}
            >
              <div
                className="nc-paper-stage"
                style={
                  {
                    '--nc-canvas-scale': zoom / 100,
                    width: ((mmToPx(A4_WIDTH_MM) + 20) * zoom) / 100,
                    height: ((mmToPx(A4_HEIGHT_MM) + 64) * zoom) / 100,
                  } as CSSProperties
                }
              >
                <div
                  style={{
                    width: mmToPx(A4_WIDTH_MM) + 20,
                    transform: `scale(${zoom / 100})`,
                    transformOrigin: 'top left',
                  }}
                >
                  {viewerProject ? (
                    <iframe
                      title="Voucher document"
                      sandbox="allow-same-origin"
                      srcDoc={exportToHTML(viewerProject)}
                      className="mx-auto block border-0 nc-paper"
                      style={{ width: mmToPx(A4_WIDTH_MM), height: mmToPx(A4_HEIGHT_MM) }}
                    />
                  ) : (
                    <VoucherCanvas onSectionSelect={() => setRightTab('block')} />
                  )}
                </div>
              </div>
            </SortableContext>
          </DndContext>
        </main>
      </DockedWorkspace>
      <ActionDialog
        open={preview}
        onOpenChange={setPreview}
        title="Preview · A4"
        size="5xl"
        showConfirm={false}
        strings={{ cancel: 'Close preview' }}
      >
        <div className="nc-preview-scroll">
          <iframe
            title="Voucher preview"
            sandbox="allow-same-origin"
            srcDoc={exportToHTML(actions.getProject())}
            style={{ width: mmToPx(A4_WIDTH_MM), height: mmToPx(A4_HEIGHT_MM) }}
          />
        </div>
      </ActionDialog>
      {showExport && (
        <ExportDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          onReviewLayout={
            showGlobalSettings
              ? () => {
                  setExportOpen(false)
                  openInspector('global')
                }
              : undefined
          }
        />
      )}
      {showCommandPalette && (
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} context={commandContext} />
      )}
      <ToastContainer />
      <ShortcutLegend
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        capabilities={{
          commands: showCommandPalette,
          history: showUndoRedo,
          clipboard: showClipboard,
          editing: !readOnly,
        }}
      />
      <ConfirmDialog {...confirmState} onCancel={() => setConfirmState((s) => ({ ...s, open: false }))} />
      {showContextMenu && (
        <BlockContextMenu
          position={contextMenu.position}
          blockId={contextMenu.blockId}
          sectionId={activeSectionId}
          onClose={() => setContextMenu({ position: null, blockId: null })}
          onFocusSettings={() => openInspector('block')}
        />
      )}
    </div>
  )
}
