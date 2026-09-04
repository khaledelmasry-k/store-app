# Deployment and environment runbook

This project uses Firebase for Auth, Firestore, Storage, Functions, and the
canonical frontend host. Vercel remains a secondary configuration only; do not
deploy both providers for the same release.

## Environment separation

| Environment | Firebase project | Frontend config | Data |
| --- | --- | --- | --- |
| Local | `mk-store-app` emulators | `.env.local` or `.env.emulator` | disposable emulator data only |
| Staging | a separate Firebase project (not yet provisioned) | `.env.staging` | staging-only data |
| Production | `mk-store-app` (current identified project) | `.env.production` | production data |

`.firebaserc` contains `default` and an explicit `production` alias for
`mk-store-app`; `staging` is intentionally absent until its real project ID is
known. Add the staging alias only after that project is created (or always pass
`--project` explicitly). Never point staging at the production project.
Do not run seed/reset scripts against staging or production.

## Canonical hosting

Firebase Hosting is the canonical frontend target because `firebase.json`
already owns the SPA rewrite, Firebase Auth/Functions/Storage are in the same
release system, and Hosting supports shared store/platform deep links.
`vercel.json` is retained as a secondary, non-canonical option until it is
formally removed. Do not use an unqualified `npm run deploy` for a release.

## Local emulators

```bash
npm install
(cd functions && npm install)
npm run dev                    # Vite, normally http://localhost:5173
npm run emulators              # Firebase UI 4000, Hosting 5000
```

Configured emulator ports are Auth `9099`, Firestore `8080`, Functions `5001`,
Storage `9199`, Hosting `5000`, and UI `4000`. Set
`VITE_FIREBASE_USE_EMULATOR=true` only in the local environment. Local QA data
must never be migrated or uploaded by a deployment command.

## Environment variables

Copy `.env.staging.example` to a local, untracked `.env.staging` and provide
the staging project's public Firebase web configuration. Public `VITE_*`
values are not secrets; do not put private credentials in them. Functions use
the runtime-provided `GCLOUD_PROJECT` and optional `STORAGE_BUCKET` values.
Before a staging build, verify every Firebase variable is present: the client
has development fallbacks for local convenience, so an omitted staging file
must be treated as a failed release check rather than allowed to fall back to
the production project.

Required frontend variables:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_USE_EMULATOR
VITE_STORE_BASE_URL
```

`VITE_STORE_BASE_URL` must be set to a stable HTTPS origin for staging and
production so copied sales-link, landing-page, tracking, and share URLs do not
depend on a developer's browser origin. Local development may use the local
origin. Verified custom domains may override this through the existing URL
resolver; an unverified domain must not be accepted.

## Required manual cloud setup

For staging, create a separate Firebase project and enable Auth (email/password
and any customer provider used by the product), Firestore, Storage, Functions,
and Hosting. Configure authorized domains, password-reset/verification URLs,
Storage CORS if needed, billing/runtime requirements for Functions, and the
staging web app's public config. Deploy the repository's rules and indexes before
testing. Production requires the same setup with production domains and a
manually reviewed SuperAdmin account; never use emulator seed scripts for this.

## Safe deployment commands (do not execute from this audit)

Use an explicit project ID every time:

```bash
# staging
export FIREBASE_STAGING_PROJECT='<staging-project-id>'
npm run build -- --mode staging
npm --prefix functions run build
firebase deploy --project "$FIREBASE_STAGING_PROJECT" --only firestore:indexes
firebase deploy --project "$FIREBASE_STAGING_PROJECT" --only firestore:rules,storage
firebase deploy --project "$FIREBASE_STAGING_PROJECT" --only functions
firebase deploy --project "$FIREBASE_STAGING_PROJECT" --only hosting

