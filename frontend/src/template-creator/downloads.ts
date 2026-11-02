export function downloadJSON(value: unknown, name: string) {
  downloadText(JSON.stringify(value, null, 2), `${name}.json`, 'application/json')
}
export function downloadText(value: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([value], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
