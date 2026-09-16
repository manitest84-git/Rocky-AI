"use client";

import React, { useState, useEffect } from 'react';
import {
  VaultItem, BackupItem, BackupResponse,
  getVaultItems, createVaultItem, deleteVaultItem,
  getAdminBackups, triggerAdminBackup
} from '@/lib/api';
import { Shield, Lock, HardDrive, Eye, EyeOff, Plus, Trash2, Database, AlertCircle, CheckCircle2, RefreshCw, X } from 'lucide-react';

interface VaultBackupDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VaultBackupDrawer: React.FC<VaultBackupDrawerProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'vault' | 'backups'>('vault');
  const [error, setError] = useState<string | null>(null);
  
  // Vault state
  const [vaultItems, setVaultItems] = useState<VaultItem[]>([]);
  const [category, setCategory] = useState('Password');
  const [secretValue, setSecretValue] = useState('');
  const [notes, setNotes] = useState('');
  const [showSecretMap, setShowSecretMap] = useState<Record<number, boolean>>({});

  // Backup state
  const [backupData, setBackupData] = useState<BackupResponse | null>(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      const vData = await getVaultItems();
      setVaultItems(vData);
      const bData = await getAdminBackups().catch(() => null);
      setBackupData(bData);
    } catch (err) {
      console.error("Failed to load vault/backup data:", err);
      setError(err instanceof Error ? err.message : 'Operation failed.');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleCreateVaultItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretValue.trim()) return;

    try {
      const created = await createVaultItem(category, secretValue, notes);
      setVaultItems([created, ...vaultItems]);
      setSecretValue('');
      setNotes('');
    } catch (err) {
      console.error("Vault create error:", err);
      setError(err instanceof Error ? err.message : 'Operation failed.');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleDeleteVaultItem = async (id: number) => {
    if (!window.confirm('Permanently delete this vault secret? This cannot be undone.')) return;
    try {
      await deleteVaultItem(id);
      setVaultItems(vaultItems.filter(v => v.id !== id));
    } catch (err) {
      console.error("Vault delete error:", err);
      setError(err instanceof Error ? err.message : 'Operation failed.');
      setTimeout(() => setError(null), 5000);
    }
  };

  const toggleShowSecret = (id: number) => {
    setShowSecretMap(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleTriggerBackup = async () => {
    setBackupLoading(true);
    setNotice(null);
    try {
      const res = await triggerAdminBackup();
      setNotice(`Backup ${res.filename} (${(res.size / 1024).toFixed(1)} KB) created successfully!`);
      const updated = await getAdminBackups();
      setBackupData(updated);
    } catch (err: any) {
      console.error("Manual backup error:", err);
      setNotice(err.message || "Failed to trigger backup.");
      setError(err instanceof Error ? err.message : 'Operation failed.');
      setTimeout(() => setError(null), 5000);
    } finally {
      setBackupLoading(false);
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
              <Shield className="w-5 h-5 text-cyan-400 animate-pulse" />
              <span className="font-orbitron font-bold text-cyan-100 tracking-wider text-sm">
                CRITICAL VAULT & BACKUP ENGINE
              </span>
            </div>
            <button onClick={onClose} aria-label="Close" className="p-1 rounded-md text-cyan-400 hover:text-cyan-100 hover:bg-cyan-950/60 transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-2 mb-4 bg-cyan-950/40 p-1 rounded-lg border border-cyan-900/60">
            <button
              onClick={() => setActiveTab('vault')}
              className={`flex-1 py-1.5 text-[11px] font-orbitron font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'vault' ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/50 shadow-[0_0_10px_rgba(6,182,212,0.2)]' : 'text-cyan-500 hover:text-cyan-300'
              }`}
            >
              <Lock size={14} />
              <span>AES-256 VAULT ({vaultItems.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('backups')}
              className={`flex-1 py-1.5 text-[11px] font-orbitron font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'backups' ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/50 shadow-[0_0_10px_rgba(6,182,212,0.2)]' : 'text-cyan-500 hover:text-cyan-300'
              }`}
            >
              <Database size={14} />
              <span>DATABASE BACKUPS</span>
            </button>
          </div>

          {error && (
            <div className="mx-5 mb-4 px-4 py-2.5 bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-mono rounded-lg flex items-center gap-2">
              <span className="text-red-400">⚠</span>
              <span>{error}</span>
            </div>
          )}

          {/* AES-256 Vault Tab */}
          {activeTab === 'vault' && (
            <div className="space-y-4">
              {/* Add Vault Secret Form */}
              <form onSubmit={handleCreateVaultItem} className="p-3 bg-cyan-950/30 border border-cyan-800/40 rounded-lg space-y-2">
                <div className="flex gap-2">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="bg-[#03152c] border border-cyan-800/60 rounded px-2 py-1 text-xs text-cyan-300 focus:outline-none font-orbitron"
                  >
                    <option value="Password">Password</option>
                    <option value="API Key">API Key</option>
                    <option value="Identity Doc">Identity Doc</option>
                    <option value="Secure Note">Secure Note</option>
                  </select>
                  <input
                    id="vault-secret-value"
                    name="vault_secret"
                    type="password"
                    autoComplete="new-password"
                    required
                    placeholder="Sensitive Value / Key..."
                    value={secretValue}
                    onChange={(e) => setSecretValue(e.target.value)}
                    className="flex-1 bg-[#03152c] border border-cyan-800/60 rounded px-3 py-1.5 text-xs text-cyan-100 placeholder-cyan-600 focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    id="vault-notes"
                    name="vault_notes"
                    type="text"
                    autoComplete="off"
                    placeholder="Description / Account Name (Optional)..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="flex-1 bg-[#03152c] border border-cyan-800/60 rounded px-3 py-1 text-xs text-cyan-100 placeholder-cyan-600 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1 bg-cyan-600/30 hover:bg-cyan-500/40 border border-cyan-400/60 text-cyan-100 rounded text-xs font-orbitron font-bold flex items-center gap-1 transition-all"
                  >
                    <Plus size={14} /> ENCRYPT & SAVE
                  </button>
                </div>
              </form>

              {/* Vault Items List */}
              <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {vaultItems.length === 0 ? (
                  <div className="text-center py-8 text-cyan-600 text-xs font-orbitron">VAULT SECURE & EMPTY</div>
                ) : (
                  vaultItems.map((item) => (
                    <div key={item.id} className="p-3 rounded-lg bg-cyan-950/40 border border-cyan-800/50 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 text-[9px] font-orbitron font-bold rounded border border-cyan-500/40 bg-cyan-950/60 text-cyan-300">
                            {item.data_category}
                          </span>
                          {item.notes && <span className="text-xs font-bold text-cyan-100 truncate">{item.notes}</span>}
                        </div>

                        <div className="text-xs font-mono text-cyan-300/90 mt-1 flex items-center gap-2">
                          <span>
                            {showSecretMap[item.id] ? (item.decrypted_value || '***') : '••••••••••••••••'}
                          </span>
                          <button onClick={() => toggleShowSecret(item.id)} aria-label="Toggle visibility" className="text-cyan-500 hover:text-cyan-200">
                            {showSecretMap[item.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </div>

                      <button onClick={() => handleDeleteVaultItem(item.id)} aria-label="Delete vault item" className="text-cyan-700 hover:text-red-400 transition-colors p-1">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Database Backups Tab */}
          {activeTab === 'backups' && (
            <div className="space-y-4">
              {/* Liveness Banner */}
              {backupData?.liveness && (
                <div className={`p-3 rounded-lg border text-xs flex items-center gap-2.5 ${
                  backupData.liveness.status === 'healthy' ? 'bg-cyan-950/60 border-cyan-500/60 text-cyan-200' : 'bg-amber-950/60 border-amber-500/60 text-amber-200'
                }`}>
                  {backupData.liveness.status === 'healthy' ? (
                    <CheckCircle2 size={18} className="text-cyan-400 shrink-0" />
                  ) : (
                    <AlertCircle size={18} className="text-amber-400 shrink-0" />
                  )}
                  <div>
                    <div className="font-orbitron font-bold uppercase">
                      BACKUP ENGINE STATUS: {backupData.liveness.status.toUpperCase()}
                    </div>
                    {backupData.liveness.latest && (
                      <div className="text-[10px] text-cyan-400 mt-0.5">
                        Latest Snapshot: {backupData.liveness.latest.filename} ({backupData.liveness.latest.age_days} days old)
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Manual Backup Trigger Button */}
              <button
                onClick={handleTriggerBackup}
                disabled={backupLoading}
                className="w-full py-2 bg-cyan-600/30 hover:bg-cyan-500/40 border border-cyan-400/60 text-cyan-100 rounded text-xs font-orbitron font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <RefreshCw size={16} className={`text-cyan-400 ${backupLoading ? 'animate-spin' : ''}`} />
                {backupLoading ? 'CREATING BACKUP SNAPSHOT...' : 'TRIGGER INSTANT SNAPSHOT BACKUP'}
              </button>

              {notice && (
                <div className="p-2.5 rounded bg-cyan-950/50 border border-cyan-500/50 text-xs text-cyan-200 font-mono">
                  {notice}
                </div>
              )}

              {/* Backup History Table */}
              <div className="max-h-[45vh] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                <div className="text-[10px] font-orbitron text-cyan-500 uppercase tracking-widest mb-1">
                  SNAPSHOT HISTORY ({backupData?.history?.length || 0})
                </div>
                {!backupData?.history || backupData.history.length === 0 ? (
                  <div className="text-center py-8 text-cyan-600 text-xs font-orbitron">NO BACKUP SNAPSHOTS FOUND</div>
                ) : (
                  backupData.history.map((b, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-cyan-950/40 border border-cyan-800/50 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-xs text-cyan-100 font-mono">{b.filename}</div>
                        <div className="text-[10px] text-cyan-500">{b.created_at}</div>
                      </div>
                      <div className="text-right font-orbitron text-xs text-cyan-300">
                        {(b.size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-cyan-900/60 text-center text-[10px] font-orbitron text-cyan-600">
          ROCKY SECURITY & BACKUP ENGINE v4.0
        </div>

      </div>
    </div>
  );
};
