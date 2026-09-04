# M&K Store — Production Readiness + Bosta Live Verification

**Prepared:** 2026-08-29  
**Firebase project:** `mk-store-app`  
**Live classification:** `IMPLEMENTED_NOT_LIVE_VERIFIED`

No API key, webhook Authorization key, vault key, or decrypted credential is included in this report.

## Deployment status

**BLOCKED — no deployment was performed in this phase.** The production Firebase project exists and its current Functions use Node.js 22 in `us-central1` (Storage event functions currently follow the bucket in `us-east1`). Firebase Hosting exists at `https://mk-store-app.web.app`.

The live project is not yet running this repository's complete integration release:

- `INTEGRATION_VAULT_KEY` is absent from Firebase Secret Manager.
- `shippingWebhook`, `saveIntegrationCredentials`, `refreshShipmentTracking`, `downloadShipmentDocument`, `cancelExternalShipment`, and `processIntegrationEvent` are present locally but absent from the current deployed function inventory.
- The deployed Firestore index inventory does not yet contain both local shipment lookup indexes (`provider + externalShipmentId` and `provider + trackingNumber`) or the complete local default-provider index.
- The standard candidate Webhook URL returned 404 because the Webhook function is not deployed yet.

The guarded production deploy now stops before mutation when the Secret is absent, the production environment points at an emulator, or any build/integration/full-suite gate fails.

## Production endpoints

- Hosting: `https://mk-store-app.web.app`
- Functions base (`us-central1`): `https://us-central1-mk-store-app.cloudfunctions.net`
- Webhook after successful deployment: `POST https://us-central1-mk-store-app.cloudfunctions.net/shippingWebhook/bosta`

The Webhook URL contains no credential. Each merchant's distinct Authorization value is sent in the HTTP `Authorization` header and stored only in the encrypted credential vault.

## Vault and secret readiness

- Production now requires canonical Base64 that decodes to exactly 32 bytes. Invalid Base64, wrong length, or a missing value causes vault operations to fail closed.
- The deterministic fallback is reachable only in the Firebase Functions emulator.
- `scripts/set-integration-vault-secret.mjs` generates 32 cryptographically secure random bytes in memory, Base64-encodes them, and streams them directly to Firebase CLI stdin. It never writes or prints the key.
- Intended production command:

  `FIREBASE_PRODUCTION_PROJECT=mk-store-app CONFIRM_PRODUCTION_SECRET=YES npm run secrets:integration-vault:production`

- Secret bindings in source: `saveIntegrationCredentials`, `testShippingConnection`, `createOrderShipment`, `refreshShipmentTracking`, `downloadShipmentDocument`, `cancelExternalShipment`, `processIntegrationEvent`, and `shippingWebhook`.
- Cloud binding verification remains **pending deployment**, because the Secret and the new release do not exist in production yet.

## Firebase safety review

- Project aliases: `default` and `production` both resolve to `mk-store-app`; no staging alias is fabricated.
- Shipping Functions have an explicit `us-central1` region.
- Production URL generation rejects HTTP, localhost, and `127.0.0.1`; emulator URLs are generated only while `FUNCTIONS_EMULATOR=true`.
- Firestore rules deny browser access to credential vault, outbox, creation guards, defaults, and webhook logs. Shipment reads remain tenant scoped.
- Local indexes cover provider defaults, credential lookup, and webhook lookup by external delivery ID or tracking number. They still require deployment.
- `shippingWebhook` is POST-only with `cors: false`; authentication is a constant-time comparison of the merchant-owned Header value after resolving the shipment tenant.
- Frontend App Check support is ready through an optional reCAPTCHA Enterprise site key. Enforcement is intentionally off until the production web app is registered and valid-request metrics are reviewed, to avoid blocking legitimate traffic.

## Bosta production contract

