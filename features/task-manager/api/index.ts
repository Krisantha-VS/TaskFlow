import type { Board, Task, Label, TaskStatus, TaskPriority, ActivityLog, Subtask, Comment } from '../types';
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

  getLabels:   (token: string, boardId: number) =>
    req<Label[]>(`labels?board_id=${boardId}`, 'GET', undefined, token),
  createLabel: (token: string, boardId: number, name: string, color: string) =>
    req<Label>('labels', 'POST', { board_id: boardId, name, color }, token),
  deleteLabel: (token: string, id: number) =>
    req<null>(`labels/${id}`, 'DELETE', undefined, token),
  addTaskLabel: (token: string, taskId: number, labelId: number) =>
    req<unknown>(`tasks/${taskId}/labels`, 'POST', { labelId }, token),
  removeTaskLabel: (token: string, taskId: number, labelId: number) =>
    req<null>(`tasks/${taskId}/labels`, 'DELETE', { labelId }, token),

  getActivity: (token: string, boardId: number) =>
    req<ActivityLog[]>(`activity?board_id=${boardId}`, 'GET', undefined, token),

  getSubtasks:   (token: string, taskId: number) =>
    req<Subtask[]>(`tasks/${taskId}/subtasks`, 'GET', undefined, token),
  createSubtask: (token: string, taskId: number, title: string) =>
    req<Subtask>(`tasks/${taskId}/subtasks`, 'POST', { title }, token),
  updateSubtask: (token: string, id: number, data: Partial<Pick<Subtask, 'title' | 'completed' | 'position'>>) =>
    req<Subtask>(`subtasks/${id}`, 'PATCH', data, token),
  deleteSubtask: (token: string, id: number) =>
    req<null>(`subtasks/${id}`, 'DELETE', undefined, token),

  getComments:   (token: string, taskId: number) =>
    req<Comment[]>(`tasks/${taskId}/comments`, 'GET', undefined, token),
  createComment: (token: string, taskId: number, text: string) =>
    req<Comment>(`tasks/${taskId}/comments`, 'POST', { text }, token),
  updateComment: (token: string, id: number, text: string) =>
    req<Comment>(`comments/${id}`, 'PATCH', { text }, token),
  deleteComment: (token: string, id: number) =>
    req<null>(`comments/${id}`, 'DELETE', undefined, token),
};
