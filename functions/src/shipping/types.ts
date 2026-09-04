export type ShippingIntegrationType = 'api' | 'manual'
export type ShippingCredentialMode = 'platform' | 'merchant' | 'hybrid'

export type CanonicalShipmentStatus =
  | 'CREATED'
  | 'READY_FOR_PICKUP'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'FAILED'
  | 'RETURNING'
  | 'RETURNED'
  | 'CANCELLED'

export interface ShippingAdapterContext {
  provider: Record<string, unknown>
  config?: Record<string, unknown> | null
  credentials?: Record<string, unknown> | null
}

export interface ShippingProviderAdapter {
  readonly slug: string
  readonly capabilities: string[]
  testConnection(context: ShippingAdapterContext): Promise<{ ok: boolean; message: string; account?: string | null }>
  getServices?(context: ShippingAdapterContext, input?: Record<string, unknown>): Promise<Array<Record<string, unknown>>>
  getZones?(context: ShippingAdapterContext, input?: Record<string, unknown>): Promise<Array<Record<string, unknown>>>
  getRates?(context: ShippingAdapterContext, input: Record<string, unknown>): Promise<Array<Record<string, unknown>>>
  getLocations?(context: ShippingAdapterContext): Promise<Array<Record<string, unknown>>>
  getETA?(context: ShippingAdapterContext, input: Record<string, unknown>): Promise<Record<string, unknown> | null>
  createShipment?(context: ShippingAdapterContext, input: Record<string, unknown>): Promise<Record<string, unknown>>
  cancelShipment?(context: ShippingAdapterContext, input: Record<string, unknown>): Promise<void>
  trackShipment?(context: ShippingAdapterContext, input: Record<string, unknown>): Promise<Record<string, unknown>>
  getShipmentDocument?(context: ShippingAdapterContext, input: Record<string, unknown>): Promise<{ contentBase64: string; contentType: 'application/pdf'; fileName: string }>
  parseWebhook?(payload: unknown, headers?: Record<string, string | string[] | undefined>): Record<string, unknown>
  verifyWebhookSignature?(payload: unknown, headers: Record<string, string | string[] | undefined>, credentials: Record<string, unknown>): boolean
  mapStatus?(externalStatus: string): CanonicalShipmentStatus
}
