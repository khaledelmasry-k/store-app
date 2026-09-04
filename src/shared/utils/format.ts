export function formatCurrency(amount: number, currency = 'EGP'): string {
  return new Intl.NumberFormat('ar-EG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount || 0)
}

/**
 * Price in Egyptian Arabic, number-first as required for pricing cards:
 * "299 ج.م" / "1,499 ج.م" (Western digits + thousands separator, matching the
 * card's other numeric labels; the Arabic "ج.م" follows the number).
 */
export function formatPriceEgp(amount: number): string {
  const n = new Intl.NumberFormat('en-US').format(amount || 0)
  return `${n} ج.م`
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value || 0)
}

export type DateLike = { seconds?: number; nanoseconds?: number; _seconds?: number; _nanoseconds?: number; toDate?: () => Date; toMillis?: () => number } | string | number | Date | undefined | null

/** Normalize Firestore and browser date representations without unsafe `in` checks. */
export function normalizeDate(input: DateLike): Date | null {
  if (input == null) return null
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input
  if (typeof input === 'number' || typeof input === 'string') {
    const date = new Date(input)
    return Number.isNaN(date.getTime()) ? null : date
  }
  if (typeof input !== 'object') return null
  try {
    if (typeof input.toDate === 'function') {
      const date = input.toDate(); return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null
    }
    if (typeof input.toMillis === 'function') {
      const date = new Date(input.toMillis()); return Number.isNaN(date.getTime()) ? null : date
    }
    const seconds = typeof input.seconds === 'number' ? input.seconds : input._seconds
    if (typeof seconds === 'number') {
      const date = new Date(seconds * 1000); return Number.isNaN(date.getTime()) ? null : date
    }
  } catch { return null }
  return null
}

export function formatArabicDateTime(input: DateLike): string {
  const d = normalizeDate(input)
  if (!d) return '—'
  return d.toLocaleString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function formatDate(input: DateLike): string {
  const d = normalizeDate(input)
  if (!d) return '—'
  return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatDateTime(input: DateLike): string {
  return formatArabicDateTime(input)
}

export function timeAgo(input: { seconds: number; nanoseconds: number } | string | number | Date | undefined | null): string {
  const d = normalizeDate(input)
  if (!d) return '—'
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'الآن'
  if (mins < 60) return `${mins} د`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} س`
  const days = Math.floor(hours / 24)
  return `${days} ي`
}

export function todayKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function initials(name: string): string {
  return (name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
}

export function downloadFile(filename: string, content: string, mime = 'text/plain'): void {
  const blob = new Blob([content], { type: mime + ';charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function truncate(str: string, n = 40): string {
  if (!str) return ''
  return str.length > n ? str.slice(0, n - 1) + '…' : str
}

type StockLike = { stock?: number; lowStockThreshold?: number }

export function stockTone(p: StockLike): 'red' | 'amber' | 'green' {
  const stock = p.stock ?? 0
  if (stock === 0) return 'red'
  if (stock <= (p.lowStockThreshold ?? 5)) return 'amber'
  return 'green'
}

type OrderLike = { status?: string; totalPrice: number }

export function deliveredRevenue(orders: OrderLike[]): number {
  return orders.filter((o) => o.status === 'DELIVERED').reduce((s, o) => s + (o.totalPrice || 0), 0)
}
