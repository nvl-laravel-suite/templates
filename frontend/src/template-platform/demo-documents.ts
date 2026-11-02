import { TemplateDefinitionSchema, TemplateNodeSchema, type TemplateValue } from '../template-core/schema'
import { createTemplateDefinition } from '../template-core/defaults'
import { createTemplateCreator } from '../template-core/editing'
import { exportBindingDocument } from './bindings'
import type { BindingDocument } from './types'

/** Content fixtures for the real editor. All canvas, fields, block and history UI is reused. */
export function createExperienceDocument(): BindingDocument {
  const source = createTemplateDefinition('Experience voucher · Classic')
  source.id = 'experience_classic'
  source.page = { widthMm: 210, heightMm: 180, margins: { top: 12, right: 12, bottom: 12, left: 12 } }
  const text = (id: string, value: TemplateValue) => { source.nodes[id] = TemplateNodeSchema.parse({ id, name: id.replaceAll('_', ' '), kind: 'text', parts: [{ value }] }); return id }
  const literal = (id: string, value: string) => text(id, { source: 'literal', value })
  const field = (id: string) => text(`copy_${id}`, { source: 'field', fieldId: id })
  const element = (id: string, tag: string, children: string[], classes: string[] = [], name = id.replaceAll('_', ' ')) => { source.nodes[id] = TemplateNodeSchema.parse({ id, name, kind: 'element', tag, children, classes }); return id }
  source.fields = [
    { id: 'brand', path: 'content.brand', label: 'Brand', schema: { type: 'string' }, required: true, editable: false, defaultValue: 'THE EXPERIENCE COLLECTION', description: '' },
    { id: 'title', path: 'content.title', label: 'Voucher heading', schema: { type: 'string' }, required: true, editable: false, defaultValue: 'Give a moment.\nMake a memory.', description: '' },
    { id: 'recipient', path: 'inputs.recipient', label: 'Recipient', schema: { type: 'string', maxLength: 100 }, required: true, editable: true, defaultValue: 'Alex', description: '' },
    { id: 'message', path: 'inputs.message', label: 'Gift message', schema: { type: 'string', maxLength: 500 }, required: true, editable: true, defaultValue: 'Here’s to trying something new, sharing a great story, and making a day of it. Enjoy every moment.', description: '' },
    { id: 'experience', path: 'facts.experience', label: 'Experience', schema: { type: 'string' }, required: true, editable: false, sample: 'A countryside escape for two', description: '' },
    { id: 'code', path: 'facts.code', label: 'Voucher code', schema: { type: 'string' }, required: true, editable: false, sample: 'EXP-2026-0482', description: '' },
    { id: 'validUntil', path: 'facts.validUntil', label: 'Valid until', schema: { type: 'string' }, required: true, editable: false, sample: '25 October 2027', description: '' },
  ]
  source.roots = [element('voucher', 'article', [
    element('hero', 'header', [element('brand', 'p', [field('brand')], ['eyebrow']), element('voucher_heading', 'h1', [field('title')]), element('edition', 'p', [literal('edition_copy', 'AN INVITATION TO SOMETHING WONDERFUL')], ['eyebrow'])], ['voucher-hero'], 'Voucher header'),
    element('gift_note', 'section', [element('recipient_line', 'h2', [literal('for_label', 'For '), field('recipient')]), element('personal_message', 'p', [field('message')], ['gift-message'], 'Gift message')], ['gift-note'], 'Personal message'),
    element('experience_details', 'section', [element('experience_label', 'p', [literal('experience_label_copy', 'YOUR EXPERIENCE')], ['eyebrow']), element('experience_title', 'h2', [field('experience')]), element('redemption', 'div', [element('code_card', 'div', [element('code_label', 'p', [literal('code_label_copy', 'VOUCHER CODE')], ['eyebrow']), element('code_value', 'p', [field('code')], ['voucher-code'])]), element('valid_card', 'div', [element('valid_label', 'p', [literal('valid_label_copy', 'VALID UNTIL')], ['eyebrow']), element('valid_value', 'p', [field('validUntil')])])], ['redemption-grid'])], ['experience-details'], 'Experience and redemption'),
    element('terms', 'footer', [element('terms_copy', 'p', [literal('terms_text', 'Choose your date, bring this voucher, and let the experience begin. Booking is subject to availability. Keep your voucher code safe.')])], ['voucher-terms'], 'Booking terms'),
  ], ['voucher-card'], 'Experience voucher')]
  source.styles.css = '.voucher-card{border:1px solid #d7dfda;border-radius:14px;overflow:hidden}.voucher-hero{padding:32px;background:#173e33;color:#faf8ef}.voucher-hero h1{font-size:38px;line-height:1.15;white-space:pre-line;margin:22px 0}.eyebrow{font-size:10px;letter-spacing:2px;font-weight:700}.gift-note{padding:28px 32px}.gift-message{font-size:16px;line-height:1.7}.experience-details{padding:24px 32px;background:#eff3ef}.experience-details h2{font-size:23px}.redemption-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:24px}.voucher-code{font-size:18px;font-weight:700;letter-spacing:1px}.voucher-terms{padding:20px 32px}.voucher-terms p{font-size:11px;line-height:1.6;color:#637067;margin:0}'
  const creator = createTemplateCreator({ initialTemplate: TemplateDefinitionSchema.parse(source) })
  creator.actions.saveBlock('terms', 'Booking terms')
  const definition = creator.getTemplate()
  creator.destroy()
  return exportBindingDocument(definition, { target: 'document', settings: [
    { id: 'message_size', label: 'Message size', control: 'slider', schema: { type: 'number', minimum: 12, maximum: 24 }, defaultValue: 16, exposed: true, unit: 'px', targets: [{ nodeId: 'personal_message', property: 'font-size' }] },
    { id: 'message_alignment', label: 'Message alignment', control: 'alignment', schema: { type: 'string', enum: ['left', 'center', 'right'] }, defaultValue: 'left', exposed: true, targets: [{ nodeId: 'personal_message', property: 'text-align' }] },
  ] })
}
