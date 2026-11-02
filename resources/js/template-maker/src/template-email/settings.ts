import type { JsonObject } from '../template-core/schema'
import type { PresentationSetting } from '../template-platform/types'
import { formatPresentationStyle } from '../template-platform/style-values'
import { EMAIL_PROFILE, emailStyleProblem, type EmailCompatibilityIssue } from './profile'
export function getEmailSettingIssues(settings: PresentationSetting[], values: JsonObject = {}): EmailCompatibilityIssue[] {
  return settings.flatMap(setting => setting.targets.flatMap(target => {
    let message: string | undefined
    try {
      if (!EMAIL_PROFILE.settings.includes(target.property) || !['', 'px', '%'].includes(setting.unit ?? '')) message = `Unsupported presentation setting ${setting.label}.`
      const value = values[setting.id] ?? setting.defaultValue
      if (typeof value !== 'string' && typeof value !== 'number') message = `Setting ${setting.label} requires a scalar email style.`
      else message ??= emailStyleProblem(target.property, formatPresentationStyle(target.property, value, setting.unit))
    } catch { message = `Setting ${setting.label} has an unsupported email value.` }
    return message ? [{ path: `settings.${setting.id}`, code: 'email-setting', message: `Email: ${message}`, severity: 'error' as const }] : []
  }))
}
