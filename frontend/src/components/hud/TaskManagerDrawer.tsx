"use client";

import React, { useState, useEffect } from 'react';
import { Task, Note, getTasks, createTask, toggleTask, deleteTask, getNotes, createNote } from '@/lib/api';
import { CheckSquare, Square, Trash2, Plus, AlertCircle, FileText, Calendar, Tag, ChevronRight, X } from 'lucide-react';

interface TaskManagerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  refreshTrigger?: number;
}

export const TaskManagerDrawer: React.FC<TaskManagerDrawerProps> = ({ isOpen, onClose, refreshTrigger }) => {
  const [activeTab, setActiveTab] = useState<'tasks' | 'notes'>('tasks');
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);

  // New task form state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState<'P1' | 'P2' | 'P3' | 'P4'>('P2');
  const [newDueDate, setNewDueDate] = useState('');

  // New note form state
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, refreshTrigger]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tData, nData] = await Promise.all([getTasks(), getNotes()]);
      setTasks(tData);
      setNotes(nData);
    } catch (err) {
      console.error("Failed to load tasks/notes:", err);
      setError(err instanceof Error ? err.message : 'Operation failed. Please try again.');
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      const created = await createTask({
        title: newTitle,
        description: newDesc || undefined,
        priority: newPriority,
        due_date: newDueDate ? new Date(newDueDate).toISOString() : undefined
      });
      setTasks([created, ...tasks]);
      setNewTitle('');
      setNewDesc('');
      setNewDueDate('');
    } catch (err) {
      console.error("Failed to create task", err);
      setError(err instanceof Error ? err.message : 'Operation failed. Please try again.');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleToggleTask = async (task: Task) => {
    try {
      const updated = await toggleTask(task.id, !task.completed);
      setTasks(tasks.map(t => t.id === task.id ? updated : t));
    } catch (err) {
      console.error("Failed to toggle task", err);
      setError(err instanceof Error ? err.message : 'Operation failed. Please try again.');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleDeleteTask = async (id: number) => {
    if (!window.confirm('Delete this task? This cannot be undone.')) return;
    try {
      await deleteTask(id);
      setTasks(tasks.filter(t => t.id !== id));
    } catch (err) {
      console.error("Failed to delete task", err);
      setError(err instanceof Error ? err.message : 'Operation failed. Please try again.');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() || !noteContent.trim()) return;
    try {
      const created = await createNote({ title: noteTitle, content: noteContent });
      setNotes([created, ...notes]);
      setNoteTitle('');
      setNoteContent('');
    } catch (err) {
      console.error("Failed to create note", err);
      setError(err instanceof Error ? err.message : 'Operation failed. Please try again.');
      setTimeout(() => setError(null), 5000);
    }
  };

  if (!isOpen) return null;

  const priorityColors = {
    P1: 'bg-red-950/60 border-red-500/60 text-red-300',
    P2: 'bg-amber-950/60 border-amber-500/60 text-amber-300',
    P3: 'bg-cyan-950/60 border-cyan-500/60 text-cyan-300',
    P4: 'bg-blue-950/60 border-blue-500/60 text-blue-300',
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="relative z-10 w-full max-w-md h-full bg-[#020c1b]/95 border-l border-cyan-500/40 p-6 flex flex-col justify-between shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-xl animate-in slide-in-from-right duration-200 text-cyan-200">
        
        {/* Header */}
        <div>
          <div className="flex items-center justify-between border-b border-cyan-900/60 pb-4 mb-4">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-cyan-400 animate-pulse" />
              <span className="font-orbitron font-bold text-cyan-100 tracking-wider text-sm">
                TASK MATRIX & CAPTURE
              </span>
            </div>
            <button onClick={onClose} aria-label="Close" className="p-1 rounded-md text-cyan-400 hover:text-cyan-100 hover:bg-cyan-950/60 transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-2 mb-4 bg-cyan-950/40 p-1 rounded-lg border border-cyan-900/60">
            <button
              onClick={() => setActiveTab('tasks')}
              className={`flex-1 py-1.5 text-xs font-orbitron font-bold rounded-md transition-all flex items-center justify-center gap-2 ${
                activeTab === 'tasks' ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/50 shadow-[0_0_10px_rgba(6,182,212,0.2)]' : 'text-cyan-500 hover:text-cyan-300'
              }`}
            >
              <CheckSquare size={14} />
              <span>TASKS ({tasks.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`flex-1 py-1.5 text-xs font-orbitron font-bold rounded-md transition-all flex items-center justify-center gap-2 ${
                activeTab === 'notes' ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/50 shadow-[0_0_10px_rgba(6,182,212,0.2)]' : 'text-cyan-500 hover:text-cyan-300'
              }`}
            >
              <FileText size={14} />
              <span>QUICK NOTES ({notes.length})</span>
            </button>
          </div>

          {error && (
            <div className="mx-5 mt-3 px-4 py-2.5 bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-mono rounded-lg flex items-center gap-2">
              <span className="text-red-400">⚠</span>
              <span>{error}</span>
            </div>
          )}

          {/* Content Area */}
          {activeTab === 'tasks' ? (
            <div className="space-y-4">
              {/* Add Task Form */}
              <form onSubmit={handleCreateTask} className="p-3 bg-cyan-950/30 border border-cyan-800/40 rounded-lg space-y-2">
                <input
                  id="task-title-input"
                  name="task_title"
                  type="text"
                  autoComplete="off"
                  placeholder="New task title..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-[#03152c] border border-cyan-800/60 rounded px-3 py-1.5 text-xs text-cyan-100 placeholder-cyan-600 focus:outline-none focus:border-cyan-400"
                />
                <div className="flex gap-2">
                  <select
                    value={newPriority}
                    onChange={(e: any) => setNewPriority(e.target.value)}
                    className="bg-[#03152c] border border-cyan-800/60 rounded px-2 py-1 text-xs text-cyan-300 focus:outline-none font-orbitron"
                  >
                    <option value="P1">P1 - Urgent</option>
                    <option value="P2">P2 - High</option>
                    <option value="P3">P3 - Medium</option>
                    <option value="P4">P4 - Low</option>
                  </select>
                  <input
                    id="task-duedate-input"
                    name="task_due_date"
                    type="date"
                    autoComplete="off"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="flex-1 bg-[#03152c] border border-cyan-800/60 rounded px-2 py-1 text-xs text-cyan-300 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1 bg-cyan-600/30 hover:bg-cyan-500/40 border border-cyan-400/60 text-cyan-100 rounded text-xs font-orbitron font-bold flex items-center gap-1 transition-all"
                  >
                    <Plus size={14} /> ADD
                  </button>
                </div>
              </form>

              {/* Task List */}
              <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {tasks.length === 0 ? (
                  <div className="text-center py-8 text-cyan-600 text-xs font-orbitron">NO ACTIVE TASKS IN MATRIX</div>
                ) : (
                  tasks.map((task) => (
                    <div
                      key={task.id}
                      className={`p-3 rounded-lg border flex items-start justify-between gap-3 transition-all ${
                        task.completed ? 'bg-cyan-950/10 border-cyan-900/30 opacity-50' : 'bg-cyan-950/40 border-cyan-800/50 hover:border-cyan-500/50'
                      }`}
                    >
                      <button onClick={() => handleToggleTask(task)} aria-label="Toggle task" className="mt-0.5 text-cyan-400 hover:text-cyan-200 transition-colors">
                        {task.completed ? <CheckSquare size={16} className="text-cyan-400" /> : <Square size={16} />}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className={`text-xs font-semibold ${task.completed ? 'line-through text-cyan-500' : 'text-cyan-100'}`}>
                          {task.title}
                        </div>
                        {task.description && <div className="text-[11px] text-cyan-400/70 mt-0.5">{task.description}</div>}
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`px-1.5 py-0.5 text-[9px] font-orbitron font-bold rounded border ${priorityColors[task.priority]}`}>
                            {task.priority}
                          </span>
                          {task.due_date && (
                            <span className="text-[10px] text-cyan-500 flex items-center gap-1">
                              <Calendar size={10} />
                              {new Date(task.due_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>

                      <button onClick={() => handleDeleteTask(task.id)} aria-label="Delete task" className="text-cyan-700 hover:text-red-400 transition-colors p-1">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Add Note Form */}
              <form onSubmit={handleCreateNote} className="p-3 bg-cyan-950/30 border border-cyan-800/40 rounded-lg space-y-2">
                <input
                  id="note-title-input"
                  name="note_title"
                  type="text"
                  autoComplete="off"
                  placeholder="Note Title..."
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="w-full bg-[#03152c] border border-cyan-800/60 rounded px-3 py-1.5 text-xs text-cyan-100 placeholder-cyan-600 focus:outline-none focus:border-cyan-400"
                />
                <textarea
                  placeholder="Quick capture details..."
                  rows={3}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  className="w-full bg-[#03152c] border border-cyan-800/60 rounded px-3 py-1.5 text-xs text-cyan-100 placeholder-cyan-600 focus:outline-none focus:border-cyan-400 resize-none"
                />
                <button
                  type="submit"
                  className="w-full py-1.5 bg-cyan-600/30 hover:bg-cyan-500/40 border border-cyan-400/60 text-cyan-100 rounded text-xs font-orbitron font-bold flex items-center justify-center gap-1 transition-all"
                >
                  <Plus size={14} /> CAPTURE NOTE
                </button>
              </form>

              {/* Notes List */}
              <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {notes.length === 0 ? (
                  <div className="text-center py-8 text-cyan-600 text-xs font-orbitron">NO CAPTURED NOTES</div>
                ) : (
                  notes.map((note) => (
                    <div key={note.id} className="p-3 rounded-lg bg-cyan-950/40 border border-cyan-800/50 space-y-1">
                      <div className="font-bold text-xs text-cyan-100">{note.title}</div>
                      <div className="text-xs text-cyan-300/80 whitespace-pre-wrap">{note.content}</div>
                      <div className="text-[10px] text-cyan-500 pt-1">{new Date(note.created_at).toLocaleString()}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-cyan-900/60 text-center text-[10px] font-orbitron text-cyan-600">
          ROCKY PERSONAL PRODUCTIVITY MATRIX v1.0
        </div>

      </div>
    </div>
  );
};
