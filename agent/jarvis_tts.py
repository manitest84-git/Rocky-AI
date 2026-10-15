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
    Defaults to British J.A.R.V.I.S. voice ('bm_george') with seamless fallback
    to Edge-TTS for Tamil/Hindi phrases.
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
        self._edge_fallback = None
    
    def _ensure_pipeline(self):
        if self._pipeline is None:
            from kokoro import KPipeline
            self._pipeline = KPipeline(lang_code=self._lang_code)
        return self._pipeline

    def _ensure_edge_fallback(self):
        if self._edge_fallback is None:
            self._edge_fallback = EdgeTTS()
        return self._edge_fallback
    
    def synthesize(self, text: str, *, conn_options=DEFAULT_API_CONNECT_OPTIONS, **kwargs) -> tts.ChunkedStream:
        return KokoroChunkedStream(tts=self, input_text=text, conn_options=conn_options)

class KokoroChunkedStream(tts.ChunkedStream):
    async def _run(self, output_emitter: tts.AudioEmitter) -> None:
        import re
        tts_instance: KokoroTTS = self._tts

        # Kokoro is English/Latin-based. If Tamil or Hindi unicode is detected,
        # route seamlessly to EdgeTTS (ta-IN-ValluvarNeural / hi-IN-MadhurNeural)
        has_indic = bool(re.search(r'[\u0B80-\u0BFF\u0900-\u097F]', self._input_text))
        if has_indic:
            edge_engine = tts_instance._ensure_edge_fallback()
            edge_stream = EdgeChunkedStream(tts=edge_engine, input_text=self._input_text, conn_options=self._conn_options)
            await edge_stream._run(output_emitter)
            return

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

class EdgeTTS(tts.TTS):
    """
    High-fidelity Neural Edge-TTS supporting English (India), Hindi, Tamil, and English (US).
    Zero external API key requirements.
    """
    VOICE_MAP = {
        'en-IN': 'en-IN-PrabhatNeural',
        'en-IN-female': 'en-IN-NeerjaNeural',
        'hi-IN': 'hi-IN-MadhurNeural',
        'hi-IN-female': 'hi-IN-SwaraNeural',
        'ta-IN': 'ta-IN-ValluvarNeural',
        'ta-IN-female': 'ta-IN-PallaviNeural',
        'en-US': 'en-US-ChristopherNeural',
    }

    def __init__(self, default_locale: str = 'en-IN', rate: str = '+0%', pitch: str = '+0Hz'):
        super().__init__(
            capabilities=tts.TTSCapabilities(streaming=False),
            sample_rate=24000,
            num_channels=1,
        )
        self.default_locale = default_locale
        self.rate = rate
        self.pitch = pitch

    def detect_voice_for_text(self, text: str) -> str:
        import re
        # Detect Tamil Unicode range U+0B80 to U+0BFF
        if re.search(r'[\u0B80-\u0BFF]', text):
            return self.VOICE_MAP['ta-IN']
        # Detect Devanagari (Hindi) Unicode range U+0900 to U+097F
        if re.search(r'[\u0900-\u097F]', text):
            return self.VOICE_MAP['hi-IN']
        # Default to specified locale (e.g. English India)
        return self.VOICE_MAP.get(self.default_locale, 'en-IN-PrabhatNeural')

    def synthesize(self, text: str, *, conn_options=DEFAULT_API_CONNECT_OPTIONS, **kwargs) -> tts.ChunkedStream:
        return EdgeChunkedStream(tts=self, input_text=text, conn_options=conn_options)

class EdgeChunkedStream(tts.ChunkedStream):
    async def _run(self, output_emitter: tts.AudioEmitter) -> None:
        import io
        import av
        import edge_tts
        
        tts_instance: EdgeTTS = self._tts
        output_emitter.initialize(
            request_id=f"edge-{uuid.uuid4().hex[:8]}",
            sample_rate=24000,
            num_channels=1,
            mime_type="audio/pcm",
        )

        voice = tts_instance.detect_voice_for_text(self._input_text)
        logger.info(f"🔊 [EDGE-TTS] Synthesizing with voice {voice} for: \"{self._input_text[:60]}...\"")

        try:
            communicate = edge_tts.Communicate(
                text=self._input_text,
                voice=voice,
                rate=tts_instance.rate,
                pitch=tts_instance.pitch
            )
            mp3_bytes = bytearray()
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    mp3_bytes.extend(chunk["data"])

            if not mp3_bytes:
                return

            def _decode_to_pcm():
                container = av.open(io.BytesIO(mp3_bytes))
                resampler = av.AudioResampler(format='s16', layout='mono', rate=24000)
                pcm = bytearray()
                for frame in container.decode(audio=0):
                    for resampled in resampler.resample(frame):
                        pcm.extend(resampled.to_ndarray().tobytes())
                return bytes(pcm)

            pcm_data = await asyncio.to_thread(_decode_to_pcm)
            
            # Emit in 4096-byte frames
            chunk_size = 4096
            for i in range(0, len(pcm_data), chunk_size):
                output_emitter.push(pcm_data[i:i + chunk_size])

            output_emitter.flush()
        except asyncio.CancelledError:
            logger.info("⚡ [TTS STREAM] EdgeTTS cancelled (Barge-in / Interrupted)")
            raise
        except Exception as e:
            logger.error(f"EdgeTTS synthesis error: {e}", exc_info=True)

