// Small color helpers used to derive CSS color stops from a single hex value.

function normalizeHex(hex: string): string {
  const h = (hex || '').replace('#', '').trim()
  if (h.length === 3) return h.split('').map((c) => c + c).join('')
  return h.length === 6 ? h : '6366f1'
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const num = parseInt(normalizeHex(hex), 16)
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
}

function clamp(n: number): number {
  return Math.max(0, Math.min(255, n))
}

export function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = parseHex(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Lighten (+) or darken (−) a hex color by a percentage (-100..100). */
export function shadeHex(hex: string, percent: number): string {
  const { r, g, b } = parseHex(hex)
  const amt = Math.round((255 * percent) / 100)
  const toHex = (v: number) => clamp(v + amt).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/** White or near-black text color that reads well on the given background. */
export function contrastFor(hex: string): string {
  const { r, g, b } = parseHex(hex)
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminance > 150 ? '#0f172a' : '#ffffff'
}
