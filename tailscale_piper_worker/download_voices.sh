#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VOICES_DIR="${SCRIPT_DIR}/voices"
mkdir -p "${VOICES_DIR}"

BASE_URL="https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB"

download_voice() {
    local name="$1"
    local subpath="$2"
    echo "----------------------------------------------------"
    echo "Downloading ${name} into ${VOICES_DIR}..."

    if [ ! -f "${VOICES_DIR}/${name}.onnx" ]; then
        curl -L -f --progress-bar -o "${VOICES_DIR}/${name}.onnx" "${BASE_URL}/${subpath}/${name}.onnx"
    else
        echo "✓ ${name}.onnx already exists."
    fi

    if [ ! -f "${VOICES_DIR}/${name}.onnx.json" ]; then
        curl -L -f --progress-bar -o "${VOICES_DIR}/${name}.onnx.json" "${BASE_URL}/${subpath}/${name}.onnx.json"
    else
        echo "✓ ${name}.onnx.json already exists."
    fi
}

# 1. Alan Low (British J.A.R.V.I.S. Male - Calm & Natural)
download_voice "en_GB-alan-low" "alan/low"

# 2. Southern English Female Low (British F.R.I.D.A.Y. Female - Crisp)
download_voice "en_GB-southern_english_female-low" "southern_english_female/low"

# 3. Cori Medium (British Studio Quality)
download_voice "en_GB-cori-medium" "cori/medium"

echo "----------------------------------------------------"
echo "All British Piper voices downloaded successfully to ${VOICES_DIR}:"
ls -lh "${VOICES_DIR}"
