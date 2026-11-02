export { TemplateCreator } from './template-creator/TemplateCreator'
export type { TemplateCreatorProps, TemplateCreatorExtensions, TemplateCreatorPanel } from './template-creator/TemplateCreator'
export { TemplateEditor } from './template-creator/TemplateEditor'
export type { TemplateEditorProps } from './template-creator/TemplateEditor'
export { TemplateCanvas } from './template-creator/canvas'
export * from './template-creator/hooks'
export { createTemplateCreator, createTemplateEditor } from './template-core/editing'
export type {
  TemplateCreatorInstance,
  TemplateCreatorOptions,
  TemplateCreatorOperation,
  TemplateEditorInstance,
  TemplateEditorOptions,
  TemplateEditorPreload,
  TemplateDocumentExport,
} from './template-core/editing'
export * from './template-renderer'

export { TemplateSettingsPanel } from './template-platform/settings-panel'
export type { TemplateSettingsPanelProps } from './template-platform/settings-panel'

export { TemplateWorkspace } from './template-platform/workspace'
export type { TemplateWorkspaceProps, TemplateWorkspaceDraft } from './template-platform/workspace'

export { GroupVariantWorkspace } from './template-platform/variant-workspace'
export type { GroupVariantWorkspaceProps } from './template-platform/variant-workspace'

export { FamilyVariationControls, FamilyVariationLibrary } from './template-platform/family-authoring'
export type { FamilyAuthoringProps } from './template-platform/family-authoring'
