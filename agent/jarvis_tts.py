import os
import uuid
import asyncio
import logging
import aiohttp
import numpy as np
from livekit.agents import tts
from livekit.agents.types import DEFAULT_API_CONNECT_OPTIONS

logger = logging.getLogger(__name__)

class PiperTTS(tts.TTS):
    """
    100% Private, Zero-Cloud Neural TTS Plugin.
    Primary Mode: Streams high-speed synthesis from the Private Tailscale Worker 
                  (e.g. Mac Mini at http://100.125.118.104:5000) over encrypted WireGuard mesh.
    Fallback Mode: Local offline Kokoro-TTS (or local Piper) on VPS if Tailscale worker is asleep.
    
    Zero audio, text, or metadata is ever transmitted to the internet or public cloud.
    """
    VOICE_SAMPLE_RATES = {
        'en_GB-alan-low': 16000,
        'en_GB-southern_english_female-low': 16000,
        'en_GB-cori-medium': 22050,
    }

    def __init__(
        self,
        server_url: str = None,
        voice: str = None,
        speed: float = 1.0,
    ):
        self.server_url = (server_url or os.getenv("PIPER_TTS_URL", "http://100.125.118.104:5000")).rstrip("/")
        self.voice = voice or os.getenv("PIPER_VOICE", "en_GB-alan-low")
        self.speed = speed
        sample_rate = self.VOICE_SAMPLE_RATES.get(self.voice, 16000)

        super().__init__(
            capabilities=tts.TTSCapabilities(streaming=False),
            sample_rate=sample_rate,
            num_channels=1,
        )
        self._local_piper = None
        self._kokoro_fallback = None

    def _ensure_local_fallback(self):
        if self._kokoro_fallback is None:
            self._kokoro_fallback = KokoroTTS(voice='bm_george')
        return self._kokoro_fallback

    def synthesize(self, text: str, *, conn_options=DEFAULT_API_CONNECT_OPTIONS, **kwargs) -> tts.ChunkedStream:
        return PiperChunkedStream(tts=self, input_text=text, conn_options=conn_options)


class PiperChunkedStream(tts.ChunkedStream):
    async def _run(self, output_emitter: tts.AudioEmitter) -> None:
        tts_instance: PiperTTS = self._tts
        voice_name = tts_instance.voice
        sample_rate = tts_instance.VOICE_SAMPLE_RATES.get(voice_name, 16000)

        output_emitter.initialize(
            request_id=f"piper-{uuid.uuid4().hex[:8]}",
            sample_rate=sample_rate,
            num_channels=1,
            mime_type="audio/pcm",
        )

        synthesized_remotely = False

        # 1. Attempt synthesis via Private Tailscale Worker (Mac Mini)
        if tts_instance.server_url:
            try:
                synth_url = f"{tts_instance.server_url}/synthesize"
                payload = {
                    "text": self._input_text,
                    "voice": voice_name,
                    "speed": tts_instance.speed,
                }
                timeout = aiohttp.ClientTimeout(total=5.0, connect=1.0)
                async with aiohttp.ClientSession(timeout=timeout) as session:
                    async with session.post(synth_url, json=payload) as resp:
                        if resp.status == 200:
                            # Stream raw PCM chunks directly to LiveKit emitter
                            async for chunk in resp.content.iter_chunked(2048):
                                if chunk:
                                    output_emitter.push(chunk)
                            output_emitter.flush()
                            synthesized_remotely = True
                            return
                        else:
                            logger.warning(f"Tailscale Piper worker returned HTTP {resp.status}, switching to local fallback")
            except (aiohttp.ClientError, asyncio.TimeoutError) as e:
                logger.info(f"⚡ [TTS] Tailscale worker unreachable ({e}), switching to local offline engine.")
            except asyncio.CancelledError:
                logger.info("⚡ [TTS STREAM] Piper synthesis cancelled (Barge-in / Interrupted)")
                raise
            except Exception as e:
                logger.warning(f"Tailscale Piper worker error: {e}")

        if synthesized_remotely:
            return

        # 2. Local Fallback: 100% on-premise Piper or Kokoro (Zero cloud)
        try:
            local_model_path = os.path.join(os.path.dirname(__file__), "voices", f"{voice_name}.onnx")
            local_config_path = os.path.join(os.path.dirname(__file__), "voices", f"{voice_name}.onnx.json")
            if os.path.exists(local_model_path) and os.path.exists(local_config_path):
                logger.info(f"⚡ [TTS] Synthesizing speech via local offline Piper engine ({voice_name})...")
                from piper.voice import PiperVoice
                if tts_instance._local_piper is None:
                    tts_instance._local_piper = PiperVoice.load(local_model_path, config_path=local_config_path)
                for chunk in tts_instance._local_piper.synthesize(self._input_text):
                    if chunk and hasattr(chunk, "audio_int16_bytes"):
                        output_emitter.push(chunk.audio_int16_bytes)
                output_emitter.flush()
                return
        except asyncio.CancelledError:
            logger.info("⚡ [TTS STREAM] Local Piper synthesis cancelled (Barge-in / Interrupted)")
            raise
        except Exception as e_local:
            logger.warning(f"Local Piper fallback notice: {e_local}")

        try:
            logger.info("⚡ [TTS] Synthesizing speech via secondary offline fallback (Kokoro)...")
            fallback_engine = tts_instance._ensure_local_fallback()
            stream = fallback_engine.synthesize(self._input_text)
            async for chunk in stream:
                output_emitter.push(chunk)
            output_emitter.flush()
        except asyncio.CancelledError:
            logger.info("⚡ [TTS STREAM] Local fallback synthesis cancelled (Barge-in / Interrupted)")
            raise
        except Exception as e:
            logger.error(f"Local TTS fallback error: {e}", exc_info=True)


class KokoroTTS(tts.TTS):
    """
    100% Private On-Premise Kokoro TTS Plugin with real-time sentence-chunked streaming.
    Defaults to British J.A.R.V.I.S. voice ('bm_george').
    Runs strictly on local CPU with zero internet or cloud calls.
    """
    def __init__(self, voice='bm_george', speed=1.0, lang_code=None):
        super().__init__(
            capabilities=tts.TTSCapabilities(streaming=False),
            sample_rate=24000,
            num_channels=1,
        )
        self.voice = voice
        self.speed = speed
        if lang_code is None:
            self._lang_code = 'b' if voice.startswith(('bm_', 'bf_')) else 'a'
        else:
            self._lang_code = lang_code
        self._pipeline = None

    def _ensure_pipeline(self):
        if self._pipeline is None:
            from kokoro import KPipeline
            self._pipeline = KPipeline(lang_code=self._lang_code)
        return self._pipeline

    def synthesize(self, text: str, *, conn_options=DEFAULT_API_CONNECT_OPTIONS, **kwargs) -> tts.ChunkedStream:
        return KokoroChunkedStream(tts=self, input_text=text, conn_options=conn_options)


class KokoroChunkedStream(tts.ChunkedStream):
    async def _run(self, output_emitter: tts.AudioEmitter) -> None:
        tts_instance: KokoroTTS = self._tts

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
