import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT, extractBearer } from '@/lib/jwt';
import { ok, fail, handleError, AuthError } from '@/lib/api';
import { checkRateLimit } from '@/lib/rate-limit';
import { SubtaskCreateSchema } from '@/lib/validate';

async function getUser(req: NextRequest) {
  const payload = await verifyJWT(extractBearer(req.headers.get('authorization')));
  if (!payload?.sub) throw new AuthError('Invalid token');
  return payload.sub;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUser(req);
    if (!checkRateLimit(userId)) return fail('Too many requests', 429);
    const taskId = parseInt((await params).id);
    const task = await db.task.findFirst({ where: { id: taskId, userId } });
    if (!task) return fail('Task not found', 404);
    const subtasks = await db.subtask.findMany({
      where: { taskId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    return ok(subtasks);
  } catch (e) { return handleError(e); }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUser(req);
    if (!checkRateLimit(userId)) return fail('Too many requests', 429);
    const taskId = parseInt((await params).id);
    const task = await db.task.findFirst({ where: { id: taskId, userId } });
    if (!task) return fail('Task not found', 404);
    const body = SubtaskCreateSchema.parse(await req.json());
    const subtask = await db.$transaction(async (tx) => {
      const count = await tx.subtask.count({ where: { taskId } });
      return tx.subtask.create({ data: { taskId, title: body.title, position: count } });
    });
    return ok(subtask, 201);
  } catch (e) { return handleError(e); }
}
