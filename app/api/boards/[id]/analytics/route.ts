import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT, extractBearer } from '@/lib/jwt';
import { ok, fail, handleError, AuthError } from '@/lib/api';
import { checkRateLimit } from '@/lib/rate-limit';

async function getUser(req: NextRequest) {
  const payload = await verifyJWT(extractBearer(req.headers.get('authorization')));
  if (!payload?.sub) throw new AuthError('Invalid token');
  return payload.sub;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUser(req);
    if (!checkRateLimit(userId)) return fail('Too many requests', 429);
    const { id } = await params;
    const boardId = parseInt(id);
    if (!boardId || boardId < 1) return fail('Invalid board id', 400);

    const board = await db.board.findFirst({ where: { id: boardId, userId } });
    if (!board) return fail('Board not found', 404);

    const now = new Date();
    const day = 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = new Date(now.getTime() - 29 * day);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    // Run all DB queries in parallel
    const [
      tasks,
      rawCompletions,
      rawCreated,
    ] = await Promise.all([
      db.task.findMany({
        where: { boardId, deletedAt: null },
        select: { id: true, status: true, priority: true, createdAt: true, updatedAt: true },
      }),
      // Completions (done tasks) grouped by day — PostgreSQL quoted identifiers + TO_CHAR for string dates
      db.$queryRaw<{ date: string; count: bigint }[]>`
        SELECT TO_CHAR("updatedAt", 'YYYY-MM-DD') AS date, COUNT(*) AS count
        FROM "Task"
        WHERE "boardId" = ${boardId}
          AND status = 'done'::"Status"
          AND "updatedAt" >= ${thirtyDaysAgo}
          AND "deletedAt" IS NULL
        GROUP BY TO_CHAR("updatedAt", 'YYYY-MM-DD')
      `,
      // Creations grouped by day
      db.$queryRaw<{ date: string; count: bigint }[]>`
        SELECT TO_CHAR("createdAt", 'YYYY-MM-DD') AS date, COUNT(*) AS count
        FROM "Task"
        WHERE "boardId" = ${boardId}
          AND "createdAt" >= ${thirtyDaysAgo}
          AND "deletedAt" IS NULL
        GROUP BY TO_CHAR("createdAt", 'YYYY-MM-DD')
      `,
    ]);

    // Status breakdown
    const byStatus = { todo: 0, in_progress: 0, done: 0 } as Record<string, number>;
    for (const t of tasks) byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;

    // Priority breakdown
    const byPriority = { low: 0, medium: 0, high: 0 } as Record<string, number>;
    for (const t of tasks) byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;

    // Map SQL results to lookup maps keyed by date string
    const completionsMap = new Map<string, number>(
      rawCompletions.map(r => [r.date, Number(r.count)])
    );
    const createdMap = new Map<string, number>(
      rawCreated.map(r => [r.date, Number(r.count)])
    );

    // Build 30-day arrays using the SQL-aggregated maps
    const dailyCompletions: { date: string; count: number }[] = [];
    const dailyCreated: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const day_start = new Date(now.getTime() - i * day);
      day_start.setHours(0, 0, 0, 0);
      const dateStr = day_start.toISOString().slice(0, 10);
      dailyCompletions.push({ date: dateStr, count: completionsMap.get(dateStr) ?? 0 });
      dailyCreated.push({ date: dateStr, count: createdMap.get(dateStr) ?? 0 });
    }

    // Avg completion time (days) for done tasks
    const completed = tasks.filter(t => t.status === 'done');
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
