import type { Project } from '#/voucher-builder/schema'
import { getBlockSettings } from '#/voucher-builder/blocks/settings-accessor'

/**
 * The mechanism inside the project that introduced this key — i.e. how
 * the renderer substitutes the value when rendering.
 *
 *  - `dynamic`      — `block.commonSettings.dynamicKey` (any block type)
 *  - `placeholder`  — `dataPlaceholder.content.valueKey`
 *  - `qr-overwrite` — `qrCode.settings.overwriteKey` (when allowOverwrite: true)
 */
export type DynamicKeyMechanism = 'dynamic' | 'placeholder' | 'qr-overwrite'

/**
 * The BE-facing bucket — which resolver should populate this key at render
 * time. The shell does not interpret these values; they are metadata for
 * the host. Defaults to `data` when an author hasn't tagged the block.
 *
 *  - `data`    — per-recipient values (DTO / order record)
 *  - `content` — translatable strings (template_contents repository)
 *  - `asset`   — image/file references (template_assets repository)
 */
export type DynamicKeyKind = 'data' | 'content' | 'asset'

/** @deprecated Use `DynamicKeyMechanism`. */
export type DynamicKeySource = DynamicKeyMechanism

export interface DynamicKeyOccurrence {
  /** Block id where the key is referenced. */
  blockId: string
  /** Block type (heading, dataPlaceholder, qrCode, etc.). */
  blockType: string
  /** The key the block expects in the substitution payload. */
  key: string
  /** Which mechanism in the project introduced the key. */
  mechanism: DynamicKeyMechanism
  /** BE-facing bucket the host should use to resolve the key. */
  kind: DynamicKeyKind
  /** A built-in default the project provides, if any. */
  defaultValue?: string
  /** True when the project provides a default and the key is therefore optional. */
  hasDefault: boolean
  /** For dataPlaceholder occurrences only: text or image. */
  placeholderType?: 'text' | 'image'
  /** @deprecated Use `mechanism`. */
  source: DynamicKeyMechanism
}

export interface DynamicKeyBucket {
  /** Unique keys in this bucket. */
  keys: string[]
  /** Keys with no default — the host MUST supply these. */
  required: string[]
  /** Keys with a default — the host MAY override these. */
  optional: string[]
  /** Per-occurrence detail. */
  occurrences: DynamicKeyOccurrence[]
}

export interface DynamicKeyManifest {
  /** All unique keys across every bucket. */
  keys: string[]
  /** Required keys across every bucket (flattened). */
  required: string[]
  /** Optional keys across every bucket (flattened). */
  optional: string[]
  /** Every occurrence, regardless of bucket — useful for in-editor walks. */
  occurrences: DynamicKeyOccurrence[]
  /** Per-recipient data keys (DTO / order record). */
  data: DynamicKeyBucket
  /** Translatable string keys (template_contents repository). */
  content: DynamicKeyBucket
  /** Asset keys (template_assets repository). */
  asset: DynamicKeyBucket
}

/**
 * Walk a Project and produce a manifest of every dynamic key it references,
 * split by BE bucket so a host service knows which resolver to hit for each.
 *
 * Backed by:
 *  - `commonSettings.dynamicKey` on any block (with optional `previewValue`).
 *    The block's `commonSettings.dynamicKeySource` (default `'data'`) drives
 *    which bucket the occurrence lands in.
 *  - `content.valueKey` on `dataPlaceholder` blocks (always bucketed `data`
 *    unless the block also has a `dynamicKeySource` override).
 *  - `settings.overwriteKey` on `qrCode` blocks when `allowOverwrite: true`
 *    (always bucketed `data` — QR payloads are typically per-recipient).
 *
 * The manifest is a contract the host can use to validate payloads, build
 * forms, or document an integration without re-implementing block types.
 */
