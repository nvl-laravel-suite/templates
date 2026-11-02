import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { EMAIL_PROFILE } from './profile'
it('ships the same email profile rules in the frontend and NVL package', () => {
  const rules = JSON.parse(readFileSync(new URL('../../../resources/contracts/email-profile.v1.json', import.meta.url), 'utf8'))
  expect(rules).toEqual(EMAIL_PROFILE)
})
