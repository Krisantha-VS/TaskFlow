import { db } from '@/lib/db';

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
  } catch {
    // Activity logging is non-critical — never fail the main request
  }
}
