import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT, extractBearer } from '@/lib/jwt';
import { ok, fail, handleError, AuthError } from '@/lib/api';

async function getUser(req: NextRequest) {
  const payload = await verifyJWT(extractBearer(req.headers.get('authorization')));
  if (!payload?.sub) throw new AuthError('Invalid token');
  return payload.sub;
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getUser(req);
    const boardId = parseInt(req.nextUrl.searchParams.get('board_id') ?? '');
    if (!boardId || boardId < 1) return fail('board_id required', 400);
    const board = await db.board.findFirst({ where: { id: boardId, userId } });
    if (!board) return fail('Board not found', 404);
    const logs = await db.activityLog.findMany({
      where: { boardId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return ok(logs);
  } catch (e) { return handleError(e); }
}
