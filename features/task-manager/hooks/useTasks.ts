'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { taskApi } from '../api';
import type { Board, Task, Label, TaskStatus, TaskPriority, ActivityLog, Subtask, Comment, BoardColumn, Sprint, TaskDependency } from '../types';

// Prisma returns camelCase field names, but our frontend types use snake_case.
// This normalizer ensures all compound-name fields are accessible via their
// snake_case aliases without breaking existing single-word fields.
function normalizeTask(raw: any): Task {
  if (!raw || typeof raw !== 'object') return raw as Task;
  const t: any = { ...raw };
  // Map camelCase → snake_case for compound-name fields
  if (raw.issueNumber !== undefined && t.issue_number === undefined) t.issue_number = raw.issueNumber;
  if (raw.boardId !== undefined && t.board_id === undefined) t.board_id = raw.boardId;
  if (raw.userId !== undefined && t.user_id === undefined) t.user_id = raw.userId;
  if (raw.dueDate !== undefined && t.due_date === undefined) t.due_date = raw.dueDate ? String(raw.dueDate).slice(0, 10) : null;
  if (raw.nextOccurrence !== undefined && t.next_occurrence === undefined) t.next_occurrence = raw.nextOccurrence ? String(raw.nextOccurrence) : null;
  if (raw.createdAt !== undefined && t.created_at === undefined) t.created_at = raw.createdAt;
  if (raw.updatedAt !== undefined && t.updated_at === undefined) t.updated_at = raw.updatedAt;
  if (raw.sprintId !== undefined && t.sprintId === undefined) t.sprintId = raw.sprintId;
  // Normalize nested relations
  if (raw.blockedBy) t.blockedBy = raw.blockedBy.map(normalizeDependency);
  if (raw.blocking) t.blocking = raw.blocking.map(normalizeDependency);
  if (raw.labels) t.labels = raw.labels.map(normalizeLabel);
  if (raw.subtasks) t.subtasks = raw.subtasks.map(normalizeSubtask);
  return t as Task;
}

function normalizeDependency(raw: any): TaskDependency {
  const d: any = { ...raw };
  if (raw.blocker) {
    d.blocker = {
      ...raw.blocker,
      issue_number: raw.blocker.issueNumber ?? raw.blocker.issue_number,
    };
  }
  if (raw.blocked) {
    d.blocked = {
      ...raw.blocked,
      issue_number: raw.blocked.issueNumber ?? raw.blocked.issue_number,
    };
  }
  return d as TaskDependency;
}

function normalizeLabel(raw: any): Label {
  if (raw.boardId !== undefined && raw.board_id === undefined) raw.board_id = raw.boardId;
  return raw as Label;
}

function normalizeSubtask(raw: any): Subtask {
  if (raw.taskId !== undefined && raw.task_id === undefined) raw.task_id = raw.taskId;
  if (raw.createdAt !== undefined && raw.created_at === undefined) raw.created_at = raw.createdAt;
  return raw as Subtask;
}

