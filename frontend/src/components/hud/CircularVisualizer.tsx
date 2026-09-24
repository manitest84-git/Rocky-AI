'use client';
import React, { useRef, useEffect } from 'react';

export interface CircularVisualizerProps {
  analyserData?: Uint8Array | null;
  baseRadius?: number;
  barCount?: number;
  state?: 'idle' | 'listening' | 'thinking' | 'speaking';
}

export const CircularVisualizer = ({
  analyserData = null,
  baseRadius = 120,
  barCount = 84,
  state = 'idle'
}: CircularVisualizerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | undefined>(undefined);
  const dataRef = useRef<Uint8Array | null>(analyserData);
  const stateRef = useRef<string>(state);

  useEffect(() => {
    dataRef.current = analyserData;
  }, [analyserData]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    const size = baseRadius * 3 + 120;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const cx = size / 2;
    const cy = size / 2;
    const maxHeight = 85;

    let tick = 0;

    const draw = () => {
      tick++;
      ctx.clearRect(0, 0, size, size);
      ctx.globalCompositeOperation = 'lighter';

      const dataArray = dataRef.current;
      const currentState = stateRef.current;
      const isIdle = !dataArray || currentState === 'idle';
      const isThinking = currentState === 'thinking';
      const isSpeaking = currentState === 'speaking';
      const isListening = currentState === 'listening';

      // 1. Draw glowing inner energy baseline circle
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius - 2, 0, Math.PI * 2);
      ctx.strokeStyle = isThinking 
        ? 'rgba(255, 145, 0, 0.4)' 
        : isSpeaking 
        ? 'rgba(0, 240, 255, 0.6)' 
        : 'rgba(0, 180, 255, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 2. Frequency Audio Spikes with multi-octave smoothing
      for (let i = 0; i < barCount; i++) {
        const angle = (i / barCount) * 2 * Math.PI - Math.PI / 2;
        
        let amplitude = 0;
        if (dataArray && dataArray.length > 0 && (isSpeaking || isListening)) {
          const idx = Math.floor((i / barCount) * Math.min(dataArray.length, 64));
          amplitude = (dataArray[idx] || 0) / 255.0;
        } else if (isThinking) {
          // Dynamic dual-speed plasma ripple during thinking
          amplitude = (Math.sin(tick * 0.08 + i * 0.3) * 0.5 + 0.5) * 0.35 +
                      (Math.cos(tick * 0.04 - i * 0.2) * 0.5 + 0.5) * 0.25;
        } else {
          // Subtle organic breathing wave in idle standby
          amplitude = (Math.sin(tick * 0.03 + i * 0.15) * 0.5 + 0.5) * 0.08;
        }

        const barHeight = amplitude * maxHeight;
        const innerRadius = baseRadius;
        const outerRadius = baseRadius + barHeight + (isIdle ? 3 : 6);

        const x1 = cx + Math.cos(angle) * innerRadius;
        const y1 = cy + Math.sin(angle) * innerRadius;
        const x2 = cx + Math.cos(angle) * outerRadius;
        const y2 = cy + Math.sin(angle) * outerRadius;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);

        // Dynamic multi-tone gradient / color scheme
        let color = 'rgba(0, 240, 255, 0.5)';
        let shadowColor = '#00f0ff';
        if (isThinking) {
          color = `rgba(255, 160, 0, ${0.4 + amplitude * 0.6})`;
          shadowColor = '#ff9100';
        } else if (isSpeaking) {
          // Electric cyan-white discharge on voice peaks
          const alpha = Math.min(1, 0.5 + amplitude * 0.6);
          color = amplitude > 0.6 ? `rgba(224, 255, 255, ${alpha})` : `rgba(0, 240, 255, ${alpha})`;
          shadowColor = amplitude > 0.6 ? '#ffffff' : '#00f0ff';
        } else if (isListening) {
          color = `rgba(0, 200, 255, ${0.35 + amplitude * 0.65})`;
          shadowColor = '#00c8ff';
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = isSpeaking ? 3.5 : 2.5;
        ctx.lineCap = 'round';
        ctx.shadowBlur = isSpeaking ? 10 : 5;
        ctx.shadowColor = shadowColor;
        ctx.stroke();

        // 3. Orbiting tip particle for high amplitude spikes
        if (amplitude > 0.45) {
          const tipX = cx + Math.cos(angle) * (outerRadius + 4);
          const tipY = cy + Math.sin(angle) * (outerRadius + 4);
          ctx.beginPath();
          ctx.arc(tipX, tipY, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.shadowBlur = 8;
          ctx.shadowColor = '#00f0ff';
          ctx.fill();
        }
      }

      requestRef.current = requestAnimationFrame(draw);
    };

    requestRef.current = requestAnimationFrame(draw);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [baseRadius, barCount]);

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
      <canvas ref={canvasRef} className="block" />
    </div>
  );
};
