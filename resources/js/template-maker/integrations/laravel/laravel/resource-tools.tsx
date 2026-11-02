import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, AlertDescription } from 'themelia-react-ui/base/feedback'
import { Button } from 'themelia-react-ui/base/buttons'
import { Card } from 'themelia-react-ui/base/cards'
import { Select } from 'themelia-react-ui/base/choice-inputs'
import { FormField, FormSection } from 'themelia-react-ui/base/forms'
import { Input } from 'themelia-react-ui/base/text-inputs'
import { AdaptiveGrid, Stack } from 'themelia-react-ui/base/structure'
import { Text } from 'themelia-react-ui/typography'
import type { StandaloneTemplateDraft, TemplateSourceDocument } from '../../../template-renderer'
import type { AssetPage, EditorBootstrap, ManagedTemplateAsset, ResourceRevision, TemplateRepository } from './contracts'
import { applyTemplateResource, referenceTemplateContent } from './resources'

export interface TemplateResourceToolsProps {
  id: string
  repository: TemplateRepository
  source: TemplateSourceDocument
  bootstrap?: EditorBootstrap
  replaceSource: (source: TemplateSourceDocument) => void
  refreshPreviewAssets: (assets: Record<string, string>) => void
}
const imageTypes = { document: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'], email: ['image/png', 'image/jpeg', 'image/gif'] }

/** Example application controls. Hosts may replace them without altering any editor APIs. */
export function TemplateResourceTools({ id, repository, source, bootstrap, replaceSource, refreshPreviewAssets }: TemplateResourceToolsProps) {
  // Raw variants need not repeat their pinned family's target.
  const target = source.source.mode === 'standalone' ? source.target : bootstrap?.document?.target ?? bootstrap?.family?.source?.target ?? bootstrap?.family?.document.target
  const safeTypes = imageTypes[target ?? 'email']
  const advertised = (target ? bootstrap?.capabilities.assetTypesByTarget?.[target] : undefined) ?? bootstrap?.capabilities.assetTypes ?? safeTypes
  const typesKey = safeTypes.filter(type => advertised.includes(type)).join(',')
  const allowedTypes = useMemo(() => typesKey ? typesKey.split(',') : [], [typesKey])
  const entity = useMemo(() => ({ id, repository }), [id, repository])
  const scope = useMemo(() => ({ entity, target, typesKey }), [entity, target, typesKey])
  const activeScope = useRef<typeof scope | null>(scope)
  activeScope.current = scope
  useEffect(() => {
    activeScope.current = scope
    return () => { if (activeScope.current === scope) activeScope.current = null }
  }, [scope])

  const [catalog, setCatalog] = useState<{ entity: typeof entity; data: ResourceRevision[]; error?: string } | null>(null)
  const [resourceRetry, setResourceRetry] = useState(0)
  const [requested, setRequested] = useState<{ scope: typeof scope; page: number } | null>(null)
  const page = requested?.scope === scope ? requested.page : 1
  const [loadedPage, setLoadedPage] = useState<{ scope: typeof scope; page: number; result?: AssetPage; error?: string } | null>(null)
  const [retry, setRetry] = useState(0)
  const [selection, setSelection] = useState<{ scope: typeof scope; asset: ManagedTemplateAsset } | null>(null)
  const [openChoices, setOpenChoices] = useState<{ scope: typeof scope; page: number; assets: ManagedTemplateAsset[] } | null>(null)
  const [resourceId, setResourceId] = useState('')
  const [field, setField] = useState('')
  const [path, setPath] = useState('')
  const [canonicalId, setCanonicalId] = useState('')
  const [operation, setOperation] = useState<{ scope: typeof scope; busy: boolean; error?: string } | null>(null)

  useEffect(() => {
    setResourceId(''); setCanonicalId(''); setField(''); setPath('')
  }, [entity])
  useEffect(() => {
    const controller = new AbortController()
    setCatalog(null)
    repository.listResources(id, {}, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setCatalog({ entity, data: data.filter(resource => resource.revision > 0) })
    }).catch(cause => {
      if (!controller.signal.aborted) setCatalog({ entity, data: [], error: cause instanceof Error ? cause.message : 'Unable to load resources.' })
    })
    return () => controller.abort()
  }, [entity, id, repository, resourceRetry])

  useEffect(() => {
    const controller = new AbortController()
    setLoadedPage(null)
    repository.listAssets({ ...(target ? { target } : {}), page }, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) setLoadedPage({ scope, page, result })
    }).catch(cause => {
      if (!controller.signal.aborted) setLoadedPage({ scope, page, error: cause instanceof Error ? cause.message : 'Unable to load retained images.' })
    })
    return () => controller.abort()
  }, [scope, page, retry, repository, target])

  const resources = catalog?.entity === entity ? catalog.data : []
  const currentPage = loadedPage?.scope === scope && loadedPage.page === page ? loadedPage : null
  const loading = currentPage === null
  const assets = (currentPage?.result?.data ?? []).filter(asset => allowedTypes.includes(asset.mimeType))
  const selectedAsset = selection?.scope === scope && allowedTypes.includes(selection.asset.mimeType) ? selection.asset : null
  const choices = selectedAsset && !assets.some(asset => asset.id === selectedAsset.id) ? [...assets, selectedAsset] : assets
  // Native selection completes before the old retained option can leave its collection.
  const displayedChoices = openChoices?.scope === scope && openChoices.page === page ? openChoices.assets : choices
  const hasNext = Boolean(currentPage?.result?.nextPageUrl) || page < (currentPage?.result?.lastPage ?? page)
  const busy = operation?.scope === scope && operation.busy
  const error = operation?.scope === scope ? operation.error : ''
  const resourceError = catalog?.entity === entity ? catalog.error : undefined
  const resourcesLoading = catalog?.entity !== entity
  const run = async (action: () => void | Promise<void>) => {
    setOperation({ scope, busy: true })
    try { await action(); if (activeScope.current === scope) setOperation({ scope, busy: false }) }
    catch (cause) { if (activeScope.current === scope) setOperation({ scope, busy: false, error: cause instanceof Error ? cause.message : 'Resource operation failed.' }) }
  }
  if (source.source.mode !== 'standalone') return <Text type="secondary">Variant resources come from the pinned family. Shared content and presentation defaults can be changed in the variant workspace.</Text>
  const standalone = source as StandaloneTemplateDraft
  const selected = resources.find(resource => resource.id === resourceId)
  const mapAsset = (asset: ManagedTemplateAsset) => {
    if (!allowedTypes.includes(asset.mimeType)) throw new Error('This image type is not supported for the template output target.')
    if (!canonicalId || !standalone.source.definition.assets.some(asset => asset.id === canonicalId && asset.kind === 'image')) throw new Error('Choose an existing image in the template assets panel first.')
    const next = structuredClone(standalone)
    next.managedAssets = { ...next.managedAssets, [canonicalId]: asset.id }; delete next.artifacts
    replaceSource(next); refreshPreviewAssets({ [canonicalId]: asset.previewUrl })
  }
  const images = standalone.source.definition.assets.filter(asset => asset.kind === 'image')
  return <Card title="Shared resources and retained media" description="Pin reusable resources and connect template images to retained files.">
    {error && <Alert tone="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert>}
    <AdaptiveGrid minColumnWidth="lg" gap="2xl" align="start">
    <FormSection surface="flat" padding="none" titleSize="sm" title="Pinned resources" description="Use an exact revision of a layout, partial, theme, settings or shared content.">
      {resourceError && <Alert tone="destructive" role="alert"><AlertDescription>{resourceError}</AlertDescription></Alert>}
      {resourcesLoading && <Text size="sm" type="secondary" role="status">Loading scoped resources…</Text>}
      {!resourcesLoading && !resourceError && !resources.length && <Text size="sm" type="secondary">No published resources are available in this template’s scope.</Text>}
      {resourceError && <Button buttonStyle="outline" onClick={() => setResourceRetry(value => value + 1)}>Retry resources</Button>}
      <FormField label="Scoped resource"><Select aria-label="Scoped resource" disabled={busy || resourcesLoading} value={resourceId} onValueChange={value => setResourceId(value ?? '')} options={[{ value: '', label: 'Choose a resource' }, ...resources.filter(resource => ['partial', 'layout', 'theme', 'settings', 'content'].includes(resource.kind)).map(resource => ({ value: resource.id, label: `${resource.name} · ${resource.scope} · ${resource.kind} · v${resource.revision}` }))]} /></FormField>
      {selected && <Text size="sm" type="secondary">{selected.kind} · {selected.scope} scope · pinned revision {selected.revision}</Text>}
      {selected?.kind === 'content' ? <>
        <FormField label="Content field"><Select aria-label="Content field" value={field} onValueChange={value => setField(value ?? '')} options={[{ value: '', label: 'Choose a field' }, ...standalone.source.definition.fields.filter(field => field.path.startsWith('content.')).map(field => ({ value: field.path.slice(8), label: field.label }))]} /></FormField>
        <FormField label="Resource value path"><Input aria-label="Resource value path" value={path} onChange={event => setPath(event.target.value)} placeholder="heading" /></FormField>
        <Button disabled={busy || !field} onClick={() => void run(() => replaceSource(referenceTemplateContent(standalone, field, selected, path)))}>Use pinned content</Button>
      </> : <Button disabled={busy || !selected} onClick={() => void run(() => { if (selected) replaceSource(applyTemplateResource(standalone, selected)) })}>Apply resource</Button>}
    </FormSection>
    <FormSection surface="flat" padding="none" titleSize="sm" title="Template images" description="Choose an image in the template, then map a retained file or upload a replacement.">
      {currentPage?.error && <Alert tone="destructive" role="alert"><AlertDescription>{currentPage.error}</AlertDescription></Alert>}
      {!images.length && <Text size="sm" type="secondary">Add an image in the builder’s assets panel before mapping a retained file.</Text>}
      <FormField label="Template image"><Select aria-label="Template image" disabled={busy || !images.length} value={canonicalId} onValueChange={value => setCanonicalId(value ?? '')} options={[{ value: '', label: 'Choose an image' }, ...images.map(asset => ({ value: asset.id, label: asset.name }))]} /></FormField>
      <FormField label="Retained image"><Select aria-label="Retained image" value={selectedAsset?.id ?? ''} onOpenChange={open => { if (open) setOpenChoices({ scope, page, assets: choices }) }} onOpenChangeComplete={open => { if (!open) setOpenChoices(null) }} onValueChange={value => { const asset = displayedChoices.find(asset => asset.id === value); setSelection(asset ? { scope, asset } : null) }} options={[{ value: '', label: 'Choose a retained image' }, ...displayedChoices.map(asset => ({ value: asset.id, label: asset.name }))]} /></FormField>
      <Button disabled={busy || !canonicalId || !selectedAsset} onClick={() => void run(() => { if (selectedAsset) mapAsset(selectedAsset) })}>Map image</Button>
      <FormField label="Upload retained image"><Input type="file" aria-label="Upload retained image" accept={typesKey} disabled={busy || !canonicalId || !allowedTypes.length} onChange={event => {
        const file = event.target.files?.[0]; event.target.value = ''
        if (file) void run(async () => {
          if (file.type && !allowedTypes.includes(file.type)) throw new Error('This image type is not supported for the template output target.')
          const asset = await repository.uploadAsset(file)
          if (activeScope.current !== scope) return
          mapAsset(asset)
          setSelection({ scope, asset })
        })
      }} /></FormField>
    <Stack direction="horizontal" align="center" gap="sm" wrap>
      <Button size="sm" buttonStyle="outline" disabled={busy || page === 1} onClick={() => setRequested({ scope, page: page - 1 })}>Previous images</Button>
      <Text size="sm" type="secondary" role="status">{loading ? 'Loading retained images…' : `Image page ${page}${currentPage.result?.lastPage ? ` of ${currentPage.result.lastPage}` : ''}${!assets.length ? ' · No retained images on this page.' : ''}`}</Text>
      <Button size="sm" buttonStyle="outline" disabled={busy || loading || !hasNext} onClick={() => setRequested({ scope, page: page + 1 })}>Next images</Button>
      {currentPage?.error && <Button onClick={() => setRetry(value => value + 1)}>Retry images</Button>}
    </Stack>
    </FormSection>
    </AdaptiveGrid>
  </Card>
}
