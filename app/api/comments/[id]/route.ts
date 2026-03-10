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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUser(req);
    const id = parseInt((await params).id);
    const comment = await db.comment.findFirst({ where: { id, userId } });
    if (!comment) return fail('Comment not found', 404);
    const { text } = CommentCreateSchema.parse(await req.json());
    const updated = await db.comment.update({ where: { id }, data: { text } });
    return ok(updated);
  } catch (e) { return handleError(e); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUser(req);
    const id = parseInt((await params).id);
    const comment = await db.comment.findFirst({ where: { id, userId } });
    if (!comment) return fail('Comment not found', 404);
    await db.comment.delete({ where: { id } });
    return ok(null);
  } catch (e) { return handleError(e); }
}
