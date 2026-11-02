import { useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { Button } from 'themelia-react-ui/base/buttons'
import { Select } from 'themelia-react-ui/base/choice-inputs'
import { Input } from 'themelia-react-ui/base/text-inputs'
import { Stack } from 'themelia-react-ui/base/structure'
import { Card } from 'themelia-react-ui/base/cards'
import { Badge } from 'themelia-react-ui/base/badge'
import { Heading, Text } from 'themelia-react-ui/typography'
import { ActionDialog } from 'themelia-react-ui/features/overlays'
import { DataSchemaSchema, IdentifierSchema, JsonValueSchema, TemplateBlockSchema, TemplateNodeSchema,
  type DataSchema, type TemplateBlock, type TemplateNode, type JsonValue } from '../template-core/schema'
import { childIds, nodeValues } from '../template-core/validation'
import { compileTemplateCSS } from '../template-core/styles'
import { templateNodeLabel } from '../template-core/labels'
import { useTemplateActions, useTemplateDocument } from './hooks'
import { CommitInput, Field, JsonInput, Toggle, ValueInput, defaultDataSchema } from './controls'

const initialValue = (schema: DataSchema): JsonValue => schema.type === 'string' ? schema.enum?.[0] ?? '' :
  schema.type === 'boolean' ? false : schema.type === 'array' ? [] : schema.type === 'object' ? {} :
  schema.type === 'integer' ? Math.ceil(schema.minimum ?? Math.min(0, schema.maximum ?? 0)) : schema.minimum ?? Math.min(0, schema.maximum ?? 0)

export function BlockInstanceControls({ node, run }: {
  node: Extract<TemplateNode, { kind: 'block' }>; run: (task: () => unknown) => void
}) {
  const template = useTemplateDocument()
  const actions = useTemplateActions()
  const block = template.blocks.find(block => block.id === node.blockId && block.version === node.version)
  if (!block) return <Text>Import the missing block revision before configuring this instance.</Text>
  const containsInstance = (id: string, seen = new Set<string>()): boolean => {
    if (id === node.id) return true
    if (seen.has(id) || !template.nodes[id]) return false
    seen.add(id)
    return childIds(template.nodes[id]).some(child => containsInstance(child, seen))
  }
  return <Stack gap="lg">
    <Text type="secondary">Linked to version {node.version}. New definitions leave this insertion unchanged.</Text>
    {Object.entries(block.props).map(([name, schema]) => {
      const metadata = block.propertyMetadata?.[name]
      const value = Object.hasOwn(node.props, name) ? node.props[name] : undefined
      return <Stack gap="md" key={name}>
        <Heading tag="h3" size="sm">{metadata?.label ?? name}{block.requiredProps.includes(name) ? ' *' : ''}</Heading>
        {metadata?.description && <Text type="secondary">{metadata.description}</Text>}
        {value ? <ValueInput fields={template.fields} value={value}
          onChange={value => actions.setBlockProperty(node.id, name, value)} /> :
          <Text type="secondary">{metadata?.defaultValue !== undefined ? 'Using the property default.' : 'Property omitted.'}</Text>}
        <Stack direction="horizontal" wrap gap="sm">
          {!value && <Button onClick={() => run(() => actions.setBlockProperty(node.id, name,
            { source: 'literal', value: metadata?.defaultValue ?? initialValue(schema) }))}>Set {metadata?.label ?? name}</Button>}
          {value && (!block.requiredProps.includes(name) || metadata?.defaultValue !== undefined) &&
            <Button buttonStyle="ghost" onClick={() => run(() => actions.setBlockProperty(node.id, name, undefined))}>
              {metadata?.defaultValue !== undefined ? 'Use default' : 'Omit property'}
            </Button>}
        </Stack>
      </Stack>
    })}
    {Object.values(block.nodes).filter(item => item.kind === 'slot').map(slot => {
      if (slot.kind !== 'slot') return null
      const contents = Object.hasOwn(node.slots, slot.slot) ? node.slots[slot.slot] : undefined
      return <Stack key={slot.id} gap="md">
        <Heading tag="h3" size="sm">Slot: {slot.slot}</Heading>
        <Text type="secondary">{contents === undefined ? 'Using fallback content.' : contents.length ? 'Using assigned content.' : 'Slot is explicitly empty.'}</Text>
        {contents?.map(id => <Stack direction="horizontal" align="center" justify="between" gap="md" key={id}>
          <Text>{template.nodes[id] ? templateNodeLabel(template.nodes[id]) : id}</Text>
          <Button buttonStyle="ghost" size="sm" aria-label={`Remove ${template.nodes[id]?.name ?? id} from ${slot.slot}`}
            onClick={() => run(() => actions.setBlockSlot(node.id, slot.slot, contents.filter(child => child !== id)))}>Remove</Button>
        </Stack>)}
        <Field label={`Add content to ${slot.slot}`} hint="Assigned elements move into this slot. Displaced content returns to the document root.">
          <Select aria-label={`Add content to ${slot.slot}`} placeholder="Choose an element…" value="" options={[
            { value: '', label: 'Choose an element…' },
            ...Object.values(template.nodes).filter(item => !contents?.includes(item.id) && !containsInstance(item.id))
              .map((item, index) => ({ value: item.id, label: `${templateNodeLabel(item)} · ${index + 1}` })),
          ]} onValueChange={id => { if (id) run(() => actions.setBlockSlot(node.id, slot.slot, [...contents ?? [], id])) }} />
        </Field>
        <Stack direction="horizontal" wrap gap="sm">
          <Button buttonStyle="ghost" disabled={contents?.length === 0}
            onClick={() => run(() => actions.setBlockSlot(node.id, slot.slot, []))}>Use empty slot</Button>
          <Button buttonStyle="ghost" disabled={contents === undefined}
            onClick={() => run(() => actions.setBlockSlot(node.id, slot.slot, undefined))}>Restore fallback</Button>
        </Stack>
      </Stack>
    })}
    <Button onClick={() => run(() => actions.detachBlock(node.id))}>Detach for independent editing</Button>
  </Stack>
}

/** Editing creates a new pinned revision; existing instances keep the original definition. */
export function BlockDefinitionDialog({ block, close }: { block: TemplateBlock; close: () => void }) {
  const actions = useTemplateActions()
  const [draft, setDraft] = useState(() => structuredClone(block))
  const [propertyName, setPropertyName] = useState('')
  const [slotName, setSlotName] = useState('')
  const [fallbackId, setFallbackId] = useState('')
  const content = useRef<HTMLDivElement>(null)
  const metadata = (name: string) => draft.propertyMetadata?.[name] ?? { label: name, description: '' }
  const updateMetadata = (name: string, patch: Partial<NonNullable<TemplateBlock['propertyMetadata']>[string]>) =>
    setDraft(previous => ({ ...previous, propertyMetadata: { ...previous.propertyMetadata,
      [name]: { ...metadata(name), ...patch } } }))
  const replace = (ids: string[], target: string, replacement: string[]) => ids.flatMap(id => id === target ? replacement : [id])
  const removeProperty = (name: string) => {
    const props = { ...draft.props }, propertyMetadata = { ...draft.propertyMetadata }
    delete props[name]
    delete propertyMetadata[name]
    setDraft({ ...draft, props, propertyMetadata, requiredProps: draft.requiredProps.filter(item => item !== name) })
  }
  const addSlot = () => {
    const id = `slot_${nanoid(10).replace(/-/g, '_')}`
    const nodes = structuredClone(draft.nodes)
    for (const node of Object.values(nodes)) {
      if ('children' in node) node.children = replace(node.children, fallbackId, [id])
      if (node.kind === 'block') for (const name of Object.keys(node.slots)) node.slots[name] = replace(node.slots[name], fallbackId, [id])
    }
    nodes[id] = TemplateNodeSchema.parse({ id, kind: 'slot', name: slotName, slot: slotName, children: [fallbackId] })
    setDraft({ ...draft, roots: replace(draft.roots, fallbackId, [id]), nodes })
    setSlotName('')
    setFallbackId('')
  }
  const removeSlot = (slot: Extract<TemplateNode, { kind: 'slot' }>) => {
    const nodes = structuredClone(draft.nodes)
    delete nodes[slot.id]
    for (const node of Object.values(nodes)) {
      if ('children' in node) node.children = replace(node.children, slot.id, slot.children)
      if (node.kind === 'block') for (const name of Object.keys(node.slots)) node.slots[name] = replace(node.slots[name], slot.id, slot.children)
    }
    setDraft({ ...draft, roots: replace(draft.roots, slot.id, slot.children), nodes })
  }
  return <ActionDialog open onOpenChange={open => { if (!open) close() }} title={`Edit ${block.name}`}
    description="Save a new definition revision. Existing insertions remain pinned to their current version."
    strings={{ confirm: 'Save new revision' }} onAsyncConfirm={async () => {
      if (content.current?.querySelector('[aria-invalid="true"]')) throw new Error('Fix the highlighted definition fields before saving.')
      actions.reviseBlock(block.id, block.version, draft)
    }}>
    <div ref={content} className="[overflow-wrap:anywhere]"><Stack gap="2xl">
      <CommitInput label="Definition name" value={draft.name}
        onCommit={name => setDraft({ ...draft, name: TemplateBlockSchema.shape.name.parse(name) })} />
      <Stack gap="lg">
        <Heading tag="h3" size="sm">Property definitions</Heading>
        {Object.entries(draft.props).map(([name, schema]) => <Card key={name} title={name}
          titleSuffix={draft.requiredProps.includes(name) ? <Badge>Required</Badge> : undefined}
          actionsLabel={`Actions for property ${name}`} actions={[{ label: 'Remove unused property',
            disabled: Object.values(draft.nodes).some(node => nodeValues(node).some(value => value.source === 'prop' && value.name === name)),
            onClick: () => removeProperty(name) }]}>
          <Stack gap="lg">
            <CommitInput label={`Label for ${name}`} value={metadata(name).label}
              onCommit={label => { if (!label.trim()) throw new Error('Enter a property label.'); updateMetadata(name, { label }) }} />
            <CommitInput label={`Description for ${name}`} value={metadata(name).description}
              onCommit={description => updateMetadata(name, { description })} />
            <Toggle label={`Require ${name}`} checked={draft.requiredProps.includes(name)}
              onChange={required => setDraft({ ...draft, requiredProps: required ? [...draft.requiredProps, name] : draft.requiredProps.filter(item => item !== name) })} />
            <JsonInput label={`Schema for ${name}`} value={schema}
              onCommit={value => setDraft({ ...draft, props: { ...draft.props, [name]: DataSchemaSchema.parse(value) } })} />
            <JsonInput label={`Default for ${name}`} value={metadata(name).defaultValue}
              hint="A runtime fallback for an omitted property. Clear to require an explicit value when marked required."
              onCommit={value => updateMetadata(name, { defaultValue: value === undefined ? undefined : JsonValueSchema.parse(value) })} />
          </Stack>
        </Card>)}
        <Field label="New property name"><Input aria-label="New property name" value={propertyName} onChange={event => setPropertyName(event.target.value)} /></Field>
        <Button disabled={!IdentifierSchema.safeParse(propertyName).success || Object.hasOwn(draft.props, propertyName)}
          onClick={() => { setDraft({ ...draft, props: { ...draft.props, [propertyName]: defaultDataSchema('string') } }); setPropertyName('') }}>Add property</Button>
      </Stack>
      <Stack gap="lg">
        <Heading tag="h3" size="sm">Slots</Heading>
        {Object.values(draft.nodes).filter(node => node.kind === 'slot').map(node => node.kind === 'slot' &&
          <Stack key={node.id} direction="horizontal" align="center" justify="between" gap="md">
            <Text>{node.slot}</Text><Button buttonStyle="ghost" onClick={() => removeSlot(node)}>Remove slot {node.slot}</Button>
          </Stack>)}
        <Field label="New slot name"><Input aria-label="New slot name" value={slotName} onChange={event => setSlotName(event.target.value)} /></Field>
        <Field label="Fallback element"><Select aria-label="Fallback element" placeholder="Choose fallback content…" value={fallbackId}
          onValueChange={value => setFallbackId(value ?? '')} options={[{ value: '', label: 'Choose fallback content…' },
            ...Object.values(draft.nodes).filter(node => node.kind !== 'slot').map((node, index) => ({ value: node.id, label: `${templateNodeLabel(node)} · ${index + 1}` }))]} /></Field>
        <Button disabled={!IdentifierSchema.safeParse(slotName).success || !draft.nodes[fallbackId] ||
          Object.values(draft.nodes).some(node => node.kind === 'slot' && node.slot === slotName)} onClick={addSlot}>Add slot</Button>
      </Stack>
      <CommitInput label="Block CSS" multiline mono rows={5} value={draft.css} onCommit={css => {
        const result = compileTemplateCSS(css)
        if (result.issues.length) throw new Error(result.issues[0].message)
        setDraft({ ...draft, css })
      }} />
      <JsonInput label="Definition node graph" value={draft.nodes}
        hint="Advanced: change bindings or content inside the definition. References are checked before saving."
        onCommit={nodes => setDraft({ ...draft, nodes: TemplateBlockSchema.shape.nodes.parse(nodes) })} />
      <JsonInput label="Definition roots" value={draft.roots}
        onCommit={roots => setDraft({ ...draft, roots: TemplateBlockSchema.shape.roots.parse(roots) })} />
    </Stack></div>
  </ActionDialog>
}
