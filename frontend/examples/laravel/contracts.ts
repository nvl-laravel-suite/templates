import type { BindingDocument, StandaloneTemplateDraft, TemplateSourceDocument } from '@nicolasvlachos/voucher-builder/template-renderer'

export type { TemplateSourceDocument }
export type TemplateValues = Record<string, unknown>
export interface RequestOptions { signal?: AbortSignal }
export interface TemplateCapabilities {
  schemaVersion: number
  compilerVersions: string[]
  sourceModes: string[]
  targets: ('document' | 'email')[]
  engines: { bindings: boolean; shared: boolean }
  pdf: boolean
  preview?: { browserHtml: boolean; includeInlineAssets: boolean; maxBytes: number }
  assetTypes: string[]
  assetTypesByTarget?: Partial<Record<'document' | 'email', string[]>>
  variantOverrides: string[]
}
export interface TemplateIssue { path: string; message: string; code?: string }
export interface EditorBootstrap {
  template: { id: string; key: string; name: string; groupId: string | null; status: string; hasProposedBasis?: boolean; proposedGroupId?: string | null }
  version: number
  sourceChecksum?: string
  proposedGroupId?: string | null
  hasProposedBasis?: boolean
  familyChanges?: FamilyChangeCandidate[]
  source: TemplateSourceDocument | null
  document: StandaloneTemplateDraft | null
  family: { id: string; revisionId: string; revision: number; source?: BindingDocument; document: BindingDocument } | null
  currentRevisionId: string | null
  capabilities: TemplateCapabilities
  previewAssets: Record<string, string>
  issues: TemplateIssue[]
}
export interface StoredTemplateDraft { version: number; document: TemplateSourceDocument }
export interface PublishedRelease { id: string; revision: number; [key: string]: unknown }
export interface TemplatePreviewData { facts?: TemplateValues; context?: TemplateValues; inputs?: TemplateValues; settings?: TemplateValues }
export interface TemplateRenderInput { owner?: TemplateValues; inputs?: TemplateValues; settings?: TemplateValues }
export interface TemplateOutput { html: string; previewHtml?: string; css: string; subject?: string; text?: string; issues?: TemplateIssue[]; [key: string]: unknown }
export interface PreparedPublishedTemplate { revisionId: string; document: BindingDocument; data: TemplateValues; previewAssets: Record<string, string> }
export interface ResourceRevision {
  id: string
  key: string
  name: string
  kind: string
  scope: 'tenant' | 'group' | 'template'
  groupId: string | null
  templateId: string | null
  revision: number
  revisionId: string | null
  checksum: string | null
  document: unknown
}
export interface GroupRevision { id: string; revision: number; source?: StandaloneTemplateDraft; document: BindingDocument; previewAssets?: Record<string, string>; [key: string]: unknown }
export type FamilyChangeOperation = 'upgrade' | 'rebase' | 'detach' | 'regroup'
export type FamilyConflictChoice = 'local' | 'family'
export interface FamilyConflictSnapshot { present: boolean; type: 'missing' | 'null' | 'string' | 'number' | 'boolean' | 'array' | 'object'; preview: string; truncated: boolean; checksum?: string }
export interface FamilyChangeConflict {
  id: string; path: string; message: string; localAllowed: boolean; choices: FamilyConflictChoice[]
  comparison?: { kind: 'value' | 'structure' | 'capabilities'; previous: FamilyConflictSnapshot; local: FamilyConflictSnapshot; target: FamilyConflictSnapshot; values?: { previous: FamilyConflictSnapshot; local: FamilyConflictSnapshot; target: FamilyConflictSnapshot } }
}
export interface FamilyChangeCandidate {
  id: string
  templateId: string
  operation: FamilyChangeOperation
  expectedVersion: number
  sourceChecksum: string
  status: 'pending' | 'applied' | string
  source: TemplateSourceDocument
  document: StandaloneTemplateDraft
  previewAssets?: Record<string, string>
  conflicts: FamilyChangeConflict[]
  changes: { fromGroupId: string | null; fromRevision: number | null; toGroupId: string | null; toRevision: number | null }
  targetGroupId: string | null
  targetRevision: number | null
  appliedVersion?: number | null
}
export interface PrepareFamilyChange { operation: FamilyChangeOperation; target?: { groupId: string; revision: number }; expectedVersion: number; sourceChecksum: string }
export interface ApplyFamilyChange { resolutions: Record<string, FamilyConflictChoice>; expectedVersion: number; sourceChecksum: string }
export interface AppliedFamilyChange { version: number; sourceChecksum: string; source: TemplateSourceDocument; candidate: FamilyChangeCandidate }
export interface TemplateGroupSummary { id: string; key: string; name: string; version: number; status: string; current_revision_id?: string | null }
export interface ManagedTemplateAsset { id: string; name: string; mimeType: string; size: number; checksum: string; previewUrl: string }
export interface AssetPage { data: ManagedTemplateAsset[]; currentPage?: number; lastPage?: number; nextPageUrl?: string | null }
export type AssetImport = { name: string; url: string } | { name: string; source: string; key: string }

/** Application-owned transport. Visual components receive its JSON results through props. */
export interface TemplateRepository {
  load(id: string, options?: RequestOptions): Promise<EditorBootstrap>
  saveDraft(id: string, document: TemplateSourceDocument, expectedVersion: number, options?: RequestOptions): Promise<StoredTemplateDraft>
  publish(id: string, expectedVersion: number, options?: RequestOptions): Promise<PublishedRelease>
  preview(id: string, document: TemplateSourceDocument, data?: TemplatePreviewData, options?: RequestOptions): Promise<TemplateOutput>
  render(revisionId: string, input: TemplateRenderInput, options?: RequestOptions): Promise<TemplateOutput>
  preparePublished(revisionId: string, input: TemplateRenderInput, options?: RequestOptions): Promise<PreparedPublishedTemplate>
  capabilities(options?: RequestOptions): Promise<TemplateCapabilities>
  listResources(id: string, query?: { kind?: string }, options?: RequestOptions): Promise<ResourceRevision[]>
  loadResource(id: string, resourceId: string, revision: number, options?: RequestOptions): Promise<ResourceRevision>
  loadGroupRevision(groupId: string, revision: number, options?: RequestOptions): Promise<GroupRevision>
  listGroups(options?: RequestOptions): Promise<TemplateGroupSummary[]>
  publishGroup(groupId: string, document: BindingDocument, expectedRevision: number, options?: RequestOptions): Promise<GroupRevision>
  listFamilyChanges(id: string, options?: RequestOptions): Promise<FamilyChangeCandidate[]>
  loadFamilyChange(id: string, candidateId: string, options?: RequestOptions): Promise<FamilyChangeCandidate>
  reviewFamilyChange(id: string, candidateId: string, input: ApplyFamilyChange, options?: RequestOptions): Promise<FamilyChangeCandidate>
  prepareFamilyChange(id: string, input: PrepareFamilyChange, options?: RequestOptions): Promise<FamilyChangeCandidate>
  applyFamilyChange(id: string, candidateId: string, input: ApplyFamilyChange, options?: RequestOptions): Promise<AppliedFamilyChange>
  listAssets(query?: { target?: 'document' | 'email'; page?: number }, options?: RequestOptions): Promise<AssetPage>
  uploadAsset(file: File, options?: RequestOptions): Promise<ManagedTemplateAsset>
  importAsset(input: AssetImport, options?: RequestOptions): Promise<ManagedTemplateAsset>
}
