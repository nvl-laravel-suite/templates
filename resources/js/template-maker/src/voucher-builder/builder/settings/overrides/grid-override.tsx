import { Stack as UIStack } from 'themelia-react-ui/base/structure'
import { useVoucherActions } from '../../../hooks/use-voucher-builder'
import { useBlockActions, useHistoryActions } from '../../../store/hooks'
import type { Block } from '../../../schema'
import { FieldShell, SettingBlock, SettingInput } from '..'
import { SliderInput } from '../primitives/variants/numeric'
import { Hint, Micro } from '../../../ui/typography'
import type { BlockOverrideProps } from './types'

export function GridOverride({ block }: BlockOverrideProps) {
  const actions = useVoucherActions()
  const { updateBlock } = useBlockActions()
  const { pushHistory } = useHistoryActions()
  const resizeGrid = (columns: number, rows: number) => actions.resizeGrid(block.id, columns, rows)

  return (
    <SettingBlock label="Grid Structure">
      <SettingInput
        type="pills"
        label="Columns"
        value={String(block.content.columns)}
        onChange={(value) => resizeGrid(Number(value), block.content.rows)}
        options={[1, 2, 3, 4].map((value) => ({ value: String(value), label: String(value) }))}
      />
      <SettingInput
        type="pills"
        label="Rows"
        value={String(block.content.rows)}
        onChange={(value) => resizeGrid(block.content.columns, Number(value))}
        options={[1, 2, 3, 4].map((value) => ({ value: String(value), label: String(value) }))}
      />
      <FieldShell label="Row Heights" associateControl={false}>
        <UIStack gap="md">
          {(block.content.rowHeights || []).map((height: number, index: number) => (
            <UIStack direction="horizontal" gap="md" align="center" wrap={false} key={index} className="">
              <Micro className="w-12 shrink-0">Row {index + 1}</Micro>
              <div className="flex-1">
                <SliderInput
                  label={`Row ${index + 1} height`}
                  value={height}
                  onChangeStart={pushHistory}
                  onChange={(nextHeight) => {
                    const nextHeights = [...(block.content.rowHeights || [])]
                    nextHeights[index] = nextHeight
                    updateBlock(block.id, {
                      content: { ...block.content, rowHeights: nextHeights },
                    } as Partial<Block>)
                  }}
                  min={80}
                  max={360}
                  step={8}
                />
              </div>
              <Hint className="w-8 text-right shrink-0 tabular-nums">{height}</Hint>
            </UIStack>
          ))}
        </UIStack>
      </FieldShell>
    </SettingBlock>
  )
}
