"use client";

import React, { useState, useEffect } from 'react';
import {
  LlmProvider,
  LlmFeatureRoute,
  getLlmProviders,
  createLlmProvider,
  updateLlmProvider,
  deleteLlmProvider,
  testLlmProvider,
  getLlmProviderModels,
  getLlmFeatureRoutes,
  updateLlmFeatureRoute,
  testLlmFeatureRoute,
  ProviderTestResponse,
  FeatureRouteTestResponse,
} from '@/lib/api';
import {
  Cpu,
  BrainCircuit,
  Server,
  Zap,
  Shield,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  Eye,
  EyeOff,
  Activity,
  ArrowRight,
  Terminal,
  Settings2,
  Layers,
  Sparkles,
} from 'lucide-react';

interface LlmRoutingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const PROVIDER_PRESETS: Record<string, { name: string; defaultUrl: string; defaultModel: string; hint: string }> = {
  tailscale_ollama: {
    name: 'Tailscale LLM',
    defaultUrl: 'http://100.125.118.104:11434',
    defaultModel: 'qwen2.5:1.5b',
    hint: 'Remote Mac mini Ollama instance over Tailscale mesh network',
  },
  ollama: {
    name: 'Local Ollama',
    defaultUrl: 'http://ollama:11434',
    defaultModel: 'qwen2.5:1.5b',
    hint: 'Self-hosted Ollama container or local GPU server',
  },
  openai: {
    name: 'OpenAI Production',
    defaultUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    hint: 'Official OpenAI API (GPT-4o, GPT-4o-mini, o1)',
  },
  groq: {
    name: 'Groq LPUs (Ultra Fast)',
    defaultUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    hint: 'Ultra-low latency inference (<300ms TTFT) for voice & chat',
  },
  anthropic: {
    name: 'Anthropic Claude',
    defaultUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-haiku-20241022',
    hint: 'Claude 3.5 Sonnet / Haiku for high-precision reasoning',
  },
  gemini: {
    name: 'Google Gemini',
    defaultUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-1.5-flash',
    hint: 'Gemini 1.5 Pro & Flash via OpenAI-compatible endpoint',
  },
  openrouter: {
    name: 'OpenRouter Gateway',
    defaultUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct',
    hint: 'Universal multi-provider gateway supporting 200+ models',
  },
  custom_openai: {
    name: 'Custom OpenAI-Compatible',
    defaultUrl: 'http://127.0.0.1:8000/v1',
    defaultModel: 'custom-model',
    hint: 'vLLM, LocalAI, LM Studio, DeepSeek, Together AI',
  },
};

