import { useState } from 'react'
import {
  Menubar, MenubarMenu, MenubarTrigger, MenubarContent,
  MenubarItem, MenubarSeparator, MenubarCheckboxItem,
  MenubarShortcut, MenubarSub, MenubarSubTrigger, MenubarSubContent,
} from '../ui/menubar'
import { useVisualToolingState, useVisualToolingActions, useProjectActions, useBlockActions, useSectionState, useHistoryActions } from '../store/hooks'
import { getAllBlockDefs, BLOCK_CATEGORIES } from '../blocks'
import { exportToHTML, downloadFile, parseVoucherImport } from '../export/index'
import type { BlockType } from '../schema'
import '../blocks/definitions'
import { SaveTemplateDialog } from './save-template-dialog'
import { useFeature } from '../context'

export function AppMenubar() {
  const templatesEnabled = useFeature('templates')
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false)
  const { showRulers, showGrid, snapToGrid, debugMode } = useVisualToolingState()
  const { setShowRulers, setShowGrid, setSnapToGrid, setDebugMode } = useVisualToolingActions()
  const { resetProject, getProject, loadProject } = useProjectActions()
  const { addBlock } = useBlockActions()
  const { activeSectionId } = useSectionState()
  const { undo, redo } = useHistoryActions()
  const allDefs = getAllBlockDefs().filter(d => !d.hidden && d.allowedIn.length > 0)

  const handleExportHTML = () => {
    const project = getProject()
    const html = exportToHTML(project)
    downloadFile(html, `${project.global.metadata.title || 'voucher'}.html`, 'text/html')
  }

  const handleExportJSON = () => {
    const project = getProject()
    const json = JSON.stringify(project, null, 2)
    downloadFile(json, `${project.global.metadata.title || 'voucher'}.json`, 'application/json')
  }

  const handleImportJSON = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          const raw = JSON.parse(ev.target?.result as string)
          const result = parseVoucherImport(raw)
          if (result.project) loadProject(result.project)
        } catch { /* ignore */ }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  return (
    <Menubar className="border-none bg-transparent shadow-none h-auto p-0">
      <MenubarMenu>
        <MenubarTrigger className="text-xs font-medium px-2 py-0.5 text-muted-foreground data-[state=open]:text-foreground">File</MenubarTrigger>
        <MenubarContent className="text-xs">
          <MenubarItem onClick={() => resetProject()}>New <MenubarShortcut>&#8984;N</MenubarShortcut></MenubarItem>
          <MenubarSeparator />
          <MenubarItem onClick={handleImportJSON}>Import JSON</MenubarItem>
          <MenubarItem onClick={handleExportHTML}>Export HTML</MenubarItem>
          <MenubarItem onClick={handleExportJSON}>Export JSON</MenubarItem>
          {templatesEnabled && (
            <>
              <MenubarSeparator />
              <MenubarItem onClick={() => setSaveTemplateOpen(true)}>Add reusable template…</MenubarItem>
            </>
          )}
          <MenubarSeparator />
          <MenubarItem onClick={undo}>Undo <MenubarShortcut>&#8984;Z</MenubarShortcut></MenubarItem>
          <MenubarItem onClick={redo}>Redo <MenubarShortcut>&#8679;&#8984;Z</MenubarShortcut></MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger className="text-xs font-medium px-2 py-0.5 text-muted-foreground data-[state=open]:text-foreground">View</MenubarTrigger>
        <MenubarContent className="text-xs">
          <MenubarCheckboxItem checked={showRulers} onCheckedChange={() => setShowRulers(!showRulers)}>Rulers</MenubarCheckboxItem>
          <MenubarCheckboxItem checked={showGrid} onCheckedChange={() => setShowGrid(!showGrid)}>Grid</MenubarCheckboxItem>
          <MenubarCheckboxItem checked={snapToGrid} onCheckedChange={() => setSnapToGrid(!snapToGrid)}>Snap to Grid</MenubarCheckboxItem>
          <MenubarCheckboxItem checked={debugMode} onCheckedChange={() => setDebugMode(!debugMode)}>Debug Mode</MenubarCheckboxItem>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger className="text-xs font-medium px-2 py-0.5 text-muted-foreground data-[state=open]:text-foreground">Insert</MenubarTrigger>
        <MenubarContent className="text-xs">
          {BLOCK_CATEGORIES.map(({ key, label }) => {
            const blocks = allDefs.filter(d => d.category === key)
            if (blocks.length === 0) return null
            return (
              <MenubarSub key={key}>
                <MenubarSubTrigger>{label}</MenubarSubTrigger>
                <MenubarSubContent className="text-xs">
                  {blocks.map(def => (
                    <MenubarItem
                      key={def.type}
                      disabled={!activeSectionId}
                      onClick={() => activeSectionId && addBlock(activeSectionId, def.type as BlockType)}
                    >
                      {def.name}
                    </MenubarItem>
                  ))}
                </MenubarSubContent>
              </MenubarSub>
            )
          })}
        </MenubarContent>
      </MenubarMenu>
      <SaveTemplateDialog open={saveTemplateOpen} onOpenChange={setSaveTemplateOpen} />
    </Menubar>
  )
}
