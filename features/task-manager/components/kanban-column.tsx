'use client';

import React, { useState } from 'react';
import { Plus, Inbox } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDroppable } from '@dnd-kit/core';
import { type Task, type TaskStatus, PRIORITY_CONFIG } from '../types';
import { TaskCard } from './task-card';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/lib/useMotion';

interface Props {
  status: TaskStatus;
  label: string;
  colorClass: string;
  tasks: Task[];
  onDelete: (id: number) => void;
  onStatusChange: (id: number, status: TaskStatus) => void;
  onAddTask: (title: string, priority: Task['priority'], description: string) => void;
  onEdit: (task: Task) => void;
  selected?: Set<number>;
  onToggleSelect?: (id: number) => void;
  onSelectAll?: (ids: number[]) => void;
}

function KanbanColumn({
  status, label, colorClass, tasks,
  onDelete, onStatusChange, onAddTask, onEdit,
  selected, onToggleSelect, onSelectAll,
}: Props) {
  const [adding, setAdding]     = useState(false);
  const [title, setTitle]       = useState('');
  const [priority, setPriority] = useState<Task['priority']>('medium');
  const [desc, setDesc]         = useState('');
  const reduceMotion = useReducedMotion();

  const { setNodeRef, isOver } = useDroppable({ id: status });

  const submit = () => {
    if (!title.trim()) return;
    onAddTask(title.trim(), priority, desc.trim());
    setTitle(''); setPriority('medium'); setDesc(''); setAdding(false);
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col rounded-xl border border-border bg-muted/20 min-h-[200px] transition-colors duration-100',
        isOver && 'bg-primary/5 border-primary/40'
      )}
    >
      {/* Column header — Select all and + cleanly separated (T1-8) */}
      <div className={cn('px-4 py-3 border-b-2 border-border flex items-center gap-2 rounded-t-xl', colorClass)}>
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs bg-background/60 text-muted-foreground px-2 py-0.5 rounded-full">
          {tasks.length}
        </span>
        <div className="flex-1" />
        {/* T2-2: Select all always visible */}
        <button
          onClick={() => onSelectAll?.(tasks.map(t => t.id))}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary rounded px-1"
        >
          Select all
        </button>
        <button
          onClick={() => setAdding(true)}
          aria-label={`Add task to ${label}`}
          className="text-muted-foreground hover:text-primary transition-colors"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Tasks */}
      <div className="flex-1 p-3 space-y-2 overflow-y-auto">
        <AnimatePresence initial={false}>
          {tasks.map(task => (
            <motion.div
              key={task.id}
              layout
              initial={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: reduceMotion ? 0 : 0.12 } }}
              transition={{ duration: reduceMotion ? 0 : 0.2, ease: 'easeOut' }}
            >
              <TaskCard
                task={task}
                onDelete={onDelete}
                onStatusChange={onStatusChange}
                onEdit={onEdit}
                isSelected={selected?.has(task.id)}
                onToggleSelect={onToggleSelect}
              />
            </motion.div>
          ))}

          {/* Empty column state */}
          {tasks.length === 0 && !adding && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <button
                onClick={() => setAdding(true)}
                className="w-full flex flex-col items-center justify-center py-8 text-muted-foreground/30 border-2 border-dashed border-border/50 rounded-xl mx-1 gap-1.5 hover:border-primary/30 hover:text-muted-foreground/50 transition-colors"
              >
                <Inbox className="w-5 h-5" aria-hidden="true" />
                <p className="text-xs">No tasks — click to add</p>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add task inline form */}
        {adding ? (
          <div className="glass rounded-xl p-3 space-y-2 border border-primary/30">
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setAdding(false); }}
              placeholder="Task title..."
              aria-label="New task title"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              aria-label="Task description"
              className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground resize-none"
            />
            <div className="flex items-center justify-between">
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as Task['priority'])}
                aria-label="Task priority"
                className="text-xs bg-background border border-border rounded px-2 py-1 outline-none"
              >
                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button onClick={() => setAdding(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                <button onClick={submit} className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded-lg hover:opacity-90 transition-opacity">Add</button>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full text-sm text-muted-foreground/50 hover:text-muted-foreground transition-colors py-2 flex items-center gap-1.5 justify-center rounded-lg hover:bg-muted/30"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Add task
          </button>
        )}
      </div>
    </div>
  );
}

KanbanColumn.displayName = 'KanbanColumn';

const MemoKanbanColumn = React.memo(KanbanColumn);
MemoKanbanColumn.displayName = 'KanbanColumn';

export { MemoKanbanColumn as KanbanColumn };
export default MemoKanbanColumn;
