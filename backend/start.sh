#!/bin/bash
# ==============================================================================
# Rocky AI Backend - Start Script
# ==============================================================================
# Usage:
#   ./start.sh          Start backend via Docker Compose (default)
#   ./start.sh --build  Rebuild and start backend container
#   ./start.sh --all    Start all stack services (api, agent, postgres, redis, ollama, livekit)
#   ./start.sh --local  Start backend locally with uvicorn (host Python/venv)
#   ./start.sh --logs   Start and immediately stream logs
#   ./start.sh --help   Show help
# ==============================================================================

set -e

# Resolve paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PID_FILE="$SCRIPT_DIR/.backend.pid"
LOG_FILE="$SCRIPT_DIR/backend.log"

# Load environment configuration if available
if [ -f "$ROOT_DIR/.env" ]; then
    export $(grep -v '^#' "$ROOT_DIR/.env" | grep -v '^\s*$' | xargs) 2>/dev/null || true
fi

PORT="${BACKEND_PORT:-8333}"

# Parse CLI options
MODE="docker"
REBUILD=false
START_ALL=false
FOLLOW_LOGS=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        -l|--local)
            MODE="local"
            shift
            ;;
        -b|--build)
            REBUILD=true
            shift
            ;;
        -a|--all)
            START_ALL=true
            shift
            ;;
        -f|--logs)
            FOLLOW_LOGS=true
            shift
            ;;
        -h|--help)
            echo "Usage: ./start.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  (no args)     Start backend container via Docker Compose (default)"
            echo "  -b, --build   Rebuild the backend container image before starting"
            echo "  -a, --all     Start all services (api, agent, postgres, redis, ollama, livekit)"
            echo "  -l, --local   Run backend locally on host Python with Uvicorn"
            echo "  -f, --logs    Follow logs after service startup"
            echo "  -h, --help    Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown argument: $1"
            echo "Run './start.sh --help' for usage."
            exit 1
            ;;
    esac
done

echo "=================================================="
echo "⚡ Starting Rocky AI Backend API (Port: $PORT)"
echo "=================================================="

# Check if service is already running on the port
if curl -s "http://localhost:${PORT}/api/health" >/dev/null 2>&1; then
    echo "⚠️  Backend is already running and healthy on port ${PORT}!"
    echo "📍 API URL:   http://localhost:${PORT}"
    echo "📖 API Docs:  http://localhost:${PORT}/docs"
    echo "🛑 To stop:   ./stop.sh"
    exit 0
fi

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

# ------------------------------------------------------------------------------
# LOCAL PYTHON MODE
# ------------------------------------------------------------------------------
if [ "$MODE" = "local" ]; then
    echo "▶ Mode: Local Python / Uvicorn"
    cd "$SCRIPT_DIR"

    # Check for virtualenv in backend or root
    VENV_PATH=""
    for candidate in "$SCRIPT_DIR/.venv" "$SCRIPT_DIR/venv" "$ROOT_DIR/.venv" "$ROOT_DIR/venv"; do
        if [ -f "$candidate/bin/activate" ]; then
            VENV_PATH="$candidate"
            break
        fi
    done

    if [ -n "$VENV_PATH" ]; then
        echo "📦 Activating virtual environment: $VENV_PATH"
        source "$VENV_PATH/bin/activate"
    fi

    # Check for uvicorn
    if ! command -v uvicorn >/dev/null 2>&1; then
        echo "❌ 'uvicorn' command not found."
        echo "💡 Install dependencies with: pip install -r requirements.txt"
        echo "💡 Or run with Docker: ./start.sh"
        exit 1
    fi

    echo "🚀 Launching Uvicorn server in background..."
    python3 -c "import subprocess, sys; p = subprocess.Popen(sys.argv[1:], cwd='$SCRIPT_DIR', start_new_session=True, stdout=open('$LOG_FILE', 'a'), stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL); open('$PID_FILE', 'w').write(str(p.pid))" uvicorn main:app --host 0.0.0.0 --port "$PORT" --reload
    BACKEND_PID=$(cat "$PID_FILE" 2>/dev/null || true)

# ------------------------------------------------------------------------------
# DOCKER COMPOSE MODE (Default)
# ------------------------------------------------------------------------------
else
    echo "▶ Mode: Docker Compose"
    cd "$ROOT_DIR"

    COMPOSE_CMD=$(get_compose_cmd)
    if [ -z "$COMPOSE_CMD" ]; then
        echo "❌ Docker Compose is not installed or not in PATH."
        echo "💡 To run directly on Python, use: ./start.sh --local"
        exit 1
    fi

    # Verify Docker daemon is running
    if ! docker info >/dev/null 2>&1; then
        echo "❌ Docker daemon is not running. Please start Docker and retry."
        exit 1
    fi

    BUILD_FLAG=""
    if [ "$REBUILD" = true ]; then
        BUILD_FLAG="--build"
        echo "🔨 Building backend image..."
    fi

    if [ "$START_ALL" = true ]; then
        echo "🚀 Starting all Docker Compose services..."
        $COMPOSE_CMD up -d $BUILD_FLAG
    else
        echo "🚀 Starting backend API service..."
        $COMPOSE_CMD up -d $BUILD_FLAG api
    fi
fi

# ------------------------------------------------------------------------------
# HEALTH CHECK & CONFIRMATION
# ------------------------------------------------------------------------------
echo "⏳ Waiting for backend to become ready..."
MAX_WAIT=20
WAIT_COUNT=0
HEALTHY=false

while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    if curl -s "http://localhost:${PORT}/api/health" >/dev/null 2>&1; then
        HEALTHY=true
        break
    fi
    sleep 1
    WAIT_COUNT=$((WAIT_COUNT + 1))
    echo -n "."
done
echo ""

if [ "$HEALTHY" = true ]; then
    echo "✅ Rocky AI Backend API is UP and running!"
    echo "📍 API URL:   http://localhost:${PORT}"
    echo "📖 API Docs:  http://localhost:${PORT}/docs"
    echo "🩺 Health:    http://localhost:${PORT}/api/health"
    if [ "$MODE" = "local" ]; then
        echo "📄 Logs:      tail -f backend/backend.log"
    else
        echo "📄 Logs:      docker compose logs -f api"
    fi
    echo "🛑 To stop:   ./stop.sh"
    echo "=================================================="

    if [ "$FOLLOW_LOGS" = true ]; then
        if [ "$MODE" = "local" ]; then
            tail -f "$LOG_FILE"
        else
            cd "$ROOT_DIR" && $(get_compose_cmd) logs -f api
        fi
    fi
else
    echo "⚠️  Backend started but health check timed out after ${MAX_WAIT}s."
    echo "🔍 Check logs for details:"
    if [ "$MODE" = "local" ]; then
        tail -n 25 "$LOG_FILE"
    else
        cd "$ROOT_DIR" && $(get_compose_cmd) logs --tail 25 api
    fi
fi
