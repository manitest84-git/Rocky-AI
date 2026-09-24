import os
import uuid
import asyncio
import logging
import subprocess
import aiohttp
import numpy as np
from livekit.agents import tts
from livekit.agents.types import DEFAULT_API_CONNECT_OPTIONS

logger = logging.getLogger(__name__)

class KokoroTTS(tts.TTS):
    """
    LiveKit TTS Plugin wrapping Kokoro TTS with real-time sentence-chunked streaming.
    """
    def __init__(self, voice='af_heart', speed=1.05, lang_code='a'):
        super().__init__(
            capabilities=tts.TTSCapabilities(streaming=False),
            sample_rate=24000,
            num_channels=1,
        )
        self.voice = voice
        self.speed = speed
        self._pipeline = None
        self._lang_code = lang_code
    
    def _ensure_pipeline(self):
        if self._pipeline is None:
            from kokoro import KPipeline
            self._pipeline = KPipeline(lang_code=self._lang_code)
        return self._pipeline
    
    def synthesize(self, text: str, *, conn_options=DEFAULT_API_CONNECT_OPTIONS, **kwargs) -> tts.ChunkedStream:
        return KokoroChunkedStream(tts=self, input_text=text, conn_options=conn_options)

class KokoroChunkedStream(tts.ChunkedStream):
    async def _run(self, output_emitter: tts.AudioEmitter) -> None:
        tts_instance = self._tts
        output_emitter.initialize(
            request_id=f"kokoro-{uuid.uuid4().hex[:8]}",
            sample_rate=24000,
            num_channels=1,
            mime_type="audio/pcm",
        )
        pipeline = await asyncio.to_thread(tts_instance._ensure_pipeline)
        
        loop = asyncio.get_running_loop()
        queue = asyncio.Queue(maxsize=4)
        cancelled = False

        def _worker():
            try:
                for _, _, audio in pipeline(
                    self._input_text,
                    voice=tts_instance.voice,
                    speed=tts_instance.speed
                ):
                    if cancelled:
                        break
                    if audio is not None:
                        if hasattr(audio, 'detach'):
                            audio_np = audio.detach().cpu().numpy()
                        else:
                            audio_np = np.asarray(audio)
                        if len(audio_np) > 0:
                            pcm = (audio_np * 32767).clip(-32768, 32767).astype(np.int16).tobytes()
                            asyncio.run_coroutine_threadsafe(queue.put(pcm), loop).result()
            except Exception as e:
                logger.error(f"Kokoro stream generation error: {e}", exc_info=True)
            finally:
                try:
                    asyncio.run_coroutine_threadsafe(queue.put(None), loop).result()
                except Exception:
                    pass

        synth_future = loop.run_in_executor(None, _worker)
        try:
            while True:
                pcm_chunk = await queue.get()
                if pcm_chunk is None:
                    break
                output_emitter.push(pcm_chunk)
            output_emitter.flush()
        except asyncio.CancelledError:
            cancelled = True
            logger.info("⚡ [TTS STREAM] Kokoro synthesis cancelled (Barge-in / Interrupted)")
            raise
        finally:
            cancelled = True

class ElevenLabsTTS(tts.TTS):
    """
    Ultra-low-latency streaming ElevenLabs TTS Plugin.
    Streams 24kHz raw PCM directly to LiveKit audio emitter.
    """
    def __init__(self, api_key: str = None, voice_id: str = "21m00Tcm4TlvDq8ikWAM", model_id: str = "eleven_turbo_v2_5"):
        super().__init__(
            capabilities=tts.TTSCapabilities(streaming=False),
            sample_rate=24000,
            num_channels=1,
        )
        self.api_key = api_key or os.getenv("ELEVENLABS_API_KEY", "")
        self.voice_id = voice_id or os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
        self.model_id = model_id or os.getenv("ELEVENLABS_MODEL_ID", "eleven_turbo_v2_5")

    def synthesize(self, text: str, *, conn_options=DEFAULT_API_CONNECT_OPTIONS, **kwargs) -> tts.ChunkedStream:
        return ElevenLabsChunkedStream(tts=self, input_text=text, conn_options=conn_options)

class ElevenLabsChunkedStream(tts.ChunkedStream):
    async def _run(self, output_emitter: tts.AudioEmitter) -> None:
        tts_instance = self._tts
        output_emitter.initialize(
            request_id=f"eleven-{uuid.uuid4().hex[:8]}",
            sample_rate=24000,
            num_channels=1,
            mime_type="audio/pcm",
        )

        if not tts_instance.api_key:
            logger.warning("No ElevenLabs API key provided. Falling back to local Kokoro synthesis.")
            fallback = KokoroTTS()
            stream = fallback.synthesize(self._input_text)
            async for chunk in stream:
                output_emitter.push(chunk)
            output_emitter.flush()
            return

        url = f"https://api.elevenlabs.io/v1/text-to-speech/{tts_instance.voice_id}/stream"
        headers = {
            "xi-api-key": tts_instance.api_key,
            "Content-Type": "application/json",
            "Accept": "audio/pcm"
        }
        payload = {
            "text": self._input_text,
            "model_id": tts_instance.model_id,
            "output_format": "pcm_24000"
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload, headers=headers) as resp:
                    if resp.status != 200:
                        err_text = await resp.text()
                        logger.error(f"ElevenLabs TTS HTTP {resp.status}: {err_text}")
                        return
                    
                    async for chunk in resp.content.iter_chunked(4096):
                        output_emitter.push(chunk)
            output_emitter.flush()
        except asyncio.CancelledError:
            logger.info("⚡ [TTS STREAM] ElevenLabs synthesis cancelled (Barge-in / Interrupted)")
            raise
        except Exception as e:
            logger.error(f"ElevenLabs synthesis error: {e}")

class PiperTTS(tts.TTS):
    """
    Fallback LiveKit TTS Plugin wrapping piper CLI subprocess.
    """
    def __init__(self, model_path: str):
        super().__init__(
            capabilities=tts.TTSCapabilities(streaming=False),
            sample_rate=22050,
            num_channels=1,
        )
        self.model_path = model_path
    
    def synthesize(self, text: str, *, conn_options=DEFAULT_API_CONNECT_OPTIONS, **kwargs) -> tts.ChunkedStream:
        return PiperChunkedStream(tts=self, input_text=text, conn_options=conn_options)

class PiperChunkedStream(tts.ChunkedStream):
    async def _run(self, output_emitter: tts.AudioEmitter) -> None:
        tts_instance = self._tts
        output_emitter.initialize(
            request_id=f"piper-{uuid.uuid4().hex[:8]}",
            sample_rate=22050,
            num_channels=1,
            mime_type="audio/pcm",
        )
        
        def _synthesize():
            process = subprocess.Popen(
                ['piper', '--model', tts_instance.model_path, '--output_raw'],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            out, err = process.communicate(input=self._input_text.encode('utf-8'))
            if process.returncode != 0:
                logger.error(f"Piper error: {err.decode('utf-8')}")
                return b''
            return out
            
        try:
            raw_audio = await asyncio.to_thread(_synthesize)
            if raw_audio:
                output_emitter.push(raw_audio)
                output_emitter.flush()
        except Exception as e:
            logger.error(f"PiperTTS synthesis error: {e}")
