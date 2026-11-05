"use client";

import React, { memo, useEffect } from 'react';

interface DecryptTextProps {
  text: string;
  speed?: number;
  className?: string;
  onComplete?: () => void;
}

/**
 * DecryptText renders text as clean plain text without scramble animations.
 */
export const DecryptText = memo(({ text, className = '', onComplete }: DecryptTextProps) => {
  useEffect(() => {
    onComplete?.();
  }, [text, onComplete]);

  return (
    <span className={`font-mono text-cyan-300 tracking-wide ${className}`}>
      {text}
    </span>
  );
});

DecryptText.displayName = 'DecryptText';
