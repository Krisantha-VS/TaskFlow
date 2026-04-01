import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT, extractBearer } from '@/lib/jwt';
import { ok, fail, handleError, AuthError } from '@/lib/api';
import { checkRateLimit } from '@/lib/rate-limit';
import { z } from 'zod/v4';

async function getUser(req: NextRequest) {
  const payload = await verifyJWT(extractBearer(req.headers.get('authorization')));
  if (!payload?.sub) throw new AuthError('Invalid token');
  return payload.sub;
}

// GET /api/sprints?board_id=X
export async function GET(req: NextRequest) {
  try {
    const userId = await getUser(req);
    if (!checkRateLimit(userId)) return fail('Too many requests', 429);
    const boardId = parseInt(req.nextUrl.searchParams.get('board_id') ?? '');
    if (!boardId) return fail('board_id required', 400);
    const board = await db.board.findFirst({ where: { id: boardId, userId } });
    if (!board) return fail('Board not found', 404);
    const sprints = await db.sprint.findMany({ where: { boardId }, orderBy: { createdAt: 'asc' } });
    return ok(sprints);
  } catch (e) { return handleError(e); }
}

// POST /api/sprints — create sprint
export async function POST(req: NextRequest) {
  try {
    const userId = await getUser(req);
    if (!checkRateLimit(userId)) return fail('Too many requests', 429);
    const body = z.object({
      board_id: z.number().int().positive(),
      name: z.string().min(1).max(100),
      start_date: z.string().datetime({ offset: true }).optional().nullable(),
      end_date: z.string().datetime({ offset: true }).optional().nullable(),
    }).parse(await req.json());
    const board = await db.board.findFirst({ where: { id: body.board_id, userId } });
    if (!board) return fail('Board not found', 404);
    const sprint = await db.sprint.create({
      data: {
        boardId: body.board_id,
        name: body.name,
        startDate: body.start_date ? new Date(body.start_date) : null,
        endDate: body.end_date ? new Date(body.end_date) : null,
      },
    });
    return ok(sprint, 201);
  } catch (e) { return handleError(e); }
}
