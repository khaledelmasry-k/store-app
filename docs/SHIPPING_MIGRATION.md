# Shipping architecture and legacy migration

The runtime source of truth for new shipping activity is:

1. `shippingProviders/{providerId}` — platform-owned provider definitions and safe service/capability metadata.
2. `storeShippingProviders/{storeId}_{providerId}` — merchant-owned enablement, selected services and controlled rate overrides.
3. `getShippingOptions` — the only checkout quote boundary. The browser renders normalized options returned by this callable and never calculates a shipping fee.
4. `createOrderShipment` — the only new shipment-creation boundary. It resolves the enabled provider adapter, prevents duplicate active shipments and stores the provider/tracking snapshot.
5. `shipments` plus the provider adapter — canonical tracking and status history.

## Inventory

| Legacy source | Current classification | Migration policy |
| --- | --- | --- |
| `shippingCompanies` | Compatibility data / historical shipment metadata | No new UI reads or writes it. Direct browser reads are platform-only. Existing `quoteShipment` and `assignShipment` callables are intentionally rejected so they cannot create a second runtime path. |
| `shipping` documents (`ShippingZone`) | Compatibility fallback | Kept for older stores/orders. `getShippingOptions` and `createOrder` may read it only when no enabled platform provider can quote. New provider checkouts do not read its fee. |
| `stores.shipping` (`StoreShipping`) | Compatibility fallback | Existing settings are retained for old stores and historical display. New provider configuration is written to `storeShippingProviders`; no operation writes both models for the same provider flow. |
| `ShippingProvider` / `ShippingCompany` types | Read compatibility | Kept so legacy records and old shipment snapshots can be displayed without a destructive migration. |
| `shippingCompanyId`, `shippingCompanyName`, `priceSnapshot` | Historical order/shipment fields | Read fallback only. New orders use `shippingProviderId`, `shippingProviderName`, `shippingSnapshot`, `providerId` and `providerName`. |
| `quoteShipment`, `assignShipment` | Dead legacy mutation paths | Export names remain for compatibility with old clients, but fail with a migration message and cannot mutate data. |
| `shippingCompanyReviews` | Historical compatibility | No new shipment flow depends on it. Provider reviews are not part of the canonical rate/shipment path. |

## Canonical model

Providers may declare multiple services. A service has a code/name, capability flags, supported zones, rate mode and ETA bounds. Manual adapters resolve fixed/threshold rates server-side; API adapters can later implement `getServices`, `getZones`, `getRates`, `getETA`, `createShipment`, `cancelShipment`, `trackShipment`, `requestPickup` and `createReturn` without changing checkout.

Merchant overrides are limited to enabled services, fixed/threshold rate settings, markup, package weight, COD/returns and ETA metadata. Credentials are never accepted in a browser payload or returned in a provider projection.

## Local migration plan

For a local legacy store only:

1. Map each `shippingCompanies` record to a `shippingProviders` record (`name`, `slug`, logo, active status, capabilities).
2. Map each `stores/{storeId}.shipping.providers` entry to a `storeShippingProviders/{storeId}_{providerId}` config (`enabled`, `fixedRate`, `freeShippingThreshold`, service code and readiness).
3. Map each active `shipping/{id}` zone to the provider service's supported zones/rate configuration. Preserve the original document for old-order reads until the store is verified on the new provider flow.
4. Do not rewrite historical orders or shipments. Display `shippingSnapshot` when present and fall back to legacy shipping fields when absent.

The migration is intentionally not a production mass-migration. Emulator QA data must never be uploaded to staging or production.
