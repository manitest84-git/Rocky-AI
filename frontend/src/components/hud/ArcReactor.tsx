'use client';

import React, { useRef, useEffect, useState } from 'react';

export interface ArcReactorProps {
  volume?: number;
  state?: 'idle' | 'listening' | 'thinking' | 'speaking';
}

export const ArcReactor = ({ volume = 0, state = 'idle' }: ArcReactorProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);

  // Autoplay and continuous looping safety across Safari, Chrome & Brave
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    vid.defaultMuted = true;
    vid.muted = true;

    const playVideo = () => {
      const promise = vid.play();
      if (promise !== undefined) {
        promise
          .then(() => setIsVideoLoaded(true))
          .catch(() => {
            // Autoplay blocked by browser policy: unlock on first gesture
            const unlockAudioContext = () => {
              vid.play().then(() => setIsVideoLoaded(true)).catch(() => {});
              window.removeEventListener('click', unlockAudioContext);
              window.removeEventListener('touchstart', unlockAudioContext);
              window.removeEventListener('keydown', unlockAudioContext);
            };
            window.addEventListener('click', unlockAudioContext, { once: true });
            window.addEventListener('touchstart', unlockAudioContext, { once: true });
            window.addEventListener('keydown', unlockAudioContext, { once: true });
          });
      }
    };

    playVideo();
  }, []);

  // Ambient floating particle embers matching Pinterest motion design
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

        // Soft wrap around canvas bounds
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

  // Audio-reactive scale and glow calculations
  const scale = 1.0 + Math.min(0.22, (volume || 0) * 0.4);
  const glowIntensity = 18 + (volume || 0) * 45;
  const isThinking = state === 'thinking';
  const isSpeaking = state === 'speaking';

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 w-full h-full select-none">
      {/* Outer Ethereal Glow Aura */}
      <div 
        className="absolute w-[360px] h-[360px] sm:w-[420px] sm:h-[420px] rounded-full pointer-events-none transition-all duration-300"
        style={{
          background: isThinking
            ? 'radial-gradient(circle at center, rgba(255, 145, 0, 0.22) 0%, rgba(147, 51, 234, 0.12) 45%, transparent 70%)'
            : isSpeaking
            ? 'radial-gradient(circle at center, rgba(0, 240, 255, 0.35) 0%, rgba(0, 100, 255, 0.18) 45%, transparent 72%)'
            : 'radial-gradient(circle at center, rgba(0, 160, 255, 0.22) 0%, rgba(0, 60, 200, 0.1) 45%, transparent 70%)',
          transform: `scale(${scale})`,
        }}
      />

      {/* Floating Stardust Canvas Layer */}
      <canvas
        ref={canvasRef}
        className="absolute w-[460px] h-[460px] pointer-events-none z-10"
        style={{
          transform: `scale(${scale * 0.98})`,
          transition: 'transform 0.15s ease-out',
        }}
      />

      {/* Center Spherical Orb Container */}
      <div 
        className="relative w-[280px] h-[280px] sm:w-[320px] sm:h-[320px] md:w-[360px] md:h-[360px] flex items-center justify-center pointer-events-none transition-transform duration-150 ease-out"
        style={{
          transform: `scale(${scale})`,
        }}
      >
        {/* Core Glowing Video Stream */}
        <video
          ref={videoRef}
          poster="/blue_sphere.webp"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="w-full h-full object-cover rounded-full mix-blend-screen pointer-events-none select-none transition-all duration-200"
          style={{
            maskImage: 'radial-gradient(circle at center, black 65%, rgba(0, 0, 0, 0.7) 82%, transparent 96%)',
            WebkitMaskImage: 'radial-gradient(circle at center, black 65%, rgba(0, 0, 0, 0.7) 82%, transparent 96%)',
            filter: `drop-shadow(0 0 ${glowIntensity}px ${isThinking ? 'rgba(255, 165, 0, 0.7)' : 'rgba(0, 240, 255, 0.65)'}) ${
              isThinking ? 'hue-rotate(25deg) brightness(1.2)' : isSpeaking ? 'brightness(1.15) contrast(1.05)' : 'brightness(1.05)'
            }`,
          }}
        >
          <source src="/blue_sphere.webm" type="video/webm" />
          <source src="/blue_sphere.mp4" type="video/mp4" />
        </video>

        {/* Ethereal Rim Accent Ring */}
        <div 
          className="absolute inset-0 rounded-full border border-cyan-400/40 pointer-events-none shadow-[0_0_20px_rgba(0,240,255,0.4)]"
          style={{
            opacity: isSpeaking ? 0.9 : 0.6,
          }}
        />
      </div>
    </div>
  );
};

export default ArcReactor;
