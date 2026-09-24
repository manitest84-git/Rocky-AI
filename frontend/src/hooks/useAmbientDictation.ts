"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import { transcribeAudioStt } from '@/lib/api';

interface UseAmbientDictationOptions {
  onDictatedText?: (text: string) => void;
  enabled?: boolean;
}

export function useAmbientDictation({ onDictatedText, enabled = true }: UseAmbientDictationOptions = {}) {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [lastTranscript, setLastTranscript] = useState<string>('');
  const [copiedToClipboard, setCopiedToClipboard] = useState<boolean>(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isHeldDownRef = useRef<boolean>(false);
  const streamRef = useRef<MediaStream | null>(null);

  const startDictation = useCallback(async () => {
    if (isRecording || isTranscribing) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
        },
      });
      streamRef.current = stream;
      audioChunksRef.current = [];

      let mimeType = '';
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/aac')) {
          mimeType = 'audio/aac';
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          mimeType = 'audio/ogg;codecs=opus';
        }
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          audioChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        // Stop audio tracks to free mic
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        const effectiveType = mimeType || recorder.mimeType || 'audio/mp4';
        const audioBlob = new Blob(audioChunksRef.current, { type: effectiveType });
        if (audioBlob.size < 500) {
          setIsTranscribing(false);
          return;
        }

        setIsTranscribing(true);
        try {
          const res = await transcribeAudioStt(audioBlob);
          const text = res.transcript?.trim() || '';
          if (text) {
            setLastTranscript(text);

            // 1. Inject into currently focused HTML input or textarea
            const activeEl = document.activeElement;
            if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
              const inputEl = activeEl as HTMLInputElement | HTMLTextAreaElement;
              const start = inputEl.selectionStart ?? inputEl.value.length;
              const end = inputEl.selectionEnd ?? inputEl.value.length;
              const val = inputEl.value;
              const prefix = val.length > 0 && !val.endsWith(' ') ? ' ' : '';
              const newText = prefix + text;

              try {
                // Try execCommand first for undo/redo support
                inputEl.focus();
                document.execCommand('insertText', false, newText);
              } catch {
                inputEl.value = val.slice(0, start) + newText + val.slice(end);
                inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                inputEl.dispatchEvent(new Event('change', { bubbles: true }));
              }
            } else {
              // If no input focused, notify chat or callback
              onDictatedText?.(text);
            }

            // 2. Copy straight to system clipboard for system-wide paste into any application
            if (navigator.clipboard && navigator.clipboard.writeText) {
              await navigator.clipboard.writeText(text);
              setCopiedToClipboard(true);
              setTimeout(() => setCopiedToClipboard(false), 3000);
            }
          }
        } catch (err) {
          console.error("Ambient dictation transcription error:", err);
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.warn("Could not start ambient dictation:", err);
      setIsRecording(false);
    }
  }, [isRecording, isTranscribing, onDictatedText]);

  const stopDictation = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  // Global Push-to-Talk (PTT) Keyboard Shortcut Listener:
  // Holding Ctrl+Space or Alt+D triggers ambient dictation.
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Hotkey: Ctrl+Space or Alt+D
      const isPttKey = (e.ctrlKey && e.code === 'Space') || (e.altKey && e.code === 'KeyD');

      if (isPttKey && !isHeldDownRef.current) {
        e.preventDefault();
        isHeldDownRef.current = true;
        startDictation();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const isPttKey = e.code === 'Space' || e.code === 'KeyD';
      if (isHeldDownRef.current && isPttKey) {
        isHeldDownRef.current = false;
        stopDictation();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [enabled, startDictation, stopDictation]);

  return {
    isRecording,
    isTranscribing,
    lastTranscript,
    copiedToClipboard,
    startDictation,
    stopDictation,
  };
}
