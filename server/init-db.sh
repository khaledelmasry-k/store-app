#!/bin/sh
set -e
cd "$(dirname "$0")"

echo "Applying Prisma migrations..."
npx prisma migrate deploy

echo "Generating Prisma client..."
npx prisma generate

echo "Seeding database..."
npx tsx src/seed.ts

echo "Database ready."
