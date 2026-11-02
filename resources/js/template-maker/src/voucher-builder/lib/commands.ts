import { getAllBlockDefs } from '../blocks/registry'
import { builtinTemplates, type VoucherTemplate } from '../templates'
import type { LucideIcon } from 'lucide-react'
import {
  Plus, FileText, LayoutTemplate, Undo2, Redo2, Upload,
  Eye, RotateCcw, Settings, CheckSquare, Keyboard,
  FileDown, FileCode,
} from 'lucide-react'

export interface Command {
  id: string
  label: string
  category: string
  icon?: LucideIcon
  keywords?: string
  action: () => void
}

export interface CommandContext {
  addBlock: (type: string) => void
  addPage: () => void
  switchPage: (pageId: string) => void
  pages: { id: string; title: string }[]
  templates?: VoucherTemplate[]
  loadTemplate: (templateId: string) => void
  undo: () => void
  redo: () => void
  exportHTML: () => void
  exportJSON: () => void
  importJSON: () => void
  preview: () => void
  reset: () => void
  openShortcuts: () => void
  focusTab: (tab: string) => void
}

export function buildCommands(ctx: CommandContext): Command[] {
  const commands: Command[] = []

  // ── Block commands ──
  const defs = getAllBlockDefs().filter((d) => !d.hidden)
  for (const def of defs) {
    commands.push({
      id: `add-block-${def.type}`,
      label: `Add ${def.name}`,
      category: 'Blocks',
      icon: def.icon,
      keywords: `block ${def.category} ${def.description}`,
      action: () => ctx.addBlock(def.type),
    })
  }

  // ── Page commands ──
  commands.push({
    id: 'add-page',
    label: 'Add Page',
    category: 'Pages',
    icon: Plus,
    action: () => ctx.addPage(),
  })
  for (const page of ctx.pages) {
    commands.push({
      id: `switch-page-${page.id}`,
      label: `Switch to ${page.title}`,
      category: 'Pages',
      icon: FileText,
      action: () => ctx.switchPage(page.id),
    })
  }

  // ── Template commands ──
  for (const tmpl of ctx.templates ?? builtinTemplates) {
    commands.push({
      id: `template-${tmpl.id}`,
      label: `Load ${tmpl.name} Template`,
      category: 'Templates',
      icon: LayoutTemplate,
      keywords: tmpl.description,
      action: () => ctx.loadTemplate(tmpl.id),
    })
  }

  // ── Action commands ──
  commands.push(
    { id: 'undo', label: 'Undo', category: 'Actions', icon: Undo2, keywords: 'history back', action: ctx.undo },
    { id: 'redo', label: 'Redo', category: 'Actions', icon: Redo2, keywords: 'history forward', action: ctx.redo },
    { id: 'export-html', label: 'Export HTML', category: 'Actions', icon: FileCode, action: ctx.exportHTML },
    { id: 'export-json', label: 'Export JSON', category: 'Actions', icon: FileDown, action: ctx.exportJSON },
    { id: 'import-json', label: 'Import JSON', category: 'Actions', icon: Upload, action: ctx.importJSON },
    { id: 'preview', label: 'Toggle Preview', category: 'Actions', icon: Eye, action: ctx.preview },
    { id: 'reset', label: 'Reset Project', category: 'Actions', icon: RotateCcw, keywords: 'clear new', action: ctx.reset },
    { id: 'shortcuts', label: 'Keyboard Shortcuts', category: 'Actions', icon: Keyboard, action: ctx.openShortcuts },
  )

  // ── Navigation commands ──
  commands.push(
    { id: 'nav-block', label: 'Go to Block Settings', category: 'Navigation', icon: Settings, action: () => ctx.focusTab('block') },
    { id: 'nav-global', label: 'Go to Global Settings', category: 'Navigation', icon: Settings, action: () => ctx.focusTab('global') },
    { id: 'nav-validate', label: 'Go to Validation', category: 'Navigation', icon: CheckSquare, action: () => ctx.focusTab('validate') },
  )

  return commands
}

/** Simple fuzzy match — checks if all characters of query appear in order in target */
export function fuzzyMatch(query: string, target: string): boolean {
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  let qi = 0
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++
  }
  return qi === q.length
}
