import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT, extractBearer } from '@/lib/jwt';
import { ok, fail, handleError, AuthError } from '@/lib/api';
import { z } from 'zod/v4';

async function getUser(req: NextRequest) {
  const payload = await verifyJWT(extractBearer(req.headers.get('authorization')));
  if (!payload?.sub) throw new AuthError('Invalid token');
  return payload.sub;
}

const BodySchema = z.object({ blocker_id: z.number().int().positive() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const taskId = parseInt(id);
  try {
    const userId = await getUser(req);
    const { blocker_id } = BodySchema.parse(await req.json());

    // Verify task ownership
    const task = await db.task.findFirst({ where: { id: taskId, userId } });
    if (!task) return fail('Task not found', 404);

    // Self-block guard
    if (blocker_id === taskId) return fail('Cannot block self', 400);

    // Verify blocker exists in same board
    const blocker = await db.task.findFirst({ where: { id: blocker_id, boardId: task.boardId } });
    if (!blocker) return fail('Blocker task not found', 404);

    // Circular dependency guard
    const circular = await db.taskDependency.findFirst({
      where: { blockerId: taskId, blockedId: blocker_id },
    });
    if (circular) return fail('Circular dependency', 400);

    const dep = await db.taskDependency.upsert({
      where: { blockerId_blockedId: { blockerId: blocker_id, blockedId: taskId } },
      update: {},
      create: { blockerId: blocker_id, blockedId: taskId },
    });
    return ok(dep, 201);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const taskId = parseInt(id);
  try {
    const userId = await getUser(req);
    const { blocker_id } = BodySchema.parse(await req.json());

    // Verify task ownership
    const task = await db.task.findFirst({ where: { id: taskId, userId } });
    if (!task) return fail('Task not found', 404);

    await db.taskDependency.deleteMany({
      where: { blockerId: blocker_id, blockedId: taskId },
    });
    return ok(null);
  } catch (e) {
    return handleError(e);
  }
}
