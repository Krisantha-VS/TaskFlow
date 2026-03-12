import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT, extractBearer } from '@/lib/jwt';
import { fail, AuthError } from '@/lib/api';

async function getUser(req: NextRequest) {
  const payload = await verifyJWT(extractBearer(req.headers.get('authorization')));
  if (!payload?.sub) throw new AuthError('Invalid token');
  return payload.sub;
}

function escapeCSV(value: string | null | undefined): string {
  const str = value ?? '';
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUser(req);
    const id = parseInt((await params).id);
    if (!id || id < 1) return fail('Invalid board id', 400);

    const board = await db.board.findFirst({ where: { id, userId } });
    if (!board) return fail('Board not found', 404);

    const tasks = await db.task.findMany({
      where: { boardId: id },
      include: { labels: true, subtasks: true },
      orderBy: { createdAt: 'asc' },
    });

    const format = req.nextUrl.searchParams.get('format') ?? 'csv';

    if (format === 'ics') {
      const tasksWithDue = tasks.filter(t => t.dueDate != null);
      const events = tasksWithDue.map(t => {
        const due = t.dueDate as Date;
        const yyyy = due.getUTCFullYear();
        const mm = String(due.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(due.getUTCDate()).padStart(2, '0');
        const dateStr = `${yyyy}${mm}${dd}`;
        return [
          'BEGIN:VEVENT',
          `UID:${t.id}@taskflow`,
          `DTSTART;VALUE=DATE:${dateStr}`,
          `SUMMARY:${t.title}`,
          `DESCRIPTION:${t.description ?? ''}`,
          'END:VEVENT',
        ].join('\r\n');
      });

      const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//TaskFlow//EN',
        ...events,
        'END:VCALENDAR',
      ].join('\r\n');

      return new Response(ics, {
        headers: {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Disposition': 'attachment; filename="tasks.ics"',
        },
      });
    }

    // Default: CSV
    const header = 'id,title,description,status,priority,due_date,labels,subtasks_total,subtasks_done';
    const rows = tasks.map(t => {
      const labelNames = t.labels.map((l: { name: string }) => l.name).join(', ');
      const subtasksTotal = t.subtasks.length;
      const subtasksDone = t.subtasks.filter((s: { completed: boolean }) => s.completed).length;
      const dueDate = t.dueDate ? (t.dueDate as Date).toISOString().split('T')[0] : '';
      return [
        escapeCSV(String(t.id)),
        escapeCSV(t.title),
        escapeCSV(t.description),
        escapeCSV(t.status),
        escapeCSV(t.priority),
        escapeCSV(dueDate),
        escapeCSV(labelNames),
        escapeCSV(String(subtasksTotal)),
        escapeCSV(String(subtasksDone)),
      ].join(',');
    });

    const csv = [header, ...rows].join('\n');

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="tasks.csv"',
      },
    });
  } catch (e) {
    if (e instanceof AuthError) return fail('Unauthorized', 401);
    if (e instanceof Error && (e.message === 'Missing token' || e.message === 'Token expired' || e.message === 'Invalid token')) {
      return fail('Unauthorized', 401);
    }
    console.error('[taskflow export]', e);
    return fail('Internal server error', 500);
  }
}
