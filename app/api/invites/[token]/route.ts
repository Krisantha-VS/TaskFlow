import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT, extractBearer } from '@/lib/jwt';
import { ok, fail, handleError } from '@/lib/api';

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const member = await db.boardMember.findUnique({ where: { inviteToken: token } });
    if (!member) return fail('Invalid or expired invite', 404);
    if (member.acceptedAt) return ok({ already: true, boardId: member.boardId });

    const payload = await verifyJWT(extractBearer(req.headers.get('authorization')));
    const updated = await db.boardMember.update({
      where: { inviteToken: token },
      data: { acceptedAt: new Date(), userId: payload?.sub ?? null },
    });
    return ok({ boardId: updated.boardId, role: updated.role });
  } catch (e) { return handleError(e); }
}
