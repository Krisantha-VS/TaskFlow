export type TaskStatus   = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

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
  created_at: string;
  updated_at: string;
  labels?: Label[];
  subtasks?: Subtask[];
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
