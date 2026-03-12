'use client';

import { useState, useEffect, useCallback } from 'react';
import { taskApi } from '../api';
import type { Board, Task, Label, TaskStatus, TaskPriority, ActivityLog, Subtask, Comment, BoardColumn, Sprint } from '../types';

export function useTasks(token: string | null, boardId: number | null) {
  const [tasks, setTasks]               = useState<Task[]>([]);
  const [labels, setLabels]             = useState<Label[]>([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  // Fix A6: mutation-level error state
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [sprints, setSprints]           = useState<Sprint[]>([]);

  const load = useCallback(async () => {
    if (!token || !boardId) return;
    setLoading(true);
    setError(null);
    try {
      const [tasksData, labelsData] = await Promise.all([
        taskApi.getTasks(token, boardId),
        taskApi.getLabels(token, boardId),
      ]);
      setTasks(tasksData);
      setLabels(labelsData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [token, boardId]);

  useEffect(() => { load(); }, [load]);

  // SSE: subscribe to board stream for real-time updates
  useEffect(() => {
    if (!token || !boardId) return;

    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(`/api/boards/${boardId}/stream`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!res.ok || !res.body) return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
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
              if (event.type === 'activity') {
                // Re-fetch tasks to reflect the change
                load();
              }
            } catch { /* ignore parse errors */ }
          }
        }
      } catch { /* connection closed or aborted */ }
    })();

    return () => controller.abort();
  }, [token, boardId, load]);

  // Fix A6: createTask — wrapped in try/catch, returns { error }
  const createTask = async (
    title: string,
    priority: TaskPriority = 'medium',
    description = '',
  ): Promise<{ error: string | null; task?: Task }> => {
    if (!token || !boardId) return { error: 'Not authenticated' };
    setMutationError(null);
    try {
      const task = await taskApi.createTask(token, { board_id: boardId, title, priority, description });
      setTasks(prev => [...prev, task]);
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
      const updated = await taskApi.updateTask(token, id, data);
      setTasks(prev => prev.map(t => t.id === id ? updated : t));
      return { error: null, task: updated };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to update task';
      setMutationError(msg);
      return { error: msg };
    }
  };

  // Fix A6: moveTask — optimistic update with rollback on failure
  const moveTask = async (id: number, status: TaskStatus): Promise<{ error: string | null }> => {
    if (!token) return { error: 'Not authenticated' };
    setMutationError(null);

    // Optimistic update
    const prev = tasks.find(t => t.id === id);
    setTasks(current => current.map(t => t.id === id ? { ...t, status } : t));

    try {
      const updated = await taskApi.updateTask(token, id, { status });
      setTasks(current => current.map(t => t.id === id ? updated : t));
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
      return { error: null };
    } catch (e) {
      // Rollback
      if (task) setTasks(prev => [...prev, task]);
      const msg = e instanceof Error ? e.message : 'Failed to delete task';
      setMutationError(msg);
      return { error: msg };
    }
  };

  const addTaskLabel = async (taskId: number, labelId: number): Promise<void> => {
    if (!token) return;
    await taskApi.addTaskLabel(token, taskId, labelId);
    // Update local task labels state
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      const label = labels.find(l => l.id === labelId);
      if (!label) return t;
      const existing = t.labels ?? [];
      if (existing.find(l => l.id === labelId)) return t;
      return { ...t, labels: [...existing, label] };
    }));
  };

  const removeTaskLabel = async (taskId: number, labelId: number): Promise<void> => {
    if (!token) return;
    await taskApi.removeTaskLabel(token, taskId, labelId);
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      return { ...t, labels: (t.labels ?? []).filter(l => l.id !== labelId) };
    }));
  };

  const addDependency = useCallback(async (taskId: number, blockerId: number) => {
    if (!token) return;
    try {
      await taskApi.addDependency(token, taskId, blockerId);
      // Reload to get fresh blockedBy array
      await load();
    } catch { /* ignore */ }
  }, [token, load]);

  const removeDependency = useCallback(async (taskId: number, blockerId: number) => {
    if (!token) return;
    // Optimistic
    setTasks(prev => prev.map(t => t.id === taskId
      ? { ...t, blockedBy: (t.blockedBy ?? []).filter(d => d.blockerId !== blockerId) }
      : t
    ));
    try {
      await taskApi.removeDependency(token, taskId, blockerId);
    } catch {
      await load();
    }
  }, [token, load]);

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
      const logs = await taskApi.getActivity(token, boardId);
      setActivity(logs.filter(l => l.taskId === taskId || l.taskId === null));
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

  const createSubtask = useCallback(async (taskId: number, title: string) => {
    if (!token) return;
    try {
      const subtask = await taskApi.createSubtask(token, taskId, title);
      setSubtasks(prev => ({ ...prev, [taskId]: [...(prev[taskId] ?? []), subtask] }));
    } catch { /* ignore */ }
  }, [token]);

  const toggleSubtask = useCallback(async (taskId: number, subtaskId: number, completed: boolean) => {
    if (!token) return;
    // Optimistic update
    setSubtasks(prev => ({
      ...prev,
      [taskId]: (prev[taskId] ?? []).map(s => s.id === subtaskId ? { ...s, completed } : s),
    }));
    try {
      await taskApi.updateSubtask(token, subtaskId, { completed });
    } catch {
      // Rollback
      setSubtasks(prev => ({
        ...prev,
        [taskId]: (prev[taskId] ?? []).map(s => s.id === subtaskId ? { ...s, completed: !completed } : s),
      }));
    }
  }, [token]);

  const deleteSubtask = useCallback(async (taskId: number, subtaskId: number) => {
    if (!token) return;
    setSubtasks(prev => ({ ...prev, [taskId]: (prev[taskId] ?? []).filter(s => s.id !== subtaskId) }));
    try {
      await taskApi.deleteSubtask(token, subtaskId);
    } catch { /* ignore */ }
  }, [token]);

  const [comments, setComments] = useState<Record<number, Comment[]>>({});

  const fetchComments = useCallback(async (taskId: number) => {
    if (!token) return;
    try {
      const data = await taskApi.getComments(token, taskId);
      setComments(prev => ({ ...prev, [taskId]: data }));
    } catch { /* non-critical */ }
  }, [token]);

  const addComment = useCallback(async (taskId: number, text: string) => {
    if (!token) return;
    try {
      const comment = await taskApi.createComment(token, taskId, text);
      setComments(prev => ({ ...prev, [taskId]: [...(prev[taskId] ?? []), comment] }));
    } catch { /* ignore */ }
  }, [token]);

  const deleteComment = useCallback(async (taskId: number, commentId: number) => {
    if (!token) return;
    setComments(prev => ({ ...prev, [taskId]: (prev[taskId] ?? []).filter(c => c.id !== commentId) }));
    try {
      await taskApi.deleteComment(token, commentId);
    } catch { /* ignore */ }
  }, [token]);

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
    try { await taskApi.updateTask(token, taskId, { sprintId } as never); } catch { await load(); }
  }, [token, load]);

  return { tasks, labels, loading, error, mutationError, createTask, updateTask, moveTask, deleteTask, addTaskLabel, removeTaskLabel, createLabel, addDependency, removeDependency, activity, activityLoading, fetchActivity, subtasks, fetchSubtasks, createSubtask, toggleSubtask, deleteSubtask, comments, fetchComments, addComment, deleteComment, sprints, fetchSprints, createSprint, deleteSprint, setTaskSprint, reload: load };
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
