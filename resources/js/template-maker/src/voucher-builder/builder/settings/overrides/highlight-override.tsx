import type { Block } from '../../../schema'
import { TextInput } from '../primitives/variants/text'
import { ItemListEditor } from '../item-list-editor'
import type { BlockOverrideProps } from './types'

export function HighlightOverride({ block, update }: BlockOverrideProps) {
  const items: Array<{ key: string; value: string }> = block.content.items || []

  return (
    <ItemListEditor
      items={items}
      onUpdate={(next) => update({ content: { ...block.content, items: next } } as Partial<Block>)}
      createItem={() => ({ key: 'Label', value: 'Value' })}
      labelFn={(item) => item.key || 'Item'}
      title="Highlights"
      addLabel="Add Item"
      renderItem={(item, _index, setField) => (
        <>
          <TextInput value={item.key} onChange={(e) => setField('key', e.target.value)} placeholder="Label" />
          <TextInput value={item.value} onChange={(e) => setField('value', e.target.value)} placeholder="Value" />
        </>
      )}
    />
  )
}
