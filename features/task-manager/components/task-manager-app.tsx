'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, LogOut, Kanban, Menu, X, Sun, Moon, Monitor, ChevronRight } from 'lucide-react';
import { useTheme, type Theme } from '@/components/theme-provider';
import { KanbanBoard } from './kanban-board';
import { useBoards } from '../hooks/useTasks';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  getAccessToken,
  clearTokens,
  refreshAccessToken,
  consumeInitToken,
  initiateOAuthLogin,
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

// ─── OAuth Auth Hook ──────────────────────────────────────────────────────────

function useOAuthAuth() {
  const [token,       setToken]       = useState<string | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const init = async () => {
      // 1. Valid token already in sessionStorage
      const stored = getAccessToken();
      if (stored) {
        try {
          const payload = JSON.parse(atob(stored.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
          if (payload?.exp && payload.exp * 1000 > Date.now()) {
            setToken(stored);
            setInitializing(false);
            return;
          }
        } catch { /* malformed — fall through */ }
      }

      // 2. Consume _at_init cookie set by OAuth callback (present only on first load after login)
      const initTok = consumeInitToken();
      if (initTok) {
        setToken(initTok);
        setInitializing(false);
        return;
      }

      // 3. Silent refresh via /api/auth/refresh proxy (reads httpOnly cookie server-side)
      const refreshed = await refreshAccessToken();
      if (refreshed) setToken(refreshed);

      setInitializing(false);
    };

    init();

    const onExpired = () => setToken(null);
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const login = () => {
    setLoading(true);
    initiateOAuthLogin(); // navigates browser — loading state stays true
  };

  const logout = useCallback(() => {
    clearTokens();
    setToken(null);
  }, []);

  return { token, loading, initializing, login, logout };
}

// ─── Auth Gate ────────────────────────────────────────────────────────────────

interface AuthGateProps {
  login: () => void;
  loading: boolean;
}

function AuthGate({ login, loading }: AuthGateProps) {
  const authError = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('auth_error')
    : null;

  return (
    <div className="min-h-[calc(100vh-3rem)] flex items-center justify-center p-6">
      <div className="glass rounded-2xl p-8 w-full max-w-sm border border-border">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-500 flex items-center justify-center">
            <Kanban className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold">TaskFlow</h1>
            <p className="text-xs text-muted-foreground">Kanban task manager</p>
          </div>
        </div>

        {authError && (
          <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2 mb-4 text-center font-mono">
            {authError}
          </p>
        )}

        <p className="text-sm text-muted-foreground mb-6 text-center">
          Sign in to access your boards
        </p>

        <button
          type="button"
          disabled={loading}
          onClick={login}
          className="w-full py-2.5 rounded-lg bg-primary text-white text-sm font-medium
                     hover:opacity-90 transition-opacity disabled:opacity-50
                     flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Redirecting…
            </>
          ) : (
            'Sign in'
          )}
        </button>

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
  const { token, loading: authLoading, initializing, login, logout } = useOAuthAuth();
  const { boards, loading: boardsLoading, error: boardsError, createBoard, deleteBoard, updateBoardColumns } = useBoards(token);
  const [activeBoardId, setActiveBoardId] = useState<number | null>(null);
  const [newBoardName, setNewBoardName]   = useState('');
  const [addingBoard, setAddingBoard]     = useState(false);
  const [sidebarOpen, setSidebarOpen]     = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ boardId: number; boardName: string } | null>(null);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (boards.length > 0 && !activeBoardId) setActiveBoardId(boards[0].id);
  }, [boards, activeBoardId]);

  // Decode JWT for user profile
  const profile   = token ? decodeJwtPayload(token) : null;
  const userName  = profile?.name  ?? profile?.email?.split('@')[0] ?? 'User';
  const userEmail = profile?.email ?? '';

  // Show neutral spinner while init is in-flight — no dashboard or login flash
  if (initializing) {
    return (
      <div className="min-h-[calc(100vh-3rem)] flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!token) {
    return <AuthGate login={login} loading={authLoading} />;
  }

  const activeBoard = boards.find(b => b.id === activeBoardId);

  const closeSidebar = () => setSidebarOpen(false);

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-purple-500 flex items-center justify-center shrink-0">
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
          <div className="px-2 text-xs text-destructive">{boardsError}</div>
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
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-purple-500 flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-semibold">{getInitials(userName)}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate leading-tight">{userName}</p>
            {userEmail && (
              <p className="text-xs text-muted-foreground truncate leading-tight">{userEmail}</p>
            )}
          </div>
        </div>
        {/* Theme selector */}
        <div className="flex items-center gap-1 px-2">
          {([['light', Sun, 'Light'], ['system', Monitor, 'System'], ['dark', Moon, 'Dark']] as [Theme, React.ElementType, string][]).map(([t, Icon, label]) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              aria-label={`${label} mode`}
              title={`${label} mode`}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs transition-colors ${
                theme === t
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">{label}</span>
            </button>
          ))}
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
      {/* T3-8: Skip navigation link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>
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
      <main id="main-content" className="flex-1 overflow-auto flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-background/60 backdrop-blur-sm shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-violet-600 to-purple-500 flex items-center justify-center">
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
              {/* T3-1: Breadcrumb */}
              <div className="mb-6 hidden md:block">
                <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground mb-1.5">
                  <span>Dashboard</span>
                  <ChevronRight className="w-3 h-3" aria-hidden="true" />
                  <span className="text-foreground font-medium">{activeBoard.name}</span>
                </nav>
                <h1 className="text-xl font-bold">{activeBoard.name}</h1>
                <p className="text-sm text-muted-foreground">Drag tasks between columns to update status</p>
              </div>
              <KanbanBoard
                token={token}
                boardId={activeBoard.id}
                board={activeBoard}
                onColumnsUpdate={(cols) => updateBoardColumns(activeBoard.id, cols)}
              />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600/20 to-purple-500/20 flex items-center justify-center">
                <Kanban className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-1">No board selected</h2>
                <p className="text-sm text-muted-foreground">Create a board from the sidebar to get started</p>
              </div>
              <button
                onClick={() => { setAddingBoard(true); setSidebarOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 transition-opacity"
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
