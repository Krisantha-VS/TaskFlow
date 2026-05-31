import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT, extractBearer } from '@/lib/jwt';
import { ok, fail, handleError, AuthError } from '@/lib/api';
import { checkRateLimit } from '@/lib/rate-limit';
import { SubtaskUpdateSchema } from '@/lib/validate';
import { logActivity } from '@/lib/activity';

async function getUser(req: NextRequest) {
  const payload = await verifyJWT(extractBearer(req.headers.get('authorization')));
  if (!payload?.sub) throw new AuthError('Invalid token');
  return payload.sub;
}

// Verify subtask ownership through task → userId
async function getSubtask(id: number, userId: string) {
  const subtask = await db.subtask.findFirst({
    where: { id },
    include: { task: { select: { userId: true, boardId: true } } },
  });
  if (!subtask || subtask.task.userId !== userId) return null;
  return subtask;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUser(req);
    if (!checkRateLimit(userId)) return fail('Too many requests', 429);
    const id = parseInt((await params).id);
    if (!id || id < 1) return fail('Invalid subtask id', 400);
    const subtask = await getSubtask(id, userId);
    if (!subtask) return fail('Subtask not found', 404);
    const body = SubtaskUpdateSchema.parse(await req.json());
    const updated = await db.subtask.update({ where: { id }, data: body });
    if ('completed' in body) {
      logActivity({ boardId: subtask.task.boardId, userId, action: 'subtask_toggled', taskId: subtask.taskId, detail: `subtask "${subtask.title}" ${body.completed ? 'completed' : 'reopened'}` });
    }
    return ok(updated);
  } catch (e) { return handleError(e); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUser(req);
    if (!checkRateLimit(userId)) return fail('Too many requests', 429);
    const id = parseInt((await params).id);
    if (!id || id < 1) return fail('Invalid subtask id', 400);
    const subtask = await getSubtask(id, userId);
    if (!subtask) return fail('Subtask not found', 404);
    await db.subtask.delete({ where: { id } });
    logActivity({ boardId: subtask.task.boardId, userId, action: 'subtask_deleted', taskId: subtask.taskId, detail: `deleted subtask "${subtask.title}"` });
    return ok(null);
  } catch (e) { return handleError(e); }
}
