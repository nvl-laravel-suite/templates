import { Stack as UIStack } from 'themelia-react-ui/base/structure'
import { useVoucherActions } from '../../../hooks/use-voucher-builder'
import { useBlockActions, useHistoryActions } from '../../../store/hooks'
import type { Block } from '../../../schema'
import { FieldShell, SettingBlock, SettingInput } from '..'
import { SliderInput } from '../primitives/variants/numeric'
import { Hint, Micro } from '../../../ui/typography'
import type { BlockOverrideProps } from './types'

export function RowOverride({ block }: BlockOverrideProps) {
  const actions = useVoucherActions()
  const { updateBlock } = useBlockActions()
  const { pushHistory } = useHistoryActions()
  const setCount = (count: number) => actions.resizeRow(block.id, count)

  return (
    <SettingBlock label="Grid">
      <SettingInput
        type="pills"
        label="Columns"
        value={String(block.content.columnCount)}
        onChange={(value) => setCount(Number(value))}
        options={[1, 2, 3, 4].map((value) => ({ value: String(value), label: String(value) }))}
      />
      <FieldShell label="Widths" associateControl={false}>
        <UIStack gap="md">
          {block.content.columnWidths.map((width: number, index: number) => (
            <UIStack direction="horizontal" gap="md" align="center" wrap={false} key={index} className="">
              <Micro className="w-9 shrink-0">#{index + 1}</Micro>
              <div className="flex-1">
                <SliderInput
                  label={`Column ${index + 1} width`}
                  value={width}
                  onChangeStart={pushHistory}
                  onChange={(nextWidth) => {
                    const nextWidths = [...block.content.columnWidths]
                    nextWidths[index] = nextWidth
                    updateBlock(block.id, {
                      content: { ...block.content, columnWidths: nextWidths },
                    } as Partial<Block>)
                  }}
                  min={10}
                  max={100}
                  step={5}
                />
              </div>
              <Hint className="w-5 text-right shrink-0 tabular-nums">{width}</Hint>
            </UIStack>
          ))}
        </UIStack>
      </FieldShell>
    </SettingBlock>
  )
}
