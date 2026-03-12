'use client';

import { useState } from 'react';
import { Plus, Trash2, Flag } from 'lucide-react';
import type { Sprint } from '../types';

interface Props {
  sprints: Sprint[];
  activeSprint: number | 'backlog' | null;
  onSelect: (sprintId: number | 'backlog' | null) => void;
  onCreateSprint: (name: string, startDate?: string, endDate?: string) => Promise<Sprint | undefined>;
  onDeleteSprint: (id: number) => Promise<void>;
}

export function SprintSelector({ sprints, activeSprint, onSelect, onCreateSprint, onDeleteSprint }: Props) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    await onCreateSprint(newName.trim(), newStart || undefined, newEnd || undefined);
    setNewName(''); setNewStart(''); setNewEnd(''); setCreating(false); setSaving(false);
  };

  return (
    <div className="mb-4 flex items-center gap-2 flex-wrap">
      <Flag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => onSelect(null)}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${activeSprint === null ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'}`}
        >
          All tasks
        </button>
        <button
          onClick={() => onSelect('backlog')}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${activeSprint === 'backlog' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'}`}
        >
          Backlog
        </button>
        {sprints.map(s => (
          <div key={s.id} className="flex items-center gap-0.5 group">
            <button
              onClick={() => onSelect(s.id)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${activeSprint === s.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'}`}
            >
              {s.name}
              {s.endDate && (
                <span className="ml-1 opacity-60">· {new Date(s.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
              )}
            </button>
            <button
              onClick={() => onDeleteSprint(s.id)}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-0.5"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}

        {!creating ? (
          <button
            onClick={() => setCreating(true)}
            className="text-xs px-2 py-1 rounded-full border border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Sprint
          </button>
        ) : (
          <div className="flex items-center gap-1.5 flex-wrap">
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false); }}
              placeholder="Sprint name"
              className="text-xs px-2 py-1 rounded-lg bg-background border border-border outline-none focus:border-primary w-28"
            />
            <input type="date" value={newStart} onChange={e => setNewStart(e.target.value)} className="text-xs px-2 py-1 rounded-lg bg-background border border-border outline-none w-32" />
            <input type="date" value={newEnd} onChange={e => setNewEnd(e.target.value)} className="text-xs px-2 py-1 rounded-lg bg-background border border-border outline-none w-32" />
            <button disabled={!newName.trim() || saving} onClick={handleCreate} className="text-xs px-2 py-1 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">Add</button>
            <button onClick={() => setCreating(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}
