import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT, extractBearer } from '@/lib/jwt';
import { ok, fail, handleError, AuthError } from '@/lib/api';
import { checkRateLimit } from '@/lib/rate-limit';
import { TaskUpdateSchema } from '@/lib/validate';
import { logActivity } from '@/lib/activity';

async function getUser(req: NextRequest) {
  const payload = await verifyJWT(extractBearer(req.headers.get('authorization')));
  if (!payload?.sub) throw new AuthError('Invalid token');
  return payload.sub;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUser(req);
    if (!checkRateLimit(userId)) return fail('Too many requests', 429);
    const id = parseInt((await params).id);
    if (!id || id < 1) return fail('Invalid task id', 400);
    const body = TaskUpdateSchema.parse(await req.json());

    // Verify ownership
    const task = await db.task.findFirst({ where: { id, userId } });
    if (!task) return fail('Task not found', 404);

    const update: Record<string, unknown> = {};
    if (body.title !== undefined)       update.title       = body.title;
    if (body.description !== undefined) update.description = body.description ?? null;
    if (body.status !== undefined)      update.status      = body.status;
    if (body.priority !== undefined)    update.priority    = body.priority;
    if (body.position !== undefined)    update.position    = body.position;
    if ('due_date' in body)             update.dueDate     = body.due_date ? new Date(body.due_date) : null;

    // FIX: use updateMany with userId in where to prevent TOCTOU, then re-fetch
    await db.task.updateMany({ where: { id, userId }, data: update });
    const updated = await db.task.findFirst({ where: { id, userId } });
    const changes = Object.keys(update).join(', ');
    logActivity({ boardId: task.boardId, userId, action: 'updated', taskId: id, detail: changes });
    return ok(updated);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUser(req);
    if (!checkRateLimit(userId)) return fail('Too many requests', 429);
    const id = parseInt((await params).id);
    if (!id || id < 1) return fail('Invalid task id', 400);
    const task = await db.task.findFirst({ where: { id, userId } });
    if (!task) return fail('Task not found', 404);
    await db.task.delete({ where: { id } });
    logActivity({ boardId: task.boardId, userId, action: 'deleted', taskId: id, detail: task.title });
    return ok(null);
  } catch (e) {
    return handleError(e);
  }
}