- Provider slug: `bosta`
- Integration type: `api`
- Credential mode: `merchant` (merchant-owned); the server rejects a Bosta provider saved with another mode.
- No central M&K Bosta API key is accepted or referenced.
- Saving Bosta credentials now requires both an API key and a separate Webhook Authorization key. Raw values are never returned after save.
- A connection becomes `CONNECTED` only after Bosta responds successfully. A 401/403 maps to `INVALID_CREDENTIALS`.
- Provider errors are sanitized before they reach Firestore or the UI.

## Merchant live-verification flow

The Shipping screen now shows a Bosta-specific readiness checklist, the deployed Webhook URL, and progress for credentials, real connection validation, default-provider selection, and `AFTER_CONFIRMATION` mode.

The Order screen provides:

- Retry after a sanitized creation failure.
- External delivery ID and tracking number persisted on the shipment.
- Refresh Tracking through the merchant's own Bosta credential.
- On-demand Bosta A4 AWB PDF download; successful retrieval records `documentVerifiedAt` without persisting the PDF or exposing credentials.

The remaining operator evidence must be collected with real merchant accounts:

1. Merchant A saves its Bosta API key and unique Webhook Authorization key, tests to `CONNECTED`, makes Bosta default, and selects `AFTER_CONFIRMATION`.
2. Create a real COD test order with an Egyptian phone, customer, full address, governorate, valid Bosta city/zone, and products.
3. Move `NEW → PROCESSING`; confirm `order.confirmed → outbox → consumer → Bosta` and a single delivery.
4. Record the external delivery ID and tracking number, download the AWB in M&K, and confirm the same delivery is visible in Merchant A's Bosta dashboard.
5. Refresh tracking and confirm the latest Bosta state appears in the shipment UI.
6. Configure the URL and Authorization header in Bosta, cause a provider status change, and prove the webhook log, dedup record, shipment/order mapping, and integration event.
7. Resend the identical delivered/returned event and prove a 200 duplicate response with no repeated business effect.
8. For a return, prove the exact product variant is restored once and `stockRestored=true`; resend and prove no second increment.
9. Temporarily test an invalid key and a failed creation; prove `INVALID_CREDENTIALS`, preserved order, sanitized failure, and successful retry.
10. Repeat with Merchant B's different Bosta account; prove each order appears only in its owning carrier account and direct cross-tenant callable calls are rejected.

## Verification results

| Evidence | Result |
| --- | --- |
| TypeScript / Functions build / frontend build | PASS |
| Focused integration suite | PASS — 6/6 emulator scenarios, including AWB and cross-tenant document denial |
| Full release gate | NOT GREEN — the `mobile-390` run produced four Playwright runner/session failures (`session closed` / `frame detached` during setup or navigation), including two unrelated visual/registration cases. No Bosta assertion failed, but this remains a release blocker until a clean uninterrupted matrix completes. |
| Bosta connection result | NOT RUN — no real credential supplied |
| External delivery ID | NOT AVAILABLE — no real delivery created |
| Shipment document | IMPLEMENTED/EMULATOR VERIFIED; live Bosta AWB pending |
| Tracking verification | IMPLEMENTED/EMULATOR VERIFIED; live pending |
| Webhook verification | IMPLEMENTED/EMULATOR VERIFIED; live pending |
| Duplicate webhook | IMPLEMENTED/EMULATOR VERIFIED; live pending |
| Return inventory | IMPLEMENTED/EMULATOR VERIFIED exactly once; live pending |
| Tenant isolation | IMPLEMENTED/EMULATOR VERIFIED; two live Bosta accounts pending |
| Final classification | `IMPLEMENTED_NOT_LIVE_VERIFIED` |

The classification must not change to `VERIFIED_LIVE` until every real-account item above has durable evidence.

## Official Bosta references

- API key setup: https://docs.bosta.co/docs/how-to/get-your-api-key/
- Create delivery and required address fields: https://docs.bosta.co/docs/how-to/create-your-first-delivery/
- Webhook setup, custom Authorization header, payload, and states: https://docs.bosta.co/docs/how-to/get-delivery-status-via-webhook/
- A4/A6 Air Waybill endpoint: https://docs.bosta.co/docs/how-to/print-awbs/
