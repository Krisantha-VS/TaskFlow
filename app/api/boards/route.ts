import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT, extractBearer } from '@/lib/jwt';
import { ok, fail, handleError, AuthError } from '@/lib/api';
import { checkRateLimit } from '@/lib/rate-limit';
import { BoardCreateSchema } from '@/lib/validate';

async function getUser(req: NextRequest) {
  const payload = await verifyJWT(extractBearer(req.headers.get('authorization')));
  if (!payload?.sub) throw new AuthError('Invalid token');
  return payload.sub;
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getUser(req);
    if (!checkRateLimit(userId)) return fail('Too many requests', 429);
    const boards = await db.board.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return ok(boards);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUser(req);
    if (!checkRateLimit(userId)) return fail('Too many requests', 429);
    const body = BoardCreateSchema.parse(await req.json());
    const board = await db.board.create({ data: { userId, name: body.name } });
    return ok(board, 201);
  } catch (e) {
    return handleError(e);
  }
}
