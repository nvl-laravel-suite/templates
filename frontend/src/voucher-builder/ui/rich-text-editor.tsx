import { Card } from 'themelia-react-ui/base/cards'
import { useDensityConfig } from 'themelia-react-ui/ui-provider'
import { ActionDialog } from 'themelia-react-ui/features/overlays'
import { Input } from 'themelia-react-ui/base/text-inputs'
import { FormField } from 'themelia-react-ui/base/forms'
import { Stack as UIStack } from 'themelia-react-ui/base/structure'
import { Button as UIAction } from 'themelia-react-ui/base/buttons'
import * as React from 'react'
import { createPortal } from 'react-dom'
import { Bold, Italic, Link2, RemoveFormatting, Underline } from 'lucide-react'
import { cn } from '#/voucher-builder/lib/utils'
import { isRichTextEmpty, sanitizeRichTextHtml } from '#/voucher-builder/lib/rich-text'
import { useReadOnly, useVoucherPortal } from '../context'

interface RichTextEditableProps {
  as?: keyof React.JSX.IntrinsicElements
  value: string
  onCommit: (value: string) => void
  className?: string
  style?: React.CSSProperties
  placeholder?: string
  multiline?: boolean
  disabled?: boolean
  activationMode?: 'double-click' | 'click'
  editingClassName?: string
  onEditingChange?: (isEditing: boolean) => void
  label?: string
  control?: { id?: string; 'aria-describedby'?: string }
}

interface ToolbarButtonProps {
  label: string
  onPress: () => void
  children: React.ReactNode
}

function ToolbarButton({ label, onPress, children }: ToolbarButtonProps) {
  return (
    <UIAction
      buttonStyle="ghost"
      iconOnly
      size="sm"
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onClick={(event) => {
        event.stopPropagation()
        onPress()
      }}
    >
      {children}
    </UIAction>
  )
}

