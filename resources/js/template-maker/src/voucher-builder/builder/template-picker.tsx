import { ActionMenu } from 'themelia-react-ui/base/action-menu'
import { Item, ItemGroup, ItemMedia, ItemContent, ItemTitle, ItemDescription } from 'themelia-react-ui/base/item'
import { EmptyState } from 'themelia-react-ui/blocks/data-display'
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from 'themelia-react-ui/base/feedback'
import { Text } from 'themelia-react-ui/typography'
import { Select } from 'themelia-react-ui/base/choice-inputs'
import { Stack as UIStack } from 'themelia-react-ui/base/structure'
import { Button as UIAction } from 'themelia-react-ui/base/buttons'
import { useState, useCallback, useMemo } from 'react'
import { instantiateTemplate } from '../templates'
import { useVoucherTemplates } from '../hooks/use-voucher-builder'
import type { VoucherTemplate } from '../templates'
import { ConfirmDialog } from './confirm-dialog'
import { EditTemplateDialog } from './edit-template-dialog'
import { SaveTemplateDialog } from './save-template-dialog'
import { Input as SettingsInput } from 'themelia-react-ui/base/text-inputs'
import { BookmarkPlus, Download, Pencil, Search, Trash2, Upload } from 'lucide-react'
import { useToast } from '../hooks/use-toast'
import { downloadFile, exportToHTML } from '../export/html'
import { Badge } from '../ui/badge'

function TemplatePreview({ template }: { template: VoucherTemplate }) {
  const html = useMemo(
    () => (template.thumbnail ? '' : exportToHTML(instantiateTemplate(template))),
    [template],
  )
  return (
    <span className="nc-template-preview" aria-hidden="true">
      {template.thumbnail ? (
        <img src={template.thumbnail} alt="" className="h-full w-full object-contain" loading="lazy" />
      ) : (
        <iframe title={`${template.name} thumbnail`} srcDoc={html} sandbox="" tabIndex={-1} loading="lazy" />
      )}
    </span>
  )
}

