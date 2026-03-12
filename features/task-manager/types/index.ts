export type TaskStatus   = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface BoardColumn {
  key: string;
  label: string;
  color?: string;
}

export const DEFAULT_COLUMNS: BoardColumn[] = [
  { key: 'todo',        label: 'Todo' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'done',        label: 'Done' },
];

export interface Label {
  id: number;
  boardId: number;
  name: string;
  color: string;
}

export interface Board {
  id: number;
  user_id: string;
  name: string;
  created_at: string;
  columns?: BoardColumn[] | null;
}

export interface Subtask {
  id: number;
  taskId: number;
  title: string;
  completed: boolean;
  position: number;
  createdAt: string;
}

export interface Task {
  id: number;
  board_id: number;
  user_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  position: number;
  due_date: string | null; // Fix T2: required, nullable, not optional
  recurrence?: 'daily' | 'weekly' | 'monthly' | null;
  next_occurrence?: string | null;
  created_at: string;
  updated_at: string;
  labels?: Label[];
  subtasks?: Subtask[];
  blockedBy?: TaskDependency[];
  sprintId?: number | null;
}

export interface Sprint {
  id: number;
  boardId: number;
  name: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
}

export interface BoardMember {
  id: number;
  boardId: number;
  userId: string | null;
  role: string;
  inviteEmail: string;
  inviteToken: string;
  inviteUrl?: string;
  acceptedAt: string | null;
  createdAt: string;
}

export interface TaskDependency {
  id: number;
  blockerId: number;
  blockedId: number;
  blocker: { id: number; title: string };
}

export interface ActivityLog {
  id: number;
  taskId: number | null;
  boardId: number;
  userId: string;
  action: string;
  detail: string | null;
  createdAt: string;
}

export interface Comment {
  id: number;
  taskId: number;
  userId: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface BoardAnalytics {
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  dailyCompletions: { date: string; count: number }[];
  dailyCreated: { date: string; count: number }[];
  avgCompletionDays: number | null;
  total: number;
}

export const COLUMNS: { key: TaskStatus; label: string; color: string }[] = [
  { key: 'todo',        label: 'To Do',       color: 'border-t-slate-400'  },
  { key: 'in_progress', label: 'In Progress', color: 'border-t-amber-400'  },
  { key: 'done',        label: 'Done',        color: 'border-t-green-400'  },
];

export const PRIORITY_CONFIG: Record<TaskPriority, { label: string; classes: string }> = {
  low:    { label: 'Low',    classes: 'text-slate-400 bg-slate-400/10'  },
  medium: { label: 'Medium', classes: 'text-amber-400 bg-amber-400/10'  },
  high:   { label: 'High',   classes: 'text-red-400   bg-red-400/10'    },
};
