import { db } from '@/lib/db';
import { pubsub } from '@/lib/pubsub';

// Map logActivity action strings to granular SSE event types
function actionToEventType(action: string): 'task_created' | 'task_updated' | 'task_deleted' | 'task_moved' | 'task_labeled' | 'task_blocked' | 'subtask_updated' {
  if (action === 'created') return 'task_created';
  if (action === 'deleted') return 'task_deleted';
  if (action === 'moved')   return 'task_moved';
  if (action === 'label_added' || action === 'label_removed') return 'task_labeled';
  if (action === 'blocked' || action === 'unblocked') return 'task_blocked';
  if (action === 'subtask_added' || action === 'subtask_toggled' || action === 'subtask_deleted') return 'subtask_updated';
  return 'task_updated';
}

// Actions that should trigger a full SSE refresh with task payload
const FULL_REFRESH_ACTIONS = new Set(['created', 'updated', 'moved', 'deleted', 'label_added', 'label_removed', 'blocked', 'unblocked', 'subtask_added', 'subtask_toggled', 'subtask_deleted']);

export async function logActivity(params: {
  boardId: number;
  userId: string;
  action: string;
  taskId?: number;
  detail?: string;
}) {
  try {
    await db.activityLog.create({
      data: {
        boardId: params.boardId,
        userId:  params.userId,
        action:  params.action,
        taskId:  params.taskId ?? null,
        detail:  params.detail ?? null,
      },
    });

    const eventType = actionToEventType(params.action);

    if (params.taskId && eventType !== 'task_deleted' && FULL_REFRESH_ACTIONS.has(params.action)) {
      // Fetch the full task so the client can apply a granular state update
      const task = await db.task.findFirst({
        where: { id: params.taskId },
        include: {
          labels:    true,
          subtasks:  { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
          blockedBy: { include: { blocker: { select: { id: true, title: true, issueNumber: true } } } },
          blocking:  { include: { blocked: { select: { id: true, title: true, issueNumber: true } } } },
        },
      });
      pubsub.emit(params.boardId, { type: eventType, data: { task, taskId: params.taskId, action: params.action } });
    } else if (params.taskId) {
      // For deletes or lightweight actions — send taskId only
      pubsub.emit(params.boardId, { type: eventType, data: { task: null, taskId: params.taskId, action: params.action } });
    }
  } catch (e) {
    console.error('Activity log failed:', e);
    // Activity logging is non-critical — never fail the main request
  }
}