export function TemplatePicker() {
  const toast = useToast()

  const {
    templates,
    error: templateError,
    load,
    remove,
    exportJSON,
    importJSON,
  } = useVoucherTemplates()
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<VoucherTemplate | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<VoucherTemplate | null>(null)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)

  const [editTarget, setEditTarget] = useState<VoucherTemplate | null>(null)
  const handleExportUserTemplates = () => {
    const json = exportJSON()
    const parsed = JSON.parse(json) as { templates: unknown[] }
    if (!parsed.templates.length) {
      toast('You have no user templates to export.', 'info')
      return
    }
    downloadFile(json, 'voucher-templates.json', 'application/json')
    toast(
      `Exported ${parsed.templates.length} template${parsed.templates.length === 1 ? '' : 's'}.`,
      'success',
    )
  }

  const handleImportUserTemplates = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        const raw = ev.target?.result as string
        const result = importJSON(raw)
        if (result.errors.length > 0) {
          toast(`Import failed: ${result.errors.join('; ')}`, 'error')
          return
        }
        toast(
          `Imported ${result.imported} template${result.imported === 1 ? '' : 's'}${result.skipped ? `, skipped ${result.skipped}` : ''}.`,
          'success',
        )
      }
      reader.readAsText(file)
    }
    input.click()
  }

  const handleConfirmLoad = useCallback(() => {
    if (!confirmTarget) return
    try {
      load(confirmTarget)
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Unable to load template', 'error')
      return
    }
    setConfirmTarget(null)
    toast(`Loaded template: ${confirmTarget.name}`, 'success')
  }, [confirmTarget, load])

  const categories = [...new Set(templates.map((t) => t.category).filter(Boolean))] as string[]

  const query = search.trim().toLowerCase()
  const filtered = templates.filter((t) => {
    const matchesSearch =
      !query || t.name.toLowerCase().includes(query) || t.description.toLowerCase().includes(query)
    const matchesCategory = !activeCategory || t.category === activeCategory
    return matchesSearch && matchesCategory
  })

  const sourceBadge = (source: string) => {
    return <Badge variant="secondary">{source === 'builtin' ? 'Starter' : source === 'user' ? 'Saved' : 'Provided'}</Badge>
  }

  return (
    <UIStack direction="vertical" gap="lg" wrap={false} className="">
      {templateError && (
        <Alert tone="destructive">
          <AlertTitle>Template operation failed</AlertTitle>
          <AlertDescription>{templateError.message}</AlertDescription>
        </Alert>
      )}
      <UIStack direction="horizontal" gap="sm" justify="between" align="center">
          <UIAction
            buttonStyle="outline"
            onClick={() => setSaveOpen(true)}
            title="Add current voucher to template library"
            aria-label="Add current voucher to template library"
          >
            <BookmarkPlus />Save current
          </UIAction>
          <ActionMenu
            srText="Template library actions"
            buttonProps={{ size: 'sm' }}
            actions={[
              { label: 'Import templates', icon: Upload, onClick: handleImportUserTemplates },
              {
                label: 'Export templates',
                icon: Download,
                onClick: handleExportUserTemplates,
                disabled: !templates.some((template) => template.source === 'user'),
              },
            ]}
          />
      </UIStack>
      <Text type="secondary">
        Start from a reusable design. You can undo a replacement.
      </Text>

      <SettingsInput
        aria-label="Search templates"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search templates…"
        startIcon={Search}
        clearable
        onClear={() => setSearch('')}
      />

      {categories.length > 1 && (
        <Select
          aria-label="Template category"
          value={activeCategory ?? ''}
          options={[
            { value: '', label: 'All categories' },
            ...categories.map((category) => ({ value: category, label: category })),
          ]}
          onValueChange={(value) => setActiveCategory(value || null)}
        />
      )}
      <ItemGroup aria-label="Reusable voucher designs">
        {filtered.map((template) => (
          <Item
            key={template.id}
            className="flex-nowrap items-start"
            role="group"
            aria-label={template.name}
          >
            <ItemMedia><TemplatePreview template={template} /></ItemMedia>
            <ItemContent>
              <ItemTitle>{template.name}</ItemTitle>
              {template.description && <ItemDescription clamp="none">{template.description}</ItemDescription>}
              {sourceBadge(template.source)}
              <UIStack direction="horizontal" gap="sm" align="center" wrap={false}>
              <UIAction buttonStyle="outline"
                aria-label={`Use template ${template.name}`}
                onClick={() => setConfirmTarget(template)}
              >
                Use
              </UIAction>
              {template.source === 'user' && <ActionMenu srText={`Actions for ${template.name}`} actions={[
                { label: 'Edit', icon: Pencil, onClick: () => setEditTarget(template) },
                { label: 'Delete', icon: Trash2, tone: 'destructive', onClick: () => setDeleteTarget(template) },
              ]} />}
              </UIStack>
            </ItemContent>
          </Item>
        ))}
      </ItemGroup>
      {!filtered.length && (
        <EmptyState
          padding="sm"
          title={templates.length ? 'No matching templates' : 'No templates yet'}
          description={
            templates.length ? 'Try another search or category.' : 'Add this voucher as a reusable template.'
          }
          actions={
            templates.length ? (
              <UIAction
                onClick={() => {
                  setSearch('')
                  setActiveCategory(null)
                }}
              >
                Clear filters
              </UIAction>
            ) : (
              <UIAction onClick={() => setSaveOpen(true)}>Add template</UIAction>
            )
          }
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete template?"
        message={`Delete "${deleteTarget?.name ?? ''}" from your library? This cannot be undone.`}
        confirmLabel="Delete template"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget && remove(deleteTarget.id))
            toast(`Template "${deleteTarget.name}" removed from your library.`, 'info')
          setDeleteTarget(null)
        }}
      />
      <ConfirmDialog
        variant="warning"
        open={!!confirmTarget}
        title="Use this template?"
        message={`Replace the current document with “${confirmTarget?.name ?? ''}”? You can undo this change.`}
        confirmLabel="Use template"
        onConfirm={handleConfirmLoad}
        onCancel={() => setConfirmTarget(null)}
      />
      <EditTemplateDialog template={editTarget} onClose={() => setEditTarget(null)} />
      <SaveTemplateDialog open={saveOpen} onOpenChange={setSaveOpen} />
    </UIStack>
  )
}
