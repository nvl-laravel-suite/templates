// @vitest-environment jsdom
import { AutoSettingsRenderer } from '#/voucher-builder/builder/auto-settings-renderer'
import { getBlockDef } from '#/voucher-builder/blocks'
import '#/voucher-builder/blocks/definitions'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingInput } from '../setting-input'
import { AlignmentInput } from './choice'
import { SpacingInput } from './numeric'
import { ListInput } from './media'
import { SettingBlock } from '../setting-block'
import { VoucherBuilderProvider } from '#/voucher-builder/provider'
import { createVoucherBuilder } from '#/voucher-builder/instance'
import { RowOverride } from '../../overrides/row-override'
import { GridOverride } from '../../overrides/grid-override'

describe('settings interactions', () => {
  let root: Root
  let container: HTMLDivElement
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })
  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })
  it('disables list edits and removal through the actual controls', async () => {
    const change = vi.fn()
    await act(async () => root.render(<ListInput value={['One']} onChange={change} disabled />))
    expect(container.querySelector('input')?.disabled).toBe(true)
    const buttons = [...container.querySelectorAll('button')]
    expect(buttons.length).toBe(2)
    expect(buttons.every((button) => button.disabled)).toBe(true)
    await act(async () => buttons.forEach((button) => button.click()))
    expect(change).not.toHaveBeenCalled()
  })
  it('links unequal spacing explicitly and unlinks after an external unequal update', async () => {
    const change = vi.fn()
    const start = vi.fn()
    const unequal = { top: 4, right: 8, bottom: 12, left: 16 }
    const render = (value: typeof unequal) =>
      root.render(<SpacingInput value={value} onChange={change} onChangeStart={start} />)
    await act(async () => render(unequal))
    expect(container.querySelectorAll('input[type="range"]')).toHaveLength(4)
    const toggle = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!
    await act(async () => toggle.click())
    expect(change).toHaveBeenCalledWith({ top: 4, right: 4, bottom: 4, left: 4 })
    expect(start).toHaveBeenCalledTimes(1)
    await act(async () => render({ top: 4, right: 4, bottom: 4, left: 4 }))
    expect(container.querySelectorAll('input[type="range"]')).toHaveLength(1)
    await act(async () => render(unequal))
    expect(container.querySelectorAll('input[type="range"]')).toHaveLength(4)
    expect(change).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain('px')
  })
  it('gives alignment an exclusive native choice and respects disabled state', async () => {
    const change = vi.fn()
    await act(async () => root.render(<AlignmentInput value="left" onChange={change} />))
    const right = container.querySelector<HTMLButtonElement>('button[aria-label="right"]')!
    await act(async () => right.click())
    expect(change).toHaveBeenCalledWith('right')
    await act(async () => root.render(<AlignmentInput value="right" onChange={change} disabled />))
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="left"]')!.click())
    expect(change).toHaveBeenCalledTimes(1)
  })
  it('discloses settings with an accurately named action and expanded state', async () => {
    await act(async () =>
      root.render(
        <SettingBlock label="Appearance">
          <input aria-label="Test setting" />
        </SettingBlock>,
      ),
    )
    const collapse = container.querySelector<HTMLButtonElement>('[aria-label="Collapse Appearance"]')!
    const field = container.querySelector<HTMLInputElement>('[aria-label="Test setting"]')!
    field.value = 'Uncommitted setting'
    expect(collapse.getAttribute('aria-expanded')).toBe('true')
    await act(async () => collapse.click())
    expect(container.querySelector('[aria-label="Test setting"]')).toBe(field)
    await vi.waitFor(() => expect(field.closest('[hidden]')).not.toBeNull())
    const expand = container.querySelector<HTMLButtonElement>('[aria-label="Expand Appearance"]')!
    expect(expand.getAttribute('aria-expanded')).toBe('false')
    await act(async () => expand.click())
    expect(container.querySelector('[aria-label="Test setting"]')).not.toBeNull()
    expect(field.value).toBe('Uncommitted setting')
  })
  it('associates visible labels and supporting copy without nesting reset actions in labels', async () => {
    const change = vi.fn()
    await act(async () =>
      root.render(
        <SettingInput
          type="input"
          label="Document title"
          description="Used for the downloaded file."
          value="Draft"
          onChange={change}
          labelExtra={<button type="button">Reset title</button>}
        />,
      ),
    )
    const input = container.querySelector('input')!
    const label = container.querySelector('label')!
    expect(label.control).toBe(input)
    expect(container.querySelector('label button')).toBeNull()
    expect(document.getElementById(input.getAttribute('aria-describedby')!)?.textContent).toBe(
      'Used for the downloaded file.',
    )
  })
  it('keeps repeated inputs and slider companion controls uniquely identified', async () => {
    await act(async () =>
      root.render(
        <>
          <SettingInput type="list" label="Benefits" value={['First', 'Second']} onChange={() => {}} />
          <SettingInput type="slider" label="Width" value={20} min={0} max={100} onChange={() => {}} />
        </>,
      ),
    )
    const ids = [...container.querySelectorAll('[id]')].map((element) => element.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(container.querySelector<HTMLInputElement>('input[aria-label="Item 1"]')?.id).not.toBe(
      container.querySelector<HTMLInputElement>('input[aria-label="Item 2"]')?.id,
    )
  })
  it.each(['row', 'grid'] as const)(
    'names each %s dimension and keeps native label targets unique',
    async (type) => {
      const instance = createVoucherBuilder()
      try {
        instance.actions.addBlock(instance.actions.getProject().sections[0].id, type)
        const project = instance.actions.getProject()
        const block = Object.values(project.blocks).find((block) => block.type === type)!
        if (type === 'row') instance.actions.resizeRow(block.id, 3)
        else instance.actions.resizeGrid(block.id, 2, 3)
        const current = instance.actions.getProject().blocks[block.id]
        const Override = type === 'row' ? RowOverride : GridOverride
        await act(async () =>
          root.render(
            <VoucherBuilderProvider instance={instance}>
              <Override block={current} update={() => {}} />
            </VoucherBuilderProvider>,
          ),
        )
        const sliders = [...container.querySelectorAll('input[type="range"]')]
        expect(sliders).toHaveLength(3)
        expect(sliders.map((slider) => slider.getAttribute('aria-label'))).toEqual(
          [1, 2, 3].map((index) => (type === 'row' ? `Column ${index} width` : `Row ${index} height`)),
        )
        const ids = [...container.querySelectorAll('[id]')].map((element) => element.id)
        expect(new Set(ids).size).toBe(ids.length)
      } finally {
        instance.destroy()
      }
    },
  )
  it('toggles a checkbox from its visible label and respects disabled state', async () => {
    const change = vi.fn()
    const render = (disabled = false) =>
      root.render(
        <SettingInput
          type="checkbox"
          label="Show border"
          value={false}
          onChange={change}
          disabled={disabled}
        />,
      )
    await act(async () => render())
    await act(async () => container.querySelector('label')!.click())
    expect(change).toHaveBeenCalledWith(true)
    change.mockClear()
    await act(async () => render(true))
    await act(async () => container.querySelector('label')!.click())
    expect(change).not.toHaveBeenCalled()
  })
  it('names dimension values, units and steppers by their field and shares the supporting description', async () => {
    const change = vi.fn()
    await act(async () =>
      root.render(
        <>
          {['Width', 'Height'].map((label) => (
            <SettingInput
              key={label}
              type="dimension"
              label={label}
              description={`${label} of the artwork.`}
              value={{ value: 24, unit: 'px' }}
              units={['px', 'mm', 'auto']}
              onChange={change}
            />
          ))}
        </>,
      ),
    )
    for (const label of ['Width', 'Height']) {
      const value = container.querySelector<HTMLInputElement>(`input[aria-label="${label} value"]`)!
      const unit = container.querySelector<HTMLElement>(`[role="combobox"][aria-label="${label} unit"]`)!
      expect(value).not.toBeNull()
      expect(unit).not.toBeNull()
      const description = value.getAttribute('aria-describedby')!
      expect(document.getElementById(description)?.textContent).toBe(`${label} of the artwork.`)
      expect(unit.getAttribute('aria-describedby')).toBe(description)
      const increment = container.querySelector<HTMLButtonElement>(`[aria-label="Increase ${label}"]`)!
      await act(async () => increment.click())
      expect(change).toHaveBeenLastCalledWith({ value: 25, unit: 'px' })
    }
    await act(async () =>
      root.render(
        <SettingInput
          type="dimension"
          label="Width"
          value={{ value: 24, unit: 'auto' }}
          units={['px', 'auto']}
          onChange={change}
        />,
      ),
    )
    expect(container.querySelector<HTMLInputElement>('[aria-label="Width value"]')?.disabled).toBe(true)
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Increase Width"]')?.disabled).toBe(true)
  })
  it('associates compound single controls without introducing duplicate IDs', async () => {
    await act(async () =>
      root.render(
        <>
          <SettingInput type="stepper" label="Count" value={2} onChange={() => {}} />
          <SettingInput
            type="select"
            label="Font"
            value="serif"
            options={[{ value: 'serif', label: 'Serif' }]}
            onChange={() => {}}
          />
          <SettingInput type="color" label="Ink" value="#000000" onChange={() => {}} />
          <SettingInput type="icon" label="Symbol" value="star" onChange={() => {}} />
          <SettingInput type="switch" label="Enabled" value={false} onChange={() => {}} />
        </>,
      ),
    )
    const ids = [...container.querySelectorAll('[id]')].map((element) => element.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const label of container.querySelectorAll<HTMLLabelElement>('label[for]')) {
      expect(label.control, label.textContent ?? '').not.toBeNull()
    }
  })
  it('keeps an inline reset action separate from the switch label', async () => {
    const reset = vi.fn(),
      change = vi.fn()
    await act(async () =>
      root.render(
        <SettingInput
          type="switch"
          label="Show border"
          value={true}
          onChange={change}
          labelExtra={
            <button type="button" onClick={reset}>
              Reset border
            </button>
          }
        />,
      ),
    )
    const resetButton = container.querySelector<HTMLButtonElement>('button:not([role="switch"])')!
    expect(resetButton?.textContent).toBe('Reset border')
    expect(container.querySelector('label button')).toBeNull()
    await act(async () => resetButton.click())
    expect(reset).toHaveBeenCalledOnce()
    expect(change).not.toHaveBeenCalled()
  })
  const renderSettings = (
    def: ReturnType<typeof getBlockDef>,
    settings: Record<string, unknown>,
    contentOnly = false,
  ) =>
    root.render(
      <AutoSettingsRenderer
        def={def!}
        content={{ count: 3 }}
        settings={settings}
        contentOnly={contentOnly}
        onContentChange={() => {}}
        onContentLiveChange={() => {}}
        onContentChangeStart={() => {}}
        onSettingsChange={() => {}}
        onSettingsLiveChange={() => {}}
        onSettingsChangeStart={() => {}}
      />,
    )
  it('uses the field label once for a matching single flat group', async () => {
    const def = {
      ...getBlockDef('heading')!,
      settingsLayout: [{ title: 'Level', display: 'flat' as const, fields: ['level'] }],
    }
    await act(async () => renderSettings(def, { level: 'h2' }))
    expect(container.querySelector('label')?.textContent).toBe('Level')
    expect(container.querySelector('label')?.control).not.toBeNull()
    expect(container.querySelector('h2,h3,[role="heading"]')).toBeNull()
  })
  it('omits empty conditional groups and restores their context when visible', async () => {
    const base = getBlockDef('heading')!
    const def = {
      ...base,
      settings: {
        ...base.settings,
        level: { ...base.settings.level, when: { field: 'enabled', value: true } },
      },
      settingsLayout: [
        { title: 'Heading level', description: 'Choose the semantic heading level.', fields: ['level'] },
      ],
    }
    await act(async () => renderSettings(def, { level: 'h2', enabled: false }))
    expect(container.textContent).toBe('')
    await act(async () => renderSettings(def, { level: 'h2', enabled: true }))
    expect(container.textContent).toContain('Choose the semantic heading level.')
    const expand = container.querySelector<HTMLButtonElement>('[aria-label="Expand Heading level"]')!
    await act(async () => expand.click())
    expect(container.querySelector('[role="combobox"][aria-label="Level"]')).not.toBeNull()
  })
  it('shows only content controls from a mixed group in content-only mode', async () => {
    const def = {
      ...getBlockDef('heading')!,
      content: { count: { type: 'number' as const, default: 3 } },
      settingsLayout: [{ title: 'Details', display: 'flat' as const, fields: ['count', 'level'] }],
    }
    await act(async () => renderSettings(def, { level: 'h2' }, true))
    expect(container.querySelector('input[aria-label="Count"]')).not.toBeNull()
    expect(container.querySelector('[aria-label="Level"]')).toBeNull()
  })
})