# production, only after explicit approval and staging sign-off
export FIREBASE_PRODUCTION_PROJECT='mk-store-app'
npm run build -- --mode production
npm --prefix functions run build
firebase deploy --project "$FIREBASE_PRODUCTION_PROJECT" --only firestore:indexes
firebase deploy --project "$FIREBASE_PRODUCTION_PROJECT" --only firestore:rules,storage
firebase deploy --project "$FIREBASE_PRODUCTION_PROJECT" --only functions
firebase deploy --project "$FIREBASE_PRODUCTION_PROJECT" --only hosting
```

Release order is: project/configuration, indexes, Firestore and Storage rules,
Functions, Hosting, then smoke/security verification. The generic
`npm run deploy` now refuses implicit deployment. Use
`npm run deploy:staging` only with a non-production `FIREBASE_STAGING_PROJECT`,
or `npm run deploy:production` only with `FIREBASE_PRODUCTION_PROJECT=mk-store-app`
and `CONFIRM_PRODUCTION_DEPLOY=YES`. The script always passes `--project`.

### Integration vault secret

Before deploying integration-enabled Functions, generate an independent random
32-byte key, encode it as Base64, and store it in Firebase Secret Manager:

```bash
firebase functions:secrets:set INTEGRATION_VAULT_KEY --project "$FIREBASE_PRODUCTION_PROJECT"
```

Never reuse this key as a provider API key and never commit it. Local emulators
may use `functions/.secret.local`, created from the tracked
`functions/.secret.local.example` template.

The preferred production-safe setup streams a newly generated key directly to
Firebase Secret Manager without displaying or writing it:

```bash
FIREBASE_PRODUCTION_PROJECT=mk-store-app \
CONFIRM_PRODUCTION_SECRET=YES \
npm run secrets:integration-vault:production
```

Production accepts only canonical Base64 that decodes to exactly 32 bytes. The
deployment guard checks Secret metadata (never its value) and refuses to deploy
if the Secret is absent. It then runs type checks, both builds, the focused
integration suite, and the complete emulator release gate before deploying in
the explicit indexes → rules/storage → Functions → Hosting order.

The Bosta production Webhook in `us-central1` is:

```text
POST https://us-central1-mk-store-app.cloudfunctions.net/shippingWebhook/bosta
```

Do not add an authorization value to this URL or its query string. Configure a
different merchant-owned value in Bosta's `Authorization` custom header for
each account; the same value is stored through the merchant credential vault.

### App Check rollout

The frontend is compatible with reCAPTCHA Enterprise App Check when the public
`VITE_FIREBASE_APPCHECK_SITE_KEY` is supplied. Register each deployed web app,
observe App Check request metrics, and only then enable callable enforcement.
Leaving the site key empty keeps token attachment disabled; it does not weaken
the tenant and credential authorization already enforced by Functions.

## Smoke checklist after staging deployment

Auth and role redirects; Merchant login; product create; order detail and
status control; settings save; Storefront load and Product → Cart → Checkout;
public landing callable (published/unpublished); ticket callable with forged
tenant/actor rejection; SuperAdmin login and platform order detail; and
cross-tenant product/order reads denied.

## Security and data release checks

The final rules keep Merchant data tenant-scoped, keep internal landing pages
private (public pages use the sanitized callable projection), disable direct
ticket creation (the callable derives actor and tenant), and use `resource.data`
for delete ownership checks. Storage writes are scoped to the owning store and
public reads are limited to intended assets. Review `firestore.indexes.json`
with every new compound query before release.

Current payment scope is COD/manual bank transfer; no online gateway is claimed
by the UI. Abuse protection remains a readiness item: tracking has a local
throttle, but durable rate limiting and App Check are not yet applied uniformly
to all public callables/forms.

## Rollback

Frontend Hosting can be rolled back to the previous Hosting release. Functions
can be rolled back by redeploying the previous source/build. Rules and indexes
must be restored from the previous reviewed commit and redeployed. Schema/data
mutations are not automatically reversible, so take a deliberate migration
backup/plan before any release that changes document shape. Never rollback by
running a seed/reset script against a cloud project.

## SuperAdmin bootstrap

Create the first production admin manually in the production Auth console,
then create/verify its profile and role through a reviewed one-time procedure
with audit logging. Do not run `scripts/seed-emulator.mjs`,
`scripts/seed-superadmin.cjs`, or any reset script against a cloud project.
The local `seed-superadmin.cjs` guard additionally requires
`FIRESTORE_EMULATOR_HOST` to be `localhost` or `127.0.0.1`.

## QA data policy

All `owner@a.store`, `owner@b.store`, `test-store-a`, QA records, and emulator
seed data are local test artifacts. They must not appear in production config,
bundles, migrations, or deployment commands.
