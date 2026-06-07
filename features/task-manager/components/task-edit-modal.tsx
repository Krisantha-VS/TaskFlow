'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { X, ChevronDown } from 'lucide-react';
import { useReducedMotion } from '@/lib/useMotion';
import { type Task, type Label, type ActivityLog, type Subtask, type Comment, PRIORITY_CONFIG } from '../types';
import { cn } from '@/lib/utils';
import { LabelPill } from '@/components/label-pill';
import { ActivityFeed } from '@/components/activity-feed';

const COLORS = ['blue','green','red','yellow','purple','pink','orange','gray'] as const;

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

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

function AddSubtaskInput({ onAdd }: { onAdd: (title: string) => Promise<unknown> }) {
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
        className="flex-1 px-2 py-1 text-xs rounded-md bg-input border border-border outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
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

function NewLabelForm({ onCreateLabel }: { onCreateLabel: (name: string, color: string) => Promise<unknown> }) {
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
        className="flex-1 min-w-0 px-2 py-1 text-xs rounded-md bg-input border border-border outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
      />
      <div className="flex gap-1">
        {COLORS.map(c => (
          <button
            key={c}
            type="button"
            aria-label={`Select ${c} color`}
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

function CommentInput({ onAdd }: { onAdd: (text: string) => Promise<unknown> }) {
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
        className="flex-1 px-3 py-2 text-xs rounded-lg bg-input border border-border outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors resize-none"
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
  onSave: (id: number, data: Partial<Task>) => Promise<unknown>;
  onClose: () => void;
  labels?: Label[];
  onAddLabel?: (labelId: number) => void;
  onRemoveLabel?: (labelId: number) => void;
  onCreateLabel?: (name: string, color: string) => Promise<unknown>;
  activity?: ActivityLog[];
  activityLoading?: boolean;
  subtasks?: Subtask[];
  onCreateSubtask?: (title: string) => Promise<unknown>;
  onToggleSubtask?: (id: number, completed: boolean) => Promise<unknown>;
  onDeleteSubtask?: (id: number) => Promise<unknown>;
  comments?: Comment[];
  onAddComment?: (text: string) => Promise<unknown>;
  onDeleteComment?: (id: number) => Promise<unknown>;
  allTasks?: { id: number; title: string; issue_number?: number }[];
  onAddDependency?: (blockerId: number, type?: string) => Promise<unknown>;
  onRemoveDependency?: (blockerId: number, type?: string) => Promise<unknown>;
}

function BlockerBadge({ dep, onRemove }: { dep: { id: number; blocker: { id: number; title: string; issue_number?: number } }; onRemove?: (blockerId: number) => void }) {
  return (
    <span className="badge-blocked inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full">
      🔒 #{dep.blocker.issue_number ?? dep.blocker.id} {dep.blocker.title}
      {onRemove && (
        <button type="button" onClick={() => onRemove(dep.blocker.id)} className="hover:opacity-70 ml-0.5">×</button>
      )}
    </span>
  );
}

export function TaskEditModal({ task, onSave, onClose, labels = [], onAddLabel, onRemoveLabel, onCreateLabel, activity, activityLoading, subtasks = [], onCreateSubtask, onToggleSubtask, onDeleteSubtask, comments = [], onAddComment, onDeleteComment, allTasks, onAddDependency, onRemoveDependency }: Props) {
  const [title, setTitle]             = useState(task.title);
  const [description, setDesc]        = useState(task.description ?? '');
  const [priority, setPriority]       = useState(task.priority);
  const [dueDate, setDueDate]         = useState(task.due_date ?? '');
  const [recurrence, setRecurrence]   = useState<'daily' | 'weekly' | 'monthly' | null>(task.recurrence ?? null);
  const [saving, setSaving]           = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null); // Fix K3
  const [subtasksOpen, setSubtasksOpen] = useState(false); // T2-3: collapsible
  const [blockersOpen, setBlockersOpen] = useState(false); // T2-3: collapsible, closed by default
  const reduceMotion = useReducedMotion();
  const motionDuration = reduceMotion ? 0 : 0.2;
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);

  const firstInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Sync fields if the task prop updates externally (e.g. label/subtask mutations refresh the task)
  // Only sync fields that are not currently being edited (i.e. when not saving)
  // Open subtasks if they exist when modal first loads or when subtasks arrive
  useEffect(() => {
    if (subtasks.length > 0) setSubtasksOpen(true);
  }, [subtasks.length]);

  useEffect(() => {
    if (saving) return;
    setTitle(task.title);
    setDesc(task.description ?? '');
    setPriority(task.priority);
    setDueDate(task.due_date ?? '');
    setRecurrence(task.recurrence ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.title, task.description, task.priority, task.due_date, task.recurrence]);

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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: motionDuration }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Fix AC2: role=dialog, aria-modal, aria-labelledby */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: motionDuration, ease: 'easeOut' }}
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-task-title"
        className="bg-background border border-border rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
          {/* Fix AC2: id for aria-labelledby */}
          <h2 id="edit-task-title" className="text-base font-semibold">Edit Task</h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Fields */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <label htmlFor="task-title-field" className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Title</label>
            <input
              id="task-title-field"
              ref={firstInputRef}
              value={title}
              onChange={e => setTitle(e.target.value)}
              // Fix K3: guard Enter key with saving state
              onKeyDown={e => { if (e.key === 'Enter' && !saving) handleSave(); }}
              placeholder="Task title"
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors placeholder:text-muted-foreground/50"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label htmlFor="task-desc-field" className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Description</label>
            <textarea
              id="task-desc-field"
              value={description}
              onChange={e => setDesc(e.target.value)}
              placeholder="Add a description…"
              rows={4}
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors placeholder:text-muted-foreground/50 resize-none"
            />
          </div>

          {/* Priority + Due date row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="task-priority-field" className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Priority</label>
              <select
                id="task-priority-field"
                value={priority}
                onChange={e => setPriority(e.target.value as Task['priority'])}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
              >
                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="task-due-field" className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Due Date</label>
              <input
                id="task-due-field"
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
              />
              {dueDate && new Date(dueDate) < new Date(new Date().toDateString()) && (
                <p className="text-xs text-red-400 font-medium">Past due</p>
              )}
            </div>
          </div>

          {/* Recurrence — T3-7: renamed + tooltip */}
          <div className="space-y-1.5">
            <label htmlFor="task-repeat-field" className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Recurring task</label>
            <select
              id="task-repeat-field"
              value={recurrence ?? ''}
              onChange={e => setRecurrence((e.target.value || null) as 'daily' | 'weekly' | 'monthly' | null)}
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
            >
              <option value="">Never</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            {recurrence && (
              <p className="text-xs text-muted-foreground/60">A new task will be created automatically on this schedule.</p>
            )}
          </div>

          {/* Zone 2 divider */}
          <div className="border-t border-border/50" />

          {/* T2-3: Labels first (before subtasks) — horizontal compact chips */}
          {(onAddLabel || onRemoveLabel || onCreateLabel) && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-2">Labels</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(task.labels ?? []).map(l => (
                  <LabelPill key={l.id} name={l.name} color={l.color} onRemove={onRemoveLabel ? () => onRemoveLabel(l.id) : undefined} />
                ))}
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
              {onCreateLabel && <NewLabelForm onCreateLabel={onCreateLabel} />}
            </div>
          )}

          {/* T2-3: Subtasks — collapsible, open if has subtasks */}
          {(onCreateSubtask || onToggleSubtask || onDeleteSubtask) && (
            <div>
              <button
                type="button"
                onClick={() => setSubtasksOpen(v => !v)}
                className="flex items-center gap-2 w-full text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider hover:text-foreground transition-colors mb-2"
              >
                <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', subtasksOpen && 'rotate-180')} aria-hidden="true" />
                Checklist
                {subtasks.length > 0 && (
                  <span className="normal-case tracking-normal font-normal text-muted-foreground/60">
                    ({subtasks.filter(s => s.completed).length}/{subtasks.length})
                  </span>
                )}
              </button>
              {subtasksOpen && (
                <>
                  {subtasks.length > 0 && (
                    <div className="w-full h-1.5 bg-muted rounded-full mb-3 overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${Math.round((subtasks.filter(s => s.completed).length / subtasks.length) * 100)}%` }}
                      />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    {subtasks.map(s => (
                      <div key={s.id} className="flex items-center gap-2 group">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={s.completed}
                          aria-label={`${s.title}, subtask`}
                          onClick={() => onToggleSubtask && onToggleSubtask(s.id, !s.completed)}
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                            s.completed ? 'bg-primary border-primary' : 'border-border hover:border-primary/50'
                          }`}
                        >
                          {s.completed && <span className="text-primary-foreground text-xs leading-none">✓</span>}
                        </button>
                        <span className={`flex-1 text-sm ${s.completed ? 'line-through text-muted-foreground' : ''}`}>
                          {s.title}
                        </span>
                        <button
                          type="button"
                          aria-label={`Delete subtask: ${s.title}`}
                          onClick={() => onDeleteSubtask && onDeleteSubtask(s.id)}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all text-xs"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  {onCreateSubtask && <AddSubtaskInput onAdd={onCreateSubtask} />}
                </>
              )}
            </div>
          )}

          {/* T2-3: Blockers — collapsible, closed by default */}
          {(onAddDependency || onRemoveDependency) && (
            <>
            <div>
              <button
                type="button"
                onClick={() => setBlockersOpen(v => !v)}
                className="flex items-center gap-2 w-full text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider hover:text-foreground transition-colors mb-2"
              >
                <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', blockersOpen && 'rotate-180')} aria-hidden="true" />
                Blocked by
                {(task.blockedBy ?? []).length > 0 && (
                  <span className="badge-blocked text-xs px-1.5 py-0.5 rounded-full normal-case tracking-normal font-normal">
                    {(task.blockedBy ?? []).length}
                  </span>
                )}
              </button>
              {blockersOpen && (
                <>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {(task.blockedBy ?? []).map(dep => (
                      <BlockerBadge key={dep.id} dep={dep} onRemove={onRemoveDependency} />
                    ))}
                    {(task.blockedBy ?? []).length === 0 && (
                      <p className="text-xs text-muted-foreground/50 italic">Nothing blocking this task.</p>
                    )}
                  </div>
                  {onAddDependency && (allTasks ?? []).filter(t => t.id !== task.id && !(task.blockedBy ?? []).find(d => d.blockerId === t.id)).length > 0 && (
                    <select
                      defaultValue=""
                      onChange={async e => {
                        if (!e.target.value) return;
                        const result = await onAddDependency(parseInt(e.target.value)) as { error?: string | null } | void;
                        if (result?.error) { setSaveError(result.error); return; }
                        e.target.value = '';
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-input border border-border text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
                    >
                      <option value="">+ Add blocker…</option>
                      {(allTasks ?? [])
                        .filter(t => t.id !== task.id && !(task.blockedBy ?? []).find(d => d.blockerId === t.id))
                        .map(t => <option key={t.id} value={t.id}>#{t.issue_number ?? t.id} {t.title}</option>)
                      }
                    </select>
                  )}
                </>
              )}
            </div>

            {/* Blocks (what this task blocks) — T3-9 */}
            <div>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('blocks-section-toggle');
                  const section = document.getElementById('blocks-section');
                  if (!el || !section) return;
                  const open = section.style.display !== 'none';
                  section.style.display = open ? 'none' : 'block';
                  el.setAttribute('aria-expanded', String(!open));
                }}
                id="blocks-section-toggle"
                aria-expanded="false"
                className="flex items-center gap-2 w-full text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider hover:text-foreground transition-colors mb-2"
              >
                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                Blocks
                {(task.blocking ?? []).length > 0 && (
                  <span className="badge-info text-xs px-1.5 py-0.5 rounded-full normal-case tracking-normal font-normal">
                    {(task.blocking ?? []).length}
                  </span>
                )}
              </button>
              <div id="blocks-section" style={{ display: 'none' }}>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {(task.blocking ?? []).map(dep => (
                    <span key={dep.id} className="badge-info inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full">
                      🚫 #{dep.blocked?.issue_number ?? dep.blocked?.id} {dep.blocked?.title}
                    </span>
                  ))}
                  {(task.blocking ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground/50 italic">This task doesn't block anything.</p>
                  )}
                </div>
              </div>
            </div>
            </>
          )}

          {/* Activity */}
          {activity !== undefined && (
            <div className="border-t border-border/50 pt-4">
              <button
                type="button"
                onClick={() => setActivityOpen(v => !v)}
                className="flex items-center gap-2 w-full text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider hover:text-foreground transition-colors mb-2"
              >
                <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', activityOpen && 'rotate-180')} aria-hidden="true" />
                Activity ({activity.length})
              </button>
              {activityOpen && (
                <div className="max-h-40 overflow-y-auto">
                  <ActivityFeed logs={showAllActivity ? activity : activity.slice(0, 10)} loading={activityLoading} />
                </div>
              )}
              {activityOpen && activity.length > 10 && !showAllActivity && (
                <button
                  type="button"
                  onClick={() => setShowAllActivity(true)}
                  className="mt-1 mb-2 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                >
                  Show more ({activity.length - 10} more)
                </button>
              )}
            </div>
          )}

          {/* Comments */}
          {(onAddComment || onDeleteComment || comments.length > 0) && (
            <div className="border-t border-border/50 pt-4">
              <p className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-3">
                Comments {comments.length > 0 && <span className="text-muted-foreground/60 normal-case tracking-normal">({comments.length})</span>}
              </p>

              {/* Comment list */}
              <div className="space-y-3 mb-3 max-h-48 overflow-y-auto">
                {comments.map(c => (
                  <div key={c.id} className="flex gap-2 group">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-semibold text-primary">U</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground/90 break-words">{c.text}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground/60">
                          {timeAgo(c.createdAt)}
                        </span>
                        {onDeleteComment && (
                          <button
                            type="button"
                            onClick={() => onDeleteComment(c.id)}
                            className="text-xs text-muted-foreground/40 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
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
        </div>

        {/* Actions */}
        <div className="px-6 pb-5 pt-4 border-t border-border shrink-0 space-y-3">
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
              aria-disabled={saving || !title.trim()}
              className={cn(
                'text-sm font-medium px-5 py-2 rounded-lg transition-opacity',
                'bg-primary text-primary-foreground hover:opacity-90',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
