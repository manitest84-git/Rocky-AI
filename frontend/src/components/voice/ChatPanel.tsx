"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { DecryptText } from './DecryptText';
import { streamChat, getUserHistory, clearUserHistory } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Trash2 } from 'lucide-react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatPanelProps {
  className?: string;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ className = '' }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
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

  const loadHistory = async () => {
    if (!user) return;
    try {
      const res = await getUserHistory(10, 0);
      const histMsgs = res.messages.map((h: { role: string; content: string; timestamp?: string }, i: number) => ({
        id: `hist-${i}-${Date.now()}`,
        role: h.role as 'user' | 'assistant',
        content: h.content,
        timestamp: h.timestamp ? new Date(h.timestamp) : new Date()
      }));
      
      if (histMsgs.length === 0) {
        const userName = user?.username || 'user';
        setMessages([{
          id: `greeting-${Date.now()}`,
          role: 'assistant',
          content: `Hello ${userName}! I am Rocky. How can I make your day better today?`,
          timestamp: new Date()
        }]);
      } else {
        setMessages(histMsgs);
      }
      setHasMore(res.has_more);
      setOffset(res.messages.length);
    } catch (e) {
      console.error('Failed to load user history', e);
      setError('Failed to load conversation history.');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleLoadMore = async () => {
    if (!user || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const res = await getUserHistory(10, offset);
      const older = res.messages.map((h: { role: string; content: string; timestamp?: string }, i: number) => ({
        id: `hist-older-${i}-${Date.now()}`,
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
    loadHistory();
  }, [user]);

  const handleClearHistory = async () => {
    if (!confirm('Clear all conversation history for this user?')) return;
    try {
      await clearUserHistory();
      setMessages([]);
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

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsStreaming(true);

    const assistantId = (Date.now() + 1).toString();
    setMessages(prev => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '', timestamp: new Date() }
    ]);

    try {
      await streamChat(
        inputValue,
        messages.map(m => ({ role: m.role, content: m.content })),
        (token: string) => {
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantId ? { ...msg, content: msg.content + token } : msg
            )
          );
        },
        () => {
          setIsStreaming(false);
        }
      );
    } catch (error) {
      console.error("Chat error:", error);
      setError('Failed to communicate with AI. Please try again.');
      setTimeout(() => setError(null), 5000);
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className={`flex flex-col h-full bg-[#020813]/40 backdrop-blur-md border-l border-cyan-900/30 font-mono ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-cyan-900/30 flex justify-between items-center bg-[rgba(0,240,255,0.05)]">
        <span className="text-cyan-500 font-orbitron uppercase tracking-widest text-sm">Comms Link</span>
        <div className="flex items-center gap-3">
          {messages.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="text-cyan-800 hover:text-red-400 transition-colors"
              title="Clear user conversation memory"
              aria-label="Clear conversation history"
            >
              <Trash2 size={14} />
            </button>
          )}
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(0,240,255,0.8)]" />
        </div>
      </div>

      {/* Error Toast */}
      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/30 text-red-300 text-xs font-mono flex items-center gap-2">
          <span className="text-red-400">⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-cyan-900 scrollbar-track-transparent">
        {hasMore && (
          <div className="flex justify-center mb-4">
            <button
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="px-3 py-1.5 rounded-md bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/40 text-cyan-300 font-orbitron text-[11px] uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isLoadingMore ? 'Loading...' : '↑ Load Older Messages (+10)'}
            </button>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center gap-2 mb-1 text-[10px] text-cyan-700 tracking-wider">
              <span>{msg.role === 'user' ? (user?.username ? user.username.toUpperCase() : 'USER') : 'ROCKY'}</span>
              <span>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            
            <div
              className={`max-w-[85%] p-3 rounded-lg ${
                msg.role === 'user'
                  ? 'bg-blue-900/20 text-cyan-50 border border-blue-500/20'
                  : 'bg-transparent text-cyan-300'
              }`}
            >
              {msg.role === 'user' ? (
                msg.content
              ) : isStreaming && msg.id === messages[messages.length - 1]?.id ? (
                <span>{msg.content}</span>
              ) : (
                <DecryptText text={msg.content} speed={10} />
              )}
            </div>
          </div>
        ))}
        {isStreaming && messages.length > 0 && messages[messages.length-1].content === '' && (
          <div className="flex items-start">
             <div className="flex gap-1 p-3">
               <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
               <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
               <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-cyan-900/30 bg-[rgba(0,240,255,0.02)]">
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
            placeholder="Enter command..."
            className="w-full bg-transparent border-b border-cyan-900 text-cyan-300 placeholder-cyan-900/50 py-2 pl-2 pr-10 focus:outline-none focus:border-cyan-400 focus:shadow-[0_2px_10px_-2px_rgba(0,240,255,0.3)] transition-all font-mono disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isStreaming}
            className="absolute right-2 text-cyan-600 hover:text-cyan-400 disabled:opacity-50 disabled:hover:text-cyan-600 transition-colors"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};
