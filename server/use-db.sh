#!/usr/bin/env bash
# PostgreSQL is the only supported database.
# Kept as a convenience script that confirms the schema is PostgreSQL.
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
if grep -q 'provider = "postgresql"' "$DIR/prisma/schema.prisma"; then
  echo "schema.prisma is configured for PostgreSQL ✓"
else
  echo "schema.prisma is NOT PostgreSQL — please restore the PostgreSQL schema."
  exit 1
fi
