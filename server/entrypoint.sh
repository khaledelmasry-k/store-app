#!/bin/sh
set -e

echo "Running Prisma migrations..."
cd /app/server
if [ -d "prisma/migrations" ] && [ "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  npx prisma migrate deploy
else
  echo "No migrations found — running db push..."
  npx prisma db push --accept-data-loss
fi

echo "Seeding default admin..."
node dist/seed.js

echo "Starting server..."
exec node dist/index.js
