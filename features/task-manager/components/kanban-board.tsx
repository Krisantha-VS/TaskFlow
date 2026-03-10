'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { COLUMNS, type Task, type TaskStatus } from '../types';
import { KanbanColumn } from './kanban-column';
import { TaskEditModal } from './task-edit-modal';
import { useTasks } from '../hooks/useTasks';
import { ConfirmDialog } from '@/components/confirm-dialog';

interface Props {
  token: string;
  boardId: number;
}

// Fix K5: minimal toast type
interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

let _toastId = 0;

export function KanbanBoard({ token, boardId }: Props) {
  const { tasks, loading, error, createTask, updateTask, moveTask, deleteTask } = useTasks(token, boardId);
  const [draggingTask, setDraggingTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask]   = useState<Task | null>(null);

  // Search state
  const [search, setSearch] = useState('');

  // Task delete confirmation state
  const [confirmTask, setConfirmTask] = useState<{ id: number; title: string } | null>(null);

  // Undo toast state
  const [undoToast, setUndoToast] = useState<string | null>(null);

  // Fix K5: toast state
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: 'success' | 'error') => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggingTask(task);
    e.dataTransfer.effectAllowed = 'move';
  };

  // Fix K1: clear dragging state when drag ends (ghost state fix)
  const handleDragEnd = () => {
    setDraggingTask(null);
  };

  const handleDrop = async (status: TaskStatus) => {
    if (!draggingTask || draggingTask.status === status) return;
    const moving = draggingTask;
    setDraggingTask(null);
    try {
      await moveTask(moving.id, status);
      // no success toast for move — it's visually self-evident
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Failed to move task', 'error');
    }
  };

  // Fix K5: wrapped createTask with feedback
  const handleAddTask = async (title: string, priority: Task['priority'], description: string) => {
    try {
      await createTask(title, priority, description);
      addToast('Task created', 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Failed to create task', 'error');
    }
  };

  // Request delete confirmation instead of deleting directly
  const handleDeleteRequest = (id: number, title: string) => {
    setConfirmTask({ id, title });
  };

  // Confirmed delete with undo toast
  const handleDeleteConfirmed = async () => {
    if (!confirmTask) return;
    const { id } = confirmTask;
    setConfirmTask(null);
    try {
      await deleteTask(id);
      // Show undo toast
      setUndoToast('Task deleted');
      setTimeout(() => setUndoToast(null), 3000);
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Failed to delete task', 'error');
    }
  };

  // Filter tasks by search
  const filtered = search.trim()
    ? tasks.filter(
        t =>
          t.title.toLowerCase().includes(search.toLowerCase()) ||
          t.description?.toLowerCase().includes(search.toLowerCase()),
      )
    : tasks;

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-muted-foreground">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mr-3" />
      Loading tasks...
    </div>
  );

  if (error) return (
    <div className="text-center py-16 text-red-400">{error}</div>
  );

  return (
    <>
      {/* Search bar */}
      <div className="mb-4 relative">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-background/80 border border-border text-sm outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map(col => (
          <KanbanColumn
            key={col.key}
            status={col.key}
            label={col.label}
            colorClass={col.color}
            tasks={filtered.filter(t => t.status === col.key)}
            onDrop={handleDrop}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd} // Fix K1
            draggingId={draggingTask?.id ?? null}
            onDelete={(id) => {
              const task = tasks.find(t => t.id === id);
              handleDeleteRequest(id, task?.title ?? 'this task');
            }}
            onStatusChange={moveTask}
            onAddTask={handleAddTask} // Fix K5
            onEdit={task => setEditingTask(task)}
          />
        ))}
      </div>

      {editingTask && (
        <TaskEditModal
          task={editingTask}
          onSave={async (id, data) => { await updateTask(id, data); }}
          onClose={() => setEditingTask(null)}
        />
      )}

      {/* Task delete confirmation dialog */}
      <ConfirmDialog
        open={!!confirmTask}
        title="Delete task?"
        message={`"${confirmTask?.title}" will be permanently deleted.`}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setConfirmTask(null)}
      />

      {/* Undo toast */}
      {undoToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-foreground text-background px-4 py-2.5 rounded-full text-sm font-medium shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          {undoToast}
        </div>
      )}

      {/* Fix K5: Toast stack */}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`glass rounded-lg px-4 py-2 text-sm border pointer-events-auto transition-all ${
              toast.type === 'success'
                ? 'border-green-500/50 text-green-400'
                : 'border-red-500/50 text-red-400'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </>
  );
}
