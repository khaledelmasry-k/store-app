/**
 * Wasla's API uses a UUID internally, while the merchant and customer-facing
 * barcode/reference is WS + the UUID prefix + EG. Never expose that internal
 * UUID as a tracking code in the dashboard.
 */
export function publicShipmentTrackingCode(provider: unknown, value: unknown): string | null {
  if (String(provider || '').trim().toLowerCase() !== 'wasla') return null
  const text = String(value || '').trim()
  if (!text) return null
  if (/^WS[0-9a-f]{8}EG$/i.test(text)) return text
  const prefix = text.match(/^([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)?.[1]
  return prefix ? `WS${prefix.toLowerCase()}EG` : null
}
