# M&K Store — Full System Audit, Integration Verification & Repair

**Audit date:** 2026-08-29  
**Scope:** repository and Firebase emulator environment  
**Rule:** a feature is `WORKING` only when its complete implemented path was exercised. External integrations without real provider credentials are never marked `WORKING`.

## Overall System Health

M&K Store is a functioning Firebase-backed multi-tenant commerce application, not a static prototype. Its strongest verified paths are authentication, merchant registration, plan enforcement for core limits, product/variant CRUD, public storefront publication, checkout/order creation, inventory deduction/restoration, customer tracking, subscriptions, and tenant-scoped Firestore/Storage access.

It is **not yet the requested full integrations platform**. Shipping currently has a useful canonical manual adapter but no live carrier adapter or webhook endpoint. Meta Ads is manual campaign bookkeeping, not OAuth/account sync. WhatsApp Business, OTP, public API v1, API keys/scopes, OpenAPI, external webhooks, and the internal event bus are absent.

**Release assessment:** core storefront SaaS is usable in a controlled rollout; the advertised integration journey from ad click through WhatsApp, carrier webhook, and delivery is not production-ready.

## Architecture Findings

| Area | Finding |
| --- | --- |
| Frontend | Preact 10, TypeScript, Vite 8, Wouter |
| Backend | Firebase Cloud Functions v2, Node.js 22 |
| Database / ORM | Cloud Firestore; no ORM |
| Authentication | Firebase Auth email/password |
| Authorization | Firestore/Storage Rules plus callable-side RBAC (`superAdmin`, `merchant`, `staff`, `customer`) |
| Multi-tenancy | `storeId` on tenant records and `users.storeIds[]`; server and rules check ownership |
| API architecture | Firebase callable functions; no REST `/api/v1` surface |
| Storage | Firebase Storage with tenant metadata, type, and size rules; quota counters maintained by triggers |
| File uploads | Product/store/landing/payment-proof paths; emulator tests cover cross-tenant and unsafe upload denial |
| Webhooks | No inbound HTTP webhook infrastructure |
| Background jobs | Scheduled subscription/usage maintenance only |
| Events / queue | No durable internal event log, outbox, queue, or consumer retry model |
| Secrets | Firebase browser configuration only in client environment; no provider-secret store is implemented |
| Logging | Firestore `auditLogs` for selected mutations; no centralized structured error/APM pipeline |
| Error handling | `HttpsError` in callables and UI error boundaries/toasts; inconsistent provider retry policy because providers are absent |
| Hosting | Firebase Hosting SPA rewrite to `dist/index.html` |
| Deployment | Firebase project aliases and safe deployment script; production credentials/live integrations were not exercised |

### Runtime map

`Preact UI → Firebase Auth → Firestore Rules / callable Cloud Functions → Firestore & Storage → UI realtime state`

For checkout: `Public storefront → createOrder callable → subscription/plan checks → server-side product price and shipping quote → Firestore transaction → stock + customer + order + snapshots → confirmation UI`.

For canonical shipping today: `Merchant/platform UI → shipping callables → adapter registry → manual adapter → shipment/order documents`. There is no live external provider leg.

## Feature Inventory

