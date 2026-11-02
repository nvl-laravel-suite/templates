import { z } from 'zod'
import type { VoucherBuilderConfig } from './types'
import type { VoucherTemplate } from './templates/types'
import { VoucherBuilderError } from './api-types'

const template = z.custom<VoucherTemplate>((input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false
  const value = input as Record<string, unknown>
  return typeof value.id === 'string' && typeof value.name === 'string' && (value.mode === 'full' || value.mode === 'partial')
}, 'Templates require an id, name, and full or partial mode')

/** Configuration contains preloaded data only; transport and storage belong to the host. */
export const VoucherBuilderConfigSchema = z.strictObject({
  templates: z.array(template).optional(),
}) satisfies z.ZodType<VoucherBuilderConfig>

export function parseBuilderConfig(input: unknown): VoucherBuilderConfig {
  const result = VoucherBuilderConfigSchema.safeParse(input)
  if (result.success) return result.data
  throw new VoucherBuilderError('configuration', result.error.issues.map((issue) => `${issue.path.join('.') || 'config'}: ${issue.message}`).join('; '), result.error)
}
