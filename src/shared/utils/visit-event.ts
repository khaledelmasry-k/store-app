/**
 * Stable for one browser document, including component re-renders/remounts,
 * but new after a genuine reload because `performance.timeOrigin` changes.
 * The server owns deduplication; sessionStorage only shares the identifier
 * between components that observe the same navigation.
 */
export function visitEventId(scope: string): string {
  const navigationId = Math.round(performance.timeOrigin).toString(36)
  const key = `mk_visit_event_${navigationId}_${scope}`
  const existing = sessionStorage.getItem(key)
  if (existing) return existing
  const random = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  const value = `${navigationId}-${random}`
  sessionStorage.setItem(key, value)
  return value
}
