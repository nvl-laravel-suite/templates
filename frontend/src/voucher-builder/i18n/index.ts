import { useMemo } from 'react'
import { useGlobalSettingsState } from '#/voucher-builder/store/hooks'
import { getDirection, t } from './core'

export { getDirection, localizedDefault, localizeGeneratedContent, normalizeLocale, t } from './core'

export function useTranslation() {
  const language = useGlobalSettingsState().metadata.language || 'en'

  return useMemo(() => ({
    language,
    dir: getDirection(language),
    t: (key: string, params?: Record<string, string | number>) => t(key, params, language),
  }), [language])
}
