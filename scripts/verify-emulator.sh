#!/usr/bin/env bash
# Runs the emulator verification: seed -> vite preview -> Playwright.
# Expected to run inside `firebase emulators:exec --project mk-store-app "npm run verify:run"`.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "── Building functions..."
(cd functions && npm run build)

echo "── Checking icon integrity..."
node scripts/check-icons.mjs

echo "── Building app for emulator mode..."
VITE_FIREBASE_USE_EMULATOR=true npm run verify:build

PREVIEW_URL="${PW_BASE_URL:-http://127.0.0.1:4173}"

echo "── Starting vite preview on 127.0.0.1:4173..."
# The emulator environment builds public URLs from VITE_STORE_BASE_URL. Bind
# preview to the same loopback address so redirects such as /s/:code do not
# switch from localhost to an unreachable IPv4 endpoint in CI.
npx vite preview --host 127.0.0.1 --port 4173 --strictPort &
PREVIEW_PID=$!
cleanup_preview() {
  kill "$PREVIEW_PID" 2>/dev/null || true
  # npx may leave vite as a child when the runner is interrupted.
  pkill -TERM -P "$PREVIEW_PID" 2>/dev/null || true
  wait "$PREVIEW_PID" 2>/dev/null || true
}
trap cleanup_preview EXIT INT TERM

for _ in $(seq 1 60); do
  if curl -sf "$PREVIEW_URL" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -sf "$PREVIEW_URL" >/dev/null 2>&1; then
  echo "Preview failed to become ready on $PREVIEW_URL after 60s — aborting" >&2
  exit 1
fi
# Give vite a moment to settle after first successful probe
sleep 1

echo "── Running Playwright (emulator config)..."

# Browser projects share one emulator process, but they must not share the
# mutable fixture state left behind by another viewport.  Re-seed (with an
# emulator-only reset) between projects while keeping the backend session
# alive.  This removes cross-project transaction contention and order leakage
# without starting one emulator stack per spec.
# Use VERIFY_PROJECTS="desktop" for a focused local diagnosis; CI keeps the
# full responsive matrix by default.
read -r -a projects <<< "${VERIFY_PROJECTS:-desktop mobile-390 mobile-360 mobile-430}"
for project in "${projects[@]}"; do
  echo "── Resetting emulator fixtures for ${project}..."
  SEED_RESET=true node scripts/seed-emulator.mjs
  echo "── Running Playwright project ${project}..."
  npx playwright test --config playwright.emulator.config.ts --project="${project}" --pass-with-no-tests "$@"
done
