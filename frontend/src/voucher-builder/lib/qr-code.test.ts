import { describe, expect, it } from 'vitest'
import { renderQrCodeSvg } from './qr-code'

describe('renderQrCodeSvg', () => {
  it('returns an svg payload for non-empty values', () => {
    const svg = renderQrCodeSvg({
      value: 'https://example.com/portfolio',
      size: 128,
      foreground: '#000000',
      background: '#ffffff',
      errorCorrectionLevel: 'H',
    })

    expect(svg).toContain('<svg')
    expect(svg).toContain('width="128"')
    expect(svg).toContain('fill="#000000"')
    expect(svg).toContain('<path d="')
  })

  it('returns an empty string for blank values', () => {
    expect(renderQrCodeSvg({ value: '   ' })).toBe('')
  })
})