| Feature | UI | Backend | DB | API | Security | E2E | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Register merchant + store + plan | Yes | Yes | Yes | Callable | Server validated | Yes | WORKING |
| Login / logout / session persistence / role redirects | Yes | Firebase Auth | Yes | SDK | Role guards + rules | Yes | WORKING |
| Password reset | Yes | Firebase Auth | Auth | SDK | Provider controlled | Covered by build/UI suite | WORKING |
| Email verification | No | No | No | No | — | No | NOT_IMPLEMENTED |
| Phone verification / login OTP | No | No | No | No | — | No | NOT_IMPLEMENTED |
| Merchant approval and suspension | Yes | Yes | Yes | Callable | Super-admin gate | Yes | WORKING |
| Onboarding through first product and published storefront | Yes | Yes | Yes | Callable + SDK | Plan/publication checks | Yes | WORKING |
| Free/Starter/Growth/Business/Pro/Lifetime catalog | Yes | Yes | Yes | Callable | Canonical server catalog | Yes | WORKING |
| Subscription usage/expiry/change/payment proof | Yes | Yes | Yes | Callable | Server lifecycle checks | Yes | WORKING |
| Product CRUD, categories, images | Yes | Yes | Yes | Callable/SDK | Tenant + quota checks | Yes | WORKING |
| Variants, sizes, colors, per-variant stock | Yes | Yes | Yes | Callable | Server price/stock authority | Yes | WORKING |
| Quantity tiers | Yes | Yes | Yes | Callable | Plan gate + server recompute | Yes | WORKING |
| Checkout and order snapshots | Yes | Yes | Yes | Callable | Transactional | Yes | WORKING |
| Inventory deduction / cancel / return idempotency | Yes | Yes | Yes | Callable | Transaction + durable flag | Yes | WORKING |
| Manual order creation | No | No | No | No | — | No | NOT_IMPLEMENTED |
| Customer records/history/tracking | Yes | Yes | Yes | Callable/SDK | Tenant/identity checks | Yes | WORKING |
| Draft/public storefront boundary | Yes | Yes | Public projections | Callable | Sanitized projection | Yes | WORKING |
| Theme/settings persistence | Yes | Firestore | Yes | SDK | Tenant rules | Yes | WORKING |
| Sales links and visit/order attribution | Yes | Yes | Yes | Callable | Quota boundary repaired | Partial | PARTIAL |
| UTM attribution snapshot | Partial fields | Partial | Partial | Callable | Tenant campaign lookup | Partial | PARTIAL |
| Analytics/reports | Yes | Derived from DB | Yes | Callable/queries | Tenant rules | Partial | PARTIAL |
| Team and granular roles | Yes | Yes | Yes | Callable/SDK | RBAC | Yes | WORKING |
| Coupons | Yes | Yes | Yes | Callable | Plan gate + server quote | Yes | WORKING |
| Super-admin merchants/plans/subscriptions/payments/audit/support | Yes | Yes | Yes | Callable/SDK | Super-admin gates | Yes | WORKING |
| Integration dashboard/health monitoring | No | No | No | No | — | No | NOT_IMPLEMENTED |
| Public REST API `/api/v1` | No | No | No | No | — | No | NOT_IMPLEMENTED |
| API keys, hashes, scopes, rate limits | No | No | No | No | — | No | NOT_IMPLEMENTED |
| OpenAPI `/api/docs` | No | No | No | No | — | No | NOT_IMPLEMENTED |
| Durable internal event system/outbox | No | No | No | No | — | No | NOT_IMPLEMENTED |

## Working Features

- Email/password authentication, role routing, merchant registration, approval, suspension, and password reset.
- Canonical plan catalog and server-side limits for products, orders, staff, landing pages, sales links, storage, coupons, quantity pricing, and variant inventory where implemented.
- Product and variant commerce, including server-authoritative prices, concurrent stock checks, exact variant deduction, and idempotent cancellation/return restoration.
- Published-store safe projections, cart, checkout, order confirmation, customer tracking/claim, and storefront themes.
- Core subscription/payment-request lifecycle and super-admin operations.
- Tenant-scoped Firestore and Storage boundaries covered by emulator tests.

## Partial Features

- Analytics is database-derived for existing commerce data, but there is no complete event/outbox model and external ad/provider metrics are absent.
- Sales-link attribution tracks visits and delivered revenue, but there is no durable anti-fraud/session attribution pipeline.
- Shipping manual services, zones, rates, shipment records, and statuses work; external carrier actions do not.
- Staff invitation provisions a real account, but still returns a one-time password to the inviter instead of an expiring invitation-acceptance flow.

## Frontend-only Features

- Shipping API and webhook tabs describe future capabilities; no real carrier adapter/webhook exists behind them.
- Meta/Facebook/Instagram choices in campaign UI are labels for manually entered campaign spend, not connected ad platforms.

## Broken Features Repaired

