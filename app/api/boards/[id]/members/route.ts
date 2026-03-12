import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT, extractBearer } from '@/lib/jwt';
import { ok, fail, handleError, AuthError } from '@/lib/api';
import { z } from 'zod/v4';
import { sendInviteEmail } from '@/lib/email';
import { randomBytes } from 'crypto';

async function getUser(req: NextRequest) {
  const payload = await verifyJWT(extractBearer(req.headers.get('authorization')));
  if (!payload?.sub) throw new AuthError('Invalid token');
  return payload.sub;
}

// GET — list members
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUser(req);
    const { id } = await params;
    const boardId = parseInt(id);
    const board = await db.board.findFirst({ where: { id: boardId, userId } });
    if (!board) return fail('Board not found', 404);
    const members = await db.boardMember.findMany({ where: { boardId }, orderBy: { createdAt: 'asc' } });
    return ok(members);
  } catch (e) { return handleError(e); }
}

// POST — invite by email
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUser(req);
    const { id } = await params;
    const boardId = parseInt(id);
    const body = z.object({
      email: z.string().email(),
      role: z.enum(['editor', 'viewer']).default('viewer'),
    }).parse(await req.json());

    const board = await db.board.findFirst({ where: { id: boardId, userId } });
    if (!board) return fail('Board not found', 404);

    const token = randomBytes(32).toString('hex');
    const member = await db.boardMember.upsert({
      where: { boardId_inviteEmail: { boardId, inviteEmail: body.email } },
      update: { role: body.role, inviteToken: token, acceptedAt: null },
      create: { boardId, inviteEmail: body.email, role: body.role, inviteToken: token },
    });

    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://taskflow-gamma-liard.vercel.app'}/invite/${token}`;
    await sendInviteEmail(body.email, board.name, inviteUrl);

    return ok({ ...member, inviteUrl }, 201);
  } catch (e) { return handleError(e); }
}

// DELETE — remove member by email (body: { email })
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUser(req);
    const { id } = await params;
    const boardId = parseInt(id);
    const body = z.object({ email: z.string().email() }).parse(await req.json());
    const board = await db.board.findFirst({ where: { id: boardId, userId } });
    if (!board) return fail('Board not found', 404);
    await db.boardMember.deleteMany({ where: { boardId, inviteEmail: body.email } });
    return ok(null);
  } catch (e) { return handleError(e); }
}
