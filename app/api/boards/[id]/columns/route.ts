import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT, extractBearer } from '@/lib/jwt';
import { ok, fail, handleError, AuthError } from '@/lib/api';
import { BoardColumnsSchema } from '@/lib/validate';

async function getUser(req: NextRequest) {
  const payload = await verifyJWT(extractBearer(req.headers.get('authorization')));
  if (!payload?.sub) throw new AuthError('Invalid token');
  return payload.sub;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUser(req);
    const id = parseInt((await params).id);
    const board = await db.board.findFirst({ where: { id, userId } });
    if (!board) return fail('Board not found', 404);
    const columns = BoardColumnsSchema.parse(await req.json());
    const updated = await db.board.update({ where: { id }, data: { columns } });
    return ok(updated);
  } catch (e) { return handleError(e); }
}
