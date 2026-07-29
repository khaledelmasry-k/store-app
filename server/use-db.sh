#!/usr/bin/env bash
# Usage: bash use-db.sh [postgres|sqlite]
# Switches prisma/schema.prisma to the selected database provider.
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
case "${1:-postgres}" in
  postgres|pg)
    cp "$DIR/prisma/schema.postgres.prisma" "$DIR/prisma/schema.prisma" 2>/dev/null || true
    echo "Switched to PostgreSQL schema"
    ;;
  sqlite)
    cp "$DIR/prisma/schema.sqlite.prisma" "$DIR/prisma/schema.prisma"
    echo "Switched to SQLite schema"
    ;;
  *)
    echo "Usage: $0 [postgres|sqlite]"
    exit 1
    ;;
esac
