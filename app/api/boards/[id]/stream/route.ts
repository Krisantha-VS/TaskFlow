import { NextRequest } from 'next/server';
import { verifyJWT, extractBearer } from '@/lib/jwt';
import { db } from '@/lib/db';
import { pubsub } from '@/lib/pubsub';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const boardId = parseInt(id);

  const payload = await verifyJWT(extractBearer(req.headers.get('authorization')));
  if (!payload?.sub) return new Response('Unauthorized', { status: 401 });

  const board = await db.board.findFirst({ where: { id: boardId, userId: payload.sub } });
  if (!board) return new Response('Not found', { status: 404 });

  let ctrl: ReadableStreamDefaultController;
  const stream = new ReadableStream({
    start(c) {
      ctrl = c;
      pubsub.subscribe(boardId, ctrl);
      // Send initial heartbeat
      ctrl.enqueue(new TextEncoder().encode(': heartbeat\n\n'));
    },
    cancel() {
      pubsub.unsubscribe(boardId, ctrl);
    },
  });

  // Heartbeat every 25s to keep connection alive
  const heartbeat = setInterval(() => {
    try {
      ctrl.enqueue(new TextEncoder().encode(': heartbeat\n\n'));
    } catch {
      clearInterval(heartbeat);
    }
  }, 25000);

  req.signal.addEventListener('abort', () => {
    clearInterval(heartbeat);
    pubsub.unsubscribe(boardId, ctrl);
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
