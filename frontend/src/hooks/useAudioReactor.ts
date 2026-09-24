import { useEffect, useRef, useState, useCallback } from 'react';

// Keep global reference set to prevent Safari WebKit from prematurely garbage collecting audio nodes
const activeSources = typeof window !== 'undefined' ? new Set<any>() : null;

export function useAudioReactor() {
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | MediaElementAudioSourceNode | null>(null);
  const dummyGainRef = useRef<GainNode | null>(null);
  const requestRef = useRef<number | null>(null);

  const [frequencyData, setFrequencyData] = useState<Uint8Array>(new Uint8Array(0));
  const [volume, setVolume] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(false);

  const initializeAudioContext = useCallback(() => {
    try {
      // Re-create if null or if closed by browser / system
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        analyserRef.current = analyser;

        // Safari WebKit Optimization:
        // WebKit requires an audio graph connection leading to context.destination
        // to keep pulling frames from MediaStreamAudioSourceNode.
        // Route through a 0-gain node so Safari's audio rendering thread runs
        // continuously without producing audible output (no echo/double-audio).
        try {
          const dummyGain = ctx.createGain();
          dummyGain.gain.setValueAtTime(0, ctx.currentTime);
          analyser.connect(dummyGain);
          dummyGain.connect(ctx.destination);
          dummyGainRef.current = dummyGain;
        } catch (e) {
          console.warn("Could not attach WebKit dummy gain sink:", e);
        }
      }

      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {
          // Awaiting next user gesture
        });
      }
    } catch (e) {
      console.warn("AudioContext initialization warning:", e);
    }
  }, []);

  const connectToMediaStream = useCallback((stream: MediaStream) => {
    initializeAudioContext();
    if (!audioContextRef.current || !analyserRef.current) return;

    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
        if (activeSources) activeSources.delete(sourceRef.current);
      } catch {}
    }

    try {
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      sourceRef.current = source;
      if (activeSources) activeSources.add(source);
      setIsActive(true);
    } catch (err) {
      console.warn("Failed to create MediaStreamSource:", err);
    }
  }, [initializeAudioContext]);

  const connectToAudioElement = useCallback((el: HTMLAudioElement) => {
    initializeAudioContext();
    if (!audioContextRef.current || !analyserRef.current) return;

    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
        if (activeSources) activeSources.delete(sourceRef.current);
      } catch {}
    }

    try {
      const source = audioContextRef.current.createMediaElementSource(el);
      source.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);
      sourceRef.current = source;
      if (activeSources) activeSources.add(source);
      setIsActive(true);
    } catch (err) {
      console.warn("Failed to create MediaElementSource:", err);
    }
  }, [initializeAudioContext]);

  const connectToTrack = useCallback((track: any) => {
    if (track && track.mediaStreamTrack) {
      const stream = new MediaStream([track.mediaStreamTrack]);
      connectToMediaStream(stream);
    }
  }, [connectToMediaStream]);

  const getFrequencyData = useCallback(() => {
    if (!analyserRef.current) return new Uint8Array(0);
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    return dataArray;
  }, []);

  const getVolume = useCallback(() => {
    const data = getFrequencyData();
    if (data.length === 0) return 0;
    
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    const rms = Math.sqrt(sum / data.length);
    return rms / 255;
  }, [getFrequencyData]);

  // Animation frame loop for real-time visualizer rendering
  useEffect(() => {
    let animId: number;
    const loop = () => {
      if (isActive && analyserRef.current) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        setFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / dataArray.length);
        setVolume(rms / 255);
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isActive]);

  // AudioContext cleanup ONLY upon unmount of the hook
  useEffect(() => {
    return () => {
      if (sourceRef.current) {
        try {
          sourceRef.current.disconnect();
          if (activeSources) activeSources.delete(sourceRef.current);
        } catch {}
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, []);

  return {
    analyser: analyserRef.current,
    frequencyData,
    volume,
    connectToMediaStream,
    connectToAudioElement,
    connectToTrack,
    isActive,
    getFrequencyData,
    getVolume,
    initializeAudioContext,
  };
}
