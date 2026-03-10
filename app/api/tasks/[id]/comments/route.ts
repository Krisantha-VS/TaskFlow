import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT, extractBearer } from '@/lib/jwt';
import { ok, fail, handleError, AuthError } from '@/lib/api';
import { CommentCreateSchema } from '@/lib/validate';

async function getUser(req: NextRequest): Promise<string> {
  const payload = await verifyJWT(extractBearer(req.headers.get('authorization')));
  if (!payload?.sub) throw new AuthError('Invalid token');
  return payload.sub;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUser(req);
    const taskId = parseInt((await params).id);
    const task = await db.task.findFirst({ where: { id: taskId, userId } });
    if (!task) return fail('Task not found', 404);
    const comments = await db.comment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
    });
    return ok(comments);
  } catch (e) { return handleError(e); }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUser(req);
    const taskId = parseInt((await params).id);
    const task = await db.task.findFirst({ where: { id: taskId, userId } });
    if (!task) return fail('Task not found', 404);
    const body = CommentCreateSchema.parse(await req.json());
    const comment = await db.comment.create({ data: { taskId, userId, text: body.text } });
    return ok(comment, 201);
  } catch (e) { return handleError(e); }
}
