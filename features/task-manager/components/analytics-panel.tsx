'use client';

import { useEffect, useState } from 'react';
import { X, TrendingUp, CheckCircle2, Clock, ListTodo } from 'lucide-react';
import { taskApi } from '../api';

interface Analytics {
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  dailyCompletions: { date: string; count: number }[];
  dailyCreated: { date: string; count: number }[];
  avgCompletionDays: number | null;
  total: number;
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-6 text-right">{value}</span>
    </div>
  );
}

function MiniChart({ data, color }: { data: { date: string; count: number }[]; color: string }) {
  const max = Math.max(...data.map(d => d.count), 1);
  const last7 = data.slice(-14);
  return (
    <div className="flex items-end gap-0.5 h-12">
      {last7.map(d => (
        <div key={d.date} className="flex-1 flex flex-col justify-end" title={`${d.date}: ${d.count}`}>
          <div
            className={`rounded-sm transition-all duration-300 ${color}`}
            style={{ height: `${Math.max((d.count / max) * 100, d.count > 0 ? 8 : 0)}%` }}
          />
        </div>
      ))}
    </div>
  );
}

interface Props {
  token: string;
  boardId: number;
  onClose: () => void;
}

export function AnalyticsPanel({ token, boardId, onClose }: Props) {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    taskApi.getAnalytics(token, boardId)
      .then(setData)
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [token, boardId]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="relative h-full w-full max-w-sm glass border-l border-border shadow-2xl overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-background/80 backdrop-blur-sm z-10">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Analytics</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
            Loading...
          </div>
        )}

        {!loading && data && (
          <div className="px-5 py-4 space-y-6">
            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="glass border border-border rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <ListTodo className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Total tasks</span>
                </div>
                <p className="text-2xl font-bold">{data.total}</p>
              </div>
              <div className="glass border border-border rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-xs text-muted-foreground">Completed</span>
                </div>
                <p className="text-2xl font-bold text-green-400">{data.byStatus.done ?? 0}</p>
              </div>
              <div className="glass border border-border rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs text-muted-foreground">In progress</span>
                </div>
                <p className="text-2xl font-bold text-amber-400">{data.byStatus.in_progress ?? 0}</p>
              </div>
              <div className="glass border border-border rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs text-muted-foreground">Avg done (days)</span>
                </div>
                <p className="text-2xl font-bold">{data.avgCompletionDays ?? '—'}</p>
              </div>
            </div>

            {/* Completions last 14 days */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Completions — last 14 days</p>
              <div className="glass border border-border rounded-xl p-3">
                <MiniChart data={data.dailyCompletions} color="bg-green-500" />
              </div>
            </div>

            {/* Created last 14 days */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Tasks created — last 14 days</p>
              <div className="glass border border-border rounded-xl p-3">
                <MiniChart data={data.dailyCreated} color="bg-primary/70" />
              </div>
            </div>

            {/* By status */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-3">By status</p>
              <div className="space-y-2">
                {[
                  { key: 'todo',        label: 'Todo',        color: 'bg-slate-400' },
                  { key: 'in_progress', label: 'In Progress', color: 'bg-amber-400' },
                  { key: 'done',        label: 'Done',        color: 'bg-green-500' },
                ].map(({ key, label, color }) => (
                  <div key={key}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{label}</span>
                    </div>
                    <Bar value={data.byStatus[key] ?? 0} max={data.total} color={color} />
                  </div>
                ))}
              </div>
            </div>

            {/* By priority */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-3">By priority</p>
              <div className="space-y-2">
                {[
                  { key: 'high',   label: 'High',   color: 'bg-red-500'   },
                  { key: 'medium', label: 'Medium', color: 'bg-amber-400' },
                  { key: 'low',    label: 'Low',    color: 'bg-slate-400' },
                ].map(({ key, label, color }) => (
                  <div key={key}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{label}</span>
                    </div>
                    <Bar value={data.byPriority[key] ?? 0} max={data.total} color={color} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {!loading && !data && (
          <p className="text-center text-sm text-muted-foreground py-16">Failed to load analytics.</p>
        )}
      </div>
    </div>
  );
}
