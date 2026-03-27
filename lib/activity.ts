import { db } from '@/lib/db';
import { pubsub } from '@/lib/pubsub';

// Map logActivity action strings to granular SSE event types
function actionToEventType(action: string): 'task_created' | 'task_updated' | 'task_deleted' | 'task_moved' {
  if (action === 'created') return 'task_created';
  if (action === 'deleted') return 'task_deleted';
  if (action === 'moved')   return 'task_moved';
  return 'task_updated';
}

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

    if (params.taskId && eventType !== 'task_deleted') {
      // Fetch the full task so the client can apply a granular state update
      const task = await db.task.findFirst({
        where: { id: params.taskId },
        include: {
          labels:    true,
          subtasks:  { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
          blockedBy: { include: { blocker: { select: { id: true, title: true } } } },
        },
      });
      pubsub.emit(params.boardId, { type: eventType, data: { task, taskId: params.taskId, action: params.action } });
    } else {
      // For deletes or board-level activity, send taskId only — client uses it to remove from state
      pubsub.emit(params.boardId, { type: eventType, data: { task: null, taskId: params.taskId ?? null, action: params.action } });
    }
  } catch (e) {
    console.error('Activity log failed:', e);
    // Activity logging is non-critical — never fail the main request
  }
}
