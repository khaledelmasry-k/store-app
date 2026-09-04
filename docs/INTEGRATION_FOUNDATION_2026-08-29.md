# M&K Store — Integration Foundation + Bosta Shipping

**Implementation date:** 2026-08-29  
**Provider classification:** `IMPLEMENTED_NOT_LIVE_VERIFIED`

## Baseline test result

The pre-integration full emulator matrix initially completed its desktop phase with **67 passed, 6 failed, 1 skipped, and 40 not run**. The script is fail-fast and therefore did not continue into the remaining projects. The six failures were not hidden:

- An ambiguous theme-gallery selector, stale DOM clicks on responsive product cards, and an input-event compatibility issue were repaired in the test/UI harness.
- Status tracking, subscription activation, product upload, and variant storefront scenarios were rerun on clean fixtures. Five passed unchanged; the theme selection exposed a real persistence defect, which was repaired by saving the selected theme immediately.
- The final release gate is green: **256 passed, 1 intentionally skipped, 0 failed** across desktop, 390px, 360px, and 430px projects.

## Integration Foundation

The implementation adds a reusable provider registry, encrypted credential vault, durable Firestore outbox, creation guard, webhook log, and provider-neutral shipping orchestration. The same vault/event/webhook primitives can be reused by WhatsApp, Meta Conversions, payments, and future public integrations.

## Credential Vault

- Collection: `integrationCredentials`.
- AES-256-GCM authenticated encryption with a unique 96-bit IV for every write.
- Tenant/provider/type/key-version values are authenticated as AAD.
- The encryption master key is supplied through Firebase Secret Manager as `INTEGRATION_VAULT_KEY`.
- Emulator-only deterministic fallback exists inside the Functions emulator; production refuses to run without the secret.
- Stored envelope: algorithm, ciphertext, IV, auth tag, and key version.
- Stored metadata: `storeId`, `merchantId`, `provider`, `providerId`, `integrationType`, status, created/updated timestamps, validation timestamps/status.
- Rotation-ready: every credential replacement increments `keyVersion` and creates a new authenticated envelope.
- Raw secrets are never returned after saving. The frontend receives only redacted values such as `************8214`.
- Direct Firestore read/write is denied, including to the owning merchant; access is callable-only.

## Event / Outbox

Collection: `integrationEvents`.

Events include `eventId`, tenant/entity identity, a bounded payload snapshot, `createdAt`, `processingStatus`, attempts, last attempt, processed timestamp, and error information. Implemented producers include:

- `order.created`
- `order.confirmed` when the existing core state moves to `PROCESSING`
- `order.cancelled`
- `customer.created`
- `store.published`
- `shipment.created`
- `shipment.status_changed`
- `shipment.delivered`
- `shipment.returned`

The existing core does not have a literal `CONFIRMED` state. To avoid rebuilding or breaking the order state machine, `PROCESSING` is the confirmed/accepted operational state and emits `order.confirmed`.

## Shipping Settings

The existing merchant shipping screen now supports:

- `MANUAL`
- `AFTER_CONFIRMATION` — default
- `IMMEDIATELY_AFTER_CHECKOUT`
- One store-level default provider, enforced by a transaction and deterministic default pointer.
- Credential entry with masked saved state.
- Connection health: `NOT_CONFIGURED`, `CONFIGURED`, `CONNECTED`, `ERROR`, `EXPIRED`, `DISABLED`, plus validation outcomes such as `INVALID_CREDENTIALS` and `PROVIDER_UNAVAILABLE`.

## Automatic Shipment Creation

The Firestore outbox consumer claims an event, increments attempts, checks the store mode, resolves the single enabled default provider, and calls the common shipment service. A failed carrier call never deletes or cancels the M&K order. It records:

- `shippingCreationStatus = FAILED`
- `shippingCreationErrorCode`
- `shippingCreationErrorMessage`
- `shippingLastAttemptAt`
- `shippingRetryCount`

The order details UI shows the failure and a retry action.

## Provider Implemented

**Bosta** was selected because it already appears in project shipping data and has current official API/webhook documentation. The adapter uses a merchant-owned API key; no central M&K carrier account is assumed.

Official references:

