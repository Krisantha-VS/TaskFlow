'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { type Task, PRIORITY_CONFIG } from '../types';
import { cn } from '@/lib/utils';

interface Props {
  task: Task;
  onSave: (id: number, data: Partial<Task>) => Promise<void>;
  onClose: () => void;
}

export function TaskEditModal({ task, onSave, onClose }: Props) {
  const [title, setTitle]       = useState(task.title);
  const [description, setDesc]  = useState(task.description ?? '');
  const [priority, setPriority] = useState(task.priority);
  const [dueDate, setDueDate]   = useState(task.due_date ?? '');
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null); // Fix K3

  const firstInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus first input on mount
  useEffect(() => { firstInputRef.current?.focus(); }, []);

  // Fix AC2: Escape to close + focus trap
  useEffect(() => {
    const modal = modalRef.current;

    const getFocusable = () =>
      Array.from(
        modal?.querySelectorAll<HTMLElement>(
          'input, textarea, select, button, [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter(el => !el.hasAttribute('disabled'));

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // Focus trap — Tab / Shift+Tab
      if (e.key === 'Tab') {
        const focusable = getFocusable();
        if (focusable.length === 0) { e.preventDefault(); return; }
        const first = focusable[0];
        const last  = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSave = async () => {
    if (!title.trim()) return;
    if (saving) return; // guard against double-submit
    setSaving(true);
    setSaveError(null);
    const changes: Partial<Task> = {};
    if (title.trim() !== task.title) changes.title = title.trim();
    // Fix T1: correctly handle description — '0' must not become null
    if (description !== (task.description ?? '')) {
      changes.description = description === '' ? null : description;
    }
    if (priority !== task.priority) changes.priority = priority;
    if (dueDate  !== (task.due_date ?? '')) changes.due_date = dueDate || null;

    // Fix K3: try/catch so saving spinner clears on error; don't close on failure
    try {
      if (Object.keys(changes).length > 0) await onSave(task.id, changes);
      onClose();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Fix AC2: role=dialog, aria-modal, aria-labelledby */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-task-title"
        className="glass border border-border rounded-2xl w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
          {/* Fix AC2: id for aria-labelledby */}
          <h2 id="edit-task-title" className="text-base font-semibold">Edit Task</h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Fields */}
        <div className="px-6 py-5 space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Title</label>
            <input
              ref={firstInputRef}
              value={title}
              onChange={e => setTitle(e.target.value)}
              // Fix K3: guard Enter key with saving state
              onKeyDown={e => { if (e.key === 'Enter' && !saving) handleSave(); }}
              placeholder="Task title"
              className="w-full bg-background/50 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/60 transition-colors placeholder:text-muted-foreground/50"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Description</label>
            <textarea
              value={description}
              onChange={e => setDesc(e.target.value)}
              placeholder="Add a description…"
              rows={4}
              className="w-full bg-background/50 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/60 transition-colors placeholder:text-muted-foreground/50 resize-none"
            />
          </div>

          {/* Priority + Due date row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Priority</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as Task['priority'])}
                className="w-full bg-background/50 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/60 transition-colors"
              >
                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full bg-background/50 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/60 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-5 space-y-3">
          {/* Fix K3: show save error above action buttons */}
          {saveError && (
            <p className="text-xs text-red-400 text-right">{saveError}</p>
          )}
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors px-4 py-2 rounded-lg hover:bg-muted/40"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className={cn(
                'text-sm font-medium px-5 py-2 rounded-lg transition-all',
                'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
