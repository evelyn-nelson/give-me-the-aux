#!/bin/bash

# Quick Prisma Development Script
# For rapid iteration when you just need to regenerate the client
# Generates client on BOTH host and container for editor integration

set -e

echo "⚡ Quick Prisma client regeneration..."

# Check if postgres is running
if ! docker compose ps --services --filter "status=running" | grep -q "postgres"; then
    echo "❌ PostgreSQL is not running. Starting it..."
    docker compose up postgres -d
    sleep 5
fi

# Function to check if host has Prisma CLI
check_host_prisma() {
    if ! command -v npx >/dev/null 2>&1; then
        echo "❌ npx not found. Please install Node.js on the host system."
        exit 1
    fi
    
    if ! cd backend && npx prisma --version >/dev/null 2>&1; then
        echo "❌ Prisma CLI not available on host. Installing dependencies..."
        cd backend && npm install
    fi
}

echo "🔧 Checking host Prisma CLI..."
check_host_prisma

echo "📦 Regenerating Prisma client on HOST (for editor integration)..."
if [ -d "backend" ]; then
    (cd backend && npx prisma generate)
else
    echo "⚠️  Backend directory not found, trying from current directory..."
    npx prisma generate
fi

echo "📦 Regenerating Prisma client in CONTAINER..."
docker compose --profile tools run --rm prisma generate

echo "✅ Prisma client regenerated on BOTH host and container!"
echo "🎯 Your text editor should now see the updated types"
echo "💡 Tip: If you made schema changes, use './scripts/update-schema.sh' instead" 