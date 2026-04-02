'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import type { BoardColumn } from '@/features/task-manager/types';
import { DEFAULT_COLUMNS } from '@/features/task-manager/types';

interface Props {
  columns: BoardColumn[];
  onSave: (c: BoardColumn[]) => Promise<void>;
  onCancel: () => void;
}

export function ColumnEditor({ columns, onSave, onCancel }: Props) {
  const [cols, setCols] = useState<BoardColumn[]>(columns);
  const [saving, setSaving] = useState(false);

  return (
    <div className="mb-4 p-4 rounded-xl border border-border bg-background/80">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium">Manage columns</p>
        <button
          onClick={() => setCols(DEFAULT_COLUMNS)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Reset
        </button>
      </div>
      <div className="flex flex-col gap-2 mb-4">
        {cols.map((col, idx) => (
          <div key={col.key} className="flex items-center gap-1.5 bg-muted/50 rounded-lg px-2 py-1.5">
            <div className="flex flex-col">
              <button
                onClick={() => setCols(prev => { const a = [...prev]; [a[idx - 1], a[idx]] = [a[idx], a[idx - 1]]; return a; })}
                disabled={idx === 0}
                aria-label={`Move ${col.label} up`}
                className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-opacity leading-none"
              >
                <ChevronUp className="w-3 h-3" aria-hidden="true" />
              </button>
              <button
                onClick={() => setCols(prev => { const a = [...prev]; [a[idx + 1], a[idx]] = [a[idx], a[idx + 1]]; return a; })}
                disabled={idx === cols.length - 1}
                aria-label={`Move ${col.label} down`}
                className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-opacity leading-none"
              >
                <ChevronDown className="w-3 h-3" aria-hidden="true" />
              </button>
            </div>
            <label htmlFor={`col-name-${col.key}`} className="sr-only">
              Column name
            </label>
            <input
              id={`col-name-${col.key}`}
              aria-label={`Column name: ${col.label}`}
              value={col.label}
              onChange={e =>
                setCols(prev => prev.map((c, i) => i === idx ? { ...c, label: e.target.value } : c))
              }
              className="bg-transparent text-sm outline-none flex-1 border-b border-transparent focus:border-primary"
            />
            {cols.length > 1 && (
              <button
                onClick={() => setCols(prev => prev.filter((_, i) => i !== idx))}
                aria-label={`Delete column: ${col.label}`}
                className="text-muted-foreground hover:text-destructive text-xs"
              >
                ×
              </button>
            )}
          </div>
        ))}
        {cols.length < 5 && (
          <button
            onClick={() =>
              setCols(p => [...p, { key: `custom_${Date.now()}`, label: 'New Column' }])
            }
            className="text-xs px-3 py-1.5 rounded-lg border border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-foreground transition-colors"
          >
            + Add column
          </button>
        )}
      </div>
      <div className="flex gap-2">
        <button
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            await onSave(cols);
            setSaving(false);
          }}
          className="px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground disabled:opacity-50 hover:opacity-90"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted/50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
