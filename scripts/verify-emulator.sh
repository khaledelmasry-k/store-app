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

echo "── Starting vite preview on :4173..."
npx vite preview --port 4173 --strictPort &
PREVIEW_PID=$!
cleanup_preview() {
  kill "$PREVIEW_PID" 2>/dev/null || true
  # npx may leave vite as a child when the runner is interrupted.
  pkill -TERM -P "$PREVIEW_PID" 2>/dev/null || true
  wait "$PREVIEW_PID" 2>/dev/null || true
}
trap cleanup_preview EXIT INT TERM

for _ in $(seq 1 40); do
  if curl -sf http://localhost:4173 >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

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
