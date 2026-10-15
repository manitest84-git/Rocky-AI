"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mic, Radio, Square, Sliders, Shield, MessageSquare, Clock, EyeOff
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

  // Zero-Trace / Incognito mode
  isIncognito?: boolean;
  onToggleIncognito?: () => void;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({
  onConnect,
  onDisconnect,
  connectionState,
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
  isIncognito = false,
  onToggleIncognito,
}) => {
  const isConnected = connectionState === 'connected';
  const isConnecting = connectionState === 'connecting';

  return (
    <div className="w-full flex flex-col items-center gap-1.5 sm:gap-2">
      {/* 1. Mode Selector & Sub-Settings (Only when Connected) */}
      {isConnected && (
        <motion.div 
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full flex flex-col items-center gap-1.5 p-1.5 sm:p-2 rounded-xl bg-[#020813]/90 border border-cyan-500/40 backdrop-blur-md shadow-[0_0_20px_rgba(0,240,255,0.15)]"
        >
          {/* Main Mode Toggle Bar */}
          <div className="flex items-center justify-center gap-1 w-full bg-[#030d1d] rounded-lg p-0.5 border border-cyan-900/60">
            <button
              onClick={() => onToggleMode('ptt')}
              className={`flex-1 py-1 px-2 rounded-md text-[10px] sm:text-xs font-orbitron uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
                conversationMode === 'ptt'
                  ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/80 shadow-[0_0_8px_rgba(0,240,255,0.35)]'
                  : 'text-cyan-600 hover:text-cyan-400'
              }`}
            >
              <Mic size={12} className={conversationMode === 'ptt' ? 'text-cyan-300' : ''} />
              <span>PUSH TO TALK</span>
            </button>

            <button
              onClick={() => onToggleMode('continuous')}
              className={`flex-1 py-1 px-2 rounded-md text-[10px] sm:text-xs font-orbitron uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
                conversationMode === 'continuous'
                  ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/80 shadow-[0_0_8px_rgba(0,240,255,0.35)]'
                  : 'text-cyan-600 hover:text-cyan-400'
              }`}
            >
              <Radio size={12} className={conversationMode === 'continuous' ? 'text-cyan-300 animate-pulse' : ''} />
              <span>CONTINUOUS</span>
            </button>
          </div>

          {/* Continuous Mode Sub-Toggles: Hotword Guard & Auto-PTT Timeout */}
          {conversationMode === 'continuous' && (
            <div className="flex items-center justify-center gap-1.5 w-full">
              <button
                onClick={onToggleHotwordGuard}
                title={hotwordGuard ? "Hotword Guard ON: Requires 'Hey Rocky'" : "Hotword Guard OFF: Natural open microphone"}
                className={`flex-1 py-1 px-2 rounded-md border text-[9px] sm:text-[10px] font-orbitron tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
                  hotwordGuard
                    ? 'border-emerald-400/80 text-emerald-300 bg-emerald-950/40 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                    : 'border-amber-400/60 text-amber-300 bg-amber-950/40'
                }`}
              >
                {hotwordGuard ? <Shield size={11} className="text-emerald-400" /> : <MessageSquare size={11} className="text-amber-400" />}
                <span>{hotwordGuard ? "GUARD: ON" : "OPEN MIC"}</span>
              </button>

              {inactivityTimeout > 0 && (
                <button 
                  onClick={onOpenProfileSettings}
                  className="flex items-center justify-center gap-1 py-1 px-2 rounded-md bg-cyan-950/40 border border-cyan-900/60 text-[9px] sm:text-[10px] text-cyan-400 hover:border-cyan-600 transition-all cursor-pointer whitespace-nowrap"
                  title="Click to change inactivity timeout"
                >
                  <Clock size={10} className="text-cyan-500" />
                  <span>TIMEOUT: {inactivityRemaining ?? inactivityTimeout}s</span>
                  <Sliders size={9} className="text-cyan-600 ml-0.5" />
                </button>
              )}
            </div>
          )}
        </motion.div>
      )}

      {/* 2. PTT Hold Button (Only in PTT Mode when Connected) */}
      {isConnected && conversationMode === 'ptt' && (
        <motion.button
          whileTap={{ scale: 0.96 }}
          onPointerDown={onStartPtt}
          onPointerUp={onEndPtt}
          onPointerLeave={onEndPtt}
          className={`w-full py-2.5 sm:py-3 px-4 rounded-xl border font-orbitron text-xs sm:text-sm tracking-widest uppercase transition-all select-none cursor-pointer flex items-center justify-center gap-2 shadow-lg ${
            isPttActive
              ? 'bg-cyan-500/35 border-cyan-300 text-cyan-100 shadow-[0_0_25px_rgba(0,240,255,0.7)] scale-101'
              : 'bg-[#020813]/90 hover:bg-cyan-950/60 border-cyan-500/60 text-cyan-300 shadow-[0_0_15px_rgba(0,240,255,0.2)]'
          }`}
        >
          <Mic size={16} className={isPttActive ? 'text-cyan-200 animate-bounce' : 'text-cyan-400'} />
          <span>{isPttActive ? 'TRANSMITTING... (RELEASE)' : 'HOLD TO SPEAK'}</span>
          {isPttActive && <span className="w-2 h-2 rounded-full bg-cyan-300 animate-ping" />}
        </motion.button>
      )}

      {/* 3. Action Row: Stop, Master Connect/Disconnect, Settings, Incognito */}
      <div className="flex items-center justify-center gap-2 w-full">
        {/* STOP / INTERRUPT ROCKY Button (When Rocky is speaking) */}
        <AnimatePresence>
          {isConnected && isSpeaking && onStopRocky && (
            <motion.button
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onStopRocky}
              title="Interrupt and halt Rocky's speech immediately"
              className="py-2 px-3 sm:px-4 rounded-lg bg-red-600/30 border border-red-500 text-red-200 font-orbitron text-xs tracking-wider uppercase backdrop-blur-md shadow-[0_0_20px_rgba(239,68,68,0.7)] flex items-center gap-1.5 hover:bg-red-600/40 transition-all cursor-pointer shrink-0 animate-pulse"
            >
              <Square size={13} className="fill-red-400 text-red-400" />
              <span>STOP</span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Master Connect / Disconnect Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            if (isConnected) {
              onDisconnect();
            } else {
              onConnect();
            }
          }}
          disabled={isConnecting}
          title={isConnected ? "Session online. Click to disconnect." : "Click to initialize neural uplink."}
          className={`flex-1 py-2 sm:py-2.5 px-4 rounded-lg border font-orbitron tracking-widest text-xs sm:text-sm uppercase transition-all flex items-center justify-center gap-2 ${
            isConnected
              ? 'bg-[#020813]/90 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(0,240,255,0.3)]'
              : 'bg-[#020813]/90 border-cyan-500 hover:border-cyan-300 text-cyan-400 hover:text-cyan-200'
          } ${isConnecting ? 'opacity-70 cursor-not-allowed' : ''}`}
        >
          {isConnecting ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              className="w-3.5 h-3.5 border-2 border-cyan-500 border-t-transparent rounded-full"
            />
          ) : isConnected ? (
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(0,240,255,1)]" />
          ) : null}
          <span>
            {isConnecting ? 'CONNECTING...' : isConnected ? 'DISCONNECT' : 'INITIALIZE'}
          </span>
        </motion.button>

        {/* Settings Shortcut Button */}
        {onOpenProfileSettings && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onOpenProfileSettings}
            title="Operator Preferences & Inactivity Settings"
            className="p-2 sm:p-2.5 rounded-lg bg-[#020813]/90 hover:bg-cyan-950/60 border border-cyan-900/80 hover:border-cyan-500/60 text-cyan-500 hover:text-cyan-300 transition-all cursor-pointer shrink-0"
          >
            <Sliders size={15} />
          </motion.button>
        )}

        {/* Zero-Trace Incognito Toggle Button */}
        {onToggleIncognito && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onToggleIncognito}
            title={isIncognito ? "Zero-Trace Incognito Mode: ACTIVE" : "Toggle Zero-Trace Incognito Mode"}
            className={`p-2 sm:p-2.5 rounded-lg border transition-all cursor-pointer shrink-0 ${
              isIncognito
                ? 'bg-purple-950/80 border-purple-400 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.5)]'
                : 'bg-[#020813]/90 hover:bg-purple-950/40 border-cyan-900/80 hover:border-purple-500/50 text-cyan-600 hover:text-purple-300'
            }`}
          >
            <EyeOff size={15} />
          </motion.button>
        )}
      </div>

      {/* 4. Sub-Status Line (Clean, centered single-line summary) */}
      <div className="font-mono text-[9px] text-cyan-700 uppercase tracking-widest flex items-center justify-center gap-1.5 text-center">
        <span>SYS: {connectionState}</span>
        {isConnected && (
          <>
            <span className="text-cyan-500 font-semibold">• {conversationMode.toUpperCase()}</span>
            {conversationMode === 'continuous' && (
              <span className={hotwordGuard ? "text-emerald-500" : "text-amber-500"}>
                ({hotwordGuard ? "GUARD" : "OPEN MIC"})
              </span>
            )}
            {isIncognito && (
              <span className="text-purple-400 font-semibold">• 🕵️ ZERO-TRACE</span>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default VoiceControls;
