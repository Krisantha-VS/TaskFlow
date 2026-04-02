'use client';

import { useState, useEffect } from 'react';
import { X, Trash2, RotateCcw } from 'lucide-react';

interface DeletedTask {
  id: number;
  title: string;
  priority: string;
  deletedAt: string;
}

interface Props {
  token: string;
  boardId: number;
  onClose: () => void;
  onRestored: () => void;
}

export function TrashPanel({ token, boardId, onClose, onRestored }: Props) {
  const [items, setItems] = useState<DeletedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<number | null>(null);
  const [purging, setPurging] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/boards/${boardId}/trash`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setItems(await res.json());
      } catch { /* ignore */ }
      finally { setLoading(false); }
    };
    load();
  }, [token, boardId]);

  const restore = async (id: number) => {
    setRestoring(id);
    try {
      const res = await fetch(`/api/tasks/${id}/restore`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setItems(prev => prev.filter(t => t.id !== id));
        onRestored();
      }
    } catch { /* ignore */ }
    finally { setRestoring(null); }
  };

  const purge = async (id: number) => {
    setPurging(id);
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'x-hard-delete': '1' },
      });
      if (res.ok) setItems(prev => prev.filter(t => t.id !== id));
    } catch { /* ignore */ }
    finally { setPurging(null); }
  };

  const daysAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    return `${days} days ago`;
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-end p-4" onClick={onClose}>
      <div
        className="glass border border-border rounded-2xl w-full max-w-sm h-full max-h-[80vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-base font-semibold">Trash</h2>
            {items.length > 0 && (
              <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{items.length}</span>
            )}
          </div>
          <button onClick={onClose} aria-label="Close trash panel" className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {[1, 2, 3].map(i => <div key={i} className="h-14 bg-muted/50 rounded-xl" />)}
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Trash is empty.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-3">Items are permanently deleted after 30 days.</p>
              {items.map(item => (
                <div key={item.id} className="flex items-center gap-2 p-3 rounded-xl border border-border bg-muted/10 group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground">Deleted {daysAgo(item.deletedAt)}</p>
                  </div>
                  <button
                    onClick={() => restore(item.id)}
                    disabled={restoring === item.id}
                    aria-label={`Restore task: ${item.title}`}
                    className="text-primary hover:opacity-80 transition-opacity disabled:opacity-40"
                    title="Restore"
                  >
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => purge(item.id)}
                    disabled={purging === item.id}
                    aria-label={`Permanently delete: ${item.title}`}
                    className="text-destructive hover:opacity-80 transition-opacity disabled:opacity-40 opacity-0 group-hover:opacity-100"
                    title="Delete permanently"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