1. **P0/P1 plan entitlement bypass:** direct Firestore creation of `storeLinks` bypassed the callable's subscription and quota enforcement. Creation is now callable-only.
2. **P1 inventory corruption:** a carrier/status path to `RETURNED` changed the order without restoring stock. It now restores exact variant or flat inventory atomically and sets the durable `stockRestored` guard.
3. **P1 duplicate return handling:** repeated returned-shipment events can no longer restore inventory twice.
4. **P0 notification forgery:** tenant browser clients could write arbitrary notification content. Creation is now server-only and browser updates are limited to read-state fields.
5. **P1 predictable staff credentials:** `Math.random()` generated staff passwords/invitation tokens. They now use cryptographically secure random bytes.
6. **P1 publication authorization:** any tenant staff member could call store publication without a specific permission. Publication now requires `settings:edit` for staff.
7. **Build blocker:** two unregistered icon names stopped the verification suite; both now map to canonical SVG icons.

## Mock Features

- No production fake-success provider call was found in the canonical shipping path: missing API adapters return `API integration not configured`.
- Seeded demo data and fixed test credentials exist only in emulator/test scripts and are legitimate test fixtures.
- Manual ad campaign spend is real persisted user input, but must not be represented as provider-synced Meta data.

## Security Risks

| Priority | Risk | State |
| --- | --- | --- |
| P0 | Direct sales-link creation bypassed plan quota | REPAIRED |
| P0 | Browser could forge notification content | REPAIRED |
| P1 | Shipment return could corrupt inventory | REPAIRED |
| P1 | Predictable generated staff credentials | REPAIRED |
| P1 | No durable distributed rate limiting/App Check on public callables | OPEN |
| P1 | No webhook signature/idempotency framework because webhooks do not exist | OPEN |
| P1 | No provider credential encryption/rotation store because provider integrations do not exist | OPEN |
| P2 | Staff onboarding returns an initial password rather than an expiring acceptance link | OPEN |
| P2 | Landing-page slug uniqueness is enforced on creation but direct updates need a server-owned update path | OPEN |
| P2 | Audit coverage is mutation-specific rather than a complete immutable event trail | OPEN |

The committed `VITE_FIREBASE_API_KEY` is a Firebase client configuration value, not a provider secret. No shipping, Meta, WhatsApp, or API bearer secret was found in frontend source or browser storage code.

## Shipping Deep Report

| Provider | UI | Credentials | Real API | Create Shipment | Tracking | Cancel | Webhook | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Manual adapter | Yes | Not required | No | Local/manual record | Manual status | No adapter action | No | PARTIAL |
| External carriers | Configuration shell | No secure credential store | No | No | No | No | No | NOT_IMPLEMENTED |

The registry/interface is a useful base (`testConnection`, services/zones/rates/ETA, create/cancel/track/status mapping), but only `manual` is registered. There is no HTTP webhook route, signature verification, provider event ID store, or live credential verification. Therefore shipping is **not live-provider verified**.

## WhatsApp Deep Report

The only WhatsApp behavior is a platform marketing contact link (`wa.me`). It is not a merchant integration and is not used for transactional messaging.

| Capability | Status |
| --- | --- |
| Official Cloud API OAuth/Embedded Signup | NOT_IMPLEMENTED |
| MK platform number | NOT_IMPLEMENTED |
| Merchant WABA/number storage | NOT_IMPLEMENTED |
| Templates and automation rules | NOT_IMPLEMENTED |
| Incoming messages/inbox | NOT_IMPLEMENTED |
| Webhook verification/signatures/idempotency | NOT_IMPLEMENTED |

## OTP Deep Report

WhatsApp OTP, SMS fallback abstraction, Egypt E.164 normalization, hashed challenges, expiry, resend cooldown, attempts, phone/IP throttling, and checkout verification setting are all `NOT_IMPLEMENTED`. No production hardcoded OTP bypass was found.

## Meta Ads Deep Report

| Provider | UI | OAuth | Account Sync | Insights | Attribution | Conversions | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Meta/Facebook/Instagram | Manual campaign form | No | No | Manual spend only | Partial campaign/UTM snapshot | No | FRONTEND_ONLY |
| TikTok/Google/Snapchat | Labels/future design only | No | No | No | No | No | NOT_IMPLEMENTED |

There is no OAuth callback, token store, business/ad-account selection, Graph API insights, Conversions API, or event deduplication.

## API Deep Report

The application exposes Firebase callable functions to its own frontend. It does not expose the requested public REST API. API-key issuance, hash-only storage, scopes, expiration/status/last-used fields, per-key tenant resolution, idempotency keys, external webhooks, rate-limit headers, pagination contract, and OpenAPI documentation are all `NOT_IMPLEMENTED`.

