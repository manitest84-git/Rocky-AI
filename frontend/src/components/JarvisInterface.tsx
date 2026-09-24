"use client";

import React, { useState, useEffect, useCallback } from 'react';

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
import { HitLConfirmationModal } from './voice/HitLConfirmationModal';
import { AmbientDictationBar } from './voice/AmbientDictationBar';

// Hooks
import { useAudioReactor } from '@/hooks/useAudioReactor';
import { useJarvisState } from '@/hooks/useJarvisState';
import { useLiveKit } from '@/hooks/useLiveKit';
import { useAmbientDictation } from '@/hooks/useAmbientDictation';
import { useWakeWord } from '@/hooks/useWakeWord';
import { getDynamicGreeting } from '@/lib/greeting';
import { HitLActionRecord } from '@/lib/api';

import { LiveKitRoom, RoomAudioRenderer, useVoiceAssistant, useLocalParticipant, useRoomContext } from '@livekit/components-react';
import { setLogLevel, ConnectionState } from 'livekit-client';

if (typeof window !== 'undefined') {
  setLogLevel('warn');
}

const getSafeAudioConfig = () => {
  if (typeof window !== 'undefined' && navigator.mediaDevices?.getSupportedConstraints) {
    const supported = navigator.mediaDevices.getSupportedConstraints();
    return {
      echoCancellation: true,
      noiseSuppression: !!supported.noiseSuppression,
      autoGainControl: !!supported.autoGainControl,
    };
  }
  return {
    echoCancellation: true,
  };
};

const LIVEKIT_AUDIO_CONFIG = getSafeAudioConfig();

import { useAuth } from '@/context/AuthContext';
import { LoginModal } from './auth/LoginModal';
import { AdminPanel } from './admin/AdminPanel';
import { NavigationDrawer } from './nav/NavigationDrawer';
import { TaskManagerDrawer } from './hud/TaskManagerDrawer';
import { CalendarManagerDrawer } from './hud/CalendarManagerDrawer';
import { FinanceShoppingDrawer } from './hud/FinanceShoppingDrawer';
import { VaultBackupDrawer } from './hud/VaultBackupDrawer';
import ProactiveSmartHomeDrawer from './hud/ProactiveSmartHomeDrawer';
import { MemoryMapDrawer } from './hud/MemoryMapDrawer';
import { UserProfileDrawer } from './hud/UserProfileDrawer';
import { User, LogOut, Settings, Maximize2, Minimize2, MessageSquare, Radio, Layers, Sliders } from 'lucide-react';


