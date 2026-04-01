import { NextRequest } from 'next/server';
import { verifyJWT, extractBearer } from '@/lib/jwt';
import { db } from '@/lib/db';
import { pubsub } from '@/lib/pubsub';
import { checkRateLimit } from '@/lib/rate-limit';

const IDLE_TIMEOUT_MS = 60_000; // Force-unsubscribe a controller idle for 60s with no successful enqueue

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const boardId = parseInt(id);

  let payload: { sub: string } | null = null;
  try {
    payload = await verifyJWT(extractBearer(req.headers.get('authorization')));
  } catch {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!payload?.sub) return new Response('Unauthorized', { status: 401 });
  if (!checkRateLimit(payload.sub)) return new Response('Too many requests', { status: 429 });

  const board = await db.board.findFirst({ where: { id: boardId, userId: payload.sub } });
  if (!board) return new Response('Not found', { status: 404 });

  let ctrl: ReadableStreamDefaultController;

  // Idle timeout: if the controller goes 60s without a successful enqueue, force-remove it.
  let idleTimeout: ReturnType<typeof setTimeout> | null = null;

  function resetIdleTimeout() {
    if (idleTimeout) clearTimeout(idleTimeout);
    idleTimeout = setTimeout(() => {
      pubsub.unsubscribe(boardId, ctrl);
      try { ctrl.close(); } catch { /* already closed */ }
    }, IDLE_TIMEOUT_MS);
  }

  function clearIdleTimeout() {
    if (idleTimeout) {
      clearTimeout(idleTimeout);
      idleTimeout = null;
    }
  }

  const stream = new ReadableStream({
    start(c) {
      ctrl = c;
      pubsub.subscribe(boardId, ctrl);
      // Send initial heartbeat
      ctrl.enqueue(new TextEncoder().encode(': heartbeat\n\n'));
      resetIdleTimeout();
    },
    cancel() {
      clearIdleTimeout();
      pubsub.unsubscribe(boardId, ctrl);
    },
  });

  // Heartbeat every 25s to keep connection alive; each successful heartbeat resets the idle timer
  const heartbeat = setInterval(() => {
    try {
      ctrl.enqueue(new TextEncoder().encode(': heartbeat\n\n'));
      resetIdleTimeout();
    } catch {
      clearInterval(heartbeat);
    }
  }, 25000);

  req.signal.addEventListener('abort', () => {
    clearInterval(heartbeat);
    clearIdleTimeout();
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
