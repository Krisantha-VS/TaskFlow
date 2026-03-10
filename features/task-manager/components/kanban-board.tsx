'use client';

import { useState } from 'react';
import { Search, Columns } from 'lucide-react';
import { DEFAULT_COLUMNS, type Board, type BoardColumn, type Task, type TaskStatus, type TaskPriority } from '../types';
import { KanbanColumn } from './kanban-column';
import { TaskEditModal } from './task-edit-modal';
import { useTasks } from '../hooks/useTasks';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ColumnEditor } from '@/components/column-editor';

type SortKey = 'default' | 'priority' | 'due_date' | 'created';

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

function sortTasks(tasks: Task[], key: SortKey): Task[] {
  if (key === 'default') return tasks;
  return [...tasks].sort((a, b) => {
    if (key === 'priority') {
      return (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
    }
    if (key === 'due_date') {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    }
    if (key === 'created') {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    return 0;
  });
}

interface Props {
  token: string;
  boardId: number;
  board?: Board;
  onColumnsUpdate?: (columns: BoardColumn[]) => Promise<void>;
}

// Fix K5: minimal toast type
interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

let _toastId = 0;

export function KanbanBoard({ token, boardId, board, onColumnsUpdate }: Props) {
  const { tasks, labels, loading, error, createTask, updateTask, moveTask, deleteTask, addTaskLabel, removeTaskLabel, createLabel, activity, activityLoading, fetchActivity, subtasks, fetchSubtasks, createSubtask, toggleSubtask, deleteSubtask, comments, fetchComments, addComment, deleteComment } = useTasks(token, boardId);
  const [draggingTask, setDraggingTask]   = useState<Task | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  // Derive live task from tasks array so modal always reflects latest state
  const editingTask = editingTaskId != null ? (tasks.find(t => t.id === editingTaskId) ?? null) : null;

  // Column editor state
  const [editingColumns, setEditingColumns] = useState(false);

  // Derive active columns from board prop, falling back to defaults
  const columns: BoardColumn[] = (board?.columns as BoardColumn[] | null) ?? DEFAULT_COLUMNS;

  // Bulk selection state
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const toggleSelect = (id: number) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const clearSelection = () => setSelected(new Set());

  // Search state
  const [search, setSearch] = useState('');

  // Sort state
  const [sortKey, setSortKey] = useState<SortKey>('default');

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
      {/* Search bar + Sort control */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-background/80 border border-border text-sm outline-none focus:border-primary transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-xs text-muted-foreground">Sort:</span>
          <select
            value={sortKey}
            onChange={e => setSortKey(e.target.value as SortKey)}
            className="text-xs bg-background border border-border rounded-lg px-2 py-1.5 outline-none focus:border-primary transition-colors cursor-pointer"
          >
            <option value="default">Default</option>
            <option value="priority">Priority</option>
            <option value="due_date">Due date</option>
            <option value="created">Newest</option>
          </select>

          <button
            onClick={() => setEditingColumns(v => !v)}
            title="Manage columns"
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted/50 hover:border-primary/50 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Columns className="w-3.5 h-3.5" />
            Columns
          </button>
        </div>
      </div>

      {editingColumns && onColumnsUpdate && (
        <ColumnEditor
          columns={columns}
          onSave={async (cols) => { await onColumnsUpdate(cols); setEditingColumns(false); }}
          onCancel={() => setEditingColumns(false)}
        />
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/20 text-sm flex-wrap">
          <span className="font-medium text-primary">{selected.size} selected</span>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {/* Move to status */}
            <select
              defaultValue=""
              onChange={async e => {
                const status = e.target.value as TaskStatus;
                if (!status) return;
                await Promise.all([...selected].map(id => updateTask(id, { status })));
                clearSelection();
                e.target.value = '';
              }}
              className="text-xs bg-background border border-border rounded-lg px-2 py-1.5 outline-none cursor-pointer"
            >
              <option value="">Move to…</option>
              <option value="todo">Todo</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </select>

            {/* Change priority */}
            <select
              defaultValue=""
              onChange={async e => {
                const priority = e.target.value as TaskPriority;
                if (!priority) return;
                await Promise.all([...selected].map(id => updateTask(id, { priority })));
                clearSelection();
                e.target.value = '';
              }}
              className="text-xs bg-background border border-border rounded-lg px-2 py-1.5 outline-none cursor-pointer"
            >
              <option value="">Set priority…</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            {/* Bulk delete */}
            <button
              onClick={async () => {
                if (!confirm(`Delete ${selected.size} tasks?`)) return;
                await Promise.all([...selected].map(id => deleteTask(id)));
                clearSelection();
              }}
              className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
            >
              Delete {selected.size}
            </button>

            <button onClick={clearSelection} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
        {columns.map(col => (
          <KanbanColumn
            key={col.key}
            status={col.key as TaskStatus}
            label={col.label}
            colorClass={col.color ?? ''}
            tasks={sortTasks(filtered.filter(t => t.status === col.key), sortKey)}
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
            onEdit={task => { setEditingTaskId(task.id); fetchActivity(task.id); fetchSubtasks(task.id); fetchComments(task.id); }}
            selected={selected}
            onToggleSelect={toggleSelect}
            onSelectAll={(ids) => setSelected(prev => new Set([...prev, ...ids]))}
          />
        ))}
      </div>

      {editingTask && (
        <TaskEditModal
          task={editingTask}
          onSave={async (id, data) => { await updateTask(id, data); }}
          onClose={() => setEditingTaskId(null)}
          labels={labels}
          onAddLabel={(labelId) => addTaskLabel(editingTask.id, labelId)}
          onRemoveLabel={(labelId) => removeTaskLabel(editingTask.id, labelId)}
          onCreateLabel={createLabel}
          activity={activity}
          activityLoading={activityLoading}
          subtasks={subtasks[editingTask.id] ?? []}
          onCreateSubtask={(title) => createSubtask(editingTask.id, title)}
          onToggleSubtask={(id, completed) => toggleSubtask(editingTask.id, id, completed)}
          onDeleteSubtask={(id) => deleteSubtask(editingTask.id, id)}
          comments={comments[editingTask.id] ?? []}
          onAddComment={(text) => addComment(editingTask.id, text)}
          onDeleteComment={(id) => deleteComment(editingTask.id, id)}
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
