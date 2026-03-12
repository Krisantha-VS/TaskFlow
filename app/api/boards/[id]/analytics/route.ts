import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT, extractBearer } from '@/lib/jwt';
import { ok, fail, handleError, AuthError } from '@/lib/api';

async function getUser(req: NextRequest) {
  const payload = await verifyJWT(extractBearer(req.headers.get('authorization')));
  if (!payload?.sub) throw new AuthError('Invalid token');
  return payload.sub;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUser(req);
    const { id } = await params;
    const boardId = parseInt(id);
    if (!boardId || boardId < 1) return fail('Invalid board id', 400);

    const board = await db.board.findFirst({ where: { id: boardId, userId } });
    if (!board) return fail('Board not found', 404);

    const tasks = await db.task.findMany({
      where: { boardId },
      select: { id: true, status: true, priority: true, createdAt: true, updatedAt: true },
    });

    const now = new Date();
    const day = 24 * 60 * 60 * 1000;

    // Status breakdown
    const byStatus = { todo: 0, in_progress: 0, done: 0 } as Record<string, number>;
    for (const t of tasks) byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;

    // Priority breakdown
    const byPriority = { low: 0, medium: 0, high: 0 } as Record<string, number>;
    for (const t of tasks) byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;

    // Completions per day for last 30 days
    const completed = tasks.filter(t => t.status === 'done');
    const dailyCompletions: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const day_start = new Date(now.getTime() - i * day);
      day_start.setHours(0, 0, 0, 0);
      const day_end = new Date(day_start.getTime() + day);
      const dateStr = day_start.toISOString().slice(0, 10);
      const count = completed.filter(t => {
        const d = new Date(t.updatedAt);
        return d >= day_start && d < day_end;
      }).length;
      dailyCompletions.push({ date: dateStr, count });
    }

    // Created per day for last 30 days
    const dailyCreated: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const day_start = new Date(now.getTime() - i * day);
      day_start.setHours(0, 0, 0, 0);
      const day_end = new Date(day_start.getTime() + day);
      const dateStr = day_start.toISOString().slice(0, 10);
      const count = tasks.filter(t => {
        const d = new Date(t.createdAt);
        return d >= day_start && d < day_end;
      }).length;
      dailyCreated.push({ date: dateStr, count });
    }

    // Avg completion time (days) for done tasks
    const completionTimes = completed.map(t =>
      (new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime()) / day
    );
    const avgCompletionDays = completionTimes.length
      ? Math.round((completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length) * 10) / 10
      : null;

    return ok({ byStatus, byPriority, dailyCompletions, dailyCreated, avgCompletionDays, total: tasks.length });
  } catch (e) {
    return handleError(e);
  }
}
