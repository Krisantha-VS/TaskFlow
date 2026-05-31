import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT, extractBearer } from '@/lib/jwt';
import { ok, fail, handleError, AuthError } from '@/lib/api';
import { checkRateLimit } from '@/lib/rate-limit';
import { SubtaskCreateSchema } from '@/lib/validate';
import { logActivity } from '@/lib/activity';

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
    const count = await db.subtask.count({ where: { taskId } });
    const subtask = await db.subtask.create({ data: { taskId, title: body.title, position: count } });
    logActivity({ boardId: task.boardId, userId, action: 'subtask_added', taskId, detail: `added subtask "${body.title}"` });
    return ok(subtask, 201);
  } catch (e) { return handleError(e); }
}
