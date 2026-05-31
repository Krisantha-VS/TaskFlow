import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT, extractBearer } from '@/lib/jwt';
import { ok, fail, handleError, AuthError } from '@/lib/api';
import { checkRateLimit } from '@/lib/rate-limit';
import { CommentCreateSchema } from '@/lib/validate';
import { logActivity } from '@/lib/activity';
import { sendCommentEmail } from '@/lib/email';

async function getUser(req: NextRequest): Promise<{ sub: string; name?: string; email?: string }> {
  const payload = await verifyJWT(extractBearer(req.headers.get('authorization')));
  if (!payload?.sub) throw new AuthError('Invalid token');
  return payload;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUser(req);
    if (!checkRateLimit(user.sub)) return fail('Too many requests', 429);
    const taskId = parseInt((await params).id);
    const task = await db.task.findFirst({ where: { id: taskId, userId: user.sub } });
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
    const user = await getUser(req);
    if (!checkRateLimit(user.sub)) return fail('Too many requests', 429);
    const taskId = parseInt((await params).id);
    const task = await db.task.findFirst({ where: { id: taskId, userId: user.sub } });
    if (!task) return fail('Task not found', 404);
    const body = CommentCreateSchema.parse(await req.json());
    const comment = await db.comment.create({ data: { taskId, userId: user.sub, text: body.text } });

    logActivity({ boardId: task.boardId, userId: user.sub, action: 'commented', taskId, detail: body.text.substring(0, 100) });

    // Non-blocking email: notify assignee when someone else comments
    if (task.assigneeEmail && task.assigneeEmail !== user.email) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://taskflow-gamma-liard.vercel.app';
      const taskUrl = `${appUrl}/boards/${task.boardId}`;
      const commenterName = user.name ?? user.email ?? 'A teammate';
      sendCommentEmail(task.assigneeEmail, task.title, commenterName, body.text, taskUrl).catch(
        (err) => console.error('[email] sendCommentEmail failed:', err),
      );
    }

    return ok(comment, 201);
  } catch (e) { return handleError(e); }
}
