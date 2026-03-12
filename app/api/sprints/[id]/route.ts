import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT, extractBearer } from '@/lib/jwt';
import { ok, fail, handleError, AuthError } from '@/lib/api';
import { z } from 'zod/v4';

async function getUser(req: NextRequest) {
  const payload = await verifyJWT(extractBearer(req.headers.get('authorization')));
  if (!payload?.sub) throw new AuthError('Invalid token');
  return payload.sub;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUser(req);
    const { id } = await params;
    const sprintId = parseInt(id);
    const body = z.object({
      name: z.string().min(1).max(100).optional(),
      start_date: z.string().nullable().optional(),
      end_date: z.string().nullable().optional(),
    }).parse(await req.json());

    const sprint = await db.sprint.findFirst({ where: { id: sprintId }, include: { board: true } });
    if (!sprint || sprint.board.userId !== userId) return fail('Sprint not found', 404);

    const updated = await db.sprint.update({
      where: { id: sprintId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.start_date !== undefined && { startDate: body.start_date ? new Date(body.start_date) : null }),
        ...(body.end_date !== undefined && { endDate: body.end_date ? new Date(body.end_date) : null }),
      },
    });
    return ok(updated);
  } catch (e) { return handleError(e); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUser(req);
    const { id } = await params;
    const sprintId = parseInt(id);
    const sprint = await db.sprint.findFirst({ where: { id: sprintId }, include: { board: true } });
    if (!sprint || sprint.board.userId !== userId) return fail('Sprint not found', 404);
    await db.sprint.delete({ where: { id: sprintId } });
    return ok(null);
  } catch (e) { return handleError(e); }
}
