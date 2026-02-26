#!/bin/bash
# Riffboard Deployment Script
# Usage: ./deploy.sh [local|remote]

set -e

MODE=${1:-local}

echo "🚀 Riffboard Deployment"
echo "======================"
echo ""

if [ "$MODE" = "local" ]; then
  echo "📍 Deploying locally..."
  echo ""

  # Check if Docker is running
  if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
  fi

  # Build the image
  echo "🔨 Building Docker image..."
  docker build -t riffboard:latest .

  # Stop existing container if running
  if docker ps -a | grep -q riffboard; then
    echo "🛑 Stopping existing container..."
    docker stop riffboard 2>/dev/null || true
    docker rm riffboard 2>/dev/null || true
  fi

  # Run the container
  echo "▶️  Starting Riffboard..."
  docker run -d \
    --name riffboard \
    -p 3456:3456 \
    -v riffboard-data:/data \
    -e NODE_ENV=production \
    -e PORT=3456 \
    -e KEYS_FILE=/data/riffboard-keys.json \
    --restart unless-stopped \
    riffboard:latest

  echo ""
  echo "✅ Riffboard deployed successfully!"
  echo ""
  echo "📊 Container status:"
  docker ps | grep riffboard
  echo ""
  echo "🔗 Access at: http://localhost:3456"
  echo "🏥 Health check: http://localhost:3456/health"
  echo ""
  echo "📝 View logs: docker logs -f riffboard"
  echo "🛑 Stop: docker stop riffboard"
  echo ""

  # Wait for container to start
  sleep 2

  # Health check
  echo "🏥 Running health check..."
  if curl -s http://localhost:3456/health | grep -q "ok"; then
    echo "✅ Health check passed!"
  else
    echo "⚠️  Health check failed. Check logs: docker logs riffboard"
  fi

elif [ "$MODE" = "remote" ]; then
  echo "📍 Deploying to remote server (46.62.214.84)..."
  echo ""

  # Check if SSH key is configured
  if ! ssh -q root@46.62.214.84 exit 2>/dev/null; then
    echo "❌ Cannot connect to server. Check SSH configuration."
    exit 1
  fi

  echo "📤 Syncing code to server..."
  rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'dist' \
    ./ root@46.62.214.84:~/riffboard/

  echo ""
  echo "🔨 Building and deploying on server..."
  ssh root@46.62.214.84 << 'ENDSSH'
    cd ~/riffboard

    # Build image
    docker build -t riffboard:latest .

    # Stop existing container
    docker stop riffboard 2>/dev/null || true
    docker rm riffboard 2>/dev/null || true

    # Run new container
    docker run -d \
      --name riffboard \
      -p 3456:3456 \
      -v riffboard-data:/data \
      -e NODE_ENV=production \
      -e PORT=3456 \
      -e KEYS_FILE=/data/riffboard-keys.json \
      --restart unless-stopped \
      riffboard:latest

    echo ""
    echo "✅ Deployed successfully!"
    echo ""
    docker ps | grep riffboard

    # Health check
    sleep 2
    curl -s http://localhost:3456/health || echo "Health check failed"
ENDSSH

  echo ""
  echo "✅ Remote deployment complete!"
  echo ""
  echo "🔗 Access at: http://46.62.214.84:3456"
  echo "🏥 Health check: http://46.62.214.84:3456/health"
  echo ""
  echo "📝 View logs: ssh root@46.62.214.84 'docker logs -f riffboard'"
  echo ""

else
  echo "❌ Invalid mode. Usage: ./deploy.sh [local|remote]"
  echo ""
  echo "Examples:"
  echo "  ./deploy.sh local    # Deploy locally with Docker"
  echo "  ./deploy.sh remote   # Deploy to Hetzner server"
  exit 1
fi
