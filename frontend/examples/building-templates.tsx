import {
  TemplateWorkspace, createTemplateColumns, getTemplateColumns, getTemplatePresets,
  type TemplateCreatorInstance, type TemplateInsertPreset, type TemplateWorkspaceProps,
} from '@nicolasvlachos/voucher-builder/template-creator'

/** The host supplies its adapted catalog data. Uploads, saves and fetches stay in the host. */
export function CatalogTemplateWorkspace({ extraPresets, ...props }: TemplateWorkspaceProps & { extraPresets: TemplateInsertPreset[] }) {
  return <TemplateWorkspace {...props} insertPresets={[...getTemplatePresets(), ...extraPresets]} />
}

/** The same graph commands support application-specific generation without another editor. */
export function appendVoucherColumns(creator: TemplateCreatorInstance) {
  const [layoutId] = creator.actions.insertFragment(createTemplateColumns([1, 2]))
  const { columnIds } = getTemplateColumns(creator.getTemplate(), layoutId)!
  const paragraph = getTemplatePresets().find(preset => preset.id === 'paragraph')!
  creator.actions.insertFragment(paragraph.fragment, columnIds[1])
  creator.actions.setColumnLayout(layoutId, { widths: [30, 70], gap: 24 })
  return layoutId
}
