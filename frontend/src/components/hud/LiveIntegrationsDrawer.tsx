"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, CloudSun, Wind, Droplets, Globe, Newspaper, 
  ExternalLink, Music, Play, Pause, Volume2, RefreshCw, 
  Sparkles, Compass, Thermometer
} from 'lucide-react';
import { getApiUrl } from '@/lib/api';

interface LiveIntegrationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSpeakText?: (text: string) => void;
}

export const LiveIntegrationsDrawer: React.FC<LiveIntegrationsDrawerProps> = ({
  isOpen,
  onClose,
  onSpeakText,
}) => {
  const [activeTab, setActiveTab] = useState<'weather' | 'news' | 'audio'>('weather');
  const [selectedCity, setSelectedCity] = useState('bengaluru');
  const [weatherData, setWeatherData] = useState<any>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);

  // News State
  const [newsStories, setNewsStories] = useState<any[]>([]);
  const [newsSummary, setNewsSummary] = useState('');
  const [loadingNews, setLoadingNews] = useState(false);

  // Ambient Audio Player State
  const [isPlayingAmbient, setIsPlayingAmbient] = useState(false);
  const [ambientTrack, setAmbientTrack] = useState('Cyberpunk Rain');

  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'weather') loadWeather(selectedCity);
      if (activeTab === 'news') loadNews();
    }
  }, [isOpen, activeTab, selectedCity]);

  const loadWeather = async (city: string) => {
    setLoadingWeather(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/external/weather?city=${encodeURIComponent(city)}`);
      if (res.ok) {
        const data = await res.json();
        setWeatherData(data);
      }
    } catch (e) {
      console.error("Failed to load weather:", e);
    } finally {
      setLoadingWeather(false);
    }
  };

  const loadNews = async () => {
    setLoadingNews(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/external/news`);
      if (res.ok) {
        const data = await res.json();
        setNewsStories(data.stories || []);
        setNewsSummary(data.summary || '');
      }
    } catch (e) {
      console.error("Failed to load news:", e);
    } finally {
      setLoadingNews(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end pointer-events-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[#020813]/70 backdrop-blur-sm"
        />

        {/* Drawer Container */}
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative w-full max-w-2xl h-full bg-[#020813]/95 border-l border-cyan-500/40 p-6 flex flex-col justify-between overflow-y-auto text-cyan-300 font-mono shadow-[0_0_50px_rgba(0,240,255,0.2)]"
        >
          {/* Header */}
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-cyan-900/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded bg-cyan-950/80 border border-cyan-400/50 shadow-[0_0_10px_rgba(0,240,255,0.4)]">
                  <Globe className="text-cyan-400 animate-pulse" size={20} />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-orbitron font-bold text-cyan-200 tracking-wider">
                    EXTERNAL.SERVICES // HUB
                  </h2>
                  <p className="text-[10px] sm:text-xs text-cyan-500 tracking-widest uppercase">
                    Live Open-Meteo Weather, Global Wire & Ambient Audio
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/40 text-cyan-400 hover:text-cyan-200 transition-all"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-2 my-4 bg-cyan-950/40 p-1 rounded-lg border border-cyan-900/60">
              <button
                type="button"
                onClick={() => setActiveTab('weather')}
                className={`flex-1 py-1.5 text-[11px] font-orbitron font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'weather'
                    ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/50 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                    : 'text-cyan-500 hover:text-cyan-300'
                }`}
              >
                <CloudSun size={14} />
                <span>WEATHER SENSORS</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('news')}
                className={`flex-1 py-1.5 text-[11px] font-orbitron font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'news'
                    ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/50 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                    : 'text-cyan-500 hover:text-cyan-300'
                }`}
              >
                <Newspaper size={14} />
                <span>GLOBAL NEWS WIRE</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('audio')}
                className={`flex-1 py-1.5 text-[11px] font-orbitron font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'audio'
                    ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/50 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                    : 'text-cyan-500 hover:text-cyan-300'
                }`}
              >
                <Music size={14} />
                <span>AMBIENT SOUNDSCAPE</span>
              </button>
            </div>

            {/* Tab 1: Live Weather */}
            {activeTab === 'weather' && (
              <div className="space-y-4">
                {/* City Preset Chips */}
                <div className="flex flex-wrap gap-2">
                  {[
                    'bengaluru', 'mumbai', 'delhi', 'chennai', 
                    'hyderabad', 'london', 'new york', 'tokyo'
                  ].map(c => (
                    <button
                      key={c}
                      onClick={() => setSelectedCity(c)}
                      className={`px-3 py-1.5 text-[10px] font-orbitron rounded border uppercase transition-all ${
                        selectedCity === c
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-100 shadow-[0_0_10px_rgba(0,240,255,0.2)]'
                          : 'bg-cyan-950/30 border-cyan-900 text-cyan-600 hover:text-cyan-400'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>

                {loadingWeather ? (
                  <div className="p-12 text-center text-xs text-cyan-500 flex items-center justify-center gap-2">
                    <RefreshCw size={16} className="animate-spin text-cyan-400" />
                    <span>Querying Open-Meteo orbital telemetry...</span>
                  </div>
                ) : weatherData ? (
                  <div className="p-6 rounded-lg bg-[#050f20]/90 border border-cyan-500/40 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] text-cyan-600 uppercase font-orbitron">METEOROLOGICAL SENSOR NODE</span>
                        <h3 className="text-xl font-orbitron font-bold text-cyan-100 mt-0.5">
                          {weatherData.city}
                        </h3>
                        <p className="text-xs text-cyan-400 font-sans mt-0.5">
                          Condition: <span className="font-bold text-white">{weatherData.condition}</span>
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-3xl font-orbitron font-bold text-cyan-200">
                          {weatherData.temperature}°C
                        </span>
                        <span className="text-[10px] text-cyan-500 block">
                          Feels like: {weatherData.feels_like}°C
                        </span>
                      </div>
                    </div>

                    {/* Sensor Metric Cards */}
                    <div className="grid grid-cols-3 gap-3 pt-2">
                      <div className="p-3 rounded bg-cyan-950/40 border border-cyan-900 text-center">
                        <Droplets size={16} className="text-cyan-400 mx-auto mb-1" />
                        <span className="text-[9px] text-cyan-600 uppercase block">HUMIDITY</span>
                        <span className="text-xs font-bold text-cyan-200">{weatherData.humidity}%</span>
                      </div>
                      <div className="p-3 rounded bg-cyan-950/40 border border-cyan-900 text-center">
                        <Wind size={16} className="text-cyan-400 mx-auto mb-1" />
                        <span className="text-[9px] text-cyan-600 uppercase block">WIND SPEED</span>
                        <span className="text-xs font-bold text-cyan-200">{weatherData.wind_speed} km/h</span>
                      </div>
                      <div className="p-3 rounded bg-cyan-950/40 border border-cyan-900 text-center">
                        <Thermometer size={16} className="text-cyan-400 mx-auto mb-1" />
                        <span className="text-[9px] text-cyan-600 uppercase block">ORBITAL TIME</span>
                        <span className="text-xs font-bold text-cyan-200">{weatherData.is_day ? "DAYLIGHT" : "NOCTURNAL"}</span>
                      </div>
                    </div>

                    {/* Spoken Summary */}
                    <div className="p-3 rounded bg-cyan-950/30 border border-cyan-800/60 font-sans text-xs text-cyan-300/90 leading-relaxed">
                      <span className="font-orbitron text-[10px] text-cyan-400 uppercase font-bold block mb-1">
                        SPOKEN VOICE SYNTHESIS
                      </span>
                      "{weatherData.summary}"
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* Tab 2: Global News Wire */}
            {activeTab === 'news' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-orbitron text-cyan-400 uppercase tracking-wider">
                    REAL-TIME TECH HEADLINES ({newsStories.length})
                  </span>
                  <button
                    onClick={loadNews}
                    className="p-1 rounded text-cyan-600 hover:text-cyan-300 transition-colors"
                    title="Refresh Feed"
                  >
                    <RefreshCw size={14} className={loadingNews ? "animate-spin" : ""} />
                  </button>
                </div>

                {loadingNews ? (
                  <div className="p-12 text-center text-xs text-cyan-500 flex items-center justify-center gap-2">
                    <RefreshCw size={16} className="animate-spin text-cyan-400" />
                    <span>Synchronizing global RSS and Hacker News pipeline...</span>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                    {newsStories.map((story) => (
                      <a
                        key={story.id}
                        href={story.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 rounded-lg bg-[#050f20]/80 border border-cyan-900/60 hover:border-cyan-500/50 transition-all block group"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h4 className="text-xs font-sans text-cyan-200 group-hover:text-cyan-100 font-semibold leading-snug">
                            {story.title}
                          </h4>
                          <ExternalLink size={14} className="text-cyan-600 group-hover:text-cyan-300 shrink-0 mt-0.5 transition-colors" />
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-[9px] text-cyan-600 font-mono">
                          <span>POINTS: {story.score}</span>
                          <span>BY: {story.by}</span>
                          <span className="text-cyan-500">HN DISPATCH</span>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Ambient Soundscape */}
            {activeTab === 'audio' && (
              <div className="space-y-4">
                <div className="p-5 rounded-lg bg-[#050f20]/90 border border-cyan-500/40 text-center space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-cyan-950 border-2 border-cyan-400 flex items-center justify-center shadow-[0_0_20px_rgba(0,240,255,0.4)]">
                    <Music className="text-cyan-300" size={28} />
                  </div>
                  <div>
                    <h3 className="font-orbitron font-bold text-sm text-cyan-100">
                      SYNTHETIC AUDIO GENERATOR
                    </h3>
                    <p className="text-[11px] text-cyan-500 mt-0.5">
                      Binaural Focus & High-Res Cyberpunk Background Ambience
                    </p>
                  </div>

                  <div className="flex flex-wrap justify-center gap-2">
                    {[
                      'Cyberpunk Rain', 'Deep Space Void', 
                      'Warp Drive Hum', 'Binaural 432Hz'
                    ].map(track => (
                      <button
                        key={track}
                        onClick={() => setAmbientTrack(track)}
                        className={`px-3 py-1.5 text-[10px] font-orbitron rounded border uppercase transition-all ${
                          ambientTrack === track
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-100 shadow-[0_0_10px_rgba(0,240,255,0.2)]'
                            : 'bg-cyan-950/40 border-cyan-900 text-cyan-600 hover:text-cyan-400'
                        }`}
                      >
                        {track}
                      </button>
                    ))}
                  </div>

                  <div className="p-3 rounded bg-cyan-950/40 border border-cyan-900 text-xs font-mono text-cyan-400">
                    STATUS: {isPlayingAmbient ? `STREAMING // ${ambientTrack.toUpperCase()}` : "STANDBY"}
                  </div>

                  <button
                    onClick={() => setIsPlayingAmbient(!isPlayingAmbient)}
                    className={`px-6 py-2.5 rounded-lg font-orbitron text-xs flex items-center justify-center gap-2 mx-auto transition-all ${
                      isPlayingAmbient
                        ? 'bg-red-950/60 border border-red-500 text-red-300 shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                        : 'bg-cyan-500/20 border border-cyan-400 text-cyan-100 shadow-[0_0_15px_rgba(0,240,255,0.3)]'
                    }`}
                  >
                    {isPlayingAmbient ? <Pause size={14} /> : <Play size={14} />}
                    <span>{isPlayingAmbient ? "HALT AUDIO" : "INITIATE AMBIENCE"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-cyan-900/60 flex items-center justify-between">
            <span className="text-[10px] text-cyan-600 font-mono">
              TELEMETRY: LIVE OPEN-METEO & HN PIPELINE
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 font-orbitron text-xs tracking-wider uppercase transition-all"
            >
              CLOSE HUB
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default LiveIntegrationsDrawer;
