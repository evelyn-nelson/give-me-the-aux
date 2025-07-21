#!/bin/bash

# Prisma Schema Update Script
# This script handles the complete workflow for updating Prisma schema in Docker
# AND on the host filesystem for editor integration

set -e  # Exit on any error

echo "🚀 Starting Prisma schema update process..."

# Function to check if Docker Compose is running
check_services() {
    if ! docker compose ps --services --filter "status=running" | grep -q "postgres"; then
        echo "❌ PostgreSQL service is not running. Starting services..."
        docker compose up postgres -d
        echo "⏳ Waiting for PostgreSQL to be ready..."
        sleep 10
    fi
}

# Function to stop backend to avoid conflicts
stop_backend() {
    echo "🛑 Stopping backend service to avoid conflicts..."
    docker compose stop backend || true
}

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

# Function to regenerate Prisma client and push schema
update_prisma() {
    echo "🔧 Checking host Prisma CLI..."
    check_host_prisma
    
    echo "📦 Generating Prisma client on HOST (for editor integration)..."
    cd backend && npx prisma generate
    
    echo "📦 Generating Prisma client in CONTAINER..."
    docker compose --profile tools run --rm prisma generate
    
    echo "🗄️ Pushing schema to database..."
    docker compose --profile tools run --rm prisma db push --accept-data-loss
    
    echo "🔄 Regenerating Prisma client on HOST after schema push..."
    cd backend && npx prisma generate
    
    echo "🔄 Regenerating Prisma client in CONTAINER after schema push..."
    docker compose --profile tools run --rm prisma generate
}

# Function to restart backend
restart_backend() {
    echo "🔄 Restarting backend service..."
    docker compose up backend -d
    
    echo "⏳ Waiting for backend to start..."
    sleep 5
    
    # Check if backend is healthy
    if docker compose ps --services --filter "status=running" | grep -q "backend"; then
        echo "✅ Backend restarted successfully"
    else
        echo "❌ Backend failed to start. Check logs with: docker compose logs backend"
        exit 1
    fi
}

# Function to show logs
show_logs() {
    echo "📋 Recent backend logs:"
    docker compose logs --tail=20 backend
}

# Main execution
main() {
    echo "🔍 Checking Docker services..."
    check_services
    
    stop_backend
    update_prisma
    restart_backend
    
    echo ""
    echo "✅ Schema update completed successfully!"
    echo "📝 Prisma client generated on BOTH host and container"
    echo "🎯 Your text editor should now see the updated types"
    echo ""
    echo "📋 Next steps:"
    echo "1. Restart your TypeScript language server if types don't appear immediately"
    echo "2. Check backend logs: docker compose logs backend"
    echo "3. Test your API endpoints"
    echo ""
    
    # Optionally show recent logs
    read -p "Show recent backend logs? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        show_logs
    fi
}

# Run main function
main "$@" 