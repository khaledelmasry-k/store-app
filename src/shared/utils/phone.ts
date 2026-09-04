/**
 * Phone normalization — Egypt-first, generic fallback.
 * Ensures one customer per (storeId, phoneNormalized) instead of
 * fragmented duplicates like 010..., +2010..., 002010...
 */

export function normalizePhoneEG(input: string | null | undefined): string {
  if (!input) return ''
  let digits = String(input).replace(/\D/g, '')
  if (!digits) return ''
  // Handle international prefixes
  if (digits.startsWith('0020')) {
    digits = '0' + digits.slice(4)
  } else if (digits.startsWith('20') && digits.length >= 12) {
    // 20 + 10/11 digits → local
    const withoutCC = digits.slice(2)
    // If original was 2010... → 010...
    if (withoutCC.length === 10 && withoutCC.startsWith('1')) {
      digits = '0' + withoutCC
    } else if (withoutCC.length === 11 && withoutCC.startsWith('01')) {
      digits = withoutCC
    } else {
      digits = '0' + withoutCC
    }
  }
  // Strip leading zeros duplication
  digits = digits.replace(/^0+/, '0')
  return digits
}

export function isValidEGPhone(normalized: string): boolean {
  // Egyptian mobile: 01[0,1,2,5] + 8 digits = 11 total
  return /^01[0125][0-9]{8}$/.test(normalized)
}

export function formatPhoneDisplay(phone: string): string {
  const n = normalizePhoneEG(phone)
  if (isValidEGPhone(n)) return n.replace(/^(01\d)(\d{4})(\d{4})$/, '$1 $2 $3')
  return phone
}

export function phoneVariants(input: string): string[] {
  const normalized = normalizePhoneEG(input)
  if (!normalized) return []
  const variants = new Set<string>([normalized, String(input).trim()])
  const digits = normalized.replace(/\D/g, '')
  if (digits.startsWith('01')) {
    variants.add('+2' + digits)
    variants.add('2' + digits)
    variants.add('002' + digits)
  }
  return [...variants].filter(Boolean)
}
