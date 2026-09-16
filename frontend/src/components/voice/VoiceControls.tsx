"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff } from 'lucide-react';

interface VoiceControlsProps {
  onConnect: () => void;
  onDisconnect: () => void;
  connectionState: string;
  isMuted?: boolean;
  onToggleMute?: () => void;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({
  onConnect,
  onDisconnect,
  connectionState,
  isMuted = false,
  onToggleMute
}) => {
  const isConnected = connectionState === 'connected';
  const isConnecting = connectionState === 'connecting';

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-6">
        {isConnected && onToggleMute && (
          <motion.button
            whileHover={{ scale: 1.1, boxShadow: '0 0 15px rgba(0,240,255,0.5)' }}
            whileTap={{ scale: 0.95 }}
            onClick={onToggleMute}
            className={`p-3 rounded-md border border-cyan-500/50 relative overflow-hidden group
              ${isMuted ? 'text-cyan-900 bg-transparent' : 'text-cyan-300 bg-cyan-900/30'}`}
          >
            {/* HUD brackets */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-400 group-hover:w-3 group-hover:h-3 transition-all" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-400 group-hover:w-3 group-hover:h-3 transition-all" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-cyan-400 group-hover:w-3 group-hover:h-3 transition-all" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan-400 group-hover:w-3 group-hover:h-3 transition-all" />
            
            {isMuted ? <MicOff size={24} /> : <Mic size={24} className="drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]" />}
          </motion.button>
        )}

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={async () => {
            if (isConnected) {
              onDisconnect();
            } else {
              // Check if mediaDevices API is supported (requires HTTPS or http://localhost)
              if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                try {
                  await navigator.mediaDevices.getUserMedia({ audio: true });
                } catch (err: any) {
                  console.warn("Microphone permission denied or blocked:", err);
                }
              }
              onConnect();
            }
          }}
          disabled={isConnecting}
          className={`relative px-8 py-3 rounded-md border border-cyan-500 bg-[#020813]/80 backdrop-blur font-orbitron tracking-widest text-sm uppercase group
            ${isConnected ? 'text-cyan-300 shadow-[0_0_15px_rgba(0,240,255,0.3)]' : 'text-cyan-500'}
            ${isConnecting ? 'opacity-70 cursor-not-allowed' : ''}
          `}
        >
          {/* HUD brackets */}
          <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-400 opacity-50 group-hover:opacity-100 transition-opacity" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-400 opacity-50 group-hover:opacity-100 transition-opacity" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-400 opacity-50 group-hover:opacity-100 transition-opacity" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-400 opacity-50 group-hover:opacity-100 transition-opacity" />
          
          <div className="flex items-center gap-3">
            {isConnecting && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full"
              />
            )}
            
            <span>
              {isConnecting ? 'CONNECTING...' : isConnected ? 'ONLINE' : 'INITIALIZE'}
            </span>
          </div>
        </motion.button>
      </div>
      
      <div className="font-mono text-[10px] text-cyan-800 uppercase tracking-widest">
        SYS.COM.LINK: {connectionState}
      </div>
    </div>
  );
};
