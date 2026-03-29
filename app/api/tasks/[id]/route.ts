import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT, extractBearer } from '@/lib/jwt';
import { ok, fail, handleError, AuthError } from '@/lib/api';
import { checkRateLimit } from '@/lib/rate-limit';
import { TaskUpdateSchema } from '@/lib/validate';
import { logActivity } from '@/lib/activity';
import { sendTaskAssignedEmail } from '@/lib/email';

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
    if (!id || id < 1) return fail('Invalid task id', 400);
    const body = TaskUpdateSchema.parse(await req.json());

    // Verify ownership
    const task = await db.task.findFirst({ where: { id, userId } });
    if (!task) return fail('Task not found', 404);

    const update: Record<string, unknown> = {};
    if (body.title !== undefined)         update.title         = body.title;
    if (body.description !== undefined)   update.description   = body.description ?? null;
    if (body.status !== undefined)        update.status        = body.status;
    if (body.priority !== undefined)      update.priority      = body.priority;
    if (body.position !== undefined)      update.position      = body.position;
    if ('due_date' in body)               update.dueDate       = body.due_date ? new Date(body.due_date) : null;
    if (body.recurrence !== undefined)    update.recurrence    = body.recurrence ?? null;
    if ('assigneeEmail' in body)          update.assigneeEmail = body.assigneeEmail ?? null;

    const newAssigneeEmail = 'assigneeEmail' in body ? (body.assigneeEmail ?? null) : undefined;
    const assigneeChanged  = newAssigneeEmail !== undefined && newAssigneeEmail !== task.assigneeEmail;

    const changes = Object.keys(update).join(', ');

    // Determine whether a recurrence spawn is needed before committing
    const willSpawn = body.status === 'done' && task.recurrence;

    if (willSpawn) {
      // Wrap update + new occurrence creation in a single transaction
      const base = task.dueDate ? new Date(task.dueDate) : new Date();
      const y = base.getFullYear(), mo = base.getMonth(), d = base.getDate();
      let next: Date;
      if (task.recurrence === 'daily')       next = new Date(y, mo, d + 1);
      else if (task.recurrence === 'weekly') next = new Date(y, mo, d + 7);
      else /* monthly */                     next = new Date(y, mo + 1, d);

      await db.$transaction([
        db.task.updateMany({ where: { id, userId }, data: update }),
        db.task.create({
          data: {
            boardId:     task.boardId,
            userId:      task.userId,
            title:       task.title,
            description: task.description,
            priority:    task.priority,
            status:      'todo',
            position:    0,
            recurrence:  task.recurrence,
            dueDate:     next,
          },
        }),
      ]);
    } else {
      // FIX: use updateMany with userId in where to prevent TOCTOU
      await db.task.updateMany({ where: { id, userId }, data: update });
    }

    const updated = await db.task.findFirst({ where: { id, userId } });
    logActivity({ boardId: task.boardId, userId, action: 'updated', taskId: id, detail: changes });

    // Non-blocking email: notify new assignee when assigneeEmail is set or changed
    if (assigneeChanged && newAssigneeEmail) {
      const board = await db.board.findFirst({ where: { id: task.boardId } });
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://taskflow-gamma-liard.vercel.app';
      const taskUrl = `${appUrl}/boards/${task.boardId}`;
      sendTaskAssignedEmail(newAssigneeEmail, task.title, board?.name ?? 'TaskFlow', taskUrl).catch(
        (err) => console.error('[email] sendTaskAssignedEmail failed:', err),
      );
    }

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
    if (!id || id < 1) return fail('Invalid task id', 400);
    const task = await db.task.findFirst({ where: { id, userId } });
    if (!task) return fail('Task not found', 404);
    await db.task.delete({ where: { id } });
    logActivity({ boardId: task.boardId, userId, action: 'deleted', taskId: id, detail: task.title });
    return ok(null);
  } catch (e) {
    return handleError(e);
  }
}
