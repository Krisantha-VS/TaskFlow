import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT, extractBearer } from '@/lib/jwt';
import { ok, fail, handleError, AuthError } from '@/lib/api';
import { checkRateLimit } from '@/lib/rate-limit';

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    // C6: JWT check FIRST, before any DB access
    const payload = await verifyJWT(extractBearer(req.headers.get('authorization')));
    if (!payload?.sub) throw new AuthError('Invalid token');
    const userId = payload.sub;

    if (!checkRateLimit(userId)) return fail('Too many requests', 429);

    const { token } = await params;
    const member = await db.boardMember.findUnique({ where: { inviteToken: token } });
    if (!member) return fail('Invalid or expired invite', 404);
    if (member.acceptedAt) return ok({ already: true, boardId: member.boardId });

    const updated = await db.boardMember.update({
      where: { inviteToken: token },
      data: { acceptedAt: new Date(), userId },
    });
    return ok({ boardId: updated.boardId, role: updated.role });
  } catch (e) { return handleError(e); }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    // JWT check first
    const payload = await verifyJWT(extractBearer(req.headers.get('authorization')));
    if (!payload?.sub) throw new AuthError('Invalid token');
    const userId = payload.sub;

    if (!checkRateLimit(userId)) return fail('Too many requests', 429);

    const { token } = await params;
    const member = await db.boardMember.findUnique({ where: { inviteToken: token } });
    if (!member) return fail('Invalid or expired invite', 404);
    if (member.acceptedAt) return ok({ already: true, boardId: member.boardId });

    // C7: verify the authenticated user's email matches inviteEmail if set
    if (member.inviteEmail) {
      const user = await db.user.findUnique({ where: { id: userId } });
      if (!user || user.email !== member.inviteEmail) {
        return fail('Invite is for a different email address', 403);
      }
    }

    const updated = await db.boardMember.update({
      where: { inviteToken: token },
      data: { acceptedAt: new Date(), userId },
    });
    return ok({ boardId: updated.boardId, role: updated.role });
  } catch (e) { return handleError(e); }
}
