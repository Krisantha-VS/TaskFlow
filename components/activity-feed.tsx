'use client';
import type { ActivityLog } from '@/features/task-manager/types';

const ACTION_LABELS: Record<string, string> = {
  created:       'created task',
  updated:       'updated task',
  deleted:       'deleted task',
  board_created: 'created board',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface ActivityFeedProps {
  logs: ActivityLog[];
  loading?: boolean;
}

export function ActivityFeed({ logs, loading }: ActivityFeedProps) {
  if (loading) return <div className="text-xs text-muted-foreground p-4">Loading activity…</div>;
  if (!logs.length) return <div className="text-xs text-muted-foreground p-4">No activity yet.</div>;

  return (
    <div className="space-y-3 p-4">
      {logs.map(log => (
        <div key={log.id} className="flex gap-3 items-start">
          <div className="w-1.5 h-1.5 rounded-full bg-primary/60 mt-1.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-foreground/80">
              <span className="font-medium">{ACTION_LABELS[log.action] ?? log.action}</span>
              {log.detail && <span className="text-muted-foreground"> · {log.detail}</span>}
            </p>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">{timeAgo(log.createdAt)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
