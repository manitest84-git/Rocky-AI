"use client";

import React, { useState, useEffect } from 'react';

// HUD components
import { PerspectiveGrid } from './hud/PerspectiveGrid';
import { ArcReactor } from './hud/ArcReactor';
import { HudRings } from './hud/HudRings';
import { CircularVisualizer } from './hud/CircularVisualizer';
import { HologramCard } from './hud/HologramCard';

// Voice components
import { DecryptText } from './voice/DecryptText';
import { StatusIndicator } from './voice/StatusIndicator';
import { VoiceControls } from './voice/VoiceControls';
import { ChatPanel } from './voice/ChatPanel';

// Hooks
import { useAudioReactor } from '@/hooks/useAudioReactor';
import { useJarvisState } from '@/hooks/useJarvisState';
import { useLiveKit } from '@/hooks/useLiveKit';

// LiveKit
import { LiveKitRoom, RoomAudioRenderer, useVoiceAssistant } from '@livekit/components-react';


import { useAuth } from '@/context/AuthContext';
import { LoginModal } from './auth/LoginModal';
import { AdminPanel } from './admin/AdminPanel';
import { NavigationDrawer } from './nav/NavigationDrawer';
import { TaskManagerDrawer } from './hud/TaskManagerDrawer';
import { CalendarManagerDrawer } from './hud/CalendarManagerDrawer';
import { FinanceShoppingDrawer } from './hud/FinanceShoppingDrawer';
import { VaultBackupDrawer } from './hud/VaultBackupDrawer';
import ProactiveSmartHomeDrawer from './hud/ProactiveSmartHomeDrawer';
import { User, LogOut, Settings } from 'lucide-react';

