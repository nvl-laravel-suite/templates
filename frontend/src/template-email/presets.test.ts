import { expect, it } from 'vitest'
import { getEmailPresets, createEmailTemplate } from './presets'
import { getEmailTemplateIssues } from './profile'
import { createTemplateCreator } from '../template-core/editing'
import { getTemplateColumns } from '../template-core/columns'
import { exportBindingDocument } from '../template-platform/bindings'
import { exportSharedTemplateDocument } from '../template-platform/document'
it('offers a separate email catalog and an exportable starter', () => {
  const presets = getEmailPresets()
  for (const id of ['email-section', 'email-header', 'email-footer', 'email-button', 'email-spacer', 'email-columns-2']) expect(presets.some(preset => preset.id === id)).toBe(true)
  const creator = createTemplateCreator({ initialTemplate: createEmailTemplate() })
  expect(() => exportBindingDocument(creator.getTemplate(), { target: 'email' })).not.toThrow()
  for (const preset of presets.filter(preset => preset.category !== 'Structure' && preset.id !== 'email-image')) creator.actions.insertFragment(preset.fragment, null)
  const template = creator.getTemplate(); creator.destroy()
  expect(getEmailTemplateIssues(template).filter(issue => issue.severity === 'error')).toEqual([])
  expect(() => exportSharedTemplateDocument(template, { target: 'email' })).not.toThrow()
})
it('edits email widths, cell-based spacing and mobile policy without dropping content', () => {
  const creator = createTemplateCreator({ initialTemplate: createEmailTemplate() })
  const id = creator.actions.insertFragment(getEmailPresets().find(preset => preset.id === 'email-columns-2')!.fragment, null)[0]
  creator.actions.setColumnLayout(id, { widths: [30, 70], gap: 20, stackOnMobile: false })
  let template = creator.getTemplate(), columns = getTemplateColumns(template, id)!
  expect(columns).toMatchObject({ widths: [30, 70], gap: 20, stackOnMobile: false })
  for (const column of columns.columnIds) expect(template.nodes[column]).toMatchObject({ style: { padding: '0 10px' } })
  const content = columns.columnIds.flatMap(key => template.nodes[key].kind === 'element' ? template.nodes[key].children : [])
  creator.actions.setColumnLayout(id, { count: 1 }); template = creator.getTemplate(); columns = getTemplateColumns(template, id)!
  expect(template.nodes[columns.columnIds[0]]).toMatchObject({ children: content })
  creator.actions.undo(); expect(getTemplateColumns(creator.getTemplate(), id)?.widths).toEqual([30, 70]); creator.destroy()
})
it('scopes mobile stacking to each table so nested fixed columns keep their policy', () => {
  const creator = createTemplateCreator({ initialTemplate: createEmailTemplate() })
  const preset = getEmailPresets().find(preset => preset.id === 'email-columns-2')!
  const outer = creator.actions.insertFragment(preset.fragment)[0]
  const cell = getTemplateColumns(creator.getTemplate(), outer)!.columnIds[0]
  const inner = creator.actions.insertFragment(preset.fragment, cell)[0]
  creator.actions.setColumnLayout(inner, { stackOnMobile: false })
  const document = exportBindingDocument(creator.getTemplate(), { target: 'email' }); creator.destroy()
  expect(document.artifacts.html).toContain('.email-stack>tbody>tr>.email-column')
  expect(document.artifacts.html).toContain('@media screen and (max-width:480px){.email-stack')
  expect(getTemplateColumns(document.source.definition, inner)?.stackOnMobile).toBe(false)
})
