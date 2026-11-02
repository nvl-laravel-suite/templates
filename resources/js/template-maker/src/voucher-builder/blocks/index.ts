export type {
  BlockCategory,
  FieldSchema,
  SettingsGroupDef,
  BlockDefinition,
  BlockInstance,
  CommonBlockSettings,
  FieldValue,
  FieldDefaults,
  ChildTemplate,
  BlockCapabilities,
  BlockChildKind,
} from './types'

export { DEFAULT_COMMON_SETTINGS } from './types'

export {
  defineBlock,
  getBlockDef,
  getBlockCapabilities,
  getAllBlockDefs,
  getBlockDefsByCategory,
  getRegisteredTypes,
  canPlaceIn,
  canContainBlock,
  createBlock,
  getComposableTemplates,
  isComposableType,
  hasBlockListChildren,
  hasManagedChildren,
  isStructuralType,
  getBlockChildKind,
  getStructuralChildField,
  getStructuralChildIds,
  isContainerBlockType,
  labelOf,
  BLOCK_CATEGORIES,
} from './registry'
