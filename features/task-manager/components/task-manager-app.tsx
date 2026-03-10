'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, LogOut, Kanban, Menu, X } from 'lucide-react';
import { KanbanBoard } from './kanban-board';
import { useBoards } from '../hooks/useTasks';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { AUTH_BASE, AUTH_CLIENT_ID } from '@/shared/config';
import {
  storeTokens,
  getAccessToken,
  getRefreshToken,
  clearTokens,
  refreshAccessToken,
} from '../lib/auth-fetch';
import { cn } from '@/lib/utils';

// ─── JWT decode ───────────────────────────────────────────

function decodeJwtPayload(token: string): Record<string, string> | null {
  try {
    const payload = token.split('.')[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ─── Minimal inline auth ──────────────────────────────────

function useInlineAuth() {
  const [token, setToken]                       = useState<string | null>(null);
  const [loading, setLoading]                   = useState(false);
  const [error, setError]                       = useState('');
  // Fix M4: registration success state
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  // Fix A7: on mount — restore from sessionStorage, or try refresh if only refresh token exists
  useEffect(() => {
    const stored = getAccessToken();
    if (stored) {
      setToken(stored);
      return;
    }
    // Fix A7: no access token in session, but refresh token exists — try silent refresh
    const refresh = getRefreshToken();
    if (refresh) {
      refreshAccessToken().then(newToken => {
        if (newToken) setToken(newToken);
      });
    }
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true); setError(''); setRegistrationSuccess(false);
    try {
      const res  = await fetch(`${AUTH_BASE}/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ clientId: AUTH_CLIENT_ID, email, password }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      storeTokens(json.data.accessToken, json.data.refreshToken);
      // Fix A1/A2: setToken here is reactive — no sessionStorage read needed
      setToken(json.data.accessToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally { setLoading(false); }
  };

  const register = async (email: string, password: string, name: string) => {
    setLoading(true); setError(''); setRegistrationSuccess(false);
    try {
      const res  = await fetch(`${AUTH_BASE}/auth/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ clientId: AUTH_CLIENT_ID, email, password, name }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      storeTokens(json.data.tokens.accessToken, json.data.tokens.refreshToken);
      // Fix M4: signal registration success before setting token
      setRegistrationSuccess(true);
      setToken(json.data.tokens.accessToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration failed');
    } finally { setLoading(false); }
  };

  const logout = useCallback(() => {
    clearTokens();
    setToken(null);
    setRegistrationSuccess(false);
  }, []);

  return { token, loading, error, registrationSuccess, login, register, logout };
}

// ─── Auth Gate ────────────────────────────────────────────

// Fix A1/A2: AuthGate receives auth state as props — no independent useInlineAuth call
interface AuthGateProps {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  loading: boolean;
  error: string;
  registrationSuccess: boolean;
}

function AuthGate({ login, register, loading, error, registrationSuccess }: AuthGateProps) {
  // Fix M5: extend mode to include 'forgot'
  const [mode, setMode]           = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail]         = useState('');
  const [password, setPass]       = useState('');
  const [name, setName]           = useState('');
  const [forgotEmail, setForgotEmail]   = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError]     = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') await login(email, password);
    else if (mode === 'register') await register(email, password, name);
  };

  // Fix M5: forgot password handler — calls inline, no external navigation
  const submitForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true); setForgotError(''); setForgotSuccess(false);
    try {
      const res  = await fetch(`${AUTH_BASE}/auth/forgot-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ clientId: AUTH_CLIENT_ID, email: forgotEmail }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? 'Request failed');
      setForgotSuccess(true);
    } catch (e) {
      setForgotError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-3rem)] flex items-center justify-center p-6">
      <div className="glass rounded-2xl p-8 w-full max-w-sm border border-border">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
            <Kanban className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold">TaskFlow</h1>
            <p className="text-xs text-muted-foreground">Kanban task manager</p>
          </div>
        </div>

        {/* Fix M5: forgot password mode */}
        {mode === 'forgot' ? (
          <div className="space-y-4">
            {forgotSuccess ? (
              <p className="text-sm text-green-400 text-center">Check your inbox for a reset link.</p>
            ) : (
              <form onSubmit={submitForgot} className="space-y-4">
                <input
                  type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                  placeholder="Your email address" required
                  className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary transition-colors"
                />
                {forgotError && <p className="text-xs text-red-400">{forgotError}</p>}
                <button
                  type="submit" disabled={forgotLoading}
                  className="w-full py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {forgotLoading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
            )}
            <p className="text-center text-xs text-muted-foreground mt-2">
              <button
                onClick={() => { setMode('login'); setForgotEmail(''); setForgotError(''); setForgotSuccess(false); }}
                className="text-primary hover:underline"
              >
                Back to sign in
              </button>
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {mode === 'register' && (
              <input
                value={name} onChange={e => setName(e.target.value)}
                placeholder="Your name" required
                className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary transition-colors"
              />
            )}
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="Email" required
              className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary transition-colors"
            />
            <input
              type="password" value={password} onChange={e => setPass(e.target.value)}
              placeholder="Password" required minLength={8}
              className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary transition-colors"
            />
            {/* Fix M4: registration success inline message */}
            {registrationSuccess && (
              <p className="text-xs text-green-400">Account created — signing you in…</p>
            )}
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit" disabled={loading}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
            {/* Fix M5: forgot password now toggles inline mode, no external navigation */}
            {mode === 'login' && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            )}
          </form>
        )}

        {mode !== 'forgot' && (
          <p className="text-center text-xs text-muted-foreground mt-4">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="text-primary hover:underline"
            >
              {mode === 'login' ? 'Register' : 'Sign in'}
            </button>
          </p>
        )}

        <p className="text-center text-xs text-muted-foreground/50 mt-6">
          Secured by{' '}
          <a href="/explore" className="hover:text-muted-foreground transition-colors">
            AuthSaas
          </a>
        </p>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────

export function TaskManagerApp() {
  // Fix A1/A2: single useInlineAuth instance at the top level
  const { token, loading: authLoading, error: authError, registrationSuccess, login, register, logout } = useInlineAuth();
  const { boards, loading: boardsLoading, error: boardsError, createBoard, deleteBoard } = useBoards(token);
  const [activeBoardId, setActiveBoardId] = useState<number | null>(null);
  const [newBoardName, setNewBoardName]   = useState('');
  const [addingBoard, setAddingBoard]     = useState(false);
  const [sidebarOpen, setSidebarOpen]     = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ boardId: number; boardName: string } | null>(null);

  useEffect(() => {
    if (boards.length > 0 && !activeBoardId) setActiveBoardId(boards[0].id);
  }, [boards, activeBoardId]);

  // Fix A3: listen for auth:expired event dispatched by authFetch and call logout
  useEffect(() => {
    const handler = () => logout();
    window.addEventListener('auth:expired', handler);
    return () => window.removeEventListener('auth:expired', handler);
  }, [logout]);

  // Decode JWT for user profile
  const profile   = token ? decodeJwtPayload(token) : null;
  const userName  = profile?.name  ?? profile?.email?.split('@')[0] ?? 'User';
  const userEmail = profile?.email ?? '';

  // Fix A1/A2: render AuthGate with props from the single hook instance
  if (!token) {
    return (
      <AuthGate
        login={login}
        register={register}
        loading={authLoading}
        error={authError}
        registrationSuccess={registrationSuccess}
      />
    );
  }

  const activeBoard = boards.find(b => b.id === activeBoardId);

  const closeSidebar = () => setSidebarOpen(false);

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shrink-0">
            <Kanban className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-sm">TaskFlow</span>
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={closeSidebar}
          className="md:hidden p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Board list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-2">Boards</p>
        {boardsLoading ? (
          <div className="px-2 text-sm text-muted-foreground">Loading...</div>
        ) : boardsError ? (
          // Fix A5: display board load error in the sidebar
          <div className="px-2 text-xs text-red-400">{boardsError}</div>
        ) : boards.map(board => (
          <div
            key={board.id}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer group transition-colors',
              activeBoardId === board.id
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            )}
            onClick={() => { setActiveBoardId(board.id); closeSidebar(); }}
          >
            <span className="flex-1 truncate">{board.name}</span>
            <button
              onClick={e => {
                e.stopPropagation();
                setConfirmDelete({ boardId: board.id, boardName: board.name });
              }}
              className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}

        {addingBoard ? (
          <div className="px-2">
            <input
              autoFocus
              value={newBoardName}
              onChange={e => setNewBoardName(e.target.value)}
              onKeyDown={async e => {
                if (e.key === 'Enter' && newBoardName.trim()) {
                  const b = await createBoard(newBoardName.trim());
                  if (b) setActiveBoardId(b.id);
                  setNewBoardName(''); setAddingBoard(false);
                }
                if (e.key === 'Escape') { setAddingBoard(false); setNewBoardName(''); }
              }}
              // Fix M3: cancel input on blur
              onBlur={() => { setAddingBoard(false); setNewBoardName(''); }}
              placeholder="Board name..."
              className="w-full bg-background border border-primary/50 rounded-lg px-3 py-1.5 text-sm outline-none"
            />
          </div>
        ) : (
          <button
            onClick={() => setAddingBoard(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/30 transition-colors w-full"
          >
            <Plus className="w-3.5 h-3.5" />
            New board
          </button>
        )}
      </div>

      {/* User profile + sign out */}
      <div className="p-3 border-t border-border space-y-2">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-semibold">{getInitials(userName)}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate leading-tight">{userName}</p>
            {userEmail && (
              <p className="text-xs text-muted-foreground truncate leading-tight">{userEmail}</p>
            )}
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors w-full"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-[calc(100vh-3rem)] relative">
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-60 border-r border-border bg-background/60 backdrop-blur-sm flex-col shrink-0">
        {sidebarContent}
      </aside>

      {/* ── Mobile sidebar backdrop ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* ── Mobile sidebar drawer ── */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-64 bg-background/95 backdrop-blur-md border-r border-border flex flex-col transition-transform duration-300 ease-in-out md:hidden',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {sidebarContent}
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-auto flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-background/60 backdrop-blur-sm shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Kanban className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold text-sm">
              {activeBoard ? activeBoard.name : 'TaskFlow'}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 md:p-6">
          {activeBoard ? (
            <>
              <div className="mb-6 hidden md:block">
                <h1 className="text-xl font-bold">{activeBoard.name}</h1>
                <p className="text-sm text-muted-foreground">Drag tasks between columns to update status</p>
              </div>
              <KanbanBoard token={token} boardId={activeBoard.id} />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                <Kanban className="w-8 h-8 text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-1">No board selected</h2>
                <p className="text-sm text-muted-foreground">Create a board from the sidebar to get started</p>
              </div>
              <button
                onClick={() => { setAddingBoard(true); setSidebarOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" />
                Create your first board
              </button>
            </div>
          )}
        </div>
      </main>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete board?"
        message={`"${confirmDelete?.boardName}" and all its tasks will be permanently deleted.`}
        onConfirm={() => {
          if (confirmDelete) {
            deleteBoard(confirmDelete.boardId);
            if (activeBoardId === confirmDelete.boardId) setActiveBoardId(null);
          }
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
