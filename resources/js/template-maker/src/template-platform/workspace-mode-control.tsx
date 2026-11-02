import { useId, useLayoutEffect, useRef } from 'react'
import { PillRadioGroup } from 'themelia-react-ui/base/choice-inputs'

/** One native exclusive choice for the workspace's local editing mode. */
export function WorkspaceModeControl<Mode extends string>({ label, value, options, onChange }: {
  label: string
  value: Mode
  options: { value: Mode; label: string }[]
  onChange: (value: Mode) => void
}) {
  const name = useId()
  const group = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const outgoing = group.current
    if (!outgoing?.contains(document.activeElement) || !outgoing.closest('[hidden]')) return
    // Both editors stay mounted. Move keyboard focus to the incoming header.
    const workspace = outgoing.closest('[data-template-workspace]')
    const selected = [...workspace?.querySelectorAll<HTMLButtonElement>('.tc-workspace-mode-control [role="radio"][aria-checked="true"]') ?? []].find(node => !node.closest('[hidden]'))
    selected?.focus()
  }, [value])
  return <PillRadioGroup ref={group} className="tc-workspace-mode-control" name={name} aria-label={label} size="sm" value={value} options={options} onValueChange={next => {
    const option = options.find(option => option.value === next)
    if (option) onChange(option.value)
  }} />
}
