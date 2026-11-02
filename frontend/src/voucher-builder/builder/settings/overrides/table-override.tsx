import { Stack as UIStack } from 'themelia-react-ui/base/structure'
import { Button as UIAction } from 'themelia-react-ui/base/buttons'
import type { Block } from '#/voucher-builder/schema'
import { FieldShell, SettingBlock } from '#/voucher-builder/builder/settings'
import { TextInput } from '#/voucher-builder/builder/settings/primitives/variants/text'
import type { BlockOverrideProps } from './types'
import { useId } from 'react'

export function TableOverride({ block, update }: BlockOverrideProps) {
  const fieldId = useId()
  const setHeader = (index: number, value: string) => {
    const headers = [...block.content.headers]
    headers[index] = value
    update({ content: { ...block.content, headers } } as Partial<Block>)
  }

  const setCell = (rowIndex: number, columnIndex: number, value: string) => {
    const rows = block.content.rows.map((row: string[], currentRowIndex: number) =>
      currentRowIndex === rowIndex
        ? row.map((cell: string, currentColumnIndex: number) =>
            currentColumnIndex === columnIndex ? value : cell,
          )
        : [...row],
    )

    update({ content: { ...block.content, rows } } as Partial<Block>)
  }

  return (
    <SettingBlock label="Data" display="inline">
      <FieldShell label="Headers" associateControl={false}>
        {block.content.headers.map((header: string, index: number) => (
          <TextInput key={index} id={`${fieldId}-header-${index}`} aria-label={`Column ${index + 1} heading`}
            value={header} onChange={(event) => setHeader(index, event.target.value)} />
        ))}
      </FieldShell>
      <FieldShell label="Rows" associateControl={false}>
        {block.content.rows.map((row: string[], rowIndex: number) => (
          <UIStack direction="horizontal" gap="xs" wrap={false} key={rowIndex}>
            {row.map((cell: string, columnIndex: number) => (
              <TextInput
                key={columnIndex}
                id={`${fieldId}-row-${rowIndex}-column-${columnIndex}`}
                aria-label={`Row ${rowIndex + 1}, ${block.content.headers[columnIndex] || `Column ${columnIndex + 1}`}`}
                value={cell}
                onChange={(event) => setCell(rowIndex, columnIndex, event.target.value)}
              />
            ))}
          </UIStack>
        ))}
      </FieldShell>
      <UIStack direction="horizontal" gap="md" wrap={false} className="">
        <UIAction
          buttonStyle="ghost"
          onClick={() =>
            update({
              content: {
                ...block.content,
                rows: [...block.content.rows, Array(block.content.headers.length).fill('')],
              },
            } as Partial<Block>)
          }
          className="flex-1"
        >
          + Row
        </UIAction>
        <UIAction
          buttonStyle="ghost"
          onClick={() =>
            update({
              content: {
                ...block.content,
                headers: [...block.content.headers, `Col ${block.content.headers.length + 1}`],
                rows: block.content.rows.map((row: string[]) => [...row, '']),
              },
            } as Partial<Block>)
          }
          className="flex-1"
        >
          + Col
        </UIAction>
      </UIStack>
    </SettingBlock>
  )
}
