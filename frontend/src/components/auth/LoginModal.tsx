"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { Lock, User, Key, AlertCircle } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen }) => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setError(null);
    setIsLoading(true);

    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020813]/80 backdrop-blur-md p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-md bg-[#020813]/90 border border-cyan-500/50 rounded-xl p-8 shadow-[0_0_30px_rgba(0,240,255,0.2)] font-mono"
        >
          {/* Sci-Fi HUD Corner Brackets */}
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-400" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-400" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-400" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-400" />

          {/* Title Header */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 rounded-full border border-cyan-500/50 flex items-center justify-center bg-cyan-950/30 mb-3 shadow-[0_0_15px_rgba(0,240,255,0.4)]">
              <Lock className="text-cyan-400" size={24} />
            </div>
            <h2 className="text-xl font-orbitron tracking-widest text-cyan-300 uppercase">System Authentication</h2>
            <p className="text-xs text-cyan-700 mt-1 uppercase tracking-wider">Access Restricted — Credentials Required</p>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 rounded bg-red-950/40 border border-red-500/50 text-red-300 text-xs flex items-center gap-2"
            >
              <AlertCircle size={16} className="shrink-0 text-red-400" />
              <span>{error}</span>
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
