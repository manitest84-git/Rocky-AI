#!/usr/bin/env bash
# ==============================================================================
# Piper TTS Private Tailscale Worker Setup for macOS
# Standalone Native Binary with Bundled Dynamic Libraries (libespeak-ng, onnxruntime)
# ZERO pip conflicts, ZERO compilation required.
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

echo "======================================================================"
echo "🚀 [1/3] Detecting macOS Architecture..."
ARCH="$(uname -m)"
echo "Detected CPU Architecture: ${ARCH}"

PIPER_URL=""
PHONEMIZE_URL=""
if [ "${ARCH}" = "arm64" ]; then
    echo "Apple Silicon (M1/M2/M3/M4) detected."
    PIPER_URL="https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_macos_aarch64.tar.gz"
    PHONEMIZE_URL="https://github.com/rhasspy/piper-phonemize/releases/download/2023.11.14-4/piper-phonemize_macos_aarch64.tar.gz"
elif [ "${ARCH}" = "x86_64" ]; then
    echo "Intel Mac detected."
    PIPER_URL="https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_macos_x64.tar.gz"
    PHONEMIZE_URL="https://github.com/rhasspy/piper-phonemize/releases/download/2023.11.14-4/piper-phonemize_macos_x64.tar.gz"
else
    echo "Defaulting to arm64..."
    PIPER_URL="https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_macos_aarch64.tar.gz"
    PHONEMIZE_URL="https://github.com/rhasspy/piper-phonemize/releases/download/2023.11.14-4/piper-phonemize_macos_aarch64.tar.gz"
fi

mkdir -p piper

# 1. Download native piper executable
if [ ! -f "piper/piper" ]; then
    echo "📥 Downloading native macOS Piper binary from GitHub releases..."
    curl -L -f --progress-bar -o piper_macos.tar.gz "${PIPER_URL}"
    tar -xzf piper_macos.tar.gz
    rm -f piper_macos.tar.gz
    chmod +x piper/piper
fi

# 2. Download missing companion dynamic libraries (libespeak-ng.1.dylib, libonnxruntime, etc.)
if [ ! -f "piper/libespeak-ng.1.dylib" ]; then
    echo "📥 Downloading native runtime dynamic libraries (libespeak-ng, onnxruntime)..."
    curl -L -f --progress-bar -o phonemize.tar.gz "${PHONEMIZE_URL}"
    mkdir -p tmp_phonemize
    tar -xzf phonemize.tar.gz -C tmp_phonemize
    cp -P tmp_phonemize/piper-phonemize/lib/*.dylib piper/
    rm -rf phonemize.tar.gz tmp_phonemize
    echo "✓ Dynamic libraries installed in ${SCRIPT_DIR}/piper/"
fi

# 3. Strip macOS quarantine attributes so macOS allows running without popups
xattr -cr piper 2>/dev/null || true

echo "✓ Native Piper engine and libraries ready in ${SCRIPT_DIR}/piper/"

echo ""
echo "======================================================================"
echo "📥 [2/3] Checking British J.A.R.V.I.S. Voice Models..."
bash download_voices.sh

echo ""
echo "======================================================================"
echo "✅ [3/3] Starting Piper TTS Worker Server on port 5000..."
echo "   Listening on 0.0.0.0:5000"
echo "   Tailscale Mesh IP: http://100.125.118.104:5000"
echo "   Press Ctrl+C to stop."
echo "======================================================================"
python3 server.py
