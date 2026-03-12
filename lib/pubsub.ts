type Controller = ReadableStreamDefaultController;

const subscribers = new Map<number, Set<Controller>>();

export const pubsub = {
  subscribe(boardId: number, ctrl: Controller) {
    if (!subscribers.has(boardId)) subscribers.set(boardId, new Set());
    subscribers.get(boardId)!.add(ctrl);
  },
  unsubscribe(boardId: number, ctrl: Controller) {
    subscribers.get(boardId)?.delete(ctrl);
    if (subscribers.get(boardId)?.size === 0) subscribers.delete(boardId);
  },
  emit(boardId: number, event: { type: string; data: unknown }) {
    const msg = `data: ${JSON.stringify(event)}\n\n`;
    const encoded = new TextEncoder().encode(msg);
    subscribers.get(boardId)?.forEach(ctrl => {
      try { ctrl.enqueue(encoded); } catch { /* client disconnected */ }
    });
  },
};
