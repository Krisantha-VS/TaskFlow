import { z } from 'zod';

export const BoardCreateSchema = z.object({
  name: z.string().min(1, 'Name required').max(100, 'Name max 100 chars').trim(),
});

export const BoardUpdateSchema = z.object({
  name: z.string().min(1, 'Name required').max(100, 'Name max 100 chars').trim(),
});

const STATUS = ['todo', 'in_progress', 'done'] as const;
const PRIORITY = ['low', 'medium', 'high'] as const;

export const TaskCreateSchema = z.object({
  board_id: z.number({ error: 'board_id required' }).int().positive(),
  title: z.string().min(1, 'Title required').max(200, 'Title max 200 chars').trim(),
  description: z.string().max(5000, 'Description max 5000 chars').optional().nullable(),
  status: z.enum(STATUS).optional(),
  priority: z.enum(PRIORITY).optional(),
  due_date: z.string().datetime({ offset: true }).optional().nullable(),
});

export const TaskUpdateSchema = z.object({
  title: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(5000).optional().nullable(),
  status: z.enum(STATUS).optional(),
  priority: z.enum(PRIORITY).optional(),
  position: z.number().int().min(0).optional(),
  due_date: z.string().datetime({ offset: true }).optional().nullable(),
});

export const LabelCreateSchema = z.object({
  name:  z.string().min(1).max(50).trim(),
  color: z.enum(['blue','green','red','yellow','purple','pink','orange','gray']).default('blue'),
});

export const TaskLabelSchema = z.object({
  labelId: z.number().int().positive(),
});

export const SubtaskCreateSchema = z.object({
  title: z.string().min(1).max(200).trim(),
});

export const SubtaskUpdateSchema = z.object({
  title:     z.string().min(1).max(200).trim().optional(),
  completed: z.boolean().optional(),
  position:  z.number().int().min(0).optional(),
});

export const CommentCreateSchema = z.object({
  text: z.string().min(1, 'Comment cannot be empty').max(2000).trim(),
});
