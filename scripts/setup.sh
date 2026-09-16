#!/bin/bash
set -e

echo "=== Jarvis AI Setup ==="

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo >&2 "Docker is required but it's not installed. Aborting."; exit 1; }
command -v node >/dev/null 2>&1 || { echo >&2 "Node.js is required but it's not installed. Aborting."; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo >&2 "Python 3 is required but it's not installed. Aborting."; exit 1; }

# Setup environment variables
if [ ! -f .env ]; then
    echo "Copying .env.example to .env..."
    cp .env.example .env
else
    echo ".env already exists, skipping."
fi

# Ollama model setup
echo "Starting Ollama to pull and create models..."
# Temporarily start just ollama to pull models
docker compose up -d ollama
echo "Waiting for Ollama to be ready..."
sleep 5

echo "Pulling llama3.1:8b model..."
docker compose exec ollama ollama pull llama3.1:8b

if [ -f "agent/modelfile" ]; then
    echo "Creating Jarvis modelfile..."
    # We copy the modelfile to the ollama container to create it
    docker cp agent/modelfile $(docker compose ps -q ollama):/tmp/modelfile
    docker compose exec ollama ollama create jarvis -f /tmp/modelfile
else
    echo "Warning: agent/modelfile not found, skipping model creation."
fi

docker compose stop ollama

# Install dependencies
echo "Installing frontend dependencies..."
if [ -d "frontend" ]; then
    (cd frontend && npm install)
else
    echo "Warning: frontend directory not found."
fi

echo "Installing backend dependencies..."
if [ -d "backend" ] && [ -f "backend/requirements.txt" ]; then
    python3 -m pip install -r backend/requirements.txt
else
    echo "Warning: backend/requirements.txt not found."
fi

echo "Installing agent dependencies..."
if [ -d "agent" ] && [ -f "agent/requirements.txt" ]; then
    python3 -m pip install -r agent/requirements.txt
else
    echo "Warning: agent/requirements.txt not found."
fi

echo "Generating LiveKit API keys (using defaults in .env)..."
# In a real scenario, you might generate cryptographically secure keys here
# For now, we rely on the defaults copied from .env.example

echo "=== Setup Complete! ==="
echo "Next steps:"
echo "1. Run 'make dev' to start the backend services."
echo "2. Open a new terminal and run 'cd frontend && npm run dev' to start the UI."
