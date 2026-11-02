/** Portable presentation grammar shared by the PHP binding and JS presentation adapters. */
export function formatPresentationStyle(property: string, value: string | number, unit = ''): string {
  const raw = (typeof value === 'number' || /^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value)) ? `${value}${unit}` : String(value)
  const length = (part: string, negative = false) => {
    if (part === '0') return true
    const match = /^(-?(?:\d+(?:\.\d+)?|\.\d+))(px|mm|pt|rem|%)$/.exec(part)
    return !!match && Number(match[1]) <= 1000 && Number(match[1]) >= (negative ? -1000 : 0)
  }
  let valid = false
  if (['color','background-color'].includes(property)) valid = /^(#[a-f\d]{3}(?:[a-f\d]{3})?|transparent|currentColor)$/i.test(raw)
  else if (property === 'text-align') valid = ['left','right','center','justify'].includes(raw)
  else if (property === 'font-weight') valid = /^(normal|bold|bolder|lighter|[1-9]00)$/.test(raw)
  else if (property === 'line-height') valid = raw === 'normal' || (/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(raw) && Number(raw) <= 1000) || length(raw)
  else {
    const parts = raw.trim().split(/\s+/)
    valid = parts.length <= (['margin','padding','border-radius'].includes(property) ? 4 : 1) && parts.every(part => length(part, property.startsWith('margin')) || (part === 'auto' && (property.startsWith('margin') || ['width','height'].includes(property))))
  }
  if (!valid) throw new Error(`Unsupported typed CSS value for ${property}.`)
  return raw
}