## Files Modified

- `firestore.rules` — sales-link quota boundary and notification integrity.
- `functions/src/index.ts` — secure randomness, staff publication permission, returned-shipment inventory/idempotency repair.
- `src/shared/utils/icons.ts` — verification-blocking icon registrations.
- `src/merchant/components/OrderDetailsWorkspace.tsx` — UI transition choices aligned with the backend order-state machine.
- `playwright.emulator.config.ts` — audit regression suite registration.
- `e2e/emulator.spec.ts`, `e2e/landing.spec.ts`, `e2e/merchant-lifecycle.spec.ts` — repaired stale/ambiguous assertions so they exercise current UI behavior.

## Files Created

- `e2e/system-audit.spec.ts` — direct quota, notification-forgery, and returned-shipment idempotency tests.
- `docs/FULL_SYSTEM_AUDIT_2026-08-29.md` — this report.

## Database Migrations

None. Repairs are backward-compatible with existing documents and use the existing `stockRestored` field.

## Routes Added

None. No external API or webhook route is claimed as implemented.

## Tests Executed

- TypeScript/function build.
- Static type check.
- Lint (warnings only).
- Icon integrity check.
- Firebase emulator suite (Auth, Firestore, Functions, Storage) with Playwright desktop/mobile projects.
- New direct security and returned-shipment idempotency regression tests.

### Recorded results

- Full desktop run after the first repair pass: **84 passed, 7 failed, 1 skipped, 22 not run**. The runner stopped after desktop because it is fail-fast, so unrun cases are not counted as passed.
- New P0/P1 regression suite: **3/3 passed** — direct sales-link creation denied, forged notification creation denied, returned shipment restores stock exactly once.
- Focused status-flow verification: **passed** end-to-end from merchant status update to guest tracking.
- Focused paid registration verification: **passed** after correcting a non-unique success-text locator; the original run had already created the account successfully.
- Focused rerun of landing structure, merchant suspend/reactivate/deletion, and plan availability: **3/3 functional cases passed**. One visual-only assertion depended on an externally loaded Cairo font in an offline emulator and was replaced with a computed font-stack assertion.

## Failed Tests

The first verification attempt stopped before Playwright because of two missing icon registrations; that blocker was repaired. The next full desktop run exposed seven failures:

1. Invalid order-state choice shown by the UI — **repaired and focused rerun passed**.
2. Registration helper omitted the mandatory terms checkbox and then used an ambiguous success locator — **repaired and focused rerun passed**.
3. Two landing-page tests targeted the removed legacy mockup — **updated to the current hero visual; structure rerun passed**.
4. Merchant deletion confirmation used character-by-character input that did not reliably emit the current controlled-input event sequence — **changed to deterministic fill; focused lifecycle rerun passed**.
5. Plan-availability test did not observe its transient toast — **focused rerun passed**, including both close and reopen calls.
6. One visual font assertion required the Cairo webfont to be downloaded despite the offline test environment — **test corrected to verify the configured computed font stack**.

Because the entire 114-test desktop suite was not rerun after these final test-harness corrections, the release is not represented as having a clean full-suite pass. The verified P0/P1 paths above are green; a final uninterrupted full matrix run remains release-gate work.

## Remaining Technical Debt

1. Build a server-side encrypted integration credential vault with rotation and redaction.
2. Add a durable event/outbox log and idempotent consumers before WhatsApp, Meta conversions, or shipping webhooks.
3. Implement one real carrier adapter end-to-end, including signed webhook verification and duplicate-event storage, before labeling shipping connected.
4. Implement WhatsApp Cloud API and OTP as separate platform-number and merchant-number domains.
5. Implement Meta OAuth/account sync/insights/Conversions API with event deduplication.
6. Implement `/api/v1`, hashed API keys, scopes, rate limits, audit logs, idempotency, and OpenAPI docs.
7. Replace staff initial-password delivery with a short-lived invitation acceptance/reset-link flow.
8. Move landing-page slug updates behind a callable transaction to preserve global uniqueness.
9. Add durable distributed rate limiting and Firebase App Check for abuse-sensitive public callables.
10. Add real-provider sandbox tests when credentials are supplied; until then use `IMPLEMENTED_NOT_LIVE_VERIFIED`, never `WORKING`.
