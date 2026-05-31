'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, TrendingUp, CheckCircle2, Clock, ListTodo } from 'lucide-react';
import { taskApi } from '../api';
import type { Task } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChartData {
  dailyCompletions: { date: string; count: number }[];
  dailyCreated:     { date: string; count: number }[];
}

interface Props {
  token:   string;
  boardId: number;
  tasks:   Task[];
  onClose: () => void;
}

// ─── Module-level SWR cache — survives panel open/close ──────────────────────

const chartCache  = new Map<number, { data: ChartData; ts: number }>();
const CACHE_TTL   = 5 * 60 * 1000; // 5 min — serve from cache
const STALE_AFTER = 60 * 1000;     // 1 min — background revalidate

export async function prefetchAnalytics(token: string, boardId: number): Promise<void> {
  const hit = chartCache.get(boardId);
  if (hit && Date.now() - hit.ts < STALE_AFTER) return;
  try {
    const d = await taskApi.getAnalytics(token, boardId);
    chartCache.set(boardId, {
      data: { dailyCompletions: d.dailyCompletions, dailyCreated: d.dailyCreated },
      ts: Date.now(),
    });
  } catch { /* panel will show error on open */ }
}

// ─── Instant stats from client-side tasks array ───────────────────────────────

function deriveStats(tasks: Task[]) {
  const byStatus:   Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  for (const t of tasks) {
    byStatus[t.status]     = (byStatus[t.status]     ?? 0) + 1;
    byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;
  }
  const done  = tasks.filter(t => t.status === 'done');
  const times = done.map(t =>
    (new Date((t as any).updated_at ?? (t as any).updatedAt ?? 0).getTime() -
     new Date((t as any).created_at ?? (t as any).createdAt ?? 0).getTime()) / 86_400_000
  );
  const avgCompletionDays = times.length
    ? Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 10) / 10
    : null;
  return { byStatus, byPriority, total: tasks.length, avgCompletionDays };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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
  const last14 = data.slice(-14);
  const max    = Math.max(...last14.map(d => d.count), 1);
  return (
    <div className="flex items-end gap-0.5 h-12">
      {last14.map(d => (
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

function ChartSkeleton() {
  const heights = [30, 55, 40, 70, 35, 60, 45, 80, 50, 65, 38, 72, 44, 58];
  return (
    <div className="glass border border-border rounded-xl p-3">
      <div className="flex items-end gap-0.5 h-12">
        {heights.map((h, i) => (
          <div key={i} className="flex-1 flex flex-col justify-end">
            <div className="rounded-sm bg-muted animate-pulse" style={{ height: `${h}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function AnalyticsPanel({ token, boardId, tasks, onClose }: Props) {
  // Stats derived instantly from already-loaded tasks — zero latency
  const stats = useMemo(() => deriveStats(tasks), [tasks]);

  const getCached = () => {
    const hit = chartCache.get(boardId);
    return hit && Date.now() - hit.ts < CACHE_TTL ? hit.data : null;
  };

  const [chartData,    setChartData]    = useState<ChartData | null>(getCached);
  const [chartLoading, setChartLoading] = useState<boolean>(() => !getCached());
  const [error,        setError]        = useState<string | null>(null);

  const fetchCharts = (background = false) => {
    if (!background) setChartLoading(true);
    setError(null);
    taskApi.getAnalytics(token, boardId)
      .then(d => {
        const data: ChartData = { dailyCompletions: d.dailyCompletions, dailyCreated: d.dailyCreated };
        chartCache.set(boardId, { data, ts: Date.now() });
        setChartData(data);
      })
      .catch(() => { if (!background && !chartData) setError('Failed to load charts.'); })
      .finally(() => { if (!background) setChartLoading(false); else setChartLoading(false); });
  };

  useEffect(() => {
    const hit = chartCache.get(boardId);
    if (hit && Date.now() - hit.ts < CACHE_TTL) {
      setChartData(hit.data);
      setChartLoading(false);
      if (Date.now() - hit.ts > STALE_AFTER) fetchCharts(true);
      return;
    }
    fetchCharts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, boardId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

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

        <div className="px-5 py-4 space-y-6">

          {/* Stat cards — instant, no spinner */}
          <div className="grid grid-cols-2 gap-3">
            <div className="glass border border-border rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <ListTodo className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Total tasks</span>
              </div>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <div className="glass border border-border rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                <span className="text-xs text-muted-foreground">Completed</span>
              </div>
              <p className="text-2xl font-bold text-success">{stats.byStatus.done ?? 0}</p>
            </div>
            <div className="glass border border-border rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="w-3.5 h-3.5 text-warning" />
                <span className="text-xs text-muted-foreground">In progress</span>
              </div>
              <p className="text-2xl font-bold text-warning">{stats.byStatus.in_progress ?? 0}</p>
            </div>
            <div className="glass border border-border rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs text-muted-foreground">Avg done (days)</span>
              </div>
              <p className="text-2xl font-bold">{stats.avgCompletionDays ?? '—'}</p>
            </div>
          </div>

          {/* Charts — skeleton while loading, real data when ready */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Completions — last 14 days</p>
            {chartLoading ? <ChartSkeleton /> : chartData ? (
              <div className="glass border border-border rounded-xl p-3">
                <MiniChart data={chartData.dailyCompletions} color="bg-success" />
              </div>
            ) : null}
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Tasks created — last 14 days</p>
            {chartLoading ? <ChartSkeleton /> : chartData ? (
              <div className="glass border border-border rounded-xl p-3">
                <MiniChart data={chartData.dailyCreated} color="bg-primary/70" />
              </div>
            ) : null}
          </div>

          {error && (
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <button
                onClick={() => fetchCharts()}
                className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Try again
              </button>
            </div>
          )}

          {/* By status — instant from client state */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-3">By status</p>
            <div className="space-y-2">
              {[
                { key: 'todo',        label: 'Todo',        color: 'bg-muted-foreground' },
                { key: 'in_progress', label: 'In Progress', color: 'bg-warning'          },
                { key: 'done',        label: 'Done',        color: 'bg-success'           },
              ].map(({ key, label, color }) => (
                <div key={key}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{label}</span>
                  </div>
                  <Bar value={stats.byStatus[key] ?? 0} max={stats.total} color={color} />
                </div>
              ))}
            </div>
          </div>

          {/* By priority — instant from client state */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-3">By priority</p>
            <div className="space-y-2">
              {[
                { key: 'high',   label: 'High',   color: 'bg-destructive'      },
                { key: 'medium', label: 'Medium', color: 'bg-warning'          },
                { key: 'low',    label: 'Low',    color: 'bg-muted-foreground' },
              ].map(({ key, label, color }) => (
                <div key={key}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{label}</span>
                  </div>
                  <Bar value={stats.byPriority[key] ?? 0} max={stats.total} color={color} />
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
