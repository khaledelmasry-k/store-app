#!/bin/sh
set -e

echo "Running Prisma migrations..."
cd /app/server
if [ -d "prisma/migrations" ] && [ "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  npx prisma migrate deploy || echo "Migration failed or no migrations to apply"
else
  echo "No migrations found — running db push..."
  npx prisma db push --accept-data-loss || echo "db push failed (database might not be ready)"
fi

echo "Starting server..."
exec node dist/index.js