export const LlmRoutingDrawer: React.FC<LlmRoutingDrawerProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'matrix' | 'providers' | 'benchmarks'>('matrix');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Providers & Routes state
  const [providers, setProviders] = useState<LlmProvider[]>([]);
  const [routes, setRoutes] = useState<LlmFeatureRoute[]>([]);

  // Provider Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProviderId, setEditingProviderId] = useState<number | null>(null);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('groq');
  const [formBaseUrl, setFormBaseUrl] = useState('');
  const [formApiKey, setFormApiKey] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formTemperature, setFormTemperature] = useState(0.7);
  const [formTimeout, setFormTimeout] = useState(30);
  const [showApiKey, setShowApiKey] = useState(false);
  const [modalTestResult, setModalTestResult] = useState<ProviderTestResponse | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [discoveredModels, setDiscoveredModels] = useState<string[]>([]);

  // Route test execution state
  const [testingRouteKey, setTestingRouteKey] = useState<string | null>(null);
  const [routeTestResults, setRouteTestResults] = useState<Record<string, FeatureRouteTestResponse>>({});
  const [routeSavingKey, setRouteSavingKey] = useState<string | null>(null);
  const [expandedPromptKey, setExpandedPromptKey] = useState<string | null>(null);

  // Benchmark state
  const [benchmarkResults, setBenchmarkResults] = useState<Record<number, ProviderTestResponse>>({});
  const [benchmarkingAll, setBenchmarkingAll] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadAllData();
    }
  }, [isOpen]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [provList, routeList] = await Promise.all([
        getLlmProviders(),
        getLlmFeatureRoutes(),
      ]);
      setProviders(provList);
      setRoutes(routeList);
    } catch (err: any) {
      console.error('Failed to load LLM configuration:', err);
      setError(err.message || 'Failed to fetch LLM routing data');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  // ----------------------------------------------------
  // Provider Actions
  // ----------------------------------------------------
  const openAddModal = (presetKey: string = 'groq') => {
    const preset = PROVIDER_PRESETS[presetKey] || PROVIDER_PRESETS.groq;
    setEditingProviderId(null);
    setFormName(preset.name);
    setFormType(presetKey);
    setFormBaseUrl(preset.defaultUrl);
    setFormApiKey('');
    setFormModel(preset.defaultModel);
    setFormTemperature(0.7);
    setFormTimeout(30);
    setDiscoveredModels([]);
    setModalTestResult(null);
    setIsModalOpen(true);
  };

  const openEditModal = (provider: LlmProvider) => {
    setEditingProviderId(provider.id);
    setFormName(provider.name);
    setFormType(provider.provider_type);
    setFormBaseUrl(provider.base_url);
    setFormApiKey(provider.api_key || '');
    setFormModel(provider.default_model);
    setFormTemperature(provider.temperature ?? 0.7);
    setFormTimeout(provider.timeout_seconds ?? 30);
    setDiscoveredModels(provider.available_models || []);
    setModalTestResult(null);
    setIsModalOpen(true);
  };

  const handleTypeChange = (newType: string) => {
    setFormType(newType);
    if (!editingProviderId && PROVIDER_PRESETS[newType]) {
      const preset = PROVIDER_PRESETS[newType];
      setFormName(preset.name);
      setFormBaseUrl(preset.defaultUrl);
      setFormModel(preset.defaultModel);
    }
  };

  const handleTestModalConnection = async () => {
    setTestingConnection(true);
    setModalTestResult(null);
    try {
      const res = await testLlmProvider({
        name: formName,
        provider_type: formType,
        base_url: formBaseUrl,
        api_key: formApiKey,
        default_model: formModel,
        timeout_seconds: 15,
      });
      setModalTestResult(res);
      if (res.models_found && res.models_found.length > 0) {
        setDiscoveredModels(res.models_found);
      }
    } catch (err: any) {
      setModalTestResult({ success: false, message: err.message || 'Test failed' });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleFetchModels = async () => {
    if (!editingProviderId) {
      // Test endpoint directly
      await handleTestModalConnection();
      return;
    }
    setFetchingModels(true);
    try {
      const models = await getLlmProviderModels(editingProviderId);
      setDiscoveredModels(models);
      if (models.length > 0 && !models.includes(formModel)) {
        setFormModel(models[0]);
      }
      showNotification(`Discovered ${models.length} live models from endpoint.`);
    } catch (err: any) {
      setError(err.message || 'Failed to query models');
    } finally {
      setFetchingModels(false);
    }
  };

  const handleSaveProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formBaseUrl.trim() || !formModel.trim()) {
      setError('Name, Base URL, and Default Model are required.');
      return;
    }

    try {
      if (editingProviderId) {
        const updated = await updateLlmProvider(editingProviderId, {
          name: formName.trim(),
          provider_type: formType,
          base_url: formBaseUrl.trim(),
          api_key: formApiKey.trim() ? formApiKey.trim() : undefined,
          default_model: formModel.trim(),
          available_models: discoveredModels,
          temperature: formTemperature,
          timeout_seconds: formTimeout,
        });
        setProviders(providers.map(p => (p.id === editingProviderId ? updated : p)));
        showNotification(`Provider "${updated.name}" updated successfully.`);
      } else {
        const created = await createLlmProvider({
          name: formName.trim(),
          provider_type: formType,
          base_url: formBaseUrl.trim(),
          api_key: formApiKey.trim() || undefined,
          default_model: formModel.trim(),
          available_models: discoveredModels,
          temperature: formTemperature,
          timeout_seconds: formTimeout,
        });
        setProviders([...providers, created]);
        showNotification(`New provider "${created.name}" configured.`);
      }
      setIsModalOpen(false);
      // Reload routes so join names update
      const updatedRoutes = await getLlmFeatureRoutes();
      setRoutes(updatedRoutes);
    } catch (err: any) {
      setError(err.message || 'Failed to save provider.');
    }
  };

  const handleDeleteProvider = async (provider: LlmProvider) => {
    if (provider.is_system) {
      alert('System default provider cannot be deleted.');
      return;
    }
    if (!window.confirm(`Delete provider "${provider.name}"? If referenced by routes, reassign them first.`)) {
      return;
    }
    try {
      await deleteLlmProvider(provider.id);
      setProviders(providers.filter(p => p.id !== provider.id));
      showNotification(`Provider "${provider.name}" removed.`);
      const updatedRoutes = await getLlmFeatureRoutes();
      setRoutes(updatedRoutes);
    } catch (err: any) {
      setError(err.message || 'Failed to delete provider');
    }
  };

  // ----------------------------------------------------
  // Cognitive Route Actions
  // ----------------------------------------------------
  const handleRouteChange = (
    featureKey: string,
    field: keyof LlmFeatureRoute,
    val: any
  ) => {
    setRoutes(prev =>
      prev.map(r => {
        if (r.feature_key !== featureKey) return r;
        const updated = { ...r, [field]: val };
        // Auto-update model if provider changed
        if (field === 'primary_provider_id') {
          const p = providers.find(item => item.id === Number(val));
          if (p) updated.primary_model = p.default_model;
        }
        if (field === 'fallback_provider_id') {
          if (val === '' || val === null) {
            updated.fallback_provider_id = null;
            updated.fallback_model = null;
          } else {
            const p = providers.find(item => item.id === Number(val));
            if (p) updated.fallback_model = p.default_model;
          }
        }
        return updated;
      })
    );
  };

  const handleSaveRoute = async (route: LlmFeatureRoute) => {
    setRouteSavingKey(route.feature_key);
    try {
      const updated = await updateLlmFeatureRoute(route.feature_key, {
        primary_provider_id: route.primary_provider_id,
        primary_model: route.primary_model,
        fallback_provider_id: route.fallback_provider_id || null,
        fallback_model: route.fallback_model || null,
        system_prompt_override: route.system_prompt_override || null,
        temperature_override: route.temperature_override || null,
      });
      setRoutes(prev => prev.map(r => (r.feature_key === route.feature_key ? { ...r, ...updated } : r)));
      showNotification(`Cognitive route for "${route.feature_name}" updated.`);
    } catch (err: any) {
      setError(err.message || 'Failed to update feature route');
    } finally {
      setRouteSavingKey(null);
    }
  };

  const handleTestRoute = async (featureKey: string) => {
    setTestingRouteKey(featureKey);
    try {
      const res = await testLlmFeatureRoute(featureKey);
      setRouteTestResults(prev => ({ ...prev, [featureKey]: res }));
    } catch (err: any) {
      setRouteTestResults(prev => ({
        ...prev,
        [featureKey]: {
          success: false,
          feature_key: featureKey,
          error: err.message || 'Execution error',
          latency_ms: 0,
        },
      }));
    } finally {
      setTestingRouteKey(null);
    }
  };

  // ----------------------------------------------------
  // Benchmark Actions
  // ----------------------------------------------------
  const runBenchmarks = async () => {
    setBenchmarkingAll(true);
    const results: Record<number, ProviderTestResponse> = {};
    for (const p of providers) {
      try {
        const res = await testLlmProvider({
          name: p.name,
          provider_type: p.provider_type,
          base_url: p.base_url,
          api_key: p.api_key,
          default_model: p.default_model,
          timeout_seconds: 10,
        });
        results[p.id] = res;
      } catch (err: any) {
        results[p.id] = { success: false, message: err.message || 'Ping timeout' };
      }
    }
    setBenchmarkResults(results);
    setBenchmarkingAll(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      {/* Sci-Fi HUD Container */}
      <div className="relative w-full max-w-6xl h-[92vh] max-h-[920px] bg-[#020a17]/95 border border-cyan-500/50 rounded-xl shadow-[0_0_50px_rgba(6,182,212,0.25)] flex flex-col overflow-hidden text-cyan-100 font-mono">
        
        {/* Glow Header */}
        <div className="px-6 py-4 border-b border-cyan-900/60 bg-gradient-to-r from-cyan-950/40 via-blue-950/20 to-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-500/50 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.4)]">
              <BrainCircuit className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-orbitron font-bold text-lg text-cyan-100 tracking-wider">
                  COGNITIVE MATRIX // NEURAL ROUTING & PROVIDERS
                </h2>
                <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-widest bg-cyan-900/40 border border-cyan-500/40 text-cyan-300 rounded">
                  8 Cognitive Subsystems
                </span>
              </div>
              <p className="text-xs text-cyan-400/80 font-mono">
                Decoupled Dynamic LLM Engine with Zero-Downtime Multi-Tier Fallback
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadAllData}
              disabled={loading}
              className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-800 hover:border-cyan-400 text-cyan-300 hover:text-cyan-100 transition-all flex items-center gap-1 text-xs"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-800 hover:border-red-500 text-cyan-300 hover:text-red-300 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global Notifications & Error Banners */}
        {error && (
          <div className="px-6 py-2 bg-red-950/60 border-b border-red-500/50 text-red-200 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-100 text-xs font-bold">
              DISMISS
            </button>
          </div>
        )}
        {notice && (
          <div className="px-6 py-2 bg-cyan-950/60 border-b border-cyan-500/50 text-cyan-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            <span>{notice}</span>
          </div>
        )}

        {/* Tabs Bar */}
        <div className="px-6 pt-3 border-b border-cyan-900/40 bg-[#031126]/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('matrix')}
              className={`px-4 py-2 text-xs font-orbitron font-semibold tracking-wider rounded-t-lg transition-all flex items-center gap-2 border-t border-x ${
                activeTab === 'matrix'
                  ? 'bg-cyan-950/80 border-cyan-500 text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                  : 'border-transparent text-cyan-600 hover:text-cyan-300 hover:bg-cyan-950/20'
              }`}
            >
              <Layers className="w-4 h-4 text-cyan-400" />
              [01] COGNITIVE ROUTING MATRIX
            </button>
            <button
              onClick={() => setActiveTab('providers')}
              className={`px-4 py-2 text-xs font-orbitron font-semibold tracking-wider rounded-t-lg transition-all flex items-center gap-2 border-t border-x ${
                activeTab === 'providers'
                  ? 'bg-cyan-950/80 border-cyan-500 text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                  : 'border-transparent text-cyan-600 hover:text-cyan-300 hover:bg-cyan-950/20'
              }`}
            >
              <Server className="w-4 h-4 text-cyan-400" />
              [02] NEURAL PROVIDERS ({providers.length})
            </button>
            <button
              onClick={() => {
                setActiveTab('benchmarks');
                runBenchmarks();
              }}
              className={`px-4 py-2 text-xs font-orbitron font-semibold tracking-wider rounded-t-lg transition-all flex items-center gap-2 border-t border-x ${
                activeTab === 'benchmarks'
                  ? 'bg-cyan-950/80 border-cyan-500 text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                  : 'border-transparent text-cyan-600 hover:text-cyan-300 hover:bg-cyan-950/20'
              }`}
            >
              <Activity className="w-4 h-4 text-cyan-400" />
              [03] LATENCY BENCHMARK
            </button>
          </div>

          {activeTab === 'providers' && (
            <div className="pb-2">
              <button
                onClick={() => openAddModal('groq')}
                className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-black font-orbitron font-bold text-xs flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all"
              >
                <Plus className="w-4 h-4" />
                ADD PROVIDER
              </button>
            </div>
          )}
        </div>

        {/* Tab 1: Cognitive Feature Routing Matrix */}
        {activeTab === 'matrix' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="p-3 bg-cyan-950/30 border border-cyan-800/40 rounded-lg text-xs text-cyan-300 flex items-center justify-between">
              <div>
                <span className="font-bold text-cyan-200">COGNITIVE DISPATCH ARCHITECTURE:</span> Each application
                functionality queries its designated Primary LLM. If the primary model fails or times out, the router
                instantly fails over to the configured Fallback model, and ultimately to local Ollama.
              </div>
              <span className="text-[10px] text-cyan-400/80 font-mono tracking-widest uppercase">
                Zero-Downtime Hot Swapping
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {routes.map(route => {
                const testRes = routeTestResults[route.feature_key];
                const isTesting = testingRouteKey === route.feature_key;
                const isSaving = routeSavingKey === route.feature_key;
                const isPromptOpen = expandedPromptKey === route.feature_key;

                return (
                  <div
                    key={route.feature_key}
                    className="p-4 rounded-xl bg-[#031329]/80 border border-cyan-800/50 hover:border-cyan-500/70 transition-all shadow-[0_0_20px_rgba(0,0,0,0.5)] flex flex-col gap-3"
                  >
                    {/* Feature Title & Description */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded bg-cyan-950 border border-cyan-600/40 text-cyan-400">
                          <Cpu className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="font-orbitron font-bold text-sm text-cyan-100 flex items-center gap-2">
                            {route.feature_name}
                            <span className="text-[10px] font-mono font-normal text-cyan-500 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-900">
                              {route.feature_key}
                            </span>
                          </h3>
                          <p className="text-xs text-cyan-400/70">{route.description}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setExpandedPromptKey(isPromptOpen ? null : route.feature_key)}
                          className={`px-2.5 py-1 text-[11px] rounded border transition-all flex items-center gap-1 ${
                            isPromptOpen || route.system_prompt_override
                              ? 'bg-cyan-950 border-cyan-400 text-cyan-200'
                              : 'bg-transparent border-cyan-800/50 text-cyan-400 hover:border-cyan-600'
                          }`}
                          title="Override System Prompt"
                        >
                          <Settings2 className="w-3 h-3" />
                          <span>{route.system_prompt_override ? 'Custom Prompt' : 'Prompt'}</span>
                        </button>
                        <button
                          onClick={() => handleTestRoute(route.feature_key)}
                          disabled={isTesting}
                          className="px-3 py-1 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/60 hover:border-cyan-400 text-cyan-200 text-xs font-orbitron flex items-center gap-1 transition-all"
                        >
                          <Zap className={`w-3 h-3 ${isTesting ? 'animate-bounce text-amber-400' : 'text-cyan-400'}`} />
                          <span>{isTesting ? 'TESTING...' : 'TEST'}</span>
                        </button>
                        <button
                          onClick={() => handleSaveRoute(route)}
                          disabled={isSaving}
                          className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-black text-xs font-orbitron font-bold flex items-center gap-1 transition-all shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                        >
                          <span>{isSaving ? 'SAVING...' : 'SAVE'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Mapping Selectors Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-cyan-900/40 text-xs">
                      {/* Primary Provider & Model */}
                      <div className="p-3 rounded-lg bg-[#020b17] border border-cyan-800/40 flex flex-col gap-2">
                        <div className="flex items-center justify-between text-[11px] font-bold text-cyan-300">
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                            PRIMARY LLM PROVIDER
                          </span>
                          <span className="text-[10px] text-cyan-500 uppercase tracking-widest font-mono">
                            Priority 1
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-cyan-500 uppercase">Provider</label>
                            <select
                              value={route.primary_provider_id}
                              onChange={e => handleRouteChange(route.feature_key, 'primary_provider_id', Number(e.target.value))}
                              className="w-full bg-slate-900 border border-cyan-800 rounded p-1.5 text-xs text-cyan-100 focus:outline-none focus:border-cyan-400"
                            >
                              {providers.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({p.provider_type})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] text-cyan-500 uppercase">Assigned Model</label>
                            <input
                              type="text"
                              value={route.primary_model}
                              onChange={e => handleRouteChange(route.feature_key, 'primary_model', e.target.value)}
                              className="w-full bg-slate-900 border border-cyan-800 rounded p-1.5 text-xs text-cyan-100 focus:outline-none focus:border-cyan-400 font-mono"
                              placeholder="e.g. gpt-4o-mini"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Fallback Provider & Model */}
                      <div className="p-3 rounded-lg bg-[#020b17] border border-cyan-800/40 flex flex-col gap-2">
                        <div className="flex items-center justify-between text-[11px] font-bold text-amber-300">
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                            FAILOVER / SECONDARY LLM
                          </span>
                          <span className="text-[10px] text-amber-500 uppercase tracking-widest font-mono">
                            Priority 2
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-cyan-500 uppercase">Provider</label>
                            <select
                              value={route.fallback_provider_id ?? ''}
                              onChange={e =>
                                handleRouteChange(
                                  route.feature_key,
                                  'fallback_provider_id',
                                  e.target.value ? Number(e.target.value) : null
                                )
                              }
                              className="w-full bg-slate-900 border border-cyan-800 rounded p-1.5 text-xs text-cyan-100 focus:outline-none focus:border-cyan-400"
                            >
                              <option value="">None (Local Ollama Failsafe)</option>
                              {providers.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({p.provider_type})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] text-cyan-500 uppercase">Fallback Model</label>
                            <input
                              type="text"
                              value={route.fallback_model ?? ''}
                              onChange={e => handleRouteChange(route.feature_key, 'fallback_model', e.target.value)}
                              disabled={!route.fallback_provider_id}
                              className="w-full bg-slate-900 border border-cyan-800 rounded p-1.5 text-xs text-cyan-100 focus:outline-none focus:border-cyan-400 font-mono disabled:opacity-40"
                              placeholder="e.g. llama-3.1-8b"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Collapsible System Prompt Override */}
                    {isPromptOpen && (
                      <div className="p-3 rounded-lg bg-[#010712] border border-cyan-900 flex flex-col gap-1.5 animate-in fade-in duration-150">
                        <label className="text-[11px] font-bold text-cyan-300">
                          System Prompt Override for {route.feature_name}:
                        </label>
                        <textarea
                          rows={3}
                          value={route.system_prompt_override || ''}
                          onChange={e => handleRouteChange(route.feature_key, 'system_prompt_override', e.target.value)}
                          placeholder="Leave empty to use the system default persona / instructions..."
                          className="w-full bg-slate-950 border border-cyan-800/80 rounded p-2 text-xs text-cyan-100 focus:outline-none focus:border-cyan-400 font-mono"
                        />
                      </div>
                    )}

                    {/* Test Execution Output Terminal Preview */}
                    {testRes && (
                      <div className="p-3 rounded-lg bg-black/90 border border-cyan-900 text-xs font-mono flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="flex items-center gap-1.5 text-cyan-400">
                            <Terminal className="w-3.5 h-3.5" />
                            EXECUTION LOG: {testRes.provider} // {testRes.model}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                              testRes.success
                                ? 'bg-emerald-950 border border-emerald-500 text-emerald-300'
                                : 'bg-red-950 border border-red-500 text-red-300'
                            }`}
                          >
                            {testRes.success ? `SUCCESS (${testRes.latency_ms}ms)` : 'FAILED'}
                          </span>
                        </div>
                        {testRes.response ? (
                          <div className="text-cyan-200 bg-slate-950/70 p-2 rounded border border-cyan-950 text-xs mt-1">
                            {testRes.response}
                          </div>
                        ) : (
                          <div className="text-red-300 bg-red-950/40 p-2 rounded border border-red-900 text-xs mt-1">
                            {testRes.error}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Neural Providers Management */}
        {activeTab === 'providers' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Quick Preset Cards */}
            <div>
              <div className="text-xs font-orbitron font-bold text-cyan-400 uppercase tracking-wider mb-2">
                Quick Setup Presets
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {Object.entries(PROVIDER_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => openAddModal(key)}
                    className="p-3 rounded-lg bg-[#031329]/80 border border-cyan-800/60 hover:border-cyan-400 text-left transition-all group flex flex-col gap-1 shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-cyan-100 group-hover:text-cyan-300 font-orbitron">
                        {preset.name}
                      </span>
                      <Plus className="w-3.5 h-3.5 text-cyan-500 group-hover:text-cyan-300" />
                    </div>
                    <div className="text-[10px] text-cyan-400/60 truncate">{preset.defaultModel}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Configured Providers List */}
            <div>
              <div className="text-xs font-orbitron font-bold text-cyan-400 uppercase tracking-wider mb-2">
                Configured Engine Instances ({providers.length})
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {providers.map(provider => {
                  return (
                    <div
                      key={provider.id}
                      className="p-4 rounded-xl bg-[#031329]/90 border border-cyan-800/60 hover:border-cyan-500 transition-all flex flex-col justify-between gap-3 shadow-[0_0_20px_rgba(0,0,0,0.5)]"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-orbitron font-bold text-sm text-cyan-100">{provider.name}</h4>
                            {provider.is_system && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-950 border border-amber-500/50 text-amber-300">
                                SYSTEM DEFAULT
                              </span>
                            )}
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-950 border border-cyan-500/40 text-cyan-300 uppercase">
                              {provider.provider_type}
                            </span>
                          </div>
                          <p className="text-xs text-cyan-400/80 font-mono mt-0.5">{provider.base_url}</p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => openEditModal(provider)}
                            className="p-1.5 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-300"
                            title="Edit Provider"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {!provider.is_system && (
                            <button
                              onClick={() => handleDeleteProvider(provider)}
                              className="p-1.5 rounded bg-red-950/60 hover:bg-red-900/80 border border-red-800 text-red-300"
                              title="Delete Provider"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs bg-[#010814] p-2.5 rounded-lg border border-cyan-900/60 font-mono">
                        <div>
                          <span className="text-[10px] text-cyan-600 block uppercase">Default Model</span>
                          <span className="text-cyan-200 font-bold truncate block">{provider.default_model}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-cyan-600 block uppercase">API Credential</span>
                          <span className="text-cyan-300 font-mono truncate block">
                            {provider.api_key ? provider.api_key : 'No Key Required (Local)'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-cyan-600 block uppercase">Timeout / Temp</span>
                          <span className="text-cyan-300">
                            {provider.timeout_seconds || 30}s // {provider.temperature ?? 0.7}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-cyan-600 block uppercase">Cached Models</span>
                          <span className="text-cyan-300">
                            {provider.available_models ? `${provider.available_models.length} models cached` : '0 cached'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Latency & Health Benchmarks */}
        {activeTab === 'benchmarks' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="p-3 bg-cyan-950/30 border border-cyan-800/40 rounded-lg text-xs text-cyan-300 flex items-center justify-between">
              <div>
                <span className="font-bold text-cyan-200">REAL-TIME LATENCY PING:</span> Tests time-to-first-response
                across all configured neural engines simultaneously to assist in optimal model selection for Voice and
                Chat.
              </div>
              <button
                onClick={runBenchmarks}
                disabled={benchmarkingAll}
                className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-black font-orbitron font-bold text-xs flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.4)]"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${benchmarkingAll ? 'animate-spin' : ''}`} />
                <span>BENCHMARK ALL</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {providers.map(provider => {
                const res = benchmarkResults[provider.id];
                return (
                  <div
                    key={provider.id}
                    className="p-4 rounded-xl bg-[#031329]/90 border border-cyan-800/60 flex flex-col gap-3 shadow-[0_0_20px_rgba(0,0,0,0.5)]"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-orbitron font-bold text-sm text-cyan-100">{provider.name}</h4>
                        <span className="text-xs text-cyan-400 font-mono">{provider.default_model}</span>
                      </div>
                      {res && (
                        <div
                          className={`px-2 py-1 rounded text-xs font-bold font-orbitron uppercase border ${
                            res.success
                              ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                              : 'bg-red-950 border-red-500 text-red-300'
                          }`}
                        >
                          {res.success ? `${res.latency_ms} ms` : 'FAILED'}
                        </div>
                      )}
                    </div>

                    {res && (
                      <div className="text-xs bg-[#010814] p-3 rounded-lg border border-cyan-900/60 font-mono">
                        <div className="text-cyan-300">{res.message}</div>
                        {res.models_found && res.models_found.length > 0 && (
                          <div className="text-[11px] text-cyan-500 mt-1">
                            Discovered models: {res.models_found.slice(0, 4).join(', ')}
                            {res.models_found.length > 4 ? ` (+${res.models_found.length - 4} more)` : ''}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Modal: Add / Edit Provider */}
        {isModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="w-full max-w-xl bg-[#020d1f] border border-cyan-500/70 rounded-xl p-6 shadow-[0_0_50px_rgba(6,182,212,0.4)] flex flex-col gap-4 text-cyan-100 font-mono">
              <div className="flex items-center justify-between border-b border-cyan-900/60 pb-3">
                <div className="flex items-center gap-2">
                  <Server className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-orbitron font-bold text-sm text-cyan-100">
                    {editingProviderId ? 'UPDATE LLM PROVIDER' : 'REGISTER NEW LLM PROVIDER'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded text-cyan-400 hover:text-red-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveProvider} className="space-y-3 text-xs">
                <div>
                  <label className="text-[10px] text-cyan-500 uppercase block mb-1">Provider Preset / Type</label>
                  <select
                    value={formType}
                    onChange={e => handleTypeChange(e.target.value)}
                    className="w-full bg-slate-900 border border-cyan-800 rounded p-2 text-cyan-100 focus:outline-none focus:border-cyan-400"
                  >
                    <option value="ollama">Local Ollama (Native /v1)</option>
                    <option value="openai">OpenAI Production</option>
                    <option value="groq">Groq LPUs (Fast Llama 3.3)</option>
                    <option value="anthropic">Anthropic Claude</option>
                    <option value="gemini">Google Gemini</option>
                    <option value="openrouter">OpenRouter Gateway</option>
                    <option value="custom_openai">Custom OpenAI-Compatible (vLLM / LM Studio)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-cyan-500 uppercase block mb-1">Display Name</label>
                    <input
                      type="text"
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      placeholder="e.g. Groq Production"
                      className="w-full bg-slate-900 border border-cyan-800 rounded p-2 text-cyan-100 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-cyan-500 uppercase block mb-1">Base URL</label>
                    <input
                      type="text"
                      value={formBaseUrl}
                      onChange={e => setFormBaseUrl(e.target.value)}
                      placeholder="https://api.openai.com/v1"
                      className="w-full bg-slate-900 border border-cyan-800 rounded p-2 text-cyan-100 focus:outline-none focus:border-cyan-400 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-cyan-500 uppercase">
                      API Key (Encrypted with AES-256 Fernet at rest)
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="text-[10px] text-cyan-400 hover:text-cyan-200 flex items-center gap-1"
                    >
                      {showApiKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showApiKey ? 'Hide' : 'Show'}</span>
                    </button>
                  </div>
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={formApiKey}
                    onChange={e => setFormApiKey(e.target.value)}
                    placeholder={editingProviderId ? 'Leave blank to preserve existing key' : 'sk-... or gsk_...'}
                    className="w-full bg-slate-900 border border-cyan-800 rounded p-2 text-cyan-100 focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-cyan-500 uppercase">Default Model</label>
                    <button
                      type="button"
                      onClick={handleFetchModels}
                      disabled={fetchingModels || testingConnection}
                      className="text-[10px] text-cyan-400 hover:text-cyan-200 flex items-center gap-1 font-bold"
                    >
                      <RefreshCw className={`w-3 h-3 ${fetchingModels ? 'animate-spin' : ''}`} />
                      <span>{fetchingModels ? 'Fetching...' : 'Query Live Models'}</span>
                    </button>
                  </div>

                  {discoveredModels.length > 0 ? (
                    <select
                      value={formModel}
                      onChange={e => setFormModel(e.target.value)}
                      className="w-full bg-slate-900 border border-cyan-800 rounded p-2 text-cyan-100 focus:outline-none focus:border-cyan-400 font-mono"
                    >
                      {discoveredModels.map(m => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formModel}
                      onChange={e => setFormModel(e.target.value)}
                      placeholder="e.g. llama-3.3-70b-versatile"
                      className="w-full bg-slate-900 border border-cyan-800 rounded p-2 text-cyan-100 focus:outline-none focus:border-cyan-400 font-mono"
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-cyan-500 uppercase block mb-1">Temperature (0.0 - 1.0)</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0.0"
                      max="1.5"
                      value={formTemperature}
                      onChange={e => setFormTemperature(parseFloat(e.target.value))}
                      className="w-full bg-slate-900 border border-cyan-800 rounded p-2 text-cyan-100 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-cyan-500 uppercase block mb-1">Timeout (Seconds)</label>
                    <input
                      type="number"
                      value={formTimeout}
                      onChange={e => setFormTimeout(parseInt(e.target.value))}
                      className="w-full bg-slate-900 border border-cyan-800 rounded p-2 text-cyan-100 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                {/* Test Connection Result */}
                {modalTestResult && (
                  <div
                    className={`p-2.5 rounded border text-xs flex items-center justify-between ${
                      modalTestResult.success
                        ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200'
                        : 'bg-red-950/60 border-red-500 text-red-200'
                    }`}
                  >
                    <span>{modalTestResult.message}</span>
                    {modalTestResult.latency_ms && (
                      <span className="font-bold">{modalTestResult.latency_ms} ms</span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-cyan-900/60">
                  <button
                    type="button"
                    onClick={handleTestModalConnection}
                    disabled={testingConnection}
                    className="px-3 py-2 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-600 text-cyan-200 text-xs font-orbitron flex items-center gap-1.5"
                  >
                    <Zap className={`w-3.5 h-3.5 ${testingConnection ? 'animate-bounce text-amber-400' : 'text-cyan-400'}`} />
                    <span>{testingConnection ? 'PINGING...' : 'TEST CONNECTION'}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-300 text-xs font-orbitron"
                    >
                      CANCEL
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-black text-xs font-orbitron font-bold shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                    >
                      SAVE PROVIDER
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

