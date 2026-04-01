'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, X, Columns, Download, BarChart2, Users } from 'lucide-react';
import { DEFAULT_COLUMNS, type Board, type BoardColumn, type Task, type TaskStatus, type TaskPriority } from '../types';
import { KanbanColumn } from './kanban-column';
import { TaskEditModal } from './task-edit-modal';
import { useTasks } from '../hooks/useTasks';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ColumnEditor } from '@/components/column-editor';
import { AnalyticsPanel } from './analytics-panel';
import { SprintSelector } from './sprint-selector';
import { MembersPanel } from './members-panel';

type SortKey = 'default' | 'priority' | 'due_date' | 'created';

const VALID_TASK_STATUSES = new Set<string>(['todo', 'in_progress', 'done']);
function isTaskStatus(value: string): value is TaskStatus {
  return VALID_TASK_STATUSES.has(value);
}

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
  const { tasks, labels, loading, error, createTask, updateTask, moveTask, deleteTask, addTaskLabel, removeTaskLabel, createLabel, addDependency, removeDependency, activity, activityLoading, fetchActivity, subtasks, fetchSubtasks, createSubtask, toggleSubtask, deleteSubtask, comments, fetchComments, addComment, deleteComment, sprints, createSprint, deleteSprint } = useTasks(token, boardId);
  const [draggingTask, setDraggingTask]   = useState<Task | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);
  // Derive live task from tasks array so modal always reflects latest state
  const editingTask = editingTaskId != null ? (tasks.find(t => t.id === editingTaskId) ?? null) : null;

  // Column editor state
  const [editingColumns, setEditingColumns] = useState(false);

  // Analytics panel state
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Members panel state
  const [showMembers, setShowMembers] = useState(false);

  // Sprint filter state
  const [activeSprint, setActiveSprint] = useState<number | 'backlog' | null>(null);

  // Label filter state
  const [labelFilter, setLabelFilter] = useState<Set<number>>(new Set());
  const toggleLabelFilter = (id: number) =>
    setLabelFilter(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

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

  // Export dropdown state
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!exportOpen) return;
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [exportOpen]);

  const handleExport = async (format: 'csv' | 'ics') => {
    try {
      const res = await fetch(`/api/boards/${boardId}/export?format=${format}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { addToast('Export failed', 'error'); return; }
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('text/csv') && !contentType.includes('text/calendar')) {
        addToast('Export returned unexpected format', 'error');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = format === 'csv' ? 'tasks.csv' : 'tasks.ics';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      addToast('Export failed', 'error');
    }
  };

  // Task delete confirmation state
  const [confirmTask, setConfirmTask] = useState<{ id: number; title: string } | null>(null);

  // Bulk delete confirmation state
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

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
    const { error } = await moveTask(moving.id, status);
    if (error) addToast(error, 'error');
    // no success toast for move — it's visually self-evident
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

  // Confirmed bulk delete with allSettled feedback
  const handleBulkDeleteConfirmed = async () => {
    setConfirmBulkDelete(false);
    const ids = [...selected];
    const results = await Promise.allSettled(ids.map(id => deleteTask(id)));
    const failed = results.filter(r => r.status === 'rejected').length;
    const succeeded = results.length - failed;
    clearSelection();
    if (failed === 0) addToast(`${succeeded} task${succeeded !== 1 ? 's' : ''} deleted`, 'success');
    else addToast(`${succeeded} deleted, ${failed} failed`, failed === results.length ? 'error' : 'success');
  };

  // Filter tasks by search
  const filtered = search.trim()
    ? tasks.filter(
        t =>
          t.title.toLowerCase().includes(search.toLowerCase()) ||
          t.description?.toLowerCase().includes(search.toLowerCase()),
      )
    : tasks;

  // Filter tasks by sprint
  const sprintFiltered = activeSprint === null
    ? filtered
    : activeSprint === 'backlog'
      ? filtered.filter(t => !t.sprintId)
      : filtered.filter(t => t.sprintId === activeSprint);

  const labelFiltered = labelFilter.size === 0
    ? sprintFiltered
    : sprintFiltered.filter(t => t.labels?.some(l => labelFilter.has(l.id)));

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-muted-foreground">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mr-3" />
      Loading tasks...
    </div>
  );

  if (error) return (
    <div className="text-center py-16 text-destructive">{error}</div>
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
            className="w-full pl-9 pr-8 py-2 rounded-lg bg-background/80 border border-border text-sm outline-none focus:border-primary transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-xs text-muted-foreground">Sort:</span>
          <select
            value={sortKey}
            onChange={e => setSortKey(e.target.value as SortKey)}
            aria-label="Sort tasks by"
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
            aria-label="Manage columns"
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted/50 hover:border-primary/50 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Columns className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Columns</span>
          </button>

          <button
            onClick={() => setShowAnalytics(true)}
            title="View analytics"
            aria-label="Analytics"
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted/50 hover:border-primary/50 text-muted-foreground hover:text-foreground transition-colors"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Analytics</span>
          </button>

          <button
            onClick={() => setShowMembers(true)}
            aria-label="Members"
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted/50 hover:border-primary/50 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Users className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Members</span>
          </button>

          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setExportOpen(v => !v)}
              aria-haspopup="true"
              aria-expanded={exportOpen}
              aria-label="Export"
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted/50 hover:border-primary/50 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
            {exportOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-1 z-20 glass border border-border rounded-xl shadow-xl py-1 w-36"
                onKeyDown={e => { if (e.key === 'Escape') setExportOpen(false); }}
              >
                <button role="menuitem" onClick={() => { handleExport('csv'); setExportOpen(false); }} className="w-full text-left px-3 py-2 text-xs hover:bg-muted/40 transition-colors">CSV Spreadsheet</button>
                <button role="menuitem" onClick={() => { handleExport('ics'); setExportOpen(false); }} className="w-full text-left px-3 py-2 text-xs hover:bg-muted/40 transition-colors">Calendar (.ics)</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {editingColumns && onColumnsUpdate && (
        <ColumnEditor
          columns={columns}
          onSave={async (cols) => { await onColumnsUpdate(cols); setEditingColumns(false); }}
          onCancel={() => setEditingColumns(false)}
        />
      )}

      {/* Label filter chips */}
      {labels.length > 0 && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-xs text-muted-foreground shrink-0">Filter:</span>
          {labels.map(label => (
            <button
              key={label.id}
              onClick={() => toggleLabelFilter(label.id)}
              aria-pressed={labelFilter.has(label.id)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                labelFilter.has(label.id)
                  ? 'bg-primary/20 border-primary/50 text-primary'
                  : 'bg-background/60 border-border text-muted-foreground hover:border-primary/30 hover:text-foreground'
              }`}
            >
              {label.name}
            </button>
          ))}
          {labelFilter.size > 0 && (
            <button
              onClick={() => setLabelFilter(new Set())}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      <SprintSelector
        sprints={sprints}
        activeSprint={activeSprint}
        onSelect={setActiveSprint}
        onCreateSprint={async (name, start, end) => createSprint(name, start, end)}
        onDeleteSprint={async (id) => deleteSprint(id)}
      />

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/20 text-sm flex-wrap">
          <span className="font-medium text-primary">{selected.size} selected</span>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {/* Move to status */}
            <select
              defaultValue=""
              aria-label="Move selected tasks to"
              onChange={async e => {
                const status = e.target.value as TaskStatus;
                if (!status) return;
                const results = await Promise.allSettled([...selected].map(id => updateTask(id, { status })));
                const failed = results.filter(r => r.status === 'fulfilled' && (r.value as any)?.error).length;
                const succeeded = results.length - failed;
                if (failed === 0) addToast(`${succeeded} task${succeeded !== 1 ? 's' : ''} moved`, 'success');
                else addToast(`${succeeded} moved, ${failed} failed`, failed === results.length ? 'error' : 'success');
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
              aria-label="Set priority for selected tasks"
              onChange={async e => {
                const priority = e.target.value as TaskPriority;
                if (!priority) return;
                const results = await Promise.allSettled([...selected].map(id => updateTask(id, { priority })));
                const failed = results.filter(r => r.status === 'fulfilled' && (r.value as any)?.error).length;
                const succeeded = results.length - failed;
                if (failed === 0) addToast(`${succeeded} task${succeeded !== 1 ? 's' : ''} updated`, 'success');
                else addToast(`${succeeded} updated, ${failed} failed`, failed === results.length ? 'error' : 'success');
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
              onClick={() => setConfirmBulkDelete(true)}
              className="text-xs px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-colors"
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
            status={isTaskStatus(col.key) ? col.key : 'todo'}
            label={col.label}
            colorClass={col.color ?? ''}
            tasks={sortTasks(labelFiltered.filter(t => t.status === col.key), sortKey)}
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
            onEdit={task => { lastFocusRef.current = document.activeElement as HTMLElement; setEditingTaskId(task.id); fetchActivity(task.id); fetchSubtasks(task.id); fetchComments(task.id); }}
            selected={selected}
            onToggleSelect={toggleSelect}
            onSelectAll={(ids) => setSelected(prev => new Set([...prev, ...ids]))}
          />
        ))}
      </div>

      {/* Empty board state */}
      {tasks.length === 0 && (
        <div className="flex items-center justify-center py-10 text-muted-foreground/50 text-sm">
          No tasks yet. Create one in any column above.
        </div>
      )}

      {editingTask && (
        <TaskEditModal
          task={editingTask}
          onSave={async (id, data) => { await updateTask(id, data); }}
          onClose={() => { setEditingTaskId(null); setTimeout(() => lastFocusRef.current?.focus(), 0); }}
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
          allTasks={tasks.map(t => ({ id: t.id, title: t.title }))}
          onAddDependency={(blockerId) => addDependency(editingTask.id, blockerId)}
          onRemoveDependency={(blockerId) => removeDependency(editingTask.id, blockerId)}
        />
      )}

      {showAnalytics && (
        <AnalyticsPanel token={token} boardId={boardId} onClose={() => setShowAnalytics(false)} />
      )}

      {showMembers && (
        <MembersPanel token={token} boardId={boardId} onClose={() => setShowMembers(false)} />
      )}

      {/* Task delete confirmation dialog */}
      <ConfirmDialog
        open={!!confirmTask}
        title="Delete task?"
        message={`"${confirmTask?.title}" will be permanently deleted.`}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setConfirmTask(null)}
      />

      {/* Bulk delete confirmation dialog */}
      <ConfirmDialog
        open={confirmBulkDelete}
        title={`Delete ${selected.size} task${selected.size !== 1 ? 's' : ''}?`}
        message={`${selected.size} task${selected.size !== 1 ? 's' : ''} will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete all"
        onConfirm={handleBulkDeleteConfirmed}
        onCancel={() => setConfirmBulkDelete(false)}
      />

      {/* Undo toast */}
      {undoToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-foreground text-background px-4 py-2.5 rounded-full text-sm font-medium shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          {undoToast}
        </div>
      )}

      {/* Screen reader live region */}
      <div aria-live="polite" aria-atomic="true" className="sr-only" id="board-status" />

      {/* Fix K5: Toast stack */}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`glass rounded-lg px-4 py-2 text-sm border pointer-events-auto transition-all ${
              toast.type === 'success'
                ? 'border-success/50 text-success'
                : 'border-destructive/50 text-destructive'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </>
  );
}
