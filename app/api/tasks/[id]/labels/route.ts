import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT, extractBearer } from '@/lib/jwt';
import { ok, fail, handleError, AuthError } from '@/lib/api';
import { checkRateLimit } from '@/lib/rate-limit';
import { TaskLabelSchema } from '@/lib/validate';
import { logActivity } from '@/lib/activity';

async function getUser(req: NextRequest) {
  const payload = await verifyJWT(extractBearer(req.headers.get('authorization')));
  if (!payload?.sub) throw new AuthError('Invalid token');
  return payload.sub;
}

// POST — add label to task
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUser(req);
    if (!checkRateLimit(userId)) return fail('Too many requests', 429);
    const taskId = parseInt((await params).id);
    const { labelId } = TaskLabelSchema.parse(await req.json());
    const task = await db.task.findFirst({ where: { id: taskId, userId } });
    if (!task) return fail('Task not found', 404);
    // H1: verify the label belongs to the same board as the task
    const label = await db.label.findFirst({ where: { id: labelId, boardId: task.boardId } });
    if (!label) return fail('Label not found on this board', 404);
    await db.task.update({
      where: { id: taskId },
      data: { labels: { connect: { id: labelId } } },
    });
    const updated = await db.task.findFirst({ where: { id: taskId }, include: { labels: true } });
    logActivity({ boardId: task.boardId, userId, action: 'label_added', taskId, detail: `added label "${label.name}"` });
    return ok(updated);
  } catch (e) { return handleError(e); }
}

// DELETE — remove label from task
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUser(req);
    if (!checkRateLimit(userId)) return fail('Too many requests', 429);
    const taskId = parseInt((await params).id);
    const { labelId } = TaskLabelSchema.parse(await req.json());
    const task = await db.task.findFirst({ where: { id: taskId, userId } });
    if (!task) return fail('Task not found', 404);
    // H1: verify the label belongs to the same board as the task
    const label = await db.label.findFirst({ where: { id: labelId, boardId: task.boardId } });
    if (!label) return fail('Label not found on this board', 404);
    await db.task.update({
      where: { id: taskId },
      data: { labels: { disconnect: { id: labelId } } },
    });
    logActivity({ boardId: task.boardId, userId, action: 'label_removed', taskId, detail: `removed label "${label.name}"` });
    return ok(null);
  } catch (e) { return handleError(e); }
}
