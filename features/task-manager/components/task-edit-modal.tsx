'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { type Task, type Label, type ActivityLog, type Subtask, type Comment, PRIORITY_CONFIG } from '../types';
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

function AddSubtaskInput({ onAdd }: { onAdd: (title: string) => Promise<void> }) {
  const [text, setText] = useState('');
  const [adding, setAdding] = useState(false);

  const submit = async () => {
    if (!text.trim()) return;
    setAdding(true);
    await onAdd(text.trim());
    setText('');
    setAdding(false);
  };

  return (
    <div className="flex gap-2 mt-2">
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
        placeholder="Add a subtask..."
        className="flex-1 px-2 py-1 text-xs rounded-md bg-background border border-border outline-none focus:border-primary transition-colors"
      />
      <button
        type="button"
        disabled={!text.trim() || adding}
        onClick={submit}
        className="px-2 py-1 text-xs rounded-md bg-primary text-primary-foreground disabled:opacity-50 hover:opacity-90 transition-opacity"
      >
        Add
      </button>
    </div>
  );
}

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

function CommentInput({ onAdd }: { onAdd: (text: string) => Promise<void> }) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!text.trim()) return;
    setSaving(true);
    await onAdd(text.trim());
    setText('');
    setSaving(false);
  };

  return (
    <div className="flex gap-2">
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
        placeholder="Write a comment… (Enter to send)"
        rows={2}
        className="flex-1 px-3 py-2 text-xs rounded-lg bg-background border border-border outline-none focus:border-primary transition-colors resize-none"
      />
      <button
        type="button"
        disabled={!text.trim() || saving}
        onClick={submit}
        className="px-3 py-2 text-xs rounded-lg bg-primary text-primary-foreground disabled:opacity-50 hover:opacity-90 transition-opacity self-end"
      >
        Send
      </button>
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
  subtasks?: Subtask[];
  onCreateSubtask?: (title: string) => Promise<void>;
  onToggleSubtask?: (id: number, completed: boolean) => Promise<void>;
  onDeleteSubtask?: (id: number) => Promise<void>;
  comments?: Comment[];
  onAddComment?: (text: string) => Promise<void>;
  onDeleteComment?: (id: number) => Promise<void>;
}

export function TaskEditModal({ task, onSave, onClose, labels = [], onAddLabel, onRemoveLabel, onCreateLabel, activity, activityLoading, subtasks = [], onCreateSubtask, onToggleSubtask, onDeleteSubtask, comments = [], onAddComment, onDeleteComment }: Props) {
  const [title, setTitle]             = useState(task.title);
  const [description, setDesc]        = useState(task.description ?? '');
  const [priority, setPriority]       = useState(task.priority);
  const [dueDate, setDueDate]         = useState(task.due_date ?? '');
  const [recurrence, setRecurrence]   = useState<'daily' | 'weekly' | 'monthly' | null>(task.recurrence ?? null);
  const [saving, setSaving]           = useState(false);
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
    if (recurrence !== (task.recurrence ?? null)) changes.recurrence = recurrence;

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

          {/* Recurrence */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-muted-foreground w-20 shrink-0">Repeat</label>
            <select
              value={recurrence ?? ''}
              onChange={e => setRecurrence((e.target.value || null) as 'daily' | 'weekly' | 'monthly' | null)}
              className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary transition-colors"
            >
              <option value="">Never</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          {/* Subtasks */}
          {(onCreateSubtask || onToggleSubtask || onDeleteSubtask) && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Checklist
                  {subtasks.length > 0 && (
                    <span className="ml-1 text-muted-foreground/60">
                      ({subtasks.filter(s => s.completed).length}/{subtasks.length})
                    </span>
                  )}
                </label>
              </div>

              {/* Progress bar */}
              {subtasks.length > 0 && (
                <div className="w-full h-1.5 bg-muted rounded-full mb-3 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${Math.round((subtasks.filter(s => s.completed).length / subtasks.length) * 100)}%` }}
                  />
                </div>
              )}

              {/* Subtask list */}
              <div className="space-y-1.5">
                {subtasks.map(s => (
                  <div key={s.id} className="flex items-center gap-2 group">
                    <button
                      type="button"
                      onClick={() => onToggleSubtask && onToggleSubtask(s.id, !s.completed)}
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                        s.completed ? 'bg-primary border-primary' : 'border-border hover:border-primary/50'
                      }`}
                    >
                      {s.completed && <span className="text-primary-foreground text-[10px] leading-none">✓</span>}
                    </button>
                    <span className={`flex-1 text-sm ${s.completed ? 'line-through text-muted-foreground' : ''}`}>
                      {s.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => onDeleteSubtask && onDeleteSubtask(s.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {/* Add subtask input */}
              {onCreateSubtask && <AddSubtaskInput onAdd={onCreateSubtask} />}
            </div>
          )}

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

        {/* Comments */}
        {(onAddComment || onDeleteComment || comments.length > 0) && (
          <div className="border-t border-border pt-4 mt-2 px-6">
            <p className="text-xs font-medium text-muted-foreground mb-3">
              Comments {comments.length > 0 && <span className="text-muted-foreground/60">({comments.length})</span>}
            </p>

            {/* Comment list */}
            <div className="space-y-3 mb-3 max-h-48 overflow-y-auto">
              {comments.map(c => (
                <div key={c.id} className="flex gap-2 group">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-semibold text-primary">U</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground/90 break-words">{c.text}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground/60">
                        {new Date(c.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {onDeleteComment && (
                        <button
                          type="button"
                          onClick={() => onDeleteComment(c.id)}
                          className="text-[10px] text-muted-foreground/40 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                        >
                          delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {comments.length === 0 && (
                <p className="text-xs text-muted-foreground/50 italic">No comments yet.</p>
              )}
            </div>

            {/* Add comment */}
            {onAddComment && <CommentInput onAdd={onAddComment} />}
          </div>
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
