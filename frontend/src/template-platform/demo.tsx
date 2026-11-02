import { useState } from 'react'
import { TemplateWorkspace } from './workspace'
import { createExperienceDocument } from './demo-documents'
import { GroupVariantWorkspace } from './variant-workspace'
import { materializeFamilyDocument } from './catalog'
import type { GroupVariantDocument } from './types'
import { createEmailTemplate } from '../template-email/presets'
import { exportBindingDocument } from './bindings'

/** Uses the complete existing editor; persistence remains owned by the host application. */
export function TemplatePlatformDemo({ theme = 'light', layout = 'default', variant = false, family = false, email = false }: { theme?: 'light' | 'dark'; layout?: 'default' | 'compact'; variant?: boolean; family?: boolean; email?: boolean }) {
  const [document] = useState(() => { const value = email ? exportBindingDocument(createEmailTemplate('Customer notification'), { target: 'email' }) : createExperienceDocument(); if (variant || family) value.variationPoints = [{ id: 'message-weight', label: 'Message weight', kind: 'node-style', nodeId: 'personal_message', property: 'font-weight', schema: { type: 'string', enum: ['normal', 'bold'] } }, { id: 'extra-sections', label: 'Additional sections', kind: 'children', target: { kind: 'children', nodeId: 'experience_details' }, minItems: 1, maxItems: 8, allowedKinds: ['element', 'text', 'block'], requiredIds: ['experience_label', 'experience_title', 'redemption'] }]; return value })
  const [source] = useState<GroupVariantDocument>(() => ({ format: 'template-document', schemaVersion: 1, target: 'document', source: { mode: 'group-variant', group: { id: 'experience-family', revision: 1 }, overrides: { content: { title: 'A weekend to remember.' }, settingsDefaults: { message_size: 18 } } } }))
  if (variant) return <GroupVariantWorkspace layout={layout} initialDocument={source} familyDocument={document} effectiveDocument={materializeFamilyDocument(document, source.source.overrides)} theme={theme} previewData={{ facts: { experience: 'A countryside escape for two', code: 'EXP-2026-0482', validUntil: '25 October 2027' } }} />
  return <TemplateWorkspace layout={layout} initialDocument={document} familyAuthoring={family} theme={theme} previewData={{ facts: { experience: 'A countryside escape for two', code: 'EXP-2026-0482', validUntil: '25 October 2027' } }} />
}
