"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Clock, Shield, Sliders, CheckCircle2, RotateCcw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface UserProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  inactivityTimeout: number; // in seconds, 0 = disabled
  onSaveTimeout: (seconds: number) => void;
}

export const UserProfileDrawer: React.FC<UserProfileDrawerProps> = ({
  isOpen,
  onClose,
  inactivityTimeout,
  onSaveTimeout,
}) => {
  const { user, isAdmin } = useAuth();
  const [selectedTimeout, setSelectedTimeout] = useState<number>(inactivityTimeout);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setSelectedTimeout(inactivityTimeout);
  }, [inactivityTimeout]);

  const TIMEOUT_OPTIONS = [
    { label: '15 SECONDS', value: 15, desc: 'Maximum battery & privacy saver' },
    { label: '30 SECONDS', value: 30, desc: 'Quick fallback on pause' },
    { label: '45 SECONDS (DEFAULT)', value: 45, desc: 'Balanced conversational timeout' },
    { label: '60 SECONDS', value: 60, desc: 'Longer contemplation window' },
    { label: '120 SECONDS', value: 120, desc: 'Extended multi-turn discussion' },
    { label: 'NEVER (DISABLED)', value: 0, desc: 'Remain in Continuous Mode until manually switched' },
  ];

  const handleApply = () => {
    onSaveTimeout(selectedTimeout);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 600);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end pointer-events-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[#020813]/70 backdrop-blur-sm"
        />

        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative w-full max-w-md h-full bg-[#020813]/95 border-l border-cyan-500/40 p-6 flex flex-col justify-between overflow-y-auto text-cyan-300 font-mono shadow-[0_0_50px_rgba(0,240,255,0.2)]"
        >
          <div>
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-cyan-900/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded bg-cyan-950 border border-cyan-400/50 shadow-[0_0_10px_rgba(0,240,255,0.4)]">
                  <User className="text-cyan-400" size={18} />
                </div>
                <div>
                  <h2 className="text-base font-orbitron font-bold text-cyan-200 tracking-wider">
                    OPERATOR.PROFILE
                  </h2>
                  <p className="text-[10px] text-cyan-500 tracking-widest uppercase">
                    Preferences & Inactivity Safeguards
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/40 text-cyan-400 hover:text-cyan-200 transition-all"
              >
                <X size={16} />
              </button>
            </div>

            {/* Operator Card */}
            <div className="my-5 p-3.5 rounded-lg bg-cyan-950/30 border border-cyan-800/60 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-cyan-600 uppercase text-[10px]">CURRENT OPERATOR:</span>
                <span className="font-bold text-cyan-200 flex items-center gap-1.5">
                  <User size={13} className="text-cyan-400" /> {user?.username || 'GUEST'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-cyan-600 uppercase text-[10px]">SECURITY LEVEL:</span>
                <span className={`font-bold uppercase text-[11px] ${isAdmin ? 'text-amber-400' : 'text-cyan-400'}`}>
                  {user?.role || 'OPERATOR'}
                </span>
              </div>
            </div>

            {/* Inactivity Fallback Settings */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-orbitron tracking-wider text-cyan-200 flex items-center gap-1.5">
                  <Clock size={14} className="text-cyan-400" />
                  Auto-PTT Inactivity Fallback
                </span>
                <span className="text-[10px] text-cyan-500">
                  {selectedTimeout === 0 ? 'Disabled' : `${selectedTimeout}s`}
                </span>
              </div>

              <p className="text-[11px] text-cyan-400/80 leading-relaxed">
                When operating in <strong>Continuous Mode</strong>, Rocky will automatically fall back to <strong>PTT Mode</strong> after silence to prevent ambient room sound from being captured:
              </p>

              <div className="space-y-2 mt-2">
                {TIMEOUT_OPTIONS.map((opt) => {
                  const isSelected = selectedTimeout === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setSelectedTimeout(opt.value)}
                      className={`w-full text-left p-3 rounded-lg border transition-all flex items-start justify-between cursor-pointer ${
                        isSelected
                          ? 'border-cyan-400 bg-cyan-950/70 shadow-[0_0_12px_rgba(0,240,255,0.25)]'
                          : 'border-cyan-900/60 bg-[#030c18] hover:border-cyan-700/80 hover:bg-cyan-950/30'
                      }`}
                    >
                      <div>
                        <span className={`text-xs font-orbitron font-bold block ${isSelected ? 'text-cyan-200' : 'text-cyan-400'}`}>
                          {opt.label}
                        </span>
                        <span className="text-[10px] text-cyan-600 block mt-0.5">
                          {opt.desc}
                        </span>
                      </div>
                      {isSelected && (
                        <CheckCircle2 size={16} className="text-cyan-400 mt-1 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-cyan-900/60 flex items-center gap-3">
            <button
              onClick={() => setSelectedTimeout(45)}
              className="p-2.5 rounded bg-cyan-950/40 hover:bg-cyan-900/40 border border-cyan-800 text-cyan-400 hover:text-cyan-200 transition-all text-xs flex items-center gap-1.5"
              title="Reset to 45s default"
            >
              <RotateCcw size={14} />
              <span className="hidden sm:inline">Reset</span>
            </button>
            <button
              onClick={handleApply}
              className={`flex-1 py-2.5 rounded font-orbitron text-xs tracking-widest uppercase transition-all flex items-center justify-center gap-2 ${
                saveSuccess
                  ? 'bg-emerald-500/30 border border-emerald-400 text-emerald-300'
                  : 'bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400 text-cyan-200 shadow-[0_0_15px_rgba(0,240,255,0.3)]'
              }`}
            >
              {saveSuccess ? (
                <>
                  <CheckCircle2 size={14} />
                  <span>SAVED TO PROFILE</span>
                </>
              ) : (
                <>
                  <Sliders size={14} />
                  <span>APPLY PREFERENCES</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