export function getProjectDynamicKeys(project: Project): DynamicKeyManifest {
  const previewData = project.global?.previewData ?? {}
  const occurrences: DynamicKeyOccurrence[] = []

  for (const block of Object.values(project.blocks)) {
    const cs = block.commonSettings
    const content = block.content as Record<string, unknown>
    const settings = getBlockSettings(block)
    const tagged: DynamicKeyKind = (cs?.dynamicKeySource as DynamicKeyKind | undefined) ?? 'data'

    if (cs?.dynamicKey) {
      const projectDefault = previewData[cs.dynamicKey]
      const blockDefault = cs.previewValue
      const defaultValue = (projectDefault !== undefined && projectDefault !== '')
        ? projectDefault
        : (blockDefault !== undefined && blockDefault !== '' ? blockDefault : undefined)
      occurrences.push({
        blockId: block.id,
        blockType: block.type,
        key: cs.dynamicKey,
        mechanism: 'dynamic',
        source: 'dynamic',
        kind: tagged,
        defaultValue,
        hasDefault: defaultValue !== undefined,
      })
    }

    if (block.type === 'dataPlaceholder') {
      const key = (content.valueKey as string) || ''
      if (key) {
        const projectDefault = previewData[key]
        const defaultValue = (projectDefault !== undefined && projectDefault !== '') ? projectDefault : undefined
        occurrences.push({
          blockId: block.id,
          blockType: 'dataPlaceholder',
          key,
          mechanism: 'placeholder',
          source: 'placeholder',
          kind: tagged,
          defaultValue,
          hasDefault: defaultValue !== undefined,
          placeholderType: ((content.placeholderType as string) === 'image' ? 'image' : 'text'),
        })
      }
    }

    if (block.type === 'qrCode' && settings.allowOverwrite && settings.overwriteKey) {
      const key = settings.overwriteKey as string
      const projectDefault = previewData[key]
      const fallback = content.value as string | undefined
      const defaultValue = (projectDefault !== undefined && projectDefault !== '')
        ? projectDefault
        : (fallback && fallback !== '' ? fallback : undefined)
      occurrences.push({
        blockId: block.id,
        blockType: 'qrCode',
        key,
        mechanism: 'qr-overwrite',
        source: 'qr-overwrite',
        kind: tagged,
        defaultValue,
        hasDefault: defaultValue !== undefined,
      })
    }
  }

  const buildBucket = (kind: DynamicKeyKind): DynamicKeyBucket => {
    const occs = occurrences.filter((o) => o.kind === kind)
    const allKeys = Array.from(new Set(occs.map((o) => o.key))).sort()
    const required = Array.from(new Set(occs.filter((o) => !o.hasDefault).map((o) => o.key))).sort()
    const optional = allKeys.filter((k) => !required.includes(k))
    return { keys: allKeys, required, optional, occurrences: occs }
  }

  const data = buildBucket('data')
  const content = buildBucket('content')
  const asset = buildBucket('asset')

  const allKeys = Array.from(new Set(occurrences.map((o) => o.key))).sort()
  const required = Array.from(
    new Set(occurrences.filter((o) => !o.hasDefault).map((o) => o.key)),
  ).sort()
  const optional = allKeys.filter((k) => !required.includes(k))

  return {
    keys: allKeys,
    required,
    optional,
    occurrences,
    data,
    content,
    asset,
  }
}

export interface PayloadValidationResult {
  ok: boolean
  /** Required keys missing from the supplied data. */
  missing: string[]
  /** Keys present in data but not referenced by any block (informational, not an error). */
  unused: string[]
  /** Unique key set the project expects (manifest.keys). */
  expected: string[]
}

/**
 * Validate a render payload's `data` object against a project's dynamic-key
 * manifest. Returns `ok: false` when any required key is missing.
 *
 * Validates against the **flattened** required-set across all buckets, since
 * `renderFromPayload` accepts a single merged map at render time. The host
 * BE is responsible for assembling that map from its three resolvers.
 */
export function validateRenderPayload(
  project: Project,
  data: Record<string, unknown> | null | undefined,
): PayloadValidationResult {
  const manifest = getProjectDynamicKeys(project)
  const supplied = new Set(
    Object.entries(data ?? {})
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k]) => k),
  )
  const missing = manifest.required.filter((k) => !supplied.has(k))
  const unused = [...supplied].filter((k) => !manifest.keys.includes(k))
  return { ok: missing.length === 0, missing, unused, expected: manifest.keys }
}
