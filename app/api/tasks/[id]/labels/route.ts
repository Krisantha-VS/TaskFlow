import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT, extractBearer } from '@/lib/jwt';
import { ok, fail, handleError, AuthError } from '@/lib/api';
import { TaskLabelSchema } from '@/lib/validate';

async function getUser(req: NextRequest) {
  const payload = await verifyJWT(extractBearer(req.headers.get('authorization')));
  if (!payload?.sub) throw new AuthError('Invalid token');
  return payload.sub;
}

// POST — add label to task
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUser(req);
    const taskId = parseInt((await params).id);
    const { labelId } = TaskLabelSchema.parse(await req.json());
    const task = await db.task.findFirst({ where: { id: taskId, userId } });
    if (!task) return fail('Task not found', 404);
    await db.task.update({
      where: { id: taskId },
      data: { labels: { connect: { id: labelId } } },
    });
    const updated = await db.task.findFirst({ where: { id: taskId }, include: { labels: true } });
    return ok(updated);
  } catch (e) { return handleError(e); }
}

// DELETE — remove label from task
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUser(req);
    const taskId = parseInt((await params).id);
    const { labelId } = TaskLabelSchema.parse(await req.json());
    const task = await db.task.findFirst({ where: { id: taskId, userId } });
    if (!task) return fail('Task not found', 404);
    await db.task.update({
      where: { id: taskId },
      data: { labels: { disconnect: { id: labelId } } },
    });
    return ok(null);
  } catch (e) { return handleError(e); }
}
