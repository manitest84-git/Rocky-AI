#!/bin/bash
# ==============================================================================
# Rocky AI Frontend - Start Script
# ==============================================================================
# Usage:
#   ./start.sh              Start Next.js frontend in background (daemon mode)
#   ./start.sh -f           Start in foreground (interactive terminal)
#   ./start.sh -p, --prod   Start in production mode (runs `npm run start`)
#   ./start.sh -b, --build  Build frontend bundle before starting
#   ./start.sh -h, --help   Show help
# ==============================================================================

set -e

# Resolve paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PID_FILE="$SCRIPT_DIR/.frontend.pid"
LOG_FILE="$SCRIPT_DIR/frontend.log"

cd "$SCRIPT_DIR"

# Load environment configuration if available
if [ -f "$SCRIPT_DIR/.env.local" ]; then
    export $(grep -v '^#' "$SCRIPT_DIR/.env.local" | grep -v '^\s*$' | xargs) 2>/dev/null || true
elif [ -f "$ROOT_DIR/.env" ]; then
    export $(grep -v '^#' "$ROOT_DIR/.env" | grep -v '^\s*$' | xargs) 2>/dev/null || true
fi

PORT="${PORT:-3000}"

# Parse CLI options
FOREGROUND=false
PROD_MODE=false
DO_BUILD=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        -f|--foreground)
            FOREGROUND=true
            shift
            ;;
        -p|--prod)
            PROD_MODE=true
            shift
            ;;
        -b|--build)
            DO_BUILD=true
            shift
            ;;
        -h|--help)
            echo "Usage: ./start.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  (no args)        Start Next.js frontend in background (default)"
            echo "  -f, --foreground Run in foreground (interactive dev server output)"
            echo "  -p, --prod       Run production server (next start) instead of dev"
            echo "  -b, --build      Build frontend bundle (npm run build) before starting"
            echo "  -h, --help       Show this help message"
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
echo "⚡ Starting Rocky AI Frontend (Next.js - Port: $PORT)"
echo "=================================================="

# Check prerequisites
if ! command -v node >/dev/null 2>&1; then
    echo "❌ Node.js is not installed or not in PATH."
    exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
    echo "❌ npm is not installed or not in PATH."
    exit 1
fi

# Check if node_modules exists
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
    echo "📦 node_modules not found. Installing dependencies..."
    npm install
fi

# Check if already running via PID file
if [ -f "$PID_FILE" ]; then
    EXISTING_PID=$(cat "$PID_FILE" 2>/dev/null || true)
    if [ -n "$EXISTING_PID" ] && kill -0 "$EXISTING_PID" 2>/dev/null; then
        echo "⚠️  Frontend is already running (PID: $EXISTING_PID)!"
        echo "📍 URL:     http://localhost:$PORT"
        echo "📄 Logs:    tail -f frontend/frontend.log"
        echo "🛑 To stop: ./stop.sh"
        exit 0
    else
        rm -f "$PID_FILE"
    fi
fi

# Check if port is already occupied by another process
EXISTING_PORT_PID=$(lsof -ti :"$PORT" 2>/dev/null || true)
if [ -n "$EXISTING_PORT_PID" ]; then
    echo "⚠️  Port $PORT is already in use by process PID: $EXISTING_PORT_PID"
    echo "📍 Check http://localhost:$PORT"
    echo "🛑 To stop it, run: ./stop.sh"
    exit 0
fi

# Optional build step
if [ "$DO_BUILD" = true ]; then
    echo "🔨 Building frontend..."
    npm run build
fi

# Determine launch binary and args
NEXT_BIN="$SCRIPT_DIR/node_modules/.bin/next"
if [ ! -f "$NEXT_BIN" ]; then
    NEXT_BIN="npx next"
fi

if [ "$PROD_MODE" = true ]; then
    RUN_CMD="$NEXT_BIN start -H 0.0.0.0 -p $PORT"
else
    RUN_CMD="$NEXT_BIN dev -H 0.0.0.0 -p $PORT --turbopack"
fi

# Foreground execution
if [ "$FOREGROUND" = true ]; then
    echo "🚀 Starting frontend in foreground (Ctrl+C to stop)..."
    exec $RUN_CMD
fi

# Background daemon execution
echo "🚀 Starting frontend in background..."
python3 -c "import subprocess, sys; p = subprocess.Popen(sys.argv[1:], cwd='$SCRIPT_DIR', start_new_session=True, stdout=open('$LOG_FILE', 'a'), stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL); open('$PID_FILE', 'w').write(str(p.pid))" $RUN_CMD
FRONTEND_PID=$(cat "$PID_FILE" 2>/dev/null || true)

# Wait for frontend to start listening
echo "⏳ Waiting for Next.js to initialize..."
MAX_WAIT=25
WAIT_COUNT=0
READY=false

while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    # Check if process died
    if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
        break
    fi

    # Check if port responds to HTTP requests
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT" 2>/dev/null || true)
    if [ -n "$HTTP_CODE" ] && [ "$HTTP_CODE" != "000" ]; then
        READY=true
        break
    fi

    sleep 1
    WAIT_COUNT=$((WAIT_COUNT + 1))
    echo -n "."
done
echo ""

if [ "$READY" = true ]; then
    echo "✅ Rocky AI Frontend is UP and running!"
    echo "📍 Local URL:    http://localhost:$PORT"
    echo "📍 Network URL:  http://0.0.0.0:$PORT"
    echo "📄 Logs:         tail -f frontend/frontend.log"
    echo "🛑 To stop:      ./stop.sh"
    echo "=================================================="
else
    if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
        echo "❌ Frontend process failed to start or terminated unexpectedly."
    else
        echo "⚠️  Frontend is initializing, but port $PORT is not yet responding."
    fi
    echo "🔍 Recent logs ($LOG_FILE):"
    tail -n 25 "$LOG_FILE"
    echo "=================================================="
    if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
        rm -f "$PID_FILE"
        exit 1
    fi
fi
