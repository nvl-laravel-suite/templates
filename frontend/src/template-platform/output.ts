import { finalizeEmailHTML } from '../template-email/output'
export function finalizeTemplateOutput(html: string, target: 'email' | 'document', preview = false): string {
  return target === 'email' ? finalizeEmailHTML(html, preview) : html
}
