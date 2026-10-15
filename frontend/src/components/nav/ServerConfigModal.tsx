"use client";

import React, { useState, useEffect } from 'react';
import { X, Server, Wifi, Globe, Check, RefreshCw, AlertCircle, ShieldCheck } from 'lucide-react';
import { DEFAULT_TAILSCALE_HOST, DEFAULT_LAN_HOST, getEffectiveServerHost, getApiUrl } from '@/lib/constants';

interface ServerConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ServerConfigModal: React.FC<ServerConfigModalProps> = ({ isOpen, onClose }) => {
  const [hostInput, setHostInput] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ status: 'idle' | 'success' | 'error'; message: string; latency?: number }>({
    status: 'idle',
    message: '',
  });

  useEffect(() => {
    if (isOpen) {
      setHostInput(getEffectiveServerHost());
      setTestResult({ status: 'idle', message: '' });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async (hostToTest?: string) => {
    const target = (hostToTest || hostInput || '').trim();
    if (!target) return;

    setIsTesting(true);
    setTestResult({ status: 'idle', message: 'Pinging Rocky Neural Core...' });
    const startTime = performance.now();

    try {
      const cleanHost = target.replace(/:\d+$/, '').replace(/^https?:\/\//, '');
      const port = target.includes(':') ? target.split(':')[1] : '8333';
      const testUrl = `http://${cleanHost}:${port}/api/health`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(testUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      const latency = Math.round(performance.now() - startTime);

      if (res.ok) {
        setTestResult({
          status: 'success',
          message: `Connected successfully (${latency}ms latency). Rocky Core online.`,
          latency,
        });
      } else {
        setTestResult({
          status: 'error',
          message: `Server returned HTTP ${res.status}. Host reached, check ports.`,
        });
      }
    } catch (e: any) {
      setTestResult({
        status: 'error',
        message: e.name === 'AbortError' ? 'Connection timed out (4s). Ensure host is online.' : 'Failed to reach server. Verify IP / Wi-Fi network.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveAndApply = () => {
    const clean = hostInput.trim();
    if (clean) {
      localStorage.setItem('rocky_server_host', clean);
      window.dispatchEvent(new CustomEvent('rocky-server-host-changed', { detail: clean }));
      onClose();
      // Brief reload to re-instantiate WebRTC and live socket singletons
      setTimeout(() => {
        window.location.reload();
      }, 100);
    }
  };

  const handleResetDefault = () => {
    localStorage.removeItem('rocky_server_host');
    setHostInput(DEFAULT_LAN_HOST);
    setTestResult({ status: 'idle', message: '' });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />

      {/* Modal Card */}
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-[#030d1d] border border-cyan-500/50 p-6 shadow-[0_0_50px_rgba(0,240,255,0.25)] space-y-5 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-cyan-900/60 pb-3">
          <div className="flex items-center gap-2.5">
            <Server className="w-5 h-5 text-cyan-400 animate-pulse" />
            <div>
              <h2 className="text-sm font-bold font-orbitron text-cyan-100 tracking-wider">
                ROCKY NEURAL UPLINK
              </h2>
              <p className="text-[10px] text-cyan-500 font-mono">Mobile & Remote Server Endpoint</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-cyan-500 hover:text-cyan-200 hover:bg-cyan-950/60 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Presets */}
        <div className="space-y-2">
          <label className="text-[10px] font-orbitron uppercase text-cyan-400 tracking-wider">
            Quick Uplink Presets
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setHostInput(DEFAULT_TAILSCALE_HOST);
                handleTestConnection(DEFAULT_TAILSCALE_HOST);
              }}
              className="p-2.5 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/40 border border-cyan-800/80 hover:border-cyan-400/80 text-left transition-all group"
            >
              <div className="flex items-center gap-1.5 text-cyan-300 font-orbitron text-[11px] font-bold group-hover:text-cyan-100">
                <Globe size={13} className="text-purple-400" />
                <span>Tailscale Mesh</span>
              </div>
              <div className="text-[10px] text-cyan-500 font-mono mt-0.5">{DEFAULT_TAILSCALE_HOST}</div>
            </button>

            <button
              type="button"
              onClick={() => {
                setHostInput(DEFAULT_LAN_HOST);
                handleTestConnection(DEFAULT_LAN_HOST);
              }}
              className="p-2.5 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/40 border border-cyan-800/80 hover:border-cyan-400/80 text-left transition-all group"
            >
              <div className="flex items-center gap-1.5 text-cyan-300 font-orbitron text-[11px] font-bold group-hover:text-cyan-100">
                <Wifi size={13} className="text-cyan-400" />
                <span>Local Wi-Fi LAN</span>
              </div>
              <div className="text-[10px] text-cyan-500 font-mono mt-0.5">{DEFAULT_LAN_HOST}</div>
            </button>
          </div>
        </div>

        {/* Input */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-orbitron uppercase text-cyan-400 tracking-wider flex items-center justify-between">
            <span>Target Host IP / Domain</span>
            <span className="text-[9px] text-cyan-600 font-mono">Ports: 8333 (API) | 7880 (RTC)</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={hostInput}
              onChange={(e) => setHostInput(e.target.value)}
              placeholder="e.g. 100.125.118.104 or rocky.local"
              className="flex-1 px-3 py-2 text-xs font-mono rounded-lg bg-[#010814] border border-cyan-700/80 text-cyan-100 placeholder-cyan-800 focus:outline-none focus:border-cyan-400 shadow-inner"
            />
            <button
              type="button"
              onClick={() => handleTestConnection()}
              disabled={isTesting}
              className="px-3 py-2 text-xs font-orbitron font-semibold rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/60 text-cyan-200 flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              {isTesting ? <RefreshCw size={13} className="animate-spin text-cyan-400" /> : <ShieldCheck size={13} />}
              <span>Test</span>
            </button>
          </div>
        </div>

        {/* Connection Test Result Badge */}
        {testResult.message && (
          <div className={`p-3 rounded-lg border text-xs font-mono flex items-start gap-2 ${
            testResult.status === 'success' 
              ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300' 
              : testResult.status === 'error'
              ? 'bg-red-950/40 border-red-500/50 text-red-300'
              : 'bg-cyan-950/30 border-cyan-800/50 text-cyan-300'
          }`}>
            {testResult.status === 'success' && <Check size={15} className="mt-0.5 shrink-0 text-emerald-400" />}
            {testResult.status === 'error' && <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-400" />}
            {testResult.status === 'idle' && <RefreshCw size={15} className="mt-0.5 shrink-0 animate-spin text-cyan-400" />}
            <span className="leading-snug">{testResult.message}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 flex items-center justify-between border-t border-cyan-900/60 gap-3">
          <button
            type="button"
            onClick={handleResetDefault}
            className="text-[10px] font-orbitron text-cyan-600 hover:text-cyan-400 transition-colors"
          >
            Reset Default
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-cyan-800/60 hover:bg-cyan-950/40 text-xs font-orbitron text-cyan-400 transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAndApply}
              className="px-4 py-1.5 rounded-lg bg-cyan-500/30 hover:bg-cyan-500/40 border border-cyan-400 text-xs font-orbitron font-bold text-cyan-100 shadow-[0_0_15px_rgba(0,240,255,0.4)] transition-all"
            >
              Save & Apply
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ServerConfigModal;
