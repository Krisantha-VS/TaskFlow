import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT, extractBearer } from '@/lib/jwt';
import { ok, fail, handleError, AuthError } from '@/lib/api';
import { SubtaskUpdateSchema } from '@/lib/validate';

async function getUser(req: NextRequest) {
  const payload = await verifyJWT(extractBearer(req.headers.get('authorization')));
  if (!payload?.sub) throw new AuthError('Invalid token');
  return payload.sub;
}

// Verify subtask ownership through task → userId
async function getSubtask(id: number, userId: string) {
  const subtask = await db.subtask.findFirst({
    where: { id },
    include: { task: { select: { userId: true } } },
  });
  if (!subtask || subtask.task.userId !== userId) return null;
  return subtask;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUser(req);
    const id = parseInt((await params).id);
    if (!id || id < 1) return fail('Invalid subtask id', 400);
    const subtask = await getSubtask(id, userId);
    if (!subtask) return fail('Subtask not found', 404);
    const body = SubtaskUpdateSchema.parse(await req.json());
    const updated = await db.subtask.update({ where: { id }, data: body });
    return ok(updated);
  } catch (e) { return handleError(e); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUser(req);
    const id = parseInt((await params).id);
    if (!id || id < 1) return fail('Invalid subtask id', 400);
    const subtask = await getSubtask(id, userId);
    if (!subtask) return fail('Subtask not found', 404);
    await db.subtask.delete({ where: { id } });
    return ok(null);
  } catch (e) { return handleError(e); }
}
