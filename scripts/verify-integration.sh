#!/usr/bin/env bash
# Focused provider/vault/outbox/webhook verification inside Firebase emulators.
set -euo pipefail
cd "$(dirname "$0")/.."

(cd functions && npm run build)
npm run verify:build
npx vite preview --port 4173 --strictPort &
PREVIEW_PID=$!
cleanup_preview() {
  kill "$PREVIEW_PID" 2>/dev/null || true
  pkill -TERM -P "$PREVIEW_PID" 2>/dev/null || true
  wait "$PREVIEW_PID" 2>/dev/null || true
}
trap cleanup_preview EXIT INT TERM

for _ in $(seq 1 40); do
  if curl -sf http://localhost:4173 >/dev/null 2>&1; then break; fi
  sleep 1
done

SEED_RESET=true node scripts/seed-emulator.mjs
npx playwright test e2e/integration-foundation.spec.ts --config playwright.emulator.config.ts --project=desktop
