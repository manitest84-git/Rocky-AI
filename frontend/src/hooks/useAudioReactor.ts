import { useEffect, useRef, useState, useCallback } from 'react';

export function useAudioReactor() {
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | MediaElementAudioSourceNode | null>(null);
  const requestRef = useRef<number | null>(null);

  const [frequencyData, setFrequencyData] = useState<Uint8Array>(new Uint8Array(0));
  const [volume, setVolume] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(false);

  const initializeAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  }, []);

  const connectToMediaStream = useCallback((stream: MediaStream) => {
    initializeAudioContext();
    if (!audioContextRef.current || !analyserRef.current) return;

    if (sourceRef.current) {
      sourceRef.current.disconnect();
    }

    sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
    sourceRef.current.connect(analyserRef.current);
    setIsActive(true);
  }, [initializeAudioContext]);

  const connectToAudioElement = useCallback((el: HTMLAudioElement) => {
    initializeAudioContext();
    if (!audioContextRef.current || !analyserRef.current) return;

    if (sourceRef.current) {
      sourceRef.current.disconnect();
    }

    sourceRef.current = audioContextRef.current.createMediaElementSource(el);
    sourceRef.current.connect(analyserRef.current);
    analyserRef.current.connect(audioContextRef.current.destination);
    setIsActive(true);
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

  const updateLoop = useCallback(() => {
    if (isActive) {
      setFrequencyData(getFrequencyData());
      setVolume(getVolume());
    }
    requestRef.current = requestAnimationFrame(updateLoop);
  }, [isActive, getFrequencyData, getVolume]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(updateLoop);
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [updateLoop]);

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
  };
}