- [Bosta API-key authentication and scopes](https://docs.bosta.co/docs/how-to/get-your-api-key/)
- [Create a Bosta delivery](https://docs.bosta.co/docs/how-to/create-your-first-delivery/)
- [Bosta shipment-status webhooks and status codes](https://docs.bosta.co/docs/how-to/get-delivery-status-via-webhook/)

## Provider API Functions

- `testConnection()` — performs a provider request; document existence never produces fake `CONNECTED`.
- `createShipment()` — calls `POST /api/v2/deliveries?apiVersion=1` with server-owned order/customer/COD/package data.
- `trackShipment()` — refreshes the stored provider state and sync timestamp.
- `cancelShipment()` — calls the provider cancel endpoint and is blocked after pickup/in-transit/final states.
- `parseWebhook()` and `verifyWebhookSignature()`.
- Bosta state-code mapping.

Rate and zone lookup remain platform-configured because no stable authenticated Bosta pricing contract was live-verified in this sprint.

## Carrier Account Flow

`M&K order → store credential vault → Bosta adapter → merchant's Bosta API key → external delivery → external shipment ID/tracking number → M&K shipment/order`

The emulator integration suite uses a separate HTTP carrier process and proves that Functions sends a real outbound HTTP request and persists the returned external identity. It is not evidence of a shipment in a real Bosta business account.

## Webhook Implementation

Firebase-compatible endpoint:

`POST /shippingWebhook/bosta`

Processing flow:

`parse → find one tenant shipment → decrypt that tenant's webhook key → constant-time Authorization comparison → deduplicate external event → canonical shipment/order transition → outbox event → webhook log`

Webhook logs contain identifiers and status metadata, not full customer payloads. Unknown shipments return 404, invalid authorization returns 401, duplicates return 200 without repeating business effects.

## Idempotency

- Deterministic guard: `storeId + orderId + providerId`.
- Deterministic shipment document for the creation attempt.
- Guard states and attempts are durable in `shipmentCreationGuards`.
- Provider receives an idempotency header and deterministic `businessReference`.
- Duplicate outbox events return the existing shipment.
- Webhook events are keyed by SHA-256 of provider + external event ID.
- Returned inventory uses the existing `stockRestored` flag and exact variant restoration; webhook logic does not maintain a second inventory counter.

An ambiguous network timeout after a provider accepts a request can only be guaranteed exactly-once if that provider enforces the supplied idempotency key/business reference. This must be validated with a live Bosta account.

## Status Mapping

Order and shipment states remain separate. Bosta codes are mapped to `CREATED`, `PICKED_UP`, `IN_TRANSIT`, `OUT_FOR_DELIVERY`, `DELIVERED`, `FAILED`, `RETURNED`, or `CANCELLED`. Only explicit business mappings affect the order:

- pickup/transit/out-for-delivery → order `SHIPPED`
- delivered → order `DELIVERED`
- returned → order `RETURNED` and canonical inventory restoration
- carrier cancellation does not arbitrarily cancel the commercial order

## Security Tests

The isolated suite verifies encrypted-at-rest storage, redaction, denied direct vault reads, cross-tenant credential denial, cross-tenant tracking denial, invalid webhook authorization, duplicate webhook behavior, and exact-once inventory restoration.

## Files Created

- `functions/src/integrations/vault.ts`
- `functions/src/integrations/outbox.ts`
- `functions/src/shipping/bosta.ts`
- `functions/src/shipping/service.ts`
- `functions/.secret.local.example`
- `e2e/integration-foundation.spec.ts`
- `docs/INTEGRATION_FOUNDATION_2026-08-29.md`

## Files Modified

- `functions/src/index.ts`
- `functions/src/shipping/types.ts`
- `functions/src/shipping/registry.ts`
- `firestore.rules`
- `firestore.indexes.json`
- `src/merchant/pages/Shipping.tsx`
- `src/merchant/pages/Themes.tsx`
- `src/merchant/components/OrderDetailsWorkspace.tsx`
- `src/shared/services/auth.ts`
- `src/shared/types/index.ts`
- `src/shared/components/ui/Input.tsx`
- `e2e/customer-flow.spec.ts`
- `e2e/emulator.spec.ts`
- `e2e/products.spec.ts`
- `playwright.emulator.config.ts`
- `.gitignore`

## Firestore Collections / Indexes

New server-owned collections:

- `integrationCredentials`
- `storeIntegrationSettings`
- `storeShippingDefaults`
- `integrationEvents`
- `shipmentCreationGuards`
- `integrationWebhookLogs`

Indexes were added for credential lookup, default provider resolution, and webhook shipment resolution by external ID/tracking number.

## Firebase Functions Added

- `saveIntegrationCredentials`
- `saveShippingAutomationSettings`
- `refreshShipmentTracking`
- `cancelExternalShipment`
- `processIntegrationEvent`
- `shippingWebhook`

`createOrderShipment`, `testShippingConnection`, order creation/status changes, and store publication were extended to use the foundation.

## Tests Passed / Failed

Focused integration matrix: **6 passed, 0 failed**. These six serial scenarios cover 20+ assertions across credential encryption/redaction, tenant isolation, Manual, After Confirmation, Immediately After Checkout, missing default, disabled provider, invalid credentials, real outbound create request, duplicate order event, retry, tracking, cancellation, valid/invalid/duplicate/unknown webhooks, delivered mapping, returned mapping, and exact-once inventory restoration.

Final emulator release gate after repairs:

- Desktop: **119 passed, 1 intentionally skipped, 0 failed** (120 selected).
- Mobile 390px: **107 passed, 0 failed**.
- Mobile 360px: **15 passed, 0 failed**.
- Mobile 430px: **15 passed, 0 failed**.
- Aggregate: **256 passed, 1 intentionally skipped, 0 failed**.

The one skipped case is explicitly a phone-only registration-layout assertion and is skipped on desktop by design. The final desktop run and the final mobile runs used emulator resets between browser projects. Focused reruns also verified the repaired customer lifecycle (**10/10**), theme/publish/product flow (**1/1**), responsive shipping (**1/1**), and responsive variant catalog (**1/1**).

## Live Verification Status

`IMPLEMENTED_NOT_LIVE_VERIFIED`

To reach `VERIFIED_LIVE`, a merchant must provide a real Bosta API key and webhook Authorization key, configure the deployed webhook URL in the Bosta dashboard (or permit it in delivery creation), and execute the complete customer-order → carrier account → tracking → carrier webhook scenario. No real credential was available, so no claim is made that a delivery appeared in a live Bosta account.

## Deployment prerequisites

1. Generate a random 32-byte Base64 key and store it as the Firebase Functions secret `INTEGRATION_VAULT_KEY`.
2. Deploy Functions, Firestore rules, and indexes.
3. Configure the production Functions base URL if it differs from the standard Firebase URL.
4. In the platform provider screen, ensure Bosta uses slug `bosta`, integration type `api`, and merchant credential mode.
5. Each merchant saves their own Bosta API key and a unique webhook Authorization key, tests the connection, selects Bosta as default, and chooses the automation mode.
