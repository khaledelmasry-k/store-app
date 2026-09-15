/** Provider-neutral error contract used by shipping core and all adapters. */
export class ShippingProviderError extends Error {
  constructor(
    public readonly code: 'CONFIGURATION_ERROR' | 'INVALID_CREDENTIALS' | 'PROVIDER_UNAVAILABLE' | 'PROVIDER_REJECTED' | 'MAPPING_MISSING' | 'NOT_COVERED' | 'NO_PROVIDER' | 'SHIPMENT_CREATION_FAILED',
    message: string,
    public readonly retryable: boolean,
    public readonly httpStatus?: number,
  ) { super(message) }
}
