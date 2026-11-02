/** Portable wire contracts and TypeScript types; no React or editor UI. */
export * from './template-core/schema'
export { getTemplateDataSchema, resolveTemplateData, validateJSONData } from './template-core/contracts'
export { parseTemplateBlockLibrary } from './template-core/blocks'
export {
  parseTemplateDraft,
  parseTemplateDefinition,
  parseTemplateRevision,
  parseTemplatePersonalization,
  parseTemplateRenderInput,
  getTemplateIssues,
} from './template-core/validation'
