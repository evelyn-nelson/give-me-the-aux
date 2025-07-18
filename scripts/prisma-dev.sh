#!/bin/bash

# Quick Prisma Development Script
# For rapid iteration when you just need to regenerate the client

set -e

echo "⚡ Quick Prisma client regeneration..."

# Check if postgres is running
if ! docker compose ps --services --filter "status=running" | grep -q "postgres"; then
    echo "❌ PostgreSQL is not running. Starting it..."
    docker compose up postgres -d
    sleep 5
fi

echo "📦 Regenerating Prisma client..."
docker compose --profile tools run --rm prisma generate

echo "✅ Prisma client regenerated!"
echo "💡 Tip: If you made schema changes, use './scripts/update-schema.sh' instead" 