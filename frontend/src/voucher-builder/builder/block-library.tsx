import { Item, ItemGroup } from 'themelia-react-ui/base/item'
import { EmptyState } from 'themelia-react-ui/blocks/data-display'
import { Input } from 'themelia-react-ui/base/text-inputs'
import { Select } from 'themelia-react-ui/base/choice-inputs'
import { FormField } from 'themelia-react-ui/base/forms'
import { Stack } from 'themelia-react-ui/base/structure'
import { Heading as UIHeading } from 'themelia-react-ui/typography'
import { Button as UIAction } from 'themelia-react-ui/base/buttons'
import { useState } from 'react'
import { Bookmark, Search, Trash2 } from 'lucide-react'
import { useSnippetStore, useScopedSnippetActions } from '../store/snippets'
import { useVoucherActions, useVoucherSelection, useVoucherProject } from '../hooks/use-voucher-builder'
import { getAllBlockDefs, BLOCK_CATEGORIES } from '../blocks'
import '../blocks/definitions'
import type { BlockType } from '../schema'

export function BlockLibrary({ onInsert }: { onInsert?: () => void }) {
  const [query, setQuery] = useState('')
  const { activeSectionId } = useVoucherSelection()
  const sections = useVoucherProject((p) => p.sections)
  const { addBlock, setActiveSectionId } = useVoucherActions()
  const snippets = useSnippetStore((s) => s.snippets)
  const { insertSnippet } = useScopedSnippetActions()
  const removeSnippet = useSnippetStore((s) => s.removeSnippet)
  const sectionId = activeSectionId ?? sections[0]?.id
  const definitions = getAllBlockDefs()
  const q = query.trim().toLowerCase()
  const matchingSnippets = snippets.filter((snippet) => !q || snippet.name.toLowerCase().includes(q))
  const matches = definitions.filter(
    (d) =>
      !d.hidden &&
      d.allowedIn.includes('page') &&
      (!q || `${d.name} ${d.description}`.toLowerCase().includes(q)),
  )
  return (
    <Stack gap="xl">
      <FormField label="Insert into">
        <Select
          aria-label="Insert into section"
          value={sectionId ?? ''}
          options={sections.map((section, index) => ({ value: section.id, label: `Section ${index + 1}` }))}
          onValueChange={(value) => {
            if (value) setActiveSectionId(value)
          }}
        />
      </FormField>
      <Input
        startIcon={Search}
        clearable
        aria-label="Search blocks"
        placeholder="Search blocks…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {matchingSnippets.length > 0 && (
        <Stack gap="md">
          <UIHeading tag="h3" size="sm" className="nc-section-label ">
            Saved snippets
          </UIHeading>
          <ItemGroup aria-label="Saved snippets">
            {matchingSnippets.map((s) => (
              <Stack key={s.id} direction="horizontal" gap="sm" align="center" wrap={false}>
                <Item
                  title={s.name}
                  media={<Bookmark aria-hidden />}
                  mediaVariant="icon"
                  density="compact"
                  className="nc-library-item flex-nowrap flex-1"
                  render={<button type="button" disabled={!sectionId} />}
                  onClick={() => {
                    if (sectionId && insertSnippet(s.id, sectionId)) onInsert?.()
                  }}
                />
                <UIAction
                  buttonStyle="ghost"
                  iconOnly
                  size="sm"
                  className=""
                  aria-label={`Delete snippet ${s.name}`}
                  onClick={() => removeSnippet(s.id)}
                >
                  <Trash2 className="size-3.5" />
                </UIAction>
              </Stack>
            ))}
          </ItemGroup>
        </Stack>
      )}
      {BLOCK_CATEGORIES.map(({ key, label }) => {
        const items = matches.filter((d) => d.category === key)
        return items.length ? (
          <Stack key={key} gap="md">
            <UIHeading tag="h3" size="sm">
              {label}
            </UIHeading>
            <ItemGroup aria-label={label}>
              {items.map((d) => (
                <Item
                  key={d.type}
                  title={d.name}
                  description={d.description}
                  media={<d.icon aria-hidden />}
                  mediaVariant="icon"
                  density="compact"
                  descriptionClamp="none"
                  className="nc-library-item flex-nowrap"
                  render={
                    <button
                      type="button"
                      disabled={!sectionId}
                      onClick={() => {
                        if (!sectionId) return
                        setActiveSectionId(sectionId)
                        addBlock(sectionId, d.type as BlockType)
                        onInsert?.()
                      }}
                    />
                  }
                />
              ))}
            </ItemGroup>
          </Stack>
        ) : null
      })}
      {!matches.length && !matchingSnippets.length && (
        <EmptyState
          padding="sm"
          title="No matching blocks"
          description={`No blocks match “${query}”.`}
          actions={<UIAction onClick={() => setQuery('')}>Clear search</UIAction>}
        />
      )}
    </Stack>
  )
}
