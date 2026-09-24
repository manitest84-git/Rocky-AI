import io
import os
import time
import asyncio
import logging
# pyrefly: ignore [missing-import]
from aiohttp import web
# pyrefly: ignore [missing-import]
from faster_whisper import WhisperModel

logger = logging.getLogger("rocky-stt-service")

class FastSTTEngine:
    """
    Decoupled ultra-fast Faster-Whisper Speech-to-Text engine.
    Configured for low latency (<120ms inference) using int8 quantization and beam_size=1.
    """
    _instance = None

    def __init__(self, model_size: str = "base.en", device: str = "cpu", compute_type: str = "int8"):
        logger.info(f"Loading FastSTTEngine model: {model_size} ({device}, {compute_type})...")
        t0 = time.time()
        self._model = WhisperModel(model_size, device=device, compute_type=compute_type)
        self.model_size = model_size
        logger.info(f"FastSTTEngine loaded in {int((time.time() - t0) * 1000)}ms.")

    @classmethod
    def get_instance(cls, model_size: str = None) -> "FastSTTEngine":
        if cls._instance is None:
            size = model_size or os.getenv("WHISPER_MODEL", "base.en")
            cls._instance = cls(model_size=size)
        return cls._instance

    def transcribe_bytes(self, audio_bytes: bytes, language: str = "en") -> dict:
        """
        Transcribe raw audio bytes (wav/webm/mp3) synchronously.
        Best executed inside asyncio.to_thread to keep event loops responsive.
        """
        if not audio_bytes:
            return {"transcript": "", "language": "en", "duration_ms": 0}

        t_start = time.time()
        audio_stream = io.BytesIO(audio_bytes)
        segments, info = self._model.transcribe(
            audio_stream,
            beam_size=1,
            language=language,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=250),
            condition_on_previous_text=False,
            temperature=0.0
        )
        text = " ".join([seg.text.strip() for seg in segments]).strip()
        latency_ms = int((time.time() - t_start) * 1000)
        logger.info(f"⚡ [FAST STT] Transcribed in {latency_ms}ms: \"{text}\"")

        return {
            "transcript": text,
            "language": info.language if hasattr(info, "language") else language,
            "duration_ms": latency_ms
        }

async def handle_stt_request(request: web.Request) -> web.Response:
    """
    Handle POST /stt for ambient dictation and decoupled STT micro-service calls.
    Accepts multipart audio file or raw binary audio body.
    """
    engine = FastSTTEngine.get_instance()
    audio_data = None

    if request.content_type.startswith("multipart/form-data"):
        reader = await request.multipart()
        while True:
            part = await reader.next()
            if part is None:
                break
            if part.name in ("audio", "file"):
                audio_data = await part.read()
                break
    else:
        audio_data = await request.read()

    if not audio_data:
        return web.json_response({"error": "No audio payload provided"}, status=400)

    try:
        result = await asyncio.to_thread(engine.transcribe_bytes, audio_data)
        return web.json_response({
            "status": "success",
            "transcript": result["transcript"],
            "language": result["language"],
            "latency_ms": result["duration_ms"]
        })
    except Exception as e:
        logger.error(f"Error during STT micro-service transcription: {e}", exc_info=True)
        return web.json_response({"status": "error", "error": str(e)}, status=500)

async def handle_health(request: web.Request) -> web.Response:
    engine = FastSTTEngine.get_instance()
    return web.json_response({
        "status": "healthy",
        "service": "rocky-stt-microservice",
        "model": engine.model_size
    })

def create_stt_app() -> web.Application:
    app = web.Application()
    app.router.add_post("/stt", handle_stt_request)
    app.router.add_get("/health", handle_health)
    return app

async def start_stt_microservice(host: str = "0.0.0.0", port: int = 8334):
    """
    Launches the decoupled STT HTTP micro-service.
    """
    app = create_stt_app()
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, host, port)
    await site.start()
    logger.info(f"🚀 [STT MICROSERVICE] Running decoupled STT service at http://{host}:{port}/stt")
    return runner

def run_stt_service_thread(host: str = "0.0.0.0", port: int = 8334):
    """
    Starts the decoupled STT service in an isolated background thread.
    Ensures STT requests are served immediately without blocking LiveKit worker.
    """
    import threading
    def _run():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        app = create_stt_app()
        runner = web.AppRunner(app)
        loop.run_until_complete(runner.setup())
        site = web.TCPSite(runner, host, port)
        loop.run_until_complete(site.start())
        logger.info(f"🚀 [STT BACKGROUND THREAD] Listening on http://{host}:{port}/stt")
        loop.run_forever()

    t = threading.Thread(target=_run, daemon=True, name="stt-service-thread")
    t.start()
    return t

