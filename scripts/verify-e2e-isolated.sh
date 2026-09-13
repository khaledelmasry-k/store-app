#!/usr/bin/env bash
# Release E2E runs in bounded mutation domains.  Each group receives a fresh
# emulator lifecycle, seed, preview, and browser process through verify:run.
# This keeps the full existing coverage while preventing one long-lived test
# session from leaking authentication, subscriptions, storage, or overlays
# into unrelated specs.
set -euo pipefail

declare -A GROUP_SPECS=(
  [public-storefront]='e2e/emulator.spec.ts e2e/landing.spec.ts e2e/branding.spec.ts e2e/seo.spec.ts e2e/storage-limit.spec.ts'
  [auth-subscription]='e2e/auth-harness.spec.ts e2e/email-verification.spec.ts e2e/subscription.spec.ts e2e/saas.spec.ts e2e/payment-proof.spec.ts e2e/platform-subscriptions.spec.ts'
  [merchant-commerce]='e2e/products.spec.ts e2e/variant-logic.spec.ts e2e/variant-flow.spec.ts e2e/customer-flow.spec.ts'
  [platform-admin]='e2e/merchant-lifecycle.spec.ts e2e/platform-crm.spec.ts e2e/system-audit.spec.ts e2e/integration-foundation.spec.ts'
  [journeys-responsive]='e2e/launch-ops-verification.spec.ts e2e/launch-full-tour.spec.ts e2e/launch-coupons.spec.ts e2e/launch-impersonation.spec.ts e2e/launch-shipping-onboarding.spec.ts e2e/launch-tour-suppression.spec.ts e2e/responsive.spec.ts'
)

ALL_GROUPS=(public-storefront auth-subscription merchant-commerce platform-admin journeys-responsive)

if [[ -n "${VERIFY_E2E_GROUP:-}" ]]; then
  if [[ -z "${GROUP_SPECS[$VERIFY_E2E_GROUP]+x}" ]]; then
    echo "Unknown VERIFY_E2E_GROUP: $VERIFY_E2E_GROUP" >&2
    exit 2
  fi
  E2E_GROUPS=("$VERIFY_E2E_GROUP")
else
  E2E_GROUPS=("${ALL_GROUPS[@]}")
fi

for group in "${E2E_GROUPS[@]}"; do
  echo "── Release E2E group: $group (fresh emulator lifecycle)"
  # Build before emulator startup so Functions never begins from a stale/missing
  # lib directory. verify:run keeps its own build as a local safety check.
  npm --prefix functions run build
  firebase emulators:exec --project mk-store-app --only auth,firestore,functions,storage \
    "npm run verify:run -- ${GROUP_SPECS[$group]}"
done
