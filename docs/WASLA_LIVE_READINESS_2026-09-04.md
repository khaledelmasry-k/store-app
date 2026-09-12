# Wasla live-readiness review

Original readiness review: 2026-09-04  
Updated production verification: 2026-09-12

## Scope and guardrails

- Release context: `v1.0.2` (tag remains unchanged).
- Wasla is deployed and the production callable path has been verified.
- This audit changes no Bosta integration behavior. Existing generic provider code remains outside the Wasla scope.
- “Live/connected” is never inferred from a saved key. It is set only by a successful server-side provider request.

## What is now contract-backed

The Wasla adapter exposes only the features implemented by its current merchant contract:

| Capability | Readiness | Behaviour |
| --- | --- | --- |
| Credential validation | IMPLEMENTED / VERIFIED IN PRODUCTION | Server validates the merchant key through the deployed callable; the key remains in the vault. |
| Pickup locations / cities | IMPLEMENTED / VERIFIED IN PRODUCTION | Production callable location lookups completed successfully; the browser never receives the key. |
| Quote | IMPLEMENTED / VERIFIED IN PRODUCTION | Supported destinations returned provider-derived quotes; unavailable destinations returned an unsupported result. |
| Shipment creation | IMPLEMENTED | Uses server-side idempotency and one shipment record per store/order/provider. Real Production shipment creation was intentionally **NOT PRODUCTION-MUTATION-TESTED** in the final QA. |
| Tracking and timeline | IMPLEMENTED / VERIFIED IN PRODUCTION | Tracking refresh is supported through the deployed callable and verified without creating a new shipment. |
| Public tracking code | IMPLEMENTED | A Wasla-style `WS…EG` code is generated only as a display fallback when Wasla does not return one. |
| Webhooks | UNSUPPORTED | No signed Wasla webhook parser/verifier exists; the UI does not advertise or generate a fake callback URL. |
| Cancel, AWB/label, provider return, pickup request | UNSUPPORTED | Hidden/communicated as unavailable rather than simulated. |

## Current Production coverage

The deployed callable path was used to check all 27 Egyptian governorates. The current provider/account response is authoritative:

- Covered: **20**
- Unavailable: **7**
- Unavailable governorates: Red Sea, New Valley, South Sinai, Matrouh, Luxor, Qena, North Sinai.

Unavailable destinations are blocked with an unsupported result and never receive a fabricated fallback price. Supported destinations return provider-derived quotes; no fixed 150 EGP fallback is used.

## Data ownership and safety

- Merchant API credentials are encrypted in the server vault and are masked in callable responses.
- Platform administrators manage the provider catalogue only. They cannot test a merchant-owned key from the platform screen; that test must be started by the merchant.
- Firestore rules deny browser access to credential documents.
- Public sales-link codes are now normalized and globally unique. The browser cannot alter a saved code or forge link analytics.
- Shipment status updates originate from the provider/manual server action. A returned shipment restores inventory once only.

## Connection status model

Only these states are shown/persisted: `NOT_CONFIGURED`, `CONFIGURED`, `CONNECTED`, `INVALID_CREDENTIALS`, `PROVIDER_UNAVAILABLE`, `ERROR`, `DISABLED`.

`CONNECTED` requires a real successful provider response. A saved key shows `CONFIGURED` until tested.

## Audit and test matrix

Status is deliberately factual: **PASS** means it completed in this audit; **SKIP** means it requires a controlled Wasla merchant environment; **BLOCKED** means the local test harness did not reach the test runner.

| # | Check | Result |
| ---: | --- | --- |
| 1 | Frontend TypeScript check | PASS |
| 2 | Frontend production build | PASS |
| 3 | Functions TypeScript build | PASS |
| 4 | Patch whitespace/conflict check | PASS |
| 5 | Credentials remain server-side/masked | PASS — code audit |
| 6 | Tenant scope checks on credential callables | PASS — code audit |
| 7 | Explicit invalid-credential status mapping | PASS — code audit |
| 8 | Explicit provider-unavailable status mapping | PASS — code audit |
| 9 | `CONNECTED` only after successful server test | PASS — code audit |
| 10 | Wasla location lookup is server-only | PASS — code audit |
| 11 | Pickup data is required only for API shipment automation | PASS — code audit |
| 12 | Quote uses provider data rather than invented Wasla pricing | PASS — code audit |
| 13 | Shipment creation idempotency key | PASS — code audit |
| 14 | Retry preserves the order | PASS — code audit |
| 15 | Manual automation does not create a shipment | PASS — code audit |
| 16 | Confirmation automation creates once | PASS — code audit |
| 17 | Checkout automation creates once | PASS — code audit |
| 18 | Provider tracking updates shipment and order | PASS — code audit |
| 19 | Failed-delivery detail is retained/displayed when supplied | PASS — code audit |
| 20 | Return restores inventory once | PASS — code audit |
| 21 | Unsupported Wasla webhooks are not exposed | PASS — code audit |
| 22 | Unsupported cancel/AWB/return/pickup capabilities are not advertised | PASS — code audit |
| 23 | Platform cannot test merchant-owned Wasla credentials | PASS — code audit |
| 24 | CRM/event payload uses persisted tracking value | PASS — code audit |
| 25 | Sales-link code uniqueness is global | PASS — code audit |
| 26 | Sales-link analytics are server-owned | PASS — rule audit |
| 27 | Sales-link creation through callable | PASS — code audit |
| 28 | Emulator integration suite | Historical interruption during the original review; not the Production source of truth. |
| 29 | Wasla production callable authentication and routing | PASS — deployed callable path verified. |
| 30 | 27-governorate Production quote/location matrix | PASS — 27/27 accounted for; 20 covered and 7 unavailable. |
| 31 | Unsupported-destination blocking and no fake pricing | PASS — unavailable results blocked cleanly; no fallback price. |
| 32 | Production tracking refresh | PASS — verified through the deployed callable without creating a shipment. |
| 33 | Real Production shipment creation | NOT PRODUCTION-MUTATION-TESTED — intentionally not executed in final QA. |

## Current production posture

- Wasla deployment and callable routing are complete.
- Merchant credentials remain server-only, encrypted, and masked; no secret values belong in this document.
- Quote, locations, unsupported-destination blocking, and tracking are verified through Production callables.
- Shipment creation is implemented and idempotent, but real Production mutation was intentionally not run in the final QA.
- Cancellation, webhooks, AWB/label, pickup, and provider-return remain unsupported and must not be presented as live.

## Files changed in this readiness pass

- `functions/src/index.ts`
- `functions/src/shipping/service.ts`
- `src/merchant/pages/Shipping.tsx`
- `src/platform/pages/ShippingCompanies.tsx`
- `src/merchant/pages/StoreLinks.tsx`
- `firestore.rules`

This document update changes documentation only; no Product or Firebase behavior is changed.
