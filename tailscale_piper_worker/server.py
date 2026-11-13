#!/usr/bin/env python3
"""
Piper TTS Private Tailscale Worker Server.
Runs 100% locally on your Mac Mini / Tailscale node (100.125.118.104).
Supports native macOS binary (Apple Silicon / Intel) or python piper-tts.
Uses Python standard library (Zero external pip dependencies required).
"""

import os
import sys
import json
import logging
import subprocess
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("piper-worker")

BASE_DIR = Path(__file__).resolve().parent
VOICES_DIR = BASE_DIR / "voices"

# Locate piper binary: check ./piper/piper first, then system PATH
PIPER_BIN = None
local_bin = BASE_DIR / "piper" / "piper"
if local_bin.exists() and os.access(local_bin, os.X_OK):
    PIPER_BIN = str(local_bin)
elif local_bin.exists():
    os.chmod(local_bin, 0o755)
    PIPER_BIN = str(local_bin)
else:
    import shutil
    sys_bin = shutil.which("piper")
    if sys_bin:
        PIPER_BIN = sys_bin

HAVE_PIPER_MODULE = False
try:
    from piper.voice import PiperVoice
    HAVE_PIPER_MODULE = True
except ImportError:
    HAVE_PIPER_MODULE = False

VOICE_CONFIGS = {
    "en_GB-alan-low": {
        "model": VOICES_DIR / "en_GB-alan-low.onnx",
        "config": VOICES_DIR / "en_GB-alan-low.onnx.json",
        "sample_rate": 16000,
        "description": "British J.A.R.V.I.S. Male (Calm & Natural)"
    },
    "en_GB-southern_english_female-low": {
        "model": VOICES_DIR / "en_GB-southern_english_female-low.onnx",
        "config": VOICES_DIR / "en_GB-southern_english_female-low.onnx.json",
        "sample_rate": 16000,
        "description": "British F.R.I.D.A.Y. Female (Clear & Crisp)"
    },
    "en_GB-cori-medium": {
        "model": VOICES_DIR / "en_GB-cori-medium.onnx",
        "config": VOICES_DIR / "en_GB-cori-medium.onnx.json",
        "sample_rate": 22050,
        "description": "British Studio J.A.R.V.I.S. (High Fidelity)"
    }
}

IN_MEMORY_VOICES = {}

def init_voices():
    global IN_MEMORY_VOICES
    if HAVE_PIPER_MODULE:
        logger.info("Using in-memory piper Python module...")
        for name, meta in VOICE_CONFIGS.items():
            if meta["model"].exists() and meta["config"].exists():
                try:
                    v = PiperVoice.load(str(meta["model"]), config_path=str(meta["config"]))
                    IN_MEMORY_VOICES[name] = {
                        "instance": v,
                        "sample_rate": v.config.sample_rate or meta["sample_rate"],
                        "description": meta["description"]
                    }
                    logger.info(f"Loaded in-memory: {name} ({meta['sample_rate']}Hz)")
                except Exception as e:
                    logger.warning(f"Could not load in-memory {name}: {e}")
    
    if not IN_MEMORY_VOICES:
        if PIPER_BIN:
            logger.info(f"Using native Piper binary: {PIPER_BIN}")
        else:
            logger.warning("No Piper binary or Python module found! Run bash setup_mac.sh to install.")

def synthesize_text(text: str, voice_name: str) -> tuple[bytes, int]:
    """Returns (raw_pcm_bytes, sample_rate)"""
    if voice_name not in VOICE_CONFIGS:
        voice_name = "en_GB-alan-low"
    
    meta = VOICE_CONFIGS[voice_name]
    sample_rate = meta["sample_rate"]

    # 1. In-memory Python Piper (if loaded)
    if voice_name in IN_MEMORY_VOICES:
        pcm = bytearray()
        for chunk in IN_MEMORY_VOICES[voice_name]["instance"].synthesize(text):
            if chunk and hasattr(chunk, "audio_int16_bytes"):
                pcm.extend(chunk.audio_int16_bytes)
        return bytes(pcm), sample_rate

    # 2. Native Piper Binary
    if PIPER_BIN:
        model_path = meta["model"]
        if not model_path.exists():
            raise FileNotFoundError(f"Voice model file not found: {model_path}")
        
        piper_dir = str(Path(PIPER_BIN).resolve().parent)
        env = os.environ.copy()
        env["DYLD_LIBRARY_PATH"] = f"{piper_dir}:/opt/homebrew/lib:/usr/local/lib:{env.get('DYLD_LIBRARY_PATH', '')}"
        env["DYLD_FALLBACK_LIBRARY_PATH"] = f"{piper_dir}:/opt/homebrew/lib:/usr/local/lib:{env.get('DYLD_FALLBACK_LIBRARY_PATH', '')}"

        proc = subprocess.Popen(
            [PIPER_BIN, "--model", str(model_path), "--output_raw"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env
        )
        out, err = proc.communicate(input=text.encode("utf-8"))
        if proc.returncode != 0:
            raise RuntimeError(f"Piper binary failed: {err.decode('utf-8', errors='ignore')}")
        return out, sample_rate

    raise RuntimeError("No Piper engine available (neither native binary nor python module)")


class PiperHTTPHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path in ("/health", "/"):
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            voices_available = [
                name for name, m in VOICE_CONFIGS.items() if m["model"].exists()
            ]
            res = {
                "status": "ok",
                "service": "piper-tts-tailscale-worker",
                "engine": "native-binary" if PIPER_BIN else ("in-memory" if IN_MEMORY_VOICES else "none"),
                "binary": PIPER_BIN,
                "loaded_voices": voices_available,
                "host": "100.125.118.104"
            }
            self.wfile.write(json.dumps(res, indent=2).encode())
        elif self.path == "/voices":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(list(VOICE_CONFIGS.keys())).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path in ("/synthesize", "/v1/audio/speech"):
            content_len = int(self.headers.get("Content-Length", 0))
            if content_len == 0:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b"Empty body")
                return

            body = self.rfile.read(content_len)
            try:
                data = json.loads(body.decode("utf-8"))
            except Exception:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b"Invalid JSON")
                return

            text = data.get("text", "").strip()
            voice = data.get("voice", "en_GB-alan-low")
            if not text:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b"Missing text parameter")
                return

            try:
                pcm_bytes, sample_rate = synthesize_text(text, voice)
                self.send_response(200)
                self.send_header("Content-Type", "audio/pcm")
                self.send_header("X-Sample-Rate", str(sample_rate))
                self.send_header("X-Voice", voice)
                self.send_header("Content-Length", str(len(pcm_bytes)))
                self.end_headers()
                self.wfile.write(pcm_bytes)
            except Exception as e:
                logger.error(f"Synthesis error: {e}", exc_info=True)
                self.send_response(500)
                self.end_headers()
                self.wfile.write(str(e).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        # Clean log format
        sys.stderr.write(f"[{self.log_date_time_string()}] {format % args}\n")

def run(host="0.0.0.0", port=5000):
    init_voices()
    server = HTTPServer((host, port), PiperHTTPHandler)
    logger.info("==================================================================")
    logger.info(f"🚀 Piper TTS Tailscale Worker listening on http://{host}:{port}")
    logger.info("   Tailscale IP: http://100.125.118.104:5000")
    logger.info("   100% Offline. Zero Cloud. Zero external pip dependencies required.")
    logger.info("==================================================================")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("\nShutting down server...")
        server.server_close()

if __name__ == "__main__":
    host = os.getenv("PIPER_HOST", "0.0.0.0")
    port = int(os.getenv("PIPER_PORT", 5000))
    run(host=host, port=port)
