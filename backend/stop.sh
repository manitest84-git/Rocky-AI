#!/bin/bash
# ==============================================================================
# Rocky AI Backend - Stop Script
# ==============================================================================
# Usage:
#   ./stop.sh            Stop all stack containers and local backend process (default)
#   ./stop.sh -a, --all  Stop all stack containers (default)
#   ./stop.sh -d, --down Stop and remove all containers and networks
#   ./stop.sh -v, --volumes Stop and remove containers, networks, and named volumes
#   ./stop.sh --api-only Stop only the backend API container and local process
#   ./stop.sh -h, --help Show help
# ==============================================================================

set -e

# Resolve paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PID_FILE="$SCRIPT_DIR/.backend.pid"

# Load environment configuration if available
if [ -f "$ROOT_DIR/.env" ]; then
    export $(grep -v '^#' "$ROOT_DIR/.env" | grep -v '^\s*$' | xargs) 2>/dev/null || true
elif [ -f "$SCRIPT_DIR/.env" ]; then
    export $(grep -v '^#' "$SCRIPT_DIR/.env" | grep -v '^\s*$' | xargs) 2>/dev/null || true
fi

# Auto-detect OLLAMA_PORT to avoid port collisions with host Ollama service
if [ -z "$OLLAMA_PORT" ]; then
    if lsof -ti :11434 >/dev/null 2>&1 || (command -v ss >/dev/null 2>&1 && ss -tulpn 2>/dev/null | grep -q ":11434\b"); then
        export OLLAMA_PORT=11435
    else
        export OLLAMA_PORT=11434
    fi
fi

PORT="${BACKEND_PORT:-8333}"

STOP_TARGET="all"
TEARDOWN=false
REMOVE_VOLUMES=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        -a|--all)
            STOP_TARGET="all"
            shift
            ;;
        -d|--down)
            TEARDOWN=true
            STOP_TARGET="all"
            shift
            ;;
        -v|--volumes)
            TEARDOWN=true
            REMOVE_VOLUMES=true
            STOP_TARGET="all"
            shift
            ;;
        --api-only)
            STOP_TARGET="api"
            shift
            ;;
        -h|--help)
            echo "Usage: ./stop.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  (no args)       Stop all stack containers and local backend process (default)"
            echo "  -a, --all       Stop all stack containers (docker compose stop)"
            echo "  -d, --down      Stop and remove all containers and networks (docker compose down)"
            echo "  -v, --volumes   Stop and remove containers, networks, and volumes (docker compose down -v)"
            echo "  --api-only      Stop only backend API container and local process"
            echo "  -h, --help      Show this help message"
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
echo "🛑 Stopping Rocky AI Backend & Docker Containers"
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
        pkill -P "$PID" 2>/dev/null || true
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
        if [ "$REMOVE_VOLUMES" = true ]; then
            echo "⏹️  Tearing down all Docker Compose containers, networks, and volumes..."
            $COMPOSE_CMD down -v
        else
            echo "⏹️  Tearing down all Docker Compose containers and networks..."
            $COMPOSE_CMD down
        fi
        STOPPED_ANY=true
    elif [ "$STOP_TARGET" = "api" ]; then
        API_CONTAINER_RUNNING=$($COMPOSE_CMD ps -q api 2>/dev/null || true)
        if [ -n "$API_CONTAINER_RUNNING" ]; then
            echo "⏹️  Stopping Docker container for backend API..."
            $COMPOSE_CMD stop api
            STOPPED_ANY=true
        fi
    else
        # Default: stop all stack containers properly
        echo "⏹️  Stopping all Docker Compose services (api, agent, postgres, redis, ollama, livekit)..."
        $COMPOSE_CMD stop
        STOPPED_ANY=true

        # Verify no project containers are still running; if any remain, ensure they stop
        STILL_RUNNING=$($COMPOSE_CMD ps -q --filter "status=running" 2>/dev/null || true)
        if [ -n "$STILL_RUNNING" ]; then
            echo "⚠️  Some containers are still running, waiting for graceful stop..."
            sleep 1
            STILL_RUNNING=$($COMPOSE_CMD ps -q --filter "status=running" 2>/dev/null || true)
            if [ -n "$STILL_RUNNING" ]; then
                echo "⏹️  Force-stopping remaining containers: $STILL_RUNNING"
                docker stop $STILL_RUNNING 2>/dev/null || true
            fi
        fi
    fi
fi

# 3. Clean up any remaining processes bound to port
PORT_PIDS=$(lsof -ti :"$PORT" 2>/dev/null || true)
if [ -n "$PORT_PIDS" ]; then
    echo "⚠️  Found active processes listening on port $PORT: $PORT_PIDS"
    echo "⏹️  Releasing port $PORT..."
    for p in $PORT_PIDS; do
        pkill -P "$p" 2>/dev/null || true
        kill "$p" 2>/dev/null || true
    done
    sleep 1
    # Force kill if still holding port
    REMAINING_PIDS=$(lsof -ti :"$PORT" 2>/dev/null || true)
    if [ -n "$REMAINING_PIDS" ]; then
        kill -9 $REMAINING_PIDS 2>/dev/null || true
    fi
    STOPPED_ANY=true
fi

# 4. Final verification
cd "$ROOT_DIR"
if [ -n "$COMPOSE_CMD" ] && docker info >/dev/null 2>&1; then
    RUNNING_SERVICES=$($COMPOSE_CMD ps --services --filter "status=running" 2>/dev/null || true)
    if [ -n "$RUNNING_SERVICES" ]; then
        echo "⚠️  Warning: Following Docker containers are still running: $RUNNING_SERVICES"
    else
        echo "✅ All Docker containers stopped properly."
    fi
fi

if lsof -i :"$PORT" >/dev/null 2>&1; then
    echo "❌ Warning: Port $PORT is still occupied."
    lsof -i :"$PORT"
else
    echo "✅ Port $PORT is completely released."
    echo "✅ Rocky AI Backend stopped successfully."
fi
echo "=================================================="
