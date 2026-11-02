import { Button as UIAction } from 'themelia-react-ui/base/buttons'
import { useState } from 'react'
import { Link, Unlink } from 'lucide-react'
import { cn } from '#/voucher-builder/lib/utils'

interface SpacingControlProps {
  label: string
  top: number
  right: number
  bottom: number
  left: number
  onChange: (values: { top: number; right: number; bottom: number; left: number }) => void
}

export function SpacingControl({ label, top, right, bottom, left, onChange }: SpacingControlProps) {
  const allEqual = top === right && right === bottom && bottom === left
  const [linked, setLinked] = useState(allEqual)

  const handleLinkedChange = (val: number) => {
    onChange({ top: val, right: val, bottom: val, left: val })
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <UIAction
          buttonStyle="ghost"
          onClick={() => {
            if (!linked) {
              // Link: set all to top value
              onChange({ top, right: top, bottom: top, left: top })
            }
            setLinked(!linked)
          }}
          className={cn(
            'flex items-center justify-center transition',
            linked ? 'text-blue-600 bg-blue-50' : 'text-muted-foreground hover:text-foreground',
          )}
          title={linked ? 'Unlink sides' : 'Link all sides'}
        >
          {linked ? <Link className="h-3 w-3" /> : <Unlink className="h-3 w-3" />}
        </UIAction>
      </div>

      {linked ? (
        <input
          type="number"
          value={top}
          onChange={(e) => handleLinkedChange(Number(e.target.value))}
          min={0}
          className={cn(
            'h-7 w-full rounded-md border border-input bg-transparent px-2 text-xs outline-none',
            '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
          )}
        />
      ) : (
        <div className="grid grid-cols-4 gap-1">
          {(['top', 'right', 'bottom', 'left'] as const).map((side) => {
            const val = { top, right, bottom, left }[side]
            return (
              <div key={side} className="space-y-0.5">
                <span className="text-[9px] text-muted-foreground uppercase block text-center">
                  {side[0]}
                </span>
                <input
                  type="number"
                  value={val}
                  onChange={(e) => onChange({ top, right, bottom, left, [side]: Number(e.target.value) })}
                  min={0}
                  className={cn(
                    'h-7 w-full rounded border border-input bg-transparent px-1 text-xs text-center outline-none',
                    '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
                  )}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
