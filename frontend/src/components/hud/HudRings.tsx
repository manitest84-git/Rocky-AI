'use client';
import React from 'react';

export interface HudRingsProps {
  state?: 'idle' | 'listening' | 'thinking' | 'speaking';
  className?: string;
}

export const HudRings = ({ state = 'idle', className = '' }: HudRingsProps) => {
  const isThinking = state === 'thinking';
  const isSpeaking = state === 'speaking';
  const isListening = state === 'listening';

  // State-dependent styles
  const baseColor = isThinking ? '#ff9100' : '#00f0ff';
  const altColor = isThinking ? '#ffaa00' : '#0088ff';
  const speedMultiplier = isThinking ? 3 : (isSpeaking ? 1.5 : 1);
  const opacityClass = isListening ? 'animate-pulse' : '';

  return (
    <div className={`absolute inset-0 flex items-center justify-center pointer-events-none ${className}`}>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin-cw {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spin-ccw {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        .hud-ring {
          transform-origin: 400px 400px;
        }
        .glow-filter {
          filter: drop-shadow(0 0 4px ${baseColor}) drop-shadow(0 0 8px ${altColor});
        }
      `}} />

      <svg viewBox="0 0 800 800" className="w-full h-full max-w-[800px] max-h-[800px] glow-filter opacity-80">
        
        {/* Ring 1: Outermost, faint, dashed */}
        <circle 
          cx="400" cy="400" r="380" 
          fill="none" stroke={baseColor} strokeWidth="1" 
          strokeDasharray="2 8" opacity="0.3"
          className="hud-ring"
          style={{ animation: `spin-cw ${60 / speedMultiplier}s linear infinite` }}
        />

        {/* Ring 2: Segmented arcs */}
        <circle 
          cx="400" cy="400" r="340" 
          fill="none" stroke={altColor} strokeWidth="3" 
          strokeDasharray="40 10 10 10" opacity="0.6"
          className="hud-ring"
          style={{ animation: `spin-ccw ${45 / speedMultiplier}s linear infinite` }}
        />

        {/* Ring 3: Thick brackets */}
        <circle 
          cx="400" cy="400" r="290" 
          fill="none" stroke={baseColor} strokeWidth="8" 
          strokeDasharray="60 20 5 20" opacity="0.8"
          className="hud-ring"
          style={{ animation: `spin-cw ${30 / speedMultiplier}s linear infinite` }}
        />

        {/* Ring 4: Fine tick marks */}
        <circle 
          cx="400" cy="400" r="240" 
          fill="none" stroke={baseColor} strokeWidth="4" 
          strokeDasharray="1 5" opacity="0.7"
          className="hud-ring"
          style={{ animation: `spin-ccw ${20 / speedMultiplier}s linear infinite` }}
        />

        {/* Ring 5: Inner detail ring */}
        <circle 
          cx="400" cy="400" r="190" 
          fill="none" stroke={altColor} strokeWidth="2" 
          strokeDasharray="15 5 2 5" opacity="0.9"
          className={`hud-ring ${opacityClass}`}
          style={{ animation: `spin-cw ${25 / speedMultiplier}s linear infinite` }}
        />

        {/* Radial tick marks */}
        <g stroke={baseColor} strokeWidth="2" opacity="0.5">
          <line x1="400" y1="20" x2="400" y2="40" />
          <line x1="400" y1="760" x2="400" y2="780" />
          <line x1="20" y1="400" x2="40" y2="400" />
          <line x1="760" y1="400" x2="780" y2="400" />
        </g>

        {/* Degree labels */}
        <g fill={baseColor} style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '14px', letterSpacing: '2px' }} textAnchor="middle" opacity="0.8">
          <text x="400" y="55">000</text>
          <text x="745" y="405">090</text>
          <text x="400" y="755">180</text>
          <text x="55" y="405">270</text>
        </g>

        {/* Crosshairs */}
        <g stroke={baseColor} strokeWidth="1" opacity="0.4">
          <path d="M400,10 L400,0 M395,5 L405,5" />
          <path d="M400,800 L400,790 M395,795 L405,795" />
          <path d="M0,400 L10,400 M5,395 L5,405" />
          <path d="M800,400 L790,400 M795,395 L795,405" />
        </g>
      </svg>
    </div>
  );
};

export default HudRings;
