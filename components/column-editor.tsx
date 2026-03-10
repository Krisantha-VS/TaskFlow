'use client';

import { useState } from 'react';
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
      <div className="flex flex-wrap gap-2 mb-4">
        {cols.map((col, idx) => (
          <div key={col.key} className="flex items-center gap-1 bg-muted/50 rounded-lg px-2 py-1.5">
            <input
              value={col.label}
              onChange={e =>
                setCols(prev => prev.map((c, i) => i === idx ? { ...c, label: e.target.value } : c))
              }
              className="bg-transparent text-sm outline-none w-28 border-b border-transparent focus:border-primary"
            />
            {cols.length > 1 && (
              <button
                onClick={() => setCols(prev => prev.filter((_, i) => i !== idx))}
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
