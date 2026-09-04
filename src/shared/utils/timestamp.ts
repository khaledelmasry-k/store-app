export type TimestampLike =
  | { seconds?: number | string; nanoseconds?: number | string; _seconds?: number | string; _nanoseconds?: number | string; toMillis?: () => number; toDate?: () => Date }
  | string
  | number
  | Date
  | null
  | undefined

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

/**
 * Central timestamp helper — supports all shapes that appear in this codebase:
 * - Firestore Timestamp (toMillis / toDate)
 * - { seconds, nanoseconds } (client SDK)
 * - { _seconds, _nanoseconds } (Admin SDK JSON)
 * - ISO string (e.g. "2026-09-04T16:25:30.902Z" — stored for some orders)
 * - JS Date
 * - seconds as string
 * Returns millis or null if unparsable. Never throws and never uses `in` on primitives.
 */
export function timestampToMillis(value: TimestampLike): number | null {
  if (value == null) return null
  if (value instanceof Date) {
    const t = value.getTime()
    return Number.isFinite(t) ? t : null
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'string') {
    const t = Date.parse(value)
    return Number.isFinite(t) ? t : null
  }
  if (isObject(value)) {
    // Firestore Timestamp
    if (typeof (value as any).toMillis === 'function') {
      try {
        const m = (value as any).toMillis()
        return typeof m === 'number' && Number.isFinite(m) ? m : null
      } catch {
        return null
      }
    }
    if (typeof (value as any).toDate === 'function') {
      try {
        const d = (value as any).toDate()
        const t = d instanceof Date ? d.getTime() : Date.parse(String(d))
        return Number.isFinite(t) ? t : null
      } catch {
        return null
      }
    }
    const anyVal = value as any
    const secRaw = anyVal.seconds ?? anyVal._seconds ?? anyVal._sec ?? null
    if (secRaw != null) {
      const sec = typeof secRaw === 'number' ? secRaw : typeof secRaw === 'string' ? Number(secRaw) : NaN
      if (Number.isFinite(sec)) {
        const nanoRaw = anyVal.nanoseconds ?? anyVal._nanoseconds ?? anyVal.nanos ?? 0
        const nano = typeof nanoRaw === 'number' ? nanoRaw : typeof nanoRaw === 'string' ? Number(nanoRaw) : 0
        const extra = Number.isFinite(nano) ? Math.floor(nano / 1e6) : 0
        return sec * 1000 + extra
      }
    }
    // Fallback: try Date constructor for ISO-like objects
    try {
      const t = new Date(value as any).getTime()
      return Number.isFinite(t) ? t : null
    } catch {
      return null
    }
  }
  return null
}

export function timestampToDate(value: TimestampLike): Date | null {
  const m = timestampToMillis(value)
  return m == null ? null : new Date(m)
}

export function millisToDaysAgo(millis: number | null): number | null {
  if (millis == null) return null
  return Math.floor((Date.now() - millis) / 86400000)
}

export function isValidTimestamp(value: TimestampLike): boolean {
  return timestampToMillis(value) != null
}
