// ── Scope registry public surface ─────────────────────────────
export {
  defineScope,
  getScope,
  listScopes,
  DEFAULT_SCOPE_IDS,
  type ScopeDefinition,
  type ScopeField,
  type ScopeSource,
  type ScopeOverride,
  type ScopeContext,
  type SourceRow,
} from './registry'

// ── Built-in scope registrations (side-effect imports) ────────
import './spacing'
import './surface'
import './border-shape'
import './effects'
import './layout'
import './visibility'
import './animation'
import './print'
import './dynamic'

export { spacingScope } from './spacing'
export { surfaceScope } from './surface'
export { borderShapeScope } from './border-shape'
export { effectsScope } from './effects'
export { layoutScope } from './layout'
export { visibilityScope } from './visibility'
export { animationScope } from './animation'
export { printScope } from './print'
export { dynamicScope } from './dynamic'
