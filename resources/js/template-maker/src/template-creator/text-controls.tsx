import { Plus } from 'lucide-react'
import { Button as Action } from 'themelia-react-ui/base/buttons'
import { Select } from 'themelia-react-ui/base/choice-inputs'
import { Grid } from 'themelia-react-ui/base/structure'
import type { TemplateNode } from '../template-core/schema'
import { CommitInput, Field, ValueInput } from './controls'
import { useTemplateActions, useTemplateDocument } from './hooks'
import { SettingBlock } from '../voucher-builder/builder/settings/primitives/setting-block'

/** Shared text-part controls for a text node and a primitive's single text child. */
export function TextNodeControls({ node, run }: { node: Extract<TemplateNode, { kind: 'text' }>; run: (task: () => unknown) => void }) {
  const template = useTemplateDocument()
  const actions = useTemplateActions()
  const update = (patch: Partial<TemplateNode>) => actions.updateNode(node.id, patch)
  return (
        <>
          {node.parts.map((part, index) => (
            <SettingBlock display="inline" className="tc-binding-part" key={index} label={node.parts.length === 1 ? 'Content' : `Content ${index + 1}`}>
              <ValueInput
                fields={template.fields}
                value={part.value}
                onChange={(value) => {
                  const parts = [...node.parts]
                  parts[index] = { ...part, value }
                  update({ parts } as Partial<TemplateNode>)
                }}
              />
              <Grid columns={part.format === 'currency' ? 2 : 1} gap="lg">
              <Field label="Display format">
                <Select
                  className="tc-input"
                  aria-label={`Content ${index + 1} format`}
                  value={part.format}
                  onValueChange={(value) => {
                    const parts = [...node.parts]
                    parts[index] = { ...part, format: (value ?? '') as typeof part.format }
                    run(() => update({ parts } as Partial<TemplateNode>))
                  }}
                  options={[
                    { value: 'text', label: 'Text' },
                    { value: 'number', label: 'Number' },
                    { value: 'currency', label: 'Currency' },
                    { value: 'date', label: 'Date' },
                  ]}
                />
              </Field>
              {part.format === 'currency' && (
                <CommitInput
                  label="Currency code"
                  value={part.currency}
                  onCommit={(currency) => {
                    const parts = [...node.parts]
                    parts[index] = { ...part, currency }
                    update({ parts } as Partial<TemplateNode>)
                  }}
                />
              )}
              </Grid>
              {node.parts.length > 1 && (
                <Action
                  onClick={() =>
                    update({ parts: node.parts.filter((_, i) => index !== i) } as Partial<TemplateNode>)
                  }
                >
                  Remove content part
                </Action>
              )}
            </SettingBlock>
          ))}
          <Action
            buttonStyle="ghost"
            onClick={() =>
              update({
                parts: [
                  ...node.parts,
                  { value: { source: 'literal', value: ' ' }, format: 'text', currency: 'EUR' },
                ],
              } as Partial<TemplateNode>)
            }
          >
            <Plus />
            Add content part
          </Action>
        </>
  )
}
