'use client';

import { X, ArrowRight, AlertTriangle } from 'lucide-react';
import type { Task } from '../types';
import { DEPENDENCY_TYPES } from '../types';

interface Props {
  tasks: Task[];
  onClose: () => void;
}

export function DependenciesPanel({ tasks, onClose }: Props) {
  const deps = tasks.flatMap(t =>
    (t.blockedBy ?? []).map(d => ({
      blockedTask: t,
      blockerTask: tasks.find(b => b.id === d.blockerId) ?? { id: d.blockerId, title: d.blocker.title, status: 'unknown' as Task['status'] },
      dep: d,
    }))
  );

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-end p-4" onClick={onClose}>
      <div
        className="glass border border-border rounded-2xl w-full max-w-sm h-full max-h-[80vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold">Dependencies</h2>
          <button onClick={onClose} aria-label="Close dependencies panel" className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {deps.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No blocking relationships on this board.</p>
          ) : (
            deps.map(({ blockedTask, blockerTask, dep }) => {
              const isBlockedDone = blockedTask.status === 'done';
              const isBlockerDone = blockerTask.status === 'done';
              const depConfig = DEPENDENCY_TYPES.find(d => d.value === dep.type) ?? DEPENDENCY_TYPES[0];
              return (
                <div key={dep.id} className={`rounded-xl border p-3 space-y-2 ${isBlockedDone ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`${depConfig.badge || 'badge-blocked'} px-2 py-0.5 rounded-full text-xs`}>
                      {depConfig.icon} {blockerTask.title}
                    </span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" aria-hidden="true" />
                    <span className="text-muted-foreground">{dep.type}</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" aria-hidden="true" />
                    <span className="font-medium truncate">{blockedTask.title}</span>
                  </div>
                  {!isBlockerDone && !isBlockedDone && (
                    <div className="flex items-center gap-1 text-xs text-warning">
                      <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                      Blocker not yet done
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
