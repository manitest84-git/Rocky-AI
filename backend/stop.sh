#!/bin/bash
# ==============================================================================
# Rocky AI Backend - Stop Script
# ==============================================================================
# Usage:
#   ./stop.sh          Stop backend API (container or local process)
#   ./stop.sh --all    Stop all stack services (api, agent, postgres, redis, ollama, livekit)
#   ./stop.sh --down   Stop and remove all containers, networks, and volumes
#   ./stop.sh --help   Show help
# ==============================================================================

set -e

# Resolve paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PID_FILE="$SCRIPT_DIR/.backend.pid"

# Load environment configuration if available
if [ -f "$ROOT_DIR/.env" ]; then
    export $(grep -v '^#' "$ROOT_DIR/.env" | grep -v '^\s*$' | xargs) 2>/dev/null || true
fi

PORT="${BACKEND_PORT:-8333}"

STOP_ALL=false
TEARDOWN=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        -a|--all)
            STOP_ALL=true
            shift
            ;;
        -d|--down)
            TEARDOWN=true
            STOP_ALL=true
            shift
            ;;
        -h|--help)
            echo "Usage: ./stop.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  (no args)    Stop backend API container and local process"
            echo "  -a, --all    Stop all stack containers (docker compose stop)"
            echo "  -d, --down   Stop and remove all containers (docker compose down)"
            echo "  -h, --help   Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown argument: $1"
            echo "Run './stop.sh --help' for usage."
            exit 1
            ;;
    esac
done

echo "=================================================="
echo "🛑 Stopping Rocky AI Backend (Port: $PORT)"
echo "=================================================="

# Function to detect Docker Compose command
get_compose_cmd() {
    if docker compose version >/dev/null 2>&1; then
        echo "docker compose"
    elif command -v docker-compose >/dev/null 2>&1; then
        echo "docker-compose"
    else
        echo ""
    fi
}

STOPPED_ANY=false

# 1. Stop local background PID if present
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE" 2>/dev/null || true)
    if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
        echo "⏹️  Terminating local Python backend (PID: $PID)..."
        kill "$PID" 2>/dev/null || true
        sleep 1
        if kill -0 "$PID" 2>/dev/null; then
            kill -9 "$PID" 2>/dev/null || true
        fi
        STOPPED_ANY=true
    fi
    rm -f "$PID_FILE"
fi

# 2. Stop Docker Compose containers if Docker is available
COMPOSE_CMD=$(get_compose_cmd)
if [ -n "$COMPOSE_CMD" ] && docker info >/dev/null 2>&1; then
    cd "$ROOT_DIR"
    if [ "$TEARDOWN" = true ]; then
        echo "⏹️  Tearing down all Docker Compose containers..."
        $COMPOSE_CMD down
        STOPPED_ANY=true
    elif [ "$STOP_ALL" = true ]; then
        echo "⏹️  Stopping all Docker Compose services..."
        $COMPOSE_CMD stop
        STOPPED_ANY=true
    else
        # Check if api container is running
        API_CONTAINER_RUNNING=$($COMPOSE_CMD ps -q api 2>/dev/null || true)
        if [ -n "$API_CONTAINER_RUNNING" ]; then
            echo "⏹️  Stopping Docker container for backend API..."
            $COMPOSE_CMD stop api
            STOPPED_ANY=true
        fi
    fi
fi

# 3. Clean up any remaining processes bound to port
PORT_PIDS=$(lsof -ti :"$PORT" 2>/dev/null || true)
if [ -n "$PORT_PIDS" ]; then
    echo "⚠️  Found active processes listening on port $PORT: $PORT_PIDS"
    echo "⏹️  Releasing port $PORT..."
    kill $PORT_PIDS 2>/dev/null || true
    sleep 1
    # Force kill if still holding port
    REMAINING_PIDS=$(lsof -ti :"$PORT" 2>/dev/null || true)
    if [ -n "$REMAINING_PIDS" ]; then
        kill -9 $REMAINING_PIDS 2>/dev/null || true
    fi
    STOPPED_ANY=true
fi

# 4. Final verification
if lsof -i :"$PORT" >/dev/null 2>&1; then
    echo "❌ Warning: Port $PORT is still occupied."
    lsof -i :"$PORT"
else
    echo "✅ Port $PORT is completely released."
    echo "✅ Rocky AI Backend stopped successfully."
fi
echo "=================================================="
