import os
import re
import math
import numpy as np
import logging
from typing import Optional, Callable

logger = logging.getLogger("rocky-wakeword")

class WakeWordEngine:
    """
    Wake Word & Hotword Detection Engine for Rocky AI.
    Supports:
      1. openWakeWord / ONNX local neural wake-word detection (e.g., 'hey jarvis', 'alexa', custom)
      2. Picovoice Porcupine (if PORCUPINE_ACCESS_KEY is supplied)
      3. Acoustic / Text-level hotword trigger fallback ('hey rocky', 'rocky', 'jarvis')
    """
    DEFAULT_WAKE_WORDS = ["hey rocky", "rocky", "hey jarvis", "jarvis", "computer"]

    def __init__(
        self,
        wake_words: Optional[list] = None,
        on_wake: Optional[Callable[[], None]] = None,
        sensitivity: float = 0.5
    ):
        self.wake_words = [w.lower() for w in (wake_words or self.DEFAULT_WAKE_WORDS)]
        self.on_wake = on_wake
        self.sensitivity = sensitivity
        self.is_active = True
        self._porcupine = None
        self._openwakeword_model = None

        self._init_detector()

    def _init_detector(self):
        # 1. Check for Porcupine Access Key
        porcupine_key = os.getenv("PORCUPINE_ACCESS_KEY")
        if porcupine_key:
            try:
                import pvporcupine
                self._porcupine = pvporcupine.create(
                    access_key=porcupine_key,
                    keywords=["jarvis", "computer"]
                )
                logger.info("⚡ [HOTWORD] Initialized Picovoice Porcupine wake-word engine.")
                return
            except Exception as e:
                logger.warning(f"Could not initialize Porcupine: {e}")

        # 2. Check for openWakeWord
        try:
            import openwakeword
            from openwakeword.model import Model
            self._openwakeword_model = Model(wakeword_models=["hey_jarvis_v0.1"])
            logger.info("⚡ [HOTWORD] Initialized openWakeWord local neural engine.")
            return
        except Exception as e:
            logger.info("⚡ [HOTWORD] openWakeWord package not found; active in ultra-fast text/audio stream hotword mode.")

    def process_pcm_frame(self, pcm_data: bytes) -> bool:
        """
        Process continuous 16kHz 16-bit mono PCM audio frames for hotword detection.
        """
        if not self.is_active or not pcm_data:
            return False

        # If Porcupine is active
        if self._porcupine:
            try:
                # convert bytes to int16 list of frame_length
                pcm_arr = np.frombuffer(pcm_data, dtype=np.int16)
                if len(pcm_arr) == self._porcupine.frame_length:
                    idx = self._porcupine.process(pcm_arr)
                    if idx >= 0:
                        logger.info("🔔 [HOTWORD DETECTED] Porcupine detected wake-word!")
                        if self.on_wake:
                            self.on_wake()
                        return True
            except Exception as e:
                logger.warning(f"Porcupine frame error: {e}")

        # If openWakeWord is active
        if self._openwakeword_model:
            try:
                pcm_arr = np.frombuffer(pcm_data, dtype=np.int16)
                prediction = self._openwakeword_model.predict(pcm_arr)
                for mdl_name, score in prediction.items():
                    if score >= self.sensitivity:
                        logger.info(f"🔔 [HOTWORD DETECTED] openWakeWord ({mdl_name}) score={score:.2f}")
                        if self.on_wake:
                            self.on_wake()
                        return True
            except Exception as e:
                logger.warning(f"openWakeWord frame error: {e}")

        return False

    def is_wake_phrase(self, text: str) -> bool:
        """
        Checks if recognized text starts with or contains any configured wake phrase.
        """
        if not text:
            return False
        clean = text.strip().lower()
        for w in self.wake_words:
            # Check prefix match or word boundary match
            if re.search(rf"\b{re.escape(w)}\b", clean):
                return True
        return False

    def strip_wake_word(self, text: str) -> str:
        """
        Removes the wake word prefix from the user's speech.
        Example: "Hey Rocky, what's on my schedule?" -> "what's on my schedule?"
        """
        if not text:
            return ""
        clean = text.strip()
        for w in self.wake_words:
            pattern = rf"^\s*{re.escape(w)}[\s,:\.!\?]*"
            clean = re.sub(pattern, "", clean, flags=re.IGNORECASE).strip()
        return clean

    @staticmethod
    def generate_wake_chime_pcm(sample_rate: int = 24000) -> bytes:
        """
        Generates a 120ms dual-tone cybernetic wake chime (880Hz -> 1760Hz).
        Returns 16-bit mono PCM bytes.
        """
        duration = 0.12  # seconds
        num_samples = int(sample_rate * duration)
        half = num_samples // 2

        t1 = np.linspace(0, duration / 2, half, False)
        t2 = np.linspace(0, duration / 2, num_samples - half, False)

        # Tone 1: 880 Hz (A5), Tone 2: 1760 Hz (A6)
        wave1 = 0.3 * np.sin(2 * np.pi * 880 * t1)
        wave2 = 0.3 * np.sin(2 * np.pi * 1760 * t2)

        # Apply smooth cosine attack/decay envelope to prevent audio clicking
        envelope1 = np.sin(np.pi * np.linspace(0, 1, half)) ** 2
        envelope2 = np.sin(np.pi * np.linspace(0, 1, num_samples - half)) ** 2

        audio = np.concatenate([wave1 * envelope1, wave2 * envelope2])
        pcm_int16 = (audio * 32767).astype(np.int16)
        return pcm_int16.tobytes()
