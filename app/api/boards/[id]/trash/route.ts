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
    const boardId = parseInt((await params).id);
    if (!boardId || boardId < 1) return fail('Invalid board id', 400);
    const board = await db.board.findFirst({ where: { id: boardId, userId } });
    if (!board) return fail('Board not found', 404);
    const tasks = await db.task.findMany({
      where: { boardId, userId, deletedAt: { not: null } },
      select: { id: true, title: true, priority: true, deletedAt: true },
      orderBy: { deletedAt: 'desc' },
    });
    return ok(tasks);
  } catch (e) {
    return handleError(e);
  }
}
