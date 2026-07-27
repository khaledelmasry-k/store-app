#!/usr/bin/env bash
set -e
TUNNEL_URL_FILE="/tmp/tunnel-url.txt"
rm -f "$TUNNEL_URL_FILE"
/tmp/cloudflared tunnel --url http://localhost:3001 --metrics 0.0.0.0:20242 2>&1 \
  | while IFS= read -r line; do
      echo "$line"
      url=$(echo "$line" | grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' | head -1)
      if [ -n "$url" ]; then
        echo "$url" > "$TUNNEL_URL_FILE"
      fi
    done
