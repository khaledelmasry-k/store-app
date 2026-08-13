#!/usr/bin/env bash
# Focused emulator run for the products/inventory spec only (no full project suite).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "── Building functions..."
(cd functions && npm run build)

echo "── Seeding emulator data..."
node scripts/seed-emulator.mjs

echo "── Checking icon integrity..."
node scripts/check-icons.mjs

echo "── Starting vite preview on :4173..."
npx vite preview --port 4173 --strictPort &
PREVIEW_PID=$!
trap 'kill "$PREVIEW_PID" 2>/dev/null || true' EXIT

for _ in $(seq 1 40); do
  if curl -sf http://localhost:4173 >/dev/null 2>&1; then break; fi
  sleep 1
done

echo "── Running Playwright (products spec)..."
npx playwright test --config playwright.emulator.config.ts "$@"
