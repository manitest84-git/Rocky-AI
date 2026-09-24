"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, AlertTriangle, Terminal, Trash2, Mail, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { HitLActionRecord, confirmHitLAction, rejectHitLAction } from '@/lib/api';

interface HitLConfirmationModalProps {
  action: HitLActionRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onDecisionMade?: (actionId: string, decision: 'confirmed' | 'rejected') => void;
}

export const HitLConfirmationModal: React.FC<HitLConfirmationModalProps> = ({
  action,
  isOpen,
  onClose,
  onDecisionMade,
}) => {
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [outcome, setOutcome] = useState<'confirmed' | 'rejected' | 'expired' | null>(null);

  useEffect(() => {
    if (!isOpen || !action) {
      setTimeLeft(60);
      setOutcome(null);
      return;
    }

    const expiresAt = new Date(action.expires_at).getTime();
    const updateCountdown = () => {
      const remainingSec = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setTimeLeft(remainingSec);
      if (remainingSec <= 0) {
        setOutcome('expired');
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [isOpen, action]);

  const handleConfirm = async () => {
    if (!action || isProcessing) return;
    setIsProcessing(true);
    try {
      await confirmHitLAction(action.action_id, action.username);
      setOutcome('confirmed');
      onDecisionMade?.(action.action_id, 'confirmed');
      setTimeout(() => {
        onClose();
        setIsProcessing(false);
      }, 1200);
    } catch (err: any) {
      console.error("HitL authorization error:", err);
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!action || isProcessing) return;
    setIsProcessing(true);
    try {
      await rejectHitLAction(action.action_id, action.username);
      setOutcome('rejected');
      onDecisionMade?.(action.action_id, 'rejected');
      setTimeout(() => {
        onClose();
        setIsProcessing(false);
      }, 1000);
    } catch (err: any) {
      console.error("HitL abort error:", err);
      setIsProcessing(false);
    }
  };

  if (!isOpen || !action) return null;

  const getCategoryIcon = () => {
    switch (action.category) {
      case 'terminal_write':
        return <Terminal className="text-amber-400 w-6 h-6" />;
      case 'file_deletion':
        return <Trash2 className="text-red-400 w-6 h-6" />;
      case 'email_sending':
        return <Mail className="text-cyan-400 w-6 h-6" />;
      default:
        return <ShieldAlert className="text-amber-400 w-6 h-6" />;
    }
  };

  const getCategoryLabel = () => {
    switch (action.category) {
      case 'terminal_write':
        return 'TERMINAL SHELL EXECUTION';
      case 'file_deletion':
        return 'PERMANENT FILE / DATA DELETION';
      case 'email_sending':
        return 'OUTGOING TRANSMISSION / EMAIL';
      default:
        return 'DESTRUCTIVE SYSTEM MODIFICATION';
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          className="relative w-full max-w-lg bg-[#020813]/95 border-2 border-red-500/70 rounded-xl p-6 shadow-[0_0_50px_rgba(239,68,68,0.35)] overflow-hidden font-mono text-cyan-300"
        >
          {/* Cyberpunk HUD Corner Brackets */}
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-red-400" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-red-400" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-red-400" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-red-400" />

          {/* Top Scanline / Pulse Header */}
          <div className="flex items-center justify-between pb-3 border-b border-red-500/30">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-lg bg-red-950/60 border border-red-500/50 shadow-[0_0_12px_rgba(239,68,68,0.5)]">
                {getCategoryIcon()}
              </span>
              <div>
                <div className="text-[10px] tracking-widest text-red-400 uppercase font-orbitron flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  HITL SAFEGUARD INTERCEPTOR
                </div>
                <div className="text-xs font-bold font-orbitron text-red-300 tracking-wider">
                  {getCategoryLabel()}
                </div>
              </div>
            </div>

            {/* Countdown Badge */}
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-950/40 border border-red-500/40 text-xs font-orbitron text-red-300">
              <Clock size={12} className="animate-spin text-red-400" style={{ animationDuration: '4s' }} />
              <span>{timeLeft}s</span>
            </div>
          </div>

          {/* Action Details Card */}
          <div className="my-4 p-3.5 rounded-lg bg-red-950/20 border border-red-500/30 space-y-2.5">
            <div className="text-xs text-red-200 font-semibold leading-relaxed">
              {action.title}
            </div>

            <div className="p-2.5 rounded bg-black/60 border border-red-900/50 font-mono text-[11px] text-red-300 overflow-x-auto select-all">
              <div className="text-[9px] text-red-500 uppercase tracking-widest mb-1">STAGED COMMAND / TARGET</div>
              <code className="text-red-200 break-all">{action.command}</code>
            </div>

            <div className="flex justify-between items-center text-[10px] text-red-400/80 pt-1">
              <span>TARGET: <span className="text-red-200 font-bold">{action.target}</span></span>
              <span>OPERATOR: <span className="text-red-200 font-bold">{action.username}</span></span>
            </div>
          </div>

          {/* Outcome Status Overlay if decided */}
          {outcome && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-3 rounded-lg border text-center font-orbitron text-xs mb-4 flex items-center justify-center gap-2 ${
                outcome === 'confirmed'
                  ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                  : outcome === 'rejected'
                  ? 'bg-red-950/60 border-red-500 text-red-300 shadow-[0_0_15px_rgba(239,68,68,0.4)]'
                  : 'bg-amber-950/60 border-amber-500 text-amber-300'
              }`}
            >
              {outcome === 'confirmed' && <CheckCircle2 size={16} />}
              {outcome === 'rejected' && <XCircle size={16} />}
              {outcome === 'expired' && <AlertTriangle size={16} />}
              <span>
                {outcome === 'confirmed' && 'ACTION AUTHORIZED & EXECUTED'}
                {outcome === 'rejected' && 'OPERATION ABORTED BY USER'}
                {outcome === 'expired' && 'CONFIRMATION TIMEOUT EXPIRED'}
              </span>
            </motion.div>
          )}

          {/* Dual Action Controls */}
          {!outcome && (
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleReject}
                disabled={isProcessing}
                className="flex-1 py-2.5 px-4 rounded-lg bg-red-950/40 hover:bg-red-900/50 border border-red-500/50 hover:border-red-400 text-red-300 font-orbitron text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
              >
                <XCircle size={14} />
                Abort
              </button>

              <button
                onClick={handleConfirm}
                disabled={isProcessing}
                className="flex-1 py-2.5 px-4 rounded-lg bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-500/70 hover:border-emerald-400 text-emerald-300 font-orbitron text-xs tracking-wider uppercase transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 font-bold"
              >
                <CheckCircle2 size={14} />
                Authorize & Execute
              </button>
            </div>
          )}

          {/* Voice Prompt Instructions */}
          <div className="text-[10px] text-red-500/70 text-center tracking-wider pt-3">
            VERBAL CONFIRMATION: Say <span className="text-emerald-400 font-bold">"Confirm"</span> or <span className="text-red-400 font-bold">"Abort"</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
