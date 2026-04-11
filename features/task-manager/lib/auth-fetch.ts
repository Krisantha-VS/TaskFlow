import { AUTH_BASE, AUTH_CLIENT_ID } from '@/shared/config';

const ACCESS_TOKEN_KEY = 'tm_access_token';

// ─── Token storage ────────────────────────────────────────────────────────────
// access_token  → sessionStorage (volatile, expires on tab close)
// refresh_token → httpOnly cookie (set server-side, never readable by JS)

export function storeAccessToken(token: string): void {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  }
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function clearTokens(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  // refresh_token (httpOnly cookie) is cleared server-side via POST /api/auth/logout
}

// ─── Init: consume access token from OAuth callback ──────────────────────────
// The callback route sets a 30-second readable cookie '_at_init'.
// Call this once on app mount — reads the token, stores it, then immediately
// deletes the cookie so it can't be read a second time.

export function consumeInitToken(): string | null {
  if (typeof window === 'undefined') return null;

  const match = document.cookie.match(/(?:^|;\s*)_at_init=([^;]+)/);
  if (!match) return null;

  const token = decodeURIComponent(match[1]);
  // Delete cookie immediately
  document.cookie = '_at_init=; path=/; max-age=0; SameSite=Lax';
  storeAccessToken(token);
  return token;
}

// ─── Refresh (uses httpOnly cookie, not localStorage) ────────────────────────

let _refreshing: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  try {
    // Call TaskFlow's own proxy route — reads httpOnly cookie server-side,
    // calls AuthSaaS without CORS, rotates cookie, returns new access_token.
    const res = await fetch('/api/auth/refresh', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('auth:expired'));
      }
      clearTokens();
      return null;
    }

    const json = await res.json();
    const newToken: string | undefined = json?.data?.accessToken;

    if (!newToken) {
      clearTokens();
      return null;
    }

    storeAccessToken(newToken);
    return newToken;
  } catch {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('auth:expired'));
    }
    clearTokens();
    return null;
  }
}

export async function refreshAccessToken(): Promise<string | null> {
  if (_refreshing) return _refreshing;
  _refreshing = doRefresh().finally(() => { _refreshing = null; });
  return _refreshing;
}

// ─── Initiate OAuth login ─────────────────────────────────────────────────────
// Calls /api/auth/login-start (server route that sets httpOnly PKCE cookies),
// then redirects the browser to AuthSaaS hosted login page.

export function initiateOAuthLogin(): void {
  if (typeof window === 'undefined') return;
  // Navigate directly — server sets httpOnly cookies + redirects to AuthSaaS in one response
  window.location.href = '/api/auth/login-start';
}

// ─── authFetch ────────────────────────────────────────────────────────────────

export async function authFetch(
  url: string,
  options: RequestInit = {},
  token?: string,
): Promise<Response> {
  const currentToken = token ?? getAccessToken();
  const headers = new Headers(options.headers ?? {});
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (currentToken) headers.set('Authorization', `Bearer ${currentToken}`);

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers.set('Authorization', `Bearer ${newToken}`);
      return fetch(url, { ...options, headers });
    }
  }

  return res;
}
