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

function toHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const h = (v: number) => clamp(Math.round(v)).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

export function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = parseHex(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Lighten (+) or darken (−) a hex color by a percentage (-100..100). */
export function shadeHex(hex: string, percent: number): string {
  const { r, g, b } = parseHex(hex)
  const amt = Math.round((255 * percent) / 100)
  return toHex({ r: r + amt, g: g + amt, b: b + amt })
}

/** WCAG 2.1 relative luminance. */
function luminance(hex: string): number {
  const { r, g, b } = parseHex(hex)
  const channel = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG 2.1 contrast ratio between two colors, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Blend two colors; t=0 returns `from`, t=1 returns `to`. */
function mix(from: string, to: string, t: number): string {
  const a = parseHex(from)
  const b = parseHex(to)
  return toHex({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  })
}

/**
 * White or near-black text color that reads well on the given background.
 *
 * This used to compare a weighted channel average against a fixed threshold of
 * 150, which is not the WCAG formula and picked wrong on mid-luminance brand
 * colors: a merchant green of #16a34a scored 126 and so got white text at
 * 3.30:1 — a contrast failure on every primary button in that store — when
 * near-black on the same green gives 5.42:1. Measure both and keep the winner.
 */
export function contrastFor(hex: string): string {
  return contrastRatio('#ffffff', hex) >= contrastRatio('#0f172a', hex) ? '#ffffff' : '#0f172a'
}

/**
 * A version of `brand` that reaches `target` contrast against `background`,
 * for brand-colored *text* rather than brand-colored fills.
 *
 * A merchant picks one color and we use it both ways. As a fill it is fine —
 * `contrastFor` picks readable text to sit on it — but as text on the page it
 * has to clear 4.5:1 by itself, and a mid-luminance brand color does not:
 * #16a34a on the storefront's near-white page is 3.30:1. Darken (on a light
 * background) or lighten (on a dark one) toward the surface's far end until it
 * clears, keeping the hue so the store still looks like its own brand.
 */
export function readableOn(brand: string, background: string, target = 4.5): string {
  return readableOnAll(brand, [background], target)
}

/**
 * The same, for a color that has to read on more than one surface.
 *
 * Brand-colored text does not land on just the page: the stock pill puts it
 * on `--primary-soft`, the brand's own translucent tint, which sits closer to
 * the text than the page does and so is the harder surface of the two. Ink
 * picked for the page alone measured 2.88:1 there. Clear every surface.
 */
export function readableOnAll(brand: string, backgrounds: string[], target = 4.5): string {
  const clears = (color: string) => backgrounds.every((bg) => contrastRatio(color, bg) >= target)
  if (clears(brand)) return brand
  // Every surface in one set is light or all of them dark, so the direction
  // is the same for all; take it from the first.
  const toward = luminance(backgrounds[0]) > 0.5 ? '#000000' : '#ffffff'
  // 5% steps: fine enough that the result stays visibly on-brand, coarse
  // enough to settle in at most twenty iterations.
  for (let t = 0.05; t <= 1; t += 0.05) {
    const candidate = mix(brand, toward, t)
    if (clears(candidate)) return candidate
  }
  return toward
}

/** The opaque color a translucent `hex` at `alpha` resolves to over `backdrop`. */
export function overlay(hex: string, alpha: number, backdrop: string): string {
  const f = parseHex(hex)
  const b = parseHex(backdrop)
  return toHex({
    r: f.r * alpha + b.r * (1 - alpha),
    g: f.g * alpha + b.g * (1 - alpha),
    b: f.b * alpha + b.b * (1 - alpha),
  })
}
