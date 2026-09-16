"use client";

import React, { useState, useEffect, useRef, memo } from 'react';

interface DecryptTextProps {
  text: string;
  speed?: number;
  className?: string;
  onComplete?: () => void;
}

const CHAR_POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$<>[]{}|/\\-_=+*&^';

export const DecryptText = memo(({ text, speed = 30, className = '', onComplete }: DecryptTextProps) => {
  const [displayText, setDisplayText] = useState('');
  const [isAnimating, setIsAnimating] = useState(true);
  const frameRef = useRef<number | undefined>(undefined);
  const lastUpdateRef = useRef<number>(0);
  const lockIndexRef = useRef<number>(0);

  useEffect(() => {
    // Reset state on new text
    setIsAnimating(true);
    setDisplayText('');
    lockIndexRef.current = 0;
    
    const animate = (timestamp: number) => {
      if (!lastUpdateRef.current) lastUpdateRef.current = timestamp;
      const progress = timestamp - lastUpdateRef.current;

      if (progress > speed) {
        lastUpdateRef.current = timestamp;
        
        // Advance lock index
        if (lockIndexRef.current < text.length) {
          lockIndexRef.current++;
        } else {
          setIsAnimating(false);
          onComplete?.();
          return;
        }
      }

      // Generate current frame text
      let currentText = '';
      for (let i = 0; i < text.length; i++) {
        if (i < lockIndexRef.current) {
          currentText += text[i];
        } else if (text[i] === ' ') {
          currentText += ' ';
        } else {
          const randomChar = CHAR_POOL[Math.floor(Math.random() * CHAR_POOL.length)];
          currentText += randomChar;
        }
      }
      setDisplayText(currentText);
      
      if (lockIndexRef.current < text.length) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [text, speed, onComplete]);

  return (
    <div className={`font-mono text-cyan-300 tracking-widest drop-shadow-[0_0_8px_rgba(0,240,255,0.8)] ${className}`}>
      {displayText}
      {isAnimating && (
        <span className="inline-block w-2 h-4 bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(0,240,255,1)] ml-1 align-middle" />
      )}
    </div>
  );
});

DecryptText.displayName = 'DecryptText';
