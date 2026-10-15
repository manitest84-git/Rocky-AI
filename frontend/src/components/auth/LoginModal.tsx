"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { Lock, User, Key, AlertCircle, Server, Wifi, Globe, Settings2, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { DEFAULT_LAN_HOST, DEFAULT_TAILSCALE_HOST, getEffectiveServerHost } from '@/lib/constants';

interface LoginModalProps {
  isOpen: boolean;
  onOpenServerConfig?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onOpenServerConfig }) => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [serverHost, setServerHost] = useState(DEFAULT_LAN_HOST);
  const [isCheckingPing, setIsCheckingPing] = useState(false);
  const [pingStatus, setPingStatus] = useState<{ online: boolean; latency?: number } | null>(null);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customHostValue, setCustomHostValue] = useState('');

  // Sync active host
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const current = getEffectiveServerHost();
      setServerHost(current);
      setCustomHostValue(current);
      checkConnectivity(current);
    }

    const handleHostChange = (e: any) => {
      const newHost = e.detail || getEffectiveServerHost();
      setServerHost(newHost);
      setCustomHostValue(newHost);
      checkConnectivity(newHost);
    };

    window.addEventListener('rocky-server-host-changed', handleHostChange);
    return () => window.removeEventListener('rocky-server-host-changed', handleHostChange);
  }, []);

  const checkConnectivity = async (host: string) => {
    setIsCheckingPing(true);
    const start = performance.now();
    try {
      const cleanHost = host.replace(/:\d+$/, '').replace(/^https?:\/\//, '');
      const port = host.includes(':') ? host.split(':')[1] : '8333';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(`http://${cleanHost}:${port}/api/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      const latency = Math.round(performance.now() - start);

      if (res.ok) {
        setPingStatus({ online: true, latency });
        setError(null);
      } else {
        setPingStatus({ online: false });
      }
    } catch {
      setPingStatus({ online: false });
    } finally {
      setIsCheckingPing(false);
    }
  };

  const handleSelectHost = (newHost: string) => {
    setServerHost(newHost);
    setCustomHostValue(newHost);
    if (typeof window !== 'undefined') {
      localStorage.setItem('rocky_server_host', newHost);
      window.dispatchEvent(new CustomEvent('rocky-server-host-changed', { detail: newHost }));
    }
    checkConnectivity(newHost);
  };

  const handleSaveCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customHostValue.trim();
    if (clean) {
      handleSelectHost(clean);
      setShowCustomInput(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setError(null);
    setIsLoading(true);

    try {
      await login(username, password);
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('networkerror') || msg.toLowerCase().includes('load failed')) {
        setError(`Cannot reach Rocky server at http://${serverHost}:8333. Tap "LAN Wi-Fi (${DEFAULT_LAN_HOST})" below if connected to local Wi-Fi, or switch to Tailscale.`);
      } else {
        setError(msg || 'Authentication failed. Please check credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020813]/85 backdrop-blur-md p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-md bg-[#020813]/95 border border-cyan-500/50 rounded-xl p-6 sm:p-8 shadow-[0_0_35px_rgba(0,240,255,0.25)] font-mono my-8"
        >
          {/* Sci-Fi HUD Corner Brackets */}
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-400" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-400" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-400" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-400" />

          {/* Title Header */}
          <div className="flex flex-col items-center mb-5">
            <div className="w-12 h-12 rounded-full border border-cyan-500/50 flex items-center justify-center bg-cyan-950/30 mb-2 shadow-[0_0_15px_rgba(0,240,255,0.4)]">
              <Lock className="text-cyan-400" size={22} />
            </div>
            <h2 className="text-lg sm:text-xl font-orbitron tracking-widest text-cyan-300 uppercase text-center">System Authentication</h2>
            <p className="text-[11px] text-cyan-600 mt-1 uppercase tracking-wider text-center">Credentials & Neural Uplink Required</p>
          </div>

          {/* SERVER UPLINK CONFIGURATION BAR */}
          <div className="mb-5 p-3 rounded-lg bg-cyan-950/20 border border-cyan-900/60 text-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-cyan-400 uppercase font-orbitron tracking-wider flex items-center gap-1.5">
                <Server size={12} className="text-cyan-400" /> Server Uplink
              </span>
              <div className="flex items-center gap-1.5">
                {isCheckingPing ? (
                  <span className="text-[10px] text-cyan-500 flex items-center gap-1">
                    <RefreshCw size={10} className="animate-spin" /> Ping...
                  </span>
                ) : pingStatus?.online ? (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={11} /> Online ({pingStatus.latency}ms)
                  </span>
                ) : (
                  <span className="text-[10px] text-red-400 flex items-center gap-1">
                    <XCircle size={11} /> Unreachable
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => checkConnectivity(serverHost)}
                  title="Refresh ping"
                  className="text-cyan-600 hover:text-cyan-300 p-0.5"
                >
                  <RefreshCw size={11} />
                </button>
              </div>
            </div>

            <div className="text-[11px] text-cyan-300 truncate font-mono mb-2.5 bg-black/40 px-2 py-1 rounded border border-cyan-900/40 flex items-center justify-between">
              <span className="truncate">http://{serverHost}:8333</span>
              <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 shrink-0 ml-1">
                Active
              </span>
            </div>

            {/* Quick Preset Buttons */}
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              <button
                type="button"
                onClick={() => handleSelectHost(DEFAULT_LAN_HOST)}
                className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded text-[10px] font-orbitron transition-all border ${
                  serverHost === DEFAULT_LAN_HOST
                    ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200 shadow-[0_0_8px_rgba(0,240,255,0.3)]'
                    : 'border-cyan-900/60 bg-black/30 text-cyan-500 hover:border-cyan-700 hover:text-cyan-300'
                }`}
              >
                <Wifi size={11} /> Wi-Fi LAN
              </button>

              <button
                type="button"
                onClick={() => handleSelectHost(DEFAULT_TAILSCALE_HOST)}
                className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded text-[10px] font-orbitron transition-all border ${
                  serverHost === DEFAULT_TAILSCALE_HOST
                    ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200 shadow-[0_0_8px_rgba(0,240,255,0.3)]'
                    : 'border-cyan-900/60 bg-black/30 text-cyan-500 hover:border-cyan-700 hover:text-cyan-300'
                }`}
              >
                <Globe size={11} /> Tailscale
              </button>
            </div>

            {/* Advanced / Custom IP Toggle */}
            <div className="flex items-center justify-between pt-1 border-t border-cyan-950">
              <button
                type="button"
                onClick={() => setShowCustomInput(!showCustomInput)}
                className="text-[10px] text-cyan-500 hover:text-cyan-300 flex items-center gap-1"
              >
                <Settings2 size={11} /> {showCustomInput ? 'Hide Custom IP' : 'Enter Custom IP / Host'}
              </button>
              {onOpenServerConfig && (
                <button
                  type="button"
                  onClick={onOpenServerConfig}
                  className="text-[10px] text-cyan-400 hover:text-cyan-200 underline font-orbitron"
                >
                  Uplink Wizard
                </button>
              )}
            </div>

            {/* Inline Custom Input */}
            {showCustomInput && (
              <form onSubmit={handleSaveCustom} className="mt-2.5 flex gap-1.5">
                <input
                  type="text"
                  value={customHostValue}
                  onChange={(e) => setCustomHostValue(e.target.value)}
                  placeholder="192.168.x.x or domain"
                  className="flex-1 bg-black/60 border border-cyan-800 rounded px-2 py-1 text-cyan-300 text-xs font-mono focus:outline-none focus:border-cyan-400"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1 bg-cyan-950 border border-cyan-600 rounded text-cyan-300 text-[10px] font-orbitron hover:bg-cyan-900"
                >
                  Set
                </button>
              </form>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 rounded bg-red-950/40 border border-red-500/50 text-red-300 text-xs flex items-start gap-2"
            >
              <AlertCircle size={16} className="shrink-0 text-red-400 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-username" className="block text-xs text-cyan-500 uppercase tracking-widest mb-1">Username</label>
              <div className="relative flex items-center">
                <User size={16} className="absolute left-3 text-cyan-700" />
                <input
                  id="login-username"
                  name="username"
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username..."
                  className="w-full bg-[#050e1a]/80 border border-cyan-900/60 rounded py-2 pl-9 pr-3 text-cyan-300 placeholder-cyan-900 focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_10px_rgba(0,240,255,0.3)] transition-all"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs text-cyan-500 uppercase tracking-widest mb-1">Security Key / Password</label>
              <div className="relative flex items-center">
                <Key size={16} className="absolute left-3 text-cyan-700" />
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password..."
                  className="w-full bg-[#050e1a]/80 border border-cyan-900/60 rounded py-2 pl-9 pr-3 text-cyan-300 placeholder-cyan-900 focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_10px_rgba(0,240,255,0.3)] transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-6 py-3 rounded border border-cyan-500 bg-cyan-950/40 hover:bg-cyan-900/50 text-cyan-300 font-orbitron tracking-widest text-sm uppercase transition-all shadow-[0_0_15px_rgba(0,240,255,0.2)] disabled:opacity-50"
            >
              {isLoading ? 'Authenticating...' : 'Authenticate & Unlock'}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
