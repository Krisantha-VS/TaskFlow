'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { type Task, type TaskStatus, PRIORITY_CONFIG } from '../types';
import { TaskCard } from './task-card';
import { cn } from '@/lib/utils';

interface Props {
  status: TaskStatus;
  label: string;
  colorClass: string;
  tasks: Task[];
  onDrop: (status: TaskStatus) => void;
  onDragStart: (e: React.DragEvent, task: Task) => void;
  onDragEnd: () => void; // Fix K1: thread onDragEnd through
  draggingId: number | null;
  onDelete: (id: number) => void;
  onStatusChange: (id: number, status: TaskStatus) => void;
  onAddTask: (title: string, priority: Task['priority'], description: string) => void;
  onEdit: (task: Task) => void; // Fix T3: required, not optional
  selected?: Set<number>;
  onToggleSelect?: (id: number) => void;
  onSelectAll?: (ids: number[]) => void;
}

export function KanbanColumn({
  status, label, colorClass, tasks,
  onDrop, onDragStart, onDragEnd, draggingId,
  onDelete, onStatusChange, onAddTask, onEdit,
  selected, onToggleSelect, onSelectAll,
}: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [adding, setAdding]     = useState(false);
  const [title, setTitle]       = useState('');
  const [priority, setPriority] = useState<Task['priority']>('medium');
  const [desc, setDesc]         = useState('');

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    onDrop(status);
  };

  const submit = () => {
    if (!title.trim()) return;
    onAddTask(title.trim(), priority, desc.trim());
    setTitle(''); setPriority('medium'); setDesc(''); setAdding(false);
  };

  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border border-border bg-muted/20 min-h-[200px] transition-colors',
        dragOver && 'bg-primary/5 border-primary/40'
      )}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      // Fix K2: only clear dragOver when pointer truly leaves the column (not into a child)
      onDragLeave={e => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
      }}
      onDrop={handleDrop}
    >
      {/* Column header */}
      <div className={cn('px-4 py-3 border-b-2 border-border flex items-center justify-between rounded-t-xl group', colorClass)}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{label}</span>
          <span className="text-xs bg-background/60 text-muted-foreground px-2 py-0.5 rounded-full">
            {tasks.length}
          </span>
          <button
            onClick={() => onSelectAll?.(tasks.map(t => t.id))}
            className="opacity-0 group-hover:opacity-100 text-[10px] text-muted-foreground hover:text-foreground transition-all ml-auto"
          >
            Select all
          </button>
        </div>
        {/* Fix AC1: aria-label on icon-only Plus button */}
        <button
          onClick={() => setAdding(true)}
          aria-label={`Add task to ${label}`}
          className="text-muted-foreground hover:text-primary transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Tasks — Fix M2: remove hard-coded max-h, let column grow naturally */}
      <div className="flex-1 p-3 space-y-2 overflow-y-auto">
        {tasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            onDelete={onDelete}
            onStatusChange={onStatusChange}
            isDragging={draggingId === task.id}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd} // Fix K1: pass through
            onEdit={onEdit}
            isSelected={selected?.has(task.id)}
            onToggleSelect={onToggleSelect}
          />
        ))}

        {/* Fix M6: empty column drop target visual */}
        {tasks.length === 0 && !adding && (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/40 border-2 border-dashed border-border rounded-xl mx-1">
            <p className="text-xs">No tasks yet</p>
            <p className="text-xs">Drop here or click +</p>
          </div>
        )}

        {/* Add task inline form */}
        {adding ? (
          <div className="glass rounded-xl p-3 space-y-2 border border-primary/30">
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setAdding(false); }}
              placeholder="Task title..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
            />
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground/50 resize-none"
            />
            <div className="flex items-center justify-between">
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as Task['priority'])}
                className="text-xs bg-background border border-border rounded px-2 py-1 outline-none"
              >
                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button onClick={() => setAdding(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                <button onClick={submit} className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded-lg hover:bg-primary/90 transition-colors">Add</button>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full text-sm text-muted-foreground/50 hover:text-muted-foreground transition-colors py-2 flex items-center gap-1.5 justify-center rounded-lg hover:bg-muted/30"
          >
            <Plus className="w-3.5 h-3.5" /> Add task
          </button>
        )}
      </div>
    </div>
  );
}
