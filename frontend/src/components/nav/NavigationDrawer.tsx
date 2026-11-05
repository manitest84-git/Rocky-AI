"use client";

import React, { useState } from 'react';
import { Menu, X, Users, Shield, Cpu, Mic, MessageSquare, Database, LogOut, Activity, Home, Sliders, CheckSquare, Calendar, DollarSign, Lock, Layers, User, GraduationCap, Globe, Server } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface NavigationDrawerProps {
  onOpenAdminPanel?: () => void;
  onOpenTaskManager?: () => void;
  onOpenCalendar?: () => void;
  onOpenFinance?: () => void;
  onOpenVault?: () => void;
  onOpenSmartHome?: () => void;
  onOpenMemoryMap?: () => void;
  onOpenUserProfile?: () => void;
  onOpenStudyMatrix?: () => void;
  onOpenIntegrations?: () => void;
  onOpenServerConfig?: () => void;
  onOpenLlmRouting?: () => void;
}

export const NavigationDrawer: React.FC<NavigationDrawerProps> = ({ 
  onOpenAdminPanel, 
  onOpenTaskManager, 
  onOpenCalendar, 
  onOpenFinance, 
  onOpenVault, 
  onOpenSmartHome,
  onOpenMemoryMap,
  onOpenUserProfile,
  onOpenStudyMatrix,
  onOpenIntegrations,
  onOpenServerConfig,
  onOpenLlmRouting,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout, isAdmin } = useAuth();

  return (
    <>
      {/* Top Left Menu Icon Trigger */}
      <div className="absolute top-[max(0.75rem,env(safe-area-inset-top,0px))] left-[max(0.75rem,env(safe-area-inset-left,0px))] z-30 flex items-center gap-3">
        <button
          onClick={() => setIsOpen(true)}
          className="p-2 sm:p-2.5 rounded-lg bg-[#031024]/80 border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 hover:text-cyan-100 hover:shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all backdrop-blur-md flex items-center justify-center group"
          title="Open System Menu"
        >
          <Menu size={18} className="sm:w-5 sm:h-5 group-hover:scale-110 transition-transform" />
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
          <div className="relative z-10 w-80 max-w-[85vw] h-full max-h-[100dvh] bg-[#020d1f]/95 border-r border-cyan-500/40 flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-xl animate-in slide-in-from-left duration-200 overflow-hidden">
            
            {/* Header & Operator Identity (Fixed Top) */}
            <div className="shrink-0 p-4 sm:p-5 pb-3 border-b border-cyan-900/60 bg-[#020d1f] pt-[max(1rem,env(safe-area-inset-top,0px))]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-cyan-400 animate-pulse" />
                  <span className="font-orbitron font-bold text-cyan-100 tracking-wider text-xs sm:text-sm">
                    SYSTEM NAVIGATION
                  </span>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-md text-cyan-400 hover:text-cyan-100 hover:bg-cyan-950/60 transition-colors"
                  aria-label="Close Navigation"
                >
                  <X size={18} />
                </button>
              </div>

              {/* User Identity Chip */}
              <div className="p-2 sm:p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-800/40 flex items-center justify-between">
                <div>
                  <div className="text-[9px] text-cyan-500 uppercase tracking-widest font-orbitron">OPERATOR</div>
                  <div className="font-bold text-xs sm:text-sm text-cyan-200">{user?.username || 'GUEST'}</div>
                </div>
                <div className={`px-2 py-0.5 text-[9px] font-orbitron font-bold rounded uppercase border ${
                  isAdmin 
                    ? 'bg-amber-950/50 border-amber-500/50 text-amber-300' 
                    : 'bg-cyan-950/50 border-cyan-500/50 text-cyan-300'
                }`}>
                  {user?.role || 'NONE'}
                </div>
              </div>
            </div>

            {/* Scrollable Navigation Items */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-1.5 focus:outline-none scrollbar-thin scrollbar-thumb-cyan-700/50 scrollbar-track-transparent [-webkit-overflow-scrolling:touch]">
              <div className="text-[9px] text-cyan-600 font-orbitron font-semibold uppercase px-2 mb-1.5 tracking-wider">
                Core Modules
              </div>

              {/* Task Matrix Item */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  if (onOpenTaskManager) onOpenTaskManager();
                }}
                className="w-full text-left px-3 py-2 sm:py-2.5 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/40 hover:border-cyan-400 text-cyan-200 flex items-center gap-3 transition-all text-xs font-orbitron group shadow-[0_0_10px_rgba(6,182,212,0.15)] active:scale-[0.99]"
              >
                <CheckSquare size={16} className="text-cyan-400 group-hover:scale-110 transition-transform shrink-0" />
                <span>Task Matrix & Notes</span>
              </button>

              {/* Calendar & Meetings Item (Sprint 2) */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  if (onOpenCalendar) onOpenCalendar();
                }}
                className="w-full text-left px-3 py-2 sm:py-2.5 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/40 hover:border-cyan-400 text-cyan-200 flex items-center gap-3 transition-all text-xs font-orbitron group shadow-[0_0_10px_rgba(6,182,212,0.15)] active:scale-[0.99]"
              >
                <Calendar size={16} className="text-cyan-400 group-hover:scale-110 transition-transform shrink-0" />
                <span>Calendar & Meetings</span>
              </button>

              {/* Finance & Shopping Item (Sprint 3) */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  if (onOpenFinance) onOpenFinance();
                }}
                className="w-full text-left px-3 py-2 sm:py-2.5 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/40 hover:border-cyan-400 text-cyan-200 flex items-center gap-3 transition-all text-xs font-orbitron group shadow-[0_0_10px_rgba(6,182,212,0.15)] active:scale-[0.99]"
              >
                <DollarSign size={16} className="text-cyan-400 group-hover:scale-110 transition-transform shrink-0" />
                <span>Finance & Shopping</span>
              </button>

              {/* Vault & Backups Item (Sprint 4) */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  if (onOpenVault) onOpenVault();
                }}
                className="w-full text-left px-3 py-2 sm:py-2.5 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/40 hover:border-cyan-400 text-cyan-200 flex items-center gap-3 transition-all text-xs font-orbitron group shadow-[0_0_10px_rgba(6,182,212,0.15)] active:scale-[0.99]"
              >
                <Lock size={16} className="text-cyan-400 group-hover:scale-110 transition-transform shrink-0" />
                <span>Vault & Backups</span>
              </button>

              {/* Proactive & Smart Home Item (Sprint 5) */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  if (onOpenSmartHome) onOpenSmartHome();
                }}
                className="w-full text-left px-3 py-2 sm:py-2.5 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/40 hover:border-cyan-400 text-cyan-200 flex items-center gap-3 transition-all text-xs font-orbitron group shadow-[0_0_10px_rgba(6,182,212,0.15)] active:scale-[0.99]"
              >
                <Home size={16} className="text-cyan-400 group-hover:scale-110 transition-transform shrink-0" />
                <span>Proactive & Smart Home</span>
              </button>

              {/* LLM Cognitive Matrix & Providers */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  if (onOpenLlmRouting) onOpenLlmRouting();
                }}
                className="w-full text-left px-3 py-2 sm:py-2.5 rounded-lg bg-cyan-950/70 hover:bg-cyan-900/80 border border-cyan-400/80 hover:border-cyan-300 text-cyan-100 flex items-center gap-3 transition-all text-xs font-orbitron group shadow-[0_0_15px_rgba(6,182,212,0.3)] active:scale-[0.99]"
              >
                <Cpu size={16} className="text-cyan-300 animate-pulse group-hover:scale-110 transition-transform shrink-0" />
                <span>LLM Cognitive Routing</span>
              </button>

              {/* System Memory Map */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  if (onOpenMemoryMap) onOpenMemoryMap();
                }}
                className="w-full text-left px-3 py-2 sm:py-2.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-400/60 hover:border-cyan-300 text-cyan-100 flex items-center gap-3 transition-all text-xs font-orbitron group shadow-[0_0_15px_rgba(0,240,255,0.25)] active:scale-[0.99]"
              >
                <Layers size={16} className="text-cyan-300 animate-pulse group-hover:scale-110 transition-transform shrink-0" />
                <span>System Memory Map</span>
              </button>

              {/* Operator Profile & Preferences */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  if (onOpenUserProfile) onOpenUserProfile();
                }}
                className="w-full text-left px-3 py-2 sm:py-2.5 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/40 hover:border-cyan-400 text-cyan-200 flex items-center gap-3 transition-all text-xs font-orbitron group shadow-[0_0_10px_rgba(6,182,212,0.15)] active:scale-[0.99]"
              >
                <Sliders size={16} className="text-cyan-400 group-hover:scale-110 transition-transform shrink-0" />
                <span>Profile & Auto-PTT Timeout</span>
              </button>

              {/* Admin-only option */}
              {isAdmin && (
                <button
                  onClick={() => {
                    setIsOpen(false);
                    if (onOpenAdminPanel) onOpenAdminPanel();
                  }}
                  className="w-full text-left px-3 py-2 sm:py-2.5 rounded-lg bg-amber-950/30 hover:bg-amber-900/40 border border-amber-500/40 hover:border-amber-400 text-amber-200 flex items-center gap-3 transition-all text-xs font-orbitron group active:scale-[0.99]"
                >
                  <Shield size={16} className="text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
                  <span>User Management</span>
                </button>
              )}

              {/* Study Matrix & AI Quiz */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  if (onOpenStudyMatrix) onOpenStudyMatrix();
                }}
                className="w-full text-left px-3 py-2 sm:py-2.5 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/40 hover:border-cyan-400 text-cyan-200 flex items-center gap-3 transition-all text-xs font-orbitron group shadow-[0_0_10px_rgba(6,182,212,0.15)] active:scale-[0.99]"
              >
                <GraduationCap size={16} className="text-cyan-400 group-hover:scale-110 transition-transform shrink-0" />
                <span>Study Matrix & AI Quiz</span>
              </button>

              {/* External Services & Weather */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  if (onOpenIntegrations) onOpenIntegrations();
                }}
                className="w-full text-left px-3 py-2 sm:py-2.5 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/40 hover:border-cyan-400 text-cyan-200 flex items-center gap-3 transition-all text-xs font-orbitron group shadow-[0_0_10px_rgba(6,182,212,0.15)] active:scale-[0.99]"
              >
                <Globe size={16} className="text-cyan-400 group-hover:scale-110 transition-transform shrink-0" />
                <span>Weather & News Wire</span>
              </button>

              {/* Server Uplink & Remote Endpoint Settings */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  if (onOpenServerConfig) onOpenServerConfig();
                }}
                className="w-full text-left px-3 py-2 sm:py-2.5 rounded-lg bg-purple-950/30 hover:bg-purple-900/40 border border-purple-500/40 hover:border-purple-400 text-purple-200 flex items-center gap-3 transition-all text-xs font-orbitron group shadow-[0_0_10px_rgba(168,85,247,0.15)] active:scale-[0.99]"
              >
                <Server size={16} className="text-purple-400 group-hover:scale-110 transition-transform shrink-0" />
                <span>Server Uplink / Host IP</span>
              </button>
            </div>

            {/* Fixed Footer / Logout Action (Always visible & pinned to bottom) */}
            <div className="shrink-0 p-3 sm:p-4 pt-3 border-t border-cyan-900/60 bg-[#020d1f] pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
              <button
                onClick={() => {
                  setIsOpen(false);
                  logout();
                }}
                className="w-full py-2.5 px-4 rounded-lg bg-red-950/50 hover:bg-red-900/60 border border-red-500/50 hover:border-red-400 text-red-200 hover:text-white font-orbitron text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)] active:scale-[0.98]"
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
