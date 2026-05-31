import { NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
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

    const action = (body.status && body.status !== task.status) ? 'moved' : 'updated';

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
      // Use transaction to atomically assign issue number for the spawned task
      const base = task.dueDate ? new Date(task.dueDate) : new Date();
      const y = base.getFullYear(), mo = base.getMonth(), d = base.getDate();
      let next: Date;
      if (task.recurrence === 'daily')       next = new Date(y, mo, d + 1);
      else if (task.recurrence === 'weekly') next = new Date(y, mo, d + 7);
      else /* monthly */                     next = new Date(y, mo + 1, d);

      await db.$transaction(async (tx) => {
        await tx.task.update({ where: { id }, data: update as Prisma.TaskUpdateInput });
        const boardRef = await tx.board.update({
          where: { id: task.boardId },
          data: { nextIssueNumber: { increment: 1 } },
        });
        await tx.task.create({
          data: {
            boardId:     task.boardId,
            issueNumber: boardRef.nextIssueNumber - 1,
            userId:      task.userId,
            title:       task.title,
            description: task.description,
            priority:    task.priority,
            status:      'todo',
            position:    0,
            recurrence:  task.recurrence,
            dueDate:     next,
          },
        });
      });
    } else {
      await db.task.update({ where: { id }, data: update as Prisma.TaskUpdateInput });
    }

    const updated = await db.task.findFirst({
      where: { id, userId },
      include: {
        labels: true,
        blockedBy: { include: { blocker: { select: { id: true, title: true, issueNumber: true } } } },
        blocking: { include: { blocked: { select: { id: true, title: true, issueNumber: true } } } },
      },
    });
    logActivity({ boardId: task.boardId, userId, action, taskId: id, detail: changes });

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
    const task = await db.task.findFirst({ where: { id, userId, deletedAt: null } });
    if (!task) return fail('Task not found', 404);
    // x-hard-delete: permanent delete (from trash panel) — otherwise soft delete (T3-3)
    const hardDelete = req.headers.get('x-hard-delete') === '1';
    if (hardDelete) {
      await db.task.delete({ where: { id } });
    } else {
      await db.task.update({ where: { id }, data: { deletedAt: new Date() } });
    }
    logActivity({ boardId: task.boardId, userId, action: 'deleted', taskId: id, detail: task.title });
    return ok(null);
  } catch (e) {
    return handleError(e);
  }
}
