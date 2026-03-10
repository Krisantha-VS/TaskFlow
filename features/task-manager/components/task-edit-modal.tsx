'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { type Task, type Label, type ActivityLog, PRIORITY_CONFIG } from '../types';
import { cn } from '@/lib/utils';
import { LabelPill } from '@/components/label-pill';
import { ActivityFeed } from '@/components/activity-feed';

const COLORS = ['blue','green','red','yellow','purple','pink','orange','gray'] as const;

const COLOR_DOT: Record<string, string> = {
  blue:   'bg-blue-500',
  green:  'bg-green-500',
  red:    'bg-red-500',
  yellow: 'bg-yellow-500',
  purple: 'bg-purple-500',
  pink:   'bg-pink-500',
  orange: 'bg-orange-500',
  gray:   'bg-gray-500',
};

function NewLabelForm({ onCreateLabel }: { onCreateLabel: (name: string, color: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>('blue');
  const [saving, setSaving] = useState(false);

  if (!open) return (
    <button type="button" onClick={() => setOpen(true)} className="mt-2 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors">
      + New label
    </button>
  );

  return (
    <div className="mt-2 flex items-center gap-2 flex-wrap">
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Label name"
        className="flex-1 min-w-0 px-2 py-1 text-xs rounded-md bg-background border border-border outline-none focus:border-primary"
      />
      <div className="flex gap-1">
        {COLORS.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            className={`w-4 h-4 rounded-full ${COLOR_DOT[c]} ring-2 ring-offset-1 ring-offset-background transition-all ${color === c ? 'ring-white' : 'ring-transparent'}`}
          />
        ))}
      </div>
      <button
        type="button"
        disabled={!name.trim() || saving}
        onClick={async () => {
          setSaving(true);
          await onCreateLabel(name.trim(), color);
          setName(''); setOpen(false); setSaving(false);
        }}
        className="text-xs px-2 py-1 rounded-md bg-primary text-primary-foreground disabled:opacity-50"
      >
        Add
      </button>
      <button type="button" onClick={() => { setOpen(false); setName(''); }} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
    </div>
  );
}

interface Props {
  task: Task;
  onSave: (id: number, data: Partial<Task>) => Promise<void>;
  onClose: () => void;
  labels?: Label[];
  onAddLabel?: (labelId: number) => void;
  onRemoveLabel?: (labelId: number) => void;
  onCreateLabel?: (name: string, color: string) => Promise<void>;
  activity?: ActivityLog[];
  activityLoading?: boolean;
}

export function TaskEditModal({ task, onSave, onClose, labels = [], onAddLabel, onRemoveLabel, onCreateLabel, activity, activityLoading }: Props) {
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

          {/* Labels */}
          {(onAddLabel || onRemoveLabel || onCreateLabel) && (
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-2">Labels</label>
              {/* Current labels on task */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(task.labels ?? []).map(l => (
                  <LabelPill key={l.id} name={l.name} color={l.color} onRemove={onRemoveLabel ? () => onRemoveLabel(l.id) : undefined} />
                ))}
              </div>
              {/* Available labels to add */}
              <div className="flex flex-wrap gap-1.5">
                {labels.filter(l => !(task.labels ?? []).find(tl => tl.id === l.id)).map(l => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => onAddLabel && onAddLabel(l.id)}
                    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    + {l.name}
                  </button>
                ))}
              </div>
              {/* Create new label inline */}
              {onCreateLabel && <NewLabelForm onCreateLabel={onCreateLabel} />}
            </div>
          )}
        </div>

        {/* Activity */}
        {activity !== undefined && (
          <details className="border-t border-border pt-4 mt-2 px-6">
            <summary className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none">
              Activity ({activity.length})
            </summary>
            <div className="mt-2 max-h-40 overflow-y-auto">
              <ActivityFeed logs={activity} loading={activityLoading} />
            </div>
          </details>
        )}

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
