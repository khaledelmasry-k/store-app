#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm --prefix functions run build
VITE_FIREBASE_USE_EMULATOR=true npm run verify:build
node scripts/seed-emulator.mjs
npx vite preview --host 127.0.0.1 --port 4173 --strictPort >/tmp/matjari-visual-vite.log 2>&1 &
preview_pid=$!
trap 'kill "$preview_pid" 2>/dev/null || true' EXIT
for _ in $(seq 1 40); do curl -sf http://127.0.0.1:4173/ >/dev/null && break; sleep 1; done
npx playwright test --config playwright.visual.config.ts
