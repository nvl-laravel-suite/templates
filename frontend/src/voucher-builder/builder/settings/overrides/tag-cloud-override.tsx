import type { Block } from '#/voucher-builder/schema'
import { TextInput } from '#/voucher-builder/builder/settings/primitives/variants/text'
import { ItemListEditor } from '#/voucher-builder/builder/settings/item-list-editor'
import type { BlockOverrideProps } from './types'

export function TagCloudOverride({ block, update }: BlockOverrideProps) {
  const tags: Array<{ text: string; color?: string }> = block.content.tags || []

  return (
    <ItemListEditor
      items={tags}
      onUpdate={(next) => update({ content: { ...block.content, tags: next } } as Partial<Block>)}
      createItem={() => ({ text: 'Tag' })}
      labelFn={(item) => item.text || 'Tag'}
      title="Tags"
      addLabel="Add Tag"
      renderItem={(item, _index, setField) => (
        <TextInput value={item.text} onChange={(e) => setField('text', e.target.value)} placeholder="Tag text" />
      )}
    />
  )
}
