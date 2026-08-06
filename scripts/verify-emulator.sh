#!/usr/bin/env bash
# Runs the emulator verification: seed -> vite preview -> Playwright.
# Expected to run inside `firebase emulators:exec --project mk-store-app "npm run verify:run"`.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "── Seeding emulator data..."
node scripts/seed-emulator.mjs

echo "── Starting vite preview on :4173..."
npx vite preview --port 4173 --strictPort &
PREVIEW_PID=$!
trap 'kill "$PREVIEW_PID" 2>/dev/null || true' EXIT

for _ in $(seq 1 40); do
  if curl -sf http://localhost:4173 >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "── Running Playwright (emulator config)..."
npx playwright test --config playwright.emulator.config.ts
