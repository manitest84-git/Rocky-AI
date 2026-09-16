import asyncio
import numpy as np
import subprocess
import logging
from livekit.agents import tts

logger = logging.getLogger(__name__)

class KokoroTTS(tts.TTS):
    """
    LiveKit TTS Plugin wrapping Kokoro TTS.
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
    
    def synthesize(self, text: str) -> tts.ChunkedStream:
        return KokoroChunkedStream(self, text)

class KokoroChunkedStream(tts.ChunkedStream):
    async def _run(self):
        tts_instance = self._tts
        pipeline = await asyncio.to_thread(tts_instance._ensure_pipeline)
        
        def _synthesize():
            audio_segments = []
            for _, _, audio in pipeline(
                self._input_text,
                voice=tts_instance.voice,
                speed=tts_instance.speed
            ):
                audio_segments.append(audio)
            if not audio_segments:
                return np.array([], dtype=np.int16)
            combined = np.concatenate(audio_segments)
            return (combined * 32767).astype(np.int16)
        
        try:
            pcm_data = await asyncio.to_thread(_synthesize)
            
            if len(pcm_data) > 0:
                frame = tts.SynthesizedAudio(
                    text=self._input_text,
                    data=pcm_data.tobytes(),
                    sample_rate=24000,
                    num_channels=1,
                )
                self._event_ch.send_nowait(frame)
        except Exception as e:
            logger.error(f"KokoroTTS synthesis error: {e}")

class PiperTTS(tts.TTS):
    """
    Fallback LiveKit TTS Plugin wrapping piper CLI subprocess.
    """
    def __init__(self, model_path: str):
        super().__init__(
            capabilities=tts.TTSCapabilities(streaming=False),
            sample_rate=22050,  # Piper default sample rate
            num_channels=1,
        )
        self.model_path = model_path
    
    def synthesize(self, text: str) -> tts.ChunkedStream:
        return PiperChunkedStream(self, text)

class PiperChunkedStream(tts.ChunkedStream):
    async def _run(self):
        tts_instance = self._tts
        
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
                frame = tts.SynthesizedAudio(
                    text=self._input_text,
                    data=raw_audio,
                    sample_rate=22050,
                    num_channels=1,
                )
                self._event_ch.send_nowait(frame)
        except Exception as e:
            logger.error(f"PiperTTS synthesis error: {e}")
