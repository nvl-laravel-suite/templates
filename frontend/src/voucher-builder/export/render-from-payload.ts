import type { Project } from '#/voucher-builder/schema'
import { exportToHTML, type ExportToHTMLOptions } from './html'
import { parseVoucherImport } from './import'
import {
  getProjectDynamicKeys,
  type DynamicKeyManifest,
  type PayloadValidationResult,
} from './dynamic-keys'

export interface RenderPayload extends ExportToHTMLOptions {
  /**
   * The voucher to render. Accepts:
   *  - A raw `Project` snapshot (the in-memory shape).
   *  - A `gct-voucher` export envelope (v2 wraps a Project; v1 denormalized).
   *  - The JSON-stringified form of either of the above.
   */
  project: Project | Record<string, unknown> | string
  /**
   * When true, validate `data` against the project's dynamic-key manifest
   * and refuse to render if required keys are missing. The result's `errors`
   * will list the missing keys; `validation` carries the full report.
   *
   * Defaults to `false` so legacy callers see no behavior change.
   */
  validate?: boolean
  /**
   * When true, run the parsed Project through `ProjectSchema.safeParse` and
   * reject on any zod failure. Catches malformed envelopes that pass the
   * shape sniffer but violate enum / required-field constraints.
   */
  strict?: boolean
}

export interface RenderResult {
  html: string
  errors: string[]
  warnings: string[]
  /** The project's dynamic-key manifest (always populated on success). */
  manifest?: DynamicKeyManifest
  /** Validation report, populated when `validate: true` was passed. */
  validation?: PayloadValidationResult
}

/**
 * Headless render entry point for external services.
 *
 * Accepts a project (any supported wire format) plus optional data /
 * frame / title overrides, and returns the HTML string ready to serve,
 * print, or convert to PDF. No DOM or React required at call time —
 * pure string in, string out.
 *
 * @example
 *   const { html } = renderFromPayload({
 *     project: jsonFromFile,
 *     data: { customer_name: 'Jane', code: 'ABC123' },
 *   })
 */
export function renderFromPayload(payload: RenderPayload): RenderResult {
  const { project: rawProject, validate, strict, ...exportOptions } = payload
  const errors: string[] = []
  const warnings: string[] = []

  const raw = typeof rawProject === 'string' ? safeJsonParse(rawProject, errors) : rawProject
  if (raw == null) return { html: '', errors, warnings }

  const parsed = parseVoucherImport(raw, { strict })
  errors.push(...parsed.errors)
  warnings.push(...parsed.warnings)
  if (!parsed.project) return { html: '', errors, warnings }

  // Single tree walk: build the manifest once and derive validation from it.
  const manifest = getProjectDynamicKeys(parsed.project)
  let validation: PayloadValidationResult | undefined

  if (validate) {
    const supplied = new Set(
      Object.entries(exportOptions.data ?? {})
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k]) => k),
    )
    const missing = manifest.required.filter((k) => !supplied.has(k))
    const unused = [...supplied].filter((k) => !manifest.keys.includes(k))
    validation = { ok: missing.length === 0, missing, unused, expected: manifest.keys }
    if (!validation.ok) {
      errors.push(`Missing required dynamic keys: ${validation.missing.join(', ')}`)
      return { html: '', errors, warnings, manifest, validation }
    }
    if (validation.unused.length > 0) {
      warnings.push(`Payload includes unused keys: ${validation.unused.join(', ')}`)
    }
  }

  let html: string
  try {
    html = exportToHTML(parsed.project, exportOptions)
  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'Unknown render error.')
    return { html: '', errors, warnings, manifest, validation }
  }

  return { html, errors, warnings, manifest, validation }
}

function safeJsonParse(text: string, errors: string[]): unknown {
  try {
    return JSON.parse(text)
  } catch (err) {
    errors.push(`Invalid JSON: ${err instanceof Error ? err.message : 'parse error'}`)
    return null
  }
}
