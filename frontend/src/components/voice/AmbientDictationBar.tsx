"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Check, Loader2, Copy } from 'lucide-react';

interface AmbientDictationBarProps {
  isRecording: boolean;
  isTranscribing: boolean;
  copiedToClipboard: boolean;
  lastTranscript?: string;
  onStartHold: () => void;
  onEndHold: () => void;
}

export const AmbientDictationBar: React.FC<AmbientDictationBarProps> = ({
  isRecording,
  isTranscribing,
  copiedToClipboard,
  lastTranscript,
  onStartHold,
  onEndHold,
}) => {
  const isVisible = isRecording || isTranscribing || copiedToClipboard;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 pointer-events-auto">
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className={`px-4 py-2.5 rounded-xl border backdrop-blur-xl shadow-2xl flex items-center gap-3 font-mono text-xs ${
              isRecording
                ? 'bg-[#020813]/90 border-cyan-400 text-cyan-300 shadow-[0_0_25px_rgba(0,240,255,0.4)]'
                : isTranscribing
                ? 'bg-[#020813]/90 border-amber-400 text-amber-300 shadow-[0_0_25px_rgba(245,158,11,0.3)]'
                : 'bg-[#020813]/90 border-emerald-400 text-emerald-300 shadow-[0_0_25px_rgba(16,185,129,0.3)]'
            }`}
          >
            {/* Status Icon */}
            <div className="relative flex items-center justify-center">
              {isRecording && (
                <>
                  <span className="w-3 h-3 rounded-full bg-cyan-400 animate-ping absolute" />
                  <Mic size={16} className="text-cyan-400 relative z-10" />
                </>
              )}
              {isTranscribing && (
                <Loader2 size={16} className="text-amber-400 animate-spin" />
              )}
              {!isRecording && !isTranscribing && copiedToClipboard && (
                <Check size={16} className="text-emerald-400" />
              )}
            </div>

            {/* Status Label & Waveform animation */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2 font-orbitron tracking-wider text-[11px] font-bold">
                {isRecording && <span>AMBIENT DICTATION (PTT)</span>}
                {isTranscribing && <span>TRANSCRIBING AUDIO...</span>}
                {!isRecording && !isTranscribing && copiedToClipboard && <span>DICTATION INJECTED</span>}
              </div>

              <div className="text-[10px] text-cyan-500/80 font-mono flex items-center gap-1.5">
                {isRecording && (
                  <div className="flex items-center gap-1">
                    <span>Listening</span>
                    <span className="flex gap-0.5 items-end h-2.5">
                      <span className="w-0.5 h-1.5 bg-cyan-400 animate-pulse" />
                      <span className="w-0.5 h-3 bg-cyan-400 animate-pulse delay-75" />
                      <span className="w-0.5 h-2 bg-cyan-400 animate-pulse delay-150" />
                    </span>
                    <span className="text-cyan-600 ml-1">• Release Ctrl+Space</span>
                  </div>
                )}
                {isTranscribing && <span>Faster-Whisper micro-service</span>}
                {!isRecording && !isTranscribing && copiedToClipboard && (
                  <span className="flex items-center gap-1 text-emerald-400">
                    <Copy size={10} /> Injected & Copied to System Clipboard
                  </span>
                )}
              </div>
            </div>

            {/* Quick Preview of last transcript */}
            {lastTranscript && !isRecording && (
              <div className="max-w-[200px] truncate border-l border-cyan-800/50 pl-2.5 text-[11px] text-cyan-200/90 italic">
                "{lastTranscript}"
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Push-to-Talk HUD Trigger Button (Available for mouse/touch hold) */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onMouseDown={onStartHold}
        onMouseUp={onEndHold}
        onTouchStart={onStartHold}
        onTouchEnd={onEndHold}
        title="Push-and-hold to dictate speech directly into the active text box (Ctrl+Space)"
        className={`mt-2 mx-auto flex items-center gap-2 px-3 py-1.5 rounded-full border bg-[#020813]/80 backdrop-blur-md font-orbitron text-[10px] uppercase tracking-wider transition-all select-none ${
          isRecording
            ? 'border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(0,240,255,0.4)]'
            : 'border-cyan-500/40 text-cyan-500 hover:text-cyan-300 hover:border-cyan-400/80'
        }`}
      >
        <Mic size={12} className={isRecording ? 'text-cyan-300 animate-pulse' : 'text-cyan-500'} />
        <span>{isRecording ? 'HOLDING PTT...' : 'PTT DICTATE (HOLD)'}</span>
        <span className="text-[9px] text-cyan-600 bg-cyan-950/60 px-1 rounded border border-cyan-800/40">
          Ctrl+Space
        </span>
      </motion.button>
    </div>
  );
};
