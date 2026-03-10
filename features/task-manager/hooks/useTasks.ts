'use client';

import { useState, useEffect, useCallback } from 'react';
import { taskApi } from '../api';
import type { Board, Task, TaskStatus, TaskPriority } from '../types';

export function useTasks(token: string | null, boardId: number | null) {
  const [tasks, setTasks]               = useState<Task[]>([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  // Fix A6: mutation-level error state
  const [mutationError, setMutationError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !boardId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await taskApi.getTasks(token, boardId);
      setTasks(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [token, boardId]);

  useEffect(() => { load(); }, [load]);

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

  return { tasks, loading, error, mutationError, createTask, updateTask, moveTask, deleteTask, reload: load };
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

  // Fix A5: return error from hook
  return { boards, loading, error, createBoard, deleteBoard };
}
