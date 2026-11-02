export interface FontEntry {
  name: string
  googleId: string
  category: 'sans' | 'serif' | 'mono' | 'display'
  weights: number[]
  fallback: string
}

export const fontRegistry: FontEntry[] = [
  // Sans
  { name: 'Inter', googleId: 'Inter', category: 'sans', weights: [300, 400, 500, 600, 700], fallback: 'system-ui, sans-serif' },
  { name: 'Open Sans', googleId: 'Open+Sans', category: 'sans', weights: [300, 400, 500, 600, 700], fallback: 'sans-serif' },
  { name: 'Lato', googleId: 'Lato', category: 'sans', weights: [300, 400, 700], fallback: 'sans-serif' },
  { name: 'Nunito', googleId: 'Nunito', category: 'sans', weights: [300, 400, 500, 600, 700], fallback: 'sans-serif' },
  { name: 'DM Sans', googleId: 'DM+Sans', category: 'sans', weights: [400, 500, 600, 700], fallback: 'sans-serif' },
  { name: 'Plus Jakarta Sans', googleId: 'Plus+Jakarta+Sans', category: 'sans', weights: [400, 500, 600, 700], fallback: 'sans-serif' },
  // Serif
  { name: 'Merriweather', googleId: 'Merriweather', category: 'serif', weights: [300, 400, 700], fallback: 'Georgia, serif' },
  { name: 'Playfair Display', googleId: 'Playfair+Display', category: 'serif', weights: [400, 500, 600, 700], fallback: 'Georgia, serif' },
  { name: 'Lora', googleId: 'Lora', category: 'serif', weights: [400, 500, 600, 700], fallback: 'Georgia, serif' },
  { name: 'Source Serif 4', googleId: 'Source+Serif+4', category: 'serif', weights: [300, 400, 600, 700], fallback: 'Georgia, serif' },
  // Mono
  { name: 'JetBrains Mono', googleId: 'JetBrains+Mono', category: 'mono', weights: [400, 500, 700], fallback: 'monospace' },
  { name: 'Fira Code', googleId: 'Fira+Code', category: 'mono', weights: [400, 500, 700], fallback: 'monospace' },
  // Display
  { name: 'Outfit', googleId: 'Outfit', category: 'display', weights: [300, 400, 500, 600, 700], fallback: 'sans-serif' },
  { name: 'Space Grotesk', googleId: 'Space+Grotesk', category: 'display', weights: [300, 400, 500, 600, 700], fallback: 'sans-serif' },
  { name: 'Bebas Neue', googleId: 'Bebas+Neue', category: 'display', weights: [400], fallback: 'sans-serif' },
]

const loadedFonts = new Set<string>()

export function loadFont(fontName: string): void {
  if (fontName === 'Inter' || loadedFonts.has(fontName)) return

  const entry = fontRegistry.find((f) => f.name === fontName)
  if (!entry) return

  const weights = entry.weights.join(';')
  const url = `https://fonts.googleapis.com/css2?family=${entry.googleId}:wght@${weights}&display=swap`

  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = url
  link.dataset.font = fontName
  document.head.appendChild(link)
  loadedFonts.add(fontName)
}

export function getFontFamily(fontName: string): string {
  const entry = fontRegistry.find((f) => f.name === fontName)
  if (!entry) return `${fontName}, system-ui, sans-serif`
  return `"${fontName}", ${entry.fallback}`
}

export function getFontsByCategory(category: FontEntry['category']): FontEntry[] {
  return fontRegistry.filter((f) => f.category === category)
}
