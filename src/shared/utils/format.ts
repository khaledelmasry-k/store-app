export function formatCurrency(amount: number, currency = 'EGP'): string {
  return new Intl.NumberFormat('ar-EG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount || 0)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value || 0)
}

export function formatDate(input: { seconds: number; nanoseconds: number } | string | number | Date | undefined | null): string {
  if (!input) return '—'
  const d = typeof input === 'object' && 'seconds' in input
    ? new Date(input.seconds * 1000)
    : new Date(input as string | number | Date)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatDateTime(input: { seconds: number; nanoseconds: number } | string | number | Date | undefined | null): string {
  if (!input) return '—'
  const d = typeof input === 'object' && 'seconds' in input
    ? new Date(input.seconds * 1000)
    : new Date(input as string | number | Date)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function timeAgo(input: { seconds: number; nanoseconds: number } | string | number | Date | undefined | null): string {
  if (!input) return '—'
  const d = typeof input === 'object' && 'seconds' in input
    ? new Date(input.seconds * 1000)
    : new Date(input as string | number | Date)
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
