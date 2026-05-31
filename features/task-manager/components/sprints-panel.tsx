'use client';

import { useState } from 'react';
import { X, Plus, Trash2, Flag } from 'lucide-react';
import type { Sprint } from '../types';

interface Props {
  sprints: Sprint[];
  activeSprint: number | 'backlog' | null;
  onSelect: (id: number | 'backlog' | null) => void;
  onCreateSprint: (name: string, startDate?: string, endDate?: string) => Promise<Sprint | undefined>;
  onDeleteSprint: (id: number) => Promise<void>;
  onClose: () => void;
}

export function SprintsPanel({ sprints, activeSprint, onSelect, onCreateSprint, onDeleteSprint, onClose }: Props) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // <input type="date"> returns "YYYY-MM-DD"; API requires full ISO datetime
  const toIso = (d: string) => d ? new Date(d + 'T00:00:00').toISOString() : undefined;

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    await onCreateSprint(newName.trim(), toIso(newStart), toIso(newEnd));
    setNewName(''); setNewStart(''); setNewEnd(''); setCreating(false); setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-end p-4" onClick={onClose}>
      <div
        className="glass border border-border rounded-2xl w-full max-w-sm h-full max-h-[80vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-primary" aria-hidden="true" />
            <h2 className="text-base font-semibold">Sprints</h2>
          </div>
          <button onClick={onClose} aria-label="Close sprints panel" className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {/* All tasks */}
          <button
            onClick={() => { onSelect(null); onClose(); }}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${activeSprint === null ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'}`}
          >
            All tasks
          </button>
          <button
            onClick={() => { onSelect('backlog'); onClose(); }}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${activeSprint === 'backlog' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'}`}
          >
            Backlog
          </button>

          {sprints.length > 0 && <div className="border-t border-border/50 my-1" />}

          {sprints.map(s => (
            <div key={s.id} className="flex items-center gap-2 group">
              {confirmDeleteId === s.id ? (
                <div className="flex-1 flex items-center gap-2 text-xs px-3 py-2 rounded-lg border border-destructive/30 bg-destructive/5">
                  <span>Delete sprint?</span>
                  <button onClick={async () => { setConfirmDeleteId(null); await onDeleteSprint(s.id); }} className="text-destructive font-medium hover:opacity-80">Confirm</button>
                  <button onClick={() => setConfirmDeleteId(null)} className="text-muted-foreground hover:text-foreground">Cancel</button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => { onSelect(s.id); onClose(); }}
                    className={`flex-1 text-left px-3 py-2 rounded-lg text-sm transition-colors ${activeSprint === s.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'}`}
                  >
                    <div>{s.name}</div>
                    {(s.startDate || s.endDate) && (
                      <div className="text-xs text-muted-foreground/60 mt-0.5">
                        {s.startDate && new Date(s.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        {s.startDate && s.endDate && ' → '}
                        {s.endDate && new Date(s.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </div>
                    )}
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(s.id)}
                    aria-label={`Delete sprint: ${s.name}`}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 rounded transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Create new sprint */}
        <div className="p-4 border-t border-border shrink-0">
          {creating ? (
            <div className="space-y-2">
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false); }}
                placeholder="Sprint name"
                aria-label="Sprint name"
                className="w-full text-sm px-3 py-2 rounded-lg bg-input border border-border outline-none focus:border-primary"
              />
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={newStart} onChange={e => setNewStart(e.target.value)} aria-label="Start date" className="text-xs px-2 py-1.5 rounded-lg bg-input border border-border outline-none focus:border-primary" />
                <input type="date" value={newEnd} onChange={e => setNewEnd(e.target.value)} aria-label="End date" className="text-xs px-2 py-1.5 rounded-lg bg-input border border-border outline-none focus:border-primary" />
              </div>
              <div className="flex gap-2">
                <button disabled={!newName.trim() || saving} onClick={handleCreate} className="flex-1 text-xs px-3 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50 hover:opacity-90">
                  {saving ? 'Creating…' : 'Create sprint'}
                </button>
                <button onClick={() => setCreating(false)} className="text-xs px-3 py-2 rounded-lg border border-border hover:bg-muted/50">Cancel</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground border border-dashed border-border hover:border-primary/50 rounded-lg px-3 py-2 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" /> New sprint
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
