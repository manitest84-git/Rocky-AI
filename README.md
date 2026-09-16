# Jarvis AI Voice Assistant

On-Premise Jarvis AI Voice Assistant powered by LiveKit and Ollama.

## Architecture

```
[Frontend (Next.js)] <---WebRTC---> [LiveKit Server] <---WebRTC---> [Agent (Python)]
       |                                   |                              |
    (HTTP/REST)                            |                         (REST/LLM)
       v                                   v                              v
[Backend (Python API)]                 [Redis]                      [Ollama (Local LLM)]
```

## Prerequisites

- Docker and Docker Compose
- Node.js 20+
- Python 3.11+
- (Optional but Recommended) NVIDIA GPU with drivers configured for Docker

## Quick Start

1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd jarvis-ai
   ```

2. Run the setup script to install dependencies and pull AI models:
   ```bash
   make setup
   ```

3. Start the services:
   ```bash
   make dev
   ```

4. Start the frontend (in a new terminal):
   ```bash
   cd frontend && npm run dev
   ```

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `LIVEKIT_URL` | LiveKit Server WebSocket URL | `ws://localhost:7880` |
| `LIVEKIT_API_KEY` | LiveKit API Key | `devkey` |
| `LIVEKIT_API_SECRET` | LiveKit API Secret | `secret` |
| `OLLAMA_BASE_URL` | Ollama API endpoint | `http://localhost:11434` |
| `OLLAMA_MODEL` | Custom Ollama model to use | `jarvis` |
| `NEXT_PUBLIC_LIVEKIT_URL` | LiveKit URL for frontend | `ws://localhost:7880` |
| `NEXT_PUBLIC_API_URL` | Backend API URL for frontend | `http://localhost:8000` |
| `BACKEND_PORT` | Port for the backend API | `8000` |

## Hardware Requirements

| Tier | Description | Hardware Setup | Capability |
|------|-------------|----------------|------------|
| Tier 1 | CPU-Only | Modern Multi-core CPU (Intel i7/Ryzen 7), 16GB RAM | High latency, small models only (phi3) |
| Tier 2 | Entry GPU/Apple Silicon | RTX 3060/4060 or M2/M3 with 16GB Unified RAM | Moderate latency, 8B models (Llama3 8B) |
| Tier 3 | High-end GPU | RTX 3090/4090 or Mac Studio | Low latency, larger models (Mixtral) |

## Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Core WebRTC | LiveKit | Real-time audio streaming |
| Local LLM | Ollama | Model hosting |
| Voice Agent | LiveKit Python SDK | Agent logic and pipeline orchestration |
| Backend | FastAPI (Python) | API services, user management |
| Frontend | Next.js (React) | User interface |
| State/PubSub | Redis | LiveKit state management |

## Troubleshooting

- **Audio issues:** Ensure your browser has granted microphone permissions. If running on a remote server, you must use HTTPS for WebRTC to function properly in browsers.
- **High latency:** Ensure Ollama is utilizing your GPU. Check `docker compose logs ollama` for startup messages regarding GPU detection.
- **Port conflicts:** The default configuration uses ports `7880`, `7881`, `6379`, `11434`, `8000`, and `3000`. Adjust `.env` and `docker-compose.yml` if conflicts occur.

## License
MIT