export function RichTextEditable({
  as = 'div',
  value,
  onCommit,
  className,
  style,
  placeholder,
  multiline = true,
  disabled: disabledProp = false,
  activationMode = 'double-click',
  editingClassName,
  onEditingChange,
  label,
  control,
}: RichTextEditableProps) {
  const readOnly = useReadOnly()
  const disabled = disabledProp || readOnly
  const portal = useVoucherPortal()
  const elementRef = React.useRef<HTMLElement>(null)
  const toolbarFrame = React.useRef<number | null>(null)
  const toolbarRef = React.useRef<HTMLDivElement>(null)
  const [linkOpen, setLinkOpen] = React.useState(false)
  const [linkURL, setLinkURL] = React.useState('')
  const linkRange = React.useRef<Range | null>(null)
  const linkOverlay = React.useRef<HTMLElement | null>(null)
  const pendingLink = React.useRef<string | null>(null)
  const [isEditing, setIsEditing] = React.useState(false)
  const [toolbarRect, setToolbarRect] = React.useState<{ left: number; top: number; below: boolean } | null>(
    null,
  )

  const safeValue = React.useMemo(() => sanitizeRichTextHtml(value, { multiline }), [multiline, value])

  const displayHtml = React.useMemo(() => {
    if (safeValue) return safeValue
    if (!placeholder) return multiline ? '<br>' : ''
    return sanitizeRichTextHtml(placeholder, { multiline })
  }, [multiline, placeholder, safeValue])
  // React compares this prop by identity. Keep it stable while the browser owns an active draft.
  const displayMarkup = React.useMemo(() => ({ __html: displayHtml }), [displayHtml])

  const selectAll = React.useCallback(() => {
    if (!elementRef.current) return
    const range = document.createRange()
    range.selectNodeContents(elementRef.current)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }, [])

  const syncToolbarPosition = React.useCallback(() => {
    if (!isEditing || !elementRef.current) {
      setToolbarRect(null)
      return
    }

    const rect = elementRef.current.getBoundingClientRect()
    const prefersBelow = rect.top < 72
    setToolbarRect({
      left: rect.left + rect.width / 2,
      top: prefersBelow ? rect.bottom + 8 : rect.top - 8,
      below: prefersBelow,
    })
  }, [isEditing])

  const stopEditing = React.useCallback(
    (nextEditing: boolean) => {
      setIsEditing(nextEditing)
      onEditingChange?.(nextEditing)
    },
    [onEditingChange],
  )

  const commit = React.useCallback(() => {
    if (!elementRef.current) return
    const nextValue = sanitizeRichTextHtml(elementRef.current.innerHTML, { multiline })
    if (nextValue !== safeValue) {
      onCommit(nextValue)
    }
    stopEditing(false)
  }, [multiline, onCommit, safeValue, stopEditing])

  const cancel = React.useCallback(() => {
    if (elementRef.current) {
      elementRef.current.innerHTML = safeValue || (multiline ? '<br>' : '')
    }
    stopEditing(false)
  }, [multiline, safeValue, stopEditing])

  const runCommand = React.useCallback(
    (command: string, commandValue?: string) => {
      if (!elementRef.current) return
      elementRef.current.focus()
      document.execCommand(command, false, commandValue)
      syncToolbarPosition()
    },
    [syncToolbarPosition],
  )

  const applyLink = React.useCallback(() => {
    const selection = window.getSelection()
    linkRange.current = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null
    setLinkURL('')
    setLinkOpen(true)
  }, [])
  React.useEffect(() => {
    if (linkOpen || !linkRange.current) return
    const finish = () => {
      if (linkOverlay.current?.isConnected || !linkRange.current) return
      linkOverlay.current = null
      const range = linkRange.current
      const href = pendingLink.current
      pendingLink.current = null
      linkRange.current = null
      observer.disconnect()
      requestAnimationFrame(() => {
        if (!range || !elementRef.current?.contains(range.commonAncestorContainer)) return
        elementRef.current.focus()
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
        if (href) {
          runCommand('createLink', href)
          commit()
        }
      })
    }
    const observer = new MutationObserver(finish)
    observer.observe(document.body, { childList: true, subtree: true })
    queueMicrotask(finish)
    return () => observer.disconnect()
  }, [linkOpen, runCommand, commit])

  const beginEditing = React.useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (disabled) return
      event.stopPropagation()
      stopEditing(true)
    },
    [disabled, stopEditing],
  )

  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      const target = event.target as HTMLElement
      if (target.closest('a')) {
        event.preventDefault()
      }

      if (isEditing) {
        event.stopPropagation()
        return
      }

      if (activationMode === 'click') {
        beginEditing(event)
      }
    },
    [activationMode, beginEditing, isEditing],
  )

  const handleDoubleClick = React.useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (activationMode === 'double-click') {
        beginEditing(event)
        return
      }
      event.stopPropagation()
    },
    [activationMode, beginEditing],
  )

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        cancel()
        return
      }

      const isMetaShortcut = (event.metaKey || event.ctrlKey) && !event.altKey
      if (isMetaShortcut) {
        const key = event.key.toLowerCase()
        if (key === 'b') {
          event.preventDefault()
          runCommand('bold')
          return
        }
        if (key === 'i') {
          event.preventDefault()
          runCommand('italic')
          return
        }
        if (key === 'u') {
          event.preventDefault()
          runCommand('underline')
          return
        }
        if (key === 'k') {
          event.preventDefault()
          applyLink()
        }
      }

      if (!multiline && event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        commit()
      }
    },
    [applyLink, cancel, commit, multiline, runCommand],
  )

  React.useEffect(() => {
    if (!isEditing || !elementRef.current) return

    elementRef.current.innerHTML = safeValue || (multiline ? '<br>' : '')
    elementRef.current.focus()
    toolbarFrame.current = window.requestAnimationFrame(() => {
      selectAll()
      syncToolbarPosition()
    })

    const updatePosition = () => syncToolbarPosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)

    return () => {
      if (toolbarFrame.current != null) {
        window.cancelAnimationFrame(toolbarFrame.current)
      }
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [isEditing, multiline, safeValue, selectAll, syncToolbarPosition])

  React.useEffect(() => {
    if (isEditing || !elementRef.current) return
    elementRef.current.innerHTML = displayHtml
  }, [displayHtml, isEditing])

  const showPlaceholder = !isEditing && !safeValue && Boolean(placeholder)

  const element = React.createElement(as, {
    ...control,
    ref: elementRef,
    className: cn(className, showPlaceholder && 'text-muted-foreground', isEditing && editingClassName),
    style,
    onClick: handleClick,
    onDoubleClick: handleDoubleClick,
    onBlur: isEditing
      ? (event: React.FocusEvent<HTMLElement>) => {
          if (toolbarRef.current?.contains(event.relatedTarget as Node | null)) return
          if (!linkOpen && !linkRange.current) commit()
        }
      : undefined,
    onKeyDown: isEditing
      ? handleKeyDown
      : (event: React.KeyboardEvent<HTMLElement>) => {
          if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault()
            event.stopPropagation()
            stopEditing(true)
          }
        },
    role: activationMode === 'click' ? 'textbox' : undefined,
    tabIndex: disabled ? undefined : 0,
    'aria-label': label,
    'aria-multiline': activationMode === 'click' ? multiline : undefined,
    'aria-readonly': disabled || undefined,
    'aria-disabled': disabled || undefined,
    contentEditable: isEditing ? true : undefined,
    suppressContentEditableWarning: true,
    dangerouslySetInnerHTML: displayMarkup,
    'data-inline-editing': isEditing ? 'true' : undefined,
  })

  const toolbar = (
    <UIStack
      ref={toolbarRef}
      direction="horizontal"
      gap="2xs"
      align="center"
      wrap={false}
      role="toolbar"
      aria-label="Text formatting"
      onBlur={(event) => {
        const next = event.relatedTarget as Node | null
        if (next && (toolbarRef.current?.contains(next) || elementRef.current?.contains(next))) return
        if (!linkOpen && !linkRange.current) commit()
      }}
    >
      <ToolbarButton label="Bold" onPress={() => runCommand('bold')}>
        <Bold className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton label="Italic" onPress={() => runCommand('italic')}>
        <Italic className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton label="Underline" onPress={() => runCommand('underline')}>
        <Underline className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton label="Add Link" onPress={applyLink}>
        <Link2 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton label="Clear Formatting" onPress={() => runCommand('removeFormat')}>
        <RemoveFormatting className="h-3.5 w-3.5" />
      </ToolbarButton>
    </UIStack>
  )

  return (
    <>
      {element}
      <ActionDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        title="Add link"
        description="Choose the destination for the selected text."
        strings={{ confirm: 'Add link' }}
        onAsyncConfirm={async () => {
          const href = linkURL.trim()
          if (!href) throw new Error('Enter a link destination.')
          const url = new URL(href, 'https://document.invalid')
          if (!['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol))
            throw new Error('Use an HTTP, email or telephone link.')
          pendingLink.current = href
        }}
      >
        <FormField label="Link destination">
          <Input
            ref={(element) => {
              if (element) linkOverlay.current = element.closest<HTMLElement>('[data-slot=dialog-content]')
            }}
            aria-label="Link destination"
            value={linkURL}
            onChange={(event) => setLinkURL(event.target.value)}
            placeholder="https://…"
          />
        </FormField>
      </ActionDialog>
      {isEditing && (activationMode === 'click' || toolbarRect) && typeof document !== 'undefined'
        ? activationMode === 'click'
          ? toolbar
          : createPortal(
              <Card
                surface="card"
                padding="sm"
                className="fixed z-[95]"
                style={{
                  // This intrinsic-width action strip has no responsive Card query layout.
                  containerType: 'normal',
                  width: 'max-content',
                  maxWidth: 'calc(100vw - 16px)',
                  left: toolbarRect?.left,
                  top: toolbarRect?.top,
                  transform: `translate(-50%, ${toolbarRect?.below ? '0' : '-100%'})`,
                }}
              >
                {toolbar}
              </Card>,
              portal ?? document.body,
            )
        : null}
    </>
  )
}

interface RichTextFieldProps {
  label?: string
  control?: { id?: string; 'aria-describedby'?: string }
  value: string
  onChange: (value: string) => void
  placeholder?: string
  multiline?: boolean
  rows?: number
  className?: string
  disabled?: boolean
}

export function RichTextField({
  label,
  control,
  value,
  onChange,
  placeholder,
  multiline = true,
  rows = 4,
  className,
  disabled = false,
}: RichTextFieldProps) {
  const { defaultScale = 'md' } = useDensityConfig()
  // This in-place editor preserves the voucher HTML contract. Geometry consumes
  // the public theme roles; standard text fields continue to use Textarea.
  return (
    <RichTextEditable
      as="div"
      label={label}
      control={control}
      value={value}
      onCommit={onChange}
      placeholder={placeholder}
      multiline={multiline}
      disabled={disabled}
      activationMode="click"
      className={cn(
        'nc-rich-text-field rounded-radius border border-input bg-transparent px-control font-sans text-foreground outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:text-base',
        defaultScale === 'sm' ? 'text-pxs' : 'text-sm',
        className,
      )}
      style={
        {
          '--nc-field-scale': defaultScale === 'sm' ? 8 / 9 : defaultScale === 'lg' ? 10 / 9 : 1,
          minHeight: multiline ? `${Math.max(rows, 3) * 1.5}rem` : undefined,
        } as React.CSSProperties
      }
    />
  )
}

export function RichTextPreview({ value, multiline = true }: { value: string; multiline?: boolean }) {
  const safeValue = React.useMemo(() => sanitizeRichTextHtml(value, { multiline }), [multiline, value])

  if (isRichTextEmpty(safeValue, { multiline })) return null

  return <span dangerouslySetInnerHTML={{ __html: safeValue }} />
}
