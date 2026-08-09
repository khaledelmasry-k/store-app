/**
 * Customer segments — single source of truth.
 *
 * Stored values are normalized internal enums (`new | repeat | vip | inactive`),
 * NEVER localized display text. The UI translates via SEGMENT_LABELS. Legacy
 * rows that unfortunately stored Arabic labels are normalized on read with
 * normalizeSegment().
 */

export const CUSTOMER_SEGMENTS = ['new', 'repeat', 'vip', 'inactive'] as const
export type CustomerSegment = (typeof CUSTOMER_SEGMENTS)[number]

export const SEGMENT_LABELS: Record<CustomerSegment, string> = {
  new: 'جديد',
  repeat: 'متكرر',
  vip: 'VIP',
  inactive: 'مهمل',
}

/** Legacy Arabic labels that were stored before normalization existed. */
const LEGACY_ALIASES: Record<string, CustomerSegment> = {
  'جديد': 'new',
  'متكرر': 'repeat',
  'مكرر': 'repeat',
  'VIP': 'vip',
  'vip': 'vip',
  'مهمل': 'inactive',
  'نشط': 'repeat',
}

/** Normalizes any stored segment value (enum or legacy Arabic) to an enum. */
export function normalizeSegment(value: string | null | undefined): CustomerSegment | null {
  if (!value) return null
  const direct = CUSTOMER_SEGMENTS.find((s) => s === value)
  if (direct) return direct
  return LEGACY_ALIASES[value] || null
}

/** Arabic label for a stored value. Unknown/legacy values are cleaned up. */
export function segmentLabel(value: string | null | undefined): string {
  const s = normalizeSegment(value)
  return s ? SEGMENT_LABELS[s] : ''
}

/** Select options for merchant edit forms (value = normalized enum). */
export const SEGMENT_OPTIONS: { value: string; label: string }[] = CUSTOMER_SEGMENTS.map((s) => ({ value: s, label: SEGMENT_LABELS[s] }))