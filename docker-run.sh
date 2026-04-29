#!/bin/bash

# ============================================
# Docker Build and Run Script
# ============================================

set -e

echo "🐳 Dataset Docker Setup"
echo "======================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create .env.local if it doesn't exist
if [ ! -f .env.local ]; then
    echo "📝 Creating .env.local from example..."
    cp .env.docker.example .env.local
    echo "⚠️  Please edit .env.local and set your environment variables"
    echo ""
    read -p "Press Enter to continue after editing .env.local..."
fi

echo ""
echo "🏗️  Building production image..."
docker-compose build

echo ""
echo "🚀 Starting production container..."
docker-compose up -d

echo ""
echo "✅ Production container started!"
echo "📊 Check status: docker-compose ps"
echo "📋 View logs: docker-compose logs -f web"
echo "🌐 Access: http://localhost:3000"
