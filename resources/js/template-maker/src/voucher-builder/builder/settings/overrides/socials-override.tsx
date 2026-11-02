import type { Block } from '../../../schema'
import { TextInput } from '../primitives/variants/text'
import { PillsInput } from '../primitives/variants/choice'
import { ItemListEditor } from '../item-list-editor'
import type { BlockOverrideProps } from './types'
import { FieldShell } from '../primitives/field-shell'

export function SocialsOverride({ block, update }: BlockOverrideProps) {
  const links: Array<{ platform: string; url: string; label: string }> = block.content.links || []

  return (
    <ItemListEditor
      items={links}
      onUpdate={(next) => update({ content: { ...block.content, links: next } } as Partial<Block>)}
      createItem={() => ({ platform: 'web', url: '', label: '' })}
      labelFn={(item) => `${item.platform} ${item.url ? '· ' + item.url.slice(0, 20) : ''}`.trim()}
      title="Links"
      addLabel="Add Link"
      renderItem={(item, _index, setField) => (
        <>
          <FieldShell label="Platform"><PillsInput
            value={item.platform}
            onChange={(value) => setField('platform', value)}
            options={[
              { value: 'github', label: 'GitHub' }, { value: 'twitter', label: 'X / Twitter' },
              { value: 'linkedin', label: 'LinkedIn' }, { value: 'web', label: 'Website' },
              { value: 'mastodon', label: 'Mastodon' }, { value: 'medium', label: 'Medium' },
              { value: 'dribbble', label: 'Dribbble' }, { value: 'behance', label: 'Behance' },
              { value: 'youtube', label: 'YouTube' }, { value: 'stackoverflow', label: 'Stack Overflow' },
            ]}
          /></FieldShell>
          <TextInput aria-label="Link URL" value={item.url} onChange={(e) => setField('url', e.target.value)} placeholder="URL" />
          <TextInput aria-label="Link label" value={item.label} onChange={(e) => setField('label', e.target.value)} placeholder="Label" />
        </>
      )}
    />
  )
}
