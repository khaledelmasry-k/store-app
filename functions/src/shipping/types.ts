export type ShippingIntegrationType = 'api' | 'manual'
export type ShippingCredentialMode = 'platform' | 'merchant' | 'hybrid'
export type ShippingCapability = 'getRates' | 'createShipment' | 'trackShipment' | 'cancelShipment' | 'getDocument' | 'webhook' | 'locations'

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

export interface ShippingProviderConfigWrite {
  /** New neutral storage location: storeShippingProviders.providerConfig[slug]. */
  providerConfig: Record<string, unknown>
  /** Compatibility mirror for existing screens/documents. Never required by core. */
  legacyConfig?: Record<string, unknown>
}

export interface ShippingProviderAdapter {
  readonly slug: string
  readonly capabilities: readonly ShippingCapability[]
  readonly requiresMerchantCredentials?: boolean
  /** Credential validation belongs to the provider contract, never the vault. */
  sanitizeCredentials?(input: unknown): Record<string, string>
  /** Reads namespaced config first, with provider-owned legacy compatibility. */
  readConfig?(config: Record<string, unknown> | null | undefined): Record<string, unknown>
  /** Produces the namespaced provider config and an optional legacy compatibility mirror. */
  prepareConfig?(input: Record<string, unknown>): ShippingProviderConfigWrite
  /** Provider-owned setup requirements, exposed to generic merchant surfaces. */
  getSetupStatus?(context: ShippingAdapterContext): { complete: boolean; requirements: string[]; message?: string }
  /** Provider-owned fallback for legacy tracking identities. */
  resolveTrackingNumber?(input: { providerShipmentId?: unknown; trackingNumber?: unknown }): string | null
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