const JarvisRoom = () => {
  const { state: agentState, audioTrack } = useVoiceAssistant();
  const visualState = useJarvisState(agentState as any);
  const { frequencyData, volume, connectToTrack } = useAudioReactor();

  useEffect(() => {
    if (audioTrack) {
      connectToTrack(audioTrack);
    }
  }, [audioTrack, connectToTrack]);

  return (
    <>
      <RoomAudioRenderer />
      
      {/* Top Left: Status */}
      <div className="absolute top-8 left-24 z-10">
        <StatusIndicator state={agentState as any} />
      </div>

      {/* Center: Visuals */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0 flex items-center justify-center">
        <ArcReactor volume={volume} state={agentState as any} />
        <div className="absolute">
          <HudRings state={agentState as any} />
        </div>
        <div className="absolute">
          <CircularVisualizer analyserData={frequencyData} />
        </div>
      </div>
    </>
  );
};

export const JarvisInterface = () => {
  const [time, setTime] = useState<string>('');
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isTaskManagerOpen, setIsTaskManagerOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isFinanceOpen, setIsFinanceOpen] = useState(false);
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [isSmartHomeOpen, setIsSmartHomeOpen] = useState(false);
  const { user, logout, isAuthenticated, isAdmin } = useAuth();
  const { connect, disconnect, connectionState, token, serverUrl } = useLiveKit();
  const isConnected = connectionState === 'connected';

  useEffect(() => {
    const updateClock = () => setTime(new Date().toLocaleTimeString());
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Proactive spoken audio greeting when INITIALIZE / Online is triggered
  useEffect(() => {
    if (isConnected) {
      const userName = user?.username || '';
      const greetingText = `Hello ${userName}! I am Rocky. How can I make your day better today?`;
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(greetingText);
        utterance.rate = 0.95;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      }
    }
  }, [isConnected, user]);

  // Voice Input (Microphone Listener) via Browser Web Speech API
  useEffect(() => {
    if (!isConnected) return;

    let recognition: any = null;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onerror = (err: any) => {
          console.warn("Speech recognition event:", err);
        };

        recognition.start();
      } catch (e) {
        console.warn("Speech recognition initialization notice:", e);
      }
    }

    return () => {
      if (recognition) {
        try { recognition.stop(); } catch (e) {}
      }
    };
  }, [isConnected]);

  return (
    <div className="relative w-full h-screen bg-[#020813] text-cyan-300 overflow-hidden font-mono selection:bg-cyan-900/50">
      {/* Top-Left Navigation Menu Drawer */}
      <NavigationDrawer 
        onOpenAdminPanel={() => setIsAdminPanelOpen(true)} 
        onOpenTaskManager={() => setIsTaskManagerOpen(true)}
        onOpenCalendar={() => setIsCalendarOpen(true)}
        onOpenFinance={() => setIsFinanceOpen(true)}
        onOpenVault={() => setIsVaultOpen(true)}
        onOpenSmartHome={() => setIsSmartHomeOpen(true)}
      />

      {/* Task Manager & Quick Capture Drawer */}
      <TaskManagerDrawer 
        isOpen={isTaskManagerOpen} 
        onClose={() => setIsTaskManagerOpen(false)} 
      />

      {/* Calendar & Meetings Drawer (Sprint 2) */}
      <CalendarManagerDrawer
        isOpen={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
      />

      {/* Finance, Money Management & Shopping Drawer (Sprint 3) */}
      <FinanceShoppingDrawer
        isOpen={isFinanceOpen}
        onClose={() => setIsFinanceOpen(false)}
      />

      {/* Critical Vault & Database Backup Drawer (Sprint 4) */}
      <VaultBackupDrawer
        isOpen={isVaultOpen}
        onClose={() => setIsVaultOpen(false)}
      />

      {/* Proactive & Smart Home Automation Drawer (Sprint 5) */}
      <ProactiveSmartHomeDrawer
        isOpen={isSmartHomeOpen}
        onClose={() => setIsSmartHomeOpen(false)}
      />

      {/* Login Modal prompt if not authenticated */}
      <LoginModal isOpen={!isAuthenticated} />

      {/* Admin Management Panel */}
      <AdminPanel isOpen={isAdminPanelOpen} onClose={() => setIsAdminPanelOpen(false)} />

      <div className="absolute inset-0 z-0 opacity-40">
        <PerspectiveGrid />
      </div>

      {/* System Info & User Badge: hidden on small mobile, visible on lg screens */}
      <div className="hidden xl:block absolute top-8 right-[424px] z-10 w-60 space-y-3">
        <HologramCard title="USER.SESSION">
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-cyan-700">OPERATOR:</span>
              <span className="font-bold text-cyan-300 flex items-center gap-1">
                <User size={12} className="text-cyan-400" /> {user?.username || 'GUEST'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-cyan-700">ROLE:</span>
              <span className={`uppercase font-bold ${isAdmin ? 'text-amber-400' : 'text-cyan-400'}`}>
                {user?.role || 'NONE'}
              </span>
            </div>
            <div className="pt-2 flex gap-2 border-t border-cyan-900/40">
              {isAdmin && (
                <button
                  onClick={() => setIsAdminPanelOpen(true)}
                  className="flex-1 py-1 rounded bg-cyan-950/60 border border-cyan-500/50 hover:bg-cyan-900/60 text-[10px] uppercase font-orbitron text-cyan-300 flex items-center justify-center gap-1 transition-all"
                >
                  <Settings size={10} /> Manage Users
                </button>
              )}
              <button
                onClick={logout}
                className="py-1 px-2 rounded bg-red-950/40 border border-red-500/40 hover:bg-red-900/40 text-[10px] uppercase font-orbitron text-red-300 flex items-center justify-center gap-1 transition-all"
                title="Logout"
              >
                <LogOut size={10} /> Logout
              </button>
            </div>
          </div>
        </HologramCard>

        <HologramCard title="SYS.INFO">
          <div className="space-y-2 text-xs">
            <div className="flex justify-between gap-4">
              <span className="text-cyan-700">TIME:</span>
              <span>{time}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-cyan-700">MODEL:</span>
              <span>R.O.C.K.Y. v4.0</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-cyan-700">STATUS:</span>
              <span className={isConnected ? 'text-cyan-300' : 'text-cyan-700'}>
                {isConnected ? 'ONLINE' : 'STANDBY'}
              </span>
            </div>
          </div>
        </HologramCard>
      </div>

      {isConnected && token ? (
        <LiveKitRoom serverUrl={serverUrl} token={token} connect={true} audio={true}>
          <JarvisRoom />
        </LiveKitRoom>
      ) : (
        <>
          {/* Idle state center visuals - scale down on smaller mobile screens */}
          <div className="absolute top-1/3 md:top-1/2 left-1/2 md:left-[calc(50%-200px)] -translate-x-1/2 -translate-y-1/2 z-0 flex items-center justify-center scale-75 md:scale-100 transition-transform">
            <ArcReactor volume={0} state="idle" />
            <div className="absolute">
              <HudRings state="idle" />
            </div>
          </div>
          {/* Top Left Status when not connected */}
          <div className="absolute top-8 left-20 md:left-24 z-10 scale-90 md:scale-100 origin-left">
             <StatusIndicator state="idle" />
          </div>
        </>
      )}

      {/* Bottom Left: Voice Controls */}
      <div className="absolute bottom-6 md:bottom-12 left-6 md:left-12 z-20">
        <VoiceControls 
          onConnect={connect}
          onDisconnect={disconnect}
          connectionState={connectionState}
          isMuted={false}
        />
      </div>

      {/* Right Panel: Chat - Full width drawer on mobile / responsive on desktop */}
      <div className="absolute right-2 md:right-4 top-20 md:top-8 bottom-28 md:bottom-8 left-2 md:left-auto md:w-[380px] lg:w-[400px] z-20">
        <ChatPanel className="rounded-xl h-full shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-cyan-900/60" />
      </div>

      {/* Bottom Subtitles Bar */}
      <div className="hidden md:flex absolute bottom-12 left-[calc(50%-200px)] -translate-x-1/2 max-w-lg w-full text-center z-20 justify-center bg-[#020813]/80 backdrop-blur-md p-4 rounded-xl border border-cyan-900/50">
        {!isConnected ? (
          <DecryptText 
            text="R.O.C.K.Y. Standby. Click INITIALIZE to connect." 
            speed={40} 
            className="text-lg font-orbitron text-cyan-400"
          />
        ) : (
          <DecryptText 
            text={`Hello ${user?.username || ''}! I am Rocky. How can I make your day better today?`} 
            speed={25} 
            className="text-sm font-orbitron text-cyan-300"
          />
        )}
      </div>
    </div>
  );
};

export default JarvisInterface;
