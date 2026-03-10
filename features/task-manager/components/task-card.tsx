'use client';

import { useRef, useState } from 'react';
import { Trash2, GripVertical, ChevronDown, ChevronRight, Pencil, Calendar } from 'lucide-react';
import { type Task, PRIORITY_CONFIG, COLUMNS } from '../types';
import { cn } from '@/lib/utils';

interface Props {
  task: Task;
  onDelete: (id: number) => void;
  onStatusChange: (id: number, status: Task['status']) => void;
  isDragging?: boolean;
  onDragStart: (e: React.DragEvent, task: Task) => void;
  onDragEnd: () => void; // Fix K1: required onDragEnd prop
  onEdit: (task: Task) => void; // Fix T3: required, not optional
}

function getDueDateStyle(dueDate: string | null | undefined): { label: string; className: string } | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diffDays = Math.ceil((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const label = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (diffDays < 0) return { label: `Overdue · ${label}`, className: 'text-red-400 bg-red-500/10 border border-red-500/20' };
  if (diffDays === 0) return { label: `Due today · ${label}`, className: 'text-orange-400 bg-orange-500/10 border border-orange-500/20' };
  if (diffDays <= 3) return { label: `Due soon · ${label}`, className: 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/20' };
  return { label, className: 'text-muted-foreground bg-muted/50' };
}

export function TaskCard({ task, onDelete, onStatusChange, isDragging, onDragStart, onDragEnd, onEdit }: Props) {
  const [expanded, setExpanded] = useState(false);
  const priority = PRIORITY_CONFIG[task.priority];
  const due = getDueDateStyle(task.due_date);

  // Fix K4: track whether a drag occurred to suppress click-to-edit after drop
  const didDrag = useRef(false);

  // Fix M1: build the list of other statuses for the mobile "Move to" select
  const otherStatuses = COLUMNS.filter(c => c.key !== task.status);

  return (
    <div
      draggable
      onDragStart={e => {
        didDrag.current = true; // Fix K4
        onDragStart(e, task);
      }}
      onDragEnd={() => {
        onDragEnd(); // Fix K1
        setTimeout(() => { didDrag.current = false; }, 100); // Fix K4
      }}
      onClick={() => {
        if (didDrag.current) return; // Fix K4: suppress click after drag
        onEdit(task);
      }}
      className={cn(
        'glass rounded-xl p-4 cursor-grab active:cursor-grabbing border border-border transition-all group',
        isDragging && 'opacity-40 scale-95'
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-2">
        <GripVertical className="w-4 h-4 text-muted-foreground/40 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-snug break-words">{task.title}</p>
        </div>
        {/* Fix AC1: aria-label on edit button */}
        <button
          onClick={e => { e.stopPropagation(); onEdit(task); }}
          aria-label={`Edit task: ${task.title}`}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-all shrink-0"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        {/* Fix AC1: aria-label on delete button */}
        <button
          onClick={e => { e.stopPropagation(); onDelete(task.id); }}
          aria-label={`Delete task: ${task.title}`}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Description */}
      {task.description && (
        <div className="mt-2 ml-6">
          <button
            onClick={e => { e.stopPropagation(); setExpanded(!expanded); }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className={cn('w-3 h-3 transition-transform', expanded && 'rotate-180')} />
            {expanded ? 'Hide' : 'Details'}
          </button>
          {expanded && (
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{task.description}</p>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 ml-6">
        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', priority.classes)}>
          {priority.label}
        </span>
        <div className="flex items-center gap-2">
          {due ? (
            <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${due.className}`}>
              <Calendar className="w-3 h-3" />
              {due.label}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground/50">
              {new Date(task.created_at).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      {/* Fix M1: Mobile-only "Move to" fallback for touch devices (HTML5 DnD unavailable) */}
      {otherStatuses.length > 0 && (
        <div
          className="md:hidden flex items-center gap-1.5 mt-2 ml-6"
          onClick={e => e.stopPropagation()}
        >
          <ChevronRight className="w-3 h-3 text-muted-foreground/50 shrink-0" />
          <label className="text-xs text-muted-foreground/60 shrink-0">Move to:</label>
          <select
            className="text-xs bg-background border border-border rounded px-2 py-1 outline-none"
            defaultValue=""
            onChange={e => {
              const val = e.target.value as Task['status'];
              if (val) onStatusChange(task.id, val);
              e.target.value = '';
            }}
          >
            <option value="" disabled>…</option>
            {otherStatuses.map(s => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
