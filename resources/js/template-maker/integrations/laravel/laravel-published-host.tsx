import { useEffect, useRef, useState } from 'react'
import { TemplateWorkspace } from '../../template-creator'
import type { JsonObject } from '../../template-renderer'
import { Alert, AlertDescription, LoadingState } from 'themelia-react-ui/base/feedback'
import type { PreparedPublishedTemplate, TemplateRepository, TemplateValues } from './laravel/contracts'

export interface LaravelPublishedTemplateScreenProps {
  revisionId: string
  repository: TemplateRepository
  owner: TemplateValues
  initialInputs?: JsonObject
  initialSettings?: JsonObject
  onPersonalizationChange?: (patch: { inputs: JsonObject; settings: JsonObject }) => void
}

/** Customer route: the host authorizes owner references and persists only the returned selection patch. */
export function LaravelPublishedTemplateScreen({ revisionId, repository, owner, initialInputs = {}, initialSettings = {}, onPersonalizationChange }: LaravelPublishedTemplateScreenProps) {
  const key = JSON.stringify([revisionId, owner, initialInputs, initialSettings])
  const sequence = useRef(0)
  const [loaded, setLoaded] = useState<{ repository: TemplateRepository; key: string; epoch: number; value: PreparedPublishedTemplate } | null>(null)
  const [error, setError] = useState<{ repository: TemplateRepository; key: string; message: string } | null>(null)
  useEffect(() => {
    const controller = new AbortController(); const epoch = ++sequence.current
    setError(null)
    repository.preparePublished(revisionId, { owner, inputs: initialInputs, settings: initialSettings }, { signal: controller.signal }).then(value => {
      if (!controller.signal.aborted && sequence.current === epoch) setLoaded({ repository, key, epoch, value })
    }).catch(cause => { if (!controller.signal.aborted && sequence.current === epoch) setError({ repository, key, message: cause instanceof Error ? cause.message : 'Unable to prepare this template.' }) })
    return () => controller.abort()
  }, [key, repository])
  if (error?.repository === repository && error.key === key) return <Alert tone="destructive" role="alert"><AlertDescription>{error.message}</AlertDescription></Alert>
  if (!loaded || loaded.repository !== repository || loaded.key !== key) return <LoadingState label="Loading your template…" />
  const { document, data, previewAssets } = loaded.value
  const settings = Object.fromEntries(Object.entries(initialSettings).filter(([id]) => document.exposedSettings.includes(id)))
  return <TemplateWorkspace sessionKey={`${key}:${loaded.epoch}`} initialDocument={document} mode="personalize" previewData={data as JsonObject} initialSettings={settings} previewAssets={previewAssets} onPersonalizationChange={onPersonalizationChange} />
}
