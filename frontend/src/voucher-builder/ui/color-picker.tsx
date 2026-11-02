import { createContext, useContext, useRef, type ReactNode } from 'react'
import { ColorInput } from 'themelia-react-ui/base/value-inputs'
import { Button } from 'themelia-react-ui/base/buttons'
import { Popover, PopoverContent, PopoverTrigger } from 'themelia-react-ui/base/popover'
import { Stack } from 'themelia-react-ui/base/structure'
import { Text } from 'themelia-react-ui/typography'
import { useGlobalSettingsState } from '../store/hooks'
import { create } from 'zustand'
import { Palette } from 'lucide-react'
import { useOptionalVoucherInstance } from '../editor-context'
const MAX_RECENT = 5
const DocumentPaletteContext = createContext<readonly string[] | null>(null)

/** Authored output colors; independent of the editor's application theme. */
export function DocumentPaletteProvider({ colors, children }: { colors: readonly string[]; children: ReactNode }) {
  return <DocumentPaletteContext.Provider value={colors}>{children}</DocumentPaletteContext.Provider>
}

interface RecentColorsState {
  colors: string[]
  addColor: (color: string) => void
}

export const useRecentColors = create<RecentColorsState>()(
  (set) => ({
      colors: [],
      addColor: (color) =>
        set((s) => {
          const normalized = color.toLowerCase()
          if (!normalized || normalized === 'transparent' || normalized === '') return s
          const filtered = s.colors.filter((c) => c !== normalized)
          return { colors: [normalized, ...filtered].slice(0, MAX_RECENT) }
        }),
    }),
)

interface ColorPickerProps {
  control?: { id?: string; 'aria-describedby'?: string }
  label?: string
  disabled?: boolean
  value: string
  onChange: (value: string) => void
  onChangeStart?: () => void
}
export function ColorPicker({ value, onChange, onChangeStart, label, disabled, control }: ColorPickerProps) {
  const global = useGlobalSettingsState()
  const voucher = useOptionalVoucherInstance()
  const documentColors = useContext(DocumentPaletteContext)
  const recent = useRecentColors((state) => state.colors)
  const addRecent = useRecentColors((state) => state.addColor)
  const started = useRef(false)
  const begin = () => {
    if (!started.current) {
      started.current = true
      onChangeStart?.()
    }
  }
  const commit = (color: string) => {
    begin()
    onChange(color)
  }
  const palette = [
    ...new Set(
      (documentColors ?? (voucher ? Object.values(global.colors) : [])).filter(
        (color) => typeof color === 'string' && color && color !== 'transparent',
      ),
    ),
  ]
  const swatches = (colors: string[]) => (
    <Stack direction="horizontal" gap="md" wrap>
      {colors.map((color) => (
        <Button
          key={color}
          size="sm"
          iconOnly
          disabled={disabled}
          aria-label={`Use ${color}`}
          withTooltip={color}
          onClick={() => {
            onChangeStart?.()
            onChange(color)
            addRecent(color)
          }}
        >
          <span aria-hidden className="nc-color-sample" style={{ backgroundColor: color }} />
        </Button>
      ))}
    </Stack>
  )
  return (
    <Stack direction="horizontal" align="center" gap="md">
      <div className="min-w-0 flex-1">
      <ColorInput
        {...control}
        value={value}
        aria-label={label ?? 'Color value'}
        pickerAriaLabel={`Choose ${label ?? 'color'}`}
        disabled={disabled}
        previewValue={value || (voucher ? global.colors.text : palette[0] ?? 'transparent')}
        placeholder={!value && voucher ? `Inherited · ${global.colors.text}` : undefined}
        onValueChange={commit}
        onFocus={begin}
        onBlur={() => {
          started.current = false
          addRecent(value)
        }}
      />
      </div>
      {(palette.length > 0 || recent.length > 0) && <Popover>
        <PopoverTrigger render={<Button size="sm" iconOnly buttonStyle="ghost" disabled={disabled} aria-label={`${palette.length ? 'Document palette' : 'Recent colors'}${label ? ` for ${label}` : ''}`} withTooltip={palette.length ? 'Document palette' : 'Recent colors'} />}><Palette /></PopoverTrigger>
        <PopoverContent type="display">
          <Stack gap="lg">
            {palette.length > 0 && <Stack gap="normal">
              <Text weight="medium">Document colors</Text>
              {swatches(palette)}
            </Stack>}
            {recent.length > 0 && (
              <Stack gap="sm">
                <Text weight="medium">Recent colors</Text>
                {swatches(recent)}
              </Stack>
            )}
          </Stack>
        </PopoverContent>
      </Popover>}
    </Stack>
  )
}
