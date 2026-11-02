import type { Block } from '../../../schema'
import { TextInput } from '../primitives/variants/text'
import { PillsInput } from '../primitives/variants/choice'
import { ItemListEditor } from '../item-list-editor'
import type { BlockOverrideProps } from './types'
import { FieldShell } from '../primitives/field-shell'

export function ContactInfoOverride({ block, update }: BlockOverrideProps) {
  const items: Array<{ type: string; value: string; label?: string }> = block.content.items || []

  return (
    <ItemListEditor
      items={items}
      onUpdate={(next) => update({ content: { ...block.content, items: next } } as Partial<Block>)}
      createItem={() => ({ type: 'email', value: '', label: '' })}
      labelFn={(item) => `${item.type} ${item.value ? '· ' + item.value.slice(0, 20) : ''}`.trim()}
      title="Contact Items"
      addLabel="Add Item"
      renderItem={(item, _index, setField) => (
        <>
          <FieldShell label="Contact type"><PillsInput
            value={item.type}
            onChange={(value) => setField('type', value)}
            options={[
              { value: 'email', label: 'Email' }, { value: 'phone', label: 'Phone' },
              { value: 'location', label: 'Location' }, { value: 'website', label: 'Website' },
              { value: 'linkedin', label: 'LinkedIn' }, { value: 'github', label: 'GitHub' },
              { value: 'twitter', label: 'X / Twitter' }, { value: 'portfolio', label: 'Portfolio' },
              { value: 'mastodon', label: 'Mastodon' }, { value: 'medium', label: 'Medium' },
              { value: 'dribbble', label: 'Dribbble' }, { value: 'behance', label: 'Behance' },
              { value: 'stackoverflow', label: 'Stack Overflow' }, { value: 'youtube', label: 'YouTube' },
            ]}
          /></FieldShell>
          <TextInput aria-label="Contact value" value={item.value} onChange={(e) => setField('value', e.target.value)} placeholder="Value" />
          <TextInput aria-label="Contact label" value={item.label || ''} onChange={(e) => setField('label', e.target.value)} placeholder="Label (optional)" />
        </>
      )}
    />
  )
}
