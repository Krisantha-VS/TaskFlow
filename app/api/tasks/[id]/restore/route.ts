import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT, extractBearer } from '@/lib/jwt';
import { ok, fail, handleError, AuthError } from '@/lib/api';
import { checkRateLimit } from '@/lib/rate-limit';
import { logActivity } from '@/lib/activity';

async function getUser(req: NextRequest) {
  const payload = await verifyJWT(extractBearer(req.headers.get('authorization')));
  if (!payload?.sub) throw new AuthError('Invalid token');
  return payload.sub;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUser(req);
    if (!checkRateLimit(userId)) return fail('Too many requests', 429);
    const id = parseInt((await params).id);
    if (!id || id < 1) return fail('Invalid task id', 400);
    const task = await db.task.findFirst({ where: { id, userId, deletedAt: { not: null } } });
    if (!task) return fail('Task not found in trash', 404);
    await db.task.update({ where: { id }, data: { deletedAt: null } });
    logActivity({ boardId: task.boardId, userId, action: 'updated', taskId: id, detail: `restored "${task.title}"` });
    return ok(null);
  } catch (e) {
    return handleError(e);
  }
}
