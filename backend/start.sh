#!/bin/bash
# ==============================================================================
# Rocky AI Backend - Start Script
# ==============================================================================
# Usage:
#   ./start.sh            Start all stack containers via Docker Compose & setup venv (default)
#   ./start.sh -b, --build Rebuild Docker images before starting all containers
#   ./start.sh -l, --local Start backend locally with uvicorn (host venv) + supporting containers
#   ./start.sh --api-only  Start only the backend API container in Docker
#   ./start.sh -f, --logs  Start and immediately stream logs
#   ./start.sh -h, --help  Show help
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

# Parse CLI options
MODE="docker"
REBUILD=false
START_TARGET="all"
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
            START_TARGET="all"
            shift
            ;;
        --api-only)
            START_TARGET="api"
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
            echo "  (no args)       Start all stack containers via Docker Compose & setup venv (default)"
            echo "  -b, --build     Rebuild Docker images before starting all containers"
            echo "  -l, --local     Run backend locally in venv with Uvicorn + supporting containers"
            echo "  -a, --all       Start all containers (default)"
            echo "  --api-only      Start only the backend API container in Docker"
            echo "  -f, --logs      Follow logs after service startup"
            echo "  -h, --help      Show this help message"
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
echo "⚡ Starting Rocky AI Backend Stack (Port: $PORT)"
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

# ------------------------------------------------------------------------------
# VIRTUAL ENVIRONMENT (VENV) SETUP & VALIDATION
# ------------------------------------------------------------------------------
echo "🐍 Checking Python Virtual Environment..."

# Find candidate venv directory
VENV_PATH=""
for candidate in "$VIRTUAL_ENV" "$SCRIPT_DIR/venv" "$SCRIPT_DIR/.venv" "$ROOT_DIR/venv" "$ROOT_DIR/.venv"; do
    if [ -n "$candidate" ] && [ -f "$candidate/bin/activate" ]; then
        VENV_PATH="$candidate"
        break
    fi
done

# If no venv exists, create one at backend/venv
if [ -z "$VENV_PATH" ]; then
    echo "📦 No virtual environment found. Creating one at $SCRIPT_DIR/venv..."
    if command -v python3 >/dev/null 2>&1; then
        python3 -m venv "$SCRIPT_DIR/venv"
        VENV_PATH="$SCRIPT_DIR/venv"
        echo "✅ Created virtual environment at $VENV_PATH"
    else
        echo "❌ python3 not found. Cannot create virtual environment."
        if [ "$MODE" = "local" ]; then
            exit 1
        fi
    fi
fi

# Activate and configure venv environment
if [ -n "$VENV_PATH" ] && [ -f "$VENV_PATH/bin/activate" ]; then
    echo "📦 Activating virtual environment: $VENV_PATH"
    source "$VENV_PATH/bin/activate"
    export VIRTUAL_ENV="$VENV_PATH"
    export PATH="$VENV_PATH/bin:$PATH"

    # Verify dependencies if requirements.txt exists
    if [ -f "$SCRIPT_DIR/requirements.txt" ]; then
        if ! python3 -c "import uvicorn, fastapi, asyncpg" >/dev/null 2>&1; then
            echo "📦 Installing missing dependencies into venv from requirements.txt..."
            pip install -r "$SCRIPT_DIR/requirements.txt"
        fi
    fi
    echo "✅ Python virtual environment is ready: $(python3 -V 2>/dev/null || true) ($VENV_PATH)"
fi

# ------------------------------------------------------------------------------
# DOCKER SERVICES STARTUP
# ------------------------------------------------------------------------------
COMPOSE_CMD=$(get_compose_cmd)
if [ -z "$COMPOSE_CMD" ]; then
    echo "❌ Docker Compose is not installed or not in PATH."
    exit 1
fi

# Verify Docker daemon is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker daemon is not running. Please start Docker and retry."
    exit 1
fi

cd "$ROOT_DIR"

BUILD_FLAG=""
if [ "$REBUILD" = true ]; then
    BUILD_FLAG="--build"
    echo "🔨 Building Docker images..."
fi

if [ "$MODE" = "local" ]; then
    echo "▶ Mode: Local Python / Uvicorn + Supporting Docker Services"

    # Check if local port is already occupied
    if lsof -i :"$PORT" >/dev/null 2>&1; then
        echo "⚠️  Port $PORT is already in use."
        if curl -s "http://localhost:${PORT}/api/health" >/dev/null 2>&1; then
            echo "⚠️  Backend API is already running on port ${PORT}!"
        fi
    fi

    # Check for uvicorn in venv
    if ! command -v uvicorn >/dev/null 2>&1; then
        echo "❌ 'uvicorn' command not found in virtual environment."
        echo "💡 Installing uvicorn into $VENV_PATH..."
        pip install uvicorn[standard]
    fi

    # Start all supporting docker containers (database, cache, ollama, livekit, agent)
    echo "🚀 Starting supporting Docker containers (postgres, redis, ollama, livekit-server, agent)..."
    $COMPOSE_CMD up -d $BUILD_FLAG postgres redis ollama livekit-server agent

    # Stop any conflicting Docker api container
    API_DOCKER_RUNNING=$($COMPOSE_CMD ps -q api 2>/dev/null || true)
    if [ -n "$API_DOCKER_RUNNING" ]; then
        echo "⏹️  Stopping Docker 'api' container to run backend locally on port $PORT..."
        $COMPOSE_CMD stop api 2>/dev/null || true
    fi

    echo "🚀 Launching Uvicorn server in background (venv: $VENV_PATH)..."
    cd "$SCRIPT_DIR"
    python3 -c "import subprocess, sys; p = subprocess.Popen(sys.argv[1:], cwd='$SCRIPT_DIR', start_new_session=True, stdout=open('$LOG_FILE', 'a'), stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL); open('$PID_FILE', 'w').write(str(p.pid))" uvicorn main:app --host 0.0.0.0 --port "$PORT" --reload
    BACKEND_PID=$(cat "$PID_FILE" 2>/dev/null || true)

else
    echo "▶ Mode: Docker Compose (All Containers)"

    if [ "$START_TARGET" = "api" ]; then
        echo "🚀 Starting backend API service..."
        $COMPOSE_CMD up -d $BUILD_FLAG api
    else
        echo "🚀 Starting all Docker Compose services (api, agent, postgres, redis, ollama, livekit)..."
        $COMPOSE_CMD up -d $BUILD_FLAG
    fi
fi

# ------------------------------------------------------------------------------
# HEALTH CHECK & CONFIRMATION
# ------------------------------------------------------------------------------
echo "⏳ Waiting for backend to become ready..."
MAX_WAIT=25
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

    echo "📋 Active Docker Services:"
    cd "$ROOT_DIR" && $COMPOSE_CMD ps --format "table {{.Service}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || true
    echo "=================================================="

    if [ "$FOLLOW_LOGS" = true ]; then
        if [ "$MODE" = "local" ]; then
            tail -f "$LOG_FILE"
        else
            cd "$ROOT_DIR" && $COMPOSE_CMD logs -f
        fi
    fi
else
    echo "⚠️  Backend started but health check timed out after ${MAX_WAIT}s."
    echo "🔍 Check logs for details:"
    if [ "$MODE" = "local" ]; then
        tail -n 25 "$LOG_FILE" 2>/dev/null || true
    else
        cd "$ROOT_DIR" && $COMPOSE_CMD logs --tail 25 api 2>/dev/null || true
    fi
fi
