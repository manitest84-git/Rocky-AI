'use client';
import React, { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface HologramCardProps {
  title?: string;
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'compact';
  visible?: boolean;
}

export const HologramCard = ({ 
  title, 
  children, 
  className = '', 
  variant = 'default',
  visible = true 
}: HologramCardProps) => {
  
  const CornerBracket = ({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) => {
    let positionClasses = '';
    let borderClasses = '';

    switch (position) {
      case 'tl':
        positionClasses = 'top-0 left-0';
        borderClasses = 'border-t-2 border-l-2';
        break;
      case 'tr':
        positionClasses = 'top-0 right-0';
        borderClasses = 'border-t-2 border-r-2';
        break;
      case 'bl':
        positionClasses = 'bottom-0 left-0';
        borderClasses = 'border-b-2 border-l-2';
        break;
      case 'br':
        positionClasses = 'bottom-0 right-0';
        borderClasses = 'border-b-2 border-r-2';
        break;
    }

    return (
      <div 
        className={`absolute w-3 h-3 border-[#00f0ff] ${positionClasses} ${borderClasses}`}
        style={{ boxShadow: `0 0 4px rgba(0, 240, 255, 0.5)` }}
      />
    );
  };

  const paddingClass = variant === 'compact' ? 'p-2' : 'p-4';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className={`relative flex flex-col ${className}`}
          style={{
            background: 'rgba(0, 240, 255, 0.03)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(0, 240, 255, 0.15)',
            boxShadow: '0 4px 30px rgba(0, 0, 0, 0.5), inset 0 0 20px rgba(0, 240, 255, 0.05)'
          }}
        >
          {/* Corner Markers */}
          <CornerBracket position="tl" />
          <CornerBracket position="tr" />
          <CornerBracket position="bl" />
          <CornerBracket position="br" />

          {/* Title Bar */}
          {title && (
            <div className="border-b border-[rgba(0,240,255,0.2)] px-3 py-1.5 flex items-center justify-between">
              <span 
                className="uppercase text-[10px] sm:text-xs text-[#00f0ff] tracking-[0.2em] font-bold"
                style={{ fontFamily: "'Orbitron', sans-serif" }}
              >
                {title}
              </span>
              <div className="flex gap-1">
                <div className="w-1 h-1 bg-[#00f0ff] opacity-50" />
                <div className="w-1 h-1 bg-[#00f0ff] opacity-50" />
                <div className="w-1 h-1 bg-[#00f0ff] opacity-100" />
              </div>
            </div>
          )}

          {/* Content Area */}
          <div 
            className={`flex-1 text-[#e0f7fa] ${paddingClass}`}
            style={{ fontFamily: "'Share Tech Mono', monospace" }}
          >
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default HologramCard;
