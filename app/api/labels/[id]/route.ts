import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT, extractBearer } from '@/lib/jwt';
import { ok, fail, handleError, AuthError } from '@/lib/api';

async function getUser(req: NextRequest) {
  const payload = await verifyJWT(extractBearer(req.headers.get('authorization')));
  if (!payload?.sub) throw new AuthError('Invalid token');
  return payload.sub;
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUser(req);
    const id = parseInt((await params).id);
    if (!id || id < 1) return fail('Invalid label id', 400);
    // Verify ownership via board
    const label = await db.label.findFirst({ where: { id }, include: { board: true } });
    if (!label || label.board.userId !== userId) return fail('Label not found', 404);
    await db.label.delete({ where: { id } });
    return ok(null);
  } catch (e) { return handleError(e); }
}
