"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type AIState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface StatusIndicatorProps {
  state: AIState;
  className?: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ state, className = '' }) => {
  const getVisualConfig = () => {
    switch (state) {
      case 'idle':
        return {
          dotColor: 'bg-cyan-800',
          dotShadow: 'shadow-[0_0_4px_rgba(0,240,255,0.3)]',
          pulseDuration: 4,
          label: 'STANDBY',
          textColor: 'text-cyan-800'
        };
      case 'listening':
        return {
          dotColor: 'bg-cyan-400',
          dotShadow: 'shadow-[0_0_12px_rgba(0,240,255,0.8)]',
          pulseDuration: 0.8,
          label: 'LISTENING',
          textColor: 'text-cyan-400'
        };
      case 'thinking':
        return {
          dotColor: 'bg-amber-500',
          dotShadow: 'shadow-[0_0_12px_rgba(255,145,0,0.8)]',
          pulseDuration: 1.5,
          label: 'PROCESSING',
          textColor: 'text-amber-500'
        };
      case 'speaking':
        return {
          dotColor: 'bg-cyan-300',
          dotShadow: 'shadow-[0_0_16px_rgba(0,240,255,1)]',
          pulseDuration: 1,
          label: 'SPEAKING',
          textColor: 'text-cyan-300'
        };
      default:
        return {
          dotColor: 'bg-cyan-800',
          dotShadow: 'shadow-[0_0_4px_rgba(0,240,255,0.3)]',
          pulseDuration: 4,
          label: 'STANDBY',
          textColor: 'text-cyan-800'
        };
    }
  };

  const config = getVisualConfig();

  return (
    <div className={`flex items-center gap-3 font-orbitron uppercase tracking-widest text-xs ${className}`}>
      <div className="relative w-4 h-4 flex items-center justify-center">
        <motion.div
          layoutId="status-dot"
          className={`absolute w-3 h-3 rounded-full ${config.dotColor} ${config.dotShadow}`}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.7, 1, 0.7]
          }}
          transition={{
            duration: config.pulseDuration,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        {state === 'listening' && (
          <motion.div
            className="absolute w-full h-full rounded-full border border-cyan-400"
            animate={{
              scale: [1, 2],
              opacity: [0.8, 0]
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              ease: "easeOut"
            }}
          />
        )}
        {state === 'thinking' && (
          <motion.div
            className="absolute w-5 h-5 rounded-full border-t border-b border-amber-500"
            animate={{
              rotate: 360
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "linear"
            }}
          />
        )}
      </div>
      
      <div className="relative w-24">
        <AnimatePresence mode="wait">
          <motion.span
            key={state}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
            className={`absolute left-0 top-1/2 -translate-y-1/2 ${config.textColor}`}
          >
            {config.label}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
};