export function useTasks(token: string | null, boardId: number | null) {
  const [tasks, setTasks]               = useState<Task[]>([]);
  const [labels, setLabels]             = useState<Label[]>([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  // Fix A6: mutation-level error state
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [sprints, setSprints]           = useState<Sprint[]>([]);

  // Track recently mutated task IDs to skip SSE echoes (prevents double-update)
  const recentlyMutated = useRef<Map<number, number>>(new Map());

  const markMutated = useCallback((taskId: number) => {
    recentlyMutated.current.set(taskId, Date.now());
    // Cleanup stale entries after 3s
    setTimeout(() => {
      const ts = recentlyMutated.current.get(taskId);
      if (ts && Date.now() - ts >= 2500) recentlyMutated.current.delete(taskId);
    }, 3000);
  }, []);

  const isRecentlyMutated = useCallback((taskId: number): boolean => {
    const ts = recentlyMutated.current.get(taskId);
    return ts != null && (Date.now() - ts) < 2000;
  }, []);

  const load = useCallback(async () => {
    if (!token || !boardId) return;
    setLoading(true);
    setError(null);
    try {
      const tasksData = await taskApi.getTasks(token, boardId);
      setTasks(tasksData.map(normalizeTask));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [token, boardId]);

  // Lazy labels — fetch only when needed (e.g. when task edit modal opens)
  const fetchLabels = useCallback(async () => {
    if (!token || !boardId) return;
    try {
      const data = await taskApi.getLabels(token, boardId);
      setLabels(data);
    } catch { /* non-critical */ }
  }, [token, boardId]);

  useEffect(() => { load(); }, [load]);

  // SSE: subscribe to board stream for real-time updates
  useEffect(() => {
    if (!token || !boardId) return;

    const controller = new AbortController();

    const setupStream = async () => {
      try {
        const res = await fetch(`/api/boards/${boardId}/stream`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          setTimeout(() => setupStream(), 5000); // retry after 5s
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split('\n\n');
            buf = lines.pop() ?? '';
            for (const chunk of lines) {
              const dataLine = chunk.split('\n').find(l => l.startsWith('data: '));
              if (!dataLine) continue;
              try {
                const event = JSON.parse(dataLine.slice(6));
                const { type, data } = event;

                if (type === 'task_created' && data?.task) {
                  const task = normalizeTask(data.task);
                  if (isRecentlyMutated(task.id)) continue;
                  setTasks(prev => prev.some(t => t.id === task.id) ? prev : [...prev, task]);
                } else if (type === 'task_updated' && data?.task) {
                  const task = normalizeTask(data.task);
                  if (isRecentlyMutated(task.id)) continue;
                  setTasks(prev => {
                    const idx = prev.findIndex(t => t.id === task.id);
                    if (idx === -1) { load(); return prev; }
                    return prev.map(t => t.id === task.id ? task : t);
                  });
                } else if (type === 'task_moved' && data?.task) {
                  const task = normalizeTask(data.task);
                  if (isRecentlyMutated(task.id)) continue;
                  setTasks(prev => prev.map(t => t.id === task.id ? task : t));
                } else if (type === 'task_deleted' && data?.taskId) {
                  if (isRecentlyMutated(data.taskId)) continue;
                  setTasks(prev => prev.filter(t => t.id !== data.taskId));
                } else if ((type === 'task_labeled' || type === 'task_blocked' || type === 'subtask_updated') && data?.task) {
                  // Granular update for label/blocker/subtask changes from other clients
                  const task = normalizeTask(data.task);
                  if (isRecentlyMutated(task.id)) continue;
                  setTasks(prev => prev.map(t => t.id === task.id ? task : t));
                }
                // Unknown event types are silently ignored (no full refetch)
              } catch { /* ignore parse errors */ }
            }
          }
        } catch {
          // Stream read error — retry after 5s
          if (!controller.signal.aborted) setTimeout(() => setupStream(), 5000);
        }
      } catch {
        // connection closed or aborted
        if (!controller.signal.aborted) setTimeout(() => setupStream(), 5000);
      }
    };

    setupStream();

    return () => controller.abort();
  }, [token, boardId, load]);

  // Fix A6: createTask — wrapped in try/catch, returns { error }
  const createTask = async (
    title: string,
    priority: TaskPriority = 'medium',
    description = '',
    status?: string,
  ): Promise<{ error: string | null; task?: Task }> => {
    if (!token || !boardId) return { error: 'Not authenticated' };
    setMutationError(null);
    try {
      const task = normalizeTask(await taskApi.createTask(token, { board_id: boardId, title, priority, description, status }));
      setTasks(prev => [...prev, task]);
      markMutated(task.id);
      return { error: null, task };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create task';
      setMutationError(msg);
      return { error: msg };
    }
  };

  // Fix A6: updateTask — wrapped in try/catch, returns { error }
  const updateTask = async (
    id: number,
    data: Partial<Task>,
  ): Promise<{ error: string | null; task?: Task }> => {
    if (!token) return { error: 'Not authenticated' };
    setMutationError(null);
    try {
      const updated = normalizeTask(await taskApi.updateTask(token, id, data));
      setTasks(prev => prev.map(t => t.id === id ? updated : t));
      markMutated(id);
      return { error: null, task: updated };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to update task';
      setMutationError(msg);
      return { error: msg };
    }
  };

  // Fix A6: moveTask — optimistic update with rollback on failure
  const moveTask = async (id: number, status: string): Promise<{ error: string | null }> => {
    if (!token) return { error: 'Not authenticated' };
    setMutationError(null);

    // Optimistic update
    const prev = tasks.find(t => t.id === id);
    setTasks(current => current.map(t => t.id === id ? { ...t, status } : t));

    try {
      const updated = normalizeTask(await taskApi.updateTask(token, id, { status }));
      setTasks(current => current.map(t => t.id === id ? updated : t));
      markMutated(id);
      return { error: null };
    } catch (e) {
      // Rollback
      if (prev) setTasks(current => current.map(t => t.id === id ? prev : t));
      const msg = e instanceof Error ? e.message : 'Failed to move task';
      setMutationError(msg);
      return { error: msg };
    }
  };

  // Fix A6: deleteTask — optimistic remove with rollback on failure
  const deleteTask = async (id: number): Promise<{ error: string | null }> => {
    if (!token) return { error: 'Not authenticated' };
    setMutationError(null);

    // Optimistic remove
    const task = tasks.find(t => t.id === id);
    setTasks(prev => prev.filter(t => t.id !== id));

    try {
      await taskApi.deleteTask(token, id);
      markMutated(id);
      return { error: null };
    } catch (e) {
      // Rollback
      if (task) setTasks(prev => [...prev, task]);
      const msg = e instanceof Error ? e.message : 'Failed to delete task';
      setMutationError(msg);
      return { error: msg };
    }
  };

  const addTaskLabel = async (taskId: number, labelId: number): Promise<{ error: string | null }> => {
    if (!token) return { error: 'Not authenticated' };
    setMutationError(null);
    const prevTasks = tasks;
    // Optimistic update
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      const label = labels.find(l => l.id === labelId);
      if (!label) return t;
      const existing = t.labels ?? [];
      if (existing.find(l => l.id === labelId)) return t;
      return { ...t, labels: [...existing, label] };
    }));
    try {
      await taskApi.addTaskLabel(token, taskId, labelId);
      markMutated(taskId);
      return { error: null };
    } catch (e) {
      setTasks(prevTasks);
      const msg = e instanceof Error ? e.message : 'Failed to add label';
      setMutationError(msg);
      return { error: msg };
    }
  };

  const removeTaskLabel = async (taskId: number, labelId: number): Promise<{ error: string | null }> => {
    if (!token) return { error: 'Not authenticated' };
    setMutationError(null);
    const prevTasks = tasks;
    // Optimistic update
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      return { ...t, labels: (t.labels ?? []).filter(l => l.id !== labelId) };
    }));
    try {
      await taskApi.removeTaskLabel(token, taskId, labelId);
      markMutated(taskId);
      return { error: null };
    } catch (e) {
      setTasks(prevTasks);
      const msg = e instanceof Error ? e.message : 'Failed to remove label';
      setMutationError(msg);
      return { error: msg };
    }
  };

  const addDependency = useCallback(async (taskId: number, blockerId: number, type = 'blocks'): Promise<{ error: string | null }> => {
    if (!token) return { error: null };
    const prevTasks = tasks;
    // Optimistic update — find blocker info from existing tasks
    const blocker = tasks.find(t => t.id === blockerId);
    if (blocker) {
      setTasks(prev => prev.map(t => {
        if (t.id !== taskId) return t;
        const existing = t.blockedBy ?? [];
        if (existing.some(d => d.blockerId === blockerId)) return t;
        return {
          ...t,
          blockedBy: [...existing, {
            id: 0, // temp id, will be replaced on next full fetch
            blockerId,
            blockedId: taskId,
            type,
            blocker: { id: blocker.id, title: blocker.title, issue_number: blocker.issue_number },
          }],
        };
      }));
    }
    try {
      await taskApi.addDependency(token, taskId, blockerId, type);
      markMutated(taskId);
      // Refresh from server to get the real dependency id and normalized type
      await load();
      return { error: null };
    } catch (e) {
      setTasks(prevTasks); // Rollback
      const msg = e instanceof Error ? e.message : 'Failed to add dependency';
      setMutationError(msg);
      return { error: msg };
    }
  }, [token, tasks, load, markMutated]);

  const removeDependency = useCallback(async (taskId: number, blockerId: number, type = 'blocks') => {
    if (!token) return;
    const prevTasks = tasks;
    // Optimistic
    setTasks(prev => prev.map(t => t.id === taskId
      ? { ...t, blockedBy: (t.blockedBy ?? []).filter(d => d.blockerId !== blockerId || d.type !== type) }
      : t
    ));
    try {
      await taskApi.removeDependency(token, taskId, blockerId, type);
      markMutated(taskId);
    } catch {
      setTasks(prevTasks); // Rollback on error
    }
  }, [token, tasks, markMutated]);

  const createLabel = async (name: string, color: string): Promise<void> => {
    if (!token || !boardId) return;
    const label = await taskApi.createLabel(token, boardId, name, color);
    setLabels(prev => [...prev, label].sort((a, b) => a.name.localeCompare(b.name)));
  };

  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  const fetchActivity = useCallback(async (taskId: number) => {
    if (!token || !boardId) return;
    setActivityLoading(true);
    try {
      const logs = await taskApi.getActivity(token, boardId, taskId);
      setActivity(logs);
    } catch { /* non-critical */ }
    finally { setActivityLoading(false); }
  }, [token, boardId]);

  const [subtasks, setSubtasks] = useState<Record<number, Subtask[]>>({});

  const fetchSubtasks = useCallback(async (taskId: number) => {
    if (!token) return;
    try {
      const data = await taskApi.getSubtasks(token, taskId);
      setSubtasks(prev => ({ ...prev, [taskId]: data }));
    } catch { /* non-critical */ }
  }, [token]);

  const createSubtask = useCallback(async (taskId: number, title: string): Promise<{ error: string | null }> => {
    if (!token) return { error: 'Not authenticated' };
    try {
      const subtask = await taskApi.createSubtask(token, taskId, title);
      setSubtasks(prev => ({ ...prev, [taskId]: [...(prev[taskId] ?? []), subtask] }));
      // Sync to parent task's subtasks array
      setTasks(prev => prev.map(t => {
        if (t.id !== taskId) return t;
        return { ...t, subtasks: [...(t.subtasks ?? []), subtask] };
      }));
      return { error: null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create subtask';
      setMutationError(msg);
      return { error: msg };
    }
  }, [token]);

  const toggleSubtask = useCallback(async (taskId: number, subtaskId: number, completed: boolean) => {
    if (!token) return;
    // Optimistic update — subtasks map
    setSubtasks(prev => ({
      ...prev,
      [taskId]: (prev[taskId] ?? []).map(s => s.id === subtaskId ? { ...s, completed } : s),
    }));
    // Also sync to the parent task's subtasks array so TaskCard progress bar updates
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId || !t.subtasks) return t;
      return {
        ...t,
        subtasks: t.subtasks.map(s => s.id === subtaskId ? { ...s, completed } : s),
      };
    }));
    try {
      await taskApi.updateSubtask(token, subtaskId, { completed });
    } catch {
      // Rollback subtasks map
      setSubtasks(prev => ({
        ...prev,
        [taskId]: (prev[taskId] ?? []).map(s => s.id === subtaskId ? { ...s, completed: !completed } : s),
      }));
      // Rollback tasks state
      setTasks(prev => prev.map(t => {
        if (t.id !== taskId || !t.subtasks) return t;
        return {
          ...t,
          subtasks: t.subtasks.map(s => s.id === subtaskId ? { ...s, completed: !completed } : s),
        };
      }));
    }
  }, [token]);

  const deleteSubtask = useCallback(async (taskId: number, subtaskId: number): Promise<{ error: string | null }> => {
    if (!token) return { error: 'Not authenticated' };
    const prevSubtasks = subtasks[taskId];
    setSubtasks(prev => ({ ...prev, [taskId]: (prev[taskId] ?? []).filter(s => s.id !== subtaskId) }));
    // Sync to parent task
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId || !t.subtasks) return t;
      return { ...t, subtasks: t.subtasks.filter(s => s.id !== subtaskId) };
    }));
    try {
      await taskApi.deleteSubtask(token, subtaskId);
      return { error: null };
    } catch (e) {
      if (prevSubtasks !== undefined) setSubtasks(prev => ({ ...prev, [taskId]: prevSubtasks }));
      // Rollback task state
      setTasks(prev => prev.map(t => {
        if (t.id !== taskId) return t;
        return { ...t, subtasks: prevSubtasks };
      }));
      const msg = e instanceof Error ? e.message : 'Failed to delete subtask';
      setMutationError(msg);
      return { error: msg };
    }
  }, [token, subtasks]);

  const [comments, setComments] = useState<Record<number, Comment[]>>({});

  const fetchComments = useCallback(async (taskId: number) => {
    if (!token) return;
    try {
      const data = await taskApi.getComments(token, taskId);
      setComments(prev => ({ ...prev, [taskId]: data }));
    } catch { /* non-critical */ }
  }, [token]);

  // Ref to track which taskId is currently being fetched (deduplication)
  const fetchingModalTaskId = useRef<number | null>(null);

  // Parallel fetch for task modal — replaces sequential fetchActivity/fetchSubtasks/fetchComments calls
  // Deduplicates concurrent fetches for the same taskId; individual failures don't block others
  const fetchModalData = useCallback(async (taskId: number) => {
    if (fetchingModalTaskId.current === taskId) return;
    fetchingModalTaskId.current = taskId;
    await Promise.allSettled([
      fetchActivity(taskId),
      fetchSubtasks(taskId),
      fetchComments(taskId),
    ]);
    if (fetchingModalTaskId.current === taskId) fetchingModalTaskId.current = null;
  }, [fetchActivity, fetchSubtasks, fetchComments]);

  const addComment = useCallback(async (taskId: number, text: string): Promise<{ error: string | null }> => {
    if (!token) return { error: 'Not authenticated' };
    try {
      const comment = await taskApi.createComment(token, taskId, text);
      setComments(prev => ({ ...prev, [taskId]: [...(prev[taskId] ?? []), comment] }));
      return { error: null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to add comment';
      setMutationError(msg);
      return { error: msg };
    }
  }, [token]);

  const deleteComment = useCallback(async (taskId: number, commentId: number): Promise<{ error: string | null }> => {
    if (!token) return { error: 'Not authenticated' };
    const prevComments = comments[taskId];
    setComments(prev => ({ ...prev, [taskId]: (prev[taskId] ?? []).filter(c => c.id !== commentId) }));
    try {
      await taskApi.deleteComment(token, commentId);
      return { error: null };
    } catch (e) {
      if (prevComments !== undefined) setComments(prev => ({ ...prev, [taskId]: prevComments }));
      const msg = e instanceof Error ? e.message : 'Failed to delete comment';
      setMutationError(msg);
      return { error: msg };
    }
  }, [token, comments]);

  const fetchSprints = useCallback(async () => {
    if (!token || !boardId) return;
    try {
      const data = await taskApi.getSprints(token, boardId);
      setSprints(data);
    } catch { /* ignore */ }
  }, [token, boardId]);

  useEffect(() => { fetchSprints(); }, [fetchSprints]);

  const createSprint = useCallback(async (name: string, startDate?: string, endDate?: string) => {
    if (!token || !boardId) return;
    try {
      const sprint = await taskApi.createSprint(token, { board_id: boardId, name, start_date: startDate, end_date: endDate });
      setSprints(prev => [...prev, sprint]);
      return sprint;
    } catch { /* ignore */ }
  }, [token, boardId]);

  const deleteSprint = useCallback(async (id: number) => {
    if (!token) return;
    setSprints(prev => prev.filter(s => s.id !== id));
    // Tasks with this sprint become backlog automatically (SetNull)
    setTasks(prev => prev.map(t => t.sprintId === id ? { ...t, sprintId: null } : t));
    try { await taskApi.deleteSprint(token, id); } catch { await load(); }
  }, [token, load]);

  const setTaskSprint = useCallback(async (taskId: number, sprintId: number | null) => {
    if (!token) return;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, sprintId } : t));
    try {
      await taskApi.updateTask(token, taskId, { sprintId } as never);
    } catch (e) {
      await load();
      const msg = e instanceof Error ? e.message : 'Failed to update sprint';
      setMutationError(msg);
    }
  }, [token, load]);

  return { tasks, labels, loading, error, mutationError, createTask, updateTask, moveTask, deleteTask, addTaskLabel, removeTaskLabel, createLabel, fetchLabels, addDependency, removeDependency, activity, activityLoading, fetchActivity, subtasks, fetchSubtasks, createSubtask, toggleSubtask, deleteSubtask, comments, fetchComments, fetchModalData, addComment, deleteComment, sprints, fetchSprints, createSprint, deleteSprint, setTaskSprint, reload: load };
}

export function useBoards(token: string | null) {
  const [boards, setBoards]   = useState<Board[]>([]);
  const [loading, setLoading] = useState(false);
  // Fix A5: error state for board loading
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setBoards(await taskApi.getBoards(token));
    } catch (e) {
      // Fix A5: proper catch block instead of silently swallowing
      setError(e instanceof Error ? e.message : 'Failed to load boards');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const createBoard = async (name: string): Promise<Board | undefined> => {
    if (!token) return undefined;
    const board = await taskApi.createBoard(token, name);
    setBoards(prev => [board, ...prev]);
    return board;
  };

  const deleteBoard = async (id: number) => {
    if (!token) return;
    await taskApi.deleteBoard(token, id);
    setBoards(prev => prev.filter(b => b.id !== id));
  };

  const updateBoardColumns = useCallback(async (boardId: number, columns: BoardColumn[]) => {
    if (!token) return;
    try {
      const updated = await taskApi.updateBoardColumns(token, boardId, columns);
      setBoards(prev => prev.map(b => b.id === boardId ? { ...b, columns: updated.columns } : b));
    } catch { /* ignore */ }
  }, [token]);

  // Fix A5: return error from hook
  return { boards, loading, error, createBoard, deleteBoard, updateBoardColumns };
}
