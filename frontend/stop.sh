#!/bin/bash
# ==============================================================================
# Rocky AI Frontend - Stop Script
# ==============================================================================
# Usage:
#   ./stop.sh          Stop Next.js frontend and release port 3000
#   ./stop.sh --help   Show help
# ==============================================================================

set -e

# Resolve paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PID_FILE="$SCRIPT_DIR/.frontend.pid"

# Load environment configuration if available
if [ -f "$SCRIPT_DIR/.env.local" ]; then
    export $(grep -v '^#' "$SCRIPT_DIR/.env.local" | grep -v '^\s*$' | xargs) 2>/dev/null || true
elif [ -f "$ROOT_DIR/.env" ]; then
    export $(grep -v '^#' "$ROOT_DIR/.env" | grep -v '^\s*$' | xargs) 2>/dev/null || true
fi

PORT="${PORT:-3000}"

if [[ "$1" == "-h" || "$1" == "--help" ]]; then
    echo "Usage: ./stop.sh"
    echo ""
    echo "Stops the Rocky AI Frontend process and releases port $PORT."
    exit 0
fi

echo "=================================================="
echo "🛑 Stopping Rocky AI Frontend (Port: $PORT)"
echo "=================================================="

STOPPED_ANY=false

# 1. Terminate process using saved PID
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE" 2>/dev/null || true)
    if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
        echo "⏹️  Terminating Frontend process tree (PID: $PID)..."
        # Kill child processes first (Next.js spawns node subprocesses/turbopack)
        pkill -P "$PID" 2>/dev/null || true
        kill -TERM "$PID" 2>/dev/null || true
        sleep 1
        if kill -0 "$PID" 2>/dev/null; then
            kill -9 "$PID" 2>/dev/null || true
        fi
        STOPPED_ANY=true
    fi
    rm -f "$PID_FILE"
fi

# 2. Release port if any node/next processes are still bound
PORT_PIDS=$(lsof -ti :"$PORT" 2>/dev/null || true)
if [ -n "$PORT_PIDS" ]; then
    echo "⚠️  Found active processes listening on port $PORT: $PORT_PIDS"
    echo "⏹️  Releasing port $PORT..."
    for p in $PORT_PIDS; do
        pkill -P "$p" 2>/dev/null || true
        kill "$p" 2>/dev/null || true
    done
    sleep 1

    REMAINING_PIDS=$(lsof -ti :"$PORT" 2>/dev/null || true)
    if [ -n "$REMAINING_PIDS" ]; then
        kill -9 $REMAINING_PIDS 2>/dev/null || true
    fi
    STOPPED_ANY=true
fi

# 3. Final verification
if lsof -i :"$PORT" >/dev/null 2>&1; then
    echo "❌ Warning: Port $PORT is still occupied."
    lsof -i :"$PORT"
else
    echo "✅ Port $PORT is completely released."
    echo "✅ Rocky AI Frontend stopped successfully."
fi
echo "=================================================="
