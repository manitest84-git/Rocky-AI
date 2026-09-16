"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAdminUsers, createAdminUser, deleteAdminUser, resetUserPassword } from '@/lib/api';
import { Users, UserPlus, Trash2, Key, X, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ isOpen, onClose }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  
  // Password reset modal state
  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [resetUsername, setResetUsername] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchUsers = async () => {
    try {
      const data = await getAdminUsers();
      setUsers(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      await createAdminUser(username, password, role);
      setSuccess(`User "${username}" created successfully.`);
      setUsername('');
      setPassword('');
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (userId: number, uname: string) => {
    if (!confirm(`Are you sure you want to delete user "${uname}"?`)) return;

    setError(null);
    setSuccess(null);

    try {
      await deleteAdminUser(userId);
      setSuccess(`User "${uname}" removed.`);
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUserId || !newPassword) return;

    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      await resetUserPassword(resetUserId, newPassword);
      setSuccess(`Password for user "${resetUsername}" has been updated.`);
      setResetUserId(null);
      setNewPassword('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020813]/85 backdrop-blur-md p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-2xl bg-[#020813] border border-cyan-500/50 rounded-xl p-6 shadow-[0_0_40px_rgba(0,240,255,0.25)] font-mono text-cyan-300 max-h-[90vh] flex flex-col"
        >
          {/* Corner Brackets */}
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-400" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-400" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-400" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-400" />

          {/* Header */}
          <div className="flex items-center justify-between border-b border-cyan-900/60 pb-4 mb-4">
            <div className="flex items-center gap-3">
              <Users className="text-cyan-400" size={24} />
              <div>
                <h2 className="text-lg font-orbitron tracking-widest text-cyan-300 uppercase">User Administration</h2>
                <p className="text-[10px] text-cyan-700 uppercase tracking-wider">Access Rights & Credential Governance</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-cyan-600 hover:text-cyan-300 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Messages */}
          {error && (
            <div className="mb-4 p-3 rounded bg-red-950/40 border border-red-500/50 text-red-300 text-xs flex items-center gap-2">
              <ShieldAlert size={16} className="shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 rounded bg-cyan-950/40 border border-cyan-500/50 text-cyan-300 text-xs flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0 text-cyan-400" />
              <span>{success}</span>
            </div>
          )}

          {/* Reset Password Inline Form */}
          {resetUserId && (
            <div className="mb-4 p-4 rounded-lg bg-amber-950/40 border border-amber-500/50 text-amber-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-orbitron font-bold flex items-center gap-2 text-amber-400">
                  <Key size={16} /> RESET PASSWORD FOR USER: {resetUsername}
                </span>
                <button onClick={() => setResetUserId(null)} className="text-amber-500 hover:text-amber-200">
                  <X size={16} />
                </button>
              </div>
              <form onSubmit={handleResetPassword} className="flex gap-2">
                <input
                  id="admin-reset-password"
                  name="new_password"
                  type="password"
                  autoComplete="new-password"
                  required
                  placeholder="Enter new strong password..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="flex-1 bg-[#020813] border border-amber-900 rounded py-1.5 px-3 text-xs text-amber-200 placeholder-amber-700 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="py-1.5 px-4 rounded border border-amber-500 bg-amber-950 hover:bg-amber-900 text-xs font-orbitron text-amber-200 tracking-wider disabled:opacity-50"
                >
                  Save Password
                </button>
              </form>
            </div>
          )}

          <div className="flex-1 overflow-y-auto space-y-6 pr-2">
            {/* Create New User Section */}
            <div className="border border-cyan-900/40 rounded-lg p-4 bg-[#050e1a]/50">
              <h3 className="text-xs font-orbitron uppercase tracking-widest text-cyan-400 mb-3 flex items-center gap-2">
                <UserPlus size={16} /> Create User Account
              </h3>
              <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  id="admin-new-username"
                  name="new_username"
                  type="text"
                  autoComplete="off"
                  required
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="bg-[#020813] border border-cyan-900 rounded py-1.5 px-3 text-xs text-cyan-300 placeholder-cyan-900 focus:outline-none focus:border-cyan-400"
                />
                <input
                  id="admin-new-password"
                  name="new_password"
                  type="password"
                  autoComplete="new-password"
                  required
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-[#020813] border border-cyan-900 rounded py-1.5 px-3 text-xs text-cyan-300 placeholder-cyan-900 focus:outline-none focus:border-cyan-400"
                />
                <div className="flex items-center gap-2">
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="bg-[#020813] border border-cyan-900 rounded py-1.5 px-2 text-xs text-cyan-300 focus:outline-none focus:border-cyan-400 flex-1"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="py-1.5 px-4 rounded border border-cyan-500 bg-cyan-950 hover:bg-cyan-900 text-xs font-orbitron text-cyan-300 tracking-wider disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </form>
            </div>

            {/* Existing Users Table */}
            <div>
              <h3 className="text-xs font-orbitron uppercase tracking-widest text-cyan-400 mb-3">
                Active System Credentials ({users.length})
              </h3>
              <div className="border border-cyan-900/40 rounded-lg overflow-hidden bg-[#050e1a]/30">
                <table className="w-full text-left text-xs">
                  <thead className="bg-cyan-950/40 text-cyan-500 border-b border-cyan-900/40 uppercase tracking-widest text-[10px]">
                    <tr>
                      <th className="p-3">ID</th>
                      <th className="p-3">Username</th>
                      <th className="p-3">Role</th>
                      <th className="p-3">Created</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyan-900/20">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-cyan-950/20">
                        <td className="p-3 text-cyan-700">#{u.id}</td>
                        <td className="p-3 text-cyan-300 font-bold">{u.username}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] tracking-wider uppercase border ${
                            u.role === 'admin' ? 'border-amber-500/50 bg-amber-950/30 text-amber-300' : 'border-cyan-500/50 bg-cyan-950/30 text-cyan-300'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="p-3 text-cyan-700">{new Date(u.created_at).toLocaleDateString()}</td>
                        <td className="p-3 text-right space-x-2">
                          <button
                            onClick={() => {
                              setResetUserId(u.id);
                              setResetUsername(u.username);
                              setNewPassword('');
                              setError(null);
                              setSuccess(null);
                            }}
                            className="text-amber-400 hover:text-amber-200 p-1 transition-colors"
                            title="Reset user password"
                          >
                            <Key size={16} />
                          </button>

                          {u.username !== 'admin' && (
                            <button
                              onClick={() => handleDeleteUser(u.id, u.username)}
                              className="text-red-500 hover:text-red-300 p-1 transition-colors"
                              title="Delete user"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
