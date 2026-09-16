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
  barCount = 72,
  state = 'idle'
}: CircularVisualizerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    const size = baseRadius * 3 + 100; // rough bound for visualizer size
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const cx = size / 2;
    const cy = size / 2;
    const maxHeight = 100;

    const draw = () => {
      ctx.clearRect(0, 0, size, size);
      ctx.globalCompositeOperation = 'lighter';

      const dataArray = analyserData || new Uint8Array(barCount);
      const isIdle = !analyserData || (state === 'idle' || state === 'thinking');

      for (let i = 0; i < barCount; i++) {
        const angle = (i / barCount) * 2 * Math.PI - Math.PI / 2; // start at top
        
        let amplitude = 0;
        if (isIdle) {
          // Ambient idle movement
          amplitude = (Math.sin(Date.now() * 0.002 + i) * 0.5 + 0.5) * 0.1;
        } else {
          // Map to frequency bins if available (simple linear mapping)
          const dataIndex = Math.floor((i / barCount) * (dataArray.length || barCount));
          amplitude = (dataArray[dataIndex] || 0) / 255.0;
        }

        const barHeight = amplitude * maxHeight;
        const innerRadius = baseRadius;
        const outerRadius = baseRadius + barHeight + (isIdle ? 2 : 5);

        const x1 = cx + Math.cos(angle) * innerRadius;
        const y1 = cy + Math.sin(angle) * innerRadius;
        const x2 = cx + Math.cos(angle) * outerRadius;
        const y2 = cy + Math.sin(angle) * outerRadius;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);

        const intensity = isIdle ? 0.2 : 0.3 + amplitude * 0.7;
        const color = state === 'thinking' ? `rgba(255, 145, 0, ${intensity})` : `rgba(0, 240, 255, ${intensity})`;
        const shadowColor = state === 'thinking' ? '#ff9100' : '#00f0ff';

        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.shadowBlur = 6;
        ctx.shadowColor = shadowColor;
        ctx.stroke();
      }

      requestRef.current = requestAnimationFrame(draw);
    };

    requestRef.current = requestAnimationFrame(draw);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [analyserData, baseRadius, barCount, state]);

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
      <canvas ref={canvasRef} className="block" />
    </div>
  );
};

export default CircularVisualizer;
