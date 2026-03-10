import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT, extractBearer } from '@/lib/jwt';
import { ok, fail, handleError, AuthError } from '@/lib/api';
import { checkRateLimit } from '@/lib/rate-limit';
import { TaskCreateSchema } from '@/lib/validate';

async function getUser(req: NextRequest) {
  const payload = await verifyJWT(extractBearer(req.headers.get('authorization')));
  if (!payload?.sub) throw new AuthError('Invalid token');
  return payload.sub;
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getUser(req);
    if (!checkRateLimit(userId)) return fail('Too many requests', 429);
    const boardId = parseInt(req.nextUrl.searchParams.get('board_id') ?? '');
    if (!boardId || boardId < 1) return fail('board_id required', 400);
    const board = await db.board.findFirst({ where: { id: boardId, userId } });
    if (!board) return fail('Board not found', 404);
    const tasks = await db.task.findMany({
      where: { boardId },
      orderBy: [{ status: 'asc' }, { position: 'asc' }, { createdAt: 'asc' }],
    });
    return ok(tasks);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUser(req);
    if (!checkRateLimit(userId)) return fail('Too many requests', 429);
    const body = TaskCreateSchema.parse(await req.json());
    const board = await db.board.findFirst({ where: { id: body.board_id, userId } });
    if (!board) return fail('Board not found', 404);
    const task = await db.task.create({
      data: {
        boardId:     body.board_id,
        userId,
        title:       body.title,
        description: body.description ?? null,
        status:      body.status   ?? 'todo',
        priority:    body.priority ?? 'medium',
        dueDate:     body.due_date ? new Date(body.due_date) : null,
      },
    });
    return ok(task, 201);
  } catch (e) {
    return handleError(e);
  }
}
