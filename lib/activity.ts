import { db } from '@/lib/db';
import { pubsub } from '@/lib/pubsub';

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
    pubsub.emit(params.boardId, { type: 'activity', data: { taskId: params.taskId ?? null, action: params.action } });
  } catch {
    // Activity logging is non-critical — never fail the main request
  }
}
