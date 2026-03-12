'use client';

import { useEffect, useState } from 'react';
import { X, Users, Mail, Trash2, Copy, Check } from 'lucide-react';
import { taskApi } from '../api';
import type { BoardMember } from '../types';

interface Props {
  token: string;
  boardId: number;
  onClose: () => void;
}

export function MembersPanel({ token, boardId, onClose }: Props) {
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('viewer');
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    taskApi.getBoardMembers(token, boardId)
      .then(setMembers)
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [token, boardId]);

  const handleInvite = async () => {
    if (!email.trim()) return;
    setInviting(true);
    setError(null);
    try {
      const result = await taskApi.inviteMember(token, boardId, email.trim(), role);
      setMembers(prev => [...prev.filter(m => m.inviteEmail !== result.inviteEmail), result]);
      setInviteLink(result.inviteUrl ?? null);
      setEmail('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to invite');
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (memberEmail: string) => {
    setMembers(prev => prev.filter(m => m.inviteEmail !== memberEmail));
    try { await taskApi.removeMember(token, boardId, memberEmail); } catch { /* ignore */ }
  };

  const handleCopy = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="relative h-full w-full max-w-sm glass border-l border-border shadow-2xl overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-background/80 backdrop-blur-sm z-10">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Members</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Invite by email</p>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleInvite(); }}
                placeholder="email@example.com"
                className="flex-1 px-3 py-2 text-xs rounded-lg bg-background border border-border outline-none focus:border-primary transition-colors"
              />
              <select
                value={role}
                onChange={e => setRole(e.target.value as 'editor' | 'viewer')}
                className="text-xs bg-background border border-border rounded-lg px-2 outline-none"
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </select>
            </div>
            <button
              disabled={!email.trim() || inviting}
              onClick={handleInvite}
              className="w-full flex items-center justify-center gap-2 text-xs py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              <Mail className="w-3.5 h-3.5" />
              {inviting ? 'Sending…' : 'Send invite'}
            </button>
            {error && <p className="text-xs text-red-400">{error}</p>}
            {inviteLink && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border">
                <p className="text-xs text-muted-foreground flex-1 truncate">{inviteLink}</p>
                <button onClick={handleCopy} className="text-muted-foreground hover:text-foreground shrink-0">
                  {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-3">
              {members.length > 0 ? `${members.length} member${members.length > 1 ? 's' : ''}` : 'No members yet'}
            </p>
            {loading && <div className="text-xs text-muted-foreground">Loading…</div>}
            <div className="space-y-2">
              {members.map(m => (
                <div key={m.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/20 border border-border group">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{m.inviteEmail}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {m.role} · {m.acceptedAt ? '✓ Accepted' : 'Pending'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemove(m.inviteEmail)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
