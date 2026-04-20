#!/usr/bin/env sh
set -eu

cd /app/apps/api

echo "[api] applying migrations (prisma migrate deploy)..."
npx prisma migrate deploy

echo "[api] starting NestJS..."
exec node dist/main.js
