"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Send, Trash2, History, Calendar, ChevronUp, Mic } from 'lucide-react';
import { streamChat, getUserHistory, clearUserHistory } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { getDynamicGreeting } from '@/lib/greeting';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isVoice?: boolean;
}

interface ChatPanelProps {
  className?: string;
  incomingVoiceMessage?: ChatMessage | null;
  isVoiceOnline?: boolean;
  onSendVoiceChat?: (text: string) => Promise<void>;
  onSubtitleUpdate?: (text: string) => void;
  onUiAction?: (action: any) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ 
  className = '', 
  incomingVoiceMessage,
  isVoiceOnline = false,
  onSendVoiceChat,
  onSubtitleUpdate,
  onUiAction,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isShowingAllHistory, setIsShowingAllHistory] = useState(false);
  const [allTimeCount, setAllTimeCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { user } = useAuth();

  // Cleanup pending requests on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  // Real-time Voice Conversation Transcript Integration
  useEffect(() => {
    if (!incomingVoiceMessage) return;

    // Clear safety timer immediately if assistant voice response arrived
    if (incomingVoiceMessage.role === 'assistant' && abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    setMessages((prev) => {
      // 1. If there is a pending assistant placeholder, fill it with Rocky's spoken response
      const pendingIdx = prev.findIndex((m) => m.role === 'assistant' && m.content === '');
      if (pendingIdx !== -1 && incomingVoiceMessage.role === 'assistant') {
        const updated = [...prev];
        updated[pendingIdx] = {
          ...incomingVoiceMessage,
          id: prev[pendingIdx].id,
        };
        setIsStreaming(false);
        return updated;
      }

      // 2. Deduplicate if identical content and role was received in the last 4 seconds
      const exists = prev.some(
        (m) =>
          m.role === incomingVoiceMessage.role &&
          m.content.trim() === incomingVoiceMessage.content.trim() &&
          Math.abs(new Date(m.timestamp).getTime() - new Date(incomingVoiceMessage.timestamp).getTime()) < 4000
      );
      if (exists) return prev;
      return [...prev, incomingVoiceMessage];
    });

    setIsStreaming(false);

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, [incomingVoiceMessage]);

  /**
   * Load today's conversations (<2-3 seconds, typically <200ms).
   * If today is fresh (no turns yet), start clean with the dynamic time-based greeting.
   */
  const loadTodayHistory = async () => {
    if (!user) return;
    setIsLoadingMore(true);
    try {
      const res = await getUserHistory(10, 0, true);
      const totalAllTime = res.all_time_count || res.total_count || 0;
      setAllTimeCount(totalAllTime);
      setIsShowingAllHistory(false);

      if (res.messages && res.messages.length > 0) {
        const histMsgs: ChatMessage[] = res.messages.map((h: { role: string; content: string; timestamp?: string }, i: number) => ({
          id: `today-${i}-${h.timestamp || Date.now()}`,
          role: h.role as 'user' | 'assistant',
          content: h.content,
          timestamp: h.timestamp ? new Date(h.timestamp) : new Date()
        }));
        setMessages(histMsgs);
        setHasMore(res.has_more);
        setOffset(res.messages.length);
      } else {
        // Fresh start for a new day
        setMessages([{
          id: `greeting-${Date.now()}`,
          role: 'assistant',
          content: getDynamicGreeting(user?.username),
          timestamp: new Date()
        }]);
        setHasMore(false);
        setOffset(0);
      }
    } catch (e) {
      console.error('Failed to load today history', e);
      setError('Failed to load conversation history.');
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsLoadingMore(false);
    }
  };

  /**
   * Switch to full history mode to view older sessions from past days
   */
  const handleLoadPreviousDays = async () => {
    if (!user || isLoadingMore) return;
    setIsLoadingMore(true);
    setIsShowingAllHistory(true);
    try {
      const res = await getUserHistory(10, 0, false);
      const histMsgs: ChatMessage[] = res.messages.map((h: { role: string; content: string; timestamp?: string }, i: number) => ({
        id: `prev-${i}-${h.timestamp || Date.now()}`,
        role: h.role as 'user' | 'assistant',
        content: h.content,
        timestamp: h.timestamp ? new Date(h.timestamp) : new Date()
      }));
      setMessages(histMsgs);
      setHasMore(res.has_more);
      setOffset(res.messages.length);
      setAllTimeCount(res.total_count);
    } catch (e) {
      console.error('Failed to load past history', e);
      setError('Failed to load previous conversations.');
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleLoadMore = async () => {
    if (!user || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const res = await getUserHistory(10, offset, !isShowingAllHistory);
      const older: ChatMessage[] = res.messages.map((h: { role: string; content: string; timestamp?: string }, i: number) => ({
        id: `older-${i}-${h.timestamp || Date.now()}`,
        role: h.role as 'user' | 'assistant',
        content: h.content,
        timestamp: h.timestamp ? new Date(h.timestamp) : new Date()
      }));
      setMessages(prev => [...older, ...prev]);
      setHasMore(res.has_more);
      setOffset(prev => prev + res.messages.length);
    } catch (e) {
      console.error('Failed to load older history', e);
      setError('Failed to load older messages.');
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    loadTodayHistory();
  }, [user]);

  const handleClearHistory = async () => {
    if (!confirm('Clear conversation history for this user?')) return;
    try {
      await clearUserHistory();
      setMessages([{
        id: `greeting-${Date.now()}`,
        role: 'assistant',
        content: getDynamicGreeting(user?.username),
        timestamp: new Date()
      }]);
      setAllTimeCount(0);
      setHasMore(false);
      setOffset(0);
    } catch (e) {
      console.error('Failed to clear history', e);
      setError('Failed to clear conversation history.');
      setTimeout(() => setError(null), 5000);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isStreaming) return;

    const userPrompt = inputValue.trim();
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userPrompt,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsStreaming(true);

    if (isVoiceOnline && onSendVoiceChat) {
      // 1. Voice Conversation is ONLINE:
      // Rocky speaks aloud (online continuous) and replies in text transcript
      const assistantId = (Date.now() + 1).toString();
      setMessages(prev => [
        ...prev,
        { id: assistantId, role: 'assistant', content: '', timestamp: new Date(), isVoice: true }
      ]);
      try {
        await onSendVoiceChat(userPrompt);
        // Safety timeout to prevent getting stuck if network packet drops
        const safetyTimer = setTimeout(() => {
          setMessages(currentMsgs => {
            const pendingMsg = currentMsgs.find(m => m.id === assistantId && m.content.trim() === '');
            if (pendingMsg) {
              console.warn("Spoken reply wait timed out, falling back to text stream.");
              streamChat(
                userPrompt,
                currentMsgs.filter(m => m.id !== assistantId).map(m => ({ role: m.role, content: m.content })),
                (token: string) => {
                  setMessages(prev =>
                    prev.map(msg =>
                      msg.id === assistantId ? { ...msg, content: msg.content + token, isVoice: false } : msg
                    )
                  );
                },
                () => setIsStreaming(false),
                (action) => onUiAction?.(action)
              );
            } else {
              setIsStreaming(false);
            }
            return currentMsgs;
          });
        }, 12000);
        abortRef.current = { abort: () => clearTimeout(safetyTimer) } as any;
      } catch (err) {
        console.warn("Voice chat dispatch failed, falling back to text stream:", err);
        // Fallback to text streaming if LiveKit channel error occurs
        await streamChat(
          userPrompt,
          messages.map(m => ({ role: m.role, content: m.content })),
          (token: string) => {
            setMessages(prev =>
              prev.map(msg =>
                msg.id === assistantId ? { ...msg, content: msg.content + token, isVoice: false } : msg
              )
            );
          },
          () => setIsStreaming(false),
          (action) => onUiAction?.(action)
        );
      }
    } else {
      // 2. Voice Conversation is OFFLINE (to be initialise mode / Standby):
      // Respond STRICTLY in text only! No speech synthesis, no audio playback.
      const assistantId = (Date.now() + 1).toString();
      setMessages(prev => [
        ...prev,
        { id: assistantId, role: 'assistant', content: '', timestamp: new Date(), isVoice: false }
      ]);

      let fullResponse = '';
      try {
        await streamChat(
          userPrompt,
          messages.map(m => ({ role: m.role, content: m.content })),
          (token: string) => {
            fullResponse += token;
            setMessages(prev =>
              prev.map(msg =>
                msg.id === assistantId ? { ...msg, content: msg.content + token } : msg
              )
            );
          },
          () => {
            setIsStreaming(false);
            if (onSubtitleUpdate && fullResponse) {
              onSubtitleUpdate(`Rocky: ${fullResponse}`);
            }
          },
          (action) => onUiAction?.(action)
        );
      } catch (error) {
        console.error("Chat error:", error);
        setError('Failed to communicate with AI. Please try again.');
        setTimeout(() => setError(null), 5000);
        setIsStreaming(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className={`flex flex-col h-full bg-[#020813]/60 backdrop-blur-md border border-cyan-900/40 rounded-xl font-mono overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-3.5 border-b border-cyan-900/40 flex justify-between items-center bg-[rgba(0,240,255,0.05)]">
        <div className="flex items-center gap-2">
          <span className="text-cyan-400 font-orbitron uppercase tracking-widest text-xs font-bold">Comms Link</span>
          <span className="text-[10px] text-cyan-700 uppercase tracking-wider hidden sm:inline">
            {isShowingAllHistory ? '(Full Archive)' : "(Today's Session)"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {messages.length > 1 && (
            <button
              onClick={handleClearHistory}
              className="text-cyan-800 hover:text-red-400 transition-colors p-1"
              title="Clear user conversation memory"
              aria-label="Clear conversation history"
            >
              <Trash2 size={14} />
            </button>
          )}
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(0,240,255,0.8)]" />
        </div>
      </div>

      {/* Mode / Previous History Toggle Banner */}
      <div className="px-3 py-1.5 bg-cyan-950/40 border-b border-cyan-900/30 flex items-center justify-between text-[11px]">
        {!isShowingAllHistory ? (
          <>
            <span className="text-cyan-600 flex items-center gap-1">
              <Calendar size={12} className="text-cyan-400" /> Today&apos;s Session
            </span>
            {allTimeCount > 0 && (
              <button
                onClick={handleLoadPreviousDays}
                disabled={isLoadingMore}
                className="text-cyan-400 hover:text-cyan-200 underline font-orbitron text-[10px] uppercase tracking-wider flex items-center gap-1 transition-colors"
              >
                <History size={11} /> Previous Conversations
              </button>
            )}
          </>
        ) : (
          <>
            <span className="text-amber-400/80 flex items-center gap-1">
              <History size={12} className="text-amber-400" /> Historical Archive
            </span>
            <button
              onClick={loadTodayHistory}
              disabled={isLoadingMore}
              className="text-cyan-400 hover:text-cyan-200 underline font-orbitron text-[10px] uppercase tracking-wider flex items-center gap-1 transition-colors"
            >
              <Calendar size={11} /> Return to Today
            </button>
          </>
        )}
      </div>

      {/* Error Toast */}
      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/30 text-red-300 text-xs font-mono flex items-center gap-2">
          <span className="text-red-400">⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* Messages Area - Instant Clean Rendering without slow animations */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-cyan-900 scrollbar-track-transparent">
        {hasMore && (
          <div className="flex justify-center mb-3">
            <button
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="px-3 py-1.5 rounded-md bg-cyan-950/80 hover:bg-cyan-900/80 border border-cyan-500/40 text-cyan-300 font-orbitron text-[10px] uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-[0_0_10px_rgba(0,240,255,0.1)]"
            >
              <ChevronUp size={12} />
              {isLoadingMore ? 'Accessing records...' : 'Load Older Messages (+10)'}
            </button>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center gap-2 mb-1 text-[10px] text-cyan-700 tracking-wider">
              <span className="flex items-center gap-1.5 font-bold">
                {msg.role === 'user' ? (user?.username ? user.username.toUpperCase() : 'USER') : 'ROCKY'}
                {msg.isVoice && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-orbitron inline-flex items-center gap-1 shadow-[0_0_8px_rgba(0,240,255,0.2)]">
                    <Mic size={9} className="text-cyan-400 animate-pulse" /> VOICE
                  </span>
                )}
              </span>
              <span>
                {msg.timestamp instanceof Date
                  ? msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            
            <div
              className={`max-w-[88%] p-3 rounded-lg text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-900/25 text-cyan-100 border border-blue-500/30 shadow-[0_2px_10px_rgba(0,100,255,0.1)]'
                  : 'bg-cyan-950/20 text-cyan-300 border border-cyan-500/20'
              }`}
            >
              {/* Render instantly without slow character-by-character decryption for snappy loading */}
              <span className="whitespace-pre-wrap">{msg.content}</span>
            </div>
          </div>
        ))}

        {isStreaming && messages.length > 0 && messages[messages.length - 1].content === '' && (
          <div className="flex items-start">
             <div className="flex gap-1.5 p-3">
               <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
               <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
               <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 sm:p-4 border-t border-cyan-900/40 bg-[rgba(0,240,255,0.02)]">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input
            id="chat-command-input"
            name="chat_command"
            type="text"
            autoComplete="off"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            placeholder="Type command or query..."
            className="w-full bg-[#020813]/80 border border-cyan-900/60 rounded-md text-cyan-200 placeholder-cyan-900/60 py-2 pl-3 pr-10 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all font-mono text-sm disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isStreaming}
            className="absolute right-2.5 text-cyan-600 hover:text-cyan-300 disabled:opacity-40 disabled:hover:text-cyan-600 transition-colors"
            title="Transmit message"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatPanel;
