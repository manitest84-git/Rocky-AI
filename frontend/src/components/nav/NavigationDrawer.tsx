"use client";

import React, { useState } from 'react';
import { Menu, X, Users, Shield, Cpu, Mic, MessageSquare, Database, LogOut, Activity, Home, Sliders, CheckSquare, Calendar, DollarSign, Lock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface NavigationDrawerProps {
  onOpenAdminPanel?: () => void;
  onOpenTaskManager?: () => void;
  onOpenCalendar?: () => void;
  onOpenFinance?: () => void;
  onOpenVault?: () => void;
  onOpenSmartHome?: () => void;
}

export const NavigationDrawer: React.FC<NavigationDrawerProps> = ({ onOpenAdminPanel, onOpenTaskManager, onOpenCalendar, onOpenFinance, onOpenVault, onOpenSmartHome }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout, isAdmin } = useAuth();

  return (
    <>
      {/* Top Left Menu Icon Trigger */}
      <div className="absolute top-8 left-8 z-30 flex items-center gap-3">
        <button
          onClick={() => setIsOpen(true)}
          className="p-2.5 rounded-lg bg-[#031024]/80 border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 hover:text-cyan-100 hover:shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all backdrop-blur-md flex items-center justify-center group"
          title="Open System Menu"
        >
          <Menu size={20} className="group-hover:scale-110 transition-transform" />
        </button>
      </div>

      {/* Drawer Overlay & Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          {/* Sci-Fi HUD Side Drawer */}
          <div className="relative z-10 w-80 h-full bg-[#020d1f]/95 border-r border-cyan-500/40 p-6 flex flex-col justify-between shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-xl animate-in slide-in-from-left duration-200">
            
            {/* Header */}
            <div>
              <div className="flex items-center justify-between border-b border-cyan-900/60 pb-4 mb-6">
                <div className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-cyan-400 animate-pulse" />
                  <span className="font-orbitron font-bold text-cyan-100 tracking-wider text-sm">
                    SYSTEM NAVIGATION
                  </span>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-md text-cyan-400 hover:text-cyan-100 hover:bg-cyan-950/60 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* User Identity Chip */}
              <div className="p-3 mb-6 rounded-lg bg-cyan-950/40 border border-cyan-800/40 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-cyan-500 uppercase tracking-widest font-orbitron">OPERATOR</div>
                  <div className="font-bold text-sm text-cyan-200">{user?.username || 'GUEST'}</div>
                </div>
                <div className={`px-2 py-0.5 text-[10px] font-orbitron font-bold rounded uppercase border ${
                  isAdmin 
                    ? 'bg-amber-950/50 border-amber-500/50 text-amber-300' 
                    : 'bg-cyan-950/50 border-cyan-500/50 text-cyan-300'
                }`}>
                  {user?.role || 'NONE'}
                </div>
              </div>

              {/* Navigation Items */}
              <div className="space-y-1">
                <div className="text-[10px] text-cyan-600 font-orbitron font-semibold uppercase px-2 mb-2 tracking-wider">
                  Core Modules
                </div>

                {/* Task Matrix Item */}
                <button
                  onClick={() => {
                    setIsOpen(false);
                    if (onOpenTaskManager) onOpenTaskManager();
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-md bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/40 hover:border-cyan-400 text-cyan-200 flex items-center gap-3 transition-all text-xs font-orbitron group mb-2 shadow-[0_0_10px_rgba(6,182,212,0.15)]"
                >
                  <CheckSquare size={16} className="text-cyan-400 group-hover:scale-110 transition-transform" />
                  <span>Task Matrix & Notes</span>
                </button>

                {/* Calendar & Meetings Item (Sprint 2) */}
                <button
                  onClick={() => {
                    setIsOpen(false);
                    if (onOpenCalendar) onOpenCalendar();
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-md bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/40 hover:border-cyan-400 text-cyan-200 flex items-center gap-3 transition-all text-xs font-orbitron group mb-2 shadow-[0_0_10px_rgba(6,182,212,0.15)]"
                >
                  <Calendar size={16} className="text-cyan-400 group-hover:scale-110 transition-transform" />
                  <span>Calendar & Meetings</span>
                </button>

                {/* Finance & Shopping Item (Sprint 3) */}
                <button
                  onClick={() => {
                    setIsOpen(false);
                    if (onOpenFinance) onOpenFinance();
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-md bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/40 hover:border-cyan-400 text-cyan-200 flex items-center gap-3 transition-all text-xs font-orbitron group mb-2 shadow-[0_0_10px_rgba(6,182,212,0.15)]"
                >
                  <DollarSign size={16} className="text-cyan-400 group-hover:scale-110 transition-transform" />
                  <span>Finance & Shopping</span>
                </button>

                {/* Vault & Backups Item (Sprint 4) */}
                <button
                  onClick={() => {
                    setIsOpen(false);
                    if (onOpenVault) onOpenVault();
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-md bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/40 hover:border-cyan-400 text-cyan-200 flex items-center gap-3 transition-all text-xs font-orbitron group mb-2 shadow-[0_0_10px_rgba(6,182,212,0.15)]"
                >
                  <Lock size={16} className="text-cyan-400 group-hover:scale-110 transition-transform" />
                  <span>Vault & Backups</span>
                </button>

                {/* Proactive & Smart Home Item (Sprint 5) */}
                <button
                  onClick={() => {
                    setIsOpen(false);
                    if (onOpenSmartHome) onOpenSmartHome();
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-md bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/40 hover:border-cyan-400 text-cyan-200 flex items-center gap-3 transition-all text-xs font-orbitron group mb-2 shadow-[0_0_10px_rgba(6,182,212,0.15)]"
                >
                  <Home size={16} className="text-cyan-400 group-hover:scale-110 transition-transform" />
                  <span>Proactive & Smart Home</span>
                </button>

                {/* Admin-only option */}
                {isAdmin && (
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      if (onOpenAdminPanel) onOpenAdminPanel();
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-md bg-amber-950/30 hover:bg-amber-900/40 border border-amber-500/40 hover:border-amber-400 text-amber-200 flex items-center gap-3 transition-all text-xs font-orbitron group mb-2"
                  >
                    <Shield size={16} className="text-amber-400 group-hover:scale-110 transition-transform" />
                    <span>User Management</span>
                  </button>
                )}

                {/* Future Feature Placeholders */}
                <div className="w-full px-3 py-2.5 rounded-md text-cyan-300/80 hover:text-cyan-100 hover:bg-cyan-950/40 flex items-center gap-3 transition-all text-xs font-orbitron cursor-default opacity-60">
                  <Database size={16} className="text-cyan-500" />
                  <span>Knowledge Base / RAG (Upcoming)</span>
                </div>

                <div className="w-full px-3 py-2.5 rounded-md text-cyan-300/80 hover:text-cyan-100 hover:bg-cyan-950/40 flex items-center gap-3 transition-all text-xs font-orbitron cursor-default opacity-60">
                  <Sliders size={16} className="text-cyan-500" />
                  <span>Tool Integrations (Upcoming)</span>
                </div>
              </div>
            </div>

            {/* Footer / Logout Action */}
            <div className="pt-4 border-t border-cyan-900/60">
              <button
                onClick={() => {
                  setIsOpen(false);
                  logout();
                }}
                className="w-full py-2.5 px-4 rounded-lg bg-red-950/40 hover:bg-red-900/50 border border-red-500/40 hover:border-red-400 text-red-300 hover:text-red-100 font-orbitron text-xs flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(239,68,68,0.1)]"
              >
                <LogOut size={16} />
                <span>LOGOUT SESSION</span>
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
