import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT, extractBearer } from '@/lib/jwt';
import { ok, fail, handleError, AuthError } from '@/lib/api';
import { checkRateLimit } from '@/lib/rate-limit';
import { BoardUpdateSchema } from '@/lib/validate';

async function getUser(req: NextRequest) {
  const payload = await verifyJWT(extractBearer(req.headers.get('authorization')));
  if (!payload?.sub) throw new AuthError('Invalid token');
  return payload.sub;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUser(req);
    if (!checkRateLimit(userId)) return fail('Too many requests', 429);
    const id = parseInt((await params).id);
    if (!id || id < 1) return fail('Invalid board id', 400);
    const body = BoardUpdateSchema.parse(await req.json());

    // FIX: single update with userId in where — no separate findUnique
    const board = await db.board.updateMany({
      where: { id, userId },
      data: { name: body.name },
    });
    if (board.count === 0) return fail('Board not found', 404);

    // Safe: fetch with userId to confirm ownership
    const updated = await db.board.findFirst({ where: { id, userId } });
    return ok(updated);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUser(req);
    if (!checkRateLimit(userId)) return fail('Too many requests', 429);
    const id = parseInt((await params).id);
    if (!id || id < 1) return fail('Invalid board id', 400);
    const board = await db.board.findFirst({ where: { id, userId } });
    if (!board) return fail('Board not found', 404);
    await db.board.delete({ where: { id } });
    return ok(null);
  } catch (e) {
    return handleError(e);
  }
}
