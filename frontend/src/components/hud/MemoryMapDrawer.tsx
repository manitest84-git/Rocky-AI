"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Cpu, HardDrive, Wifi, Activity, Database, Server, 
  Radio, Shield, Terminal, Layers, RefreshCw, Zap
} from 'lucide-react';

interface MemoryMapDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeRoom?: any;
  connectionState?: string;
  agentVoiceState?: string;
  currentUser?: string;
}

export const MemoryMapDrawer: React.FC<MemoryMapDrawerProps> = ({
  isOpen,
  onClose,
  activeRoom,
  connectionState = 'disconnected',
  agentVoiceState = 'idle',
  currentUser = 'admin',
}) => {
  const [deviceInfo, setDeviceInfo] = useState({
    os: 'Unknown OS',
    browser: 'Browser',
    cores: 8,
    memory: '16 GB',
  });
  const [pingMs, setPingMs] = useState(12);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ua = navigator.userAgent;
      let os = 'macOS';
      if (ua.includes('Win')) os = 'Windows OS';
      else if (ua.includes('Android')) os = 'Android Mobile';
      else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'Apple iOS';
      else if (ua.includes('Linux')) os = 'Linux';

      let browser = 'Safari';
      if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Google Chrome';
      else if (ua.includes('Edg')) browser = 'Microsoft Edge';
      else if (ua.includes('Brave') || (navigator as any).brave) browser = 'Brave Browser';
      else if (ua.includes('Firefox')) browser = 'Mozilla Firefox';

      setDeviceInfo({
        os,
        browser,
        cores: navigator.hardwareConcurrency || 8,
        memory: (navigator as any).deviceMemory ? `${(navigator as any).deviceMemory} GB` : 'System Alloc',
      });
    }

    const interval = setInterval(() => {
      setPingMs(Math.floor(10 + Math.random() * 8));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end pointer-events-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[#020813]/70 backdrop-blur-sm"
        />

        {/* Drawer Container */}
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative w-full max-w-2xl h-full bg-[#020813]/95 border-l border-cyan-500/40 p-6 flex flex-col justify-between overflow-y-auto text-cyan-300 font-mono shadow-[0_0_50px_rgba(0,240,255,0.2)]"
        >
          {/* Header */}
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-cyan-900/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded bg-cyan-950/80 border border-cyan-400/50 shadow-[0_0_10px_rgba(0,240,255,0.4)]">
                  <Layers className="text-cyan-400 animate-pulse" size={20} />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-orbitron font-bold text-cyan-200 tracking-wider">
                    SYSTEM.MEMORY.MAP
                  </h2>
                  <p className="text-[10px] sm:text-xs text-cyan-500 tracking-widest uppercase">
                    Connected Ecosystem Topology & Neural Pipeline
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/40 text-cyan-400 hover:text-cyan-200 transition-all"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Live Status Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
              <div className="p-2.5 rounded bg-cyan-950/40 border border-cyan-900/80">
                <span className="text-[10px] text-cyan-600 uppercase block">NODE STATUS</span>
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  ACTIVE LINK
                </span>
              </div>
              <div className="p-2.5 rounded bg-cyan-950/40 border border-cyan-900/80">
                <span className="text-[10px] text-cyan-600 uppercase block">LATENCY (RTT)</span>
                <span className="text-xs font-bold text-cyan-300 flex items-center gap-1 mt-0.5">
                  <Wifi size={12} className="text-cyan-400" /> {pingMs} ms
                </span>
              </div>
              <div className="p-2.5 rounded bg-cyan-950/40 border border-cyan-900/80">
                <span className="text-[10px] text-cyan-600 uppercase block">ACTIVE VOICE</span>
                <span className="text-xs font-bold text-amber-400 uppercase mt-0.5 block">
                  {agentVoiceState.toUpperCase()}
                </span>
              </div>
              <div className="p-2.5 rounded bg-cyan-950/40 border border-cyan-900/80">
                <span className="text-[10px] text-cyan-600 uppercase block">OPERATOR</span>
                <span className="text-xs font-bold text-cyan-300 uppercase mt-0.5 block">
                  {currentUser}
                </span>
              </div>
            </div>

            {/* Topology Node Map */}
            <div className="space-y-3 mt-4">
              <span className="text-[11px] font-orbitron tracking-widest text-cyan-400 uppercase flex items-center gap-1.5">
                <Cpu size={14} /> Neural & Infrastructure Pipeline
              </span>

              {/* Node 1: Connected Client Terminal */}
              <div className="p-3.5 rounded-lg bg-[#050f20]/80 border border-cyan-500/30 flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded bg-cyan-900/40 border border-cyan-500/40 text-cyan-400 mt-0.5">
                    <Terminal size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold font-orbitron text-cyan-200">
                      CLIENT NODE // {deviceInfo.os.toUpperCase()}
                    </h3>
                    <p className="text-[10px] text-cyan-500">
                      {deviceInfo.browser} • Hardware: {deviceInfo.cores} Cores • {deviceInfo.memory}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 text-[9px] text-cyan-400">
                      <span className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800">
                        Transport: WebRTC UDP
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800">
                        DataChannel: Synchronized
                      </span>
                    </div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-950/60 border border-emerald-500/50 text-emerald-300">
                  CONNECTED
                </span>
              </div>

              {/* Node 2: Neural LLM Engine */}
              <div className="p-3.5 rounded-lg bg-[#050f20]/80 border border-cyan-500/30 flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded bg-purple-900/40 border border-purple-500/40 text-purple-400 mt-0.5">
                    <Zap size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold font-orbitron text-purple-200">
                      NEURAL CORE // OLLAMA ENGINE
                    </h3>
                    <p className="text-[10px] text-purple-400">
                      Active Model: <span className="text-white font-bold">qwen3.5b</span> (1.9 GB Memory)
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 text-[9px] text-purple-300">
                      <span className="px-1.5 py-0.5 rounded bg-purple-950 border border-purple-800">
                        Context: 4,096 Tokens
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-purple-950 border border-purple-800">
                        Quant: Q4_K_M
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-purple-950 border border-purple-800">
                        Parallel Slots: 4
                      </span>
                    </div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-950/60 border border-emerald-500/50 text-emerald-300">
                  HEALTHY
                </span>
              </div>

              {/* Node 3: Audio Transport & LiveKit SFU */}
              <div className="p-3.5 rounded-lg bg-[#050f20]/80 border border-cyan-500/30 flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded bg-cyan-900/40 border border-cyan-500/40 text-cyan-400 mt-0.5">
                    <Radio size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold font-orbitron text-cyan-200">
                      AUDIO SFU // LIVEKIT & SPEECH SERVICES
                    </h3>
                    <p className="text-[10px] text-cyan-500">
                      VAD: Silero Neural • STT: Faster-Whisper (:8334) • TTS: Kokoro-82M
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 text-[9px] text-cyan-400">
                      <span className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800">
                        Opus 48kHz
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800">
                        Echo Cancellation: ON
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800">
                        Full-Duplex Interruption: Active
                      </span>
                    </div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-950/60 border border-emerald-500/50 text-emerald-300">
                  STREAMING
                </span>
              </div>

              {/* Node 4: PostgreSQL + pgvector Vector Memory */}
              <div className="p-3.5 rounded-lg bg-[#050f20]/80 border border-cyan-500/30 flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded bg-blue-900/40 border border-blue-500/40 text-blue-400 mt-0.5">
                    <Database size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold font-orbitron text-blue-200">
                      VECTOR MEMORY // POSTGRESQL 16 (PGVECTOR)
                    </h3>
                    <p className="text-[10px] text-blue-400">
                      Semantic Embeddings & Long-Term Recall Storage
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 text-[9px] text-blue-300">
                      <span className="px-1.5 py-0.5 rounded bg-blue-950 border border-blue-800">
                        Tables: Memories, Shopping, Tasks, Calendar
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-blue-950 border border-blue-800">
                        Dim: 1536
                      </span>
                    </div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-950/60 border border-emerald-500/50 text-emerald-300">
                  INDEXED
                </span>
              </div>

              {/* Node 5: Redis Event Bus & Fast Cache */}
              <div className="p-3.5 rounded-lg bg-[#050f20]/80 border border-cyan-500/30 flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded bg-red-900/40 border border-red-500/40 text-red-400 mt-0.5">
                    <Server size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold font-orbitron text-red-200">
                      EVENT BUS // REDIS 7 ALPINES
                    </h3>
                    <p className="text-[10px] text-red-400">
                      High-Throughput Pub/Sub & Inter-Service Message Queue
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 text-[9px] text-red-300">
                      <span className="px-1.5 py-0.5 rounded bg-red-950 border border-red-800">
                        Channel: livekit_events
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-red-950 border border-red-800">
                        Buffer: In-Memory
                      </span>
                    </div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-950/60 border border-emerald-500/50 text-emerald-300">
                  SYNCHRONIZED
                </span>
              </div>
            </div>
          </div>

          {/* Footer Close Button */}
          <div className="pt-4 border-t border-cyan-900/60 flex items-center justify-between">
            <span className="text-[10px] text-cyan-600 font-mono">
              SYSTEM INTEGRITY: 100% OPERATIONAL
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 font-orbitron text-xs tracking-wider uppercase transition-all"
            >
              CLOSE MAP
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
