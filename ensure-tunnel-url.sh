#!/usr/bin/env bash
set -e

TUNNEL_URL_FILE="/tmp/tunnel-url.txt"
CURRENT_URL_FILE="/tmp/current-deployed-url.txt"
PROJECT_DIR="/home/khaled/store"

if [ ! -f "$TUNNEL_URL_FILE" ]; then
  echo "No tunnel URL file yet"
  exit 0
fi

TUNNEL_URL=$(cat "$TUNNEL_URL_FILE" | tr -d '\n')
if [ -z "$TUNNEL_URL" ]; then
  echo "Empty tunnel URL"
  exit 0
fi

API_URL="${TUNNEL_URL}/api"

if [ -f "$CURRENT_URL_FILE" ]; then
  CURRENT_URL=$(cat "$CURRENT_URL_FILE" | tr -d '\n')
  if [ "$API_URL" = "$CURRENT_URL" ]; then
    echo "URL unchanged: $API_URL"
    exit 0
  fi
fi

echo "URL changed! Old: $(cat "$CURRENT_URL_FILE" 2>/dev/null || echo 'none'), New: $API_URL"
echo "$API_URL" > "$CURRENT_URL_FILE"

cd "$PROJECT_DIR"
VITE_API_URL="$API_URL" npm run build 2>&1

firebase deploy --only hosting 2>&1

echo "Deploy complete with URL: $API_URL"
