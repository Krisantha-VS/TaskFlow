import type { Board, Task, TaskStatus, TaskPriority } from '../types';
import { authFetch } from '../lib/auth-fetch';

const BASE = '/api';

async function req<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  token?: string,
): Promise<T> {
  const res = await authFetch(
    `${BASE}/${path}`,
    { method, body: body ? JSON.stringify(body) : undefined },
    token,
  );
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? json.code ?? 'Request failed');
  return json.data as T;
}

export const taskApi = {
  getBoards:   (token: string) =>
    req<Board[]>('boards', 'GET', undefined, token),
  createBoard: (token: string, name: string) =>
    req<Board>('boards', 'POST', { name }, token),
  renameBoard: (token: string, id: number, name: string) =>
    req<Board>(`boards/${id}`, 'PATCH', { name }, token),
  deleteBoard: (token: string, id: number) =>
    req<null>(`boards/${id}`, 'DELETE', undefined, token),

  getTasks:   (token: string, boardId: number) =>
    req<Task[]>(`tasks?board_id=${boardId}`, 'GET', undefined, token),
  createTask: (token: string, data: { board_id: number; title: string; description?: string; priority?: TaskPriority; status?: TaskStatus; due_date?: string | null }) =>
    req<Task>('tasks', 'POST', data, token),
  updateTask: (token: string, id: number, data: Partial<Omit<Task, 'id' | 'user_id' | 'board_id' | 'created_at' | 'updated_at'> & { due_date?: string | null }>) =>
    req<Task>(`tasks/${id}`, 'PATCH', data, token),
  deleteTask: (token: string, id: number) =>
    req<null>(`tasks/${id}`, 'DELETE', undefined, token),
};
