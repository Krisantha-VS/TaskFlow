'use client';

import React, { useMemo, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { AnimatePresence, motion } from 'framer-motion';
import { Trash2, GripVertical, ChevronDown, ChevronRight, Pencil, Calendar, CheckSquare } from 'lucide-react';
import { type Task, type Subtask, PRIORITY_CONFIG, COLUMNS, DEPENDENCY_TYPES } from '../types';
import { cn } from '@/lib/utils';
import { LabelPill } from '@/components/label-pill';
import { useReducedMotion } from '@/lib/useMotion';

interface Props {
  task: Task;
  onDelete: (id: number) => void;
  onStatusChange: (id: number, status: Task['status']) => void;
  onEdit: (task: Task) => void;
  isSelected?: boolean;
  onToggleSelect?: (id: number) => void;
  isDragOverlay?: boolean;
  onToggleSubtask?: (taskId: number, subtaskId: number, completed: boolean) => void;
}

function getDueDateStyle(dueDate: string | null | undefined): { label: string; className: string } | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diffDays = Math.ceil((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const label = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (diffDays < 0) return { label: `Overdue · ${label}`, className: 'badge-overdue' };
  if (diffDays === 0) return { label: `Due today · ${label}`, className: 'badge-overdue' };
  if (diffDays <= 3) return { label: `Due soon · ${label}`, className: 'badge-warning' };
  return { label, className: 'text-muted-foreground bg-muted/50' };
}

function TaskCard({ task, onDelete, onStatusChange, onEdit, isSelected, onToggleSelect, isDragOverlay, onToggleSubtask }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const priority = PRIORITY_CONFIG[task.priority];
  const due = useMemo(() => getDueDateStyle(task.due_date), [task.due_date]);
  const subtaskCount = task.subtasks?.length ?? 0;
  const subtaskCompleted = task.subtasks?.filter(s => s.completed).length ?? 0;
  const otherStatuses = COLUMNS.filter(c => c.key !== task.status);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    disabled: !!isDragOverlay,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      onClick={(e: React.MouseEvent) => {
        if (isDragOverlay) return;
        if (e.metaKey || e.ctrlKey) {
          e.stopPropagation();
          onToggleSelect?.(task.id);
          return;
        }
        onEdit(task);
      }}
      className={cn(
        'relative glass rounded-xl p-4 border border-border group',
        'transition-[opacity,box-shadow] duration-100',
        isDragging && !isDragOverlay && 'opacity-30',
        isDragOverlay ? 'cursor-grabbing shadow-2xl' : 'cursor-pointer',
        isSelected && 'ring-1 ring-primary/40'
      )}
    >
      {/* Drag handle */}
      <div
        {...listeners}
        onClick={e => e.stopPropagation()}
        className="absolute top-3.5 left-1.5 text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing touch-none p-0.5"
      >
        <GripVertical className="w-3.5 h-3.5" aria-hidden="true" />
      </div>

      {/* Selection checkbox — always visible (T2-2) */}
      <button
        onClick={e => { e.stopPropagation(); onToggleSelect?.(task.id); }}
        aria-label={isSelected ? `Deselect task: ${task.title}` : `Select task: ${task.title}`}
        aria-pressed={isSelected}
        className={cn(
          'absolute top-2 left-6 w-4 h-4 rounded border flex items-center justify-center transition-all z-10',
          'focus:outline-none focus:ring-2 focus:ring-primary',
          isSelected
            ? 'bg-primary border-primary'
            : 'border-border/40 bg-background/70'
        )}
      >
        {isSelected && <span className="text-primary-foreground text-xs leading-none">✓</span>}
      </button>

      {/* Header */}
      <div className="flex items-start gap-2 ml-7">
        <div className="flex-1 min-w-0">
          {/* Issue number + title */}
          <p className="text-sm font-semibold leading-snug break-words">
            <span className="text-muted-foreground/60 font-normal mr-1">#{task.issue_number}</span>
            {task.title}
          </p>
          {subtaskCount > 0 && (
            <button
              onClick={e => { e.stopPropagation(); setChecklistOpen(v => !v); }}
              className="flex items-center gap-2 mt-1.5 w-full text-left group/checklist"
            >
              <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary/60 rounded-full transition-all"
                  style={{ width: `${Math.round((subtaskCompleted / subtaskCount) * 100)}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground shrink-0 group-hover/checklist:text-foreground transition-colors">
                {subtaskCompleted}/{subtaskCount}
              </span>
            </button>
          )}
          {/* Inline checklist */}
          {checklistOpen && task.subtasks && task.subtasks.length > 0 && (
            <div className="mt-1.5 space-y-1 pl-1">
              {task.subtasks.map(s => (
                <div key={s.id} className="flex items-center gap-1.5">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={s.completed}
                    aria-label={`${s.title}, subtask`}
                    onClick={e => {
                      e.stopPropagation();
                      onToggleSubtask?.(task.id, s.id, !s.completed);
                    }}
                    className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      s.completed ? 'bg-primary border-primary' : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {s.completed && <span className="text-primary-foreground text-[10px] leading-none">✓</span>}
                  </button>
                  <span className={`text-xs ${s.completed ? 'line-through text-muted-foreground/60' : ''}`}>
                    {s.title}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onEdit(task); }}
          aria-label={`Edit task: ${task.title}`}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-all shrink-0 focus:outline-none focus:ring-2 focus:ring-primary rounded"
        >
          <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDelete(task.id); }}
          aria-label={`Delete task: ${task.title}`}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0 focus:outline-none focus:ring-2 focus:ring-primary rounded"
        >
          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* Description expand */}
      {task.description && (
        <div className="mt-2 ml-7">
          <button
            onClick={e => { e.stopPropagation(); setExpanded(!expanded); }}
            aria-label={expanded ? 'Collapse task details' : 'Expand task details'}
            aria-expanded={expanded}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary rounded"
          >
            <ChevronDown className={cn('w-3 h-3 transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
            {expanded ? 'Hide' : 'Details'}
          </button>
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.p
                key="desc"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.2 }}
                className="mt-1.5 text-xs text-muted-foreground leading-relaxed overflow-hidden"
              >
                {task.description}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Labels */}
      {task.labels && task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5 ml-7">
          {task.labels.map(l => (
            <LabelPill key={l.id} name={l.name} color={l.color} small />
          ))}
        </div>
      )}

      {/* Blocked badge with blocker name, issue number, and relationship type icon */}
      {task.blockedBy && task.blockedBy.length > 0 && (() => {
        const depConfig = DEPENDENCY_TYPES.find(d => d.value === task.blockedBy![0].type) ?? DEPENDENCY_TYPES[0];
        return (
        <div className="mt-1.5 ml-7">
          <span className={`${depConfig.badge || 'badge-blocked'} inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium`}>
            {depConfig.icon} #{task.blockedBy![0].blocker.issue_number ?? task.blockedBy![0].blocker.id} {task.blockedBy![0].blocker.title}
            {task.blockedBy!.length > 1 && ` +${task.blockedBy!.length - 1}`}
          </span>
        </div>
        );
      })()}

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 ml-7">
        <div className="flex items-center gap-1.5">
          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', priority.classes)}>
            {priority.label}
          </span>
          {task.recurrence && (
            <span className="badge-info text-xs px-1.5 py-0.5 rounded-full">
              ↻ {task.recurrence}
            </span>
          )}
          {task.sprintId && (
            <span className="badge-primary text-xs px-1.5 py-0.5 rounded-full">
              ⚡ Sprint
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {due ? (
            <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${due.className}`}>
              <Calendar className="w-3 h-3" aria-hidden="true" />
              {due.label}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground/50">
              {new Date(task.created_at).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      {/* Mobile "Move to" */}
      {!isDragOverlay && otherStatuses.length > 0 && (
        <div
          className="md:hidden flex items-center gap-1.5 mt-2 ml-7"
          onClick={e => e.stopPropagation()}
        >
          <ChevronRight className="w-3 h-3 text-muted-foreground/50 shrink-0" aria-hidden="true" />
          <label className="text-xs text-muted-foreground/60 shrink-0">Move to:</label>
          <select
            aria-label="Move task to column"
            className="text-xs bg-background border border-border rounded px-2 py-1 outline-none focus:ring-2 focus:ring-primary"
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

TaskCard.displayName = 'TaskCard';

const MemoTaskCard = React.memo(TaskCard);
MemoTaskCard.displayName = 'TaskCard';

export { MemoTaskCard as TaskCard };
export default MemoTaskCard;
