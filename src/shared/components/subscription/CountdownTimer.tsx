import { FunctionalComponent } from 'preact'
import { useEffect, useMemo, useState } from 'preact/hooks'

type TimestampLike = { seconds?: number; _seconds?: number; toMillis?: () => number; toDate?: () => Date } | Date | string | number | null | undefined

function toMillis(value: TimestampLike): number | null {
  if (value == null) return null
  if (typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value === 'object' && 'seconds' in value && typeof value.seconds === 'number') return value.seconds * 1000
  // Admin SDK/callable serialization may expose Firestore timestamps using
  // underscored fields. Accept both wire shapes without deriving a new trial.
  if (typeof value === 'object' && '_seconds' in value && typeof value._seconds === 'number') return value._seconds * 1000
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') return value.toDate().getTime()
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  const parsed = typeof value === 'string' ? Date.parse(value) : NaN
  return Number.isFinite(parsed) ? parsed : null
}

export function countdownParts(endsAt: TimestampLike, now = Date.now()) {
  const end = toMillis(endsAt)
  if (end == null) return null
  const remaining = end - now
  if (remaining <= 0) return { expired: true, days: 0, hours: 0, minutes: 0, totalMinutes: 0 }
  const totalMinutes = Math.max(1, Math.ceil(remaining / 60000))
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  return { expired: false, days, hours, minutes, totalMinutes }
}

export function formatCountdown(parts: ReturnType<typeof countdownParts>) {
  if (!parts || parts.expired) return ''
  const values: string[] = []
  if (parts.days > 0) values.push(`${parts.days} يوم`)
  if (parts.hours > 0 || parts.days > 0) values.push(`${parts.hours} ساعة`)
  if (parts.minutes > 0 || values.length === 0) values.push(`${parts.minutes} دقيقة`)
  return values.join(' و')
}

export interface CountdownTimerProps {
  endsAt: TimestampLike
  label?: string
  className?: string
  warningBelowMinutes?: number
  onExpire?: () => void
}

/** Shared, display-only countdown. Server-provided endsAt remains authoritative. */
export const CountdownTimer: FunctionalComponent<CountdownTimerProps> = ({ endsAt, label = 'متبقي', className = '', warningBelowMinutes = 1440, onExpire }) => {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(tick)
  }, [])
  const parts = useMemo(() => countdownParts(endsAt, now), [endsAt, now])
  useEffect(() => { if (parts?.expired) onExpire?.() }, [parts?.expired, onExpire])
  if (!parts) return null
  if (parts.expired) return <span className={`${className} countdown-timer is-expired`.trim()}>انتهت الفترة التجريبية</span>
  return <span className={`${className} countdown-timer${parts.totalMinutes < warningBelowMinutes ? ' is-warning' : ''}`.trim()} aria-live="polite"><span>{label}: </span><strong>{formatCountdown(parts)}</strong></span>
}

export default CountdownTimer
