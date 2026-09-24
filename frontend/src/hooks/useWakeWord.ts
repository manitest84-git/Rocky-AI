"use client";

import { useState, useEffect, useRef, useCallback } from 'react';

interface UseWakeWordOptions {
  onWake?: (phrase: string) => void;
  wakeWords?: string[];
  enabled?: boolean;
}

const DEFAULT_WAKE_WORDS: string[] = ['hey rocky', 'rocky', 'hey jarvis', 'jarvis'];

export function useWakeWord({
  onWake,
  wakeWords = DEFAULT_WAKE_WORDS,
  enabled = false,
}: UseWakeWordOptions = {}) {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [lastWakeTime, setLastWakeTime] = useState<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Synthesize futuristic dual-tone wake chime via Web Audio API
  const playWakeChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = audioContextRef.current || new AudioCtx();
      audioContextRef.current = ctx;

      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now); // A5

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1760, now + 0.08); // A6

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.08);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.22);
    } catch (err) {
      console.warn("Could not play wake chime:", err);
    }
  }, []);

  const handleWakeDetected = useCallback((phrase: string) => {
    console.log("⚡ [WAKE-WORD DETECTED]", phrase);
    setLastWakeTime(Date.now());
    playWakeChime();
    onWake?.(phrase);
  }, [playWakeChime, onWake]);

  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    if (!enabled) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
        recognitionRef.current = null;
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("SpeechRecognition API not available in this browser for local wake word.");
      return;
    }

    let isFatalError = false;

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognitionRef.current = recognition;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onend = () => {
        setIsListening(false);
        // Do not restart if fatal permission error or disabled
        if (!enabled || isFatalError) {
          return;
        }

        // Debounced restart with backoff to prevent Safari infinite CPU loops
        restartTimeoutRef.current = setTimeout(() => {
          if (enabled && !isFatalError && recognitionRef.current) {
            try {
              recognition.start();
            } catch (err) {
              console.warn("Wake word restart notice:", err);
            }
          }
        }, 1500);
      };

      recognition.onerror = (e: any) => {
        const error = e?.error || '';
        if (error === 'not-allowed' || error === 'service-not-allowed' || error === 'audio-capture') {
          console.warn(`Wake word disabled due to browser speech recognition restriction (${error}).`);
          isFatalError = true;
          setIsListening(false);
          try {
            recognition.abort();
          } catch {}
        } else if (error !== 'no-speech') {
          console.warn("Wake word recognition warning:", error);
        }
      };

      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript.trim().toLowerCase();
          for (const w of wakeWords) {
            if (transcript.includes(w)) {
              handleWakeDetected(w);
              break;
            }
          }
        }
      };

      recognition.start();
    } catch (err) {
      console.warn("Wake word initialization error:", err);
      setIsListening(false);
    }

    return () => {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
        recognitionRef.current = null;
      }
    };
  }, [enabled, wakeWords, handleWakeDetected]);

  return {
    isListening,
    lastWakeTime,
    playWakeChime,
  };
}
