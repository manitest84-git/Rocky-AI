'use client';

import React, { useRef, useEffect, useState, useMemo } from 'react';

export interface CircularVisualizerProps {
  analyserData?: Uint8Array | null;
  baseRadius?: number;
  barCount?: number;
  volume?: number;
  state?: 'idle' | 'listening' | 'thinking' | 'speaking';
  className?: string;
}

export const CircularVisualizer = ({
  analyserData = null,
  volume = 0,
  state = 'idle',
  className = '',
}: CircularVisualizerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [smoothedVolume, setSmoothedVolume] = useState(0);

  // Compute normalized volume from audio frequency data if not directly provided
  const rawVolume = useMemo(() => {
    if (volume > 0) return volume;
    if (!analyserData || analyserData.length === 0) return 0;
    let sum = 0;
    const len = Math.min(analyserData.length, 64);
    for (let i = 0; i < len; i++) {
      sum += analyserData[i];
    }
    return sum / (len * 255);
  }, [analyserData, volume]);

  // Smooth volume transitions with requestAnimationFrame
  useEffect(() => {
    let animId: number;
    const updateSmooth = () => {
      setSmoothedVolume((prev) => prev + (rawVolume - prev) * 0.18);
      animId = requestAnimationFrame(updateSmooth);
    };
    animId = requestAnimationFrame(updateSmooth);
    return () => cancelAnimationFrame(animId);
  }, [rawVolume]);

  // Autoplay unlocking and video lifecycle
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    vid.defaultMuted = true;
    vid.muted = true;
    vid.playsInline = true;
    vid.loop = true;

    const playVideo = () => {
      const promise = vid.play();
      if (promise !== undefined) {
        promise
          .then(() => setIsVideoLoaded(true))
          .catch(() => {
            const unlockAudio = () => {
              vid.play().then(() => setIsVideoLoaded(true)).catch(() => {});
              window.removeEventListener('click', unlockAudio);
              window.removeEventListener('touchstart', unlockAudio);
              window.removeEventListener('keydown', unlockAudio);
            };
            window.addEventListener('click', unlockAudio, { once: true, passive: true });
            window.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
            window.addEventListener('keydown', unlockAudio, { once: true, passive: true });
          });
      }
    };

    playVideo();
  }, []);

  // Ambient floating particle stardust canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const size = 460;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const particles: Array<{
      x: number;
      y: number;
      radius: number;
      color: string;
      alpha: number;
      speedX: number;
      speedY: number;
      pulseSpeed: number;
      pulseOffset: number;
    }> = [];

    const colors = ['#00f0ff', '#38bdf8', '#818cf8', '#c084fc', '#ffffff'];

    for (let i = 0; i < 48; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 110 + Math.random() * 85;
      particles.push({
        x: size / 2 + Math.cos(angle) * dist,
        y: size / 2 + Math.sin(angle) * dist,
        radius: Math.random() * 1.8 + 0.6,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: Math.random() * 0.7 + 0.3,
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: (Math.random() - 0.5) * 0.3,
        pulseSpeed: Math.random() * 0.05 + 0.02,
        pulseOffset: Math.random() * Math.PI * 2,
      });
    }

    let frame = 0;
    const render = () => {
      frame++;
      ctx.clearRect(0, 0, size, size);
      ctx.globalCompositeOperation = 'screen';

      particles.forEach((p) => {
        p.x += p.speedX;
        p.y += p.speedY;

        if (p.x < 20) p.x = size - 20;
        if (p.x > size - 20) p.x = 20;
        if (p.y < 20) p.y = size - 20;
        if (p.y > size - 20) p.y = 20;

        const currentAlpha = Math.max(0.1, p.alpha * (0.6 + 0.4 * Math.sin(frame * p.pulseSpeed + p.pulseOffset)));

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = currentAlpha;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.fill();
      });

      ctx.globalAlpha = 1.0;
      ctx.shadowBlur = 0;
      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  const isThinking = state === 'thinking';
  const isSpeaking = state === 'speaking';
  const isListening = state === 'listening';

  // Audio-reactive scale and glow calculations
  const scale = 1.0 + Math.min(0.24, smoothedVolume * 0.45);
  const glowIntensity = isThinking ? 24 : isSpeaking ? 28 + smoothedVolume * 45 : 18 + smoothedVolume * 25;
  const glowColor = isThinking ? 'rgba(255, 145, 0, 0.75)' : isSpeaking ? 'rgba(0, 240, 255, 0.85)' : 'rgba(0, 180, 255, 0.6)';

  return (
    <div className={`relative flex items-center justify-center pointer-events-none z-10 w-[260px] h-[260px] sm:w-[320px] sm:h-[320px] md:w-[360px] md:h-[360px] select-none ${className}`}>
      {/* Outer Ethereal Glow Aura */}
      <div 
        className="absolute w-[300px] h-[300px] sm:w-[380px] sm:h-[380px] md:w-[420px] md:h-[420px] rounded-full pointer-events-none transition-all duration-300"
        style={{
          background: isThinking
            ? 'radial-gradient(circle at center, rgba(255, 145, 0, 0.25) 0%, rgba(147, 51, 234, 0.12) 45%, transparent 72%)'
            : isSpeaking
            ? 'radial-gradient(circle at center, rgba(0, 240, 255, 0.38) 0%, rgba(0, 100, 255, 0.2) 45%, transparent 74%)'
            : 'radial-gradient(circle at center, rgba(0, 160, 255, 0.22) 0%, rgba(0, 60, 200, 0.1) 45%, transparent 70%)',
          transform: `scale(${scale})`,
        }}
      />

      {/* Floating Stardust Canvas Layer */}
      <canvas
        ref={canvasRef}
        className="absolute w-[320px] h-[320px] sm:w-[400px] sm:h-[400px] md:w-[460px] md:h-[460px] pointer-events-none z-10"
        style={{
          transform: `scale(${scale * 0.98})`,
          transition: 'transform 0.15s ease-out',
        }}
      />

      {/* Center Blue Sphere Video Container */}
      <div 
        className="relative w-[220px] h-[220px] sm:w-[280px] sm:h-[280px] md:w-[340px] md:h-[340px] flex items-center justify-center pointer-events-none transition-transform duration-150 ease-out"
        style={{
          transform: `scale(${scale})`,
        }}
      >
        {/* Core Glowing Video Stream */}
        <video
          ref={videoRef}
          poster="/blue_sphere.webp"
          src="/blue_sphere.mp4"
          autoPlay
          loop
          muted
          playsInline
          // @ts-ignore
          webkit-playsinline="true"
          preload="auto"
          className="w-full h-full object-cover rounded-full mix-blend-screen pointer-events-none select-none transition-all duration-200"
          style={{
            maskImage: 'radial-gradient(circle at center, black 65%, rgba(0, 0, 0, 0.7) 82%, transparent 96%)',
            WebkitMaskImage: 'radial-gradient(circle at center, black 65%, rgba(0, 0, 0, 0.7) 82%, transparent 96%)',
            filter: `drop-shadow(0 0 ${glowIntensity}px ${glowColor}) ${
              isThinking ? 'hue-rotate(28deg) brightness(1.2)' : isSpeaking ? 'brightness(1.15) contrast(1.08)' : 'brightness(1.05)'
            }`,
          }}
        >
          <source src="/blue_sphere.mp4" type="video/mp4" />
          <source src="/blue_sphere.webm" type="video/webm" />
        </video>

        {/* Ethereal Rim Accent Ring */}
        <div 
          className="absolute inset-0 rounded-full border border-cyan-400/40 pointer-events-none shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-opacity duration-200"
          style={{
            opacity: isSpeaking ? 0.9 : isListening ? 0.75 : 0.5,
          }}
        />
      </div>
    </div>
  );
};

export default CircularVisualizer;

