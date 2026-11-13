# Piper TTS Private Tailscale Worker (100% Offline / Zero-Cloud)

This worker runs on your private Mac Mini (`100.125.118.104`) or any Tailscale node to provide ultra-fast (<100ms) neural speech synthesis for Rocky-AI without sending a single byte of speech or text data to the internet or public cloud.

## Included Voices (British J.A.R.V.I.S. Collection)
- `en_GB-alan-low`: Classic British J.A.R.V.I.S. male voice (calm, crisp, ultra-low latency).
- `en_GB-southern_english_female-low`: British F.R.I.D.A.Y. female voice.
- `en_GB-cori-medium`: High-fidelity British studio voice.

---

## 🚀 Quick Start on Mac Mini (`manis-mac-mini`)

### Step 1: Open Terminal on your Mac Mini and navigate to the project directory:
```bash
cd /path/to/Rocky-AI/tailscale_piper_worker
```
*(Or copy the `tailscale_piper_worker` folder directly to your Mac Mini).*

### Step 2: Run the automated setup script:
```bash
bash setup_mac.sh
```

This will automatically:
1. Create a private Python virtual environment (`venv`).
2. Install `piper-tts` and `aiohttp`.
3. Download the 3 British neural voice models into `voices/`.
4. Start the server on `0.0.0.0:5000` (accessible to your VPS via Tailscale IP `100.125.118.104:5000`).

---

## 🏃 Running in the Background (Persistent Service)

To keep the worker running automatically in the background even if you close the terminal:

```bash
cd /path/to/Rocky-AI/tailscale_piper_worker
source venv/bin/activate
nohup python3 server.py > worker.log 2>&1 &
```

To stop it at any time:
```bash
pkill -f "python3 server.py"
```

---

## 🔍 Verification

From your VPS or another Tailscale node, verify connectivity:
```bash
curl http://100.125.118.104:5000/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "piper-tts-tailscale-worker",
  "loaded_voices": {
    "en_GB-alan-low": {"sample_rate": 16000, "description": "British J.A.R.V.I.S. Male (Calm & Natural)"},
    "en_GB-southern_english_female-low": {"sample_rate": 16000, "description": "British F.R.I.D.A.Y. Female (Clear & Crisp)"},
    "en_GB-cori-medium": {"sample_rate": 22050, "description": "British Studio J.A.R.V.I.S. (High Fidelity)"}
  }
}
```
