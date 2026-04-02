'use client';

import { useEffect, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion } from '@/lib/useMotion';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}

export function ConfirmDialog({
  open, title, message, confirmLabel = 'Delete', onConfirm, onCancel, destructive = true,
}: ConfirmDialogProps) {
  const titleId = useId();
  const reduceMotion = useReducedMotion();
  const duration = reduceMotion ? 0 : 0.2;

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration, ease: 'easeOut' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative glass rounded-2xl p-6 w-full max-w-sm border border-border shadow-xl"
          >
            <h3 id={titleId} className="font-semibold text-base mb-2">{title}</h3>
            <p className="text-sm text-muted-foreground mb-6">{message}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={onCancel}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-muted/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 ${
                  destructive ? 'bg-red-500' : 'bg-primary'
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
