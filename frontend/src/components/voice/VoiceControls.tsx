"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mic, MicOff, Radio, Square, Sliders, Shield, ShieldAlert, 
  MessageSquare, Volume2, Sparkles, Clock
} from 'lucide-react';

interface VoiceControlsProps {
  onConnect: () => void;
  onDisconnect: () => void;
  connectionState: string;
  isMuted?: boolean;
  onToggleMute?: () => void;
  
  // Mode controls
  conversationMode: 'continuous' | 'ptt';
  onToggleMode: (mode: 'continuous' | 'ptt') => void;
  
  // Hotword Guard controls (for continuous mode)
  hotwordGuard: boolean;
  onToggleHotwordGuard: () => void;
  
  // PTT action handlers
  isPttActive: boolean;
  onStartPtt: () => void;
  onEndPtt: () => void;
  
  // Inactivity timeout remaining (for display)
  inactivityRemaining?: number;
  inactivityTimeout?: number;
  
  // Stop / Interrupt action
  isSpeaking?: boolean;
  onStopRocky?: () => void;

  // Open User Profile settings
  onOpenProfileSettings?: () => void;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({
  onConnect,
  onDisconnect,
  connectionState,
  isMuted = false,
  onToggleMute,
  conversationMode = 'ptt',
  onToggleMode,
  hotwordGuard = true,
  onToggleHotwordGuard,
  isPttActive = false,
  onStartPtt,
  onEndPtt,
  inactivityRemaining,
  inactivityTimeout = 45,
  isSpeaking = false,
  onStopRocky,
  onOpenProfileSettings,
}) => {
  const isConnected = connectionState === 'connected';
  const isConnecting = connectionState === 'connecting';

  return (
    <div className="flex flex-col items-center gap-3">
      {/* 1. Mode Switcher & Inactivity Bar (Visible when connected) */}
      {isConnected && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center justify-center gap-2 p-1 rounded-xl bg-[#020813]/90 border border-cyan-500/40 backdrop-blur-md shadow-[0_0_20px_rgba(0,240,255,0.15)]"
        >
          {/* Mode Pill Toggle */}
          <div className="flex bg-[#030d1d] rounded-lg p-0.5 border border-cyan-900/60">
            <button
              onClick={() => onToggleMode('ptt')}
              className={`px-3 py-1.5 rounded-md text-[11px] font-orbitron uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                conversationMode === 'ptt'
                  ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/80 shadow-[0_0_10px_rgba(0,240,255,0.4)]'
                  : 'text-cyan-600 hover:text-cyan-400'
              }`}
            >
              <Mic size={13} className={conversationMode === 'ptt' ? 'text-cyan-300' : ''} />
              <span>PUSH-TO-TALK</span>
            </button>
            <button
              onClick={() => onToggleMode('continuous')}
              className={`px-3 py-1.5 rounded-md text-[11px] font-orbitron uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                conversationMode === 'continuous'
                  ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/80 shadow-[0_0_10px_rgba(0,240,255,0.4)]'
                  : 'text-cyan-600 hover:text-cyan-400'
              }`}
            >
              <Radio size={13} className={conversationMode === 'continuous' ? 'text-cyan-300 animate-pulse' : ''} />
              <span>CONTINUOUS</span>
            </button>
          </div>

          {/* Sub-Option in Continuous Mode: Hotword Guard Toggle */}
          {conversationMode === 'continuous' && (
            <motion.button
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              whileTap={{ scale: 0.95 }}
              onClick={onToggleHotwordGuard}
              title={
                hotwordGuard
                  ? "Hotword Guard ON: Rocky strictly waits for 'Hey Rocky' and ignores ambient/side sound"
                  : "Hotword Guard OFF: Natural 2-way conversation like two humans speaking without wake words"
              }
              className={`px-3 py-1.5 rounded-lg border text-[10px] font-orbitron tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                hotwordGuard
                  ? 'border-emerald-400/80 text-emerald-300 bg-emerald-950/40 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                  : 'border-cyan-400/60 text-cyan-300 bg-cyan-950/40 hover:bg-cyan-900/40'
              }`}
            >
              {hotwordGuard ? <Shield size={13} className="text-emerald-400" /> : <MessageSquare size={13} className="text-cyan-400" />}
              <span>{hotwordGuard ? "HOTWORD: ON ('ROCKY')" : "HOTWORD: OFF (OPEN CHAT)"}</span>
            </motion.button>
          )}

          {/* Inactivity Fallback Countdown Tag */}
          {conversationMode === 'continuous' && inactivityTimeout > 0 && (
            <div 
              onClick={onOpenProfileSettings}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-cyan-950/40 border border-cyan-900/60 text-[10px] text-cyan-400 hover:border-cyan-600 transition-all cursor-pointer"
              title="Click to change inactivity timeout"
            >
              <Clock size={11} className="text-cyan-500" />
              <span>AUTO-PTT: {inactivityRemaining ?? inactivityTimeout}s</span>
              <Sliders size={10} className="text-cyan-600 ml-0.5" />
            </div>
          )}
        </motion.div>
      )}

      {/* 2. Interactive PTT Button or Stop Button Row */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* PTT Dedicated Button (Active when in PTT mode and connected) */}
        {isConnected && conversationMode === 'ptt' && (
          <motion.button
            whileTap={{ scale: 0.96 }}
            onPointerDown={onStartPtt}
            onPointerUp={onEndPtt}
            onPointerLeave={onEndPtt}
            className={`relative px-6 py-3 rounded-lg border font-orbitron text-xs sm:text-sm tracking-widest uppercase transition-all select-none cursor-pointer flex items-center gap-2.5 ${
              isPttActive
                ? 'bg-cyan-500/30 border-cyan-300 text-cyan-100 shadow-[0_0_30px_rgba(0,240,255,0.7)] scale-102'
                : 'bg-[#020813]/90 hover:bg-cyan-950/60 border-cyan-500/60 text-cyan-300 shadow-[0_0_15px_rgba(0,240,255,0.2)]'
            }`}
          >
            <Mic size={18} className={isPttActive ? 'text-cyan-200 animate-bounce' : 'text-cyan-400'} />
            <span>
              {isPttActive ? 'TRANSMITTING VOICE (RELEASE)' : 'HOLD SPACEBAR TO SPEAK'}
            </span>
            {isPttActive && (
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-300 animate-ping" />
            )}
          </motion.button>
        )}

        {/* STOP / INTERRUPT ROCKY Button (Visible when Rocky is speaking) */}
        <AnimatePresence>
          {isConnected && isSpeaking && onStopRocky && (
            <motion.button
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onStopRocky}
              title="Interrupt and halt Rocky's speech immediately (or press Escape)"
              className="px-5 py-3 rounded-lg bg-red-600/30 border-2 border-red-500 text-red-200 font-orbitron text-xs sm:text-sm tracking-wider uppercase backdrop-blur-md shadow-[0_0_25px_rgba(239,68,68,0.7)] flex items-center gap-2 hover:bg-red-600/40 transition-all cursor-pointer animate-pulse"
            >
              <Square size={14} className="fill-red-400 text-red-400" />
              <span>STOP ROCKY [ESC]</span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Master Connect / Disconnect Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            if (isConnected) {
              onDisconnect();
            } else {
              onConnect();
            }
          }}
          disabled={isConnecting}
          title={isConnected ? "Session online. Click to disconnect." : "Click to initialize neural uplink."}
          className={`relative px-7 py-3 rounded-lg border font-orbitron tracking-widest text-xs sm:text-sm uppercase transition-all ${
            isConnected
              ? 'bg-[#020813]/80 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(0,240,255,0.3)]'
              : 'bg-[#020813]/80 border-cyan-600 text-cyan-500 hover:text-cyan-300'
          } ${isConnecting ? 'opacity-70 cursor-not-allowed' : ''}`}
        >
          <div className="flex items-center gap-2.5">
            {isConnecting && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full"
              />
            )}
            {isConnected && (
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_10px_rgba(0,240,255,1)]" />
            )}
            <span>
              {isConnecting ? 'CONNECTING...' : isConnected ? 'DISCONNECT' : 'INITIALIZE'}
            </span>
          </div>
        </motion.button>

        {/* Settings Shortcut Button */}
        {onOpenProfileSettings && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onOpenProfileSettings}
            title="Operator Preferences & Inactivity Settings"
            className="p-3 rounded-lg bg-[#020813]/80 hover:bg-cyan-950/60 border border-cyan-900 hover:border-cyan-500/60 text-cyan-500 hover:text-cyan-300 transition-all cursor-pointer"
          >
            <Sliders size={18} />
          </motion.button>
        )}
      </div>

      {/* Sub-status label */}
      <div className="font-mono text-[10px] text-cyan-800 uppercase tracking-widest flex items-center gap-1.5">
        SYS.COM.LINK: {connectionState}
        {isConnected && (
          <>
            <span className="text-cyan-500 font-bold">
              • {conversationMode.toUpperCase()} MODE
            </span>
            {conversationMode === 'continuous' && (
              <span className={hotwordGuard ? "text-emerald-500" : "text-amber-500"}>
                ({hotwordGuard ? "HOTWORD GUARD ON" : "OPEN MIC"})
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default VoiceControls;
