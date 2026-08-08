export function isPhoneValid(phone: string): boolean {
  return /^01[0125][0-9]{8}$/.test(phone)
}

export function isEmailValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function isPositiveNumber(n: number): boolean {
  return typeof n === 'number' && Number.isFinite(n) && n > 0
}

export function generatePassword(len = 10): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export function generateToken(len = 32): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let out = ''
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

/** Short unique id for entities created client-side (variants, color options). */
export function uid(len = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export function csvEscape(value: unknown): string {
  const s = value == null ? '' : String(value)
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}
