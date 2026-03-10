import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT, extractBearer } from '@/lib/jwt';
import { ok, fail, handleError, AuthError } from '@/lib/api';
import { LabelCreateSchema } from '@/lib/validate';

async function getUser(req: NextRequest) {
  const payload = await verifyJWT(extractBearer(req.headers.get('authorization')));
  if (!payload?.sub) throw new AuthError('Invalid token');
  return payload.sub;
}

// GET /api/labels?board_id=X
export async function GET(req: NextRequest) {
  try {
    const userId = await getUser(req);
    const boardId = parseInt(req.nextUrl.searchParams.get('board_id') ?? '');
    if (!boardId || boardId < 1) return fail('board_id required', 400);
    const board = await db.board.findFirst({ where: { id: boardId, userId } });
    if (!board) return fail('Board not found', 404);
    const labels = await db.label.findMany({ where: { boardId }, orderBy: { name: 'asc' } });
    return ok(labels);
  } catch (e) { return handleError(e); }
}

// POST /api/labels — create label for a board
export async function POST(req: NextRequest) {
  try {
    const userId = await getUser(req);
    const body = await req.json();
    const boardId = parseInt(body.board_id);
    if (!boardId || boardId < 1) return fail('board_id required', 400);
    const board = await db.board.findFirst({ where: { id: boardId, userId } });
    if (!board) return fail('Board not found', 404);
    const data = LabelCreateSchema.parse(body);
    const label = await db.label.create({ data: { boardId, name: data.name, color: data.color } });
    return ok(label, 201);
  } catch (e) { return handleError(e); }
}
