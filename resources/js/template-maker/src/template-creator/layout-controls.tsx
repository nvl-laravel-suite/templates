import { SettingBlock } from '../voucher-builder/builder/settings/primitives/setting-block'
import { SettingInput } from '../voucher-builder/builder/settings/primitives/setting-input'
import { getTemplateColumns } from '../template-core/columns'
import { useTemplateActions, useTemplateDocument } from './hooks'
import { Grid } from 'themelia-react-ui/base/structure'

/** The voucher settings owners edit ordinary template-table nodes through canonical commands. */
export function ColumnLayoutControls({ nodeId, run }: { nodeId: string; run: (task: () => unknown) => void }) {
  const template = useTemplateDocument()
  const actions = useTemplateActions()
  const id = getTemplateColumns(template, nodeId) ? nodeId : Object.keys(template.nodes).find(id => getTemplateColumns(template, id)?.columnIds.includes(nodeId))
  const columns = id ? getTemplateColumns(template, id) : null
  if (!id || !columns) return null
  const setWidth = (index: number, value: number) => {
    const remaining = 100 - columns.widths[index]
    const widths = columns.widths.map((width, i) => i === index ? value : width / remaining * (100 - value))
    run(() => actions.setColumnLayout(id, { widths }))
  }
  return <SettingBlock label="Columns" display="inline" description="Widths total 100% and rebalance together.">
    <SettingInput type="pills" label="Column count" description="Fewer columns keep all content." value={String(columns.columnIds.length)} options={[1, 2, 3, 4].map(count => ({ value: String(count), label: String(count) }))} onChange={value => run(() => actions.setColumnLayout(id, { count: Number(value) }))} />
    <Grid columns={columns.widths.length === 1 ? 1 : 2} gap="lg">
    {columns.widths.map((width, index) => <SettingInput key={columns.columnIds[index]} type="stepper" label={`Column ${index + 1} width`} value={width} suffix="%" min={columns.widths.length === 1 ? 100 : 1} max={columns.widths.length === 1 ? 100 : 99} step={1} disabled={columns.widths.length === 1} onChange={value => setWidth(index, value)} />)}
    </Grid>
    <SettingInput type="stepper" label="Column spacing" value={columns.gap} suffix="px" min={0} max={64} step={1} onChange={gap => run(() => actions.setColumnLayout(id, { gap }))} />
    <SettingInput type="select" label="Column alignment" value={columns.align} options={[{ value: 'top', label: 'Top' }, { value: 'middle', label: 'Middle' }, { value: 'bottom', label: 'Bottom' }]} onChange={value => run(() => actions.setColumnLayout(id, { align: value as typeof columns.align }))} />
    {columns.stackOnMobile !== undefined && <SettingInput type="switch" label="Stack on mobile" description="Width-query capable clients stack these columns at 480px and below; other clients retain the table layout." value={columns.stackOnMobile} onChange={stackOnMobile => run(() => actions.setColumnLayout(id, { stackOnMobile }))} />}
  </SettingBlock>
}