const JarvisRoom = ({ 
  onAgentStateChange,
  onVoiceTranscript,
  onRoomReady,
  onUiAction,
  onVoiceControl,
}: { 
  onAgentStateChange?: (state: string) => void;
  onVoiceTranscript?: (msg: any) => void;
  onRoomReady?: (room: any) => void;
  onUiAction?: (action: any) => void;
  onVoiceControl?: (ctrl: any) => void;
}) => {

  const { state: agentState, audioTrack } = useVoiceAssistant();
  const { localParticipant } = useLocalParticipant();
  const effectiveState = (agentState && agentState !== 'idle') ? agentState : 'listening';
  const visualState = useJarvisState(effectiveState as any);
  const { frequencyData, volume, connectToTrack, initializeAudioContext } = useAudioReactor();
  const room = useRoomContext();
  const [canPlaybackAudio, setCanPlaybackAudio] = useState<boolean>(true);

  // Autoplay and StartAudio handling across Chrome, Safari, and Brave
  useEffect(() => {
    if (!room) return;

    // Check initial audio playback capability
    setCanPlaybackAudio(room.canPlaybackAudio);

    const updateAudioStatus = () => {
      setCanPlaybackAudio(room.canPlaybackAudio);
    };

    room.on('audioPlaybackChanged', updateAudioStatus);

    // Attempt to start audio immediately in case user gesture is active
    room.startAudio().then(() => {
      setCanPlaybackAudio(true);
    }).catch(() => {
      setCanPlaybackAudio(room.canPlaybackAudio);
    });

    // Register user gesture listeners to immediately unlock audio on click/tap/keypress
    const handleUserGesture = async () => {
      initializeAudioContext();
      if (!room.canPlaybackAudio) {
        try {
          await room.startAudio();
          setCanPlaybackAudio(true);
        } catch (e) {
          console.warn("User gesture startAudio notice:", e);
        }
      }
    };

    window.addEventListener('click', handleUserGesture, { passive: true });
    window.addEventListener('touchstart', handleUserGesture, { passive: true });
    window.addEventListener('keydown', handleUserGesture, { passive: true });

    return () => {
      room.off('audioPlaybackChanged', updateAudioStatus);
      window.removeEventListener('click', handleUserGesture);
      window.removeEventListener('touchstart', handleUserGesture);
      window.removeEventListener('keydown', handleUserGesture);
    };
  }, [room, initializeAudioContext]);

  useEffect(() => {
    if (audioTrack) {
      connectToTrack(audioTrack);
    }
  }, [audioTrack, connectToTrack]);


  useEffect(() => {
    if (onAgentStateChange) {
      onAgentStateChange(effectiveState);
    }
  }, [effectiveState, onAgentStateChange]);

  useEffect(() => {
    if (!room) return;

    const checkAndNotify = () => {
      if (room.state === ConnectionState.Connected) {
        onRoomReady?.(room);
      } else {
        onRoomReady?.(null);
      }
    };

    checkAndNotify();
    room.on('connected', checkAndNotify);
    room.on('disconnected', checkAndNotify);
    room.on('reconnected', checkAndNotify);

    return () => {
      room.off('connected', checkAndNotify);
      room.off('disconnected', checkAndNotify);
      room.off('reconnected', checkAndNotify);
      onRoomReady?.(null);
    };
  }, [room, onRoomReady]);

  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array, participant?: any, kind?: any, topic?: string) => {
      if (topic === 'transcript') {
        try {
          const str = new TextDecoder().decode(payload);
          const data = JSON.parse(str);
          if (data.type === 'transcript' && data.text) {
            onVoiceTranscript?.({
              id: `voice-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              role: data.role as 'user' | 'assistant',
              content: data.text,
              timestamp: new Date(),
              isVoice: true,
            });
          }
        } catch (e) {
          console.warn("Voice transcript parse notice:", e);
        }
      } else if (topic === 'ui_action') {
        try {
          const str = new TextDecoder().decode(payload);
          const data = JSON.parse(str);
          onUiAction?.(data);
        } catch (e) {
          console.warn("UI action parse notice:", e);
        }
      } else if (topic === 'voice_control') {
        try {
          const str = new TextDecoder().decode(payload);
          const data = JSON.parse(str);
          onVoiceControl?.(data);
        } catch (e) {
          console.warn("Voice control parse notice:", e);
        }
      }
    };

    room.on('dataReceived', handleDataReceived);
    return () => {
      room.off('dataReceived', handleDataReceived);
    };
  }, [room, onVoiceTranscript, onUiAction, onVoiceControl]);


  return (
    <>
      <RoomAudioRenderer />
      
      {/* Audio Playback Autoplay Unlock Banner for Safari & Chrome */}
      {!canPlaybackAudio && (
        <div className="absolute top-16 sm:top-20 left-1/2 -translate-x-1/2 z-40 animate-bounce">
          <button
            onClick={async () => {
              if (room) {
                initializeAudioContext();
                await room.startAudio();
                setCanPlaybackAudio(true);
              }
            }}
            className="px-4 py-2 rounded-lg bg-amber-500/20 border-2 border-amber-400 text-amber-300 font-orbitron text-xs sm:text-sm tracking-wider uppercase backdrop-blur-md shadow-[0_0_20px_rgba(251,191,36,0.6)] flex items-center gap-2 hover:bg-amber-500/30 transition-all cursor-pointer"
          >
            <Radio size={16} className="animate-pulse text-amber-400" />
            <span>Browser Blocked Sound &mdash; Tap to Unmute Rocky</span>
          </button>
        </div>
      )}
      
      {/* Top Left: Status */}
      <div className="absolute top-4 sm:top-8 left-16 sm:left-24 z-10 scale-90 sm:scale-100 origin-left">
        <StatusIndicator state={effectiveState as any} />
      </div>

      {/* Center: Visuals */}
      <div className="absolute top-[45%] md:top-1/2 left-1/2 md:left-[calc(50%-200px)] -translate-x-1/2 -translate-y-1/2 z-0 flex items-center justify-center scale-80 sm:scale-95 md:scale-100 transition-transform">
        <ArcReactor volume={volume} state={effectiveState as any} />
        <div className="absolute">
          <HudRings state={effectiveState as any} />
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'hud' | 'comms'>('hud');
  const [agentVoiceState, setAgentVoiceState] = useState<string>('idle');
  const [isManualDisconnect, setIsManualDisconnect] = useState(false);
  const [incomingVoiceMessage, setIncomingVoiceMessage] = useState<any>(null);
  const [activeRoom, setActiveRoom] = useState<any>(null);
  const [currentSubtitle, setCurrentSubtitle] = useState<string>('');
  const [financeInitialTab, setFinanceInitialTab] = useState<'expenses' | 'subscriptions' | 'shopping'>('expenses');
  const [panelRefreshCounter, setPanelRefreshCounter] = useState<number>(0);

  // HitL Safeguard Staging & Modal State
  const [stagedHitLAction, setStagedHitLAction] = useState<HitLActionRecord | null>(null);
  const [isHitLModalOpen, setIsHitLModalOpen] = useState<boolean>(false);

  // Local Hotword Wake-up Mode State (Standby)
  const [isWakeWordActive, setIsWakeWordActive] = useState<boolean>(false);

  // Voice Mode & PTT Controls: Default to 'ptt' on startup after initialization
  const [conversationMode, setConversationMode] = useState<'continuous' | 'ptt'>('ptt');
  const [hotwordGuard, setHotwordGuard] = useState<boolean>(true);
  const [isPttActive, setIsPttActive] = useState<boolean>(false);
  const [inactivityTimeout, setInactivityTimeout] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('rocky_inactivity_timeout');
      if (saved !== null) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed)) return parsed;
      }
    }
    return 45;
  });
  const [inactivityRemaining, setInactivityRemaining] = useState<number>(45);

  // System Memory Map & Operator Profile Drawer States
  const [isMemoryMapOpen, setIsMemoryMapOpen] = useState<boolean>(false);
  const [isUserProfileOpen, setIsUserProfileOpen] = useState<boolean>(false);

  // Full-Duplex Interruption & Barge-in handler
  const handleVoiceControl = useCallback((ctrl: any) => {
    if (ctrl?.type === 'barge_in' || ctrl?.type === 'interrupted') {
      console.log("⚡ [BARGE-IN RECEIVED] Halting assistant audio and switching to listening.");
      setAgentVoiceState('listening');
      setCurrentSubtitle('User: [Speaking / Interrupted]');
      setInactivityRemaining(inactivityTimeout);
    } else if (ctrl?.type === 'agent_state' && ctrl?.state) {
      setAgentVoiceState(ctrl.state);
      if (ctrl.state === 'speaking') {
        setInactivityRemaining(inactivityTimeout);
      }
    }
  }, [inactivityTimeout]);

  const handleUiAction = useCallback((actionData: any) => {
    console.log("Received UI action event:", actionData);
    const panel = actionData?.panel;
    const action = actionData?.action || actionData?.type;
    setPanelRefreshCounter(c => c + 1);

    // HitL Safeguard Interceptor
    if (action === 'hitl_required' || actionData?.type === 'hitl_required') {
      const hitlRecord = actionData?.hitl || actionData?.details;
      if (hitlRecord) {
        setStagedHitLAction(hitlRecord);
        setIsHitLModalOpen(true);
      }
    } else if (action === 'hitl_decision' || actionData?.type === 'hitl_decision') {
      setIsHitLModalOpen(false);
      setStagedHitLAction(null);
    }

    if (panel === 'shopping') {
      setFinanceInitialTab('shopping');
      setIsFinanceOpen(true);
    } else if (panel === 'calendar' || panel === 'reminders') {
      setIsCalendarOpen(true);
    } else if (panel === 'tasks') {
      setIsTaskManagerOpen(true);
    } else if (panel === 'smarthome') {
      setIsSmartHomeOpen(true);
    }
  }, []);


  const handleVoiceTranscript = useCallback((msg: any) => {
    setIncomingVoiceMessage(msg);
    if (msg?.content) {
      const prefix = msg.role === 'user' ? 'User: ' : 'Rocky: ';
      setCurrentSubtitle(`${prefix}${msg.content}`);
    }
    // Reset inactivity countdown on active speech turn
    setInactivityRemaining(inactivityTimeout);
  }, [inactivityTimeout]);

  const isRoomConnected = (room: any): boolean => {
    return !!(room && room.state === ConnectionState.Connected && room.localParticipant);
  };

  const handleSendVoiceChat = useCallback(async (text: string) => {
    if (!isRoomConnected(activeRoom)) {
      throw new Error("LiveKit voice room is not connected");
    }
    const payload = new TextEncoder().encode(JSON.stringify({ text }));
    await activeRoom.localParticipant.publishData(payload, { reliable: true, topic: 'comms_chat' });
    setCurrentSubtitle(`User: ${text}`);
  }, [activeRoom]);

  // Push-to-Talk Mic Control: default muted in 'ptt' mode until activated
  useEffect(() => {
    if (isRoomConnected(activeRoom)) {
      const shouldEnable = conversationMode === 'ptt' ? isPttActive : true;
      activeRoom.localParticipant.setMicrophoneEnabled(shouldEnable).catch((err: any) => {
        console.warn("setMicrophoneEnabled notice:", err);
      });
    }
  }, [activeRoom, conversationMode, isPttActive]);

  const handleStartPtt = useCallback(async () => {
    if (!isRoomConnected(activeRoom)) return;
    setIsPttActive(true);
    try {
      await activeRoom.localParticipant.setMicrophoneEnabled(true);
    } catch (e) {
      console.warn("PTT mic enable notice:", e);
    }
  }, [activeRoom]);

  const handleEndPtt = useCallback(async () => {
    if (!isRoomConnected(activeRoom)) return;
    setIsPttActive(false);
    try {
      await activeRoom.localParticipant.setMicrophoneEnabled(false);
    } catch (e) {
      console.warn("PTT mic disable notice:", e);
    }
  }, [activeRoom]);

  const handleToggleMode = useCallback(async (newMode: 'continuous' | 'ptt') => {
    setConversationMode(newMode);
    if (newMode === 'continuous') {
      setInactivityRemaining(inactivityTimeout);
      if (isRoomConnected(activeRoom)) {
        try {
          await activeRoom.localParticipant.setMicrophoneEnabled(true);
          const payload = new TextEncoder().encode(JSON.stringify({
            type: 'voice_config',
            mode: 'continuous',
            hotword_guard: hotwordGuard,
          }));
          await activeRoom.localParticipant.publishData(payload, { reliable: true, topic: 'voice_config' });
        } catch (e) {
          console.warn("Voice config publish notice:", e);
        }
      }
      setCurrentSubtitle("Continuous Mode Active. Natural conversation enabled.");
    } else {
      if (isRoomConnected(activeRoom)) {
        try {
          await activeRoom.localParticipant.setMicrophoneEnabled(false);
          const payload = new TextEncoder().encode(JSON.stringify({
            type: 'voice_config',
            mode: 'ptt',
            hotword_guard: hotwordGuard,
          }));
          await activeRoom.localParticipant.publishData(payload, { reliable: true, topic: 'voice_config' });
        } catch (e) {
          console.warn("Voice config publish notice:", e);
        }
      }
      setCurrentSubtitle("Push-to-Talk Mode Active. Hold Spacebar or on-screen button to speak.");
    }
  }, [activeRoom, inactivityTimeout, hotwordGuard]);

  const handleToggleHotwordGuard = useCallback(async () => {
    const nextGuard = !hotwordGuard;
    setHotwordGuard(nextGuard);
    if (isRoomConnected(activeRoom)) {
      try {
        const payload = new TextEncoder().encode(JSON.stringify({
          type: 'voice_config',
          mode: conversationMode,
          hotword_guard: nextGuard,
        }));
        await activeRoom.localParticipant.publishData(payload, { reliable: true, topic: 'voice_config' });
      } catch (e) {
        console.warn("Hotword guard publish notice:", e);
      }
    }
  }, [activeRoom, conversationMode, hotwordGuard]);

  const handleStopRocky = useCallback(async () => {
    console.log("🛑 Stop command triggered (Escape or Stop button)");
    // 1. Immediately cut all browser audio elements for 0ms latency silence
    if (typeof document !== 'undefined') {
      document.querySelectorAll('audio').forEach((el) => {
        try {
          el.pause();
          el.currentTime = 0;
        } catch (e) {}
      });
    }

    // 2. Broadcast stop signal over data channel to agent
    if (isRoomConnected(activeRoom)) {
      try {
        const payload = new TextEncoder().encode(JSON.stringify({
          type: 'stop',
          action: 'interrupt',
          timestamp: Date.now(),
        }));
        await activeRoom.localParticipant.publishData(payload, { reliable: true, topic: 'voice_control' });
      } catch (e) {
        console.warn("Failed to publish stop command:", e);
      }
    }

    setAgentVoiceState('listening');
    setCurrentSubtitle("Speech halted by operator.");
  }, [activeRoom]);

  const handleSaveInactivityTimeout = (seconds: number) => {
    setInactivityTimeout(seconds);
    setInactivityRemaining(seconds);
    if (typeof window !== 'undefined') {
      localStorage.setItem('rocky_inactivity_timeout', seconds.toString());
    }
  };

  // Inactivity auto-fallback to PTT mode in Continuous Mode
  useEffect(() => {
    if (!isRoomConnected(activeRoom) || conversationMode !== 'continuous' || inactivityTimeout <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setInactivityRemaining((prev) => {
        if (prev <= 1) {
          console.log("⏱️ Inactivity limit reached. Switching to PTT Mode.");
          handleToggleMode('ptt');
          setCurrentSubtitle("Inactivity timeout reached: Reverted to Push-to-Talk mode.");
          return inactivityTimeout;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeRoom, conversationMode, inactivityTimeout, handleToggleMode]);

  // Synchronize initial voice_config on connect
  useEffect(() => {
    if (isRoomConnected(activeRoom)) {
      const payload = new TextEncoder().encode(JSON.stringify({
        type: 'voice_config',
        mode: conversationMode,
        hotword_guard: hotwordGuard,
      }));
      activeRoom.localParticipant.publishData(payload, { reliable: true, topic: 'voice_config' }).catch((err: any) => {
        console.warn("Initial voice_config publish notice:", err);
      });
    }
  }, [activeRoom, conversationMode, hotwordGuard]);

  // Global Keyboard shortcuts: Spacebar for PTT, Escape for Stop
  useEffect(() => {
    const isInputActive = () => {
      if (typeof document === 'undefined') return false;
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName.toUpperCase();
      return tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement).isContentEditable;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && conversationMode === 'ptt' && !isInputActive()) {
        e.preventDefault();
        handleStartPtt();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        handleStopRocky();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && conversationMode === 'ptt' && !isInputActive()) {
        e.preventDefault();
        handleEndPtt();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [conversationMode, handleStartPtt, handleEndPtt, handleStopRocky]);

  const { user, logout, isAuthenticated, isAdmin } = useAuth();
  const { connect, disconnect, connectionState, setConnectionState, token, serverUrl } = useLiveKit();
  const isConnected = connectionState === ConnectionState.Connected;
  const isConnecting = connectionState === ConnectionState.Connecting;

  // Stable callbacks for LiveKitRoom lifecycle to prevent reconnect churn on re-renders
  const handleRoomConnected = useCallback(() => {
    setConnectionState(ConnectionState.Connected);
  }, [setConnectionState]);

  const handleRoomDisconnected = useCallback(() => {
    disconnect();
    setActiveRoom(null);
    setAgentVoiceState('idle');
  }, [disconnect]);

  const handleRoomError = useCallback((err: any) => {
    console.warn("LiveKit Room connection notice:", err);
    const msg = (err?.message || err?.toString() || '').toLowerCase();
    // Only disconnect on fatal network/authorization errors, not transient media warnings
    const isFatal = msg.includes('token') || msg.includes('authorization') || msg.includes('could not establish signal connection');
    if (isFatal) {
      disconnect();
      setActiveRoom(null);
      setAgentVoiceState('idle');
    }
  }, [disconnect]);

  // Ambient Dictation (Push-to-Talk)
  const {
    isRecording: isDictating,
    isTranscribing: isDictationTranscribing,
    copiedToClipboard,
    lastTranscript: dictationTranscript,
    startDictation,
    stopDictation,
  } = useAmbientDictation({
    enabled: true,
    onDictatedText: (text) => {
      setCurrentSubtitle(`Dictation: "${text}"`);
    },
  });

  // Local Browser Hotword Wake-up Listener (active only in standby when disconnected)
  useWakeWord({
    enabled: isWakeWordActive && !isConnected && !isConnecting,
    onWake: (phrase) => {
      setCurrentSubtitle(`[HOTWORD WAKE-UP: "${phrase.toUpperCase()}"] Connected.`);
      if (!isConnected && !isConnecting) {
        connect(undefined, user?.username);
      }
    },
  });


  useEffect(() => {
    const updateClock = () => setTime(new Date().toLocaleTimeString());
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);



  // Sync fullscreen state with browser events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn("Fullscreen request error:", err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((err) => {
          console.warn("Exit fullscreen error:", err);
        });
      }
    }
  }, []);


  return (
    <div className="relative w-full h-[100dvh] min-h-[100dvh] max-h-[100dvh] bg-[#020813] text-cyan-300 overflow-hidden font-mono selection:bg-cyan-900/50">
      {/* Top-Left Navigation Menu Drawer */}
      <NavigationDrawer 
        onOpenAdminPanel={() => setIsAdminPanelOpen(true)} 
        onOpenTaskManager={() => setIsTaskManagerOpen(true)}
        onOpenCalendar={() => setIsCalendarOpen(true)}
        onOpenFinance={() => setIsFinanceOpen(true)}
        onOpenVault={() => setIsVaultOpen(true)}
        onOpenSmartHome={() => setIsSmartHomeOpen(true)}
        onOpenMemoryMap={() => setIsMemoryMapOpen(true)}
        onOpenUserProfile={() => setIsUserProfileOpen(true)}
      />

      {/* Drawers */}
      <TaskManagerDrawer 
        isOpen={isTaskManagerOpen} 
        onClose={() => setIsTaskManagerOpen(false)} 
        refreshTrigger={panelRefreshCounter}
      />
      <CalendarManagerDrawer 
        isOpen={isCalendarOpen} 
        onClose={() => setIsCalendarOpen(false)} 
        refreshTrigger={panelRefreshCounter}
      />
      <FinanceShoppingDrawer 
        isOpen={isFinanceOpen} 
        onClose={() => setIsFinanceOpen(false)} 
        initialTab={financeInitialTab}
        refreshTrigger={panelRefreshCounter}
      />
      <VaultBackupDrawer isOpen={isVaultOpen} onClose={() => setIsVaultOpen(false)} />
      <ProactiveSmartHomeDrawer isOpen={isSmartHomeOpen} onClose={() => setIsSmartHomeOpen(false)} />
      <MemoryMapDrawer
        isOpen={isMemoryMapOpen}
        onClose={() => setIsMemoryMapOpen(false)}
        activeRoom={activeRoom}
        connectionState={connectionState}
        agentVoiceState={agentVoiceState}
        currentUser={user?.username || 'admin'}
      />
      <UserProfileDrawer
        isOpen={isUserProfileOpen}
        onClose={() => setIsUserProfileOpen(false)}
        inactivityTimeout={inactivityTimeout}
        onSaveTimeout={handleSaveInactivityTimeout}
      />

      {/* Login Modal prompt if not authenticated */}
      <LoginModal isOpen={!isAuthenticated} />

      {/* Admin Management Panel */}
      <AdminPanel isOpen={isAdminPanelOpen} onClose={() => setIsAdminPanelOpen(false)} />

      {/* Background Perspective Grid */}
      <div className="absolute inset-0 z-0 opacity-30 pointer-events-none">
        <PerspectiveGrid />
      </div>

      {/* Top Controls Bar: Mobile Tab Switcher & Fullscreen Button */}
      <div className="absolute top-3 right-3 sm:top-6 sm:right-6 z-30 flex items-center gap-2 sm:gap-3">
        {/* Mobile View Toggle Switch (Visible on small screens < md) */}
        <div className="flex md:hidden bg-[#020813]/80 border border-cyan-500/40 rounded-lg p-0.5 backdrop-blur-md shadow-[0_0_15px_rgba(0,240,255,0.15)]">
          <button
            onClick={() => setMobileTab('hud')}
            className={`px-3 py-1 rounded text-[11px] font-orbitron uppercase tracking-wider flex items-center gap-1.5 transition-all ${
              mobileTab === 'hud'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/60 shadow-[0_0_8px_rgba(0,240,255,0.4)]'
                : 'text-cyan-600 hover:text-cyan-400'
            }`}
          >
            <Radio size={12} />
            HUD
          </button>
          <button
            onClick={() => setMobileTab('comms')}
            className={`px-3 py-1 rounded text-[11px] font-orbitron uppercase tracking-wider flex items-center gap-1.5 transition-all ${
              mobileTab === 'comms'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/60 shadow-[0_0_8px_rgba(0,240,255,0.4)]'
                : 'text-cyan-600 hover:text-cyan-400'
            }`}
          >
            <MessageSquare size={12} />
            Comms
          </button>
        </div>

        {/* System Memory Map Button */}
        <button
          onClick={() => setIsMemoryMapOpen(true)}
          className="p-2 sm:px-3 sm:py-1.5 rounded-lg bg-[#020813]/80 hover:bg-cyan-950/60 border border-cyan-500/40 text-cyan-400 hover:text-cyan-200 transition-all font-orbitron text-xs flex items-center gap-1.5 backdrop-blur-md shadow-[0_0_12px_rgba(0,240,255,0.2)] cursor-pointer"
          title="System Memory Map & Ecosystem Topology"
        >
          <Layers size={14} className="text-cyan-400 animate-pulse" />
          <span className="hidden sm:inline text-[10px] tracking-widest uppercase">
            Memory Map
          </span>
        </button>

        {/* Fullscreen HUD Button for Mobile & Laptop */}
        <button
          onClick={toggleFullscreen}
          className="p-2 sm:px-3 sm:py-1.5 rounded-lg bg-[#020813]/80 hover:bg-cyan-950/60 border border-cyan-500/40 text-cyan-400 hover:text-cyan-200 transition-all font-orbitron text-xs flex items-center gap-1.5 backdrop-blur-md shadow-[0_0_12px_rgba(0,240,255,0.2)]"
          title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          aria-label={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          <span className="hidden sm:inline text-[10px] tracking-widest uppercase">
            {isFullscreen ? "Window" : "Full Screen"}
          </span>
        </button>
      </div>

      {/* System Info & User Badge: Visible on large desktop / laptop screens */}
      <div className="hidden xl:block absolute top-6 right-[424px] z-10 w-60 space-y-3">
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
              <span className={isConnected ? 'text-cyan-300 font-bold' : isConnecting ? 'text-amber-400 font-bold animate-pulse' : 'text-cyan-700'}>
                {isConnecting ? 'CONNECTING...' : isConnected ? (agentVoiceState && agentVoiceState !== 'idle' ? agentVoiceState.toUpperCase() : 'ONLINE') : 'STANDBY'}
              </span>
            </div>
            <div className="pt-2 border-t border-cyan-900/40">
              <button
                onClick={() => setIsMemoryMapOpen(true)}
                className="w-full py-1.5 rounded bg-cyan-950/60 border border-cyan-500/50 hover:bg-cyan-900/60 text-[10px] uppercase font-orbitron text-cyan-300 flex items-center justify-center gap-1.5 transition-all shadow-[0_0_10px_rgba(0,240,255,0.2)] cursor-pointer"
              >
                <Layers size={11} className="text-cyan-400 animate-pulse" /> View Memory Map
              </button>
            </div>
          </div>
        </HologramCard>
      </div>

      {/* Main HUD Visuals (Center Arc Reactor & HUD Rings) */}
      <div className={`transition-opacity duration-300 ${mobileTab === 'comms' ? 'hidden md:block opacity-30 md:opacity-100 pointer-events-none md:pointer-events-auto' : 'block opacity-100'}`}>
        {token ? (
          <LiveKitRoom 
            serverUrl={serverUrl} 
            token={token} 
            connect={true} 
            audio={LIVEKIT_AUDIO_CONFIG}
            onConnected={handleRoomConnected}
            onDisconnected={handleRoomDisconnected}
            onError={handleRoomError}
          >
            <JarvisRoom 
              onAgentStateChange={setAgentVoiceState} 
              onVoiceTranscript={handleVoiceTranscript}
              onRoomReady={setActiveRoom}
              onUiAction={handleUiAction}
              onVoiceControl={handleVoiceControl}
            />
          </LiveKitRoom>
        ) : (

          <>
            {/* Idle state center visuals */}
            <div className="absolute top-[45%] md:top-1/2 left-1/2 md:left-[calc(50%-200px)] -translate-x-1/2 -translate-y-1/2 z-0 flex items-center justify-center scale-75 sm:scale-90 md:scale-100 transition-transform">
              <ArcReactor volume={0} state="idle" />
              <div className="absolute">
                <HudRings state="idle" />
              </div>
            </div>
            {/* Top Left Status when not connected */}
            <div className="absolute top-4 sm:top-8 left-16 sm:left-24 z-10 scale-90 sm:scale-100 origin-left">
              <StatusIndicator state="idle" />
            </div>
          </>
        )}
      </div>

      {/* Subtitles & Dynamic Greeting Bar */}
      <div className={`transition-opacity duration-300 ${mobileTab === 'comms' ? 'hidden md:flex' : 'flex'} absolute bottom-24 md:bottom-10 left-1/2 md:left-[calc(50%-200px)] -translate-x-1/2 max-w-[92vw] sm:max-w-md md:max-w-lg w-full text-center z-20 justify-center bg-[#020813]/85 backdrop-blur-md p-3 sm:p-4 rounded-xl border border-cyan-900/60 shadow-[0_4px_20px_rgba(0,0,0,0.6)]`}>
        {isConnecting ? (
          <DecryptText 
            text="Establishing secure neural uplink (Continuous Mode)..." 
            speed={25} 
            className="text-xs sm:text-sm font-orbitron text-cyan-400"
          />
        ) : !isConnected ? (
          <DecryptText 
            text={currentSubtitle || "R.O.C.K.Y. Standby. Click INITIALIZE to start continuous conversation."} 
            speed={30} 
            className="text-xs sm:text-sm font-orbitron text-cyan-400"
          />
        ) : (
          <DecryptText 
            text={currentSubtitle || getDynamicGreeting(user?.username)} 
            speed={25} 
            className="text-xs sm:text-sm font-orbitron text-cyan-300"
          />
        )}
      </div>

      {/* Voice Controls: Accessible on both mobile and laptop */}
      <div className={`transition-all duration-300 ${mobileTab === 'comms' ? 'hidden md:block' : 'block'} absolute bottom-4 left-1/2 -translate-x-1/2 md:bottom-10 md:left-10 md:translate-x-0 z-20`}>
        <VoiceControls 
          onConnect={async () => {
            setIsManualDisconnect(false);
            // Pre-request microphone access inside direct user gesture context to satisfy Safari & Chrome security policy
            try {
              if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
                const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                tempStream.getTracks().forEach((track) => track.stop());
              }
            } catch (micErr) {
              console.warn("User microphone prompt notice:", micErr);
            }
            connect(undefined, user?.username);
          }}
          onDisconnect={() => {
            setIsManualDisconnect(true);
            disconnect();
            setActiveRoom(null);
            setAgentVoiceState('idle');
          }}
          connectionState={connectionState}
          isMuted={false}
          conversationMode={conversationMode}
          onToggleMode={handleToggleMode}
          hotwordGuard={hotwordGuard}
          onToggleHotwordGuard={handleToggleHotwordGuard}
          isPttActive={isPttActive}
          onStartPtt={handleStartPtt}
          onEndPtt={handleEndPtt}
          inactivityRemaining={inactivityRemaining}
          inactivityTimeout={inactivityTimeout}
          isSpeaking={agentVoiceState === 'speaking'}
          onStopRocky={handleStopRocky}
          onOpenProfileSettings={() => setIsUserProfileOpen(true)}
        />
      </div>

      {/* Ambient Dictation Floating HUD Bar */}
      <AmbientDictationBar 
        isRecording={isDictating}
        isTranscribing={isDictationTranscribing}
        copiedToClipboard={copiedToClipboard}
        lastTranscript={dictationTranscript}
        onStartHold={startDictation}
        onEndHold={stopDictation}
      />

      {/* HitL Safeguard Destructive Action Confirmation Modal */}
      <HitLConfirmationModal 
        action={stagedHitLAction}
        isOpen={isHitLModalOpen}
        onClose={() => {
          setIsHitLModalOpen(false);
          setStagedHitLAction(null);
        }}
        onDecisionMade={(actionId, decision) => {
          console.log(`HitL decision for ${actionId}: ${decision}`);
        }}
      />


      {/* Chat Panel: Fullscreen drawer on mobile when comms tab active, side panel on desktop */}
      <div className={`transition-all duration-300 ${
        mobileTab === 'comms'
          ? 'block absolute inset-x-2 top-14 bottom-4 z-20 md:inset-auto md:right-4 md:top-6 md:bottom-6 md:w-[380px] lg:w-[400px]'
          : 'hidden md:block absolute right-4 top-6 bottom-6 md:w-[380px] lg:w-[400px] z-20'
      }`}>
        <ChatPanel 
          className="h-full shadow-[0_0_30px_rgba(0,0,0,0.7)]" 
          incomingVoiceMessage={incomingVoiceMessage}
          isVoiceOnline={isConnected && !!activeRoom}
          onSendVoiceChat={handleSendVoiceChat}
          onSubtitleUpdate={(text) => setCurrentSubtitle(text)}
          onUiAction={handleUiAction}
        />
      </div>
    </div>
  );
};

export default JarvisInterface;
