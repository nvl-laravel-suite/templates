import { stableJSONStringify } from '../template-core/contracts'
import { materializeFamilyDocument } from './catalog'
import { recompileTemplateDocument } from './recompile'
import type { BindingDocument, GroupVariantDocument } from './types'

/** Derived output travels with a source stamp; the group pin and deltas remain authoritative. */
export function compileFamilyVariant(family: BindingDocument, source: GroupVariantDocument, identity?: Pick<BindingDocument['source']['definition'], 'id' | 'name'>): GroupVariantDocument {
  if (family.target !== source.target) throw new Error('A variant must keep its pinned family target.')
  const { compiled: _, ...raw } = structuredClone(source)
  const effective = materializeFamilyDocument(family, raw.source.overrides)
  if (identity) Object.assign(effective.source.definition, identity)
  const compiled = recompileTemplateDocument(effective, effective.source.definition)
  return { ...raw, compiled: { sourceKey: stableJSONStringify(raw), artifacts: compiled.artifacts } }
}
