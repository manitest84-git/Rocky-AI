'use client';

import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  Zap, 
  Bell, 
  Sun, 
  Moon, 
  Shield, 
  Lightbulb, 
  Thermometer, 
  Lock, 
  Wind, 
  Camera, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  Play, 
  X 
} from 'lucide-react';
import { 
  getProactiveAlerts, 
  getSmartHomeDevices, 
  updateSmartHomeDevice, 
  getAutomationRoutines, 
  triggerAutomationRoutine, 
  ProactiveAlert, 
  SmartDevice, 
  AutomationRoutine 
} from '@/lib/api';

interface ProactiveSmartHomeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProactiveSmartHomeDrawer({ isOpen, onClose }: ProactiveSmartHomeDrawerProps) {
  const [activeTab, setActiveTab] = useState<'proactive' | 'smarthome'>('proactive');
  const [alerts, setAlerts] = useState<ProactiveAlert[]>([]);
  const [devices, setDevices] = useState<SmartDevice[]>([]);
  const [routines, setRoutines] = useState<AutomationRoutine[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Track setTimeout IDs for cleanup on unmount
  const actionTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timers on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [alertList, deviceList, routineList] = await Promise.all([
        getProactiveAlerts().catch(() => []),
        getSmartHomeDevices().catch(() => []),
        getAutomationRoutines().catch(() => [])
      ]);
      setAlerts(Array.isArray(alertList) ? alertList : []);
      setDevices(Array.isArray(deviceList) ? deviceList : []);
      setRoutines(Array.isArray(routineList) ? routineList : []);
    } catch (err) {
      console.error("Failed to load Proactive / Smart Home data:", err);
      setError(err instanceof Error ? err.message : 'Failed to load data. Please try again.');
      errorTimerRef.current = setTimeout(() => setError(null), 5000);
      setAlerts([]);
      setDevices([]);
      setRoutines([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const handleToggleDevice = async (device: SmartDevice) => {
    try {
      const updated = await updateSmartHomeDevice(device.id, !device.is_on);
      setDevices(prev => prev.map(d => d.id === device.id ? updated : d));
    } catch (err) {
      console.error("Failed to toggle device:", err);
      setError(err instanceof Error ? err.message : 'Failed to toggle device state.');
      errorTimerRef.current = setTimeout(() => setError(null), 5000);
    }
  };

  const handleRunRoutine = async (routine: AutomationRoutine) => {
    try {
      setActionMsg(`Executing macro: '${routine.routine_name}'...`);
      const res = await triggerAutomationRoutine(routine.id);
      setActionMsg(`Macro executed! ${res.actions_executed} devices updated.`);
      await loadData();
      actionTimerRef.current = setTimeout(() => setActionMsg(null), 4000);
    } catch (err) {
      console.error("Failed to execute routine:", err);
      setError(err instanceof Error ? err.message : 'Failed to execute routine.');
      errorTimerRef.current = setTimeout(() => setError(null), 5000);
      setActionMsg(null);
    }
  };

  if (!isOpen) return null;

  const renderDeviceIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'light': return <Lightbulb className="w-5 h-5 text-cyan-400" />;
      case 'thermostat': return <Thermometer className="w-5 h-5 text-amber-400" />;
      case 'lock': return <Lock className="w-5 h-5 text-emerald-400" />;
      case 'purifier': return <Wind className="w-5 h-5 text-purple-400" />;
      case 'camera': return <Camera className="w-5 h-5 text-rose-400" />;
      default: return <Zap className="w-5 h-5 text-cyan-400" />;
    }
  };

  const renderRoutineIcon = (iconName: string) => {
    switch (iconName.toLowerCase()) {
      case 'sun': return <Sun className="w-5 h-5 text-amber-400" />;
      case 'moon': return <Moon className="w-5 h-5 text-indigo-400" />;
      case 'cpu': return <Cpu className="w-5 h-5 text-cyan-400" />;
      case 'shield': return <Shield className="w-5 h-5 text-rose-400" />;
      default: return <Zap className="w-5 h-5 text-emerald-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-2xl h-full bg-slate-950 border-l border-cyan-500/30 text-cyan-100 flex flex-col shadow-2xl shadow-cyan-950/50">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-cyan-500/20 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Cpu className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-orbitron tracking-wider text-cyan-300">
                PROACTIVE & SMART HOME HUD
              </h2>
              <p className="text-xs text-cyan-400/60 font-mono">
                System Audit Engine & IoT Macro Automation
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg text-cyan-400 hover:bg-cyan-500/10 transition-colors"
            aria-label="Close smart home drawer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Error Toast Banner */}
        {error && (
          <div className="px-5 py-2.5 bg-red-500/10 border-b border-red-500/30 text-red-300 text-xs font-mono flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Status Toast */}
        {actionMsg && (
          <div className="px-5 py-2.5 bg-cyan-500/10 border-b border-cyan-500/30 text-cyan-300 text-xs font-mono flex items-center gap-2">
            <Info className="w-4 h-4 text-cyan-400" />
            <span>{actionMsg}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-cyan-500/20 bg-slate-900/30">
          <button
            onClick={() => setActiveTab('proactive')}
            className={`flex-1 py-3 px-4 font-mono text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${
              activeTab === 'proactive'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-500/10'
                : 'border-transparent text-cyan-400/60 hover:text-cyan-300 hover:bg-cyan-500/05'
            }`}
          >
            <Bell className="w-4 h-4" />
            PROACTIVE ALERTS ({alerts.length})
          </button>
          <button
            onClick={() => setActiveTab('smarthome')}
            className={`flex-1 py-3 px-4 font-mono text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${
              activeTab === 'smarthome'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-500/10'
                : 'border-transparent text-cyan-400/60 hover:text-cyan-300 hover:bg-cyan-500/05'
            }`}
          >
            <Zap className="w-4 h-4" />
            SMART HOME & IOT ({devices.length})
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">

          {loading ? (
            <div className="flex items-center justify-center py-16 text-cyan-400/60 font-mono gap-3">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Auditing Proactive Systems...</span>
            </div>
          ) : activeTab === 'proactive' ? (
            /* TAB 1: PROACTIVE ALERTS FEED */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-cyan-400/70 uppercase tracking-wider">
                  Real-time System Audit Stream
                </span>
                <button
                  onClick={loadData}
                  className="text-xs font-mono text-cyan-400 hover:text-cyan-200 flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> REFRESH
                </button>
              </div>

              {alerts.length === 0 ? (
                <div className="py-12 border border-dashed border-cyan-500/20 rounded-xl text-center text-cyan-400/50 font-mono text-sm">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400/60" />
                  All Systems Optimal. No Proactive Warnings.
                </div>
              ) : (
                alerts.map((al) => (
                  <div 
                    key={al.id} 
                    className={`p-4 rounded-xl border font-mono transition-all ${
                      al.level === 'warning'
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-100'
                        : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <div className="flex items-center gap-2">
                        {al.level === 'warning' ? (
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        ) : (
                          <Info className="w-4 h-4 text-cyan-400 shrink-0" />
                        )}
                        <h4 className="font-bold text-sm text-cyan-200">
                          {typeof al.title === 'string' ? al.title : String(al.title || '')}
                        </h4>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-cyan-500/30 text-cyan-400 uppercase">
                        {typeof al.category === 'string' ? al.category : String(al.category || '')}
                      </span>
                    </div>
                    <p className="text-xs text-cyan-100/80 pl-6 leading-relaxed">
                      {typeof al.message === 'string' ? al.message : (typeof al.message === 'object' ? JSON.stringify(al.message) : String(al.message || ''))}
                    </p>
                  </div>
                ))
              )}
            </div>
          ) : (
            /* TAB 2: SMART HOME & MACRO ROUTINES */
            <div className="space-y-6">
              
              {/* Macro Routines */}
              <div className="space-y-3">
                <h3 className="text-xs font-mono text-cyan-400/70 uppercase tracking-wider">
                  One-Touch Macro Routines
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {routines.map((rt) => (
                    <div 
                      key={rt.id}
                      className="p-4 rounded-xl border border-cyan-500/20 bg-slate-900/60 hover:border-cyan-500/40 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 font-bold text-sm text-cyan-200">
                            {renderRoutineIcon(rt.icon)}
                            <span>{rt.routine_name}</span>
                          </div>
                        </div>
                        <p className="text-xs text-cyan-400/70 font-mono mb-3 line-clamp-2">
                          {rt.description}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRunRoutine(rt)}
                        className="w-full py-1.5 px-3 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-mono font-semibold flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Play className="w-3.5 h-3.5 fill-cyan-300" /> EXECUTE ROUTINE
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Connected IoT Devices */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-mono text-cyan-400/70 uppercase tracking-wider">
                  Connected IoT Devices Grid
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  {devices.map((dev) => (
                    <div 
                      key={dev.id}
                      className={`p-3.5 rounded-xl border font-mono flex items-center justify-between transition-all ${
                        dev.is_on 
                          ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-100' 
                          : 'bg-slate-900/30 border-cyan-500/10 text-cyan-400/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg border ${dev.is_on ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-slate-800 border-slate-700'}`}>
                          {renderDeviceIcon(dev.device_type)}
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-cyan-200">{dev.device_name}</h4>
                          <span className="text-[11px] text-cyan-400/60">{dev.room}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleToggleDevice(dev)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                          dev.is_on
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        {dev.is_on ? 'ACTIVE [ON]' : 'OFF'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
