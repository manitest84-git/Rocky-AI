"use client";

import React, { useState, useEffect } from 'react';
import { CalendarEvent, getCalendarEvents, createCalendarEvent, deleteCalendarEvent, generateMeetingAgenda, getAuthHeader } from '@/lib/api';
import { getApiUrl } from '@/lib/constants';
import { 
  Calendar as CalendarIcon, Clock, MapPin, Users, Plus, Trash2, 
  AlertTriangle, Sparkles, FileText, X, Check, Share2, Download, 
  Upload, ExternalLink, Copy, CheckCheck, Bell 
} from 'lucide-react';

interface CalendarManagerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  refreshTrigger?: number;
}

function getGoogleCalendarUrl(evt: CalendarEvent): string {
  try {
    const formatGCalDate = (dStr: string) => {
      const d = new Date(dStr);
      return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    };
    const start = formatGCalDate(evt.start_time);
    const end = formatGCalDate(evt.end_time || evt.start_time);
    const details = [evt.description, evt.agenda ? `Agenda:\n${evt.agenda}` : ''].filter(Boolean).join('\n\n');
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(evt.title)}&dates=${start}/${end}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(evt.location || '')}`;
  } catch {
    return "https://calendar.google.com/";
  }
}

export const CalendarManagerDrawer: React.FC<CalendarManagerDrawerProps> = ({ isOpen, onClose, refreshTrigger }) => {
  const [activeTab, setActiveTab] = useState<'schedule' | 'new' | 'ai-assistant' | 'sync'>('schedule');
  const [scheduleFilter, setScheduleFilter] = useState<'all' | 'meetings' | 'reminders'>('all');
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [copiedFeed, setCopiedFeed] = useState(false);
  const [importing, setImporting] = useState(false);

  // New Event Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [attendeesInput, setAttendeesInput] = useState('');
  const [agenda, setAgenda] = useState('');
  const [recurrenceRule, setRecurrenceRule] = useState<string>('NONE');
  const [category, setCategory] = useState<string>('Work');

  // AI Assistant Tab state
  const [aiTitle, setAiTitle] = useState('');
  const [aiContext, setAiContext] = useState('');
  const [generatedAgenda, setGeneratedAgenda] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadEvents();
    }
  }, [isOpen, refreshTrigger]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const data = await getCalendarEvents();
      setEvents(data);
    } catch (err) {
      console.error("Failed to fetch calendar events:", err);
      setError(err instanceof Error ? err.message : 'Operation failed.');
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startTime || !endTime) return;

    setNotice(null);
    setConflicts([]);

    try {
      const attendees = attendeesInput.split(',').map(s => s.trim()).filter(Boolean);
      const res = await createCalendarEvent({
        title,
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        description: description || undefined,
        location: location || undefined,
        attendees,
        agenda: agenda || undefined,
        recurrence_rule: recurrenceRule,
        category: category
      });

      setEvents([...events, res.event].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()));
      if (res.conflicts && res.conflicts.length > 0) {
        setConflicts(res.conflicts);
        setNotice(`Event created, but scheduling conflict detected with ${res.conflicts.length} existing event(s)!`);
      } else {
        setNotice("Event scheduled successfully!");
        // Reset form
        setTitle('');
        setDescription('');
        setLocation('');
        setStartTime('');
        setEndTime('');
        setAttendeesInput('');
        setRecurrenceRule('NONE');
        setCategory('Work');
        setAgenda('');
      }
    } catch (err: any) {
      console.error("Failed to create event:", err);
      setNotice(err.message || "Failed to schedule event.");
      setError(err instanceof Error ? err.message : 'Operation failed.');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleDeleteEvent = async (id: number) => {
    if (!window.confirm('Delete this event? This cannot be undone.')) return;
    try {
      await deleteCalendarEvent(id);
      setEvents(events.filter(e => e.id !== id));
    } catch (err) {
      console.error("Failed to delete event:", err);
      setError(err instanceof Error ? err.message : 'Operation failed.');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleGenerateAgenda = async () => {
    if (!aiTitle.trim()) return;
    setGenerating(true);
    try {
      const result = await generateMeetingAgenda(aiTitle, aiContext);
      setGeneratedAgenda(result);
    } catch (err) {
      console.error("Agenda generation error:", err);
      setError(err instanceof Error ? err.message : 'Operation failed.');
      setTimeout(() => setError(null), 5000);
    } finally {
      setGenerating(false);
    }
  };

  const applyAgendaToNewEvent = () => {
    setTitle(aiTitle);
    setDescription(aiContext);
    setAgenda(generatedAgenda);
    setActiveTab('new');
  };

  const getFeedUrl = () => {
    if (typeof window !== 'undefined') {
      const port = window.location.port ? ':8333' : '';
      return `${window.location.protocol}//${window.location.hostname}${port}/api/calendar/feed.ics`;
    }
    return `${getApiUrl()}/calendar/feed.ics`;
  };

  const handleCopyFeed = async () => {
    const url = getFeedUrl();
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback for non-secure HTTP / LAN / mobile contexts
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      setCopiedFeed(true);
      setTimeout(() => setCopiedFeed(false), 3000);
    } catch (err) {
      console.warn("Clipboard copy fallback notice:", err);
      // Still show copied state as feedback
      setCopiedFeed(true);
      setTimeout(() => setCopiedFeed(false), 3000);
    }
  };

  const handleExportIcs = () => {
    const url = `${getApiUrl()}/calendar/feed.ics`;
    window.open(url, '_blank');
  };

  const handleImportIcs = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const res = await fetch(`${getApiUrl()}/calendar/import-ics`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify({ ics_content: text, ics_data: text })
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Failed to import ICS`);
      }
      const data = await res.json();
      setNotice(`Imported ${data.imported_count || 0} event(s) successfully into Rocky Calendar!`);
      loadEvents();
    } catch (err: any) {
      console.error("ICS import error:", err);
      setError(err instanceof Error ? err.message : 'Import failed');
      setTimeout(() => setError(null), 5000);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="relative z-10 w-full max-w-lg h-full bg-[#020c1b]/95 border-l border-cyan-500/40 p-6 flex flex-col justify-between shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-xl animate-in slide-in-from-right duration-200 text-cyan-200">
        
        {/* Header */}
        <div>
          <div className="flex items-center justify-between border-b border-cyan-900/60 pb-4 mb-4">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-cyan-400 animate-pulse" />
              <span className="font-orbitron font-bold text-cyan-100 tracking-wider text-sm">
                CALENDAR & REMINDERS
              </span>
            </div>
            <button onClick={onClose} aria-label="Close" className="p-1 rounded-md text-cyan-400 hover:text-cyan-100 hover:bg-cyan-950/60 transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-1.5 mb-4 bg-cyan-950/40 p-1 rounded-lg border border-cyan-900/60">
            <button
              onClick={() => setActiveTab('schedule')}
              className={`flex-1 py-1.5 text-[10px] font-orbitron font-bold rounded-md transition-all flex items-center justify-center gap-1 ${
                activeTab === 'schedule' ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/50 shadow-[0_0_10px_rgba(6,182,212,0.2)]' : 'text-cyan-500 hover:text-cyan-300'
              }`}
            >
              <CalendarIcon size={12} />
              <span>SCHEDULE ({events.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('new')}
              className={`flex-1 py-1.5 text-[10px] font-orbitron font-bold rounded-md transition-all flex items-center justify-center gap-1 ${
                activeTab === 'new' ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/50 shadow-[0_0_10px_rgba(6,182,212,0.2)]' : 'text-cyan-500 hover:text-cyan-300'
              }`}
            >
              <Plus size={12} />
              <span>BOOK</span>
            </button>
            <button
              onClick={() => setActiveTab('ai-assistant')}
              className={`flex-1 py-1.5 text-[10px] font-orbitron font-bold rounded-md transition-all flex items-center justify-center gap-1 ${
                activeTab === 'ai-assistant' ? 'bg-amber-500/20 text-amber-300 border border-amber-400/50 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'text-amber-500 hover:text-amber-300'
              }`}
            >
              <Sparkles size={12} />
              <span>AI AGENDA</span>
            </button>
            <button
              onClick={() => setActiveTab('sync')}
              className={`flex-1 py-1.5 text-[10px] font-orbitron font-bold rounded-md transition-all flex items-center justify-center gap-1 ${
                activeTab === 'sync' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'text-emerald-500 hover:text-emerald-300'
              }`}
            >
              <Share2 size={12} />
              <span>SYNC / ICAL</span>
            </button>
          </div>

          {/* Global Notice / Conflict Banner */}
          {error && (
            <div className="mx-5 mb-4 px-4 py-2.5 bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-mono rounded-lg flex items-center gap-2">
              <span className="text-red-400">⚠</span>
              <span>{error}</span>
            </div>
          )}
          {notice && (
            <div className={`p-3 rounded-lg border text-xs mb-4 flex items-center gap-2 ${
              conflicts.length > 0 ? 'bg-amber-950/60 border-amber-500/60 text-amber-200' : 'bg-cyan-950/60 border-cyan-500/60 text-cyan-200'
            }`}>
              {conflicts.length > 0 ? <AlertTriangle size={16} className="text-amber-400 shrink-0" /> : <Check size={16} className="text-cyan-400 shrink-0" />}
              <span>{notice}</span>
            </div>
          )}

          {/* Schedule View */}
          {activeTab === 'schedule' && (
            <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1 custom-scrollbar">
              {/* Filter pills */}
              <div className="flex gap-1.5 p-1 bg-[#010814] rounded-lg border border-cyan-900/60 text-[10px] font-orbitron">
                <button
                  type="button"
                  onClick={() => setScheduleFilter('all')}
                  className={`flex-1 py-1 rounded text-center transition-all ${
                    scheduleFilter === 'all'
                      ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/50 font-bold'
                      : 'text-cyan-600 hover:text-cyan-300'
                  }`}
                >
                  ALL ({events.length})
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleFilter('meetings')}
                  className={`flex-1 py-1 rounded text-center transition-all ${
                    scheduleFilter === 'meetings'
                      ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/50 font-bold'
                      : 'text-cyan-600 hover:text-cyan-300'
                  }`}
                >
                  MEETINGS ({events.filter(e => !e.title.toLowerCase().includes('reminder')).length})
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleFilter('reminders')}
                  className={`flex-1 py-1 rounded text-center transition-all flex items-center justify-center gap-1 ${
                    scheduleFilter === 'reminders'
                      ? 'bg-amber-500/20 text-amber-200 border border-amber-400/50 font-bold'
                      : 'text-amber-600 hover:text-amber-400'
                  }`}
                >
                  <Bell size={10} />
                  <span>REMINDERS ({events.filter(e => e.title.toLowerCase().includes('reminder')).length})</span>
                </button>
              </div>

              {events
                .filter(evt => {
                  const isRem = evt.title.toLowerCase().includes('reminder');
                  if (scheduleFilter === 'meetings') return !isRem;
                  if (scheduleFilter === 'reminders') return isRem;
                  return true;
                })
                .length === 0 ? (
                <div className="text-center py-12 text-cyan-600 text-xs font-orbitron">
                  {scheduleFilter === 'reminders' ? 'NO ACTIVE REMINDERS' : 'NO UPCOMING CALENDAR EVENTS'}
                </div>
              ) : (
                events
                  .filter(evt => {
                    const isRem = evt.title.toLowerCase().includes('reminder');
                    if (scheduleFilter === 'meetings') return !isRem;
                    if (scheduleFilter === 'reminders') return isRem;
                    return true;
                  })
                  .map((evt) => (
                  <div key={evt.id} className="p-3.5 rounded-lg bg-cyan-950/40 border border-cyan-800/50 space-y-2 hover:border-cyan-500/50 transition-all">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {evt.title.toLowerCase().includes('reminder') && (
                          <span className="px-1.5 py-0.5 text-[9px] font-orbitron font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                            <Bell size={10} className="text-amber-400" /> REMINDER
                          </span>
                        )}
                        {evt.category && (
                          <span className={`px-1.5 py-0.5 text-[9px] font-orbitron font-semibold rounded border ${
                            evt.category === 'Personal' 
                              ? 'bg-amber-950/60 border-amber-500/40 text-amber-300' 
                              : evt.category === 'Fitness' 
                              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300' 
                              : evt.category === 'Family' 
                              ? 'bg-purple-950/60 border-purple-500/40 text-purple-300' 
                              : 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300'
                          }`}>
                            {evt.category}
                          </span>
                        )}
                        {evt.recurrence_rule && evt.recurrence_rule !== 'NONE' && (
                          <span className="px-1.5 py-0.5 text-[9px] font-orbitron font-bold rounded bg-cyan-900/40 text-cyan-300 border border-cyan-400/30 flex items-center gap-1">
                            🔄 {evt.recurrence_rule}
                          </span>
                        )}
                        <div className="font-bold text-xs text-cyan-100">{evt.title.replace(/^Reminder:\s*/i, '')}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <a 
                          href={getGoogleCalendarUrl(evt)} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          title="Add to Google Calendar" 
                          className="text-cyan-400 hover:text-emerald-400 transition-colors p-1 rounded hover:bg-cyan-900/40"
                        >
                          <ExternalLink size={13} />
                        </a>
                        <button onClick={() => handleDeleteEvent(evt.id)} aria-label="Delete event" className="text-cyan-700 hover:text-red-400 transition-colors p-1">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-cyan-400/80">
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} className="text-cyan-500" />
                        <span>{new Date(evt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(evt.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CalendarIcon size={12} className="text-cyan-500" />
                        <span>{new Date(evt.start_time).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {evt.location && (
                      <div className="flex items-center gap-1.5 text-[11px] text-cyan-300">
                        <MapPin size={12} className="text-cyan-500" />
                        <span>{evt.location}</span>
                      </div>
                    )}

                    {evt.attendees && evt.attendees.length > 0 && (
                      <div className="flex items-center gap-1.5 text-[10px] text-cyan-400">
                        <Users size={12} className="text-cyan-500" />
                        <span>{evt.attendees.join(', ')}</span>
                      </div>
                    )}

                    {evt.agenda && (
                      <div className="p-2 rounded bg-[#03152c] border border-cyan-900/60 text-[11px] text-cyan-300/90 whitespace-pre-wrap">
                        <div className="text-[9px] font-orbitron font-bold text-cyan-500 uppercase mb-1">AGENDA</div>
                        {evt.agenda}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Book Event Tab */}
          {activeTab === 'new' && (
            <form onSubmit={handleCreateEvent} className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
              <div>
                <label htmlFor="cal-event-title" className="text-[10px] font-orbitron text-cyan-400 block mb-1">EVENT TITLE</label>
                <input
                  id="cal-event-title"
                  name="event_title"
                  type="text"
                  autoComplete="off"
                  required
                  placeholder="Strategy Sync / Client Meeting..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#03152c] border border-cyan-800/60 rounded px-3 py-1.5 text-xs text-cyan-100 placeholder-cyan-600 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="cal-start-time" className="text-[10px] font-orbitron text-cyan-400 block mb-1">START TIME</label>
                  <input
                    id="cal-start-time"
                    name="start_time"
                    type="datetime-local"
                    autoComplete="off"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-[#03152c] border border-cyan-800/60 rounded px-2 py-1 text-xs text-cyan-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="cal-end-time" className="text-[10px] font-orbitron text-cyan-400 block mb-1">END TIME</label>
                  <input
                    id="cal-end-time"
                    name="end_time"
                    type="datetime-local"
                    autoComplete="off"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full bg-[#03152c] border border-cyan-800/60 rounded px-2 py-1 text-xs text-cyan-200 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="cal-category" className="text-[10px] font-orbitron text-cyan-400 block mb-1">CATEGORY</label>
                  <select
                    id="cal-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-[#03152c] border border-cyan-800/60 rounded px-2 py-1.5 text-xs text-cyan-200 focus:outline-none"
                  >
                    <option value="Work">💼 Work</option>
                    <option value="Personal">👤 Personal</option>
                    <option value="Fitness">⚡ Fitness</option>
                    <option value="Family">🏡 Family</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="cal-recurrence" className="text-[10px] font-orbitron text-cyan-400 block mb-1">RECURRENCE</label>
                  <select
                    id="cal-recurrence"
                    value={recurrenceRule}
                    onChange={(e) => setRecurrenceRule(e.target.value)}
                    className="w-full bg-[#03152c] border border-cyan-800/60 rounded px-2 py-1.5 text-xs text-cyan-200 focus:outline-none font-orbitron"
                  >
                    <option value="NONE">Single Event</option>
                    <option value="DAILY">🔄 Daily</option>
                    <option value="WEEKLY">🔄 Weekly</option>
                    <option value="MONTHLY">🔄 Monthly</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="cal-location" className="text-[10px] font-orbitron text-cyan-400 block mb-1">LOCATION / WEBLINK</label>
                <input
                  id="cal-location"
                  name="location"
                  type="text"
                  autoComplete="off"
                  placeholder="Conference Room A / Google Meet link..."
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-[#03152c] border border-cyan-800/60 rounded px-3 py-1.5 text-xs text-cyan-100 placeholder-cyan-600 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label htmlFor="cal-attendees" className="text-[10px] font-orbitron text-cyan-400 block mb-1">ATTENDEES (COMMA SEPARATED)</label>
                <input
                  id="cal-attendees"
                  name="attendees"
                  type="text"
                  autoComplete="off"
                  placeholder="alice@company.com, bob@company.com..."
                  value={attendeesInput}
                  onChange={(e) => setAttendeesInput(e.target.value)}
                  className="w-full bg-[#03152c] border border-cyan-800/60 rounded px-3 py-1.5 text-xs text-cyan-100 placeholder-cyan-600 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label htmlFor="cal-agenda" className="text-[10px] font-orbitron text-cyan-400 block mb-1">MEETING AGENDA</label>
                <textarea
                  id="cal-agenda"
                  name="agenda"
                  rows={3}
                  placeholder="Enter agenda points or generate using AI Agenda tab..."
                  value={agenda}
                  onChange={(e) => setAgenda(e.target.value)}
                  className="w-full bg-[#03152c] border border-cyan-800/60 rounded px-3 py-1.5 text-xs text-cyan-100 placeholder-cyan-600 focus:outline-none focus:border-cyan-400 resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-cyan-600/30 hover:bg-cyan-500/40 border border-cyan-400/60 text-cyan-100 rounded text-xs font-orbitron font-bold flex items-center justify-center gap-1.5 transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)]"
              >
                <Plus size={16} /> SCHEDULE MEETING
              </button>
            </form>
          )}

          {/* AI Agenda Assistant Tab */}
          {activeTab === 'ai-assistant' && (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
              <div>
                <label htmlFor="cal-aititle" className="text-[10px] font-orbitron text-amber-400 block mb-1">MEETING TOPIC / TITLE</label>
                <input
                  id="cal-aititle"
                  name="ai_title"
                  type="text"
                  autoComplete="off"
                  placeholder="Q3 Product Roadmap Review..."
                  value={aiTitle}
                  onChange={(e) => setAiTitle(e.target.value)}
                  className="w-full bg-[#03152c] border border-amber-800/60 rounded px-3 py-1.5 text-xs text-amber-100 placeholder-amber-700 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-[10px] font-orbitron text-amber-400 block mb-1">MEETING CONTEXT (OPTIONAL)</label>
                <textarea
                  rows={2}
                  placeholder="Review sprint velocities, feature prioritizations, and launch blockers..."
                  value={aiContext}
                  onChange={(e) => setAiContext(e.target.value)}
                  className="w-full bg-[#03152c] border border-amber-800/60 rounded px-3 py-1.5 text-xs text-amber-100 placeholder-amber-700 focus:outline-none focus:border-amber-400 resize-none"
                />
              </div>

              <button
                onClick={handleGenerateAgenda}
                disabled={generating || !aiTitle.trim()}
                className="w-full py-2 bg-amber-600/30 hover:bg-amber-500/40 border border-amber-400/60 text-amber-100 rounded text-xs font-orbitron font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
              >
                <Sparkles size={16} className="text-amber-400 animate-spin" />
                {generating ? 'GENERATING AGENDA...' : 'GENERATE AI AGENDA'}
              </button>

              {generatedAgenda && (
                <div className="p-3 rounded bg-amber-950/30 border border-amber-800/50 space-y-2">
                  <div className="text-[10px] font-orbitron font-bold text-amber-400 uppercase">GENERATED MEETING AGENDA:</div>
                  <div className="text-xs text-amber-100 whitespace-pre-wrap">{generatedAgenda}</div>
                  <button
                    onClick={applyAgendaToNewEvent}
                    className="w-full py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 text-xs font-orbitron font-bold rounded flex items-center justify-center gap-1 mt-2"
                  >
                    <Check size={14} /> USE IN NEW EVENT BOOKING
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Sync & Integrations Tab */}
          {activeTab === 'sync' && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
              {/* Google Calendar Section */}
              <div className="p-3.5 rounded-lg bg-emerald-950/20 border border-emerald-800/50 space-y-3">
                <div className="flex items-center gap-2">
                  <ExternalLink size={16} className="text-emerald-400" />
                  <span className="font-orbitron font-bold text-xs text-emerald-200">GOOGLE CALENDAR INTEGRATION</span>
                </div>
                <p className="text-[11px] text-cyan-300/80 leading-relaxed">
                  Subscribe to your Rocky live calendar in Google Calendar, or open Google Calendar directly.
                </p>
                <div className="flex gap-2">
                  <a
                    href="https://calendar.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-1.5 px-3 bg-emerald-600/30 hover:bg-emerald-500/40 border border-emerald-400/60 text-emerald-100 rounded text-xs font-orbitron font-bold flex items-center justify-center gap-1.5 transition-all"
                  >
                    <ExternalLink size={13} /> OPEN GOOGLE CALENDAR
                  </a>
                  <a
                    href="https://calendar.google.com/calendar/u/0/r/settings/addbyurl"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-1.5 px-3 bg-cyan-600/30 hover:bg-cyan-500/40 border border-cyan-400/60 text-cyan-100 rounded text-xs font-orbitron font-bold flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Plus size={13} /> ADD BY URL IN GOOGLE
                  </a>
                </div>
              </div>

              {/* Live iCalendar Feed Subscription */}
              <div className="p-3.5 rounded-lg bg-cyan-950/30 border border-cyan-800/50 space-y-2.5">
                <div className="flex items-center gap-2">
                  <Share2 size={15} className="text-cyan-400" />
                  <span className="font-orbitron font-bold text-xs text-cyan-200">LIVE ICALENDAR FEED (RFC 5545)</span>
                </div>
                <p className="text-[11px] text-cyan-400/80 leading-relaxed">
                  Use this feed URL to sync events automatically with Google Calendar, Apple Calendar, or Microsoft Outlook.
                </p>
                <div className="flex items-center gap-2 bg-[#010814] border border-cyan-800/60 rounded p-1.5">
                  <input
                    type="text"
                    readOnly
                    value={getFeedUrl()}
                    className="bg-transparent text-[11px] font-mono text-cyan-300 w-full focus:outline-none select-all"
                  />
                  <button
                    onClick={handleCopyFeed}
                    className="px-2.5 py-1 bg-cyan-600/30 hover:bg-cyan-500/40 text-cyan-200 rounded text-[10px] font-orbitron font-bold flex items-center gap-1 shrink-0 border border-cyan-400/40"
                  >
                    {copiedFeed ? <CheckCheck size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    <span>{copiedFeed ? 'COPIED' : 'COPY'}</span>
                  </button>
                </div>
              </div>

              {/* Standard Calendar File Export & Import */}
              <div className="p-3.5 rounded-lg bg-cyan-950/30 border border-cyan-800/50 space-y-3">
                <div className="flex items-center gap-2">
                  <CalendarIcon size={15} className="text-cyan-400" />
                  <span className="font-orbitron font-bold text-xs text-cyan-200">EXPORT / IMPORT .ICS FILE</span>
                </div>
                <p className="text-[11px] text-cyan-400/80 leading-relaxed">
                  Export your schedule as a standard <code className="text-cyan-300 font-mono">.ics</code> file or import events from external calendars.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleExportIcs}
                    className="py-2 bg-cyan-700/30 hover:bg-cyan-600/40 border border-cyan-500/50 text-cyan-100 rounded text-xs font-orbitron font-bold flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Download size={13} /> EXPORT .ICS
                  </button>
                  <label className="py-2 bg-cyan-700/30 hover:bg-cyan-600/40 border border-cyan-500/50 text-cyan-100 rounded text-xs font-orbitron font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer">
                    <Upload size={13} />
                    <span>{importing ? 'IMPORTING...' : 'IMPORT .ICS'}</span>
                    <input
                      type="file"
                      accept=".ics,text/calendar"
                      onChange={handleImportIcs}
                      className="hidden"
                      disabled={importing}
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-cyan-900/60 text-center text-[10px] font-orbitron text-cyan-600">
          ROCKY CALENDAR & MEETING ENGINE v2.0
        </div>

      </div>
    </div>
  );
};
